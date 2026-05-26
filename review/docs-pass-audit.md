# ISDL Wiki Audit — Non-Dev Pass

## Who I am

A TTRPG hobbyist who has copy-pasted Foundry macros and written Excel `IF()` formulas, but has never written a "real" program — I don't know what a "datamodel" is, I get nervous when docs say "derive," and I expect things to work the way they do in spreadsheets unless told otherwise.

## Score

- **Prior reviewer concerns:** 6 addressed, 4 partially addressed, 2 open, 1 not-a-concern-for-me (out of 13 numbered/significant items).
- **My own (non-dev) concerns added:** 8.

---

## Prior reviewer's concerns, graded

### 1. Field-name casing (PascalCase vs camelCase) — **Addressed**

`Document.md` now has a "Naming Conventions" section that just tells me: PascalCase for IDs, generated paths are lowercase, use `label:` if I want a different display name. That's exactly what I needed; I don't have to guess. Helpful quote: *"In your ISDL source you always reference fields by their ID with that exact casing: `self.HP`."*

The `self<type>` examples in `Fields.md` still use camelCase (`number strength`, `self<number> primaryAttribute`) which contradicts the convention page. As a non-dev I'll just blindly copy the inconsistent one and not notice. **Minor regression — see below.**

### 2. Roll dice grammar (`d20` vs `1d20` vs `2d6`) — **Addressed**

`Basic-Logic.md` now says: *"The expression inside `roll(...)` uses Foundry's dice expression syntax, so anything Foundry supports is valid here"* with links to Foundry's docs. Good — that tells me where to go without dumping a BNF on me. I can follow this.

### 3. `result` vs `result.total` idiom — **Addressed**

There's now an explicit NOTE: *"`roll` variables auto-resolve to `.total` in numeric contexts"* and even calls out that chat blocks are the exception. That's the kind of plain-language rule I can hold in my head. Examples in Basic-Logic now use bare `attackRoll` consistently. Big improvement.

### 4. Resource clamping at the cap — **Addressed**

`Fields.md` Resource section now has a clear "Automatic clamping" subsection: *"ISDL clamps `current` into the `[min, max]` range whenever the document re-derives… action code does not need to manually clamp."* The `DrinkPotion` example in Basic-Logic was rewritten to drop the manual `if HP > MaxHP` guard, with a comment saying it auto-clamps. Consistent now.

(Caveat for me as a non-dev: the words "derive" and "re-derives" appear without explanation. I sort of get it from context — "after the action runs" — but if you'd told me "after every button click and every page refresh" I'd be more confident.)

### 5. `parent.XP += 1` from inside an item action — **Addressed**

Basic-Logic now has a full "Accessing Character Data" section with `self`, `parent`, `target`, and `User` each explained with one example. The `Spell` item example doing `parent.Mana -= self.Cost` is exactly the canonical example I needed. This was the single biggest fix for me.

### 6. `attribute` requires `mod:` even when you don't want one — **Addressed**

Fields.md now says explicitly: *"`mod:` is **optional**. If you don't provide one, the attribute's `mod` defaults to its own `value` — perfect for systems like PbtA, Forged in the Dark, or Year Zero."* Includes a working PbtA example. Solved.

### 7. `choice<attribute>` returning mod vs score — **Partially addressed**

The convention is documented for direct attribute access (*"When you reference an attribute in a roll… ISDL substitutes the `mod` value, not the raw `value`"*), and the Your-First-System tutorial still shows `roll(d20 + self.Attribute)` where `self.Attribute` is a `choice<attribute>`. So I can infer it works through the choice. But it's not explicitly stated. A one-liner under Document Choice / parent / self saying "and yes, this also gets the mod" would close it.

### 8. `chat` block grammar — **Addressed**

Basic-Logic now has a "What can go inside a chat block" table with the five line forms (plain expression, roll variable, `flavor`, `tag`, `wide`) and an order convention. This is exactly the reference I wanted.

