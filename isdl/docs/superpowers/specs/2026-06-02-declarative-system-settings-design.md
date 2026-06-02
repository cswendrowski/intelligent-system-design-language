# Declarative System Settings in `config {}`

**Issue:** [#81](https://github.com/cswendrowski/intelligent-system-design-language/issues/81)
**Date:** 2026-06-02
**Status:** Approved design

## Problem

There is no declarative way for a system author to define configurable Foundry
game settings (`game.settings.register`). The generator emits a fixed, closed
set of built-in settings in `registerSettings()`
(`src/cli/components/init-hook-generator.ts`), and the `config {}` block only
accepts `label`/`id`/`author`/`description`/`keywords`. Authors who want their
own settings must hand-write them in the regeneration-safe `<id>-custom.mjs`,
which is not generated, validated, localized, or referenceable from declarative
logic.

This is a declarative DX/maintainability enhancement, not a hard capability gap.

## Goals

- A `settings {}` block inside `config {}` that declares configurable settings.
- Each setting registers into the existing `registerSettings()` with its name
  and hint localized into `lang/en.json`.
- Settings are **readable and writable** from declarative logic via a `System.`
  accessor (`if`, `visibility:`, chat conditions, assignments).

## Non-Goals (v1)

- Setting types beyond `boolean`, `number`, `string`, `choice<string>`.
- Scopes beyond Foundry's `world` and `client`.
- Computed/dynamic defaults (Foundry evaluates `default` once at init; it must
  be a static literal).
- Settings submenus, `requiresReload`, `onChange` handlers, or hiding a setting
  from the config menu (all settings are `config: true` in v1).

## Syntax

A `settings {}` block, with settings **grouped by scope**. Grouping by scope
keeps the per-setting declaration clean (no repeated `scope:` param) and lets us
reuse the existing field *type keywords*.

```isdl
config EZD6 {
    settings {
        client {
            boolean ShowToHit(initial: true, hint: "Show the to-hit number on character sheets")
            boolean ShowMagicResist(initial: false)
        }
        world {
            number StartingKarma(initial: 3)
            choice<string> KarmaInChat(
                choices: ["Never", "GM Only", "Everyone"],
                initial: "GM Only",
                label: "Karma changes in chat")
        }
    }
}
```

### Why a dedicated param set, not the full field rules

We reuse the **type keywords** (`boolean` / `number` / `string` /
`choice<string>`) but define a small, dedicated param set rather than reusing
the existing `BooleanExp`/`NumberExp`/`StringExp`/`StringChoiceField` rules
verbatim. Two reasons:

1. A Foundry setting's `initial` (default) is evaluated **once at init** and
   must be a static literal — it cannot be a computed/`self`-referencing
   `MethodBlock` the way a field's `value:` can. The field rules also carry
   `ExpressionModifier` and `visibility`/`icon`/`color`/`calculator` params that
   are meaningless for a setting.
2. Dedicated AST nodes guarantee settings never leak into the document
   datamodel / sheet / localization generators. (`globalGetAllOfType` only walks
   `entry.documents`, so config-block nodes are already out of reach — but
   distinct node types make this structural rather than incidental.)

### Setting params

Shared across all four setting types:

| Param      | Applies to        | Meaning                                                        |
|------------|-------------------|----------------------------------------------------------------|
| `initial:` | all               | Static literal default value. Type must match the keyword.     |
| `choices:` | `choice<string>`  | `["A", "B", ...]` list of allowed string values.               |
| `label:`   | all (optional)    | Foundry setting display name. Defaults to humanized name.       |
| `hint:`    | all (optional)    | Descriptive text shown under the name in the settings menu.     |

Supported types (v1): `boolean`, `number`, `string`, `choice<string>`.
Scopes (v1): `world`, `client`.

## Reading & writing in logic — `System.X`

`System.` is the accessor; v1 supports **read + write**.

```isdl
// read
string ToHit(visibility: System.ShowToHit ? Visibility.default : Visibility.hidden)
if (System.KarmaInChat == "Everyone") { ... }

// write (world-scoped — must be GM-gated, see below)
if (User.isGM) {
    System.StartingKarma = 5
}
```

- **Read** compiles to `game.settings.get('<id>', '<settingname>')`.
- **Write** compiles to `await game.settings.set('<id>', '<settingname>', <expr>)`.

Setting names are lowercased in the generated code (consistent with system
path conventions, e.g. `System.ShowToHit` → `'showtohit'`).

### World-write GM gate (validation)

`game.settings.set` for a `world`-scoped setting only succeeds for a GM; a
player-triggered write throws at runtime. Therefore a write to a `world`-scoped
setting **must be enclosed in an `if (User.isGM)` block**, or the generator
emits a **validation error**. `client`-scoped writes have no such requirement.

`if (User.isGM)` already parses today (`ShorthandComparisonExpression` with
`e1 = User.isGM` and no comparison term).

## Generation

### Grammar (`intelligent-system-design-language.langium`)

```langium
Config:
    "config" name=ID "{" body+=(ConfigExpression | Keywords | Settings)* "}";

Settings:
    "settings" "{" groups+=SettingScope* "}";
SettingScope:
    scope=("world" | "client") "{" settings+=SettingField* "}";
SettingField:
    (BooleanSetting | NumberSetting | StringSetting | StringChoiceSetting);

SettingParam:
    (SettingInitialBoolean | SettingInitialNumber | SettingInitialString
     | SettingChoices | SettingLabel | SettingHint);
// initial variants are split by literal type so the parser/validator can enforce
// type-matching; OR a single SettingInitial with value=(BOOLEAN|INT|STRING) plus
// a validation check. Final shape decided during implementation.

BooleanSetting:
    "boolean" name=ID ("(" params+=SettingParam ("," params+=SettingParam)* ")")?;
NumberSetting:
    "number" name=ID ("(" params+=SettingParam ("," params+=SettingParam)* ")")?;
StringSetting:
    "string" name=ID ("(" params+=SettingParam ("," params+=SettingParam)* ")")?;
StringChoiceSetting:
    "choice" "<" "string" ">" name=ID ("(" params+=SettingParam ("," params+=SettingParam)* ")")?;

// Logic accessor
SystemSettingAccess:
    "System" "." setting=[SettingField:ID] ("." subProperties+=ID)*;
SystemSettingAssignment:
    "System" "." setting=[SettingField:ID] "=" exp=Expression;
```

- `SystemSettingAccess` added to `PrimitiveExpression`.
- `SystemSettingAssignment` added to `MethodBlockExpression`.
- Exact rule factoring (shared fragment for the param list, single-vs-split
  `initial`) is an implementation detail; the AST node names above are the
  contract for downstream generators.

### Scope resolution (`isdl-scope-provider.ts`)

New branch: when `context.container` is a `SystemSettingAccess` or
`SystemSettingAssignment`, return a `MapScope` of all `SettingField` nodes found
under `entry.config` (walk `Settings → SettingScope → settings`). This scopes
`System.X` to settings only, never document properties.

### Expression generator

- Read → `game.settings.get('<id>', '<name.toLowerCase()>')`.
- Write → `await game.settings.set('<id>', '<name.toLowerCase()>', <expr>)`.
- Verify generated action method bodies are `async` so `await` is valid
  (they already contain awaited calls — confirm during implementation).

### Init hook (`init-hook-generator.ts`)

For each setting, after the built-ins in `registerSettings()`:

```js
game.settings.register('<id>', '<name>', {
    name: game.i18n.localize("SETTINGS.<Name>Name"),
    hint: game.i18n.localize("SETTINGS.<Name>Hint"),   // omit if no hint
    scope: '<world|client>',
    config: true,
    default: <initial literal>,
    type: <Boolean|Number|String>,
    choices: { "A": game.i18n.localize("SETTINGS.<Name>.A"), ... }  // choice only
});
```

### Localization (`language-generator.ts`)

Emit `SETTINGS.<Name>Name` (from `label:` or humanized name) and, when present,
`SETTINGS.<Name>Hint`. For `choice<string>`, emit a localized label per choice
value (`SETTINGS.<Name>.<ChoiceValue>`).

### Validation (`intelligent-system-design-language-validator.ts`)

- `initial:` literal type must match the setting keyword
  (`boolean`→BOOLEAN, `number`→INT, `string`/`choice<string>`→STRING).
- `choice<string>` requires `choices:`; its `initial:` (if present) must be one
  of the listed choices.
- A write to a `world`-scoped setting must be enclosed in an `if (User.isGM)`
  block → error otherwise.
- (Optional, nice-to-have) duplicate setting-name detection within `settings {}`.

## Files Touched

- `src/language/intelligent-system-design-language.langium` (+ regenerate AST)
- `src/language/isdl-scope-provider.ts`
- `src/language/intelligent-system-design-language-validator.ts`
- expression generator (read/write codegen)
- `src/cli/components/init-hook-generator.ts`
- `src/cli/components/language-generator.ts`
- `examples/kitchensink.isdl` — representative settings + a `System.X` read and a
  GM-gated `System.X` write
- Wiki: `Config.md` (settings block) + a short reference/example

## Testing / QA

- Parsing test: a `settings {}` block with all four types and both scopes.
- Validation tests: type-mismatched `initial:`; `choice` `initial:` not in
  `choices:`; `world` write without `if (User.isGM)` (error) and with it (ok).
- Linking test: `System.X` resolves to the declared setting; unknown name errors.
- QA generation from kitchensink; confirm `registerSettings()`, `lang/en.json`,
  and the generated `get`/`await set` calls look correct, ideally live-verified
  in Foundry.
