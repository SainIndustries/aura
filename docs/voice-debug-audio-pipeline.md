# Voice Debug: Audio Input Pipeline Investigation

## Summary

The audio INPUT pipeline (mic → STT → transcription) is **NOT the root cause**. The ElevenLabs SDK manages the entire audio capture, encoding, and transcription pipeline internally via AudioWorklet processors. The mic stays active throughout the session.

The root cause is downstream — in the custom LLM proxy that ElevenLabs calls after transcription (see `voice-debug-agent-loop.md`).

---

## Detailed Trace: Audio Input Path

### What happens when voice mode starts:
1. `startVoice()` in `use-voice-chat.ts:53-110`
2. POST `/api/voice/elevenlabs-agent` — creates ConvAI agent with custom LLM URL
3. POST `/api/voice/signed-url` — gets WebSocket signed URL
4. `navigator.mediaDevices.getUserMedia({ audio: true })` — gets mic permission
5. `conversation.startSession({ signedUrl })` — opens WebSocket to ElevenLabs

### SDK internal audio pipeline (from `@elevenlabs/client`):
- **Input**: `rawAudioProcessor` AudioWorklet captures mic audio continuously
- **Output**: `audioConcatProcessor` AudioWorklet plays back TTS chunks
- Both run as separate AudioWorkletNodes on same AudioContext
- Mic capture **never stops** during a session — it runs continuously
- Server-side VAD on ElevenLabs infra detects speech activity
- Transcription is server-side — results come back via WebSocket

### After agent's first TTS message completes:
- Mic stream: **Still active** (AudioWorklet keeps running)
- Audio sent to ElevenLabs for STT: **Yes** (continuous streaming)
- Transcription results: **Should come back** (server-side processing)
- Transcribed messages forwarded to agent: **This is where it breaks** (see agent-loop investigation)

---

## Why the First Message Succeeds

The ConvAI agent is configured with a static `first_message`:
```js
// elevenlabs-agent/route.ts:125
first_message: `Hey! I'm ${agent.name}. How can I help you today?`
```

This is spoken directly by ElevenLabs TTS — **no custom LLM call is made** for the first message. It's a pre-configured greeting.

---

## Why Subsequent Messages Fail

After the user speaks, the flow is:
1. ElevenLabs VAD detects user speech
2. ElevenLabs transcribes it (server-side STT)
3. ElevenLabs sends transcript to the **custom LLM URL**:
   ```
   ${NEXT_PUBLIC_APP_URL}/api/voice/llm-proxy?agentId=${agentId}&token=${llmProxyToken}
   ```
4. **ElevenLabs servers make this HTTP request** (server-to-server, NOT from browser)
5. ElevenLabs appends `/chat/completions` to the URL → 404 → no response → silence

See `voice-debug-agent-loop.md` for full root cause analysis.

---

## Observations About `use-voice-chat.ts`

The hook only registers 4 out of 20+ available callbacks:
- `onMessage` — captures user/agent text messages
- `onError` — handles errors
- `onConnect` — tracks connection state
- `onDisconnect` — tracks disconnection

**Missing callbacks that would aid debugging:**
- `onModeChange` — would show when agent transitions speaking ↔ listening
- `onVadScore` — would show if user speech is being detected at all
- `onInterruption` — would show if user speech triggers interruptions
- `onStatusChange` — would show connection state transitions

While these missing callbacks aren't the *cause* of the bug, adding them provides critical diagnostic visibility.

---

## What Was Ruled Out

- **Mic stream not reopened after TTS**: Ruled out — SDK AudioWorklet runs continuously
- **Mic permissions lost after playback**: Ruled out — `getUserMedia` permission persists
- **Duplex issues (TTS blocking STT)**: Ruled out — separate AudioWorkletNodes, browser echo cancellation
- **Audio stream consumed and not restarted**: Ruled out — continuous worklet processing
- **Missing speech/transcription event handlers**: Not the cause — SDK handles internally

---

## Files Analyzed
- `src/hooks/use-voice-chat.ts` — main voice hook
- `src/components/chat/voice-mode-panel.tsx` — UI component (display-only, no issues)
- `src/app/(dashboard)/chat/page.tsx` — chat page integration
- `src/app/api/voice/elevenlabs-agent/route.ts` — ConvAI agent creation
- `src/app/api/voice/signed-url/route.ts` — signed URL generation
- `src/app/api/voice/llm-proxy/route.ts` — custom LLM proxy
- `node_modules/@elevenlabs/client/dist/` — SDK types and architecture
- `node_modules/@elevenlabs/react/dist/index.d.ts` — React hook types
