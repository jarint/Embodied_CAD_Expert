// main.js — Application entry point
// Initializes all subsystems in order

import { initScene } from './scene.js';
import { loadAsset } from './assetLoader.js';
import { initCADUI } from './cadUI.js';
import { initCalloutSystem, applyRemoteState } from './calloutSystem.js';
import { initGazeSharing, applyRemoteGazeState } from './gazeSharing.js';
import { initGestureNav, applyRemoteZoomState } from './gestureNav.js';
import { initSyncClient, onRemoteState } from './syncClient.js';

async function init() {
  const { scene, camera, renderer, controls } = initScene();
  const model = await loadAsset(scene);
  if (model) {
    console.log('[CAD Expertise] Model loaded:', model.name);
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) statusMsg.textContent = 'Ready';
  }
  initCADUI();
  initCalloutSystem(scene, camera, renderer, model);
  initGazeSharing();
  initGestureNav();

  // Initialize real-time sync
  initSyncClient();
  onRemoteState((remoteStore) => {
    applyRemoteState(remoteStore);
    applyRemoteGazeState(remoteStore);
    applyRemoteZoomState(remoteStore);
  });

  console.log('[CAD Expertise] All systems initialized.');
}

init().catch(err => {
  console.error('[CAD Expertise] Initialization failed:', err);
});
