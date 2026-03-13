# 01 — Project Setup

## Overview

This file describes the project scaffold: Vite initialization, dependencies, folder structure, HTML entry points, and stub source files.

---

## Scaffold

Initialize a Vite vanilla JS project, then install `three` as the only npm dependency.

---

## Folder Structure

```
project-root/
├── public/assets/          ← PIULITA6.fbx and AO texture
├── src/
│   ├── main.js             ← Entry point, initializes all subsystems
│   ├── scene.js            ← Three.js scene setup
│   ├── assetLoader.js      ← FBX loading and material
│   ├── cadUI.js            ← Toolbar, sidebar, mode toggle
│   ├── calloutSystem.js    ← Core callout logic
│   ├── instructionTypes/
│   │   ├── buttonInstruction.js
│   │   ├── sketchInstruction.js
│   │   └── voiceInstruction.js
│   ├── gazeSharing.js
│   ├── gestureNav.js
│   └── styles/main.css
├── index.html              ← Main app entry point
├── ar.html                 ← WOZ AR viewer page
├── vite.config.js
└── package.json
```

---

## Vite Config

Configure Vite with multi-page input (`index.html` and `ar.html`), `publicDir: 'public'`, and dev server on port 3000.

---

## HTML Entry Points

### `index.html`

The main app page. Contains:
- **Top bar** with app title, Expert/Novice mode toggle buttons, and connection status
- **Main layout** with a left toolbar (`#cad-toolbar`), center viewport (`#viewport-container` with `<canvas>`), and right sidebar (`#component-sidebar`)
- **Status bar** at the bottom with message, mode, and coordinates
- A hidden webcam container for gesture nav
- Loads `src/main.js` as a module

### `ar.html`

The WOZ AR viewer page. Minimal — just a canvas, a status HUD, and loads `src/arViewer.js`.

---

## Stub Source Files

Create all source files as stubs (single export function, console log) so imports don't break during incremental development. `main.js` should import and call `initScene()`, `loadAsset()`, `initCADUI()`, `initCalloutSystem()`, `initGazeSharing()`, and `initGestureNav()` in order.

---
