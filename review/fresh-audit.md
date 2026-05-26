# Fresh ISDL Wiki Audit — Horror Investigation Hobbyist

## Who I am and what I built

I'm a TTRPG hobbyist with very little real programming experience — I've done
some Excel formulas, copy-pasted a few Foundry macros, and skimmed a Python
tutorial once. I am not a JS/TS developer. I read the wiki the way a real
first-time user does: Home, the Sidebar, Getting Started, Your First System,
and then dipped into Document, Fields, and Basic Logic. I went into Recipes,
Interactivity, and the Logic Reference only when I felt stuck.

I sketched **Veil & Vellum**, a Call-of-Cthulhu-flavored horror investigation
game with no combat. It uses a d100-roll-under stat check, a `wounds`-style
Sanity bar, a short Stress tracker that fills toward a Breaking Point, a
prompt-driven "Witness Horror" action that asks the player how bad the sight
was, and items for Clues and a small Kit inventory. The shape is deliberately
different from the prior reviewer's PbtA "Spark" build (no weapons, no Monster
actor, no 2d6, no combat target).

## What worked

These genuinely landed for me, in this order:

1. **`Your-first-System.md` is still the best page in the wiki.** The diff-style
   `++ / --` markers plus the "regenerate, refresh, see this" rhythm gave me a
   working mental model of the language in one read. I knew what `actor`,
   `item`, `section`, `Loot[] MyLoot`, `action`, `chat`, and `roll(...)` did
   without having to leave the page. If this page didn't exist I would have
   bounced.

2. **The "do what makes sense" payoff is real and lands fast.**
   `health resource HP` quietly buys you token bars, the damage applicator, and
   a colored bar — that's the boring plumbing I'd dread, and it just works.
   The `wounds` companion tag with the blue/teal gradient was *exactly* the
   knob I wanted for a Sanity meter, and the NOTE on Fields.md line 462 about
   `wounds` not being auto-targeted by the damage applicator pre-emptively
   answered the next question I would have asked. That kind of inline
   "footgun warning" is gold.

3. **`attribute` defaulting `mod` to its own value.** I went into Fields
   expecting to write a useless `mod: { return self.Insight }` for my
   d100-under stats. The page's PbtA example
   (`attribute Bold(min: -1, max: 3)` with no mod) and the line
   "If you don't provide one, the attribute's mod defaults to its own value"
   meant I could just write `attribute Insight(min: 10, max: 90, initial: 50)`
   and trust it. Nice.

4. **The roll-auto-resolves-to-`.total` NOTE on Basic-Logic.md (~line 186)
   answered a question before I asked it.** I was going to write
   `if (attackRoll.total >= 15)` and the note told me bare `attackRoll` works
   in numeric contexts AND told me chat blocks are the special case. That's
   well-designed prose.

5. **`tracker` style options with previews.** I picked `style: segmented,
   segments: 6` for Stress in about ten seconds because the Fields page shows
   a screenshot of each style. The `clock` style is going right into the next
   game I make.

6. **The Visibility chart on Fields.md (lines 74-84).** The 4-column matrix
   (GM / Owner / Viewer / Active Effects) is the clearest piece of permissions
   documentation I've ever read for a Foundry-adjacent tool. I want this in
   every Foundry-related project's docs.

## Friction I hit while building

Ranked, worst first.

### 1. I never figured out whether `choice<attribute>` resolves to the value or the attribute object

I wrote this:

```
choice<attribute> Stat
number Modifier(min: -30, max: 30, initial: 0)

action MakeCheck {
    fleeting check = roll(d100)
    fleeting target = self.Stat + self.Modifier   // <-- is this a number?
    if (check <= target) { ... }
}
```

I copied the pattern straight from `Your-first-System.md` lines ~265-280, which
does `roll(d20 + self.Attribute + self.Skill.Bonus)` — so I know `self.Stat`
substitutes the chosen attribute *somehow*. But the wiki never says **what
exactly**. Does `self.Stat` give me the number? The mod? The whole attribute
object? Can I do `self.Stat + 10` and trust it's a number? Can I do
`self.Stat.max` to read the chosen attribute's max?

