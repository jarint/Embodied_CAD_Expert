# 11 — Mobile AR Instruction Playback (WOZ Prototype)

## Overview

This file implements the mobile AR viewer — a **Wizard of Oz prototype** (R10) on a separate page (`/ar.html`). It displays the same `PIULITA6.fbx` bolt model using Three.js and simulates an AR viewing experience by responding to the phone's gyroscope/accelerometer via custom device orientation controls.

**Key feature: Spatially anchored instruction labels.** The AR page displays floating text labels pinned to specific positions on the 3D asset geometry. These labels represent Button instructions that the expert has spatially anchored using AR Anchoring Mode on the desktop. Each label shows the instruction text (e.g. "Extrude this face") and is positioned at the exact 3D coordinate where the expert placed it.

**View-angle-dependent opacity:** Labels fade out when the camera angle makes the anchored geometry ambiguous (edge-on or occluded) and reach full opacity when the novice's viewpoint aligns well with the anchored face. This reinforces the design argument that the novice must physically orient themselves to receive the instruction clearly.

**This is NOT real AR.** It does not use the device camera, WebXR, or AR.js. It is a WOZ prototype that simulates the experience. In a full implementation, anchors would be received in real time from the desktop session via WebSocket. The current implementation hardcodes them for demonstration.

---

## Design Rationale

Include this as a block comment at the top of `src/arViewer.js`:

---

## Spatially Anchored Instruction Labels

### Create Labels from Hardcoded Anchors

Each anchor becomes a floating HTML-overlay label (implemented as a CSS2DObject-style approach using DOM elements positioned via 3D-to-2D projection each frame) OR a Three.js Sprite with a canvas texture. We use **DOM overlay labels** for crisp text rendering on mobile.

### Per-Frame Label Update (Projection + View-Angle Opacity)

Every frame, project each anchor's 3D world position to screen coordinates and update the DOM element position. Also compute the dot product between the anchor's face normal and the camera-to-anchor direction to determine opacity.

---

## Accessing the AR Page

The AR page is at `/ar.html`. During development with Vite, accessible at `http://localhost:3000/ar.html`.

To test on mobile:
1. Find your computer's local IP (e.g., `192.168.1.100`)
2. Ensure both devices are on the same WiFi network
3. Start Vite with `npm run dev -- --host` to expose on all interfaces
4. On mobile, navigate to `http://192.168.1.100:3000/ar.html`
5. On iOS, tap "Enable AR Rotation" to grant gyroscope permission
6. Rotate the phone to orbit around the bolt model
7. Observe the floating instruction labels — they fade in and out as you change viewing angle

---

## Tuning the WOZ Anchor Positions

The hardcoded `WOZ_ANCHORS` positions are approximate. After the model loads successfully, you may need to adjust the `worldPosition` values to align with visible features of the bolt. Use the following approach:

1. Open the AR page on desktop
2. Drag to rotate and observe where labels appear relative to the model
3. Adjust the `x`, `y`, `z` values in `WOZ_ANCHORS` until labels sit on recognizable geometry (e.g., the hex head top face, a shaft edge, a thread vertex)
4. Also adjust `worldNormal` to point outward from the geometry so the opacity ramp works correctly

---
