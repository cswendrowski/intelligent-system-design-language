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

describe('getSystemPath utility tests', () => {
    test('basic property types get correct system paths', async () => {
        const text = `
config TestSystem {
    label = "Test System"
    id = "test-system"
}

actor Character {
    number Level(min: 1, max: 20)
    attribute Strength(min: 1, max: 20)  
    resource Health(max: 100)
    tracker Experience(max: 1000)
    choice<string> Class(choices: ["Warrior", "Mage", "Rogue"])
}
        `;

        const document = await parse(text);
        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);
        const entry = document.parseResult.value as Entry;
        const character = entry.documents.find(d => d.name === 'Character')!;
        const properties = character.body.filter(isProperty);

        const levelProperty = properties.find(p => p.name === 'Level')!;
        const strengthProperty = properties.find(p => p.name === 'Strength')!;
        const healthProperty = properties.find(p => p.name === 'Health')!;
        const experienceProperty = properties.find(p => p.name === 'Experience')!;
        const classProperty = properties.find(p => p.name === 'Class')!;

        expect(getSystemPath(levelProperty)).toBe('system.level');
        expect(getSystemPath(strengthProperty)).toBe('system.strength.mod');
        expect(getSystemPath(healthProperty)).toBe('system.health.value');
        expect(getSystemPath(experienceProperty)).toBe('system.experience.value');
        expect(getSystemPath(classProperty)).toBe('system.class.value');
    });

    test('document choice access with sub-properties', async () => {
        const text = `
config TestSystem {
    label = "Test System"
    id = "test-system"
}

item Skill {
    number SkillLevel(min: 1, max: 10)
    attribute SkillAttribute(min: 1, max: 20)
    resource SkillPoints(max: 100)
    choice<string> SkillType(choices: ["Combat", "Magic"])
}

actor Character {
    choice<Skill> PrimarySkill
}
        `;

        const document = await parse(text);
        const entry = document.parseResult.value as Entry;
        const character = entry.documents.find(d => d.name === 'Character')!;
        const primarySkillProperty = character.body.find(p => isProperty(p) && p.name === 'PrimarySkill') as Property;

        // Test document choice access with different property types
        expect(getSystemPath(primarySkillProperty, ['SkillLevel'])).toBe('system.primaryskill?.system?.skilllevel');
        expect(getSystemPath(primarySkillProperty, ['SkillAttribute'])).toBe('system.primaryskill?.system?.skillattribute?.mod');
        expect(getSystemPath(primarySkillProperty, ['SkillPoints'])).toBe('system.primaryskill?.system?.skillpoints?.value');
        expect(getSystemPath(primarySkillProperty, ['SkillType'])).toBe('system.primaryskill?.system?.skilltype?.value');
    });

    test('safe vs unsafe access modes', async () => {
        const text = `
config TestSystem {
    label = "Test System"
    id = "test-system"
}

item Skill {
    number SkillLevel(min: 1, max: 10)
}

actor Character {
    choice<Skill> PrimarySkill
}
        `;

        const document = await parse(text);
        const entry = document.parseResult.value as Entry;
        const character = entry.documents.find(d => d.name === 'Character')!;
        const primarySkillProperty = character.body.find(p => isProperty(p) && p.name === 'PrimarySkill') as Property;

        // Test safe access (default - uses ?.)
        expect(getSystemPath(primarySkillProperty, ['SkillLevel'], undefined, true))
            .toBe('system.primaryskill?.system?.skilllevel');
        
        // Test unsafe access (uses .)
        expect(getSystemPath(primarySkillProperty, ['SkillLevel'], undefined, false))
            .toBe('system.primaryskill.system.skilllevel');
    });

    test('undefined reference handling', () => {
        expect(getSystemPath(undefined)).toBe('');
        expect(getSystemPath(undefined, ['SomeProperty'])).toBe('');
    });
});