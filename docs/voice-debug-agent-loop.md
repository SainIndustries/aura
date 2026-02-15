# Voice Debug: Agent Response Loop Investigation

## Bug Summary

Voice mode breaks after the agent's first message. The agent speaks its greeting successfully, but then goes silent — no response to user speech, no agent activity, and the session eventually closes.

## Root Cause: URL Path Mismatch

ElevenLabs Conversational AI treats the custom LLM `url` field as a **base URL** and appends `/chat/completions` to it when making LLM requests. Our code was providing the full endpoint URL with query parameters, so ElevenLabs' request never reached our handler.

### How the Bug Manifests

1. Voice session connects via WebSocket (client <-> ElevenLabs)
2. ElevenLabs speaks the static `first_message` configured in the agent — **no LLM call needed**
3. User speaks -> ElevenLabs STT transcribes the audio
4. ElevenLabs POSTs to `{base_url}/chat/completions` -> `${APP_URL}/api/voice/llm-proxy/chat/completions?agentId=...&token=...`
5. **Next.js returns 404** — no route handler exists at that path
6. ElevenLabs receives no LLM response -> silence -> eventual session timeout

### Why the First Message Worked

The `first_message` field (`"Hey! I'm ${agent.name}. How can I help you today?"`) is a static string configured directly in the ElevenLabs ConvAI agent config (line 125 of `elevenlabs-agent/route.ts`). ElevenLabs TTS speaks it immediately upon connection without any LLM call. The custom LLM proxy is only invoked for subsequent conversational turns.

### Evidence

1. **ElevenLabs docs show base URLs** for all custom LLM examples:
   - Together AI: `https://api.together.xyz/v1`
   - Groq Cloud: `https://api.groq.com/openai/v1`
   - Docs state: "set up a compatible server endpoint using OpenAI's style, specifically targeting create_chat_completion"

2. **`api_type` enum**: ElevenLabs added `CustomLLMAPIType` with `chat_completions` and `responses` values, confirming the platform appends the path based on API type.

3. **Our buggy URL** (in `elevenlabs-agent/route.ts:79`):
   ```typescript
   // BEFORE (broken): full endpoint with query params
   const llmProxyUrl = `${appUrl}/api/voice/llm-proxy?agentId=${agentId}&token=${llmProxyToken}`;
   ```

4. **Only route handler** was at `src/app/api/voice/llm-proxy/route.ts` — no handler at the `/chat/completions` subpath.

## How the Bug Was Traced

1. **Mapped the voice architecture**: Identified two separate connections:
   - Client <-> ElevenLabs: persistent WebSocket (audio streaming, events)
   - ElevenLabs <-> Custom LLM proxy: per-turn HTTP POST (OpenAI chat completions format)

2. **Identified the first_message as static**: The `first_message` in the ElevenLabs agent config is spoken directly by TTS — no LLM involvement. This explained why it worked while subsequent turns did not.

3. **Researched ElevenLabs custom LLM protocol**: Discovered that ElevenLabs treats the custom LLM URL as a base URL and appends `/chat/completions` (or `/responses` depending on `api_type`). All documentation examples use base URLs without the endpoint path.

4. **Verified no matching route**: Confirmed only `src/app/api/voice/llm-proxy/route.ts` existed. No handler at `/api/voice/llm-proxy/chat/completions` or any catch-all route.

## Fix Applied

### Fix 1: URL Path (Critical)

Changed the URL from query params to path segments and created a new route:

```typescript
// AFTER (fixed): base URL with path segments
const llmProxyUrl = `${appUrl}/api/voice/llm-proxy/${agentId}/${llmProxyToken}`;
```

Created new route at: `src/app/api/voice/llm-proxy/[agentId]/[token]/chat/completions/route.ts`

ElevenLabs now calls: `${APP_URL}/api/voice/llm-proxy/{agentId}/{token}/chat/completions` which matches.

### Fix 2: Missing `finish_reason: "stop"` in Streaming

The fallback LLM streaming path used `makeOpenAIChunk()` which always set `finish_reason: null`. The standard OpenAI streaming protocol requires a final chunk with `finish_reason: "stop"` and empty delta before `[DONE]`. Added `makeFinishChunk()` to emit this signal so ElevenLabs knows the response is complete and can begin TTS.

### Fix 3: Double `[DONE]` Signal

`proxyToOpenClaw()` forwarded ALL `data:` lines from OpenClaw including its `data: [DONE]`. The caller then sent another `data: [DONE]`. Fixed by filtering out `data: [DONE]` lines in the passthrough loop.

### Fix 4: Duplicate System Prompt

Two system prompts were being sent:
- `elevenlabs-agent/route.ts` set `prompt: systemPrompt` in the agent config (ElevenLabs sends this as a system message)
- `llm-proxy/route.ts` prepended its own via `buildSystemPrompt()`

Removed the `prompt` field from the ElevenLabs agent creation config, keeping only the proxy's `buildSystemPrompt()`.

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/voice/elevenlabs-agent/route.ts` | URL format (path segments), removed duplicate `prompt` |
| `src/app/api/voice/llm-proxy/[agentId]/[token]/chat/completions/route.ts` | **New**: route handler for ElevenLabs chat completions calls |
| `src/app/api/voice/llm-proxy/route.ts` | Streaming fixes (finish chunk, [DONE] filter), kept for backward compat |

## Architecture Reference

```
User's browser
    |
    | WebSocket (audio + events)
    v
ElevenLabs ConvAI Platform
    |
    | 1. first_message: static, no LLM call
    | 2. subsequent turns: HTTP POST to custom LLM
    |
    v
Aura LLM Proxy  (/api/voice/llm-proxy/{agentId}/{token}/chat/completions)
    |
    |-- OpenClaw instance (if running): http://{serverIp}/v1/chat/completions
    |-- Fallback LLM (OpenRouter/OpenAI): direct API call
```
