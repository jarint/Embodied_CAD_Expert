// gazeSharing.js — Spacebar-triggered dual-cursor gaze sharing
// WOZ Prototype -- @KARAN
//
// Uses current pointer position as a gaze proxy (no real eye tracking).
// Normalized coordinates (0..1) are synced so cursors scale to any viewport.

import { getCurrentMode, onModeChange } from './cadUI.js';
import { broadcastState } from './syncClient.js';

let pointerX = 0;
let pointerY = 0;

let gazeActive = false;
let currentMode = 'expert';

let localCursorEl = null;
let remoteCursorEl = null;
let hintEl = null;

// Throttle pointer-move broadcasts to ~60fps
let lastBroadcastTime = 0;
const BROADCAST_INTERVAL_MS = 16;

export function initGazeSharing() {
  currentMode = getCurrentMode();

  createDOMElements();
  attachEventListeners();

  onModeChange((mode) => {
    currentMode = mode;
    // Update cursor labels/colors when role changes mid-session
    updateLocalCursorStyle();
    updateRemoteCursorStyle();
  });

  console.log('[Gaze] Initialized');
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

function createDOMElements() {
  localCursorEl = document.createElement('div');
  localCursorEl.className = 'gaze-cursor';
  localCursorEl.innerHTML = '<span class="gaze-cursor-label"></span>';
  document.body.appendChild(localCursorEl);

  remoteCursorEl = document.createElement('div');
  remoteCursorEl.className = 'gaze-cursor';
  remoteCursorEl.innerHTML = '<span class="gaze-cursor-label"></span>';
  document.body.appendChild(remoteCursorEl);

  // Use existing #gaze-hint if the HTML already has it, otherwise create it
  hintEl = document.getElementById('gaze-hint');
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.id = 'gaze-hint';
    document.body.appendChild(hintEl);
  }
  hintEl.textContent = 'Hold Space to share gaze';
  hintEl.style.display = 'block'; // show hint persistently

  updateLocalCursorStyle();
  updateRemoteCursorStyle();
}

function updateLocalCursorStyle() {
  if (!localCursorEl) return;
  localCursorEl.classList.remove('expert', 'novice');
  localCursorEl.classList.add(currentMode);
  const label = localCursorEl.querySelector('.gaze-cursor-label');
  if (label) label.textContent = currentMode === 'expert' ? 'Expert' : 'Novice';
}

function updateRemoteCursorStyle() {
  if (!remoteCursorEl) return;
  const remoteRole = currentMode === 'expert' ? 'novice' : 'expert';
  remoteCursorEl.classList.remove('expert', 'novice');
  remoteCursorEl.classList.add(remoteRole);
  const label = remoteCursorEl.querySelector('.gaze-cursor-label');
  if (label) label.textContent = remoteRole === 'expert' ? 'Expert' : 'Novice';
}

// ---------------------------------------------------------------------------
// Input listeners
// ---------------------------------------------------------------------------

function attachEventListeners() {
  window.addEventListener('mousemove', (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    if (gazeActive) {
      positionCursor(localCursorEl, pointerX, pointerY);
      throttledBroadcast();
    }
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      pointerX = e.touches[0].clientX;
      pointerY = e.touches[0].clientY;
      if (gazeActive) {
        positionCursor(localCursorEl, pointerX, pointerY);
        throttledBroadcast();
      }
    }
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    if (e.repeat) return;
    if (isTypingTarget(document.activeElement)) return;
    e.preventDefault();
    if (!gazeActive) activateGaze();
  });

  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    if (gazeActive) deactivateGaze();
  });

  // Auto-deactivate if window loses focus (e.g. alt-tab)
  window.addEventListener('blur', () => {
    if (gazeActive) deactivateGaze();
  });
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Activate / deactivate
// ---------------------------------------------------------------------------

function activateGaze() {
  gazeActive = true;
  updateLocalCursorStyle();
  positionCursor(localCursorEl, pointerX, pointerY);
  localCursorEl.style.display = 'block';
  hintEl.textContent = 'Sharing gaze — release Space to stop';
  broadcastGazeState(true, pointerX / window.innerWidth, pointerY / window.innerHeight);
}

function deactivateGaze() {
  gazeActive = false;
  localCursorEl.style.display = 'none';
  hintEl.textContent = 'Hold Space to share gaze';
  broadcastGazeState(false, 0, 0);
}

// ---------------------------------------------------------------------------
// Cursor positioning
// ---------------------------------------------------------------------------

function positionCursor(el, x, y) {
  el.style.left = `${x - 8}px`; // 16px cursor, offset by half
  el.style.top = `${y - 8}px`;
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

function throttledBroadcast() {
  const now = performance.now();
  if (now - lastBroadcastTime < BROADCAST_INTERVAL_MS) return;
  lastBroadcastTime = now;
  broadcastGazeState(true, pointerX / window.innerWidth, pointerY / window.innerHeight);
}

function broadcastGazeState(active, normX, normY) {
  // Only broadcast this role's state; the remote side reads the opposite key.
  const payload = { gaze: {} };
  payload.gaze[currentMode] = { active, x: normX, y: normY };
  broadcastState(payload);
}

// ---------------------------------------------------------------------------
// Receive remote state (called by main.js onRemoteState fan-out)
// ---------------------------------------------------------------------------

export function applyRemoteGazeState(remoteStore) {
  if (!remoteStore.gaze) return;

  const gaze = remoteStore.gaze;
  // This client's "remote" is the opposite role
  const remoteRole = currentMode === 'expert' ? 'novice' : 'expert';
  const remoteGaze = gaze[remoteRole];
  if (!remoteGaze) return;

  if (remoteGaze.active) {
    updateRemoteCursorStyle(); // keeps label/color in sync with any mode change
    positionCursor(remoteCursorEl, remoteGaze.x * window.innerWidth, remoteGaze.y * window.innerHeight);
    remoteCursorEl.style.display = 'block';
  } else {
    remoteCursorEl.style.display = 'none';
  }
}
