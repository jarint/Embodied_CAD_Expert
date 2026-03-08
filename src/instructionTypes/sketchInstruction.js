// sketchInstruction.js — Full-screen sketch overlay

import { disableOrbitControls, enableOrbitControls } from '../scene.js';

let isSketchActive = false;
let sketchCallback = null;
let overlayEl = null;
let canvasEl = null;
let ctx = null;
let toolbarEl = null;
let isDrawing = false;
let strokeColor = '#e07b00';
let strokeWidth = 3;
let paths = [];
let currentPath = [];

export function activateSketchMode(assetName, slotIndex, onSave) {
  if (isSketchActive) return;

  isSketchActive = true;
  sketchCallback = onSave;

  // Disable orbit controls so mouse drag doesn't orbit
  disableOrbitControls();

  // Create the overlay
  createSketchOverlay();

  // Update status
  const statusEl = document.getElementById('status-message');
  if (statusEl) statusEl.textContent = 'Sketch Mode \u2014 Draw on screen, then Confirm or Cancel';

  console.log('[SketchInstruction] Sketch mode activated');
}

function createSketchOverlay() {
  // Create the overlay container
  overlayEl = document.createElement('div');
  overlayEl.id = 'sketch-overlay';
  overlayEl.style.display = 'block';

  // Create the drawing canvas
  canvasEl = document.createElement('canvas');
  canvasEl.id = 'sketch-canvas';
  canvasEl.width = window.innerWidth;
  canvasEl.height = window.innerHeight;
  overlayEl.appendChild(canvasEl);

  ctx = canvasEl.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Pointer event listeners
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointerleave', onPointerUp);

  // Prevent default touch behaviour
  canvasEl.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  canvasEl.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // Create the floating toolbar
  toolbarEl = document.createElement('div');
  toolbarEl.id = 'sketch-toolbar';
  toolbarEl.innerHTML = `
    <input type="color" class="sketch-color-picker" value="${strokeColor}" title="Stroke colour">
    <div class="sketch-stroke-selector">
      <span>Width:</span>
      <input type="range" min="1" max="12" value="${strokeWidth}" class="sketch-stroke-range">
    </div>
    <button class="sketch-toolbar-btn" data-action="undo" title="Undo last stroke">Undo</button>
    <button class="sketch-toolbar-btn" data-action="clear" title="Clear all strokes">Clear</button>
    <button class="sketch-toolbar-btn cancel" data-action="cancel">Cancel</button>
    <button class="sketch-toolbar-btn confirm" data-action="confirm">\u2713 Confirm</button>
  `;

  toolbarEl.querySelector('.sketch-color-picker').addEventListener('input', (e) => {
    strokeColor = e.target.value;
  });

  toolbarEl.querySelector('.sketch-stroke-range').addEventListener('input', (e) => {
    strokeWidth = parseInt(e.target.value, 10);
  });

  toolbarEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    switch (btn.dataset.action) {
      case 'confirm':
        confirmSketch();
        break;
      case 'cancel':
        cancelSketch();
        break;
      case 'undo':
        undoLastStroke();
        break;
      case 'clear':
        clearAllStrokes();
        break;
    }
  });

  // Listen for Escape to cancel
  document.addEventListener('keydown', onSketchKeydown);

  // Append to body so it covers everything
  document.body.appendChild(overlayEl);
  document.body.appendChild(toolbarEl);
}

// --- Drawing Logic ---

function getCanvasCoords(e) {
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvasEl.width / rect.width),
    y: (e.clientY - rect.top) * (canvasEl.height / rect.height)
  };
}

function onPointerDown(e) {
  isDrawing = true;
  const { x, y } = getCanvasCoords(e);
  currentPath = [{
    x, y,
    color: strokeColor,
    width: strokeWidth
  }];

  ctx.beginPath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.moveTo(x, y);
}

function onPointerMove(e) {
  if (!isDrawing) return;

  const { x, y } = getCanvasCoords(e);
  const point = { x, y, color: strokeColor, width: strokeWidth };
  currentPath.push(point);

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function onPointerUp(e) {
  if (!isDrawing) return;
  isDrawing = false;

  if (currentPath.length > 1) {
    paths.push([...currentPath]);
  }
  currentPath = [];
  ctx.beginPath();
}

// --- Undo / Clear ---

function undoLastStroke() {
  if (paths.length === 0) return;
  paths.pop();
  redrawAllPaths();
}

function clearAllStrokes() {
  paths = [];
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
}

function redrawAllPaths() {
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  for (const path of paths) {
    if (path.length < 2) continue;

    ctx.beginPath();
    ctx.strokeStyle = path[0].color;
    ctx.lineWidth = path[0].width;
    ctx.moveTo(path[0].x, path[0].y);

    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
  }
}

// --- Confirm / Cancel ---

function confirmSketch() {
  const imageDataURL = canvasEl.toDataURL('image/png');

  destroySketchOverlay();

  if (sketchCallback) {
    sketchCallback(imageDataURL);
    sketchCallback = null;
  }

  console.log('[SketchInstruction] Sketch confirmed and saved');
}

function cancelSketch() {
  destroySketchOverlay();
  console.log('[SketchInstruction] Sketch cancelled');
}

function destroySketchOverlay() {
  isSketchActive = false;
  paths = [];
  currentPath = [];

  if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  if (toolbarEl) { toolbarEl.remove(); toolbarEl = null; }

  document.removeEventListener('keydown', onSketchKeydown);

  enableOrbitControls();

  const statusEl = document.getElementById('status-message');
  if (statusEl) statusEl.textContent = 'Ready';
}

function onSketchKeydown(event) {
  if (event.key === 'Escape') {
    cancelSketch();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
    event.preventDefault();
    undoLastStroke();
  }
}

// Desktop testing override: Ctrl+Shift+T enables sketch on non-touch devices
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'T') {
    const disabledBtns = document.querySelectorAll('.instruction-type-btn.disabled[data-action="capture-sketch"]');
    disabledBtns.forEach(btn => {
      btn.classList.remove('disabled');
      btn.title = 'Add sketch annotation (touch override enabled)';
    });
    console.log('[SketchInstruction] Desktop touch override enabled');

    const statusEl = document.getElementById('status-message');
    if (statusEl) statusEl.textContent = 'Sketch enabled (desktop override)';
  }
});

export function isSketchModeActive() {
  return isSketchActive;
}
