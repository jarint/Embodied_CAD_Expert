# Embodied CAD Expert

A simulated CAD expertise-sharing system built for **CPSC 581 — HCI II (Winter 2026, University of Calgary)**. An expert user attaches multi-modal instruction callouts (button, sketch, voice) to a 3D bolt model rendered with Three.js, and a novice user views and interacts with those instructions. The system supports real-time multi-client sync over WebSocket, gaze sharing, a WOZ zoom window, and a WOZ AR viewer for spatially anchored instructions on mobile devices.

This is **not** a real CAD application. The toolbar buttons are decorative. There is no persistent backend. Both expert and novice views exist in the same browser session, toggled via a mode switch.

---
## Changes on March 12, 2026
We did not make any changes to the code after the due date on March 9.

The only changes made to this repository after the due date were on March 12, 2026. They were as follows:

1. merged branch `integration` into `main` -- our completed code base was in integration, and no changes were made.
2. Update to the README to give the instructors an overview of how to use our features.
3. Inclusion of the `/prompts/` folder for reference (only contains markdown files, no code.)


## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Running the Project](#running-the-project)
4. [Accessing from Other Devices (iPad / Phone)](#accessing-from-other-devices-ipad--phone)
5. [UI Overview](#ui-overview)
6. [Embodied Interactions](#embodied-interactions)
7. [Repository Architecture](#repository-architecture)

---

## Prerequisites

- **Node.js** v18 or later (includes npm)
- **Git**
- A modern browser (Chrome recommended for desktop; Safari or Chrome for iOS/iPadOS)

---

## Setup

After cloning the repo, the `node_modules/` directory will not be present (it is gitignored). You need to install dependencies before running anything.

```bash
git clone <repo-url>
cd Embodied_CAD_Expert
npm install
```

This installs:
- `three` — 3D rendering engine
- `ws` — WebSocket server for multi-client sync
- `@vitejs/plugin-basic-ssl` (dev) — self-signed HTTPS for Vite (required for gyroscope on mobile)
- `vite` (dev) — build tool and dev server

---

## Running the Project

You need **two terminal windows** running simultaneously:

### Terminal 1 — Dev server (Vite + HTTPS)

```bash
npm run dev --host
```

This starts the Vite development server with HTTPS and `--host` makes it LAN-accessible. It will print a URL like:

```
https://localhost:3000/
https://192.168.x.x:3000/   ← use this for mobile devices (tablet/phone)
```

> **First run:** Vite generates a self-signed SSL certificate. Your browser will show a security warning — click **Advanced > Proceed** (or equivalent) to accept it. You only need to do this once per browser.

### Terminal 2 — Sync server (WebSocket)

```bash
npm run sync
```

This starts the WebSocket relay server for multi-client state sync:
- `ws://localhost:3001` — plain WebSocket (used by desktop clients on localhost)
- `wss://localhost:3002` — secure WebSocket (used by LAN/HTTPS clients like iPad)

> **Important:** Start `npm run dev` first (at least once) so the SSL certificate is generated. The sync server reuses that same certificate for its WSS endpoint. If you see a warning about a missing cert, run `npm run dev` in another terminal and restart `npm run sync`.

### Verifying It Works

1. Open `https://localhost:3000` in Chrome — you should see the CAD UI with a 3D bolt
2. Open a second tab to the same URL
3. In tab 1: click the bolt > open callout > add a button instruction
4. In tab 2: click the bolt > open callout > the instruction should already be there

---

## Accessing from Other Devices (iPad / Phone)

1. Make sure your computer and the device are on the **same WiFi network**
2. Find your computer's local IP (shown in Vite's terminal output, e.g. `192.168.x.x`)
3. On the device, open **`https://192.168.x.x:3000`**
4. Accept the self-signed certificate warning
5. If sync doesn't connect immediately, also visit **`https://192.168.x.x:3002`** in the device browser and accept that certificate too, then return to the app

### AR Viewer (Mobile Only)

The AR viewer is at **`/ar.html`** and is designed for phones and tablets with a gyroscope. On mobile, anchored button instructions show an "AR" badge in novice mode that links to this page.

To test directly: `https://192.168.x.x:3000/ar.html`

On iOS/iPadOS, you'll be prompted to enable gyroscope access — tap **Enable Gyroscope** and grant the permission. Rotating the device orbits the camera around the 3D model with smoothed, momentum-based movement. Floating instruction labels fade in/out based on your viewing angle relative to the anchored geometry. You can also use touch drag to rotate and pinch to zoom.

---

### Expert Mode
- Click the 3D bolt to select it — a `+` trigger appears
- Open the callout panel to add instructions:
  - **Button** (`+` icon): click a toolbar button to record it as an instruction
  - **Sketch** (pencil icon): draw on a full-screen transparent overlay (touch/stylus devices only; Ctrl+Shift+T to enable on desktop)
  - **Voice** (speaker icon): record a voice instruction via speech-to-text
- Button instructions get a pin icon for **AR anchoring** — click it to enter AR Anchoring Mode, then click a face on the 3D model to spatially anchor the instruction. Hovering over geometry in this mode highlights coplanar faces with a surface patch, wireframe edges, and a vertex marker.
- Hovering over a button instruction highlights the corresponding toolbar button with an orange pulse

### Novice Mode
- Click the bolt to see a `!` indicator if instructions exist
- Open the callout panel to view instructions (read-only)
- Click instruction labels to view them (sketch overlay, voice dialog with TTS playback, toolbar highlight)
- On mobile/tablet: anchored button instructions show an "AR" badge linking to the AR viewer

### Multi-Client Sync
- All instruction changes (add, delete, AR anchor), gaze cursors, and zoom windows sync in real-time across all connected clients
- Each client has its own independent panel open/close state, selected asset, camera position, and mode

---

## Embodied Interactions

This project implements four embodied interaction techniques, each designed around a different modality of human communication:

### 1. Multi-Modal Instruction Callouts (Expert → Novice)

The core interaction loop: an expert attaches instructions to the 3D asset, and a novice discovers and follows them.

**As Expert:**
1. Click the 3D bolt to select it — a `+` trigger appears near the model
2. Click `+` to open the callout panel
3. Add instructions using the row of type buttons:
   - **Button (+ icon):** Enters capture mode — a banner appears, toolbar buttons get outlined. Click any toolbar button (e.g. "Extrude", "Fillet") to record it as an instruction. The captured button name is stored and synced.
   - **Sketch (pencil icon):** Opens a full-screen transparent canvas overlay for freehand drawing. Supports undo, color picker, and stroke width. Touch/stylus devices only — press **Ctrl+Shift+T** to force-enable on desktop. The sketch is saved as an image.
   - **Voice (speaker icon):** Records a voice instruction using the Web Speech API (speech-to-text). A live transcript is displayed during recording. On unsupported browsers, falls back to a text input dialog.
4. Hover over a completed button instruction row to see the corresponding toolbar button pulse orange.
5. Delete instructions with the trash icon.

**As Novice:**
1. Click the bolt — a `!` indicator appears if instructions exist
2. Click `!` to open the callout panel (read-only)
3. Click any instruction label to view it:
   - **Button** instructions highlight the toolbar button with an orange pulse
   - **Sketch** instructions display the drawing as a full-screen overlay (click to dismiss)
   - **Voice** instructions open a dialog with the transcript and a **Play** button for text-to-speech playback

### 2. Gaze Sharing (Spacebar-Triggered)

A WOZ gaze-sharing prototype using the mouse pointer as a gaze proxy. Allows expert and novice to see each other's point of attention in real time.

**How to use:**
1. Open two browser tabs (or two devices) — set one to Expert mode and the other to Novice mode
2. On either tab, **hold the Space bar** to activate gaze sharing
3. A colored cursor appears at your pointer position:
   - **Expert cursor:** red with "Expert" label
   - **Novice cursor:** blue with "Novice" label
4. The cursor position is broadcast via WebSocket — the other tab sees the remote cursor in real time
5. Release Space to stop sharing. A hint at the bottom of the viewport reads "Hold Space to share gaze"

Pointer coordinates are normalized (0–1), so cursors scale correctly across different viewport sizes.

### 3. WOZ Zoom Window (Select + Drag + Z)

A WOZ prototype for gesture-based zoom navigation. Simulates a "pinch to zoom" gesture using the toolbar Select button and keyboard shortcut.

**How to use:**
1. Click the **Select** button in the left toolbar to enter selection mode (cursor becomes a crosshair, orbit controls are disabled)
2. **Click and drag** to draw a selection rectangle on the viewport
3. Press **Z** to open a floating zoom window showing a magnified live view of the selected region
4. Press **Esc** to close the zoom window and clear the selection
5. Click the Select button again to exit selection mode

The zoom window attempts to use the **Screen Capture API** for full-fidelity capture (including toolbar, sidebar, and all DOM content). If denied or unavailable, it falls back to capturing only the Three.js 3D viewport. The zoom window state (position and size) is synced to remote clients — both tabs see each other's zoom windows labeled with the sender's role.

### 4. AR Spatial Anchoring + Mobile AR Viewer

Allows the expert to spatially anchor a button instruction to a specific face on the 3D model. The novice can then view the instruction in an AR-like experience on a mobile device with gyroscope control.

**Anchoring (Expert, Desktop):**
1. Add a button instruction to the callout panel
2. Click the **pin icon** next to the instruction to enter AR Anchoring Mode
3. A banner appears: "AR Anchoring Mode — Click an edge, face, or vertex on the model"
4. Hover over the 3D model — coplanar face regions highlight with an orange surface patch, wireframe edges, and a white vertex marker at the cursor
5. Click a face to anchor the instruction. The anchor stores the world position, face normal, and instruction text
6. Press **Esc** to cancel without anchoring

**Viewing (Novice, Mobile):**
1. On a mobile/tablet device, switch to Novice mode and open the callout panel
2. Anchored button instructions show an **"AR"** badge — tap it to open the AR viewer (`/ar.html`)
3. On iOS/iPadOS, grant gyroscope permission when prompted (or tap "Skip" to use touch)
4. **Rotate your device** to orbit the camera around the 3D model — the gyroscope controls horizontal and vertical rotation with smoothed, momentum-based movement (EMA low-pass filter)
5. Floating instruction labels appear at their anchored 3D positions. Labels **fade in and out** based on your viewing angle relative to the anchored face normal — you must orient your device toward the correct face to see the label clearly
6. **Pinch to zoom** or use touch drag as an alternative to gyroscope rotation

---

## Repository Architecture

```
Embodied_CAD_Expert/
├── index.html                 Main app entry point
├── ar.html                    WOZ AR viewer page (mobile gyroscope)
├── vite.config.js             Vite config (HTTPS via basic-ssl, multi-page)
├── package.json               Dependencies and scripts
├── sync-server.js             WebSocket relay server (ws + wss)
│
├── public/
│   └── assets/
│       ├── PIULITA6.fbx                   3D bolt model
│       └── internal_ground_ao_texture.jpeg AO texture
│
└── src/
    ├── main.js                App entry — initializes all subsystems, wires sync callbacks
    ├── scene.js               Three.js scene, camera, lighting, OrbitControls
    ├── assetLoader.js         FBX model loading, material setup, highlight helpers
    ├── cadUI.js               Toolbar buttons, component tree, mode toggle
    ├── calloutSystem.js       Core callout system — selection, panel, instructions,
    │                          AR anchoring mode (flood-fill coplanar face highlighting),
    │                          novice/expert rendering
    ├── syncClient.js          Browser WebSocket client for state sync
    ├── arViewer.js            WOZ AR viewer — gyroscope with EMA smoothing + momentum,
    │                          spatial anchor labels, view-angle-dependent opacity
    ├── gazeSharing.js         Spacebar-triggered dual-cursor gaze sharing with sync
    ├── gestureNav.js          WOZ zoom window — Select button + region drag + Z key,
    │                          Screen Capture API with renderer fallback
    │
    ├── instructionTypes/
    │   ├── buttonInstruction.js   Button capture mode (record toolbar clicks)
    │   ├── sketchInstruction.js   Full-screen sketch canvas overlay
    │   └── voiceInstruction.js    Web Speech API voice recording + fallback
    │
    └── styles/
        └── main.css           Complete stylesheet (dark theme, all components)
```

### Key File Responsibilities

| File | What It Does |
|------|-------------|
| `main.js` | Imports and initializes all subsystems in order. Wires sync client callbacks to fan out remote state updates to callout, gaze, and zoom subsystems. |
| `scene.js` | Creates the Three.js scene with camera, renderer, lighting, grid, OrbitControls. Exports `getCamera()`, `getRenderer()`, `disableOrbitControls()`, `enableOrbitControls()`, `registerAnimationCallback()`. |
| `assetLoader.js` | Loads `PIULITA6.fbx` with texture, centers/scales it, provides highlight/unhighlight helpers. Falls back to primitive geometry if FBX fails. |
| `cadUI.js` | Builds the toolbar (decorative CAD operation buttons), component tree sidebar, and expert/novice mode toggle. Exports `getCurrentMode()`, `onModeChange()`, `highlightToolbarButton()`, `markComponentHasCallout()`. |
| `calloutSystem.js` | The largest and most complex module. Handles raycasting to select the asset, spawning/rendering the callout panel, instruction CRUD (add/delete), routing to instruction type modules, AR Anchoring Mode (flood-fill coplanar face selection with wireframe edges and vertex markers), and expert vs. novice rendering. |
| `buttonInstruction.js` | Manages button capture mode — shows a banner, outlines toolbar buttons, captures the clicked button name. |
| `sketchInstruction.js` | Full-screen transparent canvas overlay for freehand drawing with undo, color picker, stroke width. Touch/stylus required (Ctrl+Shift+T overrides on desktop). |
| `voiceInstruction.js` | Web Speech API voice-to-text recording with live transcript display. Falls back to a styled text input dialog on unsupported browsers. |
| `syncClient.js` | Browser-side WebSocket client. Connects to `ws://` or `wss://` depending on page protocol. Auto-reconnects with exponential backoff. |
| `sync-server.js` | Standalone Node.js WebSocket server. Stores latest state in memory, relays to all other clients. Runs both plain WS (port 3001) and secure WSS (port 3002) using Vite's self-signed cert. |
| `arViewer.js` | WOZ AR prototype. Loads the bolt model, renders hardcoded spatial anchor labels as DOM overlays, controls camera via device gyroscope (EMA smoothing, momentum/inertia, accumulated frame deltas for unbounded rotation) or touch/mouse fallback. View-angle-dependent label opacity. |
| `gazeSharing.js` | Spacebar-triggered dual-cursor gaze sharing. Tracks pointer position as a gaze proxy, broadcasts normalized (0–1) coordinates via WebSocket. Expert cursor is red, novice cursor is blue. Throttled to ~60 fps. |
| `gestureNav.js` | WOZ zoom window prototype. The Select toolbar button enters region selection mode (crosshair cursor, orbit controls disabled). After dragging a rectangle, pressing Z opens a magnified floating zoom window. Prefers Screen Capture API (captures all DOM); falls back to renderer canvas. Zoom state is synced to remote clients. |
| `main.css` | All styles for every component: layout, toolbar, callout panel, instruction rows, AR anchor badges, sketch overlay, voice dialog, gaze cursors, selection rectangles, zoom windows. |


### Use of AI
Claude code was used to generate the broad architecture of the implementation using Three.js. The prompts were separated into 13 markdown files that contained the necessary context for Claude to create the project skeleton. Those prompts are available in the `/prompts/` folder.
