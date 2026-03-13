# 08 — Voice Instruction Type

## Overview

This file implements `src/instructionTypes/voiceInstruction.js`. It handles the voice-to-text instruction workflow using the Web Speech API:

1. Expert clicks the Voice (speaker) icon in an empty instruction row
2. A recording indicator appears (red pulsing dot + "Recording..." text)
3. The browser's `SpeechRecognition` API begins listening
4. Real-time interim transcription is displayed in a dialog box
5. When speech recognition ends (silence detection or manual stop), the final transcript is stored
6. The instruction slot shows "Voice N"

---

## File: `src/instructionTypes/voiceInstruction.js`

### Architecture

- `activateVoiceRecording(assetName, slotIndex, onTranscript)` — creates a `SpeechRecognition` instance with `continuous: true` and `interimResults: true`. Shows a recording indicator and live transcript dialog. On result, accumulates final and interim text. Clicking the voice icon again toggles recording off.
- **Fallback** — if `SpeechRecognition` is unavailable (e.g., Firefox), falls back to a styled text input dialog where the user can type their instruction manually.
- Error handling covers denied microphone access, no-speech silence, and other recognition errors.

### Exports

- `activateVoiceRecording(assetName, slotIndex, onTranscript)`

---

## Integration Notes

- `calloutSystem.js` calls `activateVoiceRecording()` and receives the transcript string via callback
- The instruction is stored as: `{ type: 'voice', data: { transcript }, label: 'Voice N' }`
- Viewing a voice instruction (by clicking its label) shows a transcript dialog near the asset. In novice mode, a Play button triggers text-to-speech playback via `SpeechSynthesisUtterance`. These are handled by `calloutSystem.js`.

---
