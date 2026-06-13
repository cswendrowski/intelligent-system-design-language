/**
 * Single source of truth for in-editor documentation routing.
 *
 * The same short descriptions power three discoverability surfaces:
 *  - the hover provider (keyed by AST `$type`)
 *  - completion items (keyed by the ISDL keyword literal)
 *  - validation diagnostics ("learn more" links via `codeDescription.href`)
 *
 * Every entry carries a `wiki` target (`Page#anchor`, relative to the wiki base) so a
 * user can jump straight from the thing they're looking at to the page that explains it.
 * This is the "I know what I want but can't find the docs" fix: the editor is the index.
 */

export const WIKI_BASE = 'https://github.com/cswendrowski/intelligent-system-design-language/wiki/';

/** Build an absolute wiki URL from a `Page#anchor` target. */
export function wikiUrl(wiki: string): string {
    return WIKI_BASE + wiki;
}

interface DocDef {
    /** Markdown summary shown on hover / in completion documentation. */
    summary: string;
    /** Wiki target as `Page` or `Page#anchor`, relative to {@link WIKI_BASE}. */
    wiki: string;
    /** Short category label shown beside a completion item (defaults to `ISDL`). */
    detail?: string;
    /** AST node `$type` names this entry documents (hover lookup). */
    types?: string[];
    /** ISDL keyword literals this entry documents (completion lookup). */
    keywords?: string[];
}

