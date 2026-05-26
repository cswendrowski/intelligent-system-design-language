# Deprecation Removal & Packaging Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all deprecated language features (PipsExp, DocumentArrayExp, string-with-choices on StringExp), rename the `fsdl` namespace to `isdl` throughout, and fix packaging issues for first release.

**Architecture:** Grammar changes come first (removing deprecated rules), then `langium:generate` regenerates the AST types, then TypeScript source files are updated to remove references to the deleted types, and finally the build is verified. The `fsdl→isdl` rename touches `package.json` manifest and all extension source files that use `fsdl.*` identifiers.

**Tech Stack:** Langium (grammar/AST), TypeScript, VS Code Extension API, Vue 3

---

## Important: Build Order

Grammar edits → `npm run langium:generate` → fix TS files → `npm run build`. Never edit TS files referencing AST types before regenerating — the types will change.

## File Map

### Grammar & Language Server
- **Modify:** `src/language/intelligent-system-design-language.langium` — remove PipsExp, DocumentArrayExp, DeprecatedFields rules; remove `choices:` from StringParameter
- **Modify:** `src/language/intelligent-system-design-language-validator.ts` — remove validatePips, validateDocumentArrayExp, validateStringExp choices warning; remove isPipsExp from dependency checks
- **Modify:** `src/language/intelligent-system-design-language-quickfixes.ts` — remove pipsDeprecated, stringChoicesDeprecated, documentArrayDeprecated quickfixes

### Generators (PipsExp removal)
- **Modify:** `src/cli/components/datamodel-generator.ts` — remove isPipsExp branch (~lines 496-518)
- **Modify:** `src/cli/components/derived-data-generator.ts` — remove isPipsExp branches
- **Modify:** `src/cli/components/vue/vue-sheet-application-generator.ts` — remove isPipsExp from skip list
- **Modify:** `src/cli/components/base-sheet-generator.ts` — remove pips click handler and event binding

### Generators (DocumentArrayExp removal)
- **Modify:** `src/cli/components/derived-data-generator.ts` — replace isDocumentArrayExp with isTableField
- **Modify:** `src/cli/components/vue/vue-sheet-application-generator.ts` — remove all DocumentArrayExp handling (old jQuery DataTable rendering); replace with TableField
- **Modify:** `src/cli/components/vue/vue-generator.ts` — replace DocumentArrayExp with TableField
- **Modify:** `src/cli/components/vue/vue-datatable-sheet-class-generator.ts` — replace DocumentArrayExp with TableField
- **Modify:** `src/cli/components/vue/vue-datatable-component-generator.ts` — replace DocumentArrayExp with TableField
- **Modify:** `src/cli/components/vue/vue-active-effect-sheet-generator.ts` — replace isDocumentArrayExp with isTableField
- **Modify:** `src/cli/components/method-generator.ts` — remove StringExp+choices code path
- **Modify:** `src/cli/components/vue/vue-prompt-generator.ts` — remove StringExp+choices code path
- **Modify:** `src/cli/components/vue/vue-datatable2-component-generator.ts` — remove StringExp+choices in datatable columns
- **Modify:** `src/cli/components/language-generator.ts` — remove StringExp+choices localization
- **Modify:** `src/extension/github/githubManager.ts` — remove 'DocumentArrayExp' from string list

### Generators (StringExp choices removal)
- **Modify:** `src/cli/components/datamodel-generator.ts` — remove StringExp+choices branch (~lines 125-150)
- **Modify:** `src/cli/components/vue/vue-sheet-application-generator.ts` — remove StringExp+choices rendering (~lines 1500-1546)

### CSS
- **Modify:** `src/_handlebars.scss` — remove `.pips` styles (~lines 314-339)

