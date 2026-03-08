// calloutSystem.js — Node-based instruction callout system
// Implements: asset selection, callout panel, instruction management, novice mode

import * as THREE from 'three';
import { getCamera, getRenderer, registerAnimationCallback, disableOrbitControls, enableOrbitControls } from './scene.js';
import { getLoadedModel, highlightModel, unhighlightModel } from './assetLoader.js';
import { getCurrentMode, onModeChange, highlightToolbarButton, clearToolbarHighlights, markComponentHasCallout } from './cadUI.js';
import { activateButtonCapture, deactivateButtonCapture } from './instructionTypes/buttonInstruction.js';
import { activateSketchMode } from './instructionTypes/sketchInstruction.js';
import { activateVoiceRecording } from './instructionTypes/voiceInstruction.js';
import { broadcastState } from './syncClient.js';

let scene, camera, renderer, model;
let selectedAsset = null;
let calloutStore = {};
let _isRemoteUpdate = false;
let calloutPanelEl = null;
let calloutTriggerEl = null;
let calloutIndicatorEl = null;
let connectorSVG = null;
let activeVoiceDialog = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- AR Anchoring Mode state ---
let isARAnchorMode = false;
let arAnchorTargetAssetName = null;
let arAnchorTargetSlotIndex = null;
let arAnchorBannerEl = null;
let arHoverHighlightMesh = null;

export function initCalloutSystem(sceneRef, cameraRef, rendererRef, modelRef) {
  scene = sceneRef;
  camera = cameraRef;
  renderer = rendererRef;
  model = modelRef;

  createTriggerElement();
  createIndicatorElement();
  createConnectorSVG();
  createARAnchorBanner();

  // Listen for clicks on the viewport to select/deselect the asset
  const viewport = document.getElementById('viewport-container');
  viewport.addEventListener('click', onViewportClick);
  viewport.addEventListener('pointermove', onViewportPointerMove);

  // Listen for mode changes
  onModeChange(handleModeChange);

  // Register per-frame update to keep screen-space elements positioned
  registerAnimationCallback(updateScreenPositions);

  console.log('[Callout] System initialized');
}

// --- Create DOM Elements ---

function createTriggerElement() {
  calloutTriggerEl = document.createElement('div');
  calloutTriggerEl.id = 'callout-trigger';
  calloutTriggerEl.textContent = '+';
  calloutTriggerEl.style.display = 'none';

  calloutTriggerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openCalloutPanel();
  });

  document.getElementById('viewport-container').appendChild(calloutTriggerEl);
}

function createIndicatorElement() {
  calloutIndicatorEl = document.createElement('div');
  calloutIndicatorEl.className = 'asset-callout-indicator';
  calloutIndicatorEl.textContent = '!';
  calloutIndicatorEl.style.display = 'none';

  calloutIndicatorEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openCalloutPanel();
  });

  document.getElementById('viewport-container').appendChild(calloutIndicatorEl);
}

function createConnectorSVG() {
  connectorSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connectorSVG.classList.add('callout-connector');
  connectorSVG.style.position = 'absolute';
  connectorSVG.style.top = '0';
  connectorSVG.style.left = '0';
  connectorSVG.style.width = '100%';
  connectorSVG.style.height = '100%';
  connectorSVG.style.pointerEvents = 'none';
  connectorSVG.style.zIndex = '199';
  connectorSVG.innerHTML = `<line id="connector-line" x1="0" y1="0" x2="0" y2="0" stroke="#e07b00" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.6"/>`;
  document.getElementById('viewport-container').appendChild(connectorSVG);
}

// --- Asset Selection via Raycasting ---

function onViewportClick(event) {
  if (isARAnchorMode) {
    handleARAnchorClick(event);
    return;
  }

  if (event.target.closest('.callout-panel') || event.target.closest('#callout-trigger') || event.target.closest('.asset-callout-indicator')) return;

  const viewport = document.getElementById('viewport-container');
  const rect = viewport.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, getCamera());

  const meshes = [];
  if (model) {
    model.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
  }

  const intersects = raycaster.intersectObjects(meshes, false);

  if (intersects.length > 0) {
    selectAsset(model);
  } else {
    deselectAsset();
  }
}

