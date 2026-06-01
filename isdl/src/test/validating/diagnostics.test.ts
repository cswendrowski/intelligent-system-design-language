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

    it('allows empty parameter lists on function definitions and calls', async () => {
        const src = `${CONFIG}\n\nactor A {\n    function NoArgs() returns boolean {\n        return true\n    }\n    action Run {\n        fleeting x = self.NoArgs()\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('rejects unsupported field types inside a prompt', async () => {
        const src = `${CONFIG}\n\nactor A {\n    action P {\n        fleeting x = prompt(label: "T") {\n            number Amount\n            resource Bad(max: 10)\n        }\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(1);
        expect(diags[0].message).toContain("can't be used in a prompt");
    });

    it('allows supported input fields inside a prompt', async () => {
        const src = `${CONFIG}\n\nactor A {\n    action P {\n        fleeting x = prompt(label: "T") {\n            string Title\n            number Amount\n            boolean Confirmed\n            choice<string> Kind(choices: ["A", "B"])\n            choices<string> Tags(choices: ["X", "Y"])\n            die Size\n            dice Pool\n        }\n    }\n}`;
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

    it('allows a pure function call inside a calculated value', async () => {
        const src = `${CONFIG}\n\nactor A {\n    function Bonus() returns number {\n        return 5\n    }\n    number Power\n    readonly number Total(value: { return self.Power + self.Bonus() })\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('rejects an impure (rolling) function call inside a calculated value', async () => {
        const src = `${CONFIG}\n\nactor A {\n    function Bonus() returns number {\n        fleeting r = roll(d6)\n        return r.total\n    }\n    number Power\n    readonly number Total(value: { return self.Power + self.Bonus() })\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /calculated value/.test(d.message))).toBe(true);
    });

    it('accepts a rollVisualizer with a literal dice value', async () => {
        const src = `${CONFIG}\n\nactor A {\n    rollVisualizer Preview(value: 2d6 + 3)\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('accepts a rollVisualizer whose value references another field', async () => {
        const src = `${CONFIG}\n\nactor A {\n    number Bonus\n    rollVisualizer Preview(value: 2d6 + self.Bonus, label: "Expected")\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('rejects a rollVisualizer with no value: param', async () => {
        const src = `${CONFIG}\n\nactor A {\n    rollVisualizer Preview(label: "Expected")\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /requires a value:/.test(d.message))).toBe(true);
    });

    it('allows a rollVisualizer inside a prompt', async () => {
        const src = `${CONFIG}\n\nactor A {\n    action P {\n        fleeting x = prompt(label: "T") {\n            number Amount\n            rollVisualizer Preview(value: 2d6 + 1)\n        }\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('allows a prompt rollVisualizer to reference a sibling input via input.X', async () => {
        const src = `${CONFIG}\n\nactor A {\n    number WeaponBonus\n    action P {\n        fleeting o = prompt(label: "T") {\n            number Boons(min: 0)\n            rollVisualizer Preview(value: 2d6 + input.Boons + self.WeaponBonus)\n        }\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('allows input.X referencing dice, die, and number prompt inputs', async () => {
        const src = `${CONFIG}\n\nactor A {\n    action P {\n        fleeting o = prompt(label: "T") {\n            dice DamageDice\n            die BonusDie\n            number FlatBonus\n            rollVisualizer Preview(value: input.DamageDice + input.BonusDie + input.FlatBonus)\n        }\n    }\n}`;
        const diags = await errors(src);
        expect(diags).toHaveLength(0);
    });

    it('rejects input.X used outside a prompt', async () => {
        const src = `${CONFIG}\n\nactor A {\n    number Boons\n    rollVisualizer Preview(value: 2d6 + input.Boons)\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /can only be used inside a prompt/.test(d.message))).toBe(true);
    });

    it('rejects input.X used outside a rollVisualizer', async () => {
        const src = `${CONFIG}\n\nactor A {\n    action P {\n        fleeting o = prompt(label: "T") {\n            number Boons\n            number Bad(value: { return input.Boons + 1 })\n        }\n    }\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /only supported inside a rollVisualizer/.test(d.message))).toBe(true);
    });

    it('rejects a function that mutates self (++/+=) inside a calculated value', async () => {
        // self.X++ is an IncrementDecrementAssignment (a grammar union member) — a document write,
        // not pure. Guard-based detection must catch it, not just literal "Assignment" $type.
        const src = `${CONFIG}\n\nactor A {\n    number Counter\n    function Bonus() returns number {\n        self.Counter++\n        return 1\n    }\n    number Power\n    readonly number Total(value: { return self.Power + self.Bonus() })\n}`;
        const diags = await errors(src);
        expect(diags.some(d => /calculated value/.test(d.message))).toBe(true);
    });
});
