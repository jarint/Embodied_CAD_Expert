# CLAUDE.md

## What This Project Is

This is a **simulated CAD environment** built as a web application. It allows an expert user to share CAD knowledge with a novice through embodied interactions — specifically by attaching persistent, multi-modal instruction callouts to a 3D bolt model rendered with Three.js.

It is **not** a real CAD application. The toolbar buttons are decorative. There is no backend. Both expert and novice views exist in the same browser session, toggled via a mode switch.

## Tech Stack

- **Three.js** (latest stable via npm) — 3D rendering
- **Vite** — build tool
- **Vanilla JavaScript** (ES modules) — no React, no Vue, no frameworks
- **Plain CSS** — dark theme, orange accents
- **Web Speech API** — voice-to-text
- **No backend** — all state is in-browser

## Where to Start

All implementation instructions are numbered markdown files (`00_overview.md` through `11_mobile_ar.md`). Each describes the architecture and responsibilities of one module. Read and implement them in order.

## Project Structure

```
project-root/
├── public/assets/          ← FBX model and texture
├── src/
│   ├── main.js             ← Entry point
│   ├── scene.js            ← Three.js scene setup
│   ├── assetLoader.js      ← FBX loading and material
│   ├── cadUI.js            ← Toolbar, sidebar, mode toggle
│   ├── calloutSystem.js    ← Core callout logic
│   ├── instructionTypes/
│   │   ├── buttonInstruction.js
│   │   ├── sketchInstruction.js
│   │   └── voiceInstruction.js
│   ├── gazeSharing.js      ← STUB
│   ├── gestureNav.js       ← STUB
│   └── styles/main.css
├── index.html              ← Main app
├── ar.html                 ← WOZ AR viewer page
├── vite.config.js
└── package.json
```

## Important Rules

- **No React, no Vue, no frameworks.** Vanilla JS with ES module imports only.
- **No localStorage or sessionStorage.** All state lives in JS variables during the session.
- **WOZ features** (gesture nav, mobile AR) must be marked with `// WOZ PROTOTYPE` comments.
- **Dark theme colours:** background `#1e1e1e`, panels `#2a2a2a`, borders `#3a3a3a`, text `#e0e0e0`, accent `#e07b00`.
