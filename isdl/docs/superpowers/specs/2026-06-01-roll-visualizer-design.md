# Roll Visualizer Field — Design (Phase 1)

**Date:** 2026-06-01
**Status:** Approved for implementation (Phase 1)

## Summary

Turn the WIP hardcoded "roll visualizer" component into a first-class ISDL field
type, `rollVisualizer`, that charts the probability distribution of a dice
formula and displays its exact average and min/max. The formula is supplied as a
calculated roll expression (the same syntax as attribute `roll:`) so it can
reference other fields.

The runtime computes the **exact** distribution by convolution for additive dice
expressions, and falls back to Monte Carlo simulation only for exotic formulas
(keep-highest/lowest, exploding, rerolls, dice×dice).

This spec covers **Phase 1**: the field type, the runtime engine, and live
reactivity on document sheets, plus a static (prep-time) preview on prompts.
Phase 2 (live reactivity to sibling prompt inputs as the user types) is scoped at
the end as future work and is **not** part of this implementation.

## Motivation

The existing component (`src/cli/components/vue/base-components/vue-roll-visualizer.ts`)
is a proof of concept gated behind a magic property name `RollVisualizer`. It:

- Hardcodes the formula (`"2d20 + d6 + 5"`) and ignores the field/document.
- Uses Monte Carlo only, with a two-pass 1k→10k refinement that discards the
  first pass's samples and contains a copy-paste bug (the refine pass filters the
  stale first-pass arrays, `vue-roll-visualizer.ts:74-75`).
- Never displays an average despite that being its original intent.
- Renders nothing until the user manually edits a text field.

Monte Carlo is the wrong default: for the common case (dice + constants), the
distribution is exactly computable by convolution — instant, smooth, no jitter,
and it yields the exact mean for free.

## Goals (Phase 1)

1. A first-class `rollVisualizer` field type in the grammar.
2. Formula supplied via a calculated `value:` expression (reuses `roll:` syntax),
   able to reference other fields.
3. Display: exact **average/expected value**, the **distribution curve**, and
   **min/max**.
4. Exact distribution by **convolution** for additive dice; **simulation
   fallback** for exotic modifiers.
5. **Live** recompute on a document sheet when referenced fields change.
6. Renders on **prompts** as a correct static preview (resolved against the
   document + prompt prep-time values), consistent with how existing calculated
   `value:` fields behave in prompts.
7. Retire the magic `RollVisualizer` property name (clean removal — no examples
   or wiki reference it; no deprecation alias).

## Non-Goals (Phase 1)

- Live reactivity to sibling **prompt inputs** as the user types (Phase 2).
- Target-number / percentile / standard-deviation readouts.
- Configurable chart styling beyond the standard field params.

## Architecture

**One runtime engine, two data sources.** The generator compiles the `value:`
expression once into a Foundry roll formula string with `@ref` tokens (reusing
the existing `translateDiceParts` path in `method-generator.ts`, with the
`[Label]` annotations stripped). At runtime the Vue component resolves and
analyzes it:

1. Build a `Roll` from the formula and a **data object**:
   - Sheet: `new Roll(formula, document.getRollData())`.
   - Prompt: `new Roll(formula, context.rollData)` (document roll data; prompt
     prep-time values already seeded as in existing prompt calculated fields).
2. After construction, Foundry substitutes `@refs` into the roll's terms.
   Inspect `roll.terms`:
   - **Pure additive** — only `Die` and `NumericTerm` operands joined by `+`/`-`
     operators, and no `Die.modifiers` present → compute the **exact PMF by
     convolution**.
   - **Otherwise** (any `Die.modifiers`, multiplication, division, parentheses
     with non-additive structure, function terms) → **Monte Carlo fallback**.
3. Derive average, min, max, and the chart series from the PMF (exact) or the
   accumulated samples (fallback).

Reactivity is the same mechanism in both contexts: the resolved Roll is recomputed
when its data object changes. On a sheet, `document.getRollData()` is reactive, so
edits to referenced fields drive the chart.

### Convolution engine

- Represent a distribution as a map/array from outcome value → probability.
- A single die term `NdF` is the N-fold convolution of the uniform distribution
  over `1..F`.
- Combine terms: `+` convolves; `-` convolves with the negated distribution;
  numeric constants shift.
- Outputs are small (a few hundred buckets for typical RPG formulas), so this is
  microseconds.
- **Exact average** = `Σ value · probability`. Min/max are the PMF's support
  bounds.

### Simulation fallback

Used only when the formula isn't purely additive. Improvements over the WIP:

- **Accumulate** batches into one running count map (e.g. 1k → +9k = 10k) instead
  of discarding the first pass.
- **Debounce** recompute (~250ms) so rapid field edits don't trigger redundant
  full simulations.
- Average is the mean of samples, labelled approximate ("≈").
- Fix the stale-array downsampling bug from the WIP.

