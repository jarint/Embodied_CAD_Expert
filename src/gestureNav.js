// gestureNav.js — WOZ Zoom Window prototype
// WOZ PROTOTYPE -- @PAULA
//
// Wires the existing "Select" toolbar button to a screen-region selection mode.
// After a region is finalized, pressing Z opens a floating zoom window showing
// a magnified live view of the selected viewport region.

import { getCurrentMode, onModeChange } from './cadUI.js';
import { getRenderer, registerAnimationCallback, disableOrbitControls, enableOrbitControls } from './scene.js';

let currentMode = 'expert';
let selectionActive = false;

// Drag state
let isDragging = false;
let dragStart = null;  // { x, y } in client coords
let dragEnd   = null;  // { x, y } in client coords

// Finalized selection rect in client coords: { x, y, w, h }
let finalRect = null;

// DOM elements
let selectionRectEl = null;
let zoomWindowEl    = null;
let zoomHeaderEl    = null;
let zoomCanvasEl    = null;
let zoomCtx         = null;

const MIN_DRAG_PX = 8;    // ignore accidental micro-drags
const ZOOM_MAX_PX = 360;  // max width or height of the zoom canvas

export function initGestureNav() {
  currentMode = getCurrentMode();

  createDOMElements();
  wireSelectButton();
  attachKeyListeners();

  // Each animation frame: if the zoom window is open, copy the viewport region
  registerAnimationCallback(updateZoomCanvas);

  onModeChange((mode) => {
    currentMode = mode;
    applyRoleStyles();
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

  // Zoom window
  zoomWindowEl = document.createElement('div');
  zoomWindowEl.id = 'zoom-window';

  zoomHeaderEl = document.createElement('div');
  zoomHeaderEl.id = 'zoom-window-header';
  zoomWindowEl.appendChild(zoomHeaderEl);

  zoomCanvasEl = document.createElement('canvas');
  zoomCanvasEl.id = 'zoom-window-canvas';
  zoomWindowEl.appendChild(zoomCanvasEl);

  zoomCtx = zoomCanvasEl.getContext('2d');

  document.body.appendChild(zoomWindowEl);

  applyRoleStyles();
}

function applyRoleStyles() {
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

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------

function wireSelectButton() {
  // cadUI.js creates #tool-select dynamically. Add our toggle on top of its
  // own handler (which manages the .active visual state).
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
  if (e.button !== 0) return;  // left button only
  isDragging = true;
  dragStart  = { x: e.clientX, y: e.clientY };
  dragEnd    = { x: e.clientX, y: e.clientY };
  applyRoleStyles();  // keep rect color in sync with current mode
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
    // Ignore tiny accidental drag — cancel silently
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

  // Exit selection mode but keep the rect visible as confirmation
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
      if (finalRect) openZoomWindow();
    }
    if (e.code === 'Escape') {
      if (selectionActive) exitSelectionMode();
      closeZoomWindow();
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
// Zoom window
// ---------------------------------------------------------------------------

function openZoomWindow() {
  applyRoleStyles();

  // Size the canvas to fit the selection's aspect ratio, capped at ZOOM_MAX_PX
  const aspect = finalRect.w / finalRect.h;
  let dstW, dstH;
  if (aspect >= 1) {
    dstW = ZOOM_MAX_PX;
    dstH = Math.round(ZOOM_MAX_PX / aspect);
  } else {
    dstH = ZOOM_MAX_PX;
    dstW = Math.round(ZOOM_MAX_PX * aspect);
  }

  zoomCanvasEl.width        = dstW;
  zoomCanvasEl.height       = dstH;
  zoomCanvasEl.style.width  = `${dstW}px`;
  zoomCanvasEl.style.height = `${dstH}px`;

  // Position zoom window: prefer right of selection, clamp to viewport edges
  const headerH = 32;
  let wx = finalRect.x + finalRect.w + 16;
  let wy = finalRect.y;
  if (wx + dstW + 8 > window.innerWidth)  wx = Math.max(8, finalRect.x - dstW - 16);
  if (wy + dstH + headerH + 8 > window.innerHeight) wy = Math.max(8, window.innerHeight - dstH - headerH - 16);

  zoomWindowEl.style.left    = `${wx}px`;
  zoomWindowEl.style.top     = `${wy}px`;
  zoomWindowEl.style.display = 'block';

  drawZoomFrame(); // draw immediately so there's no blank frame on open
}

function closeZoomWindow() {
  if (zoomWindowEl)    zoomWindowEl.style.display    = 'none';
  if (selectionRectEl) selectionRectEl.style.display = 'none';
  finalRect = null;
}

// Called each animation frame — redraws if the zoom window is open
function updateZoomCanvas() {
  if (!zoomWindowEl || zoomWindowEl.style.display === 'none') return;
  drawZoomFrame();
}

function drawZoomFrame() {
  if (!finalRect || !zoomCtx) return;

  const renderer = getRenderer();
  if (!renderer) return;

  // #viewport-container bounding rect: maps client coords to canvas coords
  const viewportEl   = document.getElementById('viewport-container');
  const vpRect       = viewportEl
    ? viewportEl.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

  const canvas = renderer.domElement;

  // Scale from CSS pixels to actual renderer canvas pixels (accounts for DPR)
  const scaleX = canvas.width  / vpRect.width;
  const scaleY = canvas.height / vpRect.height;

  const sx = (finalRect.x - vpRect.left) * scaleX;
  const sy = (finalRect.y - vpRect.top)  * scaleY;
  const sw = finalRect.w * scaleX;
  const sh = finalRect.h * scaleY;

  // Clamp source rect to canvas bounds
  const clampedSx = Math.max(0, sx);
  const clampedSy = Math.max(0, sy);
  const clampedSw = Math.min(sw, canvas.width  - clampedSx);
  const clampedSh = Math.min(sh, canvas.height - clampedSy);

  if (clampedSw <= 0 || clampedSh <= 0) return;

  try {
    zoomCtx.clearRect(0, 0, zoomCanvasEl.width, zoomCanvasEl.height);
    zoomCtx.drawImage(
      canvas,
      clampedSx, clampedSy, clampedSw, clampedSh,
      0, 0, zoomCanvasEl.width, zoomCanvasEl.height
    );
  } catch (_) {
    // drawImage may fail if the WebGL buffer was already cleared
    // (preserveDrawingBuffer:false). Degrade silently — WOZ prototype
    // is still functional; user just won't see live canvas content.
  }
}