// --- Select / Deselect ---

function selectAsset(assetGroup) {
  if (selectedAsset === assetGroup) return;

  selectedAsset = assetGroup;
  highlightModel(assetGroup);

  const mode = getCurrentMode();
  const assetName = assetGroup.name;
  const hasCallout = calloutStore[assetName] && calloutStore[assetName].instructions.length > 0;

  if (mode === 'expert') {
    calloutTriggerEl.style.display = 'block';
    calloutIndicatorEl.style.display = 'none';
  } else {
    calloutTriggerEl.style.display = 'none';
    if (hasCallout) {
      calloutIndicatorEl.style.display = 'block';
    }
  }

  const treeItem = document.querySelector(`.component-tree-item[data-asset-ref="${assetName}"]`);
  if (treeItem) {
    document.querySelectorAll('.component-tree-item').forEach(i => i.classList.remove('selected'));
    treeItem.classList.add('selected');
  }

  updateStatusMessage(`Selected: ${assetGroup.userData.componentName || assetName}`);
}

function deselectAsset() {
  if (!selectedAsset) return;

  unhighlightModel(selectedAsset);
  selectedAsset = null;
  calloutTriggerEl.style.display = 'none';
  calloutIndicatorEl.style.display = 'none';

  closeCalloutPanel();
  clearToolbarHighlights();

  document.querySelectorAll('.component-tree-item').forEach(i => i.classList.remove('selected'));
  updateStatusMessage('Ready');
}

// --- Screen-Space Positioning ---

function getAssetScreenPosition() {
  if (!selectedAsset || !camera) return null;

  const viewport = document.getElementById('viewport-container');
  const rect = viewport.getBoundingClientRect();

  const box = new THREE.Box3().setFromObject(selectedAsset);
  const center = box.getCenter(new THREE.Vector3());

  const projected = center.clone().project(camera);

  const x = (projected.x * 0.5 + 0.5) * rect.width;
  const y = (-projected.y * 0.5 + 0.5) * rect.height;

  if (projected.z > 1) return null;

  return { x, y };
}

function updateScreenPositions() {
  const pos = getAssetScreenPosition();
  if (!pos) {
    if (calloutTriggerEl) calloutTriggerEl.style.display = 'none';
    if (calloutIndicatorEl) calloutIndicatorEl.style.display = 'none';
    return;
  }

  if (calloutTriggerEl && calloutTriggerEl.style.display !== 'none') {
    calloutTriggerEl.style.left = `${pos.x + 40}px`;
    calloutTriggerEl.style.top = `${pos.y - 40}px`;
  }

  if (calloutIndicatorEl && calloutIndicatorEl.style.display !== 'none') {
    calloutIndicatorEl.style.left = `${pos.x + 30}px`;
    calloutIndicatorEl.style.top = `${pos.y - 30}px`;
  }

  if (calloutPanelEl && calloutPanelEl.style.display !== 'none') {
    const panelRect = calloutPanelEl.getBoundingClientRect();
    const viewportRect = document.getElementById('viewport-container').getBoundingClientRect();
    const panelCenterX = panelRect.left - viewportRect.left + panelRect.width / 2;
    const panelCenterY = panelRect.top - viewportRect.top + panelRect.height / 2;

    const line = document.getElementById('connector-line');
    if (line) {
      line.setAttribute('x1', pos.x);
      line.setAttribute('y1', pos.y);
      line.setAttribute('x2', panelCenterX);
      line.setAttribute('y2', panelCenterY);
    }
  }
}

// --- Callout Panel ---

function openCalloutPanel() {
  if (!selectedAsset) return;

  const assetName = selectedAsset.name;

  if (!calloutStore[assetName]) {
    calloutStore[assetName] = { instructions: [], isOpen: false };
  }

  calloutStore[assetName].isOpen = true;

  calloutTriggerEl.style.display = 'none';
  calloutIndicatorEl.style.display = 'none';

  if (calloutPanelEl) calloutPanelEl.remove();

  calloutPanelEl = document.createElement('div');
  calloutPanelEl.className = 'callout-panel fade-in';

  renderCalloutPanel(assetName);

  const pos = getAssetScreenPosition();
  if (pos) {
    calloutPanelEl.style.left = `${pos.x + 80}px`;
    calloutPanelEl.style.top = `${Math.max(10, pos.y - 80)}px`;
  }

  document.getElementById('viewport-container').appendChild(calloutPanelEl);

  markComponentHasCallout(assetName, true);
}

