// scene.js — Three.js scene setup
// Implements: camera, lights, renderer, OrbitControls, animation loop, resize handling

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let animationCallbacks = []; // other modules can register per-frame callbacks

export function initScene() {
  // 1. Create the scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e1e1e);

  // 2. Create the camera
  const container = document.getElementById('viewport-container');
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  // 3. Create the renderer
  const canvas = document.getElementById('viewport-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // 4. Add lighting — three-light setup
  // Ambient light — soft fill
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Key light — directional, casts shadows
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(5, 10, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 50;
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 10;
  keyLight.shadow.camera.bottom = -10;
  scene.add(keyLight);

  // Fill light — softer, opposite side
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 5, -5);
  scene.add(fillLight);

  // Rim light — from behind for edge definition
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
  rimLight.position.set(0, 5, -10);
  scene.add(rimLight);

  // 5. Add a ground plane
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.9,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01; // slightly below origin to avoid z-fighting
  ground.receiveShadow = true;
  scene.add(ground);

  // 6. Add a subtle grid helper
  const gridHelper = new THREE.GridHelper(20, 40, 0x333333, 0x2a2a2a);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // 7. Initialize OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.panSpeed = 0.8;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 1.0;
  controls.minDistance = 2;
  controls.maxDistance = 50;
  controls.target.set(0, 1, 0); // look slightly above origin where bolt center will be
  controls.update();

  // 8. Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();

    renderer.render(scene, camera);

    // Run per-frame callbacks AFTER render so canvas pixels are fresh
    for (const cb of animationCallbacks) {
      cb();
    }
  }
  animate();

  // 9. Handle window resize
  function onResize() {
    const container = document.getElementById('viewport-container');
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', onResize);

  const resizeObserver = new ResizeObserver(() => { onResize(); });
  resizeObserver.observe(container);

  // 10. Return the public API
  return { scene, camera, renderer, controls };
}

// Helper exports for other modules
export function registerAnimationCallback(callback) {
  animationCallbacks.push(callback);
}

export function unregisterAnimationCallback(callback) {
  animationCallbacks = animationCallbacks.filter(cb => cb !== callback);
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getControls() { return controls; }

export function disableOrbitControls() {
  if (controls) controls.enabled = false;
}

export function enableOrbitControls() {
  if (controls) controls.enabled = true;
}
