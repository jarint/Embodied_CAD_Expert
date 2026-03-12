// gestureNav.js — WOZ Zoom Window prototype
// WOZ PROTOTYPE -- @PAULA
//
// Wires the existing "Select" toolbar button to a screen-region selection mode.
// After a region is finalized, pressing Z opens a floating zoom window showing
// a magnified live view of the selected viewport region.
// The zoom window state is synced to the other tab via broadcastState.
//
// Zoom content strategy (in priority order):
//   1. Screen Capture API (getDisplayMedia) — captures ALL visible DOM content
//      including toolbar buttons, sidebar, etc. Requires one-time user permission.
//   2. renderer.domElement — fallback when screen capture is unavailable or denied.
//      Only captures the Three.js 3D viewport area.

import { getCurrentMode, onModeChange } from './cadUI.js';
import { getRenderer, registerAnimationCallback, disableOrbitControls, enableOrbitControls } from './scene.js';
import { broadcastState } from './syncClient.js';

let currentMode = 'expert';
let selectionActive = false;

// Drag state
let isDragging = false;
let dragStart = null;
let dragEnd   = null;

// Finalized local selection rect in client coords: { x, y, w, h }
let finalRect = null;

// Remote zoom rect in local client coords (denormalized from broadcast)
let remoteRect = null;

// Local zoom window DOM
let selectionRectEl  = null;
let zoomWindowEl     = null;
let zoomHeaderEl     = null;
let zoomCanvasEl     = null;
let zoomCtx          = null;

// Remote zoom window DOM
let remoteZoomWindowEl  = null;
let remoteZoomHeaderEl  = null;
let remoteZoomCanvasEl  = null;
let remoteZoomCtx       = null;

// Screen Capture API state
let screenVideoEl       = null;
let screenCaptureActive = false;
let screenCapturePromise = null;  // prevents concurrent requests

const MIN_DRAG_PX = 8;
const ZOOM_MAX_PX = 360;

export function initGestureNav() {
  currentMode = getCurrentMode();

  createDOMElements();
  wireSelectButton();
  attachKeyListeners();

  // Runs AFTER renderer.render() each frame (see scene.js animation loop)
  registerAnimationCallback(updateZoomCanvases);

  onModeChange((mode) => {
    currentMode = mode;
    applyLocalRoleStyles();
    if (remoteZoomWindowEl && remoteZoomWindowEl.style.display !== 'none') {
      applyRemoteRoleStyles(currentMode === 'expert' ? 'novice' : 'expert');
    }
  });

  console.log('[GestureNav] WOZ zoom window initialized');
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

function createDOMElements() {
  selectionRectEl = document.createElement('div');
  selectionRectEl.id = 'selection-rect';
  document.body.appendChild(selectionRectEl);

  zoomWindowEl = document.createElement('div');
  zoomWindowEl.id = 'zoom-window';
  zoomHeaderEl = document.createElement('div');
  zoomHeaderEl.className = 'zoom-header';
  zoomWindowEl.appendChild(zoomHeaderEl);
  zoomCanvasEl = document.createElement('canvas');
  zoomCanvasEl.className = 'zoom-canvas';
  zoomWindowEl.appendChild(zoomCanvasEl);
  zoomCtx = zoomCanvasEl.getContext('2d');
  document.body.appendChild(zoomWindowEl);

  remoteZoomWindowEl = document.createElement('div');
  remoteZoomWindowEl.id = 'remote-zoom-window';
  remoteZoomHeaderEl = document.createElement('div');
  remoteZoomHeaderEl.className = 'zoom-header';
  remoteZoomWindowEl.appendChild(remoteZoomHeaderEl);
  remoteZoomCanvasEl = document.createElement('canvas');
  remoteZoomCanvasEl.className = 'zoom-canvas';
  remoteZoomWindowEl.appendChild(remoteZoomCanvasEl);
  remoteZoomCtx = remoteZoomCanvasEl.getContext('2d');
  document.body.appendChild(remoteZoomWindowEl);

  applyLocalRoleStyles();
}

function applyLocalRoleStyles() {
  const label = currentMode === 'expert' ? 'Expert' : 'Novice';
  if (selectionRectEl) {
    selectionRectEl.classList.remove('expert', 'novice');
    selectionRectEl.classList.add(currentMode);
  }
  if (zoomWindowEl) {
    zoomWindowEl.classList.remove('expert', 'novice');
    zoomWindowEl.classList.add(currentMode);
  }
  if (zoomHeaderEl) {
    zoomHeaderEl.innerHTML =
      `<span>${label} — Zoom Window</span><span class="zoom-esc-hint">Esc to close</span>`;
  }
}

function applyRemoteRoleStyles(role) {
  const label = role === 'expert' ? 'Expert' : 'Novice';
  if (remoteZoomWindowEl) {
    remoteZoomWindowEl.classList.remove('expert', 'novice');
    remoteZoomWindowEl.classList.add(role);
  }
  if (remoteZoomHeaderEl) {
    remoteZoomHeaderEl.innerHTML =
      `<span>${label} — Zoom Window</span><span class="zoom-esc-hint">Remote</span>`;
  }
}

// ---------------------------------------------------------------------------
// Screen Capture API
// ---------------------------------------------------------------------------

// Request full-tab screen capture. Returns true on success, false on failure/denial.
// Safe to call multiple times — only one request is ever in flight.
async function requestScreenCapture() {
  if (screenCaptureActive) return true;
  if (screenCapturePromise) return screenCapturePromise;

  screenCapturePromise = (async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        preferCurrentTab: true,  // Chrome hint: pre-select the current tab
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;

      await new Promise((resolve) => { video.onloadedmetadata = resolve; });
      await video.play();

      // Clean up when the user clicks "Stop sharing" in the browser chrome
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        screenVideoEl      = null;
        screenCaptureActive = false;
        screenCapturePromise = null;
        console.log('[GestureNav] Screen capture ended by user');
      });

      screenVideoEl       = video;
      screenCaptureActive = true;
      console.log('[GestureNav] Screen capture ready —', video.videoWidth, 'x', video.videoHeight);
      return true;
    } catch (e) {
      // User denied or API unavailable — fall back to renderer-only
      console.warn('[GestureNav] Screen capture unavailable:', e.message);
      screenCapturePromise = null;
      return false;
    }
  })();

  return screenCapturePromise;
}

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

