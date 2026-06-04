import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, it, expect } from 'vitest';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';

const services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
const parse = parseHelper(services.IntelligentSystemDesignLanguage);

async function errors(src: string) {
    const doc = await parse(src, { validation: true });
    return (doc.diagnostics ?? []).filter(d => d.severity === 1);
}

// A config whose `theme { }` body is filled in per-test, plus a minimal actor whose
// `attribute Luck` carries an optional per-field `theme: { }` override.
const sys = (themeBody: string, luckParams = '') => `config T {
    id = "t"
    theme {
${themeBody}
    }
}
actor A {
    attribute Luck(${luckParams})
}`;

describe('theme token scope validation', () => {

    it('accepts a valid global theme (palette + config-scope groups)', async () => {
        const src = sys(`        primary: #112233,
        secondary: #223344,
        background: #334455,
        text: #445566,
        border { color: #556677, width: 2, radius: 4 },
        font { family: "Roboto", size: 14 },
        heading { color: #667788, transform: "uppercase" },
        disabledText { color: #778899 }`);
        expect(await errors(src)).toHaveLength(0);
    });

    it('rejects width in the global theme (field-only)', async () => {
        const errs = await errors(sys(`        primary: #112233,
        width { min: 50px }`));
        expect(errs.some(e => e.message.includes("'width'"))).toBe(true);
    });

    it('rejects height in the global theme (field-only)', async () => {
        const errs = await errors(sys(`        height { max: 100px }`));
        expect(errs.some(e => e.message.includes("'height'"))).toBe(true);
    });

    it('accepts field-capable tokens per-field (primary/border/width/height)', async () => {
        const src = sys(`        primary: #112233`,
            `theme: { primary: #8b1e1e, border: { color: #8b1e1e, width: 3px }, width: { min: 120px, max: 240px }, height: { min: 40px } }`);
        expect(await errors(src)).toHaveLength(0);
    });

    it('rejects each config-only token used per-field', async () => {
        const badTokens = [
            ['secondary', 'secondary: #223344'],
            ['tertiary', 'tertiary: #223344'],
            ['background', 'background: #223344'],
            ['text', 'text: #223344'],
            ['font', 'font: { family: "Roboto" }'],
            ['heading', 'heading: { color: #223344 }'],
            ['disabledText', 'disabledText: { color: #223344 }'],
        ];
        for (const [label, frag] of badTokens) {
            const errs = await errors(sys(`        primary: #112233`, `theme: { ${frag} }`));
            expect(errs.some(e => e.message.includes(`'${label}'`)), `${label} should be rejected per-field`).toBe(true);
        }
    });

    it('parses the JSON-ish per-field style (colon groups, commas, px) with no errors', async () => {
        // The user's literal example shape: `theme: { primary: #x, width: { min: 50px, max: 100px } }`.
        const src = sys(`        primary: #112233`,
            `theme: { primary: #8b1e1e, width: { min: 50px, max: 100px } }`);
        expect(await errors(src)).toHaveLength(0);
    });

    it('requires commas between entries (terse no-comma style is rejected)', async () => {
        // Theme entries are comma-separated like every other param list. Two top-level tokens
        // with no comma between them must NOT parse.
        const missingTopLevel = await errors(sys(`        primary: #112233
        secondary: #223344`));
        expect(missingTopLevel.length).toBeGreaterThan(0);

        // Same inside a group: `color: #x width: 2` (no comma) is a parse error.
        const missingInGroup = await errors(sys(`        border { color: #556677 width: 2 }`));
        expect(missingInGroup.length).toBeGreaterThan(0);

        // The comma-separated form parses clean (optional colon before the group brace still allowed).
        const ok = await errors(sys(`        primary: #112233,
        border: { color: #556677, width: 2, radius: 4 }`));
        expect(ok).toHaveLength(0);
    });
});

// A minimal actor with a single page whose layout container carries the per-test `theme:`.
const layoutSys = (container: string) => `config T { id = "t" }
actor A {
    page Main {
        ${container} {
            attribute Luck
        }
    }
}`;

describe('layout-container theme scope validation', () => {

    it('accepts sizing + border on a row', async () => {
        expect(await errors(layoutSys(`row(theme: { width: { max: 800px }, height: { min: 120px }, border: { color: #223344, width: 2px } })`))).toHaveLength(0);
    });

    it('accepts sizing + border on a column', async () => {
        expect(await errors(layoutSys(`column(theme: { width: { min: 80px, max: 160px }, border: { color: #223344, radius: 8px } })`))).toHaveLength(0);
    });

    it('rejects background on a row (fill is section-only)', async () => {
        const errs = await errors(layoutSys(`row(theme: { background: #223344 })`));
        expect(errs.some(e => e.message.includes("'background'") && e.message.includes('row'))).toBe(true);
    });

    it('rejects text on a column (fill is section-only)', async () => {
        const errs = await errors(layoutSys(`column(theme: { text: #223344 })`));
        expect(errs.some(e => e.message.includes("'text'") && e.message.includes('column'))).toBe(true);
    });

    it('accepts sizing + box chrome on a section', async () => {
        const src = layoutSys(`section S(theme: { width: { max: 640px }, border: { color: #223344, width: 2px, radius: 12px }, background: #1a1410, text: #f0e6d2 })`);
        expect(await errors(src)).toHaveLength(0);
    });

    it('rejects a whole-sheet token (font) on a section', async () => {
        const errs = await errors(layoutSys(`section S(theme: { font: { family: "Roboto" } })`));
        expect(errs.some(e => e.message.includes("'font'") && e.message.includes('section'))).toBe(true);
    });

    it('rejects heading on a section', async () => {
        const errs = await errors(layoutSys(`section S(theme: { heading: { color: #223344 } })`));
        expect(errs.some(e => e.message.includes("'heading'") && e.message.includes('section'))).toBe(true);
    });
});
