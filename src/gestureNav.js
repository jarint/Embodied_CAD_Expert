// gestureNav.js — WOZ Zoom Window prototype
// WOZ PROTOTYPE -- @PAULA
//
// Wires the existing "Select" toolbar button to a screen-region selection mode.
// After a region is finalized, pressing Z opens a floating zoom window showing
// a magnified live view of the selected viewport region.
// The zoom window state is synced to the other tab via broadcastState.

import { getCurrentMode, onModeChange } from './cadUI.js';
import { getRenderer, registerAnimationCallback, disableOrbitControls, enableOrbitControls } from './scene.js';
import { broadcastState } from './syncClient.js';

let currentMode = 'expert';
let selectionActive = false;

// Drag state
let isDragging = false;
let dragStart = null;  // { x, y } in client coords
let dragEnd   = null;  // { x, y } in client coords

// Finalized local selection rect in client coords: { x, y, w, h }
let finalRect = null;

// Remote zoom rect in local client coords (denormalized from broadcast)
let remoteRect = null;

// Local zoom window DOM
let selectionRectEl   = null;
let zoomWindowEl      = null;
let zoomHeaderEl      = null;
let zoomCanvasEl      = null;
let zoomCtx           = null;

// Remote zoom window DOM (shows the other user's selected region)
let remoteZoomWindowEl  = null;
let remoteZoomHeaderEl  = null;
let remoteZoomCanvasEl  = null;
let remoteZoomCtx       = null;

const MIN_DRAG_PX = 8;    // ignore accidental micro-drags
const ZOOM_MAX_PX = 360;  // max width or height of the zoom canvas

export function initGestureNav() {
  currentMode = getCurrentMode();

  createDOMElements();
  wireSelectButton();
  attachKeyListeners();

  // Reads canvas pixels AFTER renderer.render() — see scene.js animation loop
  registerAnimationCallback(updateZoomCanvases);

  onModeChange((mode) => {
    currentMode = mode;
    applyLocalRoleStyles();
    // Remote window role is always the opposite; update label if visible
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
  // Drag selection rectangle overlay
  selectionRectEl = document.createElement('div');
  selectionRectEl.id = 'selection-rect';
  document.body.appendChild(selectionRectEl);

  // Local zoom window
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

  // Remote zoom window (shown when the other tab opens a zoom)
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
  const roleLabel = currentMode === 'expert' ? 'Expert' : 'Novice';
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
      `<span>${roleLabel} — Zoom Window</span><span class="zoom-esc-hint">Esc to close</span>`;
  }
}

function applyRemoteRoleStyles(role) {
  const roleLabel = role === 'expert' ? 'Expert' : 'Novice';
  if (remoteZoomWindowEl) {
    remoteZoomWindowEl.classList.remove('expert', 'novice');
    remoteZoomWindowEl.classList.add(role);
  }
  if (remoteZoomHeaderEl) {
    remoteZoomHeaderEl.innerHTML =
      `<span>${roleLabel} — Zoom Window</span><span class="zoom-esc-hint">Remote</span>`;
  }
}

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

function wireSelectButton() {
  const btn = document.getElementById('tool-select');
  if (btn) {
    btn.addEventListener('click', () => {
      if (selectionActive) {
        exitSelectionMode();
      } else {
        enterSelectionMode();
      }
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
  // Keep the selection rect visible as confirmation
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
  drawFrame(zoomCtx, zoomCanvasEl, finalRect);
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
// Remote zoom window (receives the other tab's zoom state)
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
  if (wx + dstW + 8 > window.innerWidth)         wx = Math.max(8, rect.x - dstW - 16);
  if (wy + dstH + headerH + 8 > window.innerHeight) wy = Math.max(8, window.innerHeight - dstH - headerH - 16);

  windowEl.style.left = `${wx}px`;
  windowEl.style.top  = `${wy}px`;
}

// Copy the renderer canvas region defined by `rect` (client coords) into `ctx`
function drawFrame(ctx, canvasEl, rect) {
  if (!rect || !ctx) return;

  const renderer = getRenderer();
  if (!renderer) return;

  const vpEl   = document.getElementById('viewport-container');
  const vpRect = vpEl
    ? vpEl.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

  const canvas = renderer.domElement;

  // Map client coords → renderer canvas pixel coords (accounts for DPR)
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
  } catch (_) {
    // Silently degrade if WebGL buffer isn't readable
  }
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
// Sync — broadcast local zoom state, receive remote zoom state
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
      // Normalize relative to viewport so coords map correctly on any screen size
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

  // The remote role is the opposite of local
  const remoteRole = currentMode === 'expert' ? 'novice' : 'expert';
  const zoomData   = remoteStore.zoom[remoteRole];
  if (!zoomData) return;

  if (zoomData.active) {
    const vp = getViewportRect();
    // Denormalize back to local client coords
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