function wireSelectButton() {
  const btn = document.getElementById('tool-select');
  if (btn) {
    btn.addEventListener('click', () => {
      if (selectionActive) exitSelectionMode();
      else                 enterSelectionMode();
    });
  }
}

function enterSelectionMode() {
  selectionActive = true;
  disableOrbitControls();
  document.body.style.cursor = 'crosshair';
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);
  console.log('[GestureNav] Selection mode on');
}

function exitSelectionMode() {
  selectionActive = false;
  isDragging = false;
  dragStart  = null;
  dragEnd    = null;
  enableOrbitControls();
  document.body.style.cursor = '';
  if (selectionRectEl) selectionRectEl.style.display = 'none';
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup',   onMouseUp);
  console.log('[GestureNav] Selection mode off');
}

// ---------------------------------------------------------------------------
// Mouse drag handlers
// ---------------------------------------------------------------------------

function onMouseDown(e) {
  if (e.button !== 0) return;
  isDragging = true;
  dragStart  = { x: e.clientX, y: e.clientY };
  dragEnd    = { x: e.clientX, y: e.clientY };
  applyLocalRoleStyles();
  selectionRectEl.style.display = 'block';
  updateSelectionRect();
}

function onMouseMove(e) {
  if (!isDragging) return;
  dragEnd = { x: e.clientX, y: e.clientY };
  updateSelectionRect();
}

function onMouseUp(e) {
  if (!isDragging) return;
  isDragging = false;
  dragEnd = { x: e.clientX, y: e.clientY };

  const w = Math.abs(dragEnd.x - dragStart.x);
  const h = Math.abs(dragEnd.y - dragStart.y);

  if (w < MIN_DRAG_PX || h < MIN_DRAG_PX) {
    selectionRectEl.style.display = 'none';
    dragStart = null;
    dragEnd   = null;
    return;
  }

  finalRect = {
    x: Math.min(dragStart.x, dragEnd.x),
    y: Math.min(dragStart.y, dragEnd.y),
    w,
    h,
  };

  exitSelectionMode();
  selectionRectEl.style.display = 'block';
  setElRect(selectionRectEl, finalRect.x, finalRect.y, finalRect.w, finalRect.h);
  console.log('[GestureNav] Region finalized:', finalRect);
}

