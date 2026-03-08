// voiceInstruction.js — Web Speech API voice-to-text

let isRecording = false;
let recognition = null;
let voiceCallback = null;
let recordingIndicatorEl = null;
let liveTranscriptEl = null;
let finalTranscript = '';
let interimTranscript = '';

function getSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('[VoiceInstruction] SpeechRecognition API not available. Browser:', navigator.userAgent);
    console.warn('[VoiceInstruction] Voice-to-text requires Chrome/Edge. Safari needs HTTPS. Firefox is not supported.');
    return null;
  }
  return SpeechRecognition;
}

function showTextFallbackDialog(onTranscript) {
  // In-app styled dialog for typing voice instructions when Speech API is unavailable
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:700;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:#2a2a2a;border:1px solid #e07b00;border-radius:8px;padding:20px;min-width:380px;max-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
  dialog.innerHTML = `
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#e07b00;margin-bottom:8px;">Voice Instruction</div>
    <div style="font-size:12px;color:#aaa;margin-bottom:12px;">Speech recognition requires <b>Chrome</b> or <b>Edge</b>. Type your instruction below instead:</div>
    <textarea id="voice-fallback-input" rows="3" style="width:100%;background:#1e1e1e;border:1px solid #3a3a3a;border-radius:4px;color:#e0e0e0;font-family:inherit;font-size:13px;padding:8px;resize:vertical;outline:none;" placeholder="Type your instruction here..."></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
      <button id="voice-fallback-cancel" style="padding:6px 16px;border-radius:4px;border:1px solid #3a3a3a;background:transparent;color:#e0e0e0;cursor:pointer;font-size:12px;">Cancel</button>
      <button id="voice-fallback-save" style="padding:6px 16px;border-radius:4px;border:1px solid #e07b00;background:#e07b00;color:#fff;cursor:pointer;font-size:12px;font-weight:600;">Save</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const input = dialog.querySelector('#voice-fallback-input');
  input.focus();

  const cleanup = () => overlay.remove();

  dialog.querySelector('#voice-fallback-save').addEventListener('click', () => {
    const text = input.value.trim();
    cleanup();
    if (text) onTranscript(text);
  });

  dialog.querySelector('#voice-fallback-cancel').addEventListener('click', cleanup);

  // Enter to save, Escape to cancel
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      cleanup();
      if (text) onTranscript(text);
    } else if (e.key === 'Escape') {
      cleanup();
    }
  });

  // Click outside dialog to cancel
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });
}

export function activateVoiceRecording(assetName, slotIndex, onTranscript) {
  const SpeechRecognition = getSpeechRecognition();

  if (!SpeechRecognition) {
    showTextFallbackDialog(onTranscript);
    return;
  }

  if (isRecording) {
    stopRecording();
    return;
  }

  isRecording = true;
  voiceCallback = onTranscript;
  finalTranscript = '';
  interimTranscript = '';

  // Create speech recognition instance
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  // Show UI elements
  showRecordingIndicator();
  showLiveTranscript();

  // Event handlers
  recognition.onresult = (event) => {
    interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript + ' ';
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    updateLiveTranscript(finalTranscript + interimTranscript);
  };

  recognition.onerror = (event) => {
    console.error('[VoiceInstruction] Recognition error:', event.error);

    if (event.error === 'not-allowed') {
      alert('Microphone access denied. Please allow microphone access and try again.');
      cleanupRecording();
    }
    // For 'no-speech', 'network', 'aborted' etc — let onend handle restart
  };

  recognition.onend = () => {
    if (isRecording) {
      // Chrome auto-ends sessions frequently — restart to keep listening
      try {
        recognition.start();
        console.log('[VoiceInstruction] Recognition restarted after auto-end');
      } catch (e) {
        console.warn('[VoiceInstruction] Could not restart recognition:', e);
        stopRecording();
      }
    }
  };

  // Start recognition
  try {
    recognition.start();
    console.log('[VoiceInstruction] Recording started');

    const statusEl = document.getElementById('status-message');
    if (statusEl) statusEl.textContent = 'Recording voice instruction... (click \ud83d\udd0a again to stop)';
  } catch (err) {
    console.error('[VoiceInstruction] Failed to start recognition:', err);
    cleanupRecording();
  }
}

function stopRecording() {
  if (!isRecording) return;

  // Set flag first so onend handler won't restart
  isRecording = false;

  if (recognition) {
    // Detach onend so it doesn't fire restart after we stop
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    try {
      recognition.stop();
    } catch (e) {
      // may already be stopped
    }
    recognition = null;
  }

  hideRecordingIndicator();
  hideLiveTranscript();

  // Use final transcript, but fall back to interim if final is empty
  let transcript = finalTranscript.trim();
  if (!transcript && interimTranscript.trim()) {
    transcript = interimTranscript.trim();
  }

  if (transcript && voiceCallback) {
    voiceCallback(transcript);
    console.log('[VoiceInstruction] Transcript saved:', transcript.substring(0, 50) + '...');
  } else if (!transcript) {
    console.log('[VoiceInstruction] No speech detected, instruction not saved');
    const statusEl = document.getElementById('status-message');
    if (statusEl) statusEl.textContent = 'No speech detected';
  }

  voiceCallback = null;
  finalTranscript = '';
  interimTranscript = '';

  const statusEl = document.getElementById('status-message');
  if (statusEl) statusEl.textContent = 'Ready';
}

function cleanupRecording() {
  isRecording = false;
  recognition = null;
  voiceCallback = null;
  hideRecordingIndicator();
  hideLiveTranscript();

  const statusEl = document.getElementById('status-message');
  if (statusEl) statusEl.textContent = 'Ready';
}

// --- Recording Indicator UI ---

function showRecordingIndicator() {
  if (recordingIndicatorEl) recordingIndicatorEl.remove();

  recordingIndicatorEl = document.createElement('div');
  recordingIndicatorEl.className = 'voice-recording-indicator';
  recordingIndicatorEl.innerHTML = `
    <span class="voice-recording-dot"></span>
    <span>Recording... (click \ud83d\udd0a to stop)</span>
  `;
  recordingIndicatorEl.style.cssText = `
    position: fixed;
    top: 50px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    padding: 6px 16px;
    border-radius: 20px;
    z-index: 600;
    display: inline-flex;
  `;

  document.body.appendChild(recordingIndicatorEl);
}

function hideRecordingIndicator() {
  if (recordingIndicatorEl) {
    recordingIndicatorEl.remove();
    recordingIndicatorEl = null;
  }
}

// --- Live Transcript Display ---

function showLiveTranscript() {
  if (liveTranscriptEl) liveTranscriptEl.remove();

  liveTranscriptEl = document.createElement('div');
  liveTranscriptEl.className = 'voice-dialog';
  liveTranscriptEl.style.display = 'block';
  liveTranscriptEl.style.cssText += `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    min-width: 300px;
    max-width: 500px;
    z-index: 600;
    text-align: center;
  `;
  liveTranscriptEl.innerHTML = `
    <div class="voice-dialog-header">Live Transcription</div>
    <div class="voice-dialog-text" id="live-transcript-text">Listening...</div>
  `;

  document.body.appendChild(liveTranscriptEl);
}

function updateLiveTranscript(text) {
  const el = document.getElementById('live-transcript-text');
  if (el) {
    el.textContent = text || 'Listening...';
  }
}

function hideLiveTranscript() {
  if (liveTranscriptEl) {
    liveTranscriptEl.remove();
    liveTranscriptEl = null;
  }
}

export function isVoiceRecordingActive() {
  return isRecording;
}
