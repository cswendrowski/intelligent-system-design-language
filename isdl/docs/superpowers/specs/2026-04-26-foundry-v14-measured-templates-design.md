# Foundry v14 Compatibility — Measured Templates

**Date:** 2026-04-26
**Branch:** visual-overhaul
**Scope:** Measured-template placement only. A broader v14 audit is deferred.

## Context

Foundry v14's release notes announce the removal of the `MeasuredTemplate` Document type in favor of an expanded Scene Regions framework. In practice, the *stable v14 release today* still ships `MeasuredTemplate` as a deprecation shim:

- `foundry.canvas.placeables.MeasuredTemplate` is still extendable.
- `CONFIG.MeasuredTemplate.documentClass` still exists.
- `canvas.scene.createEmbeddedDocuments("MeasuredTemplate", ...)` still persists templates.

Confirmed by inspecting `dnd5e` master (`system.json` → `compatibility: { minimum: "13.347", verified: "14" }`), which still extends `foundry.canvas.placeables.MeasuredTemplate` and still calls `createEmbeddedDocuments("MeasuredTemplate", ...)` to persist on confirm. The diff between their pre-v14 and v14-verified versions is two surgical patches.

A full Region-based rewrite will eventually be required when Foundry actually drops the shim (likely a future v14.x or v15). That work is out of scope here and is a candidate for the deferred broader v14 audit.

## Goal

Make ISDL-generated systems run on Foundry v14 without breaking measured-template placement, while preserving v12/v13 behavior unchanged.

## Non-Goals

- Region-based replacement for MeasuredTemplate.
- Bumping `system.json` `verified` to 14.
- Any other v14 compatibility work (ApplicationV2 changes, data model changes, etc.).
- ISDL grammar, AST, or datamodel changes.
- Changes to Vue components, chat cards, sheet button wiring, or the init hook registration.

## Approach

Single file touched: `src/cli/components/measured-template-preview.ts`. No file split, no dispatcher, no new generated files. The generated `measured-template-preview.mjs` continues to be the only placeables file and still extends MeasuredTemplate via the existing namespace fallback (`foundry.canvas?.placeables?.MeasuredTemplate ?? MeasuredTemplate`), which already covers v12 vs v13/v14 namespacing.

Two surgical runtime branches keyed on `game.release.generation`, mirroring the dnd5e v14-verified port.

### Patch 1 — `_finishPlacement`

In v14, the layer's `_onDragLeftCancel` is no longer the right way to clear the preview container (the underlying layer is now Region-based). Use the v14 method when on v14+:

```js
async _finishPlacement(event) {
  if (game.release.generation < 14) this.layer._onDragLeftCancel(event);
  else this.layer.clearPreviewContainer();
  canvas.stage.off("mousemove", this.#events.move);
  canvas.stage.off("mouseup", this.#events.confirm);
  canvas.app.view.oncontextmenu = null;
  canvas.app.view.onwheel = null;
  if (this.#hoveredToken) {
    this.#hoveredToken._onHoverOut(event);
    this.#hoveredToken = null;
  }
  this.#initialLayer.activate();
  if (this.#sheetMinimized) await this.actorSheet?.maximize();
}
```

### Patch 2 — `drawPreview` sheet minimize handling

ApplicationV2 sheets in v14 expose a different window structure. Track whether we actually minimized the sheet so that `_finishPlacement` only restores it when we minimized it ourselves, and avoid attempting to minimize an ApplicationV2 sheet that lacks a `windowId`:

```js
// Add a new private field
#sheetMinimized = false;

// In drawPreview()
const sheet = this.actorSheet;
const { windowId } = (sheet?.parent ?? sheet)?.window ?? {};
this.#sheetMinimized = (game.release.generation < 14 || !windowId) && !sheet?._minimized;
if (this.#sheetMinimized) sheet?.minimize();
```

The existing unconditional `this.actorSheet?.minimize()` line is replaced by the gated version above. The `maximize()` call in `_finishPlacement` (Patch 1) is also gated on `#sheetMinimized`.

### Inline comment

Add one short comment in the generated file noting that this is a deprecation-window approach:

```js
// MeasuredTemplate is deprecated in Foundry v14 in favor of Scene Regions.
// This implementation works on v12-v14 by extending the v14 deprecation shim.
// A Region-based rewrite will be needed when the shim is removed.
```

## What Does Not Change

- Grammar (`MeasuredTemplateField`)
- AST types
- Datamodel schema
- Vue components (`vue-measured-template.ts`, `vue-mixin.ts`, `vue-base-components-generator.ts`, `vue-generator.ts`)
- Sheet application generator wiring
- Chat card generator
- Method generator
- Datatable generators
- Active effect sheet generator
- Derived data generator
- Init hook (`game.system.measuredTemplatePreviewClass = MeasuredTemplatePreview`)
- `system.json` (`minimum: 12, verified: 13`)

## Testing

- `npm run build` must pass.
- Manual smoke test on Foundry v13 with a generated system: existing template-placement behavior unchanged.
- Manual smoke test on Foundry v14 with a generated system: clicking a measured-template button shows the preview, mouse-following + wheel-rotate works, left-click confirms placement, right-click cancels, sheet minimizes/restores correctly, no console errors.
- No automated tests added — this is canvas/UI code with no existing test coverage; matches project convention.

## Future Work (Out of Scope)

- Full Region-based rewrite once Foundry drops the MeasuredTemplate shim. Likely structure at that point: three-file split (`measured-template-preview.mjs` dispatcher + legacy + v14-region implementations) keyed on `game.release.generation`.
- Broader v14 audit covering ApplicationV2 changes, data model changes, and other potential breaks across the generators.

## References

- [Foundry Issue #13089 — MeasuredTemplate → Scene Regions](https://github.com/foundryvtt/foundryvtt/issues/13089)
- [Foundry v14 API — Region](https://foundryvtt.com/api/classes/foundry.canvas.placeables.Region.html)
- [dnd5e ability-template.mjs (v14-verified, master)](https://github.com/foundryvtt/dnd5e/blob/master/module/canvas/ability-template.mjs)
- Current ISDL implementation: `src/cli/components/measured-template-preview.ts`
