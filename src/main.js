// main.js — Application entry point
// Initializes all subsystems in order

import { initScene } from './scene.js';
import { loadAsset } from './assetLoader.js';
import { initCADUI } from './cadUI.js';
import { initCalloutSystem, applyRemoteState } from './calloutSystem.js';
import { initGazeSharing, applyRemoteGazeState } from './gazeSharing.js';
import { initGestureNav } from './gestureNav.js';
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
  await initGestureNav(); //changed to await

  // Gesture -> camera controls
  window.addEventListener('gesture-zoom', (event) => {
    const delta = event.detail.delta;

    if (!controls || !camera) return;

    const direction = camera.position.clone().sub(controls.target);
    const currentDistance = direction.length();

    let newDistance = currentDistance + delta;
    newDistance = Math.max(1.5, Math.min(20, newDistance));

    direction.setLength(newDistance);
    camera.position.copy(controls.target.clone().add(direction));
    controls.update();
  });

  window.addEventListener('gesture-rotate', (event) => {
    const deltaAngle = event.detail.deltaAngle;

    if (!controls || !camera) return;

    const offset = camera.position.clone().sub(controls.target);
    const radius = Math.sqrt(offset.x * offset.x + offset.z * offset.z);
    let angle = Math.atan2(offset.z, offset.x);

    angle += deltaAngle;

    camera.position.x = controls.target.x + radius * Math.cos(angle);
    camera.position.z = controls.target.z + radius * Math.sin(angle);
    camera.lookAt(controls.target);
    controls.update();
  });


  // Initialize real-time sync
  initSyncClient();
  onRemoteState((remoteStore) => {
    applyRemoteState(remoteStore);
    applyRemoteGazeState(remoteStore);
  });

  console.log('[CAD Expertise] All systems initialized.');
}

init().catch(err => {
  console.error('[CAD Expertise] Initialization failed:', err);
});