function renderCalloutPanel(assetName) {
  const callout = calloutStore[assetName];
  const isExpert = getCurrentMode() === 'expert';
  const isNovice = getCurrentMode() === 'novice';
  const isTouchDevice = detectTouchDevice();

  let html = `
    <div class="callout-panel-header">
      <span>My Instruction</span>
      <button class="callout-panel-close" data-action="close">\u00d7</button>
    </div>
    <div class="callout-instructions-list">
  `;

  if (callout.instructions.length === 0 && isExpert) {
    html += renderEmptyInstructionRow(0, isTouchDevice);
  } else {
    for (let i = 0; i < callout.instructions.length; i++) {
      const inst = callout.instructions[i];
      html += renderFilledInstructionRow(i, inst, isExpert, isNovice);
    }
    if (isExpert) {
      html += renderEmptyInstructionRow(callout.instructions.length, isTouchDevice);
    }
  }

  html += `</div>`;

  if (isExpert && callout.instructions.length > 0) {
    html += `<div class="callout-add-instruction" data-action="add-row">\uff0b Add New Instruction</div>`;
  }

  calloutPanelEl.innerHTML = html;

  calloutPanelEl.addEventListener('click', (e) => handleCalloutClick(e, assetName));
  calloutPanelEl.addEventListener('mouseenter', (e) => handleCalloutHover(e, assetName), true);
  calloutPanelEl.addEventListener('mouseleave', (e) => handleCalloutLeave(e, assetName), true);
}

function renderEmptyInstructionRow(index, isTouchDevice) {
  const sketchDisabled = !isTouchDevice ? 'disabled' : '';
  const sketchTitle = !isTouchDevice ? 'Sketch requires a touch/stylus device' : 'Add sketch annotation';

  return `
    <div class="instruction-row" data-index="${index}">
      <button class="instruction-type-btn" data-action="capture-button" data-index="${index}" title="Record a toolbar button">\uff0b</button>
      <button class="instruction-type-btn ${sketchDisabled}" data-action="capture-sketch" data-index="${index}" title="${sketchTitle}">\u270e</button>
      <button class="instruction-type-btn" data-action="capture-voice" data-index="${index}" title="Record voice instruction">\ud83d\udd0a</button>
      <button class="instruction-delete-btn" data-action="delete" data-index="${index}" title="Delete instruction">\ud83d\uddd1</button>
    </div>
  `;
}

function renderFilledInstructionRow(index, instruction, isExpert, isNovice) {
  const deleteBtn = isExpert ? `<button class="instruction-delete-btn" data-action="delete" data-index="${index}" title="Delete instruction">\ud83d\uddd1</button>` : '';

  // AR Anchor icon: shown ONLY on completed Button instruction rows
  let arAnchorIcon = '';
  if (instruction.type === 'button') {
    const hasAnchor = instruction.arAnchor != null;

    if (isExpert) {
      if (hasAnchor) {
        arAnchorIcon = `<span class="ar-anchor-badge anchored" data-action="enter-ar-anchor" data-index="${index}" title="AR anchor set — click to re-anchor">\ud83d\udccc</span>`;
      } else {
        arAnchorIcon = `<button class="ar-anchor-btn" data-action="enter-ar-anchor" data-index="${index}" title="Anchor this instruction to geometry for AR viewing">\ud83d\udccc</button>`;
      }
    } else if (isNovice && hasAnchor && detectTouchDevice()) {
      // AR link only shown on mobile/tablet devices — AR viewer requires gyroscope
      arAnchorIcon = `<a class="ar-anchor-badge anchored novice-ar-link" data-action="open-ar-page" data-index="${index}" title="View in AR" href="/ar.html" target="_blank">\ud83d\udccc AR</a>`;
    }
  }

  return `
    <div class="instruction-row filled" data-index="${index}" data-type="${instruction.type}">
      <span class="instruction-label" data-action="view-instruction" data-index="${index}">${instruction.label}</span>
      ${arAnchorIcon}
      ${deleteBtn}
    </div>
  `;
}

