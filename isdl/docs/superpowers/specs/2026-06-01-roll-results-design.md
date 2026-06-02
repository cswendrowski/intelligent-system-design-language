# Roll Results — crit/fumble flags & dice inspection — Design

**Date:** 2026-06-01
**Status:** Approved for implementation
**Issues:** #10 (`crit`/`fumble` on `roll`), #80 (inspect individual dice results)

## Summary

Extend ISDL's `roll(...)` so authors can configure dice-result detection at roll
time and read the results back in the declarative expression layer — without
dropping to an `@js{}` escape hatch.

Two related capabilities:

- **#10 crit/fumble** — `roll(d20 + self.STR, crit: 20, fumble: 1)` exposes
  `myRoll.crit` / `myRoll.fumble` booleans to branch on, and auto-styles the
  chat card (gold for crit, red for fumble).
- **#80 dice inspection** — read aggregate dice data from a pool:
  `myRoll.successes`, `myRoll.highest` / `myRoll.lowest`, `myRoll.dice` (face
  array, iterable in `each`), and `myRoll.count(n)` / `myRoll.contains(n)` with
  number **or** predicate args (`myRoll.contains(die => die >= 3)`).

Today a roll reference resolves only to its numeric `.total`; there is no
member-access surface on rolls at all, which is exactly why the issue examples
fall back to raw JS.

## Motivation

Dice-pool and crit systems are ubiquitous and currently inexpressible:

- **d20 crits** — `crit: 20` / `fumble: 1`, branch on a natural 20.
- **EZD6 magic** — roll `Nd6` keep highest, *fail if any die shows a 1*
  (`cast.contains(1)`).
- **WoD / Storyteller** — count dice ≥ target as successes; 1s subtract
  (`success: >= 8, failure: 1` → `.successes`).
- **Shadowrun / pools** — count hits, detect glitches
  (`pool.count(1) >= pool.size / 2`).

None can be expressed with `.total` alone.

## Author-facing surface

### Roll parameters (detection config)

```isdl
roll(d20 + self.STR, crit: 20, fumble: 1)        // natural-face thresholds
roll(d20 + self.STR, crit: >= 19)                // natural-face range
roll(d20 + self.STR, crit: total >= 25)          // modified-total form
roll(5d10, success: >= 8)                        // success counting (#80)
roll(5d10, success: >= 8, failure: 1)            // 1s subtract from successes
```

Detection config is **opt-in**: if no `crit:`/`fumble:`/`success:` param is
present, nothing is evaluated and the corresponding accessor is unavailable
(see Validation).

`crit:`/`fumble:` default to **natural-face** comparison against the **first
`DiceTerm`** in the roll. The `total` keyword switches to comparison against the
modified total. A bare value (`crit: 20`) means equality (`== 20`); an operator
form (`crit: >= 19`) uses that operator.

### Result accessors