// Order matters for keywords shared by several constructs (e.g. `choice`, `choices`):
// the first definition listing a keyword wins, so the most common meaning is listed first.
const DOCS: DocDef[] = [
    // ── Simple fields ────────────────────────────────────────────────────────
    { summary: '**string** — A plain text input field.', wiki: 'Fields#string', detail: 'Field', types: ['StringExp'], keywords: ['string'] },
    { summary: '**number** — A numeric input field. Supports `min`, `max`, `initial`, and a calculated `value`.', wiki: 'Fields#number', detail: 'Field', types: ['NumberExp'], keywords: ['number'] },
    { summary: '**boolean** — A true/false checkbox.', wiki: 'Fields#boolean', detail: 'Field', types: ['BooleanExp'], keywords: ['boolean'] },
    { summary: '**html** — A rich text editor field (supports HTML markup).', wiki: 'Fields#html', detail: 'Field', types: ['HtmlExp'], keywords: ['html'] },
    { summary: '**choice\\<string\\>** — A single-select dropdown from a fixed list of string options.', wiki: 'Fields#choice-string', detail: 'Field', types: ['StringChoiceField'], keywords: ['choice'] },
    { summary: '**choice\\<damageType\\>** — A dropdown for selecting a damage type defined in your keywords.', wiki: 'Fields#choice-damagetype-wip', detail: 'Field', types: ['DamageTypeChoiceField'] },
    { summary: '**choices\\<string\\>** — A multi-select field. Accepts up to `max` selections from a fixed list.', wiki: 'Fields#choices-string-multi-select', detail: 'Field', types: ['StringChoicesField'], keywords: ['choices'] },

    // ── Common building blocks ───────────────────────────────────────────────
    { summary: '**resource** — A current/max bar (HP, Mana, etc.). Tag with `health` or `wounds` to mark as the primary pool. Supports `style`, `segments`, `min`, and `max`.', wiki: 'Fields#resource', detail: 'Field', types: ['ResourceExp'], keywords: ['resource'] },
    { summary: '**tracker** — A visual progress tracker. Styles: `bar`, `dial`, `icons`, `slashes`, `segmented`, `clock`, `plain`.', wiki: 'Fields#tracker', detail: 'Field', types: ['TrackerExp'], keywords: ['tracker'] },
    { summary: '**attribute** — A stat with an optional derived `mod`. Make it clickable with `roll:` (posts a standard roll card) or `function:` (calls a no-arg function on this document for full control over the result). Styles: `plain`, `box`.', wiki: 'Fields#attribute', detail: 'Field', types: ['AttributeExp'], keywords: ['attribute'] },
    { summary: '**money** — A currency field. Use `format` (`compact`/`full`/`auto`) and optional denominations block for multi-currency systems.', wiki: 'Fields#money', detail: 'Field', types: ['MoneyField'], keywords: ['money'] },
    { summary: '**measuredTemplate** — A Foundry VTT measured template reference (AoE shapes like circles, cones, rays).', wiki: 'Fields#measured-template', detail: 'Field', types: ['MeasuredTemplateField'], keywords: ['measuredTemplate'] },
    { summary: '**bonuses** — Displays aggregated active-effect damage bonuses by type.', wiki: 'Fields#bonuses', detail: 'Field', types: ['DamageBonusesField'], keywords: ['bonuses'] },
    { summary: '**resistances** — Displays aggregated active-effect damage resistances by type.', wiki: 'Fields#resistances', detail: 'Field', types: ['DamageResistancesField'], keywords: ['resistances'] },
    { summary: '**pinned** — Shows items the player has pinned for quick access.', wiki: 'Fields#pinned-field', detail: 'Field', types: ['PinnedField'], keywords: ['pinned'] },

    // ── Date / time fields ───────────────────────────────────────────────────
    { summary: '**date** — A date picker field.', wiki: 'Fields#date-time-and-datetime', detail: 'Field', types: ['DateExp'], keywords: ['date'] },
    { summary: '**time** — A time picker field.', wiki: 'Fields#date-time-and-datetime', detail: 'Field', types: ['TimeExp'], keywords: ['time'] },
    { summary: '**datetime** — A combined date and time picker field.', wiki: 'Fields#date-time-and-datetime', detail: 'Field', types: ['DateTimeExp'], keywords: ['datetime'] },

    // ── Dice fields ──────────────────────────────────────────────────────────
    { summary: '**die** — A single die type selector (d4, d6, d8, d10, d12, d20, d100).', wiki: 'Fields#die-field', detail: 'Field', types: ['DieField'], keywords: ['die'] },
    { summary: '**dice** — A dice pool selector (NdX). Tracks both count and die size.', wiki: 'Fields#dice-field', detail: 'Field', types: ['DiceField'], keywords: ['dice'] },

    // ── Document links / embeds ──────────────────────────────────────────────
    { summary: '**DocumentType name** — A reference to a single linked item of the specified type.', wiki: 'Fields#single-item', detail: 'Field', types: ['SingleDocumentExp'] },
    { summary: '**choice\\<DocumentType\\>** — A dropdown linking to one item of the specified type.', wiki: 'Fields#document-choice', detail: 'Field', types: ['DocumentChoiceExp'] },
    { summary: '**choices\\<ItemType\\>** — A multi-select field linking to multiple items of the specified type.', wiki: 'Fields#document-choices', detail: 'Field', types: ['DocumentChoicesExp'] },
    { summary: '**inventory\\<ItemType\\>** — A grid-based inventory. Supports slots, rows, columns, quantity tracking, money integration, and weight/value sums.', wiki: 'Fields#inventory-field', detail: 'Field', types: ['InventoryField'], keywords: ['inventory'] },
    { summary: '**table\\<ItemType\\>** — An embedded table listing linked items. Use `fields` to choose columns and `where` to filter.', wiki: 'Fields#table-field', detail: 'Field', types: ['TableField'], keywords: ['table'] },
    { summary: '**macro** — A Foundry VTT macro reference. Execute it in code with `self.Name.execute()`.', wiki: 'Fields#macro-field', detail: 'Field', types: ['MacroField'], keywords: ['macro'] },
    { summary: '**paperdoll** — An image-based equipment slot layout. Drop items onto defined hotspots.', wiki: 'Fields#paper-doll', detail: 'Field', types: ['PaperDollExp'], keywords: ['paperdoll'] },

    // ── Reference fields ─────────────────────────────────────────────────────
    { summary: '**self\\<type\\>** — A mirror of another field on this same document. Changes reflect in real time.', wiki: 'Fields#self-property-reference', detail: 'Field', types: ['SelfPropertyRefExp'], keywords: ['self'] },
    { summary: '**parent\\<type\\>** — A mirror of a field on the owning parent document (e.g. an item reading from its actor).', wiki: 'Fields#parent-property-reference', detail: 'Field', types: ['ParentPropertyRefExp'], keywords: ['parent'] },

    // ── WIP fields ───────────────────────────────────────────────────────────
    { summary: '**damageTrack** ⚠️ *WIP* — A damage track with typed boxes (bashing, lethal, aggravated, etc.). May change in a future version.', wiki: 'Fields#damage-track', detail: 'Field', types: ['DamageTrackExp'], keywords: ['damageTrack'] },

    // ── Documents & configuration ────────────────────────────────────────────
    { summary: '**actor** — Defines an actor document type (characters, NPCs, vehicles). Generates a full character sheet.', wiki: 'Document', detail: 'Document', types: ['Actor'], keywords: ['actor'] },
    { summary: '**item** — Defines an item document type (weapons, spells, skills). Generates an item sheet.', wiki: 'Document', detail: 'Document', types: ['Item'], keywords: ['item'] },
    { summary: '**config** — System-wide configuration: name, id, author, description, and keyword definitions.', wiki: 'Config', detail: 'Configuration', types: ['Config'], keywords: ['config'] },
    { summary: '**keywords** — Defines named keywords that appear as tags in chat cards and rich text. Each keyword can have a `summary`, `color`, and `icon`.', wiki: 'Keywords-and-Journals#keywords-system', detail: 'Configuration', types: ['Keywords'], keywords: ['keywords'] },

    // ── Layout / structure ───────────────────────────────────────────────────
    { summary: '**section** — Groups related fields under a named heading on the sheet.', wiki: 'Document#section', detail: 'Structure', types: ['Section'], keywords: ['section'] },
    { summary: '**page** — Adds a separate tab to the document sheet. Supports `icon` and `background`.', wiki: 'Document#page', detail: 'Structure', types: ['Page'], keywords: ['page'] },
    { summary: '**row** — Arranges child fields horizontally side by side.', wiki: 'Document#row', detail: 'Structure', types: ['Row'], keywords: ['row'] },
    { summary: '**column** — Stacks child fields vertically within a row.', wiki: 'Document#column', detail: 'Structure', types: ['Column'], keywords: ['column'] },

    // ── Executables & logic ──────────────────────────────────────────────────
    { summary: '**action** — A clickable button on the sheet that runs code. Supports `visibility`, `icon`, and `color` params.', wiki: 'Basic-Logic#simple-actions', detail: 'Logic', types: ['Action'], keywords: ['action'] },
    { summary: '**on** — Reacts to a Foundry VTT event (`combatStart`, `roundStart`, `turnStart`, `appliedDamage`, etc.).', wiki: 'Interactivity#event-handling-hook-handlers', detail: 'Logic', types: ['HookHandler'], keywords: ['on'] },
    { summary: '**function** — A reusable named function with typed parameters and an optional `returns` type.', wiki: 'Advanced-Logic#functions', detail: 'Logic', types: ['FunctionDefinition'], keywords: ['function'] },

    // ── Keyword-only logic enrichers (no dedicated AST hover, surfaced in completion) ──
    { summary: '**status** — Defines a status effect (condition) that can appear on the token, optionally gated by a `when:` condition and shown with an icon.', wiki: 'Keywords-and-Journals#status-effects', detail: 'Keyword', keywords: ['status'] },
    { summary: '**health** — Tags a `resource` as the primary health pool: enables damage application and automatic green → yellow → red coloring.', wiki: 'Fields#resource', detail: 'Field tag', keywords: ['health'] },
    { summary: '**prompt** — Pauses an action to ask the player for input (numbers, choices, booleans) through a dialog.', wiki: 'Interactivity#interactive-prompts', detail: 'Logic', keywords: ['prompt'] },
    { summary: '**roll()** — Rolls a dice expression and returns a result you can inspect: `.total`, `.crit`, `.fumble`, `.successes`, plus dice-pool queries.', wiki: 'Basic-Logic#dice-rolling', detail: 'Logic', keywords: ['roll'] },
    { summary: '**chat** — Posts a chat card. Put fields, text, and buttons inside the block to compose the message.', wiki: 'Basic-Logic#chat-cards', detail: 'Logic', keywords: ['chat'] },
    { summary: '**fleeting** — A temporary variable that exists only for the current action or calculation.', wiki: 'Basic-Logic#fleeting-variables', detail: 'Logic', keywords: ['fleeting'] },
];

