---
description: Draft release notes for the next GitHub release in the project's terse style
---

Draft release notes for a new ISDL release. Present the draft for approval — do not create or publish the release until explicitly told to.

## 0. Parse arguments

`$ARGUMENTS` may be:
- A tag range: `0.3.27..HEAD` or `v0.3.27..HEAD`
- A single base tag: `0.3.27` (means `0.3.27..HEAD`)
- A version number for the new release: `0.3.29`
- Empty: auto-detect (see step 1)

## 1. Gather commits

If no base tag given, find the most recent release tag:
```
gh release list --repo cswendrowski/intelligent-system-design-language --limit 5
```

Then get commits since that tag:
```
git log <last-tag>..HEAD --oneline
```

Also check for any issues closed by these commits:
```
gh issue list --repo cswendrowski/intelligent-system-design-language --state closed --limit 50
```
Cross-reference commit messages for `#NNN` references or "fixes/closes" language.

## 2. Read past release notes for style

```
gh release view <last-tag> --repo cswendrowski/intelligent-system-design-language
```

The house style is:
- **Plain bullet list** — `* ` prefix, no headers, no preamble, no "What's Changed" boilerplate
- **One change per bullet**, leading with a verb: "Added", "Fixed", "Removed", "Improved"
- **Backtick ISDL keywords/fields/params**: `roll()`, `crit:`, `attribute`, `hideLabel:`, `sheetStyles`
- **Author-focused**: describe what a system author can now *do*, not how codegen works internally
- **Skip** internal refactors, dependency bumps, and changes invisible to system authors
- Most releases are 2–4 bullets

## 3. Draft the notes

Synthesize the commits and closed issues into release notes following the style above. For each bullet:
- Confirm it's user-visible (skip pure internals)
- Use present tense for new capabilities ("Added X"), past tense for fixes ("Fixed Y not working when Z")
- Add a tiny inline example if it clarifies a new syntax: `` `hideLabel: true` on a section now hides its title ``
- If a screenshot would help (new UI feature, chat card, visualizer), note "consider attaching screenshot of X"

## 4. Determine version number

If not provided in arguments, suggest the next patch version (e.g. `0.3.28` → `0.3.29`). Note if the change set warrants a minor bump instead.

## 5. Present the draft

Show:
- Proposed version tag
- Full release notes body (ready to paste)
- Any commits that were ambiguous or skipped, with a one-line reason

### Who cares about this release?

Cross-reference the roster at `C:\Users\Cody\.claude\projects\F--Programming-Git-intelligent-system-design-language\memory\project-user-roster.md` against the changes:
- For each user, check if any new feature or fix directly addresses their system, active problems, or stated needs
- List users who are **directly affected** (their filed issue was fixed, or they explicitly asked for this feature) separately from users who are **likely interested** (the feature matches their domain/system)
- If a user filed the issue that was fixed, call that out explicitly — they should be pinged

Show as a table: Handle | Why they care | Priority (ping now / mention in release)

Ask which items to keep, edit, or drop, and whether to proceed with creating the release.

## 6. Create the release on approval

When explicitly approved:
```
gh release create <tag> --repo cswendrowski/intelligent-system-design-language \
  --title "<tag>" \
  --notes "<approved body>"
```

Report back the release URL.
