import { EmptyFileSystem } from 'langium';
import { expectFormatting } from 'langium/test';
import { describe, it } from 'vitest';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';

const services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
const format = expectFormatting(services.IntelligentSystemDesignLanguage);

// Pre-formatted config block so test diffs focus on attribute behavior only.
const CONFIG = 'config T {\n    id = "t"\n}';
function inActor(attributeLine: string): string {
    return `${CONFIG}\n\nactor A {\n${attributeLine}\n}`;
}

describe('attribute formatter', () => {

    it('leaves simple params unchanged', async () => {
        const src = inActor('    attribute Fight(min: 1, max: 20)');
        await format({ before: src, after: src });
    });

    it('leaves attribute with no params unchanged', async () => {
        const src = inActor('    attribute Fight');
        await format({ before: src, after: src });
    });

    it('wraps mod: to a new indented line', async () => {
        await format({
            before: inActor('    attribute Fight(min: 1, max: 20, mod: { return 1 })'),
            after:  inActor('    attribute Fight(min: 1, max: 20,\n        mod: {\n            return 1\n        })')
        });
    });

    it('wraps roll: to a new indented line', async () => {
        await format({
            before: inActor('    attribute Fight(min: 1, max: 20, roll: roll(d20))'),
            after:  inActor('    attribute Fight(min: 1, max: 20,\n        roll: roll(d20))')
        });
    });

    it('wraps both mod: and roll: to new indented lines', async () => {
        await format({
            before: inActor('    attribute Fight(min: 1, max: 20, mod: { return (self.Fight - 10) / 2 }, roll: roll(d20 + self.Fight.mod))'),
            after:  inActor('    attribute Fight(min: 1, max: 20,\n        mod: {\n            return (self.Fight - 10) / 2\n        },\n        roll: roll(d20 + self.Fight.mod))')
        });
    });

    it('wraps mod: when it is the only param', async () => {
        await format({
            before: inActor('    attribute Fight(mod: { return 5 })'),
            after:  inActor('    attribute Fight(\n        mod: {\n            return 5\n        })')
        });
    });
});
