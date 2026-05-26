# ISDL First-Impressions Review

I'm a working dev / TTRPG hobbyist who had never seen ISDL before this session.
I read the wiki (Home, Sidebar, Getting Started, Your First System, Config,
Document, Fields, Basic Logic, plus a quick scan of Recipes / Logic Reference)
and built a small 2d6 PbtA-flavored system called "Spark" — one PC actor with
four stats, an HP resource, an XP tracker, a generic move roller, a Weapon item
with a typed attack, and a Gear item.

## What worked well

- **The "30-second pitch" example on Home.md sells it.** The 8-line healing
  example is genuinely impressive — it's the rare DSL snippet where I can read
  it cold and predict what gets generated. That's the right thing to put on the
  landing page.

- **`Your-first-System.md` is the best page in the wiki by a wide margin.** The
  diff-style additions (`++` and `--` markers) and the "regenerate, refresh,
  what you'll see" rhythm let me build a mental model of the whole language in
  one read. If this page didn't exist I would not have made it through.

- **`resource`, `attribute`, `tracker` doing the right thing by default.** The
  Foundry-isms (token bars, damage application, dynamic token rings) are
  exactly the boring plumbing I'd dread wiring up by hand. `health resource HP`
  is a great example of "do what makes sense" actually paying off.

- **Item arrays as a declarative `Loot[] MyLoot` field that becomes a full
  drag/drop datatable.** That's a *lot* of UX from one line. I used the same
  pattern for `Weapon[]` and `Gear[]` in Spark with no surprises.

- **`parent<attribute>` and `choice<attribute>` are the right abstraction.**
  When the tutorial showed `parent<attribute> UsesAttribute(choices: [PC.Brain, PC.Brawn])`
  I immediately knew how to make my Weapon's attack stat configurable.

- **Visibility table on Fields.md.** The grid of `unlocked / default / secret /
  edit / play / gmEdit / gmOnly / locked / hidden` against GM/Owner/Viewer/AE
  columns is exactly what reference docs should look like. More of this please.

- **Embedded `roll:` on attributes.** Once I saw
  `attribute Brain(min: 1, max: 10, roll: roll(d20 + self.Brain))`,
  consolidating my four stats with a baked-in 2d6 roll was trivial.

## What confused or surprised me

### 1. Are field names case-sensitive? The wiki tells me both answers.