### Detection rule

Pure additive (→ convolve) iff every operand term is `Die` or `NumericTerm`, the
only operators are `+`/`-`, and no `Die` has `.modifiers`. Anything else → simulate.
(The exact `roll.terms` shape — `.faces`, `.number`, `.modifiers`, and that
`@refs` are substituted into terms at construction before evaluation — is to be
confirmed against the target Foundry version during implementation.)

## Components & Integration Points

Follows the "Adding New Field Types" guide in `CLAUDE.md`.

1. **Grammar** (`src/language/intelligent-system-design-language.langium`):
   add `RollVisualizerField` to `ComplexFields`:
   ```langium
   RollVisualizerField:
       ExpressionModifier "rollVisualizer" name=ID
       "(" "value:" value=(MethodBlock | Expression) ("," params+=StandardFieldParams)* ")";
   ```
   (Final param ordering to match existing field conventions; `value:` required.)
   Run `npm run langium:generate` to regenerate AST types.

2. **Vue component** (`base-components/vue-roll-visualizer.ts`): rewrite the
   existing file. Props include the standard set (`label`, `systemPath`,
   `context`, `disabled`, `color`, `icon`) plus the compiled `formula` (and the
   data-source needed to resolve it). Implements the convolution engine, the
   simulation fallback, the detection rule, and the average/curve/min-max display.
   Reactive `computed` over the resolved Roll. Styles go in `_isdlStyles.scss`
   under an `.isdl-roll-visualizer` scope.

3. **Base components generator** (`vue-base-components-generator.ts`): keep the
   existing `generateRollVisualizerComponent(destination)` call.

4. **Vue generator export** (`vue-generator.ts`): keep
   `export { default as RollVisualizer } from './components/roll-visualizer.vue';`.

5. **Vue mixin** (`vue-mixin.ts`): keep `'i-roll-visualizer': 'RollVisualizer'`.

6. **Sheet application generator** (`vue-sheet-application-generator.ts`):
   replace the magic-name check (`element.name == "RollVisualizer"`, ~line 1253)
   with `isRollVisualizerField(element)` handling that compiles `value:` into the
   formula and emits `<i-roll-visualizer :context=... formula=... label=... .../>`.

7. **Prompt generator** (`vue-prompt-generator.ts`): replace the magic-name check
   (~line 105) with the same `isRollVisualizerField` handling, resolving against
   prompt context roll data (static preview).

8. **Datamodel generator**: no entry needed (read-only display field).

9. **Localization** (`language-generator.ts`): add label handling for
   `isRollVisualizerField` (label param or humanized name).

10. **Remove** the magic-name branches in the sheet and prompt generators.

## Formula Compilation Detail

Reuse `translateDiceParts` (`method-generator.ts:1083`) to turn the `value:`
expression into the parts joined into a single Foundry formula string. Generate
with labels stripped (the `noLabels` path) so the chart formula is clean
(`d20 + @strmod` rather than `d20 + @strmod[Strength Mod]`). The resulting string
contains `@key` references that Foundry resolves from roll data at `new Roll`
construction.

## Testing

- **Parsing** (`test/parsing/`): `rollVisualizer` field parses, with literal and
  field-referencing `value:` expressions and standard params.
- **Validating** (`test/validating/`): missing `value:` is rejected; standard
  field params accepted.
- **Convolution unit coverage**: exact mean/min/max/PMF for known formulas
  (`d6` → mean 3.5, min 1, max 6; `2d6` → mean 7, triangular; `d20 + 3`). Where
  practical, exercise the convolution logic directly.
- **Detection**: additive formulas route to convolution; `2d20kh1`, exploding,
  `2d6 * 2`-style route to simulation.
- **QA fixture**: add a `rollVisualizer` to `examples/kitchensink.isdl` — one on
  a document referencing a field (e.g. `value: 2d6 + self.HealthModifier`) and,
  if convenient, one in a prompt — then generate and verify the sheet renders the
  chart, average, and min/max, and that it updates when the referenced field
  changes.

## Wiki

Update per `CLAUDE.md` "Updating the Wiki": document `rollVisualizer` in
`Fields.md` (and the quick-reference if warranted), with a working example and a
note that the formula reacts to referenced fields on sheets.

## Phase 2 (future — not in this implementation)

Make the chart update live as the user edits **sibling prompt inputs**. Prompt
input fields are already Vue-reactive (they write to
`context.system.<action><var>.<field>`), but calculated `value:` fields in a
prompt are seeded once at prep time and do not recompute
(`vue-prompt-sheet-class-generator.ts:174-176`). Phase 2 gives the visualizer a
prompt-specific compiled path that reads those reactive paths live and merges them
into the roll-data object (`{...getRollData(), ...livePromptInputs}`). Self-contained
to this component (no change to how other calculated fields behave), but more
generator work and test surface than Phase 1.