The Fields page covers `parent<attribute>` and `self<number>` reasonably well,
but `choice<attribute>` is a *field*, and it's missing from the
"Document Links / Embeds" table in Fields.md. The "Document Choice" entry on
Fields.md is for `choice<DocumentType>`, not `choice<attribute>`. I had to
deduce that `choice<attribute>` even existed from one example halfway through
Your-First-System.

**What I'd want it to say:** A first-class entry under "Document Links" called
something like *"Field-on-Self Choice (`choice<attribute>`,
`choice<resource>`, `choice<die>`)"* with a sentence: "The chosen attribute's
value (or `mod`, where applicable) is what `self.Stat` substitutes in
expressions. To reach the underlying field, write `self.Stat.max` etc."

### 2. `Math.floor` / `Math.ceil` are missing from Basic Logic

Basic-Logic.md line 75-78 lists "Common Math Functions" as `Math.max`,
`Math.min`, `Math.round`. That's it. I wrote
`Math.round(reveal.Severity.loss / 2)` because I trusted that list — but for a
"lose half on a save" pattern I really wanted `Math.floor`. They turn up in
Logic-Reference.md (line 55-57) and are used all over Advanced-Logic.md and
Recipes.md, so the *capability* is there. Basic-Logic just doesn't mention
them.

**What I'd want it to say:** add `Math.floor` and `Math.ceil` to the bullet
list on Basic-Logic.md, with a one-liner like "Use `floor` for rounding down
in 'half damage' patterns; `round` is rarely what you want in TTRPG math."

### 3. I genuinely could not tell if I could put logic in `value:` for `boolean`

I wanted a calculated boolean BreakingPoint that's true when Stress is maxed.
Fields.md says `value` is supported on String and Boolean (line 20) and shows
calculated value examples for *strings* further down (line 217-222) — but
zero examples of a *boolean* with a method-block value. I guessed:

```
readonly boolean BreakingPoint(value: {
    if (self.Stress >= 6) return true
    return false
})
```

I think this works? But the wiki never confirmed boolean-with-block-value is
legal, and a beginner doesn't know the grammar; they trust the docs. One
two-line example would close this.

### 4. The "shorthand visibility prefix" / "visibility: parameter" duality is taught twice and I confused myself

Fields.md line 50 introduces the prefix syntax (`gmOnly string SecretNote`).
Then line 87 says shorthand prefixes are *static* and conditional visibility
needs the `visibility:` parameter. **Then** Interactivity.md line 25 shows
ternary syntax inside `visibility:`:

```
action LevelUp(visibility: self.Experience >= ... ? Visibility.default : Visibility.hidden)
```

…and Fields.md only ever shows the method-block form
(`visibility: { if (...) return ... }`). Both are presumably valid, but I
genuinely thought for ten minutes that ISDL had a ternary expression elsewhere
that I'd missed. I never saw a ternary anywhere else in the wiki, only inside
`visibility:`. Is `?:` a thing in ISDL or only in `visibility:`? The wiki
doesn't say.

**What I'd want it to say:** pick one form, use it in 95% of examples,
mention the other as "alternative". And if `?:` works generally in
expressions, say so on Basic-Logic — and if it doesn't, drop the ternary
examples in Interactivity.

### 5. The "single most important page" link from Home.md goes to a hand-typed URL

Home.md line 100 links to
`https://github.com/cswendrowski/intelligent-system-design-language/wiki/Getting-Started`
— a full URL, when every other internal link uses the wiki's own
`[Getting Started](Getting-Started)` shorthand. This is just inconsistent, but
on the *literal one button* the page tells me to click, the inconsistency
stuck out.

### 6. Naming conventions said one thing, an example showed another

Document.md lines 33-37 spend a paragraph telling me IDs use PascalCase.
Then in Fields.md the "Pinned Field" section (line 1083-1086) shows:

```
item Weapon {
    string name      // lowercase!
    action QuickAttack(...) { ... }
}
```