`CLAUDE.md` (which I didn't read, per the rules) aside, the wiki examples use
PascalCase identifiers everywhere (`HP`, `Brain`, `Strength`) and access them
via `self.HP`, `self.Strength`. But the `self<type>` example in Fields.md uses
camelCase:

```js
number strength (label: "Strength")
self<number> primaryAttribute (label: "Primary Attribute")
```

…and in another snippet it goes back to PascalCase. I have no idea whether
`self.HP` is normalized to `self.hp` under the hood, whether collisions are
possible, or what the convention is. **The wiki should pick one and tell me.**
I went with PascalCase because that's what the tutorial uses.

### 2. `roll(d20)` vs `roll(1d20)` vs `roll(2d6)` — what's a "die literal"?

Basic-Logic.md says "Common Dice Patterns" includes `roll(d20)`, `roll(2d6)`,
`roll(d8 + 3)`. So `d20` is a bare token but `2d6` works too — and presumably
`1d20` does as well? I assumed yes and used `2d6` in my system. The grammar of
the dice-expression mini-language is never spelled out. I'd want a one-line
BNF: `<count>?d<size> ( + <int|attr> )*`.

### 3. `result >= 10` vs `result.total >= 10` — both work, but which is idiomatic?

Basic-Logic.md explicitly says "you can either use `.total` or use the roll
directly." Great. But then every example in the *same page* mixes both styles
inconsistently — sometimes `attackRoll >= self.Target.AC`, sometimes
`attackRoll.total >= self.Target.AC`. Pick one as the recommended style and
stick to it. I went with bare `result >= 10` because it's shorter, but I have
no confidence that's the team's preference.

### 4. `+=` on a `tracker`/`resource` — what happens at the cap?

The healing example in `DrinkPotion` does:

```js
self.HP += healing
if (self.HP > self.MaxHP) {
    self.HP = self.MaxHP
}
```

So I assumed `resource` *does not auto-clamp*. But the Fields.md text on
`resource` says it "enforces `current` being <= `max`." Those two statements
contradict each other. Does it clamp or doesn't it? I left my XP tracker
incrementing past max in Spark without a guard because the docs imply trackers
clamp — but I'm guessing.

### 5. `parent.XP += 1` from inside an item action — does this work?

The tutorial shows `parent.Mana -= self.Cost` as a hint at the end ("if it's
always Mana, you could use `parent.Mana -= self.Cost`") but never has a working
example, and the Weapon `action Roll` example accesses `target` (an external
target) but never `parent` (the owning actor). I used `parent.XP += 1` from my
Weapon's miss branch in Spark on faith. **An item-action page or section
explaining `self` vs `parent` vs `target` with one example of each would have
saved me a lot of guessing.**

### 6. `attribute` always has a `mod` — but I don't want one.

PbtA-style stats *are* the modifier. There's no underlying "score." The wiki
makes `mod:` optional ("can be configured") but every example defines one. I
ended up writing the no-op:

```js
attribute Bold(min: -1, max: 3, mod: { return self.Bold })
```

…which is silly. Either let me omit `mod:` cleanly, or document what the
default is. I genuinely don't know if `attribute Bold(min: -1, max: 3)` would
work — the wiki examples never try.

### 7. `choice<attribute>` on the Actor — does it return the mod or the score?

Tutorial says "this access is smart — for `attribute` it will grab the `mod`
value." OK. But `choice<attribute> UsingStat` on the Hero — when I do
`roll(2d6 + self.UsingStat)`, am I getting the mod of the picked attribute?
The tutorial confirms yes for direct access. I'm assuming the indirection
through `choice` preserves that. It probably does, but the tutorial only shows
direct attribute access, not choice-of-attribute access in a roll.

### 8. `flavor` and `tag` inside `chat` — what are the rules?

`flavor "..."` goes at the top, `tag <expr>` goes at the bottom, plain strings
and roll variables go in the middle. That's what I inferred. The wiki never
spells out the chat-card grammar — what statements are valid inside a `chat`
block, in what order, how many of each. I'd want a one-section reference.

## Errors I'd have made trusting JS/TS intuition

- **`equals` as a keyword.** Basic-Logic.md lists both `==` and `equals`. I'd
  never have guessed `equals` is a thing. Likewise `!equals` (used in Fields.md)
  vs `!=` (used in Basic-Logic.md). Pick one.

- **`fleeting`/`eternal` instead of `let`/`const`.** Cute, but I'd auto-type
  `let myVar = 5` and not understand the error. The names are memorable enough
  that I forgive it, but it's a JS-divergence trap.

- **Block scoping inside `if`.** No example shows whether a `fleeting`
  declared inside an `if` is visible outside. I assumed JS-like block scoping;
  could be wrong.

- **`++` / `--`.** They exist. Good. But `self.Level++` is shown in tutorial
  while elsewhere `self.Level += 1` is used. Both fine, but I had to guess that
  `++` works on a `self.X` expression and not just on local fleetings.

- **Strings: `+` for concatenation.** Standard JS-ish, but no mention of
  template literals. If I want `${self.Name} levels up!` I have to use `+`,
  apparently. Worth a sentence.

- **Comments.** `//` works (tutorial uses them). `/* */`? Unknown.

## Wiki gaps

- **No syntax cheat-sheet for the roll mini-language.** "What can go inside
  `roll(...)`" is implicit. d-literals, attribute refs, math, parens — all
  inferred from examples.
- **No "how do I run this" section that doesn't assume VS Code.** The CLAUDE.md
  context mentions a CLI; the wiki tells you "Ctrl+Shift+P → Generate" and
  that's it.
- **No `chat` reference page.** It's used everywhere but never formally
  documented.
- **No documentation for `target`** — appears in the tutorial as
  `if (target is Monster)` with no explanation of where `target` comes from,
  what it is when nothing's targeted, and what the `is` operator does.
- **Field name conventions, casing, reserved words** — none of this is stated.
- **Generated `system.X` paths.** CLAUDE.md tells implementers paths are
  lowercase; the wiki never tells *users* this matters when writing macros or
  Active Effects. Several wiki snippets mix `self.HP` (working code) with
  `system.hp` (path syntax for AEs?) without bridging the two.
- **`section` vs `page` styling differences** are shown by screenshot but the
  layout rules ("left-to-right, top-to-bottom, section is one cell") are buried
  in tutorial prose. They belong on Document.md.

## Things I wanted but couldn't figure out

- **A "miss → mark XP" hook on every move without copy-pasting `self.XP += 1`.**
  Some kind of shared function or "after each roll" callback. Advanced-Logic
  might cover this — I didn't read it deeply — but the wiki should signpost
  "you can extract a function" from Basic-Logic.

- **Class-style hero playbooks.** Tutorial points at `choice<Class> Class(global: true)`
  but doesn't show what fields/actions a `Class` item gets to inject. PbtA
  playbooks are *the* reason someone picks a 2d6 system, and ISDL has no
  obvious way to express "this playbook adds these moves to the hero."

- **Moves as items.** I wanted `Move[] KnownMoves` where each move has its own
  trigger text and resolution logic. I could do this, but I'd be defining
  N actions on the Move item — fine. What I couldn't figure out is how a Move
  item can declare "I work like the standard 2d6+Stat resolver" without each
  one re-implementing the if/else cascade. There's no obvious "trait" or
  "mixin" mechanism.

- **A way to express "the GM picks one of these" choice prompts during an
  action.** PbtA partial-success often presents a list of consequences. The
  Interactivity page presumably covers prompts; the tutorial doesn't show one,
  and I had to leave it as flavor text.

- **A macro-free way to make a roll's flavor text computed.** `flavor "..."`
  takes a string literal. Can it take an expression? Unclear.

## Top concrete suggestions

1. **Add a "Language Quick Reference" page** that's not the Logic Reference —
   one screen of: identifier rules, casing, `==` vs `equals`, `fleeting`/`eternal`,
   roll grammar, comparison operators, scope rules, comment syntax, and what
   `self` / `parent` / `target` resolve to in actor actions vs item actions.
   Right now this is scattered across four pages and partially undocumented.

2. **Document `chat` formally.** A two-paragraph section on Basic-Logic plus a
   reference table: "valid statements inside a chat block: plain string, roll
   variable, `flavor <string>`, `tag <expr>`, ordering rules." This is one of
   the most-used features and has no spec.

3. **Pick an idiomatic style and rewrite examples to match.** Specifically:
   `==` xor `equals` (not both), `roll.total` xor bare-`roll` in comparisons
   (not both), `++` xor `+= 1` (not both), and PascalCase xor camelCase for
   field IDs (not both). Inconsistency in beginner examples teaches readers
   that the rules don't matter, then bites them later.

4. **Make `mod:` truly optional on `attribute` and document the default.** Half
   of TTRPGs don't have a separate score-vs-mod. `attribute Bold(min: -1, max: 3)`
   should just work and use the value as the mod.

5. **Add an "Item Actions" mini-page** covering `self` (the item) vs `parent`
   (owning actor) vs `target` (Foundry target), with one working example each.
   This is currently the single biggest implicit-knowledge gap.

If I had to pick three: **(1)** quick reference, **(3)** consistency pass on
examples, **(5)** item-action scope page. Those would have eliminated 80% of
my guessing.

## Would I recommend ISDL?

Cautiously yes — to a friend who already knows JS, has a small system in mind,
and is willing to keep an example file open for reference. The "Your First
System" tutorial is genuinely excellent and the language hits a real sweet spot
between Simple World Building (too limited) and a hand-rolled Foundry system
(too much yak-shaving). The defaults are smart, the field types map cleanly to
TTRPG concepts, and `health resource HP` is the kind of one-liner that makes
me want to keep using it. But I would *not* recommend it to a non-programmer
based on the wiki alone — the documentation is patchy past the tutorial,
inconsistent in style, and has at least three places where the wiki says
opposite things on the same page. The language seems good; the docs need
another editing pass before they match it.
