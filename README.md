# Embodied CAD Expert

A simulated CAD expertise-sharing system built for **CPSC 581 — HCI II (Winter 2026, University of Calgary)**. An expert user attaches multi-modal instruction callouts (button, sketch, voice) to a 3D bolt model rendered with Three.js, and a novice user views and interacts with those instructions. The system supports real-time multi-client sync over WebSocket and a WOZ AR viewer for spatially anchored instructions on mobile devices.

This is **not** a real CAD application. The toolbar buttons are decorative. There is no persistent backend. Both expert and novice views exist in the same browser session, toggled via a mode switch.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Running the Project](#running-the-project)
4. [Accessing from Other Devices (iPad / Phone)](#accessing-from-other-devices-ipad--phone)
5. [UI Overview](#ui-overview)
6. [Repository Architecture](#repository-architecture)
7. [Where to Add Your Features](#where-to-add-your-features)
8. [Branching and PR Rules](#branching-and-pr-rules)

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
https://192.168.x.x:3000/   ← use this for iPad/phone
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

### AR Viewer (Mobile Only) @MINHAZ

The AR viewer is at **`/ar.html`** and is designed for phones and tablets with a gyroscope. On mobile, anchored button instructions show a "AR" badge in novice mode that links to this page.

To test directly: `https://192.168.x.x:3000/ar.html`

On iOS/iPadOS, you'll be prompted to enable gyroscope access — tap **Enable Gyroscope** and grant the permission. Rotating the device orbits the camera around the 3D model. Floating instruction labels fade in/out based on your viewing angle relative to the anchored geometry.

**Minhaz**: You will need to work on this more. Right now I've harcoded some button instructions to be anchored to the bolt. The camera movement works, but only loosely. It's currently less responsive to movement than we would like it to be for a seamless experience.
---

## UI Overview

The interface uses a dark CAD aesthetic (background `#1e1e1e`, accent `#e07b00`) and is divided into:

```
+------------------------------------------------------------------+
|  Top Bar: App title | [Expert] [Novice] mode toggle | Sync status |
+--------+-------------------------------------------+-------------+
| Left   |                                           | Right       |
| Tool-  |          3D Viewport                      | Sidebar:    |
| bar    |          (Three.js)                        | Component   |
| (CAD   |                                           | Tree        |
| ops)   |     [+] callout trigger (expert)           |             |
|        |     [!] callout indicator (novice)         |             |
|        |     ┌─────────────────┐                    |             |
|        |     │ Callout Panel   │                    |             |
|        |     │ - instructions  │                    |             |
|        |     │ - add/delete    │                    |             |
|        |     └─────────────────┘                    |             |
+--------+-------------------------------------------+-------------+
|  Status Bar: message | mode | coordinates                        |
+------------------------------------------------------------------+
```

### Expert Mode
- Click the 3D bolt to select it — a `+` trigger appears
- Open the callout panel to add instructions:
  - **Button** (`+` icon): click a toolbar button to record it as an instruction
  - **Sketch** (pencil icon): draw on a full-screen transparent overlay (touch/stylus devices only; Ctrl+Shift+T to enable on desktop)
  - **Voice** (speaker icon): record a voice instruction via speech-to-text
- Button instructions get a pin icon for **AR anchoring** — click it to enter AR Anchoring Mode, then click a face on the 3D model to spatially anchor the instruction
- Hovering over a button instruction highlights the corresponding toolbar button with an orange pulse

### Novice Mode
- Click the bolt to see a `!` indicator if instructions exist
- Open the callout panel to view instructions (read-only)
- Click instruction labels to view them (sketch overlay, voice dialog with TTS playback, toolbar highlight)
- On mobile/tablet: anchored button instructions show a "AR" badge linking to the AR viewer

### Multi-Client Sync
- All instruction changes (add, delete, AR anchor) sync in real-time across all connected clients
- Each client has its own independent panel open/close state, selected asset, and camera position

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
    ├── main.js                App entry — initializes all subsystems
    ├── scene.js               Three.js scene, camera, lighting, OrbitControls
    ├── assetLoader.js         FBX model loading, material setup, highlight helpers
    ├── cadUI.js               Toolbar buttons, component tree, mode toggle
    ├── calloutSystem.js       Core callout system — selection, panel, instructions,
    │                          AR anchoring mode, novice/expert rendering
    ├── syncClient.js          Browser WebSocket client for state sync
    ├── arViewer.js            WOZ AR viewer — gyroscope, anchor labels, opacity
    ├── gazeSharing.js         [STUB] Gaze sharing — not yet implemented
    ├── gestureNav.js          [STUB] Gesture navigation — not yet implemented
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
| `main.js` | Imports and initializes all subsystems in order. Wire up sync client callbacks. |
| `scene.js` | Creates the Three.js scene with camera, renderer, lighting, grid, OrbitControls. Exports `getCamera()`, `getRenderer()`, `disableOrbitControls()`, `enableOrbitControls()`, `registerAnimationCallback()`. |
| `assetLoader.js` | Loads `PIULITA6.fbx` with texture, centers/scales it, provides highlight/unhighlight helpers. Falls back to primitive geometry if FBX fails. |
| `cadUI.js` | Builds the toolbar (decorative CAD operation buttons), component tree sidebar, and expert/novice mode toggle. Exports `getCurrentMode()`, `onModeChange()`, `highlightToolbarButton()`, `markComponentHasCallout()`. |
| `calloutSystem.js` | The largest and most complex module. Handles raycasting to select the asset, spawning/rendering the callout panel, instruction CRUD (add/delete), routing to instruction type modules, AR Anchoring Mode (geometry-level face selection), and expert vs. novice rendering. |
| `buttonInstruction.js` | Manages button capture mode — shows a banner, outlines toolbar buttons, captures the clicked button name. |
| `sketchInstruction.js` | Full-screen transparent canvas overlay for freehand drawing with undo, color picker, stroke width. Touch/stylus required (Ctrl+Shift+T overrides on desktop). |
| `voiceInstruction.js` | Web Speech API voice-to-text recording with live transcript display. Falls back to a styled text input dialog on unsupported browsers. |
| `syncClient.js` | Browser-side WebSocket client. Connects to `ws://` or `wss://` depending on page protocol. Auto-reconnects with exponential backoff. |
| `sync-server.js` | Standalone Node.js WebSocket server. Stores latest state in memory, relays to all other clients. Runs both plain WS (port 3001) and secure WSS (port 3002). |
| `arViewer.js` | WOZ AR prototype. Loads the bolt model, renders hardcoded spatial anchor labels as DOM overlays, controls camera via device gyroscope or touch/mouse fallback. View-angle-dependent label opacity. |
| `gazeSharing.js` | **STUB** — spacebar-triggered dual-cursor gaze sharing. Not yet implemented. |
| `gestureNav.js` | **STUB** — MediaPipe Hands gesture navigation. Not yet implemented. |
| `main.css` | All styles for every component: layout, toolbar, callout panel, instruction rows, AR anchor badges, sketch overlay, voice dialog, gaze cursors, webcam container. |

---

## Where to Add Your Features

### Gaze Sharing (`src/gazeSharing.js`) @KARAN

Currently a stub. This module should implement spacebar-triggered dual-cursor gaze sharing between expert and novice views. It is already imported and initialized in `main.js` — just fill in the implementation. Relevant CSS classes (`.gaze-cursor`, `.gaze-cursor-label`, `#gaze-hint`) are already defined in `main.css`.

### Gesture Navigation (`src/gestureNav.js`) @PAULA

Currently a stub. This module should implement MediaPipe Hands gesture-based navigation (WOZ prototype). Already imported and initialized in `main.js`. Relevant CSS (`#webcam-container`) is already in `main.css`. MediaPipe should be loaded via CDN.

### Adding New Instruction Types

To add a new instruction type:
1. Create a new file in `src/instructionTypes/` (e.g., `annotationInstruction.js`)
2. Export an activation function following the pattern of the existing modules
3. Import it in `calloutSystem.js` and add a new case in `handleCalloutClick`
4. Add a button for it in `renderEmptyInstructionRow`
5. Add view logic in `viewInstruction`

### Adding New 3D Assets

Place `.fbx` files in `public/assets/`. Modify `assetLoader.js` to load additional models. The callout system keys instructions by asset name, so multiple assets are supported — each gets its own callout store entry.

### Modifying the AR Viewer

The WOZ anchor data in `arViewer.js` is hardcoded in the `WOZ_ANCHORS` array. To make it dynamic (receiving real anchors from the desktop session via WebSocket), connect it to the sync system by importing `syncClient.js` and listening for state updates that include `arAnchor` data.

---

## Branching and PR Rules

### Branch Naming

All branches must follow the convention:

```
yourname/feature-name
```

Examples:
- `karan/gaze-sharing`
- `paula/gesture-navigation`
- `jarin/annotation-instruction`
- `minhaz/ar-live-sync`

### One Branch Per Feature

Do **not** create a single branch for all your work. Each distinct feature or fix should be on its own branch. This keeps PRs small, reviewable, and easy to merge.

Good:
```
jarin/gaze-sharing
jarin/gaze-cursor-styling
jarin/gaze-keyboard-shortcut
```

Bad:
```
jarin/all-my-changes
```

### Pull Request Target

All pull requests must target the **`integration`** branch — never `main` directly.

```
your-feature-branch  →  PR  →  integration
```

### PR Guidelines

- Give your PR a clear title describing the feature or fix
- In the description, list what changed and how to test it
- Keep PRs focused — one feature per PR
- If your changes touch `calloutSystem.js` or `main.css`, mention it explicitly in the PR description since these are shared files most likely to cause merge conflicts
- Test your changes on both desktop (Chrome) and mobile (iPad/phone) before opening the PR
- Request at least one review from a group member before merging

### Workflow Summary

```bash
# 1. Make sure you're on the latest integration branch
git checkout integration
git pull origin integration

# 2. Create your feature branch
git checkout -b yourname/feature-name

# 3. Make your changes, commit often
git add <files>
git commit -m "Add gaze cursor rendering"

# 4. Push your branch
git push -u origin yourname/feature-name

# 5. Open a PR on GitHub targeting 'integration'
# 6. Get it reviewed and merged
```
