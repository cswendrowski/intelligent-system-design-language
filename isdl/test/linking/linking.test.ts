import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { clearDocuments, parseHelper } from "langium/test";
import { createFoundrySystemDesignLanguageServices } from "../../src/language/foundry-system-design-language-module.js";
import { Action, DecrementValAssignment, Document, Entry, isAction, isEntry, isSection, Section } from "../../src/language/generated/ast.js";

let services: ReturnType<typeof createFoundrySystemDesignLanguageServices>;
let parse:    ReturnType<typeof parseHelper<Entry>>;
let document: LangiumDocument<Entry> | undefined;

beforeAll(async () => {
    services = createFoundrySystemDesignLanguageServices(EmptyFileSystem);
    parse = parseHelper<Entry>(services.FoundrySystemDesignLanguage);

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

afterEach(async () => {
    document && clearDocuments(services.shared, [ document ]);
});

describe('Linking tests', () => {

    test('base document reference', async () => {
        document = await parse(`
            config Test {
                label = "test"
                id = "test"
                description = "test"
                author = "test"
            }

            actor Hero {
                number Experience

                action LevelUp {
                    self.Experience -= 10
                }
            }
        `);

        expect(
            // here we first check for validity of the parsed document object by means of the reusable function
            //  'checkDocumentValid()' to sort out (critical) typos first,
            // and then evaluate the cross references we're interested in by checking
            //  the referenced AST element as well as for a potential error message;
            checkDocumentValid(document)
                || checkEntryDocumentValid(document.parseResult.value.documents[0])
        ).toBe(s`
            Experience
        `);
    });

    test('section document reference', async () => {
        document = await parse(`
            config Test {
                label = "test"
                id = "test"
                description = "test"
                author = "test"
            }

            actor Hero {

                section Level {
                    number Experience

                    action LevelUp {
                        self.Experience -= 10
                    }
                }
            }
        `);

        expect(
            // here we first check for validity of the parsed document object by means of the reusable function
            //  'checkDocumentValid()' to sort out (critical) typos first,
            // and then evaluate the cross references we're interested in by checking
            //  the referenced AST element as well as for a potential error message;
            checkDocumentValid(document)
                || checkEntryDocumentValid(document.parseResult.value.documents[0])
        ).toBe(s`
            Experience
        `);
    });

    test('section to base document reference', async () => {
        document = await parse(`
            config Test {
                label = "test"
                id = "test"
                description = "test"
                author = "test"
            }

            actor Hero {

                number Experience

                section Level {
                    action LevelUp {
                        self.Experience -= 10
                    }
                }
            }
        `);

        expect(
            // here we first check for validity of the parsed document object by means of the reusable function
            //  'checkDocumentValid()' to sort out (critical) typos first,
            // and then evaluate the cross references we're interested in by checking
            //  the referenced AST element as well as for a potential error message;
            checkDocumentValid(document)
                || checkEntryDocumentValid(document.parseResult.value.documents[0])
        ).toBe(s`
            Experience
        `);
    });

    test('section to section document reference', async () => {
        document = await parse(`
            config Test {
                label = "test"
                id = "test"
                description = "test"
                author = "test"
            }

            actor Hero {

                section Info {
                    number Experience
                }
                
                section Level {
                    action LevelUp {
                        self.Experience -= 10
                    }
                }
            }
        `);

        expect(
            // here we first check for validity of the parsed document object by means of the reusable function
            //  'checkDocumentValid()' to sort out (critical) typos first,
            // and then evaluate the cross references we're interested in by checking
            //  the referenced AST element as well as for a potential error message;
            checkDocumentValid(document)
                || checkEntryDocumentValid(document.parseResult.value.documents[0])
        ).toBe(s`
            Experience
        `);
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

function checkEntryDocumentValid(document: Document): string | undefined {
    if ( document.body.length === 0 ) return `Document has no body.`;

    const allActions = document.body.filter(x => isAction(x)) as Action[];
    const sections = document.body.filter(x => isSection(x)) as Section[];

    for ( const section of sections ) {
        const actions = section.body.filter(x => isAction(x)) as Action[];
        allActions.push(...actions);
    }

    const action = allActions[0];
    if ( action === undefined ) return `Document has no action.`;

    const line = action.method.body[0] as DecrementValAssignment | undefined;
    if ( line === undefined ) return `Action has no body.`;

    return line.property.ref?.name;
}
