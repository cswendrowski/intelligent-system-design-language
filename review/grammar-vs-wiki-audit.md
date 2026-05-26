# Grammar vs. Wiki Audit

Source: `src/language/intelligent-system-design-language.langium` (commit on `visual-overhaul`).
Target: `intelligent-system-design-language.wiki/*.md`.

Line numbers refer to the grammar file.

---

## High-priority gaps (top 10)

### 1. `damageTrack` field — entirely undocumented
- Grammar: `DamageTrackExp` (L258–263), with `types: [STRING, ...]` parameter plus standard number/visibility params.
- What it does (inferred): A field that tracks one of several named damage states (e.g. `"Healthy", "Bloodied", "Critical", "Dying"`); `types:` defines the labelled levels.
- Wiki location: belongs in `Fields.md` under "Common Building Blocks" alongside `resource`/`tracker`. Listed in neither the summary table nor any prose. Zero matches in wiki for `damageTrack`.
- Gap: Field exists but has no entry, no example, no parameter list anywhere.

### 2. `wounds resource` (the second resource tag) — undocumented
- Grammar: `ResourceExp` allows `(tag=("health" | "wounds"))?` (L167).
- What it does: From context, marks a resource as the inverted "damage taken" pool that the damage applicator increases instead of decreases (companion to `health resource`). Grammar alone doesn't make the exact semantics clear — confirm with codegen.
- Wiki location: `Fields.md` Resource section. Wiki documents `health resource` thoroughly but never mentions `wounds`.
- Gap: Tag exists in grammar; zero references in wiki.

### 3. `status` syntax in the wiki contradicts the grammar
- Grammar: `StatusProperty: (tag="death")? "status" name=ID ("(" params ... ")")?`. Param is `DocumentSvgParam` (`svg:` — L37) or `StatusParamWhen` (`when:` — L457). The `death` tag is a *prefix*, not a parenthesised flag.
- Wiki (`Keywords-and-Journals.md` L48–50, `Keywords-Quick-Reference.md` L29–44): writes `status Dead when: self.HP <= 0 img: "icons/svg/skull.svg"` with no parens and using `img:` rather than `svg:`. Also documents `death` as a trailing modifier (`status Dead when: ... death img: ...`) which the grammar does not support.
- Gap: Two correctness bugs in the docs (param keyword wrong, parenthesisation/ordering wrong). Users copy-pasting will hit parser errors.

### 4. Hook handler list in wiki is incomplete
- Grammar: `HookHandler` (L459–466) supports `combatStart, combatEnd, turnIsNext, turnStart, turnEnd, roundStart, roundEnd, death, preApplyDamage, preApplyTemp, preApplyHealing, appliedDamage, appliedTemp, appliedHealing` *and* free-form `ID` (custom event names).
- Wiki: `Logic-Reference.md` table (L332–352) covers the named events well. But the *custom-event* path (`on myCustomThing { ... }`) is shown only in `Interactivity.md` examples (`on buffApplied`, `on levelUpEvent`) without saying these are user-defined names rather than known hooks. Nothing tells users how/whether custom hooks are dispatched.
- Gap: Whether `on customName(...)` is purely a label users emit themselves (and from where?) or maps to a Foundry hook is not explained.