function closeCalloutPanel() {
  if (calloutPanelEl) {
    calloutPanelEl.remove();
    calloutPanelEl = null;
  }
  const line = document.getElementById('connector-line');
  if (line) {
    line.setAttribute('x1', 0);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', 0);
    line.setAttribute('y2', 0);
  }
  clearToolbarHighlights();
}

// --- Event Handling ---

function handleCalloutClick(event, assetName) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const index = parseInt(target.dataset.index, 10);

  event.stopPropagation();

  switch (action) {
    case 'close':
      closeCalloutPanel();
      if (selectedAsset) {
        if (getCurrentMode() === 'expert') {
          calloutTriggerEl.style.display = 'block';
        } else if (calloutStore[assetName]?.instructions.length > 0) {
          calloutIndicatorEl.style.display = 'block';
        }
      }
      break;

    case 'capture-button':
      initiateButtonCapture(assetName, index);
      break;

    case 'capture-sketch':
      if (target.classList.contains('disabled')) return;
      initiateSketchCapture(assetName, index);
      break;

    case 'capture-voice':
      initiateVoiceCapture(assetName, index);
      break;

    case 'delete':
      deleteInstruction(assetName, index);
      break;

    case 'view-instruction':
      viewInstruction(assetName, index);
      break;

    case 'add-row':
      renderCalloutPanel(assetName);
      break;

    case 'enter-ar-anchor':
      enterARAnchorMode(assetName, index);
      break;

    case 'open-ar-page':
      // Novice clicks the AR badge — the <a> tag handles navigation via href
      break;
  }
}

function handleCalloutHover(event, assetName) {
  const target = event.target.closest('.instruction-row.filled');
  if (!target) return;

  const index = parseInt(target.dataset.index, 10);
  const callout = calloutStore[assetName];
  if (!callout) return;

  const inst = callout.instructions[index];
  if (inst && inst.type === 'button') {
    highlightToolbarButton(inst.data.toolName);
  }
}

function handleCalloutLeave(event, assetName) {
  const target = event.target.closest('.instruction-row.filled');
  if (target) {
    clearToolbarHighlights();
  }
}

function onViewportPointerMove(event) {
  if (isARAnchorMode) return;

  const viewport = document.getElementById('viewport-container');
  const rect = viewport.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width * 20 - 10).toFixed(1);
  const y = (-(event.clientY - rect.top) / rect.height * 20 + 10).toFixed(1);
  const coordsEl = document.getElementById('status-coords');
  if (coordsEl) coordsEl.textContent = `X: ${x}  Y: 0.0  Z: ${y}`;
}

// --- Instruction Initiation ---

function initiateButtonCapture(assetName, slotIndex) {
  activateButtonCapture(assetName, slotIndex, (toolName) => {
    addInstruction(assetName, slotIndex, 'button', { toolName }, `Button: ${toolName}`);
  });
}

function initiateSketchCapture(assetName, slotIndex) {
  activateSketchMode(assetName, slotIndex, (imageDataURL) => {
    const sketchNum = countInstructionsByType(assetName, 'sketch') + 1;
    addInstruction(assetName, slotIndex, 'sketch', { imageDataURL }, `Sketch ${sketchNum}`);
  });
}

function initiateVoiceCapture(assetName, slotIndex) {
  activateVoiceRecording(assetName, slotIndex, (transcript) => {
    const voiceNum = countInstructionsByType(assetName, 'voice') + 1;
    addInstruction(assetName, slotIndex, 'voice', { transcript }, `Voice ${voiceNum}`);
  });
}

// --- Instruction CRUD ---