function updateSelectionRect() {
  const x = Math.min(dragStart.x, dragEnd.x);
  const y = Math.min(dragStart.y, dragEnd.y);
  const w = Math.abs(dragEnd.x - dragStart.x);
  const h = Math.abs(dragEnd.y - dragStart.y);
  setElRect(selectionRectEl, x, y, w, h);
}

function setElRect(el, x, y, w, h) {
  el.style.left   = `${x}px`;
  el.style.top    = `${y}px`;
  el.style.width  = `${w}px`;
  el.style.height = `${h}px`;
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

function attachKeyListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyZ' && !isTypingTarget(document.activeElement)) {
      e.preventDefault();
      if (finalRect) openLocalZoomWindow();
    }
    if (e.code === 'Escape') {
      if (selectionActive) exitSelectionMode();
      closeLocalZoomWindow();
    }
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
// Local zoom window
// ---------------------------------------------------------------------------

function openLocalZoomWindow() {
  applyLocalRoleStyles();
  sizeAndPositionZoomWindow(zoomWindowEl, zoomCanvasEl, finalRect);
  zoomWindowEl.style.display = 'block';

  // Draw immediately with whatever source is ready (renderer fallback first)
  drawFrame(zoomCtx, zoomCanvasEl, finalRect);

  // Request screen capture (async). On success, subsequent drawFrame calls
  // automatically upgrade to the richer screen capture source.
  if (!screenCaptureActive) {
    requestScreenCapture(); // fire and forget — updateZoomCanvases picks it up
  }

  broadcastZoomState(true);
}

function closeLocalZoomWindow() {
  if (zoomWindowEl)    zoomWindowEl.style.display    = 'none';
  if (selectionRectEl) selectionRectEl.style.display = 'none';
  if (finalRect) {
    finalRect = null;
    broadcastZoomState(false);
  }
}

// ---------------------------------------------------------------------------
// Remote zoom window
// ---------------------------------------------------------------------------

function openRemoteZoomWindow(role) {
  if (!remoteRect) return;
  applyRemoteRoleStyles(role);
  sizeAndPositionZoomWindow(remoteZoomWindowEl, remoteZoomCanvasEl, remoteRect);
  remoteZoomWindowEl.style.display = 'block';
  drawFrame(remoteZoomCtx, remoteZoomCanvasEl, remoteRect);
}

function closeRemoteZoomWindow() {
  if (remoteZoomWindowEl) remoteZoomWindowEl.style.display = 'none';
  remoteRect = null;
}

// ---------------------------------------------------------------------------
// Shared zoom window helpers
// ---------------------------------------------------------------------------

function sizeAndPositionZoomWindow(windowEl, canvasEl, rect) {
  const aspect = rect.w / rect.h;
  let dstW, dstH;
  if (aspect >= 1) {
    dstW = ZOOM_MAX_PX;
    dstH = Math.round(ZOOM_MAX_PX / aspect);
  } else {
    dstH = ZOOM_MAX_PX;
    dstW = Math.round(ZOOM_MAX_PX * aspect);
  }

  canvasEl.width        = dstW;
  canvasEl.height       = dstH;
  canvasEl.style.width  = `${dstW}px`;
  canvasEl.style.height = `${dstH}px`;

  const headerH = 32;
  let wx = rect.x + rect.w + 16;
  let wy = rect.y;
  if (wx + dstW + 8 > window.innerWidth)              wx = Math.max(8, rect.x - dstW - 16);
  if (wy + dstH + headerH + 8 > window.innerHeight)   wy = Math.max(8, window.innerHeight - dstH - headerH - 16);

  windowEl.style.left = `${wx}px`;
  windowEl.style.top  = `${wy}px`;
}

// Draw the region defined by `rect` (client coords) into `ctx`.
// Prefers the screen capture video (captures ALL DOM content including toolbar).
// Falls back to the Three.js renderer canvas if screen capture is unavailable.
function drawFrame(ctx, canvasEl, rect) {
  if (!rect || !ctx) return;

  if (screenCaptureActive && screenVideoEl && screenVideoEl.readyState >= 2) {
    drawFrameFromVideo(ctx, canvasEl, rect);
  } else {
    drawFrameFromRenderer(ctx, canvasEl, rect);
  }
}

