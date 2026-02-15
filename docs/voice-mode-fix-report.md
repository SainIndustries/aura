# Voice Mode Fix Report

## Bug Description
Voice mode breaks after the agent's first message. Agent speaks greeting successfully, then long silence — no response to user speech, session eventually closes.

## Root Cause
**ElevenLabs URL path mismatch (404).**

ElevenLabs ConvAI treats the `custom_llm.url` as a base URL and appends `/chat/completions` to it. Our code provided the full endpoint path, resulting in a 404 when ElevenLabs tried to reach the LLM.

| What we configured | What ElevenLabs called |
|---|---|
| `${appUrl}/api/voice/llm-proxy?agentId=X&token=Y` | `${appUrl}/api/voice/llm-proxy/chat/completions?agentId=X&token=Y` |

The first message succeeded because it's a static `first_message` configured on the ConvAI agent — no LLM call is made. The bug manifested on the second turn when ElevenLabs first called the custom LLM.

## Investigation Summary

Three parallel investigations were conducted:

1. **Audio Input Pipeline** (`voice-debug-audio-pipeline.md`): Confirmed the ElevenLabs SDK manages mic capture continuously via AudioWorklet. The audio input path is NOT broken. Mic runs continuously, server-side VAD detects speech, transcription happens on ElevenLabs infrastructure.

2. **Session & Connection** (`voice-debug-session-connection.md`): Confirmed the client-ElevenLabs WebSocket stays open. The break is in the per-turn HTTP request from ElevenLabs to our custom LLM proxy. Also identified the double `[DONE]` and missing error visibility issues.

3. **Agent Response Loop** (`voice-debug-agent-loop.md`): Identified the root cause — URL path mismatch causing 404 on LLM proxy calls. Also found secondary issues with streaming format and duplicate system prompts.

## Fixes Applied

### Fix 1 (Critical): Route Structure for Custom LLM URL
- Changed URL format from query params to path segments: `${appUrl}/api/voice/llm-proxy/${agentId}/${llmProxyToken}`
- Created new route at `src/app/api/voice/llm-proxy/[agentId]/[token]/chat/completions/route.ts`
- ElevenLabs now correctly reaches the handler when appending `/chat/completions`

### Fix 2: Remove Double `[DONE]`
- Filtered out `data: [DONE]` in `proxyToOpenClaw()` passthrough loop
- Caller sends the single `[DONE]` marker after stream completes

### Fix 3: Add `finish_reason: "stop"` to Final Chunk
- Added `makeFinishChunk()` to emit proper OpenAI-format final chunk with `finish_reason: "stop"` before `[DONE]`

### Fix 4: Remove Duplicate System Prompt
- Removed `prompt` field from ElevenLabs ConvAI agent config in `elevenlabs-agent/route.ts`
- System prompt now only sent via `buildSystemPrompt()` in the LLM proxy

### Fix 5 (Observability): Improved Voice Hook Callbacks
- Added `onModeChange`, `onDisconnect` (with details logging) to `use-voice-chat.ts`
- Provides diagnostic visibility into turn state transitions and disconnect reasons

## Files Modified
| File | Change |
|---|---|
| `src/app/api/voice/elevenlabs-agent/route.ts` | URL format (path segments), removed duplicate prompt |
| `src/app/api/voice/llm-proxy/[agentId]/[token]/chat/completions/route.ts` | **New**: route handler matching ElevenLabs URL convention |
| `src/app/api/voice/llm-proxy/route.ts` | Streaming fixes (finish chunk, [DONE] filter) |
| `src/hooks/use-voice-chat.ts` | Added observability callbacks |

## Test Recommendations
1. Start a voice session and verify agent greeting plays
2. Speak a response and verify the agent responds (no silence)
3. Have a multi-turn voice conversation (3+ exchanges)
4. Check server logs for LLM proxy requests arriving with correct path
5. Test with both OpenClaw running and fallback LLM
6. Verify `onDisconnect` details are logged when session ends
7. Test interrupting the agent mid-speech

## Architecture Notes for Future Reference
- ElevenLabs ConvAI `custom_llm.url` is a **base URL**, not a full endpoint
- ElevenLabs appends the path based on `api_type` (default: `/chat/completions`)
- The `first_message` is static and never calls the custom LLM
- The client-ElevenLabs WebSocket and ElevenLabs-LLM HTTP are independent connections
- The ElevenLabs SDK manages all audio capture/playback via AudioWorklet — no manual mic management needed
