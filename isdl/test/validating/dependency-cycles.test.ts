import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import type { Diagnostic } from "vscode-languageserver-types";
import { createIntelligentSystemDesignLanguageServices } from "../../src/language/intelligent-system-design-language-module.js";
import { Entry, isEntry } from "../../src/language/generated/ast.js";

let services: ReturnType<typeof createIntelligentSystemDesignLanguageServices>;
let parse: ReturnType<typeof parseHelper<Entry>>;
let document: LangiumDocument<Entry> | undefined;

beforeAll(async () => {
    services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
    const doParse = parseHelper<Entry>(services.IntelligentSystemDesignLanguage);
    parse = (input: string) => doParse(input, { validation: true });
});

describe('Dependency Cycle Validation', () => {

    test('no dependency cycles - valid dependencies', async () => {
        document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                attribute Strength(min: 1, max: 20)
                attribute Dexterity(min: 1, max: 20)
                
                number Attack(value: {
                    return self.Strength + 5
                })
                
                number Defense(value: {
                    return self.Dexterity + self.Attack
                })
            }
        `);

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics).toHaveLength(0);
    });

    test('simple dependency cycle - A depends on B, B depends on A', async () => {
        document = await parse(`
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

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics.length).toBeGreaterThan(0);
        
        const diagnosticMessages = dependencyCycleDiagnostics.map(d => d.message);
        expect(diagnosticMessages.some(msg => msg.includes('propertya') && msg.includes('propertyb'))).toBe(true);
    });

    test('complex dependency cycle - A -> B -> C -> A', async () => {
        document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                number PropertyA(value: {
                    return self.PropertyB + 1
                })
                
                number PropertyB(value: {
                    return self.PropertyC + 1
                })
                
                number PropertyC(value: {
                    return self.PropertyA + 1
                })
            }
        `);

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics.length).toBeGreaterThan(0);
        
        const diagnosticMessages = dependencyCycleDiagnostics.map(d => d.message);
        expect(diagnosticMessages.some(msg => 
            msg.includes('propertya') && msg.includes('propertyb') && msg.includes('propertyc')
        )).toBe(true);
    });

    test('multiple parameter dependency cycle - min/max/value', async () => {
        document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                number PropertyA(min: {
                    return self.PropertyB
                }, value: {
                    return self.PropertyB + 5
                })
                
                number PropertyB(max: {
                    return self.PropertyA
                })
            }
        `);

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics.length).toBeGreaterThan(0);
    });

    test('resource dependency cycle', async () => {
        document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                resource Health(max: {
                    return self.Stamina + 10
                })
                
                resource Stamina(max: {
                    return self.Health + 5
                })
            }
        `);

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics.length).toBeGreaterThan(0);
    });

    test('attribute modifier dependency cycle', async () => {
        document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                attribute Strength(mod: {
                    return self.Dexterity / 2
                })
                
                attribute Dexterity(mod: {
                    return self.Strength / 2
                })
            }
        `);

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics.length).toBeGreaterThan(0);
    });

    test('no cycles with self-references (should be ignored)', async () => {
        document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                attribute Strength
                attribute Dexterity
                
                self<attribute> PrimaryAttribute(choices: [Strength, Dexterity])
                
                number Bonus(value: {
                    return self.PrimaryAttribute + 5
                })
            }
        `);

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics).toHaveLength(0);
    });

    test('mixed property types dependency cycle', async () => {
        document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                attribute Power(mod: {
                    return self.Level
                })
                
                number Level(value: {
                    return self.Experience / 100
                })
                
                tracker Experience(max: {
                    return self.Power * 50
                })
            }
        `);

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics.length).toBeGreaterThan(0);
    });

    test('dependency cycle with layouts/sections', async () => {
        document = await parse(`
            config Test {
                label = "Test System"
                id = "test"
            }

            actor Hero {
                section Stats {
                    number PropertyA(value: {
                        return self.PropertyB + 1
                    })
                }
                
                page Info {
                    number PropertyB(value: {
                        return self.PropertyA + 1
                    })
                }
            }
        `);

        const dependencyCycleDiagnostics = document?.diagnostics?.filter(d => d.code === 'dependency-cycle') || [];
        expect(dependencyCycleDiagnostics.length).toBeGreaterThan(0);
    });
});

function checkDocumentValid(document: LangiumDocument): string | undefined {
    return document.parseResult.parserErrors.length && s`
        Parser errors:
          ${document.parseResult.parserErrors.map(e => e.message).join('\n  ')}
    `
        || document.parseResult.value === undefined && `ParseResult is 'undefined'.`
        || !isEntry(document.parseResult.value) && `Root AST object is a ${document.parseResult.value.$type}, expected a '${Entry}'.`
        || undefined;
}

function diagnosticToString(d: Diagnostic) {
    return `[${d.range.start.line}:${d.range.start.character}..${d.range.end.line}:${d.range.end.character}]: ${d.message}`;
}