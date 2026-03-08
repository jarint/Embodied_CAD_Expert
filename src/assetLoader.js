// assetLoader.js — FBX asset loading with AO texture
// Implements: FBXLoader, texture application, model centering/scaling

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

let loadedModel = null; // reference to the loaded FBX group
const originalMaterials = new Map();

export async function loadAsset(scene) {
  const fbxLoader = new FBXLoader();
  const textureLoader = new THREE.TextureLoader();

  return new Promise((resolve, reject) => {
    // Load the AO texture first
    const aoTexture = textureLoader.load(
      '/assets/internal_ground_ao_texture.jpeg',
      (texture) => {
        console.log('[AssetLoader] AO texture loaded');
      },
      undefined,
      (err) => {
        console.warn('[AssetLoader] AO texture failed to load, proceeding without:', err);
      }
    );

    // Load the FBX model
    fbxLoader.load(
      '/assets/PIULITA6.fbx',
      (fbxGroup) => {
        console.log('[AssetLoader] FBX loaded successfully');

        // --- Step 1: Compute bounding box to center and scale ---
        const box = new THREE.Box3().setFromObject(fbxGroup);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Scale to a reasonable viewport size (target ~3 units tall)
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 3;
        const scaleFactor = targetSize / maxDim;
        fbxGroup.scale.setScalar(scaleFactor);

        // Re-center so the model sits at origin, on the ground plane
        box.setFromObject(fbxGroup);
        box.getCenter(center);
        const minY = box.min.y;
        fbxGroup.position.sub(center);
        fbxGroup.position.y -= minY; // sit on y=0 ground plane

        // --- Step 2: Apply materials ---
        fbxGroup.traverse((child) => {
          if (child.isMesh) {
            // Create a PBR material for a metallic bolt look
            const newMaterial = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              metalness: 0.7,
              roughness: 0.35,
              map: aoTexture || null,
              aoMap: aoTexture || null,
              aoMapIntensity: 0.5,
            });

            // FBX meshes need a second UV set for AO maps.
            // If the geometry doesn't have uv2, copy from uv.
            if (child.geometry) {
              if (!child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
                child.geometry.attributes.uv2 = child.geometry.attributes.uv;
              }
            }

            child.material = newMaterial;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // --- Step 3: Name the group for raycasting identification ---
        fbxGroup.name = 'CAD_ASSET_BOLT';
        fbxGroup.userData.isCADAsset = true;
        fbxGroup.userData.componentName = 'Bolt Body';
        fbxGroup.userData.hasCallout = false;

        // --- Step 4: Add to scene ---
        scene.add(fbxGroup);
        loadedModel = fbxGroup;

        console.log('[AssetLoader] Model added to scene. Scale:', scaleFactor.toFixed(4));
        resolve(fbxGroup);
      },
      // Progress callback
      (xhr) => {
        if (xhr.lengthComputable) {
          const pct = (xhr.loaded / xhr.total) * 100;
          updateStatusMessage(`Loading model: ${pct.toFixed(0)}%`);
        }
      },
      // Error callback
      (error) => {
        console.error('[AssetLoader] Failed to load FBX:', error);
        createFallbackGeometry(scene);
        resolve(loadedModel);
      }
    );
  });
}

function createFallbackGeometry(scene) {
  console.warn('[AssetLoader] Using fallback bolt geometry');

  const group = new THREE.Group();
  group.name = 'CAD_ASSET_BOLT';
  group.userData.isCADAsset = true;
  group.userData.componentName = 'Bolt Body';
  group.userData.hasCallout = false;

  // Bolt shaft
  const shaftGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 32);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x8a8a8a,
    metalness: 0.7,
    roughness: 0.35
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = 1;
  shaft.castShadow = true;
  group.add(shaft);

  // Bolt head (hexagonal prism)
  const headGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 6);
  const head = new THREE.Mesh(headGeo, shaftMat.clone());
  head.position.y = 2.2;
  head.castShadow = true;
  group.add(head);

  scene.add(group);
  loadedModel = group;
}

function updateStatusMessage(msg) {
  const statusEl = document.getElementById('status-message');
  if (statusEl) statusEl.textContent = msg;
}

export function getLoadedModel() {
  return loadedModel;
}

export function highlightModel(model) {
  if (!model) return;
  model.traverse((child) => {
    if (child.isMesh) {
      // Store original material if not already stored
      if (!originalMaterials.has(child.uuid)) {
        originalMaterials.set(child.uuid, child.material.clone());
      }
      // Apply highlight: orange emissive
      child.material.emissive = new THREE.Color(0xe07b00);
      child.material.emissiveIntensity = 0.3;
    }
  });
}

export function unhighlightModel(model) {
  if (!model) return;
  model.traverse((child) => {
    if (child.isMesh) {
      child.material.emissive = new THREE.Color(0x000000);
      child.material.emissiveIntensity = 0;
    }
  });
}
