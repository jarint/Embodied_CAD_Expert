# 03 — Asset Loading

## Overview

This file implements `src/assetLoader.js`. It loads the `PIULITA6.fbx` bolt/screw model using Three.js `FBXLoader`, applies the `internal_ground_ao_texture.jpeg` as an ambient occlusion map, centers and scales the model appropriately, and adds it to the scene.

---

## File: `src/assetLoader.js`

### Architecture

The `loadAsset(scene)` function should:

1. Load the AO texture with `TextureLoader`
2. Load the FBX model with `FBXLoader`
3. Compute the bounding box, scale the model to ~3 units tall, and re-center so it sits on the ground plane (y=0)
4. Traverse all meshes and apply a `MeshStandardMaterial` with metallic bolt appearance (color `0x8a8a8a`, metalness 0.7, roughness 0.35, AO map). Copy `uv` to `uv2` for AO map support.
5. Name the group `'CAD_ASSET_BOLT'` and set `userData.isCADAsset = true`, `userData.componentName = 'Bolt Body'`
6. Add to scene and resolve the promise

### Fallback Geometry

If the FBX fails to load, create a simple cylinder + hexagonal prism as a fallback bolt shape so the system remains functional.

### Highlight Helpers

Export `highlightModel(model)` and `unhighlightModel(model)` for the callout system to use when the asset is selected/deselected. Highlighting applies an orange emissive to all meshes.

### Exports

- `loadAsset(scene)` — returns a Promise resolving to the loaded model group
- `getLoadedModel()` — returns the current model reference
- `highlightModel(model)` / `unhighlightModel(model)`

---

## Integration Notes

- `main.js` awaits `loadAsset(scene)` and passes the result to `initCalloutSystem()`
- The callout system uses `highlightModel()` / `unhighlightModel()` when selecting/deselecting the asset
- The AR viewer (`arViewer.js`) loads the same FBX independently for its own scene

---
