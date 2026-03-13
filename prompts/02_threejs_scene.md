# 02 — Three.js Scene Setup

## Overview

This file implements `src/scene.js`. It creates the Three.js scene, camera, lighting, renderer, OrbitControls, animation loop, and responsive resize handling. The renderer targets the `<canvas id="viewport-canvas">` element inside `#viewport-container`.

---

## File: `src/scene.js`

### Architecture

The module should:

1. **Scene** — dark background (`#1e1e1e`)
2. **Camera** — `PerspectiveCamera` at `(0, 5, 10)` looking at origin, aspect ratio from `#viewport-container`
3. **Renderer** — `WebGLRenderer` on the existing canvas, with antialiasing, shadow maps, ACES tone mapping
4. **Lighting** — four-light setup: ambient fill, key directional (with shadows), fill directional, rim directional
5. **Ground plane** — subtle dark plane at y=0 with shadow receiving
6. **Grid** — `GridHelper` for CAD aesthetic
7. **OrbitControls** — damped, with min/max distance, target slightly above origin
8. **Animation loop** — calls `controls.update()`, runs registered callbacks, then `renderer.render()`
9. **Resize handling** — `ResizeObserver` on `#viewport-container` for reliable panel-aware resizing

### Exports

- `initScene()` — returns `{ scene, camera, renderer, controls }`
- `registerAnimationCallback(cb)` / `unregisterAnimationCallback(cb)` — per-frame hook for other modules
- `getScene()`, `getCamera()`, `getRenderer()`, `getControls()`
- `disableOrbitControls()` / `enableOrbitControls()` — used by sketch, button capture, and AR anchor modes

---

## Integration Notes

- `main.js` calls `initScene()` first and destructures the return value
- Other modules use `registerAnimationCallback()` to hook into the render loop (e.g., callout screen-space positioning, zoom canvas updates)
- `disableOrbitControls()` is called during sketch mode, button capture mode, AR anchor mode, and zoom selection mode to prevent camera movement during those interactions

---
