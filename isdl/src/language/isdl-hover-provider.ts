import type { AstNode } from 'langium';
import type { Hover, HoverParams } from 'vscode-languageserver';
import type { LangiumDocument } from 'langium';
import type { MaybePromise } from 'langium';
import type { HoverProvider } from 'langium/lsp';
import { CstUtils } from 'langium';

const FIELD_DOCS: Record<string, string> = {
    // Basic fields
    StringExp:              '**string** — A plain text input field.',
    NumberExp:              '**number** — A numeric input field. Supports `min`, `max`, `initial`, and a calculated `value`.',
    BooleanExp:             '**boolean** — A true/false checkbox.',
    HtmlExp:                '**html** — A rich text editor field (supports HTML markup).',
    StringChoiceField:      '**choice\\<string\\>** — A single-select dropdown from a fixed list of string options.',
    DamageTypeChoiceField:  '**choice\\<damageType\\>** — A dropdown for selecting a damage type defined in your keywords.',
    StringChoicesField:     '**choices\\<string\\>** — A multi-select field. Accepts up to `max` selections from a fixed list.',

    // Complex fields
    ResourceExp:            '**resource** — A current/max bar (HP, Mana, etc.). Tag with `health` or `wounds` to mark as the primary pool. Supports `style`, `segments`, `min`, and `max`.',
    TrackerExp:             '**tracker** — A visual progress tracker. Styles: `bar`, `dial`, `icons`, `slashes`, `segmented`, `clock`, `plain`.',
    AttributeExp:           '**attribute** — A stat with an optional derived `mod` and an optional `roll` expression. Styles: `plain`, `box`.',
    MeasuredTemplateField:  '**measuredTemplate** — A Foundry VTT measured template reference (AoE shapes like circles, cones, rays).',
    DamageBonusesField:     '**bonuses** — Displays aggregated active-effect damage bonuses by type.',
    DamageResistancesField: '**resistances** — Displays aggregated active-effect damage resistances by type.',
    MoneyField:             '**money** — A currency field. Use `format` (`compact`/`full`/`auto`) and optional denominations block for multi-currency systems.',
    PinnedField:            '**pinned** — Shows items the player has pinned for quick access.',
    DocumentChoicesExp:     '**choices\\<ItemType\\>** — A multi-select field linking to multiple items of the specified type.',

    // WIP fields
    DamageTrackExp:         '**damageTrack** ⚠️ *WIP* — A damage track with typed boxes (bashing, lethal, aggravated, etc.). May change in a future version.',

    // Date/Time fields
    DateExp:                '**date** — A date picker field.',
    TimeExp:                '**time** — A time picker field.',
    DateTimeExp:            '**datetime** — A combined date and time picker field.',

    // Dice fields
    DieField:               '**die** — A single die type selector (d4, d6, d8, d10, d12, d20, d100).',
    DiceField:              '**dice** — A dice pool selector (NdX). Tracks both count and die size.',

    // Document fields
    SingleDocumentExp:      '**DocumentType name** — A reference to a single linked item of the specified type.',
    DocumentChoiceExp:      '**choice\\<DocumentType\\>** — A dropdown linking to one item of the specified type.',
    InventoryField:         '**inventory\\<ItemType\\>** — A grid-based inventory. Supports slots, rows, columns, quantity tracking, money integration, and weight/value sums.',
    MacroField:             '**macro** — A Foundry VTT macro reference. Execute it in code with `self.Name.execute()`.',
    TableField:             '**table\\<ItemType\\>** — An embedded table listing linked items. Use `fields` to choose columns and `where` to filter.',
    PaperDollExp:           '**paperdoll** — An image-based equipment slot layout. Drop items onto defined hotspots.',

    // Reference fields
    SelfPropertyRefExp:     '**self\\<type\\>** — A mirror of another field on this same document. Changes reflect in real time.',
    ParentPropertyRefExp:   '**parent\\<type\\>** — A mirror of a field on the owning parent document (e.g. an item reading from its actor).',

    // Layout / structure
    Actor:                  '**actor** — Defines an actor document type (characters, NPCs, vehicles). Generates a full character sheet.',
    Item:                   '**item** — Defines an item document type (weapons, spells, skills). Generates an item sheet.',
    Config:                 '**config** — System-wide configuration: name, id, author, description, and keyword definitions.',
    Keywords:               '**keywords** — Defines named keywords that appear as tags in chat cards and rich text. Each keyword can have a `summary`, `color`, and `icon`.',
    Section:                '**section** — Groups related fields under a named heading on the sheet.',
    Page:                   '**page** — Adds a separate tab to the document sheet. Supports `icon` and `background`.',
    Tab:                    '**tab** — A sub-tab inside a page. Supports `icon` and `label`.',
    Row:                    '**row** — Arranges child fields horizontally side by side.',
    Column:                 '**column** — Stacks child fields vertically within a row.',

    // Executables
    Action:                 '**action** — A clickable button on the sheet that runs code. Supports `visibility`, `icon`, and `color` params.',
    HookHandler:            '**on** — Reacts to a Foundry VTT event (`combatStart`, `roundStart`, `turnStart`, `appliedDamage`, etc.).',
    FunctionDefinition:     '**function** — A reusable named function with typed parameters and an optional `returns` type.',
};

export class IsdlHoverProvider implements HoverProvider {

    getHoverContent(document: LangiumDocument, params: HoverParams): MaybePromise<Hover | undefined> {
        const rootCst = document.parseResult?.value?.$cstNode;
        if (!rootCst) return undefined;

        const offset = document.textDocument.offsetAt(params.position);
        const leaf = CstUtils.findLeafNodeAtOffset(rootCst, offset);
        if (!leaf) return undefined;

        // Walk up the AST container chain until we find a type with docs
        let node: AstNode | undefined = leaf.astNode;
        while (node) {
            const doc = FIELD_DOCS[node.$type];
            if (doc) {
                return { contents: { kind: 'markdown', value: doc } };
            }
            node = node.$container;
        }

        return undefined;
    }
}

