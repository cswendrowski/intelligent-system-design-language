---
description: Check whether recent features have wiki coverage and draft any missing or outdated page updates
---

Audit wiki coverage for recently shipped features and draft updates. Present all changes for approval — do not write wiki files until explicitly told to.

## 0. Parse arguments

`$ARGUMENTS` may be:
- A feature name or keyword: `hideLabel`, `image field`, `rollVisualizer`
- A tag or commit range: `0.3.27..HEAD`
- Empty: default to commits since the most recent release tag

## 1. Identify features to check

If a specific feature was given, use that. Otherwise:

```
gh release list --repo cswendrowski/intelligent-system-design-language --limit 3
git log <last-tag>..HEAD --oneline
```

Extract user-visible features from the commit/release list — skip pure bugfixes and internal changes.

## 2. Map features to wiki pages

Wiki lives at `F:\Programming\Git\intelligent-system-design-language.wiki\`.

Use this mapping as a starting point (not exhaustive):
- New field type → `Fields.md`, possibly a new dedicated page
- New config param / top-level keyword → `Config.md`
- New logic function or operator → `Basic-Logic.md` or `Advanced-Logic.md`, `Logic-Reference.md`
- New interactivity feature (prompt, chat, visibility) → `Interactivity.md`
- Settings, keywords, journals → `Keywords-and-Journals.md`
- Common patterns / recipes → `Recipes.md`
- Quick-reference syntax → `Keywords-Quick-Reference.md`
- GitHub integration → `GitHub-Integration.md`

Read the relevant pages for each feature.

## 3. Identify gaps and stale content

For each feature, classify each relevant page as:
- **Missing**: the feature isn't mentioned at all
- **Stub**: mentioned but no usage example, parameter docs, or explanation
- **Stale**: documented but the syntax or behavior has changed
- **Covered**: complete and accurate — no action needed

Also check:
- `_Sidebar.md` — is the feature discoverable from the nav?
- `Home.md` — should it appear in the key features or core concepts list?
- Cross-links — do related pages link to each other where helpful?

## 4. Draft updates

For each gap or stale entry, draft the wiki content following these conventions:

**Structure:**
- Start with a clear overview sentence
- Show a complete working ISDL example (use code fences with `isdl` language tag)
- Document all parameters in a table or list: name, type, default, description
- Include a "Generated output" section if showing Foundry behavior helps
- End with any gotchas, limitations, or related features

**Style:**
- Practical over comprehensive — system authors want to copy-paste and go
- Second person: "You can use X to…"
- Parameter names in backticks
- Link to related pages with `[Page Name](Page-Name)` (wiki link format)

**Scope:**
- Don't rewrite pages that are mostly fine — surgical additions only
- If a new page is warranted (major feature), draft the full page and note where to add it to `_Sidebar.md`

## 5. Present the draft

For each affected file, show:
- File path
- Proposed diff (or full content if it's a new file)
- One-line rationale (what was missing / what changed)

List any features that appear covered (no action needed) so Cody can confirm the audit was complete.

Ask which updates to apply, skip, or revise.

## 6. Apply on approval

For each approved change, write the file to `F:\Programming\Git\intelligent-system-design-language.wiki\`.

Report which files were updated.