| Accessor | Returns | Phase | Notes |
|---|---|---|---|
| `r.crit` / `r.fumble` | boolean | 1 | Requires `crit:`/`fumble:` param. Single boolean: did the condition trigger at all. Multiple crits in one pool are not separately counted — walk `r.dice` for that. |
| `r.successes` | number | 2 | Requires `success:` param. Counts faces matching `success:`, minus faces matching `failure:`. |
| `r.highest` / `r.lowest` | number | 2 | Max/min face across all dice in the roll. |
| `r.dice` | number[] | 2 | Flat array of face values, iterable in `each`. Compiles to a custom getter (not Foundry's `Roll#dice`, which returns `DiceTerm`s). |
| `r.count(arg)` | number | 2 | Count of dice matching `arg`. |
| `r.contains(arg)` | boolean | 2 | Whether any die matches `arg`. |

`count`/`contains` `arg` is **either** a face value (`count(1)` → faces equal to
1) **or** a single-parameter predicate over a die face
(`contains(die => die >= 3)`).

A bare roll reference (`r` used in arithmetic/comparison) still resolves to
`.total`, unchanged.

## Grammar (`src/language/intelligent-system-design-language.langium`)

```langium
Roll:
    "roll" "(" parts+=Expression* ("," params+=RollParameter ("," params+=RollParameter)*)? ")";
RollParameter:
    CritParam | FumbleParam | SuccessParam | FailureParam;
CritParam:
    "crit:" (mode?="total")? (op=RollCompareOp)? value=Expression;
FumbleParam:
    "fumble:" (mode?="total")? (op=RollCompareOp)? value=Expression;
SuccessParam:
    "success:" (op=RollCompareOp)? value=Expression;
FailureParam:
    "failure:" (op=RollCompareOp)? value=Expression;
RollCompareOp returns string:
    "<" | "<=" | ">" | ">=" | "==" | "!=";

RollResultAccess:
    variable=[VariableExpression:ID] "." (
        accessor=("crit" | "fumble" | "successes" | "highest" | "lowest" | "dice")
      | method=("count" | "contains") "(" arg=RollPredicateArg ")"
    );
RollPredicateArg:
    (param=Parameter "=>" body=Expression) | value=Expression;
```

- `RollResultAccess` is added to `PrimitiveExpression` **before** `Ref` (so
  `r.count(1)` parses — `Ref` would consume `r.count` then choke on `(1)`).
- `RollResultAccess` is added to the `each` collection list (line ~598) so
  `each die in r.dice { ... }` parses.
- Risk: changing `Roll`'s `parts+=Expression*` to allow a trailing comma-param
  list. Parts are whitespace-separated expressions (no top-level commas), so the
  first `,` unambiguously begins params. Watch for Chevrotain ambiguity/lookahead
  warnings on `langium:generate`; if `parts+=Expression*` proves greedy, pin it
  to a single leading `parts+=Expression` (the real-world case).

After grammar edits: `npm run langium:generate` to regenerate AST types.

## Compilation (`src/cli/components/method-generator.ts`)

### Roll construction
The roll currently compiles to
`new <Config>Roll(formula, data).roll()` then
`Object.assign(result, {_displayFormula})`. Add the detection config as the
**3rd constructor arg** (Foundry's `Roll` `options`), so it is present on
`this.options` before any getter runs:

```js
new <Config>Roll(formula, data, { crit: {mode, op, value}, fumble: {...}, success: {op, value, failure: {...}} }).roll()
```

`value` for crit/fumble/success params is itself a translated expression (may
reference fields), evaluated at construction time.

### Accessor translation (`RollResultAccess`)
A new `isRollResultAccess` branch maps the ISDL accessor/method to the JS getter
name (name-mapping avoids the Foundry `Roll#dice` collision):

| ISDL | JS |
|---|---|
| `r.crit` | `r.crit` |
| `r.fumble` | `r.fumble` |
| `r.successes` | `r.successes` |
| `r.highest` | `r.highest` |
| `r.lowest` | `r.lowest` |
| `r.dice` | `r.diceFaces` |
| `r.count(1)` | `r.countDice(1)` |
| `r.contains(die => die >= 3)` | `r.containsDie((die) => die >= 3)` |

For the predicate form, `param` is registered like an `each` loop variable so
the `body` expression resolves `die` to the JS arrow parameter.

The existing `.total` auto-resolution for bare roll refs (Ref path ~1018, Fleeting
path ~1413) is untouched — both already only append `.total` when there is no
subproperty, so they continue to handle bare `r`.

## Generated `<Config>Roll` (`src/cli/generator.ts`, `generateExtendedRoll`)

Add getters/methods to the class. Helper: a private `get _allResults()` that
flattens `this.dice` (Foundry `DiceTerm[]`) to active face results.

```js
get _allResults() {
    return this.dice.flatMap(d => d.results.filter(r => r.active).map(r => r.result));
}
get diceFaces() { return this._allResults; }
get highest()   { return Math.max(...this._allResults); }
get lowest()    { return Math.min(...this._allResults); }

get crit()   { return this._evalCondition(this.options.crit); }
get fumble() { return this._evalCondition(this.options.fumble); }

get successes() {
    const s = this.options.success; if (!s) return 0;
    const hit = this._allResults.filter(r => this._cmp(r, s.op, s.value)).length;
    const f = this.options.failure;
    const miss = f ? this._allResults.filter(r => this._cmp(r, f.op, f.value)).length : 0;
    return hit - miss;
}

countDice(arg)   { return this._allResults.filter(this._predicate(arg)).length; }
containsDie(arg) { return this._allResults.some(this._predicate(arg)); }
```

Internal helpers (also on the class):
- `_cmp(a, op, b)` — apply a `RollCompareOp` string; bare value (no op) ⇒ `==`.
- `_predicate(arg)` — if `arg` is a function, use it; else `r => r === arg`.
- `_evalCondition(cfg)` — returns `false` when `cfg` is absent. If
  `cfg.mode === 'total'`, compare `this.total` via `_cmp(total, cfg.op, cfg.value)`;
  else compare the **first `DiceTerm`'s** natural total (sum of `this.dice[0]`'s
  active results) the same way. A bare value (no `op`) compares with `==`
  (`crit: 20` ⇒ first die `== 20`).

## Chat card auto-styling (#10)

The roll part object built for the chat card gains `crit` / `fumble` booleans
(read from the Roll instance). `standard-card.hbs` adds `roll--crit` /
`roll--fumble` modifier classes on the roll row when set. `_isdlStyles.scss`
defines a gold glow for `.roll--crit` and a red glow for `.roll--fumble`.
Applies wherever a roll is rendered to chat (explicit `chat { roll1 }` and the
auto roll-to-chat from attribute `roll:`); the exact part-construction sites are
confirmed during Phase 1 implementation.

## Validation (`src/language/intelligent-system-design-language-validator.ts`)

- `RollResultAccess` whose `variable` is not a roll-typed `VariableExpression`
  → error "Roll accessors are only valid on roll variables."
- `r.crit` / `r.fumble` without a `crit:` / `fumble:` param on the referenced
  roll → error "`.crit` requires a `crit:` parameter on the roll."
- `r.successes` without a `success:` param → error "`.successes` requires a
  `success:` parameter on the roll."
- (Unknown accessors like `r.crot` do not match `RollResultAccess`; they fall to
  `Ref`. A roll `Ref` carrying a subproperty that is not a known accessor →
  error listing the valid accessors.)

Strings shown to users are localized per project convention.

## Phasing

- **Phase 1 — #10 (crit/fumble):** `crit:`/`fumble:` params, `RollResultAccess`
  for `crit`/`fumble`, options plumbing, the two getters + `_evalCondition`/`_cmp`,
  chat-card styling, validation, kitchensink case. Ships value standalone.
- **Phase 2 — #80 (dice inspection):** `success:`/`failure:` params, the
  `successes`/`highest`/`lowest`/`dice` accessors, `count`/`contains` methods
  with number + predicate args, `each`-collection support, validation,
  kitchensink cases.

Each phase builds (`npm run build`) and QA-generates from `kitchensink.isdl`
independently.

## Testing

- `test/parsing/` — roll params + `RollResultAccess` (incl. predicate form) parse.
- `test/validating/` — missing-param and non-roll-variable errors fire.
- `test/linking/` — predicate `param` and roll-variable refs resolve.
- QA generation from `examples/kitchensink.isdl` with representative cases added
  for each phase.

## Out of scope (YAGNI)

- Per-die crit/fumble counting (multiple crits in one pool) — authors walk
  `r.dice` manually.
- Exploding/reroll-aware success semantics beyond active-result filtering.
- A `pool.size` accessor — `r.dice.length`-style needs can use `each`/count for
  now; revisit if requested.