// Draw from the screen capture video stream.
// The video dimensions are in physical (DPR-scaled) pixels; client coords are
// in CSS pixels. Scale = videoWidth / window.innerWidth ≈ devicePixelRatio.
function drawFrameFromVideo(ctx, canvasEl, rect) {
  const vid  = screenVideoEl;
  const vidW = vid.videoWidth;
  const vidH = vid.videoHeight;
  if (vidW === 0 || vidH === 0) return;

  const scaleX = vidW / window.innerWidth;
  const scaleY = vidH / window.innerHeight;

  const sx = rect.x * scaleX;
  const sy = rect.y * scaleY;
  const sw = rect.w * scaleX;
  const sh = rect.h * scaleY;

  const csx = Math.max(0, sx);
  const csy = Math.max(0, sy);
  const csw = Math.min(sw, vidW - csx);
  const csh = Math.min(sh, vidH - csy);

  if (csw <= 0 || csh <= 0) return;

  try {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(vid, csx, csy, csw, csh, 0, 0, canvasEl.width, canvasEl.height);
  } catch (_) {}
}

// Draw from the Three.js renderer canvas.
// Only captures the 3D viewport area; DOM overlays are invisible here.
function drawFrameFromRenderer(ctx, canvasEl, rect) {
  const renderer = getRenderer();
  if (!renderer) return;

  const vpEl   = document.getElementById('viewport-container');
  const vpRect = vpEl
    ? vpEl.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

  const canvas = renderer.domElement;
  const scaleX = canvas.width  / vpRect.width;
  const scaleY = canvas.height / vpRect.height;

  const sx = (rect.x - vpRect.left) * scaleX;
  const sy = (rect.y - vpRect.top)  * scaleY;
  const sw = rect.w * scaleX;
  const sh = rect.h * scaleY;

  const csx = Math.max(0, sx);
  const csy = Math.max(0, sy);
  const csw = Math.min(sw, canvas.width  - csx);
  const csh = Math.min(sh, canvas.height - csy);

  if (csw <= 0 || csh <= 0) return;

  try {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.drawImage(canvas, csx, csy, csw, csh, 0, 0, canvasEl.width, canvasEl.height);
  } catch (_) {}
}

// Called each animation frame
function updateZoomCanvases() {
  if (zoomWindowEl && zoomWindowEl.style.display !== 'none') {
    drawFrame(zoomCtx, zoomCanvasEl, finalRect);
  }
  if (remoteZoomWindowEl && remoteZoomWindowEl.style.display !== 'none') {
    drawFrame(remoteZoomCtx, remoteZoomCanvasEl, remoteRect);
  }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

function getViewportRect() {
  const vpEl = document.getElementById('viewport-container');
  return vpEl
    ? vpEl.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function broadcastZoomState(active) {
  const payload = { zoom: {} };
  if (active && finalRect) {
    const vp = getViewportRect();
    payload.zoom[currentMode] = {
      active: true,
      x: (finalRect.x - vp.left) / vp.width,
      y: (finalRect.y - vp.top)  / vp.height,
      w: finalRect.w / vp.width,
      h: finalRect.h / vp.height,
    };
  } else {
    payload.zoom[currentMode] = { active: false, x: 0, y: 0, w: 0, h: 0 };
  }
  broadcastState(payload);
}

export function applyRemoteZoomState(remoteStore) {
  if (!remoteStore.zoom) return;

  const remoteRole = currentMode === 'expert' ? 'novice' : 'expert';
  const zoomData   = remoteStore.zoom[remoteRole];
  if (!zoomData) return;

  if (zoomData.active) {
    const vp = getViewportRect();
    remoteRect = {
      x: zoomData.x * vp.width  + vp.left,
      y: zoomData.y * vp.height + vp.top,
      w: zoomData.w * vp.width,
      h: zoomData.h * vp.height,
    };
    openRemoteZoomWindow(remoteRole);
  } else {
    closeRemoteZoomWindow();
  }
}
