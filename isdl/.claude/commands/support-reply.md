---
description: Draft a Discord support reply tailored to the user's experience level and system context
---

Draft a support reply for a Discord user. The reply is surfaced as text for Cody to copy-paste — never sent automatically.

## 0. Parse arguments

`$ARGUMENTS` may be:
- A Discord handle + question: `etermin "why won't my resource bar shrink"`
- Just a question (no handle): `"why won't my resource bar shrink"` — treat as an unknown user
- Empty: ask Cody for the handle and question before continuing

## 1. Load user context

Read `C:\Users\Cody\.claude\projects\F--Programming-Git-intelligent-system-design-language\memory\project-user-roster.md`.

Find the entry for the given handle (case-insensitive, strip leading `.`). Note:
- **Experience level** — this controls vocabulary and how much to explain
- **System they're building** — tailor examples to their domain
- **Active problems** — check if this question is a known open issue or something already being tracked

If the handle isn't in the roster, note that they're an unknown user and proceed with a neutral/intermediate tone.

## 2. Check for existing answers

Quickly check:
- `gh issue list --repo cswendrowski/intelligent-system-design-language --state open --limit 100` — is this a known bug with a workaround or fix in progress?
- Recently closed issues — is this already fixed in the latest release?
- The wiki (`F:\Programming\Git\intelligent-system-design-language.wiki\`) — does the relevant page already document this?

## 3. Draft the reply

Write a Discord reply with these constraints:

**Tone by experience level:**
- *Very low* (.darkangael, drl2): step-by-step, no assumed knowledge, explain what each piece does, offer to help further
- *Low-moderate* (etermin): conversational, show the exact syntax/CSS to use, brief explanation of why it works
- *Moderate* (taikkuus, .hypnobeard, dragonw1414, otg_jendai): direct answer, show the pattern, trust them to adapt it
- *Moderate-high* (horniestlobster): peer-level, terse, point at the exact mechanism or generated code location

**Content:**
- Lead with the answer or workaround, not the explanation
- Include a minimal code snippet when syntax is involved (use code fences)
- If this is a known bug: say so, give the workaround, mention if a fix is in progress
- If this is a missing feature: say it's not supported yet, note if there's a workaround, offer to file an issue
- If the wiki covers it: include the relevant page name for reference
- Keep it short — Discord is a chat, not a ticket

**Do not:**
- Apologize excessively
- Over-explain things they already know (respect their experience level)
- Promise a fix timeline unless one is already committed

## 4. Surface the draft

Show:
1. The drafted reply (ready to copy-paste)
2. One-line context note: what roster entry was used, any linked issue/wiki page found

Ask if Cody wants to edit, send as-is, or discard. Do not post to Discord.
