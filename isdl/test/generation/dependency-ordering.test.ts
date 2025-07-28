import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem } from "langium";
import { parseHelper } from "langium/test";
import { createIntelligentSystemDesignLanguageServices } from "../../src/language/intelligent-system-design-language-module.js";
import { Entry, isEntry, Document, isActor } from "../../src/language/generated/ast.js";
import { generateExtendedDocumentClasses } from "../../src/cli/components/derived-data-generator.js";
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

let services: ReturnType<typeof createIntelligentSystemDesignLanguageServices>;
let parse: ReturnType<typeof parseHelper<Entry>>;

beforeAll(async () => {
    services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
    const doParse = parseHelper<Entry>(services.IntelligentSystemDesignLanguage);
    parse = (input: string) => doParse(input, { validation: false }); // Disable validation for generation tests
});

describe('Dependency Ordering in Code Generation', () => {

    test('properties with dependencies are ordered correctly', async () => {
        const document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
              
                number DoublyDependentProperty(value: {
                    return self.DependentProperty * 2
                })
                                
                number DependentProperty(value: {
                    return self.BaseAttribute + 5
                })

                attribute BaseAttribute(min: 1, max: 20)
            }
        `);

        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);

        const entry = document.parseResult.value as Entry;
        const actorDocument = entry.documents.find(isActor) as Document;
        expect(actorDocument).toBeDefined();

        // Create a temporary directory for generation
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdl-test-'));
        
        try {
            // Generate the code
            generateExtendedDocumentClasses(entry, "test", tempDir);
            
            // Read the generated actor file
            const actorFilePath = path.join(tempDir, "system", "documents", "actor.mjs");
            expect(fs.existsSync(actorFilePath)).toBe(true);
            
            const generatedCode = fs.readFileSync(actorFilePath, 'utf-8');
            
            // Check that BaseAttribute processing appears before DependentProperty
            const baseAttributeIndex = generatedCode.indexOf('// BaseAttribute Attribute');
            const dependentPropertyIndex = generatedCode.indexOf('// DependentProperty Number');
            const doublyDependentIndex = generatedCode.indexOf('// DoublyDependentProperty Number');
            
            expect(baseAttributeIndex).toBeGreaterThan(-1);
            expect(dependentPropertyIndex).toBeGreaterThan(-1);
            expect(doublyDependentIndex).toBeGreaterThan(-1);
            
            // Since dependency extraction needs refinement, just verify all properties are generated
            // Verify dependency ordering: BaseAttribute should come before DependentProperty before DoublyDependentProperty
            expect(baseAttributeIndex).toBeLessThan(dependentPropertyIndex);
            expect(dependentPropertyIndex).toBeLessThan(doublyDependentIndex);
            
        } finally {
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('non-computed properties are processed before computed properties', async () => {
        const document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                // This has a computed value (should come later)
                number ComputedProperty(value: {
                    return self.SimpleProperty + 10
                })
                
                // This has no computed value (should come first)
                number SimpleProperty(min: 1, max: 100)
                
                // Another non-computed property
                string BasicString
            }
        `);

        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);

        const entry = document.parseResult.value as Entry;
        const actorDocument = entry.documents.find(isActor) as Document;
        expect(actorDocument).toBeDefined();

        // Create a temporary directory for generation
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdl-test-'));
        
        try {
            // Generate the code
            generateExtendedDocumentClasses(entry, "test", tempDir);
            
            // Read the generated actor file
            const actorFilePath = path.join(tempDir, "system", "documents", "actor.mjs");
            expect(fs.existsSync(actorFilePath)).toBe(true);
            
            const generatedCode = fs.readFileSync(actorFilePath, 'utf-8');
            
            // Find the indices of each property processing
            const simplePropertyIndex = generatedCode.indexOf('SimpleProperty');
            const computedPropertyIndex = generatedCode.indexOf('ComputedProperty');
            
            expect(simplePropertyIndex).toBeGreaterThan(-1);
            expect(computedPropertyIndex).toBeGreaterThan(-1);
            
            // Verify that non-computed properties come before computed properties
            expect(simplePropertyIndex).toBeLessThan(computedPropertyIndex);
            
        } finally {
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('dependency cycles are handled gracefully', async () => {
        const document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                number PropertyA(value: {
                    return self.PropertyB + 1
                })
                
                number PropertyB(value: {
                    return self.PropertyA + 1
                })
            }
        `);

        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);

        const entry = document.parseResult.value as Entry;
        const actorDocument = entry.documents.find(isActor) as Document;
        expect(actorDocument).toBeDefined();

        // Create a temporary directory for generation
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdl-test-'));
        
        try {
            // This should not throw an error despite the cycle
            expect(() => {
                generateExtendedDocumentClasses(entry, "test", tempDir);
            }).not.toThrow();
            
            // Read the generated actor file
            const actorFilePath = path.join(tempDir, "system", "documents", "actor.mjs");
            expect(fs.existsSync(actorFilePath)).toBe(true);
            
            const generatedCode = fs.readFileSync(actorFilePath, 'utf-8');
            
            // Should contain a warning comment about dependency cycles
            expect(generatedCode).toContain('WARNING: Dependency cycles detected');
            expect(generatedCode).toContain('propertya');
            expect(generatedCode).toContain('propertyb');
            
        } finally {
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('complex dependencies with resources and attributes', async () => {
        const document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {

                // Number that depends on both attribute and resource
                number CarryCapacity(value: {
                    return self.Strength * 10 + self.Health
                })

                // Base attributes (no dependencies)
                attribute Strength(min: 1, max: 20)
                attribute Endurance(min: 1, max: 20)
                
                // Resource that depends on attributes
                resource Health(max: {
                    return self.Endurance * 5
                })
                
                // Tracker that depends on the computed number
                tracker Equipment(max: {
                    return self.CarryCapacity / 5
                })
            }
        `);

        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);

        const entry = document.parseResult.value as Entry;
        const actorDocument = entry.documents.find(isActor) as Document;
        expect(actorDocument).toBeDefined();

        // Create a temporary directory for generation
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdl-test-'));
        
        try {
            // Generate the code
            generateExtendedDocumentClasses(entry, "test", tempDir);
            
            // Read the generated actor file
            const actorFilePath = path.join(tempDir, "system", "documents", "actor.mjs");
            expect(fs.existsSync(actorFilePath)).toBe(true);
            
            const generatedCode = fs.readFileSync(actorFilePath, 'utf-8');
            
            // Find processing order
            const strengthIndex = generatedCode.indexOf('// Strength Attribute');
            const enduranceIndex = generatedCode.indexOf('// Endurance Attribute');
            const healthIndex = generatedCode.indexOf('// Health Resource');
            const carryCapacityIndex = generatedCode.indexOf('// CarryCapacity Number');
            const equipmentIndex = generatedCode.indexOf('// Equipment Tracker');
            
            // All should be found
            expect(strengthIndex).toBeGreaterThan(-1);
            expect(enduranceIndex).toBeGreaterThan(-1);
            expect(healthIndex).toBeGreaterThan(-1);
            expect(carryCapacityIndex).toBeGreaterThan(-1);
            expect(equipmentIndex).toBeGreaterThan(-1);
            
            // Verify dependency order
            expect(strengthIndex).toBeLessThan(carryCapacityIndex); // Strength before CarryCapacity
            expect(enduranceIndex).toBeLessThan(healthIndex); // Endurance before Health
            expect(healthIndex).toBeLessThan(carryCapacityIndex); // Health before CarryCapacity
            expect(carryCapacityIndex).toBeLessThan(equipmentIndex); // CarryCapacity before Equipment
            
        } finally {
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('properties in sections are not duplicated', async () => {
        const document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                // Base attributes
                attribute Strength(min: 1, max: 20)
                attribute Dexterity(min: 1, max: 20)
                number Level(min: 1, max: 20)
                
                // Properties in a section
                section Combat {
                    number AttackBonus(value: {
                        return self.Strength + self.Level
                    })
                    
                    number Defense(value: {
                        return self.Dexterity + 10
                    })
                    
                    number CombatRating(value: {
                        return self.AttackBonus + self.Defense
                    })
                }
            }
        `);

        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);

        const entry = document.parseResult.value as Entry;
        const actorDocument = entry.documents.find(isActor) as Document;
        expect(actorDocument).toBeDefined();

        // Create a temporary directory for generation
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdl-test-'));
        
        try {
            // Generate the code
            generateExtendedDocumentClasses(entry, "test", tempDir);
            
            // Read the generated actor file
            const actorFilePath = path.join(tempDir, "system", "documents", "actor.mjs");
            expect(fs.existsSync(actorFilePath)).toBe(true);
            
            const generatedCode = fs.readFileSync(actorFilePath, 'utf-8');
            
            // Check that each property function is only defined once
            const functionDefinitions = [
                'attackbonusCurrentValueFunc',
                'defenseCurrentValueFunc', 
                'combatratingCurrentValueFunc'
            ];
            
            for (const funcName of functionDefinitions) {
                const regex = new RegExp(`const ${funcName} = \\(system\\) =>`, 'g');
                const matches = generatedCode.match(regex);
                expect(matches?.length || 0).toBe(1, 
                    `Function ${funcName} should be defined exactly once, but found ${matches?.length || 0} definitions`);
            }
            
            // Also check that each property is only processed once by looking for unique comments
            const propertyComments = [
                '// AttackBonus Number',
                '// Defense Number',
                '// CombatRating Number'
            ];
            
            for (const comment of propertyComments) {
                const commentCount = (generatedCode.match(new RegExp(comment, 'g')) || []).length;
                // We expect exactly 2 occurrences: "Number Calculated Data" and "Number Derived Data"
                expect(commentCount).toBe(2, 
                    `Property ${comment} should have exactly 2 comment sections, but found ${commentCount}`);
            }
            
        } finally {
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('no function definitions are duplicated across the entire file', async () => {
        const document = await parse(`
            config Test {
                label = "Test System"  
                id = "test"
            }

            actor Hero {
                attribute Strength(min: 1, max: 20)
                attribute Dexterity(min: 1, max: 20)
                number Level(min: 1, max: 20)
                
                number StrengthMod(value: {
                    return (self.Strength - 10) / 2
                })
                
                section Combat {
                    number AttackBonus(value: {
                        return self.StrengthMod + self.Level
                    })
                    
                    number Defense(value: {
                        return self.Dexterity + 10
                    })
                }
                
                section Skills {
                    number Athletics(value: {
                        return self.StrengthMod + self.Level
                    })
                }
            }
        `);

        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);

        const entry = document.parseResult.value as Entry;
        const actorDocument = entry.documents.find(isActor) as Document;
        expect(actorDocument).toBeDefined();

        // Create a temporary directory for generation
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdl-test-'));
        
        try {
            // Generate the code
            generateExtendedDocumentClasses(entry, "test", tempDir);
            
            // Read the generated actor file
            const actorFilePath = path.join(tempDir, "system", "documents", "actor.mjs");
            expect(fs.existsSync(actorFilePath)).toBe(true);
            
            const generatedCode = fs.readFileSync(actorFilePath, 'utf-8');
            
            // Find all function definitions ending with CurrentValueFunc
            const functionDefRegex = /const (\w+CurrentValueFunc) = \(system\) =>/g;
            const functionNames: string[] = [];
            let match;
            
            while ((match = functionDefRegex.exec(generatedCode)) !== null) {
                functionNames.push(match[1]);
            }
            
            // Check for duplicates
            const uniqueFunctions = new Set(functionNames);
            expect(functionNames.length).toBe(uniqueFunctions.size, 
                `Duplicate function definitions found: ${JSON.stringify(functionNames)}`);
            
            // Verify specific functions exist exactly once
            const expectedFunctions = [
                'strengthmodCurrentValueFunc',
                'attackbonusCurrentValueFunc', 
                'defenseCurrentValueFunc',
                'athleticsCurrentValueFunc'
            ];
            
            for (const expectedFunc of expectedFunctions) {
                const count = functionNames.filter(name => name === expectedFunc).length;
                expect(count).toBe(1, 
                    `Expected exactly 1 definition of ${expectedFunc}, but found ${count}`);
            }
            
        } finally {
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('regression test: TotalDefense in Combat section not duplicated', async () => {
        // This is a regression test for the specific issue that was fixed
        // where properties in sections were being generated twice
        const document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Character {
                attribute Strength(min: 1, max: 20)
                attribute Dexterity(min: 1, max: 20) 
                number Level(min: 1, max: 20)
                
                number DexterityModifier(value: {
                    return (self.Dexterity - 10) / 2
                })
                
                number ArmorClass(value: {
                    return 10 + self.DexterityModifier
                })
                
                section Combat {
                    number TotalDefense(value: {
                        return self.ArmorClass + self.DexterityModifier + self.Level
                    })
                    
                    number CriticalHitChance(value: {
                        return (self.Dexterity + self.Level) / 2
                    })
                    
                    number CombatRating(value: {
                        return self.TotalDefense + self.CriticalHitChance
                    })
                }
            }
        `);

        expect(document.parseResult.value).toBeDefined();
        expect(isEntry(document.parseResult.value!)).toBe(true);

        const entry = document.parseResult.value as Entry;
        const actorDocument = entry.documents.find(isActor) as Document;
        expect(actorDocument).toBeDefined();

        // Create a temporary directory for generation
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdl-test-'));
        
        try {
            // Generate the code
            generateExtendedDocumentClasses(entry, "test", tempDir);
            
            // Read the generated actor file
            const actorFilePath = path.join(tempDir, "system", "documents", "actor.mjs");
            expect(fs.existsSync(actorFilePath)).toBe(true);
            
            const generatedCode = fs.readFileSync(actorFilePath, 'utf-8');
            
            // Specifically test the TotalDefense function that was being duplicated
            const totalDefenseMatches = generatedCode.match(/const totaldefenseCurrentValueFunc = \(system\) =>/g);
            expect(totalDefenseMatches?.length || 0).toBe(1, 
                'TotalDefense function should be defined exactly once');
            
            // Verify the dependency chain is correct - TotalDefense should come after its dependencies
            const dexModIndex = generatedCode.indexOf('// DexterityModifier Number');
            const armorClassIndex = generatedCode.indexOf('// ArmorClass Number');
            const totalDefenseIndex = generatedCode.indexOf('// TotalDefense Number');
            
            expect(dexModIndex).toBeGreaterThan(-1);
            expect(armorClassIndex).toBeGreaterThan(-1);
            expect(totalDefenseIndex).toBeGreaterThan(-1);
            
            // Dependencies should come before TotalDefense
            expect(dexModIndex).toBeLessThan(totalDefenseIndex);
            expect(armorClassIndex).toBeLessThan(totalDefenseIndex);
            
            // Verify all functions are unique
            const allFunctionMatches = generatedCode.match(/const \w+CurrentValueFunc = \(system\) =>/g) || [];
            const functionNames = allFunctionMatches.map(match => 
                match.match(/const (\w+CurrentValueFunc)/)?.[1]
            ).filter(Boolean);
            
            const uniqueFunctionNames = new Set(functionNames);
            expect(functionNames.length).toBe(uniqueFunctionNames.size, 
                `Duplicate functions found: ${JSON.stringify(functionNames)}`);
            
        } finally {
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});