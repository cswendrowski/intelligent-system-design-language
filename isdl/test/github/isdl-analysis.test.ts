import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubManager } from '../../src/extension/github/githubManager.js';

// Mock VS Code and dependencies
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
        })),
    },
    TreeItem: class TreeItem {},
    TreeDataProvider: class TreeDataProvider {},
    EventEmitter: class EventEmitter {
        event = vi.fn();
        fire = vi.fn();
    },
}));

vi.mock('@octokit/rest');

describe('ISDL Semantic Versioning Analysis', () => {
    let githubManager: GitHubManager;

    beforeEach(() => {
        const mockContext = {
            secrets: { get: vi.fn(), store: vi.fn(), delete: vi.fn() },
            globalState: { get: vi.fn(), update: vi.fn() },
        };
        githubManager = new GitHubManager(mockContext);
    });

    describe('Change Type Determination', () => {
        it('should determine major version for removed fields', () => {
            const changes = [
                {
                    type: 'removed' as const,
                    category: 'field' as const,
                    description: 'Removed field "strength" from actor.character',
                    name: 'strength',
                },
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added field "power" to actor.character',
                    name: 'power',
                },
            ];

            const result = (githubManager as any).determineVersionFromIsdlChanges(changes);
            expect(result).toBe('major');
        });

        it('should determine minor version for added fields', () => {
            const changes = [
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added field "agility" to actor.character',
                    name: 'agility',
                },
                {
                    type: 'added' as const,
                    category: 'action' as const,
                    description: 'Added action "dodge" to actor.character',
                    name: 'dodge',
                },
            ];

            const result = (githubManager as any).determineVersionFromIsdlChanges(changes);
            expect(result).toBe('minor');
        });

        it('should determine minor version for system config changes', () => {
            const changes = [
                {
                    type: 'modified' as const,
                    category: 'system' as const,
                    description: 'Updated system title: My Game System',
                },
            ];

            const result = (githubManager as any).determineVersionFromIsdlChanges(changes);
            expect(result).toBe('minor');
        });

        it('should determine patch version for field modifications', () => {
            const changes = [
                {
                    type: 'modified' as const,
                    category: 'field' as const,
                    description: 'Modified field "health" in actor.character',
                    name: 'health',
                    details: 'Parameters changed',
                },
            ];

            const result = (githubManager as any).determineVersionFromIsdlChanges(changes);
            expect(result).toBe('patch');
        });

        it('should prioritize major changes over minor/patch', () => {
            const changes = [
                {
                    type: 'removed' as const,
                    category: 'field' as const,
                    description: 'Removed field "oldStat"',
                    name: 'oldStat',
                },
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added field "newStat"',
                    name: 'newStat',
                },
                {
                    type: 'modified' as const,
                    category: 'field' as const,
                    description: 'Modified field "health"',
                    name: 'health',
                },
            ];

            const result = (githubManager as any).determineVersionFromIsdlChanges(changes);
            expect(result).toBe('major');
        });

        it('should prioritize minor changes over patch', () => {
            const changes = [
                {
                    type: 'added' as const,
                    category: 'action' as const,
                    description: 'Added action "attack"',
                    name: 'attack',
                },
                {
                    type: 'modified' as const,
                    category: 'field' as const,
                    description: 'Modified field "health"',
                    name: 'health',
                },
            ];

            const result = (githubManager as any).determineVersionFromIsdlChanges(changes);
            expect(result).toBe('minor');
        });
    });

    describe('Field Comparison Logic', () => {
        it('should detect identical fields as equal', () => {
            const field1 = {
                name: 'strength',
                type: 'NumberExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: ['default'],
                parameters: ['min:0', 'max:20', 'value:10'],
            };

            const field2 = {
                name: 'strength',
                type: 'NumberExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: ['default'],
                parameters: ['min:0', 'max:20', 'value:10'],
            };

            const result = (githubManager as any).fieldsEqual(field1, field2);
            expect(result).toBe(true);
        });

        it('should detect different field types', () => {
            const field1 = {
                name: 'health',
                type: 'NumberExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: [],
                parameters: [],
            };

            const field2 = {
                name: 'health',
                type: 'ResourceExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: [],
                parameters: [],
            };

            const result = (githubManager as any).fieldsEqual(field1, field2);
            expect(result).toBe(false);
        });

        it('should detect different modifiers', () => {
            const field1 = {
                name: 'secret',
                type: 'StringExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: ['secret'],
                parameters: [],
            };

            const field2 = {
                name: 'secret',
                type: 'StringExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: ['gmOnly'],
                parameters: [],
            };

            const result = (githubManager as any).fieldsEqual(field1, field2);
            expect(result).toBe(false);
        });

        it('should detect different parameters', () => {
            const field1 = {
                name: 'skill',
                type: 'NumberExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: [],
                parameters: ['min:0', 'max:10'],
            };

            const field2 = {
                name: 'skill',
                type: 'NumberExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: [],
                parameters: ['min:0', 'max:20'],
            };

            const result = (githubManager as any).fieldsEqual(field1, field2);
            expect(result).toBe(false);
        });
    });

    describe('Property Type Detection', () => {
        it('should identify valid property types', () => {
            const validTypes = [
                'StringExp',
                'NumberExp',
                'BooleanExp',
                'HtmlExp',
                'ResourceExp',
                'TrackerExp',
                'AttributeExp',
                'DamageTrackExp',
                'DateExp',
                'TimeExp',
                'DateTimeExp',
                'DieField',
                'DiceField',
                'DocumentArrayExp',
                'SingleDocumentExp',
                'DocumentChoiceExp',
                'ParentPropertyRefExp',
                'StringChoiceField',
                'MeasuredTemplateField',
                'PaperDollExp',
                'MacroField',
                'TableField',
            ];

            for (const type of validTypes) {
                const result = (githubManager as any).isPropertyType(type);
                expect(result).toBe(true);
            }
        });

        it('should reject invalid property types', () => {
            const invalidTypes = [
                'Action',
                'Section',
                'Row',
                'Column',
                'Page',
                'Tab',
                'UnknownType',
                '',
            ];

            for (const type of invalidTypes) {
                const result = (githubManager as any).isPropertyType(type);
                expect(result).toBe(false);
            }
        });
    });

    describe('Change Detection Analysis', () => {
        it('should handle files without ISDL file gracefully', async () => {
            const files = [
                { path: 'system.json', content: '{"version": "1.0.0"}' },
                { path: 'template.json', content: '{"Actor": {}}' },
            ];

            const result = await (githubManager as any).analyzeChangeType(files);

            expect(result.changeType).toBe('patch');
            expect(result.changes).toHaveLength(1);
            expect(result.changes[0].description).toBe('System implementation updated');
        });

        it('should handle ISDL analysis failure gracefully', async () => {
            const files = [
                { path: 'system.isdl', content: 'invalid isdl content' },
            ];

            // Mock failed ISDL parsing
            vi.spyOn(githubManager as any, 'getPreviousFileContent').mockResolvedValue('valid isdl');
            vi.spyOn(githubManager as any, 'compareIsdlVersions').mockRejectedValue(
                new Error('Parse error')
            );

            const result = await (githubManager as any).analyzeChangeType(files);

            expect(result.changeType).toBe('patch');
            expect(result.changes[0].description).toBe('System updated (ISDL analysis failed)');
        });

        it('should handle new ISDL system (no previous version)', async () => {
            const files = [
                { path: 'system.isdl', content: 'config test { id = "test-system" }' },
            ];

            vi.spyOn(githubManager as any, 'getPreviousFileContent').mockResolvedValue(null);

            const result = await (githubManager as any).analyzeChangeType(files);

            expect(result.changeType).toBe('minor');
            expect(result.changes[0].description).toBe('New ISDL system created');
        });
    });

    describe('Field Change Details', () => {
        it('should generate detailed change descriptions for type changes', () => {
            const oldField = {
                name: 'health',
                type: 'NumberExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: ['default'],
                parameters: ['min:0', 'max:100'],
            };

            const newField = {
                name: 'health',
                type: 'ResourceExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: ['default'],
                parameters: ['min:0', 'max:100', 'segments:5'],
            };

            const result = (githubManager as any).getFieldChangeDetails(oldField, newField);

            expect(result).toContain('Type changed from NumberExp to ResourceExp');
            expect(result).toContain('Parameters changed');
        });

        it('should generate descriptions for modifier changes', () => {
            const oldField = {
                name: 'notes',
                type: 'StringExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: ['edit'],
                parameters: [],
            };

            const newField = {
                name: 'notes',
                type: 'StringExp',
                category: 'field' as const,
                location: 'actor.character',
                modifiers: ['gmOnly'],
                parameters: [],
            };

            const result = (githubManager as any).getFieldChangeDetails(oldField, newField);

            expect(result).toContain('Modifiers changed from [edit] to [gmOnly]');
        });
    });

    describe('Field Extraction from AST', () => {
        it('should extract fields from actor documents', () => {
            const mockAst = {
                documents: [
                    {
                        $type: 'Actor',
                        name: 'character',
                        body: [
                            {
                                $type: 'StringExp',
                                name: 'name',
                                modifier: 'default',
                                params: [],
                            },
                            {
                                $type: 'NumberExp',
                                name: 'level',
                                params: [{ $type: 'NumberParamMin', value: 1 }],
                            },
                            {
                                $type: 'Action',
                                name: 'attack',
                                isQuick: true,
                                modifier: 'default',
                                params: [],
                            },
                        ],
                    },
                ],
            };

            const result = (githubManager as any).extractIsdlFields(mockAst);

            expect(result).toHaveLength(3);
            
            // Check string field
            expect(result[0]).toMatchObject({
                name: 'name',
                type: 'StringExp',
                category: 'field',
                location: 'actor.character',
                modifiers: ['default'],
            });

            // Check number field
            expect(result[1]).toMatchObject({
                name: 'level',
                type: 'NumberExp',
                category: 'field',
                location: 'actor.character',
            });

            // Check action
            expect(result[2]).toMatchObject({
                name: 'attack',
                type: 'Action',
                category: 'action',
                location: 'actor.character',
                modifiers: ['quick', 'default'],
            });
        });

        it('should handle nested layout structures', () => {
            const mockAst = {
                documents: [
                    {
                        $type: 'Item',
                        name: 'weapon',
                        body: [
                            {
                                $type: 'Section',
                                name: 'stats',
                                body: [
                                    {
                                        $type: 'NumberExp',
                                        name: 'damage',
                                        params: [],
                                    },
                                    {
                                        $type: 'Row',
                                        body: [
                                            {
                                                $type: 'StringExp',
                                                name: 'type',
                                                params: [],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const result = (githubManager as any).extractIsdlFields(mockAst);

            expect(result).toHaveLength(2);
            expect(result[0].location).toBe('item.weapon.stats');
            expect(result[1].location).toBe('item.weapon.stats'); // Row doesn't add to location since it has no name
        });
    });
});