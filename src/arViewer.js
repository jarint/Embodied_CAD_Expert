// ============================================================================
// WOZ PROTOTYPE — Mobile AR Instruction Playback
// ============================================================================
// In a full implementation, spatial anchors authored by the expert on the
// desktop would be transmitted in real time to this AR viewer via a
// lightweight WebSocket or similar mechanism. The novice's phone would
// receive anchor data (world position, face normal, instruction text) and
// render floating labels at the correct 3D locations on the shared asset.
//
// For this demo, anchors are HARDCODED below to simulate the experience.
//
// Design rationale:
// The 2D desktop viewport is fundamentally insufficient for communicating
// WHERE on a 3D asset a CAD operation should be applied. On a 2D screen,
// edges overlap, occlude each other, and lose their spatial identity
// depending on viewing angle. AR is the only output modality that preserves
// the spatial relationship between a CAD tool instruction and the specific
// geometry it refers to. Spatial anchoring is only exposed in the AR view
// — not the desktop view — because some instructional content is inherently
// spatial and cannot be faithfully delivered on a flat screen.
//
// The view-angle-dependent opacity mechanic reinforces this: the novice
// must physically orient their device to align with the anchored geometry
// before the label becomes fully legible. This embodies the instructional
// intent — the novice learns the spatial context of the operation by
// discovering the correct viewing angle themselves.
// ============================================================================

// WOZ PROTOTYPE — Mobile AR instruction playback
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// WOZ PROTOTYPE — hardcoded spatial anchors for demo
// In production, these would arrive via WebSocket from the desktop session
const WOZ_ANCHORS = [
  {
    instructionText: 'Extrude this face',
    worldPosition: { x: 0.0, y: 2.5, z: 0.4 },
    worldNormal: { x: 0, y: 0, z: 1 },
    geometryType: 'face',
    color: '#e07b00',
  },
  {
    instructionText: 'Fillet this edge',
    worldPosition: { x: 0.5, y: 1.5, z: 0.0 },
    worldNormal: { x: 1, y: 0, z: 0 },
    geometryType: 'edge',
    color: '#4a90d9',
  },
  {
    instructionText: 'Chamfer — 2mm',
    worldPosition: { x: -0.3, y: 0.5, z: 0.3 },
    worldNormal: { x: -0.5, y: 0.5, z: 0.5 },
    geometryType: 'vertex',
    color: '#40c060',
  },
];

// WOZ PROTOTYPE
let scene, camera, renderer, model;
let orientationData = { alpha: 0, beta: 0, gamma: 0 };
let hasGyroscope = false;
let gyroInitialized = false;
let gyroRefAlpha = 0, gyroRefBeta = 0;
let anchorLabels = [];
let orbitRadius = 6.7; // fixed orbit radius, only changed by pinch-to-zoom
let orbitTheta = 0;    // horizontal angle (radians)
let orbitPhi = 0.45;   // vertical angle (radians), ~26 degrees up

init();

async function init() {
  const canvas = document.getElementById('ar-canvas');
  const statusEl = document.getElementById('ar-status');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 3, 6);
  camera.lookAt(0, 1.5, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, 1.0);
  directional.position.set(5, 10, 7);
  scene.add(directional);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 5, -5);
  scene.add(fillLight);

  // Grid (subtle, like an AR ground plane)
  const grid = new THREE.GridHelper(10, 20, 0x444444, 0x333333);
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  scene.add(grid);

  // Load the FBX model
  try {
    model = await loadModel();
    statusEl.textContent = 'AR Viewer — Move your device to explore the model';
  } catch (err) {
    console.error('[AR] Failed to load model:', err);
    statusEl.textContent = 'Failed to load model. Using fallback.';
    createFallbackModel();
  }

  // WOZ PROTOTYPE — Create spatial anchor labels on the model
  createAnchorLabels();

  // Device orientation
  setupDeviceOrientation(statusEl);

  // Touch zoom
  setupTouchZoom();

  // Touch/mouse rotation fallback
  setupTouchFallback();

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation loop
  animate();
}

function loadModel() {
  // WOZ PROTOTYPE — same bolt model as main app
  return new Promise((resolve, reject) => {
    const loader = new FBXLoader();
    const textureLoader = new THREE.TextureLoader();

    const aoTexture = textureLoader.load('/assets/internal_ground_ao_texture.jpeg');

    loader.load(
      '/assets/PIULITA6.fbx',
      (fbxGroup) => {
        const box = new THREE.Box3().setFromObject(fbxGroup);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 3 / maxDim;
        fbxGroup.scale.setScalar(scaleFactor);

        box.setFromObject(fbxGroup);
        box.getCenter(center);
        fbxGroup.position.sub(center);
        fbxGroup.position.y -= box.min.y;

        fbxGroup.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
              child.geometry.attributes.uv2 = child.geometry.attributes.uv;
            }
            child.material = new THREE.MeshStandardMaterial({
              color: 0x8a8a8a,
              metalness: 0.7,
              roughness: 0.35,
              aoMap: aoTexture,
              aoMapIntensity: 1.0,
            });
          }
        });

        scene.add(fbxGroup);
        resolve(fbxGroup);
      },
      undefined,
      reject
    );
  });
}