### 5. `pinned` interaction relies on a per-item "pinned" feature that is invisible in the grammar
- Grammar: `PinnedField` (L215–216) is just a marker field with standard params.
- Wiki: `Fields.md` (L941–994) describes the *display* but says items are "pinned by users from inventory tables or item sheets" — implying there's a generated UI affordance.
- Gap: How an item *gets* pinned (which control, which underlying property name, whether it's user-driven only or scriptable) is not documented anywhere. Users cannot script pinning. **Cannot tell from grammar** — codegen-side concern, flagged below as well.

### 6. `quick action`, `macro action`, `secondary action` — `secondary` undocumented; semantics of all three thin
- Grammar: `Action` (L553–554) allows `(isQuick?="quick")? (isMacro?="macro")? (isSecondary?="secondary")?` — three independent boolean modifiers.
- Wiki (`Logic-Reference.md` L297–298, `Interactivity.md` L98–116, `Logic.md` L1064–1092): documents `quick` and `macro`. **`secondary` has zero mentions across the wiki.**
- Gap: `secondary` modifier completely undocumented. Also, what `quick` and `macro` actually *do* differently (button styling? macro-bar exposure? skip confirmation?) is described loosely; no parameter table compares the three.

### 7. Action params: `label:` documented; `disabled:` / `hidden:` / `when:` used in examples but not in the grammar param list
- Grammar: `ActionParam: (StandardFieldParams)` (L555–556) — only `visibility | icon | color | label`.
- Wiki: `Document.md` L50, L115 use `action LevelUp(disabled: ...)`; L149 uses `action LevelUp(when: ...)`; `Fields.md` L72 uses `action Heal(hidden: !self.HasHealing)`.
- Gap: Either these shorthand params are undocumented sugar that the grammar accepts elsewhere (parser may permit them as an `ExpressionModifier`-like prefix?) or the wiki examples are flat-out wrong. The grammar as written does not accept `disabled:`, `hidden:`, or `when:` inside the action's `(...)`. **Needs the project owner to clarify** — almost certainly the wiki examples are stale relative to current grammar.

### 8. Number range / `each` over range — works but `each` parameter scoping is opaque
- Grammar: `Each: 'each' var=Parameter 'in' collection=(Access | FleetingAccess | ParentAccess | TargetAccess | NumberRange)` (L575–580). `NumberRange: "[" start=Expression "to" end=Expression "]"`.
- Wiki: `Logic-Reference.md` L264–284 covers the syntax and ranges. Good.
- Gap: Iterating over a `DocumentArrayExp` (e.g. `each weapon in self.Equipment`) - how does the loop variable's `.subProperty` resolve? Wiki examples assume it Just Works but never spell out the iteration variable model. Lower priority; `each` does *appear* in many recipes.

### 9. Reference fields `parent<type>` and `self<type>` — supported types list is mismatched
- Grammar: both `ParentPropertyRefExp` (L390) and `SelfPropertyRefExp` (L402) accept `attribute | resource | number | boolean | date | time | datetime | die | dice | string | tracker | choice | paperdoll | html`.
- Wiki: `Fields.md` L692 lists the types correctly for `self<type>`, but the `parent<type>` section (L675–686) does not list supported types and only shows `parent<attribute>`.
- Gap: A user reading the parent-ref section won't know that `parent<resource>`, `parent<die>`, etc. are valid.

### 10. Document parameters: `svg:`, `creatable:`, `default:`, `description:`, `icon:`, `background:` — only some documented
- Grammar: `DocumentParam` (L34–43) supports `IconParam | BackgroundParam | DocumentSvgParam | DocumentDescriptionParam | DocumentCreatableParam | DocumentDefaultParam`. So you can write `actor Hero(icon: "...", background: hideout, svg: "...", description: "...", creatable: true, default: false) { ... }`.
- Wiki: `Document.md` documents `icon` and `background` only on `page` (not on the `actor`/`item` declaration itself). `svg:`, `description:`, `creatable:`, `default:` for actors/items are absent from the wiki. The 14 backgrounds listed on L87–102 are only in the page section.
- Gap: Document-level parameters are entirely undocumented. `creatable:` and `default:` in particular control whether users can create the document type from the UI — material to anyone building a multi-actor system.

---

## Medium-priority gaps

### M1. `attribute(style: plain | box, roll: ...)` undocumented
- Grammar: `AttributeStyleParam` and `AttributeRollParam` (L240–243).
- Wiki: `Fields.md` Attribute section describes `min`, `max`, `mod` only. The `style:` and `roll:` parameters are not mentioned. (The `roll:` parameter takes a method block / expression and presumably defines the default roll formula tied to the attribute — confirm with codegen.)

### M2. `tracker` segments parameter has minor under-documentation
- Grammar: `SegmentsParameter: "segments:" segments=INT` (L226).
- Wiki: `Fields.md` L426–458 mentions `segments:` for `segments` style only and says "Number of segments when using segments/circles style". `circles` is not actually a tracker style in the grammar (only `bar | dial | icons | slashes | segmented | clock | plain`); also `segments:` is documented as if it only matters with `segments` style, but the grammar allows it on any tracker. Minor inaccuracy.

### M3. `pips` field marked deprecated in grammar but still documented poorly
- Grammar: `PipsExp` lives under `DeprecatedFields` (L86, L248–253) with `style: squares | circles`.
- Wiki: zero references to `pips`. Acceptable (it's deprecated), but if it remains usable, a migration note pointing to `tracker(style: segments)` would help users with old systems.

### M4. `MoneyDenomination` accepts `icon:` and `color:` but no `label:`
- Grammar: `MoneyDenominationParam: (MoneyDenominationValueParam | IconParam | ColorParam)` (L207–208).
- Wiki: `Fields.md` L552–556 covers this correctly. No label customisation per denomination is grammar-supported, which the wiki implicitly confirms — fine but worth an explicit note that denomination IDs *are* the displayed label.

### M5. `paperdoll` `size:` parameter values are made up by the wiki
- Grammar: `SizeParam: "size:" value=PX` (L418–419) — takes a pixel literal.
- Wiki: `Fields.md` L797 says "Size of the paperdoll (small, medium, large)" — these named sizes do not appear anywhere in the grammar. Either the wiki is wrong or there's codegen-level resolution.

### M6. `choices<string>` `max:` and `initial:` parameters undocumented
- Grammar: `StringChoicesParamMax: "max:" value=INT` and `StringChoicesParamInitial: "initial:" value=INT` (L122–125).
- Wiki: `Fields.md` shows `choice<string>` (singular) but `choices<string>` (plural, multi-select) is not documented at all. Yet the grammar (L108–109) defines a distinct `StringChoicesField` separate from the singular variant.

### M7. `damage(...)` function — only described in flavor, no parameter table
- Grammar: `DamageRoll: "damage" "(" params ... ")"` with `RollParam: "roll:"` and `TypeParam: "type:"` (L598–604). The `type:` value can be an `Access | ParentAccess | TargetAccess | Literal`.
- Wiki: `Fields.md` (L249–270) shows `damage()` *usage* in the choice<damageType> section, but there's no top-level documentation in `Logic-Reference.md` of what `damage(...)` is, what parameters it accepts, or how the resulting object is shaped.

### M8. `chat tag/flavor/wide/<plain>` documented; `chat <name>(template: "...")` template path is not
- Grammar: `ChatCard: "chat" name=ID ("(" "template:" path=STRING ")")? body=ChatBlock` (L646).
- Wiki: every chat example omits `(template: "...")`. The optional template-override path is undocumented. Useful for users who want custom card HTML.

### M9. Field-level `ExpressionModifier` shorthand keywords `unlocked`, `secret`, `edit`, `play`, `gmEdit`, `readonly` (without `visibility:`) are mostly hidden
- Grammar: `ExpressionModifier` (L87–88) allows any visibility name as a *prefix* on any field/action declaration: `gmOnly string Notes`, `secret number Cunning`, `unlocked resource Mana`, etc.
- Wiki: `Fields.md` mentions `gmOnly string Thing` and `hidden number AvailableSkillLevels` (Document.md L175). The full prefix list — and the fact that the same nine keywords as `Visibility.X` apply as prefixes — is shown only in scattered examples. A "shorthand visibility prefixes" subsection would help.

### M10. `Update self`/`update parent` vs `self.update()`/`self.delete()` distinction
- Grammar: `Update: (UpdateSelf | UpdateParent)` with `UpdateSelf: "update" Self` and `UpdateParent: "update" Parent`. `SelfMethod: "self." method=("delete()" | "update()")` (L606).
- Wiki: `Logic-Reference.md` L411–419 mentions both forms but doesn't explain when one is preferred. **Cannot tell from grammar alone** which is the correct/canonical form.

---

## Nice-to-haves / low priority

- **`tracker style: segmented`** vs `style: segments` — Grammar (L225) accepts `segmented` (also accepts `bar | dial | icons | slashes | clock | plain`). Wiki uses `segments` exclusively (L432). Possibly an alias; either is accepted by `TrackerStyleParameter` *but* the grammar's literal list is `"bar" | "dial" | "icons" | "slashes" | "segmented" | "clock" | "plain"` — `segments` is **not** valid. The wiki's example `style: segments, segments: 10` would not parse.
- **`InventorySlotsParam`/`InventoryRowsParam` etc.** all well-covered in `Fields.md`.
- **`ChoiceCustomProperty`** custom metadata on string choices is documented in `Fields.md`. Good.
- **`ParentTypeCheckExpression: "parent" "is" Document`** — wiki shows `target is Actor` and `parent is Actor` but doesn't note these check the Document *type name*, not the literal string `"Actor"` (`target is Goblin` is what the grammar enables).
- **`Combat.isNotMyTurn`** present in grammar (L637) and Logic-Reference. Fine.
- **`MathEmptyExpression`** (`Math.random()`) — covered.
- **`NumberRange` allows arbitrary expressions, not just integers**: `[1 to self.MaxLevel]` is shown in Logic-Reference; good.
- **`@js{...}` JS escape** — covered.
- **`NumberParamCalculator` (`calculator:` boolean)** — Grammar L424–425. Money documents `calculator support` but the explicit `calculator: true|false` parameter on plain `number` fields is not mentioned in the Number section of `Fields.md`.
- **`ItemAccess: "item" "." property ...`** (L547) — used inside `where:` filters in the wiki examples, but the wiki never explains that `item.X` is the iteration alias for `where:` clauses on document arrays.
- **`config` block keywords**: `Config.md` documents `id/label/description/author`. Fine. `keywords {}` block lives in `Keywords-and-Journals.md`. Fine.
- **`death status` death tag prefix** — see #3 above.

---

## Things you couldn't tell from the grammar alone

These features exist in the grammar but their *semantics* require codegen knowledge:

1. **`wounds resource`** vs `health resource` — does it invert damage application? Tag is in the grammar but behaviour is generator-side.
2. **`pinned` field's pinning UX** — how items are marked pinned, what underlying flag/property is used, whether it's user-toggle-only or scriptable. Grammar gives only the field name.
3. **`quick`/`macro`/`secondary` action modifiers** — what each generates in the UI. Grammar boolean-tags only.
4. **`AttributeRollParam` (`roll:`)** — what happens when an attribute has a `roll:` defined? Triggered how? Returns what? Grammar only types the value as `MethodBlock | Expression`.
5. **`MoneyDisplayParam` modes (`breakdown`, `consolidated`, `primary`)** — wiki documents these, but the rendering rules are codegen-side.
6. **Hook custom event dispatch** — `on someCustomEvent(args) { ... }` — who fires it, from where? Grammar only confirms the syntax is valid.
7. **`update self` vs `self.update()`** — same outcome or different?
8. **`measuredTemplate` field** — generates what schema? Bound to which Foundry types?
9. **`@js{...}` block** — runtime context, available variables, escape semantics.
10. **`paperdoll size:`** — grammar says PX; wiki says named sizes. Which is the canonical form (or are both accepted)?
