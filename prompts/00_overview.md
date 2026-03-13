# 00 — Master Overview

## Project Summary

This project is a **simulated CAD environment** built as a web application. Its purpose is to allow an expert user to synchronously share CAD knowledge with a novice user through embodied interactions — specifically, by attaching persistent, multi-modal instruction callouts to individual components of a 3D CAD asset.

The system is **not** a real CAD application. It simulates the look and feel of one (toolbar, panels, asset viewport, component tree) while supporting a novel instruction-authoring workflow on top of it.

The only 3D asset used is `PIULITA6.fbx` (a bolt/screw model), rendered using Three.js with an ambient occlusion texture (`internal_ground_ao_texture.jpeg`).

---

## Technology Stack

| Component | Technology |
|---|---|
| 3D Rendering | Three.js (latest stable via npm) |
| Asset Loading | `FBXLoader` from `three/examples/jsm/loaders/FBXLoader.js` |
| Build Tool | Vite |
| Language | Vanilla JavaScript (ES modules) — **no React, no Vue** |
| Styling | Plain CSS, dark CAD-aesthetic theme |
| Backend | None — all state is managed in-browser |
| Speech | Web Speech API (`SpeechRecognition`) |
| Gesture (WOZ) | MediaPipe Hands via CDN |
| AR (WOZ) | Three.js + `DeviceOrientationControls` |

---

## Instruction Files

The following instructions files can be used to build out the base implementation:

1. `01_project_setup.md` — Vite scaffold, dependencies, folder structure
2. `02_threejs_scene.md` — Three.js scene, camera, lights, controls, render loop
3. `03_asset_loading.md` — FBX loading, AO texture, centering/scaling
4. `04_cad_ui.md` — Full CAD UI shell (toolbar, sidebar, top bar, status bar)
5. `05_callout_system.md` — Node-based callout system end-to-end
6. `06_button_instruction.md` — Button capture mode detail
7. `07_sketch_instruction.md` — Full-screen sketch overlay detail
8. `08_voice_instruction.md` — Web Speech API voice instruction detail
9. `09_gaze_sharing.md` — Spacebar-triggered dual-cursor gaze sharing (STUB)
10. `10_gesture_nav.md` — MediaPipe Hands WOZ gesture navigation (STUB)
11. `11_mobile_ar.md` — Separate AR page with DeviceOrientationControls

Each file is self-contained but may reference dependencies from earlier files.

---

## System Requirements

| # | Requirement | Impl. Status |
|---|---|---|
| R1 | Node-based instruction callouts | **Real** — full implementation |
| R2 | Button instruction type | **Real** — full implementation |
| R3 | Sketch instruction type | **Real** — full implementation |
| R4 | Voice-to-text instruction type | **Real** — full implementation |
| R5 | Instruction management (add/delete) | **Real** — full implementation |
| R6 | Device-aware UI (sketch grayed out on non-touch) | **Real** — full implementation |
| R7 | Persistent novice access | **Real** — full implementation |
| R8 | Gaze sharing (spacebar-triggered cursors) | **WOZ** — simulated dual cursors in same browser |
| R9 | Gesture-based interface navigation | **WOZ** — MediaPipe Hands prototype |
| R10 | Mobile AR instruction playback | **WOZ** — gyroscope-based AR viewer |

---

## What NOT to Implement

- Real CAD operations (extrude, fillet, etc.) — toolbar buttons are decorative
- Real networking between expert and novice — simulated via mode toggle
- Real voice call — assumed to exist
- Access control handshake — assumed granted
- Multi-user configuration
- Any backend server
- 

---

## Visual Design Language

- **Background:** `#1e1e1e` (dark gray)
- **Panel backgrounds:** `#2a2a2a`
- **Panel borders:** `#3a3a3a`
- **Text colour:** `#e0e0e0` (light gray)
- **Accent colour:** `#e07b00` (orange)
- **Danger/delete:** `#e04040` (red-orange)
- **Font:** System sans-serif stack

---
