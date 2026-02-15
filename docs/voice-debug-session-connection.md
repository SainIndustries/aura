# Voice Debug: Session & Connection Transport Layer Investigation

## Summary

Voice mode broke after the agent's first message: greeting spoke successfully, then silence, no response to user speech, session eventually closed. Root cause was a URL path mismatch — ElevenLabs appends `/chat/completions` to the custom LLM base URL, but we provided a full endpoint URL.

## Architecture

The ElevenLabs Conversational AI uses **two separate connections**:

1. **Client ↔ ElevenLabs**: Persistent WebSocket (carries audio, transcriptions, mode events, ping/pong)
   - Managed by `@elevenlabs/client` SDK via `useConversation()` hook
   - Opened with a signed URL from ElevenLabs API
   - This connection was healthy throughout the bug

2. **ElevenLabs ↔ Custom LLM proxy**: Per-turn HTTP POST (OpenAI chat/completions format)
   - ElevenLabs makes a **new HTTP request** for each conversation turn
   - Sends full message history in `messages[]` array
   - Expects SSE streaming response (`text/event-stream`)
   - ElevenLabs **appends `/chat/completions`** to the configured base URL

The `first_message` ("Hey! I'm {name}...") is a static string configured on the ElevenLabs ConvAI agent — spoken directly by TTS without any LLM call. The first real LLM call only happens when the user responds.

## Root Cause: URL Path Mismatch (Fixed)

**File**: `src/app/api/voice/elevenlabs-agent/route.ts`

We provided the full endpoint URL as the custom LLM URL:
```
https://app.example.com/api/voice/llm-proxy?agentId=X&token=Y
```

ElevenLabs treated it as a base URL and appended `/chat/completions`:
```
https://app.example.com/api/voice/llm-proxy/chat/completions?agentId=X&token=Y
```

No route existed at that path → 404 → silence → session timeout.

**Fix**: Restructured to use path segments. New route at:
```
src/app/api/voice/llm-proxy/[agentId]/[token]/chat/completions/route.ts
```

## Secondary Issues Found & Fixed

### Double `[DONE]` in SSE Stream
`proxyToOpenClaw()` forwarded OpenClaw's `data: [DONE]`, then the caller sent another. Fixed by filtering `data: [DONE]` in the passthrough loop.

### Missing `finish_reason: "stop"`
The `makeOpenAIChunk()` helper always set `finish_reason: null`. Added `makeFinishChunk()` to send proper stream termination per OpenAI spec.

### Double System Prompt
Agent config included a `prompt` field (sent by ElevenLabs in messages), and the proxy prepended another via `buildSystemPrompt()`. Fixed by removing the prompt from agent config.

## Observability Improvements Added

### Enhanced `onDisconnect` Callback
Previously ignored `DisconnectionDetails`. Now captures and logs:
- `reason`: `"error"` | `"agent"` | `"user"` — distinguishes failure vs normal close
- `closeCode`: WebSocket close code (e.g., 1011 for server error)
- `closeReason`: Human-readable close reason
- Error-type disconnects now surface the error message to the user

### Added `onStatusChange` and `onModeChange` Callbacks
Logs session status transitions (`disconnected` → `connecting` → `connected`) and mode changes (`speaking` ↔ `listening`) for debugging.

### Enhanced LLM Proxy Logging
- Request details: agentId, instance IP, stream flag, message count, last role
- Response timing: milliseconds from request to stream completion
- Fallback tracking: which LLM model is used when OpenClaw is unavailable
- OpenClaw proxy details: target IP, message count

## Error Flow (When Custom LLM Fails)

1. ElevenLabs receives HTTP error (404, 500, timeout) from custom LLM
2. ElevenLabs sends `ErrorMessage` event over WebSocket with `error_type`:
   - `custom_llm_error` — LLM endpoint returned an error
   - `llm_timeout` — LLM didn't respond in time
   - `http_exception` — general HTTP failure
3. SDK's `handleErrorEvent()` fires → `onError(message)` callback
4. ElevenLabs may close WebSocket → `onDisconnect(details)` with `reason: "error"`
5. Error codes follow WebSocket spec: 1000 (normal), 1008 (policy), 1011 (server error)

## Files

| File | Role |
|------|------|
| `src/hooks/use-voice-chat.ts` | Client-side connection hook with enhanced callbacks |
| `src/app/api/voice/llm-proxy/[agentId]/[token]/chat/completions/route.ts` | LLM proxy (new path) |
| `src/app/api/voice/elevenlabs-agent/route.ts` | ConvAI agent creation |
| `src/app/api/voice/signed-url/route.ts` | Signed WebSocket URL generation |

## SDK Reference

- `@elevenlabs/react`: `useConversation()` hook, `DisconnectionDetails` type
- `@elevenlabs/types`: `Callbacks`, `Status`, `Mode`, `ErrorMessage`, `ErrorEventErrorType`
- Error types defined in `node_modules/@elevenlabs/types/generated/types/asyncapi-types.ts`
