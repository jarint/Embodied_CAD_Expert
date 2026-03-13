# 06 — Button Instruction Type

## Overview

This file implements `src/instructionTypes/buttonInstruction.js`. It handles the "button capture mode" workflow:

1. Expert clicks the Button (`+`) icon in an empty instruction row
2. A banner appears: "Click a toolbar button to record it"
3. All toolbar buttons get a dashed outline indicating they are capturable
4. Expert clicks any toolbar button in the left panel
5. The toolbar button's name is recorded into the instruction slot
6. Capture mode exits

After capture, the filled instruction row (rendered by `calloutSystem.js`) displays the button name, a pin icon for AR anchoring, and a trash icon. Hovering highlights the corresponding toolbar button with a pulsing orange border. These behaviours are handled in `calloutSystem.js`, not this file.

---

## File: `src/instructionTypes/buttonInstruction.js`

### Architecture

- `activateButtonCapture(assetName, slotIndex, onCapture)` — enters capture mode. Shows a banner, adds `.capture-mode-active` class to all toolbar buttons, attaches a click handler to the toolbar container. When a button is clicked, calls the callback with the `toolName` and exits capture mode.
- `deactivateButtonCapture()` — cleans up: removes banner, removes visual indicators, removes listeners.
- Escape key cancels capture mode.

### Exports

- `activateButtonCapture(assetName, slotIndex, onCapture)`
- `deactivateButtonCapture()`

---

## Integration Notes

- `calloutSystem.js` calls `activateButtonCapture()` and receives the `toolName` via callback
- The instruction is stored as: `{ type: 'button', data: { toolName }, label: 'Button: <name>', arAnchor: null }`
- The `arAnchor` field is populated later if the expert uses AR Anchoring Mode (handled in `calloutSystem.js`)

---
