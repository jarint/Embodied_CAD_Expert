# 05 — Node-Based Callout System

## Overview

This file implements `src/calloutSystem.js` — the core feature of the system. It handles:
- Clicking the 3D asset to select/highlight it via raycasting
- Showing a `+` trigger icon in screen space near the selected asset (Expert mode)
- Spawning the callout UI panel anchored to the asset
- Managing instruction slots (add, fill, delete)
- Routing to the three instruction type modules (button, sketch, voice)
- **AR Anchoring Mode** — geometry-level face selection for spatially anchoring Button instructions
- Switching between Expert View (editable) and Novice View (read-only)
- Displaying a `!` callout indicator icon on the asset in Novice View

This is the longest and most complex module.

---

## Data Model

The callout system maintains an in-memory data store keyed by asset name:

- Each asset maps to `{ instructions: [...], isOpen: bool }`
- Each instruction has `{ type, data, label, arAnchor }`
  - `type`: `'button'`, `'sketch'`, or `'voice'`
  - `data`: type-specific payload (e.g. `{ toolName }`, `{ imageDataURL }`, `{ transcript }`)
  - `arAnchor`: spatial anchor data (only for button instructions), or `null` if not anchored. Contains `geometryType`, `faceIndex`, `worldPosition`, `worldNormal`, `instructionText`.

---

## File: `src/calloutSystem.js`

### Architecture

**Initialization** — receives scene, camera, renderer, and model references. Creates DOM elements (trigger, indicator, connector SVG, AR anchor banner), attaches viewport click/pointermove listeners, registers a per-frame animation callback, and subscribes to mode changes.

**Asset selection** — raycasts into the model on viewport click. If a mesh is hit, selects the parent asset group (highlight, show trigger/indicator based on mode). Clicking empty space deselects.

**Screen-space positioning** — every frame, projects the asset's 3D bounding box center to screen coordinates and repositions the trigger, indicator, and connector line accordingly.

**Callout panel** — a DOM panel created dynamically on open. Renders instruction rows: empty rows show type buttons (button/sketch/voice + delete), filled rows show the instruction label with optional AR anchor icon and delete button. Expert mode is editable; novice mode is read-only.

**Instruction CRUD** — `addInstruction()` pushes to the store and re-renders. `deleteInstruction()` splices and re-renders. Click delegation routes actions by `data-action` attributes.

**Instruction viewing** — clicking a filled instruction label triggers type-specific display: button instructions highlight the toolbar button, sketch instructions show a full-screen image overlay, voice instructions show a transcript dialog (with TTS playback in novice mode).

**AR Anchoring Mode** — entered when the expert clicks the pin icon on a button instruction. Disables orbit controls, shows a banner, changes cursor to crosshair. On hover, raycasts into the model and highlights the face under the cursor (flood-fill of coplanar faces with wireframe edges and vertex marker). On click, stores the anchor data (world position, face normal, face index, instruction text) on the instruction and exits the mode. Escape cancels.

**Mode change handling** — closes the callout panel, exits AR anchor mode if active, and toggles trigger/indicator visibility based on the new mode.

### Exports

- `initCalloutSystem(scene, camera, renderer, model)`
- `applyRemoteState(remoteStore)` — for multi-client sync
- `calloutStore`, `getAssetScreenPosition()`

---

## CSS Additions for AR Anchoring

The following CSS rules should be added to `main.css`:

- `.ar-anchor-btn` — small pin button in expert instruction rows (unanchored state)
- `.ar-anchor-badge.anchored` — orange badge shown after anchoring
- `.novice-ar-link` — prominent orange link for novice to open AR viewer (mobile only)

---

## Integration Notes

- Imports from `scene.js` (camera, renderer, orbit control helpers), `assetLoader.js` (model, highlight helpers), `cadUI.js` (mode, toolbar highlight), and all three instruction type modules
- `main.js` calls `initCalloutSystem()` after the scene, asset, and UI are initialized
- AR anchor data is consumed by the AR viewer (`arViewer.js`) to place floating labels at correct 3D positions
- The novice AR link is gated behind touch device detection — it only shows on mobile/tablet

---