function createFallbackModel() {
  // WOZ PROTOTYPE
  const group = new THREE.Group();

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 2, 32),
    new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.7, roughness: 0.35 })
  );
  shaft.position.y = 1;
  group.add(shaft);

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.7, roughness: 0.35 })
  );
  head.position.y = 2.2;
  group.add(head);

  scene.add(group);
  model = group;
}

// --- Spatially Anchored Instruction Labels ---

function createAnchorLabels() {
  // WOZ PROTOTYPE — create floating labels for each hardcoded anchor
  const container = document.getElementById('ar-labels-container');

  for (const anchor of WOZ_ANCHORS) {
    const labelEl = document.createElement('div');
    labelEl.className = 'ar-anchor-label';
    labelEl.innerHTML = `
      <span class="ar-anchor-label-icon" style="background:${anchor.color};">\ud83d\udccc</span>
      <span class="ar-anchor-label-text">${anchor.instructionText}</span>
    `;
    container.appendChild(labelEl);

    const worldPos = new THREE.Vector3(anchor.worldPosition.x, anchor.worldPosition.y, anchor.worldPosition.z);
    const worldNormal = new THREE.Vector3(anchor.worldNormal.x, anchor.worldNormal.y, anchor.worldNormal.z).normalize();

    anchorLabels.push({
      element: labelEl,
      worldPosition: worldPos,
      worldNormal: worldNormal,
      anchor: anchor,
    });
  }

  console.log('[AR] WOZ — Created', anchorLabels.length, 'spatial anchor labels');
}

function updateAnchorLabels() {
  // WOZ PROTOTYPE — per-frame spatial label update with view-angle opacity
  for (const label of anchorLabels) {
    const projected = label.worldPosition.clone().project(camera);

    if (projected.z > 1) {
      label.element.style.display = 'none';
      continue;
    }

    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

    label.element.style.display = 'flex';
    label.element.style.left = `${x}px`;
    label.element.style.top = `${y}px`;

    // --- View-angle-dependent opacity ---
    const cameraDir = new THREE.Vector3();
    cameraDir.subVectors(camera.position, label.worldPosition).normalize();

    const dot = label.worldNormal.dot(cameraDir);

    let opacity;
    if (dot < 0.05) {
      opacity = 0.0;
    } else if (dot < 0.15) {
      opacity = 0.15;
    } else if (dot > 0.6) {
      opacity = 1.0;
    } else {
      opacity = 0.15 + ((dot - 0.15) / (0.6 - 0.15)) * 0.85;
    }

    label.element.style.opacity = opacity.toFixed(2);

    // Scale based on distance for depth cue
    const distance = camera.position.distanceTo(label.worldPosition);
    const scale = THREE.MathUtils.clamp(1.0 / (distance * 0.2), 0.6, 1.5);
    label.element.style.transform = `translate(-50%, -100%) scale(${scale.toFixed(2)})`;
  }
}

// --- Device Orientation (Gyroscope) ---

