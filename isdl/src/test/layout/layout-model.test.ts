import { EmptyFileSystem } from 'langium';
import { parseHelper } from 'langium/test';
import { describe, it, expect } from 'vitest';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';
import { Entry, isActor } from '../../language/generated/ast.js';
import {
    buildEffectiveDocTree,
    collectFieldOverrides,
    collectSectionOverrides,
    serializeLayoutTree,
    SystemLayoutV2,
    EffectiveNode,
    EffectiveContainerNode,
    EffectiveFieldNode,
    EffectiveStaticNode,
    LayoutThemeOverride,
} from '../../cli/components/layout-model.js';

const services = createIntelligentSystemDesignLanguageServices(EmptyFileSystem);
const parse = parseHelper<Entry>(services.IntelligentSystemDesignLanguage);

// Minimal valid ISDL document used by all tests.
const ISDL_SRC = `
config Test {
    id = "test"
    label = "Test"
    author = "x"
    description = "x"
}

actor Hero {
    section stats {
        number Strength
        number Agility
    }
    section info {
        string Background
    }
    number Loose
    page Combat {
        number Attack
    }
}
`;

async function parseEntry(src: string = ISDL_SRC): Promise<Entry> {
    const doc = await parse(src, { validation: false });
    return doc.parseResult.value;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function heroDoc(entry: Entry) {
    const doc = entry.documents.find(isActor);
    if (!doc) throw new Error('No actor Hero found in parsed entry');
    return doc;
}

function fieldIds(nodes: EffectiveNode[]): string[] {
    return nodes
        .filter((n): n is EffectiveFieldNode => n.kind === 'field')
        .map(n => n.name);
}

function containerChildren(nodes: EffectiveNode[], id: string): EffectiveNode[] {
    const c = nodes.find((n): n is EffectiveContainerNode =>
        (n.kind === 'section' || n.kind === 'row' || n.kind === 'column') && n.id === id);
    if (!c) throw new Error(`No container with id "${id}" found`);
    return c.children;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildEffectiveDocTree', () => {

    it('1. null layout → default tree structure', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);
        const tree = buildEffectiveDocTree(doc, null);

        // Pages: main "hero" and explicit "combat"
        expect(tree.pages.has('hero')).toBe(true);
        expect(tree.pages.has('combat')).toBe(true);
        expect(tree.pages.size).toBe(2);

        const main = tree.pages.get('hero')!;

        // Top-level structure: section stats, section info, field loose
        expect(main).toHaveLength(3);

        const statsNode = main[0] as EffectiveContainerNode;
        expect(statsNode.kind).toBe('section');
        expect(statsNode.id).toBe('stats');

        const infoNode = main[1] as EffectiveContainerNode;
        expect(infoNode.kind).toBe('section');
        expect(infoNode.id).toBe('info');

        const looseNode = main[2] as EffectiveFieldNode;
        expect(looseNode.kind).toBe('field');
        expect(looseNode.name).toBe('loose');

        // Stats section children: strength, agility (in that order)
        const statsChildren = statsNode.children;
        expect(statsChildren).toHaveLength(2);
        expect((statsChildren[0] as EffectiveFieldNode).name).toBe('strength');
        expect((statsChildren[1] as EffectiveFieldNode).name).toBe('agility');

        // Info section children: background
        const infoChildren = infoNode.children;
        expect(infoChildren).toHaveLength(1);
        expect((infoChildren[0] as EffectiveFieldNode).name).toBe('background');

        // Combat page: just field attack
        const combat = tree.pages.get('combat')!;
        expect(combat).toHaveLength(1);
        expect((combat[0] as EffectiveFieldNode).kind).toBe('field');
        expect((combat[0] as EffectiveFieldNode).name).toBe('attack');
    });

    it('2. layout v2 reorders within a section', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        { kind: 'field', name: 'agility' },
                                        { kind: 'field', name: 'strength' },
                                    ]
                                },
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;
        const statsChildren = containerChildren(main, 'stats');

        expect(statsChildren).toHaveLength(2);
        expect((statsChildren[0] as EffectiveFieldNode).name).toBe('agility');
        expect((statsChildren[1] as EffectiveFieldNode).name).toBe('strength');
    });

    it('3. cross-section move: background moved into stats', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        { kind: 'field', name: 'strength' },
                                        { kind: 'field', name: 'agility' },
                                        { kind: 'field', name: 'background' },   // moved here
                                    ]
                                },
                                { kind: 'section', id: 'info', children: [] },    // now empty
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;

        // Stats should contain strength, agility, background
        const statsChildren = containerChildren(main, 'stats');
        expect(fieldIds(statsChildren)).toEqual(['strength', 'agility', 'background']);

        // Info section still present (even if empty by layout spec)
        const infoNode = main.find((n): n is EffectiveContainerNode => n.kind !== 'field' && n.id === 'info');
        expect(infoNode).toBeDefined();
        // background was consumed into stats — info's children should be empty
        expect(infoNode!.children).toHaveLength(0);
    });

    it('4. overrides — layout field node carries overrides into effective tree', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        {
                                            kind: 'field', name: 'strength',
                                            size: 'double',
                                            hideLabel: true,
                                            color: '#ff0000',
                                            icon: 'fa-solid fa-star',
                                        },
                                        { kind: 'field', name: 'agility' },
                                    ]
                                },
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;
        const statsChildren = containerChildren(main, 'stats');
        const strengthNode = statsChildren[0] as EffectiveFieldNode;

        expect(strengthNode.name).toBe('strength');
        expect(strengthNode.overrides).toEqual({
            size: 'double',
            hideLabel: true,
            color: '#ff0000',
            icon: 'fa-solid fa-star',
        });

        // collectFieldOverrides reflects them
        const overrides = collectFieldOverrides(tree);
        expect(overrides.has('strength')).toBe(true);
        expect(overrides.get('strength')).toEqual({
            size: 'double',
            hideLabel: true,
            color: '#ff0000',
            icon: 'fa-solid fa-star',
        });

        // agility has no overrides — should not appear in the map
        expect(overrides.has('agility')).toBe(false);
    });

    it('5. drift: field added after save appears at end of main page', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        // Layout that omits "loose" entirely
        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        { kind: 'field', name: 'strength' },
                                        { kind: 'field', name: 'agility' },
                                    ]
                                },
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                // loose intentionally absent
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;

        // loose must still be present
        const allNames = (function collect(nodes: EffectiveNode[]): string[] {
            const out: string[] = [];
            for (const n of nodes) {
                if (n.kind === 'field') out.push(n.name);
                else if (n.kind !== 'static') out.push(...collect(n.children));
            }
            return out;
        })(main);

        expect(allNames).toContain('loose');

        // It should be appended at the end of the top-level children (drift pass)
        const lastTopLevel = main[main.length - 1];
        expect(lastTopLevel.kind).toBe('field');
        expect((lastTopLevel as EffectiveFieldNode).name).toBe('loose');
    });

    it('6. drift: stale layout entry for nonexistent field is dropped', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        { kind: 'field', name: 'strength' },
                                        { kind: 'field', name: 'ghost' },   // stale — doesn't exist
                                        { kind: 'field', name: 'agility' },
                                    ]
                                },
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;
        const statsChildren = containerChildren(main, 'stats');

        // ghost should be absent
        const names = fieldIds(statsChildren);
        expect(names).not.toContain('ghost');

        // The real fields are still present
        expect(names).toContain('strength');
        expect(names).toContain('agility');
    });

    it('7. section hideTitle: layout hideLabel propagates to effective container', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats',
                                    hideLabel: true,
                                    children: [
                                        { kind: 'field', name: 'strength' },
                                        { kind: 'field', name: 'agility' },
                                    ]
                                },
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;
        const statsNode = main.find((n): n is EffectiveContainerNode => n.kind !== 'field' && n.id === 'stats')!;

        expect(statsNode.hideTitle).toBe(true);

        // collectSectionOverrides reflects it
        const sectionOverrides = collectSectionOverrides(tree);
        expect(sectionOverrides.has('stats')).toBe(true);
        expect(sectionOverrides.get('stats')).toEqual({ hideTitle: true });

        // info section: no hideLabel set → should NOT appear in sectionOverrides
        expect(sectionOverrides.has('info')).toBe(false);
    });

    it('9. static node passes through merge into the effective tree (not dropped, no warning)', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        // Layout includes a static heading node among the top-level children
        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        { kind: 'field', name: 'strength' },
                                        { kind: 'field', name: 'agility' },
                                    ]
                                },
                                // Static node placed between sections
                                { kind: 'static', id: '__static_1749000000000', staticType: 'heading', text: 'Info' } as any,
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const warnMessages: string[] = [];
        // Temporarily intercept warnings
        const origWarn = console.warn;
        console.warn = (...args: any[]) => { warnMessages.push(String(args[0])); };
        const tree = buildEffectiveDocTree(doc, layout);
        console.warn = origWarn;

        const main = tree.pages.get('hero')!;

        // Static node should be present at index 1 (between stats and info)
        const staticNode = main[1] as EffectiveStaticNode;
        expect(staticNode.kind).toBe('static');
        expect(staticNode.staticType).toBe('heading');
        expect(staticNode.text).toBe('Info');
        expect(staticNode.id).toBe('__static_1749000000000');

        // No warning about it being dropped
        expect(warnMessages.some(m => m.includes('__static_1749000000000'))).toBe(false);

        // All original nodes still present
        expect(main).toHaveLength(4); // stats, static, info, loose
    });

    it('10. static node serializes with kind/staticType/text/id intact', async () => {
        const entry = await parseEntry();

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        { kind: 'field', name: 'strength' },
                                        { kind: 'field', name: 'agility' },
                                    ]
                                },
                                { kind: 'static', id: '__static_9999', staticType: 'paragraph', text: 'Background info' } as any,
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const serialized = serializeLayoutTree(entry, layout);
        const heroPages = serialized.actors['hero'].pages;
        const mainChildren = heroPages['hero'].children;

        // Find the static node in the serialized output
        const staticNode = mainChildren.find((n: any) => n.kind === 'static') as any;
        expect(staticNode).toBeDefined();
        expect(staticNode.kind).toBe('static');
        expect(staticNode.staticType).toBe('paragraph');
        expect(staticNode.text).toBe('Background info');
        expect(staticNode.id).toBe('__static_9999');
    });

    it('11. synthetic row passes through merge with resolved field children', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                { kind: 'section', id: 'stats', children: [{ kind: 'field', name: 'strength' }, { kind: 'field', name: 'agility' }] },
                                {
                                    kind: 'row', id: '__dmrow_1749100000000', synthetic: true,
                                    children: [
                                        { kind: 'field', name: 'loose' },
                                    ]
                                } as any,
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;

        // Synthetic row should be present at index 1
        const synthRow = main[1] as EffectiveContainerNode;
        expect(synthRow.kind).toBe('row');
        expect(synthRow.id).toBe('__dmrow_1749100000000');
        expect(synthRow.synthetic).toBe(true);
        expect(synthRow.element).toBeNull();

        // Its child (loose) should be resolved via fieldMap
        expect(synthRow.children).toHaveLength(1);
        expect((synthRow.children[0] as EffectiveFieldNode).name).toBe('loose');

        // Drift pass: loose was consumed into the synthetic row, so it should NOT be appended again
        const allNames = (function collect(nodes: EffectiveNode[]): string[] {
            const out: string[] = [];
            for (const n of nodes) {
                if (n.kind === 'field') out.push(n.name);
                else if (n.kind !== 'static') out.push(...collect(n.children));
            }
            return out;
        })(main);
        expect(allNames.filter(n => n === 'loose')).toHaveLength(1);
    });

    it('12. hidden: true override survives merge + collectFieldOverrides', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        { kind: 'field', name: 'strength', hidden: true } as any,
                                        { kind: 'field', name: 'agility' },
                                    ]
                                },
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;
        const statsChildren = containerChildren(main, 'stats');
        const strengthNode = statsChildren[0] as EffectiveFieldNode;

        // override.hidden should be set
        expect(strengthNode.overrides.hidden).toBe(true);

        // collectFieldOverrides should surface it
        const overrides = collectFieldOverrides(tree);
        expect(overrides.get('strength')?.hidden).toBe(true);
        // agility has no overrides
        expect(overrides.has('agility')).toBe(false);
    });

    it('13. theme override passes pickOverrides validation and serializes', async () => {
        const entry = await parseEntry();
        const doc = heroDoc(entry);

        const theme: LayoutThemeOverride = {
            background: '#1a1410',
            text: '#f0e6d2',
            border: { color: '#aa3333', width: '2px', radius: '4px' },
            width: { min: '100px', max: '300px' },
            height: { min: '50px' },
        };

        const layout: SystemLayoutV2 = {
            version: 2,
            actors: {
                hero: {
                    pages: {
                        hero: {
                            children: [
                                {
                                    kind: 'section', id: 'stats', children: [
                                        { kind: 'field', name: 'strength', theme } as any,
                                        { kind: 'field', name: 'agility' },
                                    ]
                                },
                                { kind: 'section', id: 'info', children: [{ kind: 'field', name: 'background' }] },
                                { kind: 'field', name: 'loose' },
                            ]
                        }
                    }
                }
            },
            items: {}
        };

        const tree = buildEffectiveDocTree(doc, layout);
        const main = tree.pages.get('hero')!;
        const statsChildren = containerChildren(main, 'stats');
        const strengthNode = statsChildren[0] as EffectiveFieldNode;

        // Theme override should be set on the effective node
        expect(strengthNode.overrides.theme).toBeDefined();
        expect(strengthNode.overrides.theme?.background).toBe('#1a1410');
        expect(strengthNode.overrides.theme?.text).toBe('#f0e6d2');
        expect(strengthNode.overrides.theme?.border?.color).toBe('#aa3333');
        expect(strengthNode.overrides.theme?.border?.width).toBe('2px');
        expect(strengthNode.overrides.theme?.border?.radius).toBe('4px');
        expect(strengthNode.overrides.theme?.width?.min).toBe('100px');
        expect(strengthNode.overrides.theme?.width?.max).toBe('300px');
        expect(strengthNode.overrides.theme?.height?.min).toBe('50px');

        // collectFieldOverrides should surface it
        const overrides = collectFieldOverrides(tree);
        expect(overrides.get('strength')?.theme?.background).toBe('#1a1410');

        // serializeLayoutTree should include theme in the serialized node
        const serialized = serializeLayoutTree(entry, layout);
        const statsSection = (serialized.actors['hero'].pages['hero'].children as any[]).find(n => n.kind === 'section' && n.id === 'stats');
        const strengthSer = (statsSection?.children as any[])?.find(n => n.kind === 'field' && n.name === 'strength');
        expect(strengthSer?.theme?.background).toBe('#1a1410');
        expect(strengthSer?.theme?.border?.width).toBe('2px');
    });

    it('8. serializeLayoutTree: field nodes have label, typeClass, defaultSize, sizable', async () => {
        const entry = await parseEntry();
        const serialized = serializeLayoutTree(entry, null);

        expect(serialized.actors).toBeDefined();
        expect(serialized.actors['hero']).toBeDefined();

        const heroDef = serialized.actors['hero'];
        expect(heroDef.name).toBe('Hero');
        expect(heroDef.pages['hero']).toBeDefined();

        const mainChildren = heroDef.pages['hero'].children;

        // Find the stats section
        const statsSection = mainChildren.find(n => n.kind === 'section' && n.id === 'stats');
        expect(statsSection).toBeDefined();
        expect(statsSection!.kind).toBe('section');

        // Inside stats: check strength field node
        const statsChildren = (statsSection as any).children as any[];
        const strengthNode = statsChildren.find((c: any) => c.kind === 'field' && c.name === 'strength');
        expect(strengthNode).toBeDefined();
        expect(strengthNode.label).toBeDefined();
        expect(typeof strengthNode.label).toBe('string');
        expect(strengthNode.typeClass).toBe('number');
        expect(strengthNode.defaultSize).toBeDefined();
        expect(typeof strengthNode.sizable).toBe('boolean');

        // "number" type should be sizable and single-wide by default
        expect(strengthNode.defaultSize).toBe('single');
        expect(strengthNode.sizable).toBe(true);

        // Combat page also serialized
        expect(heroDef.pages['combat']).toBeDefined();
        const combatChildren = heroDef.pages['combat'].children;
        const attackNode = combatChildren.find((n: any) => n.kind === 'field' && n.name === 'attack') as any;
        expect(attackNode).toBeDefined();
        expect(attackNode?.typeClass).toBe('number');
    });

});