### 9. `equals` vs `==`, `!equals` vs `!=` — **Addressed**

There's now a comparison-operators table that names word forms as preferred and symbols as alternatives, with a note that wiki examples use word forms. Pick is made and stated.

### 10. `fleeting`/`eternal` vs `let`/`const` JS-divergence — **Not a concern for me**

I've never written `let myVar = 5` so I have no muscle memory to fight. `fleeting` and `eternal` actually read clearer to me than `let`/`const` ever did. (I appreciate that the prior reviewer flagged it though — friends of mine who code would care.)

### 11. Block scoping inside `if` — **Open**

Still nothing. There's no example showing what happens to a `fleeting` declared inside an `if`. As a non-dev I'd assume "it works everywhere in the action" because that's how a spreadsheet would behave, and probably never hit a problem until I do. Low priority for me.

### 12. `++` / `--` consistency — **Partially addressed**

Basic-Logic has a clear tip: *"`self.Level += 1` is the readable way to add one. ISDL also accepts `self.Level++` as a shorthand."* Picks `+=` as preferred. But examples in Document.md and Your-First-System still use `self.Level++`. Mostly fine, just slightly inconsistent.

### 13. Cheat sheet / quick reference page — **Open**

The reviewer asked for one screen that covers identifier rules, casing, comparisons, fleeting/eternal, roll grammar, comments, and what `self`/`parent`/`target` resolve to. The answers now exist, but they're scattered across Document.md (casing), Basic-Logic.md (most of the rest), and Fields.md (visibility). There's still no single page I can keep open while typing. The "Logic-Reference" page in the sidebar might be it — but a beginner shouldn't have to discover that.

---

## My own concerns (non-dev landmines the prior reviewer didn't flag)

### A. "datamodel" appears unexplained on the very first content page

`Document.md` opens with: *"Defines a Document type, which will generate out datamodels, a sheet, and other wiring."* I don't know what a datamodel is. I read this and assumed "I guess that's how it works" and kept going. The word also appears in Page/Section descriptions ("Nests visually on a sheet, but not in the datamodel"). For me that's gibberish. A one-line plain-English gloss — "datamodel = the saved data behind a sheet" — would help.

### B. "derive" / "re-derive" without explanation

Used in Fields.md Resource clamping ("whenever the document re-derives") and Recipes ("derived `mod` value"). I don't know what triggers a derive or whether I have to do anything. I think it means "whenever the sheet recalculates," but I'm guessing.

### C. The Home page leads with feature jargon, not what I'm doing

Home.md opens with "Vue 3 + Vuetify powered reactive character sheets," "DataTables with… drag-drop functionality," "Active Effects," "ApplicationV2-class language" (paraphrased — feature bullets full of framework names). I have no idea what Vue is or why I should care. The "30-second pitch" code block from the prior reviewer's "what worked" list is the thing that sold them; on the current Home page, that example only exists on Getting-Started.md, not Home.md. Move the code example up. Lead with what I'll *write*, not the libraries underneath.

### D. `value: { return ... }` syntax appears with no walkthrough

Document.md and Fields.md use:
```
resource HP(max: { return self.Endure + 6 })
```
…with no explanation that the `{ return ... }` block is a small calculation that runs whenever the value is needed. To a non-dev that looks like JSON-ish syntax, and `return` is a word from JS tutorials I half-skimmed. A two-sentence "this is a calculated value, runs when read" call-out the first time it appears would unstick me.

### E. The Self Property Reference example in Fields.md is broken-looking

```js
action "Primary Stat Roll" {
    roll: "d20 + @primaryStat"
    chat: [
        @primaryStat
    ]
}
```
This is the **only** place in the entire wiki I've seen `roll:`-as-a-key syntax, `@primaryStat` template tokens, or an `action` with a string-literal name in quotes. Every other `action` example uses `action Name { fleeting x = roll(...) ... chat Foo { ... } }`. As a non-dev I would copy this verbatim, get an error, and not know which version is correct. **This looks like leftover docs from an older syntax.** Strong suspicion this should be rewritten to match the rest of the wiki.