function setupDeviceOrientation(statusEl) {
  // WOZ PROTOTYPE — gyroscope camera control

  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS/iPadOS 13+ requires explicit permission from a user gesture.
    // Show a full-screen overlay so the button is impossible to miss.
    const overlay = document.createElement('div');
    overlay.id = 'ar-permission-overlay';
    overlay.innerHTML = `
      <div style="
        position:fixed; top:0; left:0; width:100%; height:100%;
        background:rgba(0,0,0,0.7); z-index:100;
        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
      ">
        <p style="color:#fff; font-size:16px; text-align:center; max-width:80%;">
          This viewer uses your device's gyroscope to rotate the camera around the 3D model.
        </p>
        <button id="ar-permission-btn" style="
          padding:16px 32px; border-radius:10px; border:none;
          background:#e07b00; color:#fff; font-size:18px; font-weight:600;
          cursor:pointer; box-shadow:0 4px 16px rgba(224,123,0,0.4);
        ">Enable Gyroscope</button>
        <button id="ar-skip-btn" style="
          padding:8px 20px; border-radius:6px; border:1px solid rgba(255,255,255,0.3);
          background:transparent; color:rgba(255,255,255,0.6); font-size:13px;
          cursor:pointer;
        ">Skip — use touch instead</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#ar-permission-btn').addEventListener('click', async () => {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        console.log('[AR] DeviceOrientation permission:', permission);
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', onDeviceOrientation);
          statusEl.textContent = 'Gyroscope enabled — rotate your device to explore';
          // Check if data actually arrives
          setTimeout(() => {
            if (!hasGyroscope) {
              statusEl.textContent = 'Gyroscope granted but no data received. Use touch to rotate.';
              console.warn('[AR] Permission granted but no orientation events received.');
            }
          }, 2000);
        } else {
          statusEl.textContent = 'Gyroscope denied. Use touch to rotate.';
        }
      } catch (err) {
        console.warn('[AR] Permission error:', err);
        statusEl.textContent = 'Gyroscope error. Use touch to rotate.';
      }
      overlay.remove();
    });

    overlay.querySelector('#ar-skip-btn').addEventListener('click', () => {
      overlay.remove();
      statusEl.textContent = 'Touch mode — drag to rotate, pinch to zoom';
    });

  } else if (window.DeviceOrientationEvent) {
    // Non-iOS: just listen directly
    window.addEventListener('deviceorientation', onDeviceOrientation);

    setTimeout(() => {
      if (!hasGyroscope) {
        statusEl.textContent = 'No gyroscope detected. Use touch/mouse to rotate.';
      }
    }, 2000);
  } else {
    statusEl.textContent = 'No gyroscope available. Use touch/mouse to rotate.';
  }
}

function onDeviceOrientation(event) {
  // WOZ PROTOTYPE
  // event.alpha can be null if not supported — guard against that
  if (event.alpha == null) return;

  const alpha = event.alpha;
  const beta = event.beta || 0;
  const gamma = event.gamma || 0;

  // Capture reference orientation on the very first reading
  if (!gyroInitialized) {
    gyroRefAlpha = alpha;
    gyroRefBeta = beta;
    gyroInitialized = true;
    console.log('[AR] Gyro reference captured:', { alpha, beta, gamma });
  }

  orientationData.alpha = alpha;
  orientationData.beta = beta;
  orientationData.gamma = gamma;
  hasGyroscope = true;
}

// --- Touch/Mouse Fallback ---

let touchStartX = 0, touchStartY = 0;
let isDragging = false;

function setupTouchFallback() {
  // WOZ PROTOTYPE — touch/mouse drag to rotate for desktop testing
  const canvas = document.getElementById('ar-canvas');

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      orbitTheta += dx * 0.005;
      orbitPhi += dy * 0.005;
      orbitPhi = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, orbitPhi));
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    touchStartX = e.clientX;
    touchStartY = e.clientY;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - touchStartX;
    const dy = e.clientY - touchStartY;
    orbitTheta += dx * 0.005;
    orbitPhi += dy * 0.005;
    orbitPhi = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, orbitPhi));
    touchStartX = e.clientX;
    touchStartY = e.clientY;
  });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });
}

// --- Pinch-to-Zoom ---

function setupTouchZoom() {
  let lastPinchDist = 0;
  const canvas = document.getElementById('ar-canvas');

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      lastPinchDist = getTouchDistance(e.touches);
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches);
      const delta = dist - lastPinchDist;

      orbitRadius -= delta * 0.02;
      orbitRadius = Math.max(2, Math.min(20, orbitRadius));

      lastPinchDist = dist;
      e.preventDefault();
    }
  }, { passive: false });
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// --- Animation Loop ---

// WOZ PROTOTYPE — lookAt target (center of model)
const lookTarget = new THREE.Vector3(0, 1.5, 0);

function animate() {
  requestAnimationFrame(animate);

  // WOZ PROTOTYPE — update camera using stable spherical coordinates
  let theta = orbitTheta;
  let phi = orbitPhi;

  if (hasGyroscope && gyroInitialized) {
    // Gyroscope mode: compute relative rotation from reference orientation
    let deltaAlpha = orientationData.alpha - gyroRefAlpha;
    let deltaBeta = orientationData.beta - gyroRefBeta;

    // Normalize deltaAlpha to [-180, 180]
    if (deltaAlpha > 180) deltaAlpha -= 360;
    if (deltaAlpha < -180) deltaAlpha += 360;

    // Map gyro deltas to orbit angles
    theta = THREE.MathUtils.degToRad(-deltaAlpha);
    phi = THREE.MathUtils.clamp(
      THREE.MathUtils.degToRad(deltaBeta * 0.5),
      -Math.PI / 3,
      Math.PI / 3
    );
  }

  // Spherical to cartesian (theta = horizontal, phi = vertical offset)
  camera.position.x = orbitRadius * Math.sin(theta) * Math.cos(phi);
  camera.position.z = orbitRadius * Math.cos(theta) * Math.cos(phi);
  camera.position.y = orbitRadius * Math.sin(phi) + lookTarget.y;

  camera.lookAt(lookTarget);

  // WOZ PROTOTYPE — update spatial anchor label positions and opacity
  updateAnchorLabels();

  renderer.render(scene, camera);
}
