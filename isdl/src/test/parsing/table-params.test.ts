import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, it, expect } from 'vitest';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';
import {
    Entry,
    isActor,
    isTableField,
    isTableSortableParam,
    isTableSearchableParam,
    isTablePinnableParam,
} from '../../language/generated/ast.js';

const services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
const parse = parseHelper<Entry>(services.IntelligentSystemDesignLanguage);

const PREAMBLE = `config T {
    id = "t"
}

item Spell {
    string Kind
}
`;

async function parseEntry(src: string) {
    const doc = await parse(PREAMBLE + src, { validation: true });
    const diags = (doc.diagnostics ?? []).filter(d => d.severity === 1);
    return { entry: doc.parseResult.value, diags };
}

function tableParams(entry: Entry, tableName: string) {
    const actor = entry.documents.find(isActor);
    const table = actor!.body.find(p => isTableField(p) && p.name === tableName);
    return (table as any)?.params ?? [];
}

describe('table view-preference params', () => {

    it('parses sortable:/searchable:/pinnable: with no validation errors', async () => {
        const { entry, diags } = await parseEntry(`actor A {
    table<Spell> Spells(sortable: false, searchable: false, pinnable: false)
}`);
        expect(diags).toHaveLength(0);

        const params = tableParams(entry, 'Spells');
        expect(params.find((p: any) => isTableSortableParam(p))?.value).toBe(false);
        expect(params.find((p: any) => isTableSearchableParam(p))?.value).toBe(false);
        expect(params.find((p: any) => isTablePinnableParam(p))?.value).toBe(false);
    });

    it('accepts the params with true values too', async () => {
        const { entry, diags } = await parseEntry(`actor A {
    table<Spell> Spells(sortable: true, searchable: true, pinnable: true)
}`);
        expect(diags).toHaveLength(0);

        const params = tableParams(entry, 'Spells');
        expect(params.find((p: any) => isTableSortableParam(p))?.value).toBe(true);
    });

    it('parses readonly modifier independently of the params', async () => {
        const { entry, diags } = await parseEntry(`actor A {
    readonly table<Spell> Locked(sortable: false)
}`);
        expect(diags).toHaveLength(0);

        const actor = entry.documents.find(isActor);
        const table = actor!.body.find(p => isTableField(p) && p.name === 'Locked') as any;
        expect(table.modifier).toBe('readonly');
        expect(table.params.find((p: any) => isTableSortableParam(p))?.value).toBe(false);
    });
});