### F. Conditional visibility examples mix returning a value and "falling through"

The Visibility examples in Fields.md show:
```js
tracker Mana(visibility: {
    if (self.HeroType !equals "Mage") return Visibility.hidden
    // Will assume Default visibility
})
```
The "if no return, it defaults" rule is documented, which is great. But then immediately after:
```js
action Refill(visibility: { if (...) return Visibility.locked })
```
…and the formatting (`}) {`) is jarring. As a non-dev I had to re-read this three times to even tell whether `visibility:` ends and the action body begins. A clearer line break or one un-condensed example would help.

### G. The Inventory field has a placeholder image URL

`<img ... src="https://github.com/user-attachments/assets/placeholder-inventory-image.png" />` — that link isn't going to render. Also the `choice<damageType>` example references `attackDamage = attackDamage / 2` — does dividing a damage object by 2 work? It looks magical. As a non-dev I assume yes because the doc shows it, but a sentence confirming "damage objects support arithmetic and the type is preserved" would reassure me.

### H. No "what if I'm not using VS Code?" path

Getting-Started lists the VS Code extension as the install. I don't use VS Code (I might be on a school laptop, or I might just not want a new IDE). The CLI is mentioned in passing on Home.md ("CLI tool for build automation") but never given a "here's how to actually run a generation from the command line" walkthrough. A non-dev who isn't already on VS Code is stuck.

---

## Regressions

1. **Naming-convention contradiction in Fields.md.** `Document.md` now says "PascalCase always," but Fields.md `self<type>` examples still use camelCase identifiers (`number strength`, `self<number> primaryAttribute`). As a non-dev I will copy whichever I see first, and at least one of those will be wrong by the convention page. This is the same bug the prior reviewer flagged, half-fixed.

2. **The `++` consistency pass was started but not finished.** Basic-Logic picks `+=` as preferred. Document.md and Your-First-System still use `self.Level++`. The instinct (pick one and rewrite) was right; the rewrite stopped short.

3. **Self Property Reference example uses syntax that doesn't match anywhere else.** See concern E above. This looks like a docs regression where someone updated the section without updating the example to match current ISDL `action`/`roll`/`chat` syntax.

4. **`equals`/`!equals` is now stated as preferred, but `==` still appears in Document.md** (`disabled: self.Experience < 10` is fine; but `if (self.Credits >= 1000)` etc. mixes with `equals` elsewhere). The cleanup is partial. As a non-dev I'll absorb both as "valid" and pick whichever I saw last.

---

## Top remaining issue

**The single biggest remaining problem from a non-dev perspective is concern E: the Self Property Reference example in Fields.md uses syntax that contradicts the rest of the wiki** (`roll:` and `chat:` as keys with `@`-prefixed tokens, action with a quoted name). It's the only place that style appears, it sits inside an otherwise correct field reference, and a beginner who copies it will get errors with no idea why. Either rewrite the example to match current `action Name { fleeting x = roll(...) chat Result { x } }` syntax, or — if that older syntax really is still supported — say so explicitly and explain when to use which.

Runners-up: (1) explain "datamodel" and "derive" in plain English the first time they appear, and (2) actually finish the consistency rewrite — one casing, one comparison style, one increment style, across every example on every page. A non-dev reads inconsistencies as "the rules don't matter," then gets bitten.

---

## One forward-looking question

If you can do one more thing for non-devs, build a single one-page "ISDL at a glance" cheat sheet — same idea the prior reviewer asked for, but written for someone whose only reference points are Excel formulas and copy-pasted Foundry macros. Casing rules, what `self`/`parent`/`target` mean in one paragraph each, the comparison-operator table, the chat-line table, and a tiny glossary that defines "datamodel," "derive," "Active Effect," "token," and "document" in one sentence each. Right now the answers exist but they're scattered, and the only people who can navigate them comfortably are people who don't need them.
