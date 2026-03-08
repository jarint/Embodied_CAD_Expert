// buttonInstruction.js — Button capture mode

let isCapturing = false;
let captureCallback = null;
let captureAssetName = null;
let captureSlotIndex = null;
let bannerEl = null;
let toolbarClickHandler = null;

export function activateButtonCapture(assetName, slotIndex, onCapture) {
  if (isCapturing) {
    deactivateButtonCapture();
  }

  isCapturing = true;
  captureCallback = onCapture;
  captureAssetName = assetName;
  captureSlotIndex = slotIndex;

  // Show the capture mode banner
  showCaptureBanner();

  // Add visual indicator to all toolbar buttons
  const toolbarBtns = document.querySelectorAll('.toolbar-btn');
  toolbarBtns.forEach(btn => {
    btn.classList.add('capture-mode-active');
  });

  // Attach a one-time click handler to toolbar buttons
  const toolbarContainer = document.getElementById('toolbar-buttons');

  toolbarClickHandler = (event) => {
    const btn = event.target.closest('.toolbar-btn');
    if (!btn) return;

    event.stopPropagation();
    event.preventDefault();

    const toolName = btn.dataset.toolName;
    if (!toolName) return;

    // Capture successful
    console.log('[ButtonInstruction] Captured:', toolName);

    // Save callback before deactivation clears it
    const cb = captureCallback;

    // Exit capture mode
    deactivateButtonCapture();

    // Call the callback with the captured tool name
    if (cb) {
      cb(toolName);
    }
  };

  toolbarContainer.addEventListener('click', toolbarClickHandler, true);

  // Also listen for Escape to cancel
  document.addEventListener('keydown', onCaptureKeydown);

  // Update status bar
  const statusEl = document.getElementById('status-message');
  if (statusEl) statusEl.textContent = 'Button Capture Mode \u2014 Click a toolbar button';
}

export function deactivateButtonCapture() {
  if (!isCapturing) return;

  isCapturing = false;
  captureCallback = null;

  // Remove banner
  hideCaptureBanner();

  // Remove visual indicators from toolbar buttons
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.classList.remove('capture-mode-active');
  });

  // Remove the click handler
  const toolbarContainer = document.getElementById('toolbar-buttons');
  if (toolbarClickHandler) {
    toolbarContainer.removeEventListener('click', toolbarClickHandler, true);
    toolbarClickHandler = null;
  }

  // Remove keydown listener
  document.removeEventListener('keydown', onCaptureKeydown);

  // Reset status
  const statusEl = document.getElementById('status-message');
  if (statusEl) statusEl.textContent = 'Ready';
}

function onCaptureKeydown(event) {
  if (event.key === 'Escape') {
    console.log('[ButtonInstruction] Capture cancelled via Escape');
    deactivateButtonCapture();
  }
}

function showCaptureBanner() {
  bannerEl = document.getElementById('capture-mode-banner');
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.id = 'capture-mode-banner';
    document.body.appendChild(bannerEl);
  }
  bannerEl.textContent = '\ud83d\udd18 Button Capture Mode \u2014 Click a toolbar button to record it (Esc to cancel)';
  bannerEl.style.display = 'block';
}

function hideCaptureBanner() {
  if (bannerEl) {
    bannerEl.style.display = 'none';
  }
}

export function isButtonCaptureActive() {
  return isCapturing;
}
