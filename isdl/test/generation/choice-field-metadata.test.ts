import { beforeAll, describe, expect, test } from 'vitest';
import { EmptyFileSystem } from "langium";
import { parseHelper } from "langium/test";
import { createIntelligentSystemDesignLanguageServices } from '../../src/language/intelligent-system-design-language-module.js';
import { getSystemPath } from '../../src/cli/components/utils.js';
import { Entry, Property, isProperty, isEntry } from '../../src/language/generated/ast.js';

let services: ReturnType<typeof createIntelligentSystemDesignLanguageServices>;
let parse: ReturnType<typeof parseHelper<Entry>>;

beforeAll(async () => {
    services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
    const doParse = parseHelper<Entry>(services.IntelligentSystemDesignLanguage);
    parse = (input: string) => doParse(input, { validation: false });
});

describe('Choice Field Metadata Access', () => {
    test('should generate correct system path for choice field metadata', async () => {
        const text = `
config TestSystem {
    label = "Test System"
    id = "test-system"
}

actor Character {
    choice<string> Training(choices: [
        { value: "Melee", bonus: 2 },
        { value: "Ranged", bonus: 3 }
    ])
}
        `;

        const document = await parse(text);
        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);
        const entry = document.parseResult.value as Entry;
        const character = entry.documents.find(d => d.name === 'Character')!;
        const training = character.body.find(p => isProperty(p) && p.name === 'Training') as Property;
        
        // Test metadata access: self.Training.bonus should generate system.training.bonus
        const metadataPath = getSystemPath(training, ['bonus'], undefined, false);
        expect(metadataPath).toBe('system.training.bonus');
        
        // Test with safe access
        const metadataPathSafe = getSystemPath(training, ['bonus'], undefined, true);
        expect(metadataPathSafe).toBe('system.training?.bonus');
    });

    test('should generate correct system path for choice field value access', async () => {
        const text = `
config TestSystem {
    label = "Test System"
    id = "test-system"
}

actor Character {
    choice<string> Training(choices: [
        { value: "Melee", bonus: 2 },
        { value: "Ranged", bonus: 3 }
    ])
}
        `;

        const document = await parse(text);
        const entry = document.parseResult.value as Entry;
        const character = entry.documents.find(d => d.name === 'Character')!;
        const training = character.body.find(p => isProperty(p) && p.name === 'Training') as Property;
        
        // Test value access: self.Training should generate system.training.value
        const valuePath = getSystemPath(training, [], undefined, false);
        expect(valuePath).toBe('system.training.value');
        
        // Test with safe access
        const valuePathSafe = getSystemPath(training, [], undefined, true);
        expect(valuePathSafe).toBe('system.training.value');
    });

    test('should handle multiple metadata properties', async () => {
        const text = `
config TestSystem {
    label = "Test System"
    id = "test-system"
}

actor Character {
    choice<string> Equipment(choices: [
        { value: "Sword", bonus: 2, weight: 3, cost: 100 },
        { value: "Bow", bonus: 3, weight: 2, cost: 150 }
    ])
}
        `;

        const document = await parse(text);
        const entry = document.parseResult.value as Entry;
        const character = entry.documents.find(d => d.name === 'Character')!;
        const equipment = character.body.find(p => isProperty(p) && p.name === 'Equipment') as Property;
        
        // Test different metadata properties
        expect(getSystemPath(equipment, ['bonus'], undefined, false)).toBe('system.equipment.bonus');
        expect(getSystemPath(equipment, ['weight'], undefined, false)).toBe('system.equipment.weight');
        expect(getSystemPath(equipment, ['cost'], undefined, false)).toBe('system.equipment.cost');
    });
});
