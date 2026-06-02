# Roll Visualizer — Phase 2 Design (live prompt-input reactivity)

**Date:** 2026-06-01
**Status:** Approved for implementation
**Builds on:** `2026-06-01-roll-visualizer-design.md` (Phase 1)

## Summary

Let a `rollVisualizer` placed inside a prompt reference the prompt's **own input
fields** and update its chart **live** as the user edits those inputs — e.g.
"how many dice will this attack roll?" previewed before committing.

A new `input.X` accessor names a sibling prompt input. `self.X` continues to mean
the rolling document. The visualizer's chart reacts to `input.X` changes for free,
because the prompt's Vue context is reactive and the component already watches its
`:rollData`.

## Background / why this is small

The Phase 1 spike established:

- There is **no existing way** for a field's expression to reference a sibling
  prompt input. `self.X` is an `Access` that resolves against the document
  (`isdl-scope-provider.ts` `getPropertyAccessScope` → `getScopesForDocument`),
  and prompt inputs are never in that scope.
- The "calculated `value:` fields are seeded once at prep" limitation
  (`vue-prompt-sheet-class-generator.ts`) applies to `number`/`string` value
  fields, **not** the rollVisualizer — it gets its data from its own `:rollData`
  template binding.
- Prompt inputs write to a **Vue-reactive** context: the prompt app's context is
  Vue `data()` (deeply reactive), inputs `setProperty(props.context, systemPath, v)`
  into it, and the generated prompt app explicitly harvests from "the live reactive
  context the inputs actually wrote to." A binding reading
  `context.system.<promptPath>.<field>` therefore recomputes on edit.

So Phase 2 is **scope + codegen**, with the component unchanged. Reactivity falls
out of the existing `:rollData` watch.

## Authoring syntax

`input.X` references a sibling prompt input; `self.X` still means the document.
Distinct forms → no collision, explicit, mirrors `parent.`/`target.`:

```isdl
action StrikePreview {
    fleeting opts = prompt(label: "Strike Roll") {
        number Boons(min: 0)
        rollVisualizer LivePreview(value: (input.Boons + 1)d6 + self.WeaponBonus)
    }
}
```

## Design

### 1. Grammar (`intelligent-system-design-language.langium`)

New accessor node, added to `PrimitiveExpression`:

```langium
PromptInputAccess:
    "input." property=[Property:ID] ("." subProperties+=("Name" | "number" | "die" | ID))*;
```

Regenerate AST (`npm run langium:generate`).

### 2. Scope (`isdl-scope-provider.ts`)

Add a branch in `getPropertyAccessScope` for `isPromptInputAccess(container)`:
resolve `property` against the **containing prompt's** body fields (the sibling
inputs) — i.e. the `Prompt` found via `AstUtils.getContainerOfType(container, isPrompt)`,
scoping over its `body` properties. Leaves `self.`/document scope untouched.

### 3. Validation (`...-validator.ts`)

- `input.X` is only valid inside a prompt → error otherwise.
- For Phase 2, reactive `input.` is only wired for `rollVisualizer`. Reject
  `input.X` used outside a rollVisualizer value with a clear message (those other
  fields are seeded once at prep and would not react — avoid a silent footgun).
  Lifting this is a separate future feature.

### 4. Codegen (`method-generator.ts`)

The dice-formula compilers (`translateDiceParts` / `translateDiceData`, already
module-exported) gain a `PromptInputAccess` case:

- `translateDiceParts(PromptInputAccess)` → the `@<field>` ref token (labels
  stripped under `noLabels`), matching the document-access shape so the ref key
  lines up with the data key.
- `translateDiceData(PromptInputAccess, …)` → `"<field>": context.system.<promptPath>.<field> ?? 0`,
  where `<promptPath>` = `<action><variable>` lowercased (the same path the prompt
  generator binds inputs to, e.g. `vueprompttestfirst`). This is the **live
  reactive** path.

`compileVisualizerFormula` already iterates the value expression through these
compilers, so document refs (`self.X` → `context.object.system.x`) and input refs
(`input.X` → `context.system.<promptPath>.x`) compose in one formula. The
`<promptPath>` is derived from the field's containing action + prompt variable.

Scope (numeric-first): support numeric prompt inputs (`number`, and numeric
results). `dice`/`self<attribute>` inputs with subproperties reuse the same
machinery but are a follow-up if they get fiddly.

### 5. Component / reactivity

No change. `vue-roll-visualizer.ts` already does
`watch(() => [props.formula, JSON.stringify(props.rollData || {})], recompute)`.
With `:rollData` now reading `context.system.<promptPath>.x` (reactive), editing the
input recomputes the chart (exact convolution or simulation as in Phase 1).

## Testing

- **Parsing/validation:** `input.X` parses; accepted in a prompt rollVisualizer;
  rejected outside a prompt; rejected in a non-rollVisualizer prompt field.
- **Codegen check:** generated prompt markup binds `:rollData` to
  `context.system.<promptPath>.<field>` for `input.` refs (and still
  `context.object.system.<field>` for `self.` refs).
- **Live verification (gate):** instantiate the generated `…PromptApp` with a
  no-op `promptResolve`, `render(true)`, edit the input field, and confirm the
  chart's average/curve update live.
- **Kitchensink QA:** add `rollVisualizer LivePreview(value: (input.Amount)d6 + self.HealthModifier)`
  to the `VuePromptTest` first prompt.

## Wiki

Update `Fields.md` rollVisualizer section: document `input.X` and live prompt
reactivity, replacing the Phase 1 "static preview on prompts" note.

## Non-goals (Phase 2)

- `input.` references in non-rollVisualizer prompt fields (would need the prompt
  calc-field system to become live-reactive).
- Rich subproperty handling for `dice`/`attribute` prompt inputs (follow-up).