function addInstruction(assetName, slotIndex, type, data, label) {
  if (!calloutStore[assetName]) {
    calloutStore[assetName] = { instructions: [], isOpen: true };
  }

  const callout = calloutStore[assetName];

  if (slotIndex >= callout.instructions.length) {
    callout.instructions.push({ type, data, label, arAnchor: null });
  } else {
    callout.instructions[slotIndex] = { type, data, label, arAnchor: null };
  }

  markComponentHasCallout(assetName, true);

  if (calloutPanelEl) {
    renderCalloutPanel(assetName);
  }

  updateStatusMessage(`Added ${type} instruction`);
  broadcastCalloutState();
}

function deleteInstruction(assetName, index) {
  const callout = calloutStore[assetName];
  if (!callout) return;

  callout.instructions.splice(index, 1);

  if (callout.instructions.length === 0) {
    markComponentHasCallout(assetName, false);
  }

  if (calloutPanelEl) {
    renderCalloutPanel(assetName);
  }

  updateStatusMessage('Instruction deleted');
  broadcastCalloutState();
}

function broadcastCalloutState() {
  if (_isRemoteUpdate) return;
  const payload = {};
  for (const [assetName, entry] of Object.entries(calloutStore)) {
    payload[assetName] = { instructions: entry.instructions };
  }
  broadcastState(payload);
}

function countInstructionsByType(assetName, type) {
  const callout = calloutStore[assetName];
  if (!callout) return 0;
  return callout.instructions.filter(i => i.type === type).length;
}

// --- View Instruction ---

function viewInstruction(assetName, index) {
  const callout = calloutStore[assetName];
  if (!callout) return;

  const inst = callout.instructions[index];
  if (!inst) return;

  switch (inst.type) {
    case 'button':
      highlightToolbarButton(inst.data.toolName);
      updateStatusMessage(`Highlighting: ${inst.data.toolName}`);
      break;

    case 'sketch':
      showSketchOverlay(inst.data.imageDataURL);
      break;

    case 'voice':
      showVoiceDialog(inst.data.transcript);
      break;
  }
}

// --- Sketch Overlay Replay ---

function showSketchOverlay(imageDataURL) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:500;cursor:pointer;background:rgba(0,0,0,0.1);';

  const img = document.createElement('img');
  img.src = imageDataURL;
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
  overlay.appendChild(img);

  const dismissMsg = document.createElement('div');
  dismissMsg.textContent = 'Click anywhere to dismiss';
  dismissMsg.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#fff;padding:8px 16px;border-radius:4px;font-size:12px;z-index:501;';
  overlay.appendChild(dismissMsg);

  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// --- Voice Dialog Display ---

function showVoiceDialog(transcript) {
  if (activeVoiceDialog) activeVoiceDialog.remove();

  const isNovice = getCurrentMode() === 'novice';

  const dialog = document.createElement('div');
  dialog.className = 'voice-dialog fade-in';
  dialog.innerHTML = `
    <div class="voice-dialog-header">Voice Instruction</div>
    <div class="voice-dialog-text">${transcript}</div>
    ${isNovice ? '<button class="voice-play-btn" title="Play audio">\u25b6 Play</button>' : ''}
  `;
  dialog.style.display = 'block';

  if (isNovice) {
    const playBtn = dialog.querySelector('.voice-play-btn');
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        playBtn.textContent = '\u25b6 Play';
        return;
      }
      const utterance = new SpeechSynthesisUtterance(transcript);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.onstart = () => { playBtn.textContent = '\u25a0 Stop'; };
      utterance.onend = () => { playBtn.textContent = '\u25b6 Play'; };
      speechSynthesis.speak(utterance);
    });
  }

  const pos = getAssetScreenPosition();
  if (pos) {
    dialog.style.left = `${pos.x - 140}px`;
    dialog.style.top = `${pos.y + 50}px`;
  }

  document.getElementById('viewport-container').appendChild(dialog);
  activeVoiceDialog = dialog;

  setTimeout(() => {
    const dismissHandler = (e) => {
      if (!dialog.contains(e.target)) {
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        dialog.remove();
        activeVoiceDialog = null;
        document.removeEventListener('click', dismissHandler);
      }
    };
    document.addEventListener('click', dismissHandler);
  }, 200);
}

// --- Mode Change Handling ---

