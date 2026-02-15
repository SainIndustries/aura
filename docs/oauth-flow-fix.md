# OAuth Popup Lifecycle Fix

**Date:** 2026-02-15
**Commit:** `acbe4e1` (rebased to `054ce82`)

---

## Problem

After completing the Google OAuth flow, the popup window stayed open. Users had to manually close it. The parent window (chat page) didn't reliably detect that authorization was complete.

### Root Cause

The OAuth callback at `src/app/api/integrations/google/callback/route.ts` returned HTML with `<script>window.close();</script>`. This fails in most modern browsers because:

1. The popup navigates through Google's consent screen (cross-origin redirect)
2. After Google redirects back to the callback URL, the browser considers the page "not opened by JavaScript" since it navigated away from the original `window.open()` URL
3. `window.close()` is silently blocked by the browser's popup security policy

Additionally, error paths (OAuth denied, invalid state, token exchange failure) used `NextResponse.redirect()` to navigate the popup to `/integrations`, which made no sense inside a popup context.

### How the Chat Page Detected Popup Close (Before Fix)

The chat page (`src/app/(dashboard)/chat/page.tsx`) opened the OAuth popup via `window.open()` and polled `oauthPopupRef.current?.closed` every 1 second. When detected as closed, it called `refresh()` to update integration status. Since `window.close()` failed, the poll never triggered, and the state never refreshed.

---

## Fix

### 1. `postMessage` from Callback to Parent Window

Added a `popupHtml()` helper function that returns HTML with both `postMessage` and `window.close()`:

```typescript
function popupHtml(type: "oauth-success" | "oauth-error", message: string): Response {
  return new Response(
    `<html><body><script>
if (window.opener) {
  window.opener.postMessage({ type: '${type}', provider: 'google' }, window.location.origin);
}
window.close();
</script><p>${message}</p></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
```

All 5 response paths now use this helper:
- OAuth denied → `popupHtml("oauth-error", ...)`
- Missing parameters → `popupHtml("oauth-error", ...)`
- Invalid CSRF state → `popupHtml("oauth-error", ...)`
- Token exchange failure → `popupHtml("oauth-error", ...)`
- Success → `popupHtml("oauth-success", ...)`
- Catch-all error → `popupHtml("oauth-error", ...)`

### 2. Parent Window Listens for `postMessage`

Added a `useEffect` in the chat page that listens for `message` events:

```typescript
useEffect(() => {
  function handleOAuthMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    const { type, provider } = event.data ?? {};
    if (type === "oauth-success") {
      oauthPopupRef.current?.close();
      // clear poll timer, call refresh()
    } else if (type === "oauth-error") {
      oauthPopupRef.current?.close();
      // clear poll timer
    }
  }
  window.addEventListener("message", handleOAuthMessage);
  return () => window.removeEventListener("message", handleOAuthMessage);
}, [refresh]);
```

The parent closes the popup via its stored reference (`oauthPopupRef.current.close()`), which always works because the parent opened the window.

### 3. Polling Kept as Fallback

The existing `setInterval` polling for `popup.closed` is preserved. If `postMessage` fails (e.g., cross-subdomain edge case), manually closing the popup still triggers `refresh()`.

---

## Bonus Fix: Slack Popup Polling Leak

The `openOAuthPopup("slack")` function polled `refresh()` every 2 seconds but never checked if the popup closed. It ran indefinitely until component unmount. Fixed by adding the same `popup.closed` check as the Google flow:

```typescript
pollTimerRef.current = setInterval(async () => {
  if (oauthPopupRef.current?.closed) {
    clearInterval(pollTimerRef.current!);
    pollTimerRef.current = null;
    await refresh();
    return;
  }
  await refresh();
}, 2000);
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/app/api/integrations/google/callback/route.ts` | Added `popupHtml()` helper, replaced all 5 response paths, removed unused `NextResponse` import |
| `src/app/(dashboard)/chat/page.tsx` | Added `postMessage` listener `useEffect`, fixed Slack polling leak |

## Security Considerations

- `postMessage` target origin uses `window.location.origin` (same origin as the callback URL)
- Parent window validates `event.origin === window.location.origin` before processing
- No sensitive data in the message payload (only `type` and `provider`)
