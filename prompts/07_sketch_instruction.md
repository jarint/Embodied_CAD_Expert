# 07 — Sketch Instruction Type

## Overview

This file implements `src/instructionTypes/sketchInstruction.js`. It handles the full-screen sketch overlay workflow:

1. Expert clicks the Sketch (pen) icon in an empty instruction row
2. A transparent canvas overlay covers the **entire screen** — including the 3D viewport, toolbar, sidebar, and all UI elements
3. The expert draws freehand using pointer events (mouse or stylus)
4. A floating toolbar at the bottom provides: colour picker, stroke width slider, Undo, Clear, Cancel, and Confirm buttons
5. Confirming saves the canvas as a base64 PNG data URL
6. The instruction slot shows "Sketch N"

**Device restriction:** The Sketch button is grayed out on non-touch devices (R6). For desktop testing, **Ctrl+Shift+T** temporarily enables it.

---

## File: `src/instructionTypes/sketchInstruction.js`

### Architecture

- `activateSketchMode(assetName, slotIndex, onSave)` — disables orbit controls, creates a full-screen transparent canvas overlay and a floating sketch toolbar
- Drawing uses pointer events (`pointerdown`, `pointermove`, `pointerup`) for mouse/stylus compatibility
- Strokes are stored in a `paths` array for undo support — each path is an array of `{ x, y, color, width }` points
- Confirm exports the canvas to a data URL via `canvas.toDataURL()` and fires the callback
- Cancel and Escape destroy the overlay without saving
- Ctrl+Z triggers undo

### Exports

- `activateSketchMode(assetName, slotIndex, onSave)`

---

## Integration Notes

- `calloutSystem.js` calls `activateSketchMode()` and receives the `imageDataURL` via callback
- The instruction is stored as: `{ type: 'sketch', data: { imageDataURL }, label: 'Sketch N' }`
- Viewing a sketch instruction (by clicking its label) displays the image as a full-screen overlay, handled by `calloutSystem.js`

---