function handleModeChange(mode) {
  closeCalloutPanel();
  clearToolbarHighlights();

  if (isARAnchorMode) exitARAnchorMode();

  if (mode === 'novice' && selectedAsset) {
    const assetName = selectedAsset.name;
    const hasCallout = calloutStore[assetName] && calloutStore[assetName].instructions.length > 0;
    calloutTriggerEl.style.display = 'none';
    if (hasCallout) {
      calloutIndicatorEl.style.display = 'block';
    }
  } else if (mode === 'expert' && selectedAsset) {
    calloutIndicatorEl.style.display = 'none';
    calloutTriggerEl.style.display = 'block';
  }
}

// ============================================================================
// AR Anchoring Mode
// ============================================================================
// Design rationale:
// The 2D desktop viewport is fundamentally insufficient for communicating
// WHERE on a 3D asset a CAD operation should be applied. On a 2D screen,
// edges overlap, occlude each other, and lose their spatial identity
// depending on viewing angle. AR is the only output modality that preserves
// the spatial relationship between a CAD tool instruction and the specific
// geometry it refers to.
//
// Spatial anchoring is only exposed in the AR view — not the desktop view —
// because some instructional content is inherently spatial and cannot be
// faithfully delivered on a flat screen. The anchor data recorded here is
// consumed by the AR viewer page (ar.html) to place floating labels at
// the correct 3D positions on the asset.
// ============================================================================

function createARAnchorBanner() {
  arAnchorBannerEl = document.createElement('div');
  arAnchorBannerEl.id = 'ar-anchor-banner';
  arAnchorBannerEl.style.cssText = `
    position: fixed;
    top: var(--topbar-height, 40px);
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #e07b00, #c06a00);
    color: #fff;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    z-index: 600;
    display: none;
    box-shadow: 0 2px 12px rgba(224, 123, 0, 0.5);
  `;
  arAnchorBannerEl.textContent = '\ud83d\udccc AR Anchoring Mode \u2014 Click an edge, face, or vertex on the model to anchor this instruction (Esc to cancel)';
  document.body.appendChild(arAnchorBannerEl);
}

function enterARAnchorMode(assetName, slotIndex) {
  if (isARAnchorMode) exitARAnchorMode();

  isARAnchorMode = true;
  arAnchorTargetAssetName = assetName;
  arAnchorTargetSlotIndex = slotIndex;

  arAnchorBannerEl.style.display = 'block';

  const viewport = document.getElementById('viewport-container');
  viewport.style.outline = '3px solid #e07b00';
  viewport.style.outlineOffset = '-3px';

  disableOrbitControls();
  viewport.style.cursor = 'crosshair';

  if (calloutPanelEl) calloutPanelEl.style.display = 'none';

  document.addEventListener('keydown', onARAnchorKeydown);
  viewport.addEventListener('pointermove', onARAnchorHover);

  updateStatusMessage('AR Anchoring \u2014 hover over the model, click to anchor');
  console.log('[Callout] Entered AR Anchoring Mode for slot', slotIndex);
}

function exitARAnchorMode() {
  isARAnchorMode = false;
  arAnchorTargetAssetName = null;
  arAnchorTargetSlotIndex = null;

  arAnchorBannerEl.style.display = 'none';

  const viewport = document.getElementById('viewport-container');
  viewport.style.outline = 'none';
  viewport.style.cursor = 'default';

  enableOrbitControls();
  removeARAnchorHoverHighlight();

  document.removeEventListener('keydown', onARAnchorKeydown);
  viewport.removeEventListener('pointermove', onARAnchorHover);

  if (calloutPanelEl) calloutPanelEl.style.display = '';

  updateStatusMessage('Ready');
  console.log('[Callout] Exited AR Anchoring Mode');
}