That's two `string name` fields in the example block. I assumed for several
minutes that maybe `name` was a reserved/lowercase exception — until I
realized it's just a typo in the example. Tiny issue, but a beginner won't
know which guidance to trust.

### 7. The wiki has no end-to-end tested example for the kind of system I built

Your-First-System covers a d20 + attribute hero with weapons against a
monster. Recipes is great for snippets, but if you want a "no combat,
d100-under, prompt-driven sanity loss" system, you stitch it together
yourself from six pages. That's fine for me here — I was *trying* to find
holes — but a beginner who came in wanting to build Veil & Vellum would still
be reading at hour two.

This isn't a "fix this sentence" gripe — it's a "the example coverage is
narrow" observation. One more end-to-end tutorial in a non-d20 genre (PbtA,
or CoC-style, or Forged in the Dark) would help users who don't already know
the d20 vocabulary the tutorial assumes.

## Things I noticed but didn't get blocked on

- Fields.md line 905: `table<Spell> SpellBook(where: self.Level >= spell.RequiredLevel)`
  uses `spell.RequiredLevel` as the iteration alias, but the surrounding text
  on line 751 says the alias is `item.X`. So is it always `item.X`, or does it
  match the document type? The Fields.md text claims it's always `item`; the
  example contradicts itself. I'd lean toward "the example is wrong" but a
  newcomer can't tell.

- Fields.md line 962-966: the inventory example has a placeholder image URL
  (`placeholder-inventory-image.png`) that 404s. Every other Fields.md image
  is a real screenshot. Easy fix.

- Fields.md line 555-570: two screenshot URLs near the money section
  (`d2e8f1a3-...`, `e3f4a5b6-...`) look like fake/placeholder GUIDs and don't
  follow the format of the real GitHub user-attachments URLs. Probably broken.

- Fields.md line 1083: `string name` (lowercase) in the Pinned Field example,
  as noted above.

- Home.md line 100 uses a full URL instead of wiki shorthand, as noted above.

- The Sidebar lumps "Keywords & Journals" into Core Concepts but the page
  itself is mostly opt-in flavor (auto-generated journal entries). For a true
  beginner this isn't core — it's a nice-to-have. Putting it next to
  Documents and Fields oversells it.

- `Visibility.default` is described in two places with subtly different
  wording — Fields.md line 30 says it's "displayed for all, only editable in
  EditMode", Interactivity.md line 14 says it's "Standard visibility (same as
  unlocked)". Those two sentences disagree. The chart on Fields.md disagrees
  with Interactivity.md too — chart says default = read/write based on edit
  mode, Interactivity says it equals unlocked. Pick one.

- Basic-Logic.md line 74: "ISDL also accepts `self.Level++`" — first and only
  mention of `++` in the whole wiki. If it works, it should be in the
  shortcuts table; if it's truly only this one operator, say so.

- The "Quick Example" on Getting-Started.md (line 17) uses `roll(1d8)` while
  Your-First-System uses `roll(d8 + 3)`. Both work, but a beginner notices
  the inconsistency and wonders if the leading `1` matters.

- Document.md line 95 — the Health section example uses
  `resource HP(max: { return self.Endure + 6 })`, but the actor never defines
  `Endure`. Tiny but a copy-paste-and-try beginner would hit a validation
  error.

## The single most valuable next change

**Add a real, indexed reference page for `choice<X>` and `self<X>` /
`parent<X>` field-reference fields, with the answer to "what does
`self.Stat` actually substitute?" in the first paragraph.**

That single ambiguity blocks anyone trying to build a "pick a stat, roll it"
roller — which is one of the most basic patterns in the entire RPG-design
space. Right now the answer is buried as a casual aside in the Skills
section of Your-First-System ("`self.Stat` will resolve to a roll such as
d20 + 5") and there's no concept index for it. A beginner copying that
pattern can't predict whether `self.Stat * 2` or `self.Stat.max` works
without trying it.

Fix that, and you also fix half of friction points 1, 2, and 7 above.