export interface ResolvedDoc {
    summary: string;
    wiki: string;
    detail: string;
}

/** AST `$type` → documentation, consumed by the hover provider. */
export const TYPE_DOCS: Record<string, ResolvedDoc> = {};
/** ISDL keyword literal → documentation, consumed by the completion provider. */
export const KEYWORD_DOCS: Record<string, ResolvedDoc> = {};

for (const def of DOCS) {
    const resolved: ResolvedDoc = { summary: def.summary, wiki: def.wiki, detail: def.detail ?? 'ISDL' };
    for (const t of def.types ?? []) TYPE_DOCS[t] = resolved;
    for (const k of def.keywords ?? []) {
        if (!(k in KEYWORD_DOCS)) KEYWORD_DOCS[k] = resolved; // first listing wins for shared keywords
    }
}

/** Markdown body for a hover/completion popup: the summary plus a deep link to the wiki. */
export function docMarkdown(entry: ResolvedDoc): string {
    return `${entry.summary}\n\n📖 [Open the docs →](${wikiUrl(entry.wiki)})`;
}

/**
 * Diagnostic options that attach a "learn more" link to a validation message.
 * Spread into a `ValidationAcceptor` options object: the editor renders the code as a
 * clickable link to the relevant wiki page, turning errors into teaching moments.
 */
export function wikiDiagnostic(wiki: string): { code: string; codeDescription: { href: string } } {
    return { code: 'isdl-docs', codeDescription: { href: wikiUrl(wiki) } };
}
