import { beforeAll, describe, expect, test } from 'vitest';
import { EmptyFileSystem } from "langium";
import { parseHelper } from "langium/test";
import { createIntelligentSystemDesignLanguageServices } from '../../src/language/intelligent-system-design-language-module.js';
import { Entry, Property, isProperty, isEntry } from '../../src/language/generated/ast.js';

let services: ReturnType<typeof createIntelligentSystemDesignLanguageServices>;
let parse: ReturnType<typeof parseHelper<Entry>>;

beforeAll(async () => {
    services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
    const doParse = parseHelper<Entry>(services.IntelligentSystemDesignLanguage);
    parse = (input: string) => doParse(input, { validation: false });
});

describe('Play Visibility Mode', () => {
    test('should parse play modifier correctly', async () => {
        const text = `
config TestSystem {
    label = "Test System"
    id = "test-system"
}

actor Character {
    play string PlayOnlyField = "Only visible in play mode"
    edit string EditOnlyField = "Only visible in edit mode"
    string NormalField = "Always visible"
}
        `;

        const document = await parse(text);
        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);
        const entry = document.parseResult.value as Entry;
        const character = entry.documents.find(d => d.name === 'Character')!;
        const properties = character.body.filter(isProperty);

        const playField = properties.find(p => p.name === 'PlayOnlyField') as Property;
        const editField = properties.find(p => p.name === 'EditOnlyField') as Property;
        const normalField = properties.find(p => p.name === 'NormalField') as Property;

        expect(playField.modifier).toBe('play');
        expect(editField.modifier).toBe('edit');
        expect(normalField.modifier).toBeUndefined();
    });

    test('should parse play modifier on actions', async () => {
        const text = `
config TestSystem {
    label = "Test System"
    id = "test-system"
}

actor Character {
    play action PlayAction {
        log("Only visible in play mode")
    }
    
    edit action EditAction {
        log("Only visible in edit mode")
    }
}
        `;

        const document = await parse(text);
        const entry = document.parseResult.value as Entry;
        const character = entry.documents.find(d => d.name === 'Character')!;
        
        const playAction = character.body.find(p => p.name === 'PlayAction');
        const editAction = character.body.find(p => p.name === 'EditAction');

        expect(playAction?.modifier).toBe('play');
        expect(editAction?.modifier).toBe('edit');
    });
});