### fsdl→isdl Rename
- **Modify:** `package.json` — rename package name, command IDs, config keys, view IDs, context keys, activation events, scripts
- **Modify:** `src/extension/main.ts` — rename all `fsdl.*` identifiers
- **Modify:** `src/extension/github/githubConfig.ts` — rename CONFIG_KEY
- **Modify:** `src/extension/github/githubAuthProvider.ts` — rename command IDs and view ID
- **Modify:** `src/extension/github/githubTreeProvider.ts` — rename config access and command
- **Modify:** `src/extension/github/githubQuickActions.ts` — rename config access and command
- **Modify:** `src/extension/github/githubManager.ts` — rename command IDs
- **Modify:** `src/extension/github/githubGistManager.ts` — remove `.fsdl` extension checks
- **Modify:** `src/extension/github/githubGistActions.ts` — remove `.fsdl` extension checks

### Packaging
- **Modify:** `package.json` — add keywords, author, homepage, bugs, fix license, fix CLI description, add repository URL
- **Modify:** `.vscodeignore` — exclude screenshots, vsix files, docs, .claude
- **Modify:** `src/cli/main.ts` — fix CLI help text

### Dead Code
- **Modify:** `src/cli/components/css-generator.ts` — remove unused `compileSCSS` export
- **Modify:** `src/cli/generator.ts` — remove commented `generateRpgAwesomeCss` call

---

### Task 1: Grammar — Remove Deprecated Rules

**Files:**
- Modify: `src/language/intelligent-system-design-language.langium:71-86,96-101,112,246-253`

- [ ] **Step 1: Remove DeprecatedFields from Property and its rule**

In `intelligent-system-design-language.langium`, change line 72 from:
```
Property:
    (BasicFields | ComplexFields | DateTimeFields | DiceFields | DocumentFields | ReferenceFields | DeprecatedFields);
```
to:
```
Property:
    (BasicFields | ComplexFields | DateTimeFields | DiceFields | DocumentFields | ReferenceFields);
```

Delete lines 85-86:
```
DeprecatedFields:
    (PipsExp | DocumentArrayExp);
```

- [ ] **Step 2: Remove DocumentArrayExp from DocumentFields**

Change line 81-82 from:
```
DocumentFields:
    (DocumentArrayExp | SingleDocumentExp | DocumentChoiceExp | DocumentChoicesExp | PaperDollExp | MacroField | TableField | InventoryField);
```
to:
```
DocumentFields:
    (SingleDocumentExp | DocumentChoiceExp | DocumentChoicesExp | PaperDollExp | MacroField | TableField | InventoryField);
```

- [ ] **Step 3: Remove PipsExp rules entirely**

Delete lines 246-253 (the entire Pips section):
```langium
// Pips -------------

PipsExp:
    ExpressionModifier "pips" name=ID ("(" params+=PipsParameter ("," params+=PipsParameter)* ")")?;
PipsParameter:
    (NumberParamMin | NumberParamMax | NumberParamInitial | NumberParamValue | PipsStyleParameter);
PipsStyleParameter:
    "style:" style=("squares" | "circles");
```

- [ ] **Step 4: Remove DocumentArrayExp rule**

Delete lines 276-277:
```langium
DocumentArrayExp:
    ExpressionModifier document=[Document:ID] "[]" name=ID ("(" params+=(StandardFieldParams|WhereParam|TableFieldsParam) ")")?;
```

- [ ] **Step 5: Remove StringParamChoices from StringParameter**

Change lines 111-112 from:
```langium
StringParameter:
    (StringParamChoices | StringParamValue | StandardFieldParams);
```
to:
```langium
StringParameter:
    (StringParamValue | StandardFieldParams);
```

Also delete the StringParamChoices rule (lines 115-116):
```langium
StringParamChoices:
    "choices:" "[" (choices+=StringChoice ("," choices+=StringChoice)*)? "]";
```

