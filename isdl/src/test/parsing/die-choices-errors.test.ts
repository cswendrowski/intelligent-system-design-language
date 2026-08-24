import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, it, expect } from 'vitest';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';
import { Entry } from '../../language/generated/ast.js';

const services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
const parse = parseHelper<Entry>(services.IntelligentSystemDesignLanguage);

const PREAMBLE = `config T {
    id = "t"
}
`;

async function parseErrors(src: string) {
    const doc = await parse(PREAMBLE + src);
    return doc.parseResult.parserErrors.map(e => e.message);
}

describe('quoted dice in a choices: list', () => {

    it('explains that dice sizes are unquoted', async () => {
        const errors = await parseErrors(`actor A {
    die Attack(choices: ["d4", "d6"])
}`);
        expect(errors.join('\n')).toMatch(/written without quotes/);
        expect(errors.join('\n')).toContain('use `d4` instead of "d4"');
    });

    it('handles suffixed and multi-dice sizes', async () => {
        const exploding = await parseErrors(`actor A {
    die Attack(choices: ["d6x"])
}`);
        expect(exploding.join('\n')).toContain('use `d6x` instead of "d6x"');

        const pool = await parseErrors(`actor A {
    dice Pool(choices: ["2d6"])
}`);
        expect(pool.join('\n')).toContain('use `2d6` instead of "2d6"');
    });

    it('fires on a later item too, not just the first', async () => {
        const errors = await parseErrors(`actor A {
    die Attack(choices: [d4, "d6"])
}`);
        expect(errors.join('\n')).toContain('use `d6` instead of "d6"');
    });

    it('leaves ordinary string choices alone', async () => {
        // choice<string> lists really are quoted -- these must parse cleanly.
        const errors = await parseErrors(`actor A {
    choice<string> Kind(choices: ["Alpha", "Beta"])
}`);
        expect(errors).toHaveLength(0);
    });

    it('does not hijack the missing-comma message for text choices', async () => {
        const errors = await parseErrors(`actor A {
    choice<string> Kind(choices: ["Alpha" "Beta"])
}`);
        expect(errors.join('\n')).toMatch(/Missing comma/);
    });

    it('parses bare dice sizes without error', async () => {
        const errors = await parseErrors(`actor A {
    die Attack(choices: [d4, d6, d8])
    dice Pool(choices: [d6, d10])
}`);
        expect(errors).toHaveLength(0);
    });
});
