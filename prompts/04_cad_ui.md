# 04 — CAD UI Layout

## Overview

This file implements `src/cadUI.js` and the full `src/styles/main.css`. It creates the complete simulated CAD interface: toolbar panel with labelled buttons, component tree sidebar, top bar with mode toggle, and status bar. All styled with a dark CAD-aesthetic theme using orange accents.

---

## File: `src/styles/main.css`

The stylesheet provides a complete dark CAD theme using CSS custom properties (variables). It covers:

- **Reset and base** — box-sizing, dark background, system sans-serif font
- **Top bar** — flex layout, mode toggle buttons (active state uses accent orange)
- **Left toolbar** — narrow column of icon+label buttons with hover/active/highlighted states. The `.highlighted` class triggers a pulsing orange border animation for button instruction hover feedback.
- **Viewport container** — flex-growing center area for the Three.js canvas
- **Right sidebar** — component tree with indent, selection highlighting, and callout indicator dot
- **Status bar** — message, mode, and monospace coordinates
- **Callout system styles** — trigger button (`+`), callout panel, instruction rows (empty and filled), delete buttons, add-instruction area, connector SVG, novice indicator
- **Sketch overlay** — fixed full-screen canvas, floating toolbar with color picker, stroke width, confirm/cancel
- **Voice dialog** — positioned dialog for transcript display, recording indicator with pulsing red dot
- **Gaze cursors** — positioned dots with role labels (expert orange, novice blue), gaze hint bar
- **Webcam container** — fixed-position mirrored video feed for gesture nav
- **Utility classes** — `.hidden`, `.fade-in` animation, capture mode banner

---

## File: `src/cadUI.js`

### Architecture

The module manages all static UI elements:

1. **Toolbar buttons** — created from a `TOOLBAR_BUTTONS` array of definitions (id, icon, label). Includes: Select, Move, Rotate, Scale, Extrude, Fillet, Chamfer, Revolve, Sketch, Line, Circle, Rect, Measure, Section, Mirror — separated by dividers. Clicking a toolbar button is decorative (no real CAD operation) but adds the `.active` class for visual feedback.

2. **Component tree** — created from a `COMPONENT_TREE` array with Assembly (root) and Bolt Body (child, linked to asset ref `'CAD_ASSET_BOLT'`).

3. **Mode toggle** — Expert/Novice toggle via `setMode()`, updates button active states, status bar, and fires registered callbacks.

### Exports

- `initCADUI()`
- `getCurrentMode()` — returns `'expert'` or `'novice'`
- `onModeChange(callback)` — registers a mode change listener
- `highlightToolbarButton(toolName)` — adds `.highlighted` class to the matching toolbar button
- `clearToolbarHighlights()` — removes all toolbar highlights
- `markComponentHasCallout(assetRef, hasCallout)` — toggles the callout indicator dot in the component tree

---