**Note:** `StringParamChoices` is ONLY used in `StringParameter`. The `StringChoiceField` and `DamageTypeChoiceField` use their own `StringParameter` which includes `StringParamChoices` — wait, no. Let me check. `StringChoiceField` also uses `StringParameter`. So removing `StringParamChoices` from `StringParameter` will break `StringChoiceField` too.

**Correction:** Do NOT remove `StringParamChoices` from `StringParameter`. Instead, we remove the **validator warning** and the **quickfix** — the grammar stays the same. The deprecation was about using `string Foo(choices: [...])` syntax, but the `choices:` parameter is shared with `choice<string>`. The grammar change is NOT needed here — only the validator/quickfix changes in Task 3.

**Revert Step 5 — no grammar change needed for StringExp choices.**

- [ ] **Step 6: Run langium:generate**

Run: `npm run langium:generate`
Expected: Success. The generated AST files in `src/language/generated/` will no longer include PipsExp, DocumentArrayExp, or DeprecatedFields types.

---

### Task 2: Fix Validator — Remove Deprecated Checks

**Files:**
- Modify: `src/language/intelligent-system-design-language-validator.ts`

- [ ] **Step 1: Remove PipsExp imports and validator**

Remove these imports (lines vary — find and remove):
- `PipsExp`
- `isPipsStyleParameter`
- `isPipsExp`
- `PipsStyleParameter`
- `NumberParamInitial` (only if solely used for pips — check first; it's used elsewhere so keep it)

Remove from the `checks` object:
```typescript
PipsExp: validator.validatePips,
```

Remove from the `checks` object:
```typescript
DocumentArrayExp: validator.validateDocumentArrayExp,
```

Remove the entire `validatePips` method (lines 193-221).

Remove the entire `validateDocumentArrayExp` method (lines 280-291).

- [ ] **Step 2: Remove StringExp choices deprecation warning**

In `validateStringExp` (line 246), remove the `if (choices)` block that issues the deprecation warning (lines 249-277). Keep the method itself — just make it empty or remove it entirely if it does nothing else.

Since `validateStringExp` ONLY checks for the choices deprecation warning, remove the entire method and its registration:
```typescript
StringExp: validator.validateStringExp,
```

- [ ] **Step 3: Remove isPipsExp from dependency checking**

In `isPropertyComputed` (line 584), change:
```typescript
if (isTrackerExp(property) || isResourceExp(property) || isPipsExp(property)) {
```
to:
```typescript
if (isTrackerExp(property) || isResourceExp(property)) {
```

In `extractDependencies` (line 630), change:
```typescript
} else if (isTrackerExp(property) || isResourceExp(property) || isPipsExp(property)) {
```
to:
```typescript
} else if (isTrackerExp(property) || isResourceExp(property)) {
```

- [ ] **Step 4: Remove commented-out deprecation check**

Delete lines 124-131 (the commented-out `isDeprecatedFields` check in `validateProperty`).

- [ ] **Step 5: Remove isDocumentArrayExp from validateActor**

In `validateActor` (line 102), remove:
```typescript
if (isDocumentArrayExp(property)) continue; // We allow multiple copies of the same document array exp in an actor
```

- [ ] **Step 6: Clean up unused imports**

Remove all imports that are no longer referenced: `PipsExp`, `isPipsStyleParameter`, `PipsStyleParameter`, `isPipsExp`, `isDocumentArrayExp`, `DocumentArrayExp`, `StringExp` (if no longer used), `isStringParamChoices`, `StringParamChoices`, `isStringExp` (check if used elsewhere first — it IS used in `isPropertyComputed` and `extractDependencies` and `isStringExpression`).

After removing the deprecation checks, the following imports should be removed:
- `PipsExp`, `isPipsStyleParameter`, `PipsStyleParameter`, `isPipsExp` — definitely remove
- `isDocumentArrayExp`, `DocumentArrayExp` — definitely remove  
- `StringExp` — keep (used in `isStringExpression`)
- `isStringParamChoices`, `StringParamChoices` — remove (no longer used in validator after removing `validateStringExp`)

---

### Task 3: Fix Quickfixes — Remove Deprecated Code Actions

**Files:**
- Modify: `src/language/intelligent-system-design-language-quickfixes.ts`

- [ ] **Step 1: Remove deprecated quickfix handlers**

Remove the three `case` entries from the `switch` statement:
```typescript
case 'pips-deprecated':
    this.pipsDeprecated(document, diagnostic, actions);
    break;
case 'string-choices-deprecated':
    this.stringChoicesDeprecated(document, diagnostic, actions);
    break;
case 'document-array-deprecated':
    this.documentArrayDeprecated(document, diagnostic, actions);
    break;
```

Remove the three methods:
- `pipsDeprecated` (lines 59-130)
- `stringChoicesDeprecated` (lines 136-152)
- `documentArrayDeprecated` (lines 154-170)

Also remove the `resolveCodeAction` method between them (lines 132-134) if it becomes orphaned.

---

### Task 4: Fix Generators — Remove PipsExp Handling

**Files:**
- Modify: `src/cli/components/datamodel-generator.ts`
- Modify: `src/cli/components/derived-data-generator.ts`
- Modify: `src/cli/components/vue/vue-sheet-application-generator.ts`
- Modify: `src/cli/components/base-sheet-generator.ts`
- Modify: `src/_handlebars.scss`

- [ ] **Step 1: datamodel-generator.ts — remove isPipsExp branch**

Remove the `isPipsExp` import. Remove lines 496-518:
```typescript
if ( isPipsExp(property) ) {
    // ... entire pips datamodel generation block
}
```

- [ ] **Step 2: derived-data-generator.ts — remove isPipsExp branches**

Remove the `isPipsExp` import. Remove the `if (isPipsExp(property))` block (~lines 391-400+). Change line 569 from:
```typescript
if (isTrackerExp(property) || isResourceExp(property) || isPipsExp(property)) {
```
to:
```typescript
if (isTrackerExp(property) || isResourceExp(property)) {
```

And line 635 from:
```typescript
} else if (isTrackerExp(property) || isResourceExp(property) || isPipsExp(property)) {
```
to:
```typescript
} else if (isTrackerExp(property) || isResourceExp(property)) {
```

- [ ] **Step 3: vue-sheet-application-generator.ts — remove isPipsExp from skip list**

Change line 1288 from:
```typescript
if (isPage(element) || isAccess(element) || isStatusProperty(element) || isPipsExp(element)) {
```
to:
```typescript
if (isPage(element) || isAccess(element) || isStatusProperty(element)) {
```

Remove the `isPipsExp` import.

- [ ] **Step 4: base-sheet-generator.ts — remove pips click handler**

Remove line 80:
```typescript
html.find(".pips-container").mousedown(this._onPipsClick.bind(this));
```

Remove the entire `_onPipsClick` method (lines 444-460).

- [ ] **Step 5: _handlebars.scss — remove pips styles**

Remove lines 314-339 (the `.pips` and `.pips-container` CSS block).

---

### Task 5: Fix Generators — Remove DocumentArrayExp Handling

This is the largest task. Every reference to `DocumentArrayExp` or `isDocumentArrayExp` must be replaced with `TableField` or `isTableField` respectively, OR removed if the code path is now dead.

**Files:**
- Modify: `src/cli/components/derived-data-generator.ts`
- Modify: `src/cli/components/vue/vue-sheet-application-generator.ts`
- Modify: `src/cli/components/vue/vue-generator.ts`
- Modify: `src/cli/components/vue/vue-datatable-sheet-class-generator.ts`
- Modify: `src/cli/components/vue/vue-datatable-component-generator.ts`
- Modify: `src/cli/components/vue/vue-active-effect-sheet-generator.ts`
- Modify: `src/extension/github/githubManager.ts`
- Modify: `src/cli/components/datamodel-generator.ts`

**Key insight:** `DocumentArrayExp` used the OLD jQuery-based DataTables component (`generateDatatableComponent`). `TableField` uses the NEW Vuetify-based DataTables component (`generateVuetifyDatatableComponent`). They are NOT type-interchangeable — each has its own rendering pipeline. The correct approach is to **remove all DocumentArrayExp codepaths entirely** (since the grammar no longer produces them) and ensure the `TableField` codepaths are complete.

- [ ] **Step 1: derived-data-generator.ts**

Change line 429 from:
```typescript
if ( isDocumentArrayExp(property) || isTableField(property) ) {
```
to:
```typescript
if ( isTableField(property) ) {
```

Remove `isDocumentArrayExp` import.

- [ ] **Step 2: vue-sheet-application-generator.ts — remove all DocumentArrayExp code**

This file has extensive DocumentArrayExp handling. Remove/replace:

1. Remove `DocumentArrayExp` and `isDocumentArrayExp` from imports
2. Line 118: Change `getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, true)` — remove this line entirely (the `tabs` variable tracks old-style DataTable tabs)
3. Lines 126-131: Remove `getPageFirstTab` function (uses DocumentArrayExp)
4. Lines 138-143: Remove `importDataTable` function (uses DocumentArrayExp and old datatable component)
5. Lines 446-451: Remove `importPageOfDataTable` function
6. Line 868: Change `document.body.filter(isDocumentArrayExp)` — remove (the `firstPageTabs` variable)
7. Lines 1080: Change `page.body.filter(isDocumentArrayExp)` — remove `tabs` variable
8. Lines 1094, 1100: Remove `joinToNode(tabs, ...)` calls that render old DataTable tabs
9. Line 1044: Remove `DocumentArrayExp` from union type — `generateSubTab(tab: DocumentArrayExp | TableField | InventoryField)` → `generateSubTab(tab: TableField | InventoryField)`
10. Lines 1109-1117: Remove entire `generateDataTable` function
11. Line 2276-2284: Remove the `isDocumentArrayExp(element)` branch in `generateElement`

The key places where `DocumentArrayExp` and `TableField` were used side-by-side, keep only the `TableField` parts. Where old-style DataTables tabs were separate from Vuetify tables, merge them into one codepath.

- [ ] **Step 3: vue-generator.ts — replace DocumentArrayExp with TableField**

1. Remove `DocumentArrayExp` and `isDocumentArrayExp` imports
2. Line 230: Change `generateDatatableExport(datatable: DocumentArrayExp)` — remove this function (old datatable export) or change to use TableField if still needed
3. Line 260: Change `getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, false)` — remove this old datatable collection

Check if there's a parallel TableField export. If the Vuetify datatables have their own export path, just remove the old one.

- [ ] **Step 4: vue-datatable-sheet-class-generator.ts — replace DocumentArrayExp with TableField**

1. Remove `DocumentArrayExp` and `isDocumentArrayExp` imports  
2. Line 26: Change function parameter `datatable: DocumentArrayExp` → `datatable: TableField`
3. Line 55: Change `getAllOfType<DocumentArrayExp>` → `getAllOfType<TableField>` with `isTableField`
4. Line 66: Change function parameter
5. Line 95: Change `getAllOfType<DocumentArrayExp>` → `getAllOfType<TableField>` with `isTableField`

- [ ] **Step 5: vue-datatable-component-generator.ts — replace DocumentArrayExp with TableField**

1. Remove `DocumentArrayExp` import, add `TableField`
2. Line 35: Change `table: DocumentArrayExp` → `table: TableField`

- [ ] **Step 6: vue-active-effect-sheet-generator.ts — replace isDocumentArrayExp**

1. Remove `isDocumentArrayExp` import
2. Lines 122, 365, 565: Replace `isDocumentArrayExp(property)` with `isTableField(property)` — these are negated checks that skip document-level fields

- [ ] **Step 7: githubManager.ts — remove DocumentArrayExp string reference**

Line 1905: Remove `'DocumentArrayExp'` from the string array of type names.

- [ ] **Step 8: datamodel-generator.ts — remove commented DocumentArrayExp code**

Remove the commented-out block at lines 628-632.

---

### Task 6: Fix Generators — Remove StringExp Choices Code Paths

**Files:**
- Modify: `src/cli/components/datamodel-generator.ts`
- Modify: `src/cli/components/vue/vue-sheet-application-generator.ts`
- Modify: `src/cli/components/language-generator.ts`
- Modify: `src/cli/components/method-generator.ts`
- Modify: `src/cli/components/vue/vue-prompt-generator.ts`
- Modify: `src/cli/components/vue/vue-datatable-component-generator.ts`
- Modify: `src/cli/components/vue/vue-datatable2-component-generator.ts`

- [ ] **Step 1: datamodel-generator.ts — remove StringExp+choices branch**

Remove lines 125-150 (the `if (isStringExp(property))` block that checks for `isStringParamChoices`). Keep only the plain string field generation (lines 151-153 become the only StringExp path):
```typescript
if (isStringExp(property)) {
    return expandToNode`
        ${property.name.toLowerCase()}: new fields.StringField({initial: ""}),
    `;
}
```

- [ ] **Step 2: vue-sheet-application-generator.ts — remove StringExp+choices rendering**

Remove lines 1516-1546 (the `if (choicesParam !== undefined)` block inside the `isStringExp` handler). After this, StringExp only renders as `<i-text-field>` (no value param) or `<i-string>` (with value param).

Also remove the `choicesParam` variable on line 1501:
```typescript
const choicesParam = element.params.find(p => isStringParamChoices(p)) as StringParamChoices | undefined;
```

- [ ] **Step 3: language-generator.ts — remove StringExp+choices localization**

Remove the StringExp choices localization block (~lines 119-127) that generates choice-level localization keys for string fields with choices.

- [ ] **Step 4: method-generator.ts — remove StringExp choices rendering**

Remove the StringExp choices rendering as `<select>` (~line 1535).

- [ ] **Step 5: vue-prompt-generator.ts — remove StringExp+choices in prompts**

Remove the StringExp choices handling (~line 151).

- [ ] **Step 6: vue-datatable-component-generator.ts and vue-datatable2-component-generator.ts**

Remove StringExp+choices column rendering in datatable components.

- [ ] **Step 7: Clean up unused imports across all modified files**

Remove `isStringParamChoices` and `StringParamChoices` imports from files that no longer use them: datamodel-generator.ts, vue-sheet-application-generator.ts, method-generator.ts, vue-prompt-generator.ts, vue-datatable-component-generator.ts, vue-datatable2-component-generator.ts.

**Note:** `isStringParamChoices` and `StringParamChoices` are still used by `StringChoiceField` and `DamageTypeChoiceField` — do NOT remove imports from files that handle those types.

---

### Task 7: Remove Dead Code

**Files:**
- Modify: `src/cli/components/css-generator.ts`
- Modify: `src/cli/generator.ts`

- [ ] **Step 1: Remove compileSCSS**

In `css-generator.ts`, remove the entire `compileSCSS` function (lines 10-45) and its `sass` import if no longer used.

- [ ] **Step 2: Remove commented generateRpgAwesomeCss call**

In `generator.ts`, remove line 61:
```typescript
//generateRpgAwesomeCss(data.destination);
```

Also remove `generateRpgAwesomeCss` from `css-generator.ts` (the function definition at lines 47+) if it's truly unused. And remove `rpg-awesome` from `package.json` dependencies if nothing else uses it.

---

### Task 8: Rename fsdl→isdl Namespace

**Files:**
- Modify: `package.json`
- Modify: `src/extension/main.ts`
- Modify: `src/extension/github/githubConfig.ts`
- Modify: `src/extension/github/githubAuthProvider.ts`
- Modify: `src/extension/github/githubTreeProvider.ts`
- Modify: `src/extension/github/githubQuickActions.ts`
- Modify: `src/extension/github/githubManager.ts`
- Modify: `src/extension/github/githubGistManager.ts`
- Modify: `src/extension/github/githubGistActions.ts`

- [ ] **Step 1: package.json — rename all fsdl identifiers**

Replace every `fsdl` reference:

| Old | New |
|-----|-----|
| `"name": "fsdl"` | `"name": "isdl"` |
| `"fsdl:generate"` script | `"isdl:generate"` |
| `"fsdl.generate"` command | `"isdl.generate"` |
| `"fsdl.regenerate"` command | `"isdl.regenerate"` |
| `"fsdl.github"` view ID | `"isdl.github"` |
| `"fsdl.github.authenticated"` | `"isdl.github.authenticated"` |
| `"fsdl.workspaceHasIsdlFiles"` | `"isdl.workspaceHasIsdlFiles"` |
| All `fsdl.github.*` config properties | `isdl.github.*` |
| `"fsdl.lastSelectedFolder"` | `"isdl.lastSelectedFolder"` |
| `"fsdl.lastSelectedFile"` | `"isdl.lastSelectedFile"` |
| `onView:fsdl.github` | `onView:isdl.github` |
| `view == fsdl.github` | `view == isdl.github` |
| `"foundry-system-design-language"` in configurationDefaults | `"intelligent-system-design-language"` |

Also remove `.fsdl` from `contributes.languages[0].extensions` — keep only `[".isdl"]`.

- [ ] **Step 2: extension/main.ts — rename all fsdl identifiers**

Replace all occurrences:
- `'fsdl.generate'` → `'isdl.generate'`
- `'fsdl.regenerate'` → `'isdl.regenerate'`
- `getConfiguration('fsdl')` → `getConfiguration('isdl')`
- `'fsdl.github'` (tree view ID) → `'isdl.github'`
- `'fsdl.workspaceHasIsdlFiles'` → `'isdl.workspaceHasIsdlFiles'`

Remove the `.fsdl` file search (line 70):
```typescript
const files = await vscode.workspace.findFiles('**/*.fsdl');
```
Change to just search for `.isdl`:
```typescript
const files = await vscode.workspace.findFiles('**/*.isdl');
```
Remove lines 72-74 (the `.isdl` append that was added as a second search).

- [ ] **Step 3: githubConfig.ts — rename CONFIG_KEY**

Change line 19:
```typescript
private static readonly CONFIG_KEY = 'fsdl.github';
```
to:
```typescript
private static readonly CONFIG_KEY = 'isdl.github';
```

And line 147:
```typescript
const config = vscode.workspace.getConfiguration('fsdl');
```
to:
```typescript
const config = vscode.workspace.getConfiguration('isdl');
```

- [ ] **Step 4: githubAuthProvider.ts — rename all fsdl identifiers**

Replace:
- `'fsdl.github.setup'` → `'isdl.github.setup'`
- `'fsdl.github.publish'` → `'isdl.github.publish'`
- `'fsdl.github'` (tree view) → `'isdl.github'`
- `'fsdl.github.signout'` → `'isdl.github.signout'`
- `'fsdl.github.refresh'` → `'isdl.github.refresh'`

- [ ] **Step 5: githubTreeProvider.ts — rename fsdl identifiers**

Replace:
- `getConfiguration('fsdl')` → `getConfiguration('isdl')`
- `'fsdl.generate'` → `'isdl.generate'`

Remove `.fsdl` extension check (line 286):
```typescript
name.endsWith('.isdl') || name.endsWith('.fsdl')
```
→
```typescript
name.endsWith('.isdl')
```

- [ ] **Step 6: githubQuickActions.ts — rename fsdl identifiers**

Replace:
- `getConfiguration('fsdl')` → `getConfiguration('isdl')`  
- `'fsdl.generate'` → `'isdl.generate'`
- Marketplace URL `IronMooseDevelopment.fsdl` → `IronMooseDevelopment.isdl` (2 occurrences)

- [ ] **Step 7: githubManager.ts — rename fsdl identifiers**

Replace:
- `'fsdl.generate'` → `'isdl.generate'`
- `getConfiguration('fsdl')` → `getConfiguration('isdl')`
- Marketplace URL `IronMooseDevelopment.fsdl` → `IronMooseDevelopment.isdl`

- [ ] **Step 8: githubGistManager.ts — remove .fsdl extension checks**

Replace all `.fsdl` checks:
```typescript
filename.endsWith('.isdl') || filename.endsWith('.fsdl')
```
→
```typescript
filename.endsWith('.isdl')
```

(3 occurrences at lines 71, 164, 199)

- [ ] **Step 9: githubGistActions.ts — remove .fsdl extension checks**

Replace:
- Line 44: `name.endsWith('.isdl') || name.endsWith('.fsdl')` → `name.endsWith('.isdl')`
- Line 230: `'ISDL Files': ['isdl', 'fsdl']` → `'ISDL Files': ['isdl']`
- Line 278: `'**/*.{isdl,fsdl}'` → `'**/*.isdl'`

---

### Task 9: Fix Packaging

**Files:**
- Modify: `package.json`
- Modify: `.vscodeignore`
- Modify: `src/cli/main.ts`

- [ ] **Step 1: package.json — add missing metadata**

Add/fix these fields:
```json
{
  "license": "Unlicense",
  "author": "Iron Moose Development",
  "keywords": ["isdl", "foundry-vtt", "tabletop-rpg", "dsl", "game-system", "character-sheet"],
  "repository": {
    "type": "git",
    "url": "https://github.com/cswendrowski/intelligent-system-design-language"
  },
  "homepage": "https://github.com/cswendrowski/intelligent-system-design-language#readme",
  "bugs": {
    "url": "https://github.com/cswendrowski/intelligent-system-design-language/issues"
  }
}
```

- [ ] **Step 2: .vscodeignore — exclude dev artifacts**

Add to `.vscodeignore`:
```
*.vsix
screenshot-*.png
docs/**
.claude/**
test/**
vitest.config.ts
.eslintrc.json
tsconfig.*.json
esbuild.mjs
src/**
langium-quickstart.md
CLAUDE.md
RELEASE_NOTES.md
```

- [ ] **Step 3: CLI help text — fix placeholder description**

In `src/cli/main.ts`, change line 50:
```typescript
.description('generates JavaScript code that prints "Hello, {name}!" for each greeting in a source file')
```
to:
```typescript
.description('generates a Foundry VTT system from an ISDL source file')
```

---

### Task 10: Build and Verify

- [ ] **Step 1: Run langium:generate**

Run: `npm run langium:generate`
Expected: Success — AST types regenerated without PipsExp, DocumentArrayExp, DeprecatedFields.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Success — no TypeScript compile errors.

- [ ] **Step 3: Verify no remaining references to removed types**

Run searches for:
- `PipsExp` — should only appear in generated files
- `DocumentArrayExp` — should only appear in generated files
- `DeprecatedFields` — should not appear anywhere
- `fsdl\.` — should not appear in src/ files
- `.fsdl` — should not appear outside grammar/generated files

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat!: remove deprecated features (pips, documentArray, string choices) and rename fsdl→isdl

BREAKING CHANGES:
- Removed pips field type (use tracker instead)
- Removed Document[] syntax (use table<Document> instead)
- Removed choices: parameter on string fields (use choice<string> instead)
- Renamed all fsdl.* VS Code identifiers to isdl.*
- Removed .fsdl file extension support"
```