function onARAnchorHover(event) {
  if (!isARAnchorMode || !model) return;

  const viewport = document.getElementById('viewport-container');
  const rect = viewport.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, getCamera());

  const meshes = [];
  model.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });

  const intersects = raycaster.intersectObjects(meshes, false);

  removeARAnchorHoverHighlight();

  if (intersects.length > 0) {
    const hit = intersects[0];
    const faceIndex = hit.faceIndex;
    const hitMesh = hit.object;
    const geometry = hitMesh.geometry;

    if (geometry.index && faceIndex != null) {
      const posAttr = geometry.attributes.position;
      const indexAttr = geometry.index;

      const i0 = indexAttr.getX(faceIndex * 3);
      const i1 = indexAttr.getX(faceIndex * 3 + 1);
      const i2 = indexAttr.getX(faceIndex * 3 + 2);

      const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0);
      const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i1);
      const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i2);

      v0.applyMatrix4(hitMesh.matrixWorld);
      v1.applyMatrix4(hitMesh.matrixWorld);
      v2.applyMatrix4(hitMesh.matrixWorld);

      const highlightGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        v0.x, v0.y, v0.z,
        v1.x, v1.y, v1.z,
        v2.x, v2.y, v2.z,
      ]);
      highlightGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

      const highlightMat = new THREE.MeshBasicMaterial({
        color: 0xe07b00,
        opacity: 0.6,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
      });

      arHoverHighlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
      arHoverHighlightMesh.renderOrder = 999;
      scene.add(arHoverHighlightMesh);
    }

    viewport.style.cursor = 'crosshair';
  } else {
    viewport.style.cursor = 'not-allowed';
  }
}

function removeARAnchorHoverHighlight() {
  if (arHoverHighlightMesh) {
    scene.remove(arHoverHighlightMesh);
    arHoverHighlightMesh.geometry.dispose();
    arHoverHighlightMesh.material.dispose();
    arHoverHighlightMesh = null;
  }
}

function handleARAnchorClick(event) {
  if (!isARAnchorMode || !model) return;

  const viewport = document.getElementById('viewport-container');
  const rect = viewport.getBoundingClientRect();

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, getCamera());

  const meshes = [];
  model.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });

  const intersects = raycaster.intersectObjects(meshes, false);

  if (intersects.length === 0) return;

  const hit = intersects[0];
  const faceIndex = hit.faceIndex;
  const worldPosition = hit.point.clone();
  const worldNormal = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  worldNormal.applyMatrix3(normalMatrix).normalize();

  const assetName = arAnchorTargetAssetName;
  const slotIndex = arAnchorTargetSlotIndex;
  const callout = calloutStore[assetName];

  if (callout && callout.instructions[slotIndex]) {
    const inst = callout.instructions[slotIndex];
    inst.arAnchor = {
      geometryType: 'face',
      faceIndex: faceIndex,
      worldPosition: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
      worldNormal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
      instructionText: inst.data.toolName || inst.label,
    };
    console.log('[Callout] AR anchor placed:', inst.arAnchor);
    updateStatusMessage(`AR anchor placed for "${inst.label}"`);
    broadcastCalloutState();
  }

  exitARAnchorMode();

  if (calloutPanelEl && assetName) {
    renderCalloutPanel(assetName);
  }
}

function onARAnchorKeydown(event) {
  if (event.key === 'Escape') {
    exitARAnchorMode();
  }
}

// --- Utility ---

function detectTouchDevice() {
  return ('ontouchstart' in window) ||
         (navigator.maxTouchPoints > 0) ||
         (navigator.msMaxTouchPoints > 0);
}

function updateStatusMessage(msg) {
  const el = document.getElementById('status-message');
  if (el) el.textContent = msg;
}

export function applyRemoteState(remoteStore) {
  _isRemoteUpdate = true;

  for (const [assetName, remoteEntry] of Object.entries(remoteStore)) {
    const localEntry = calloutStore[assetName];
    calloutStore[assetName] = {
      instructions: remoteEntry.instructions || [],
      isOpen: localEntry ? localEntry.isOpen : false
    };
    const hasInstructions = calloutStore[assetName].instructions.length > 0;
    markComponentHasCallout(assetName, hasInstructions);
  }

  // Remove assets no longer in remote state
  for (const assetName of Object.keys(calloutStore)) {
    if (!(assetName in remoteStore)) {
      delete calloutStore[assetName];
      markComponentHasCallout(assetName, false);
    }
  }

  // Re-render callout panel if currently open
  if (calloutPanelEl && selectedAsset) {
    renderCalloutPanel(selectedAsset.name);
  }

  _isRemoteUpdate = false;
}

export { calloutStore, getAssetScreenPosition };
