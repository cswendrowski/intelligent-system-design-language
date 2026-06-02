import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, it, expect } from 'vitest';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';

const services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
const parse = parseHelper(services.IntelligentSystemDesignLanguage);

// A config with one setting per scope/type, used by the read/write tests.
const SETTINGS = `config T {
    id = "t"
    settings {
        client {
            boolean ShowToHit(initial: true, hint: "Show to-hit on sheets")
        }
        world {
            number StartingKarma(initial: 3)
            string Motto(initial: "onward")
            choice<string> KarmaInChat(choices: ["Never", "GM Only", "Everyone"], initial: "GM Only")
        }
    }
}`;

async function errors(src: string) {
    const doc = await parse(src, { validation: true });
    return (doc.diagnostics ?? []).filter(d => d.severity === 1);
}

describe('system settings', () => {

    it('parses a settings block with all four types across both scopes', async () => {
        const diags = await errors(SETTINGS + `\n\nactor A {\n    number Foo\n}`);
        expect(diags).toHaveLength(0);
    });

    it('resolves System.X reads in logic', async () => {
        const src = SETTINGS + `\n\nactor A {\n    action X {\n        fleeting k = System.StartingKarma\n        if (System.ShowToHit) {\n            log("yes")\n        }\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('resolves System.X in a calculated value: (return path)', async () => {
        const src = SETTINGS + `\n\nactor A {\n    number Bar(value: { return System.StartingKarma + 1 })\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('resolves System.X in a visibility: method block', async () => {
        const src = SETTINGS + `\n\nactor A {\n    string Foo(visibility: { if (System.ShowToHit) { return Visibility.default } return Visibility.hidden })\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('does NOT parse a bare System.X in visibility: (must be a method block)', async () => {
        // visibility: is (VisibilityValue | MethodBlock); SystemSettingAccess lives in
        // PrimitiveExpression, not MethodBlockExpression, so a bare form is a syntax error.
        const src = SETTINGS + `\n\nactor A {\n    string Foo(visibility: System.ShowToHit)\n}`;
        const diags = await errors(src);
        expect(diags.length).toBeGreaterThan(0);
    });

    it('errors on an unknown System.X reference', async () => {
        const src = SETTINGS + `\n\nactor A {\n    action X {\n        fleeting k = System.DoesNotExist\n    }\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /Could not resolve reference/.test(d.message))).toBe(true);
    });

    it('allows writing a client-scoped setting without a GM check', async () => {
        const src = SETTINGS + `\n\nactor A {\n    action X {\n        System.ShowToHit = false\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('rejects writing a world-scoped setting without a GM check', async () => {
        const src = SETTINGS + `\n\nactor A {\n    action X {\n        System.StartingKarma = 5\n    }\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /only succeeds for a GM/.test(d.message))).toBe(true);
    });

    it('allows writing a world-scoped setting inside if (User.isGM)', async () => {
        const src = SETTINGS + `\n\nactor A {\n    action X {\n        if (User.isGM) {\n            System.StartingKarma = 5\n        }\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('rejects an initial value whose type does not match the keyword', async () => {
        const src = `config T {\n    id = "t"\n    settings {\n        client {\n            boolean Bad(initial: 3)\n        }\n    }\n}\n\nactor A {\n    number Foo\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /true\/false initial value/.test(d.message))).toBe(true);
    });

    it('requires a choices list on a choice<string> setting', async () => {
        const src = `config T {\n    id = "t"\n    settings {\n        world {\n            choice<string> Bad\n        }\n    }\n}\n\nactor A {\n    number Foo\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /requires a non-empty 'choices:' list/.test(d.message))).toBe(true);
    });

    it('rejects an initial value not present in the choices list', async () => {
        const src = `config T {\n    id = "t"\n    settings {\n        world {\n            choice<string> Bad(choices: ["A", "B"], initial: "C")\n        }\n    }\n}\n\nactor A {\n    number Foo\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /is not one of the listed choices/.test(d.message))).toBe(true);
    });

    it('rejects choices on a non-choice setting', async () => {
        const src = `config T {\n    id = "t"\n    settings {\n        client {\n            boolean Bad(choices: ["A"])\n        }\n    }\n}\n\nactor A {\n    number Foo\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /only valid on a choice<string> setting/.test(d.message))).toBe(true);
    });
});
