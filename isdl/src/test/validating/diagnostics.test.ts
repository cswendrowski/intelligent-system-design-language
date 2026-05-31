import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, it, expect } from 'vitest';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';

const services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
const parse = parseHelper(services.IntelligentSystemDesignLanguage);

const CONFIG = 'config T {\n    id = "t"\n}';

async function errors(src: string) {
    const doc = await parse(src, { validation: true });
    return (doc.diagnostics ?? []).filter(d => d.severity === 1);
}

describe('parser diagnostics', () => {

    it('allows references and expressions as array items', async () => {
        // Arrays accept any expression, not just literals (self.X, math, etc.).
        const src = `${CONFIG}\n\nactor A {\n    number Foo\n    number Bar\n    action X {\n        fleeting a = [self.Foo, self.Bar + 1, 3]\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('collapses a syntax error to a single diagnostic instead of a cascade', async () => {
        // An unterminated array is a real syntax error; the recovery cascade must be trimmed to one.
        const src = `${CONFIG}\n\nactor A {\n    action X {\n        fleeting a = [1, 2\n        fleeting b = 3\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(1);
    });

    it('still reports linking errors when the syntax is valid', async () => {
        // Valid syntax but a reference to a field that does not exist -- must NOT be suppressed.
        const src = `${CONFIG}\n\nactor A {\n    number HP(value: { return self.DoesNotExist + 1 })\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /Could not resolve reference/.test(d.message))).toBe(true);
    });

    it('reports no errors for a valid document', async () => {
        const src = `${CONFIG}\n\nactor A {\n    number Foo\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });
});
