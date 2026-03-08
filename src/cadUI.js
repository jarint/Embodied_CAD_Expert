// cadUI.js — CAD interface panels
// Implements: toolbar buttons, component tree, mode toggle, status bar

let currentMode = 'expert'; // 'expert' | 'novice'
let modeChangeCallbacks = [];

const TOOLBAR_BUTTONS = [
  { id: 'tool-select', icon: '⊹', label: 'Select' },
  { id: 'tool-move', icon: '✥', label: 'Move' },
  { id: 'tool-rotate', icon: '↻', label: 'Rotate' },
  { id: 'tool-scale', icon: '⤡', label: 'Scale' },
  { id: 'separator-1', separator: true },
  { id: 'tool-extrude', icon: '⬡', label: 'Extrude' },
  { id: 'tool-revolve', icon: '◎', label: 'Revolve' },
  { id: 'tool-sweep', icon: '⌇', label: 'Sweep' },
  { id: 'tool-loft', icon: '⋈', label: 'Loft' },
  { id: 'separator-2', separator: true },
  { id: 'tool-fillet', icon: '◠', label: 'Fillet' },
  { id: 'tool-chamfer', icon: '◿', label: 'Chamfer' },
  { id: 'tool-shell', icon: '▢', label: 'Shell' },
  { id: 'tool-boolean', icon: '⊕', label: 'Boolean' },
  { id: 'separator-3', separator: true },
  { id: 'tool-mirror', icon: '⊞', label: 'Mirror' },
  { id: 'tool-pattern', icon: '⊞', label: 'Pattern' },
  { id: 'tool-measure', icon: '📏', label: 'Measure' },
  { id: 'tool-section', icon: '⊟', label: 'Section' },
];

const COMPONENT_TREE = [
  { id: 'comp-assembly', label: 'Assembly', icon: '📦', indent: 0, expandable: true },
  { id: 'comp-bolt-body', label: 'Bolt Body', icon: '⚙', indent: 1, expandable: false, assetRef: 'CAD_ASSET_BOLT' },
];

export function initCADUI() {
  createToolbarButtons();
  createComponentTree();
  initModeToggle();
  console.log('[CAD UI] Initialized');
}

function createToolbarButtons() {
  const container = document.getElementById('toolbar-buttons');
  if (!container) return;

  container.innerHTML = '';

  for (const def of TOOLBAR_BUTTONS) {
    if (def.separator) {
      const sep = document.createElement('div');
      sep.className = 'toolbar-separator';
      container.appendChild(sep);
      continue;
    }

    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.id = def.id;
    btn.dataset.toolName = def.label;
    btn.title = def.label;

    btn.innerHTML = `
      <span class="toolbar-btn-icon">${def.icon}</span>
      <span class="toolbar-btn-label">${def.label}</span>
    `;

    // Decorative click — no real CAD operation
    btn.addEventListener('click', () => {
      // Remove active from all
      container.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateStatus(`Tool: ${def.label}`);
    });

    container.appendChild(btn);
  }
}

function createComponentTree() {
  const tree = document.getElementById('component-tree');
  if (!tree) return;

  tree.innerHTML = '';

  for (const comp of COMPONENT_TREE) {
    const item = document.createElement('div');
    item.className = 'component-tree-item';
    item.id = comp.id;
    item.style.paddingLeft = `${12 + comp.indent * 16}px`;
    if (comp.assetRef) item.dataset.assetRef = comp.assetRef;

    item.innerHTML = `
      <span class="component-tree-icon">${comp.icon}</span>
      <span class="component-tree-label">${comp.label}</span>
      <span class="component-callout-indicator"></span>
    `;

    item.addEventListener('click', () => {
      tree.querySelectorAll('.component-tree-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });

    tree.appendChild(item);
  }
}

function initModeToggle() {
  const expertBtn = document.getElementById('mode-toggle-expert');
  const noviceBtn = document.getElementById('mode-toggle-novice');

  if (!expertBtn || !noviceBtn) return;

  expertBtn.addEventListener('click', () => setMode('expert'));
  noviceBtn.addEventListener('click', () => setMode('novice'));
}

function setMode(mode) {
  currentMode = mode;

  const expertBtn = document.getElementById('mode-toggle-expert');
  const noviceBtn = document.getElementById('mode-toggle-novice');

  expertBtn.classList.toggle('active', mode === 'expert');
  noviceBtn.classList.toggle('active', mode === 'novice');

  const statusMode = document.getElementById('status-mode');
  if (statusMode) statusMode.textContent = `Mode: ${mode === 'expert' ? 'Expert' : 'Novice'}`;

  // Notify subscribers
  for (const cb of modeChangeCallbacks) {
    cb(mode);
  }

  console.log('[CAD UI] Mode changed to:', mode);
}

export function getCurrentMode() {
  return currentMode;
}

export function onModeChange(callback) {
  modeChangeCallbacks.push(callback);
}

export function getToolbarButtons() {
  return TOOLBAR_BUTTONS.filter(b => !b.separator);
}

export function highlightToolbarButton(toolName) {
  // Remove any existing highlights
  clearToolbarHighlights();

  const btns = document.querySelectorAll('.toolbar-btn');
  for (const btn of btns) {
    if (btn.dataset.toolName === toolName) {
      btn.classList.add('highlighted');
      // Scroll button into view if needed
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
  }
}

export function clearToolbarHighlights() {
  document.querySelectorAll('.toolbar-btn.highlighted').forEach(btn => {
    btn.classList.remove('highlighted');
  });
}

export function markComponentHasCallout(assetRef, hasCallout) {
  const items = document.querySelectorAll('.component-tree-item');
  for (const item of items) {
    if (item.dataset.assetRef === assetRef) {
      item.classList.toggle('has-callout', hasCallout);
    }
  }
}

function updateStatus(msg) {
  const el = document.getElementById('status-message');
  if (el) el.textContent = msg;
}

export function setStatusMessage(msg) {
  updateStatus(msg);
}
