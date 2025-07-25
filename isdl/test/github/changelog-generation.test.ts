import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubManager } from '../../src/extension/github/githubManager.js';

// Mock VS Code
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
    },
    TreeItem: class TreeItem {},
    TreeDataProvider: class TreeDataProvider {},
    EventEmitter: class EventEmitter {
        event = vi.fn();
        fire = vi.fn();
    },
}));

vi.mock('@octokit/rest');

describe('Changelog Generation', () => {
    let githubManager: GitHubManager;

    beforeEach(() => {
        const mockContext = {
            secrets: { get: vi.fn(), store: vi.fn(), delete: vi.fn() },
            globalState: { get: vi.fn(), update: vi.fn() },
        };
        githubManager = new GitHubManager(mockContext);
        
        // Mock current repository
        githubManager['currentRepository'] = {
            full_name: 'user/test-system',
            name: 'test-system',
        } as any;
    });

    describe('Release Notes Generation', () => {
        it('should generate release notes with no changes', async () => {
            const systemInfo = {
                id: 'test-system',
                title: 'Test System',
                version: '1.0.0',
                author: 'Test Author',
                compatibility: {
                    minimum: '11',
                    verified: '12',
                },
            };

            const result = await (githubManager as any).generateReleaseNotes(systemInfo, []);

            expect(result).toContain('## Test System Release');
            expect(result).toContain('🛠️ System implementation updated');
            expect(result).toContain('🔧 Bug fixes and performance improvements');
            expect(result).toContain('📱 Enhanced user interface');
            expect(result).toContain('System ID:** `test-system`');
            expect(result).toContain('Version:** `1.0.0`');
            expect(result).toContain('Author:** Test Author');
            expect(result).toContain('Foundry VTT Compatibility:** v11 - v12');
            expect(result).toContain('https://github.com/user/test-system/releases/latest/download/system.json');
        });

        it('should generate release notes with breaking changes', async () => {
            const systemInfo = {
                id: 'test-system',
                title: 'Test System',
                version: '2.0.0',
            };

            const changes = [
                {
                    type: 'removed' as const,
                    category: 'field' as const,
                    description: 'Removed field "oldStat" from actor.character',
                    name: 'oldStat',
                    details: 'Type: NumberExp, Modifiers: default',
                },
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added field "newStat" to actor.character',
                    name: 'newStat',
                    details: 'Type: NumberExp, Modifiers: default',
                },
            ];

            const result = await (githubManager as any).generateReleaseNotes(systemInfo, changes);

            expect(result).toContain('#### ⚠️ Breaking Changes');
            expect(result).toContain('**REMOVED:** Removed field "oldStat" from actor.character');
            expect(result).toContain('Type: NumberExp, Modifiers: default');
            expect(result).toContain('#### ✨ New Features');
            expect(result).toContain('📝 Added field "newStat" to actor.character');
        });

        it('should generate release notes with new features only', async () => {
            const systemInfo = {
                id: 'test-system',
                title: 'Test System',
                version: '1.1.0',
            };

            const changes = [
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added field "agility" to actor.character',
                    name: 'agility',
                    details: 'Type: NumberExp',
                },
                {
                    type: 'added' as const,
                    category: 'action' as const,
                    description: 'Added action "dodge" to actor.character',
                    name: 'dodge',
                    details: 'Type: Action, Modifiers: quick',
                },
                {
                    type: 'added' as const,
                    category: 'system' as const,
                    description: 'Added system author: Test Author',
                },
            ];

            const result = await (githubManager as any).generateReleaseNotes(systemInfo, changes);

            expect(result).toContain('#### ✨ New Features');
            expect(result).toContain('🔧 Added system author: Test Author');
            expect(result).toContain('📝 Added field "agility" to actor.character');
            expect(result).toContain('⚡ Added action "dodge" to actor.character');
            expect(result).not.toContain('Breaking Changes');
        });

        it('should generate release notes with improvements only', async () => {
            const systemInfo = {
                id: 'test-system',
                title: 'Test System',
                version: '1.0.1',
            };

            const changes = [
                {
                    type: 'modified' as const,
                    category: 'field' as const,
                    description: 'Modified field "health" in actor.character',
                    name: 'health',
                    details: 'Type changed from NumberExp to ResourceExp',
                },
                {
                    type: 'modified' as const,
                    category: 'action' as const,
                    description: 'Modified action "attack" in actor.character',
                    name: 'attack',
                    details: 'Modifiers changed from [default] to [quick, default]',
                },
            ];

            const result = await (githubManager as any).generateReleaseNotes(systemInfo, changes);

            expect(result).toContain('#### 🔧 Improvements');
            expect(result).toContain('📝 Modified field "health" in actor.character');
            expect(result).toContain('Type changed from NumberExp to ResourceExp');
            expect(result).toContain('⚡ Modified action "attack" in actor.character');
            expect(result).toContain('Modifiers changed from [default] to [quick, default]');
        });

        it('should handle mixed change types with proper priority', async () => {
            const systemInfo = {
                id: 'test-system',
                title: 'Test System',
                version: '2.1.0',
            };

            const changes = [
                {
                    type: 'removed' as const,
                    category: 'field' as const,
                    description: 'Removed field "deprecated" from actor.character',
                    name: 'deprecated',
                },
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added field "new" to actor.character',
                    name: 'new',
                },
                {
                    type: 'modified' as const,
                    category: 'field' as const,
                    description: 'Modified field "existing" in actor.character',
                    name: 'existing',
                },
            ];

            const result = await (githubManager as any).generateReleaseNotes(systemInfo, changes);

            // Should have all three sections in the correct order
            const breakingIndex = result.indexOf('#### ⚠️ Breaking Changes');
            const featuresIndex = result.indexOf('#### ✨ New Features');
            const improvementsIndex = result.indexOf('#### 🔧 Improvements');

            expect(breakingIndex).toBeGreaterThan(-1);
            expect(featuresIndex).toBeGreaterThan(-1);
            expect(improvementsIndex).toBeGreaterThan(-1);

            // Breaking changes should come first
            expect(breakingIndex).toBeLessThan(featuresIndex);
            expect(featuresIndex).toBeLessThan(improvementsIndex);
        });

        it('should handle system info with arrays of authors', async () => {
            const systemInfo = {
                id: 'test-system',
                title: 'Test System',
                version: '1.0.0',
                authors: [
                    { name: 'Author 1' },
                    { name: 'Author 2' },
                ],
            };

            const result = await (githubManager as any).generateReleaseNotes(systemInfo, []);

            expect(result).toContain('Author:** Author 1, Author 2');
        });

        it('should handle minimal system info gracefully', async () => {
            const systemInfo = {};

            const result = await (githubManager as any).generateReleaseNotes(systemInfo, []);

            expect(result).toContain('## ISDL System Release');
            expect(result).toContain('System ID:** `unknown`');
            expect(result).toContain('Version:** `latest`');
            expect(result).toContain('Author:** Unknown');
            expect(result).toContain('Foundry VTT Compatibility:** v11 - v12');
        });
    });

    describe('Changelog Section Generation', () => {
        it('should generate empty changelog section correctly', () => {
            const result = (githubManager as any).generateChangelogSection([]);

            expect(result).toContain("### 🚀 What's New");
            expect(result).toContain('🛠️ System implementation updated');
            expect(result).toContain('🔧 Bug fixes and performance improvements');
            expect(result).toContain('📱 Enhanced user interface');
        });

        it('should prioritize system changes in new features section', () => {
            const changes = [
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added field "skill"',
                    name: 'skill',
                },
                {
                    type: 'added' as const,
                    category: 'system' as const,
                    description: 'Added system description',
                },
                {
                    type: 'added' as const,
                    category: 'action' as const,
                    description: 'Added action "cast"',
                    name: 'cast',
                },
            ];

            const result = (githubManager as any).generateChangelogSection(changes);

            const systemIndex = result.indexOf('🔧 Added system description');
            const fieldIndex = result.indexOf('📝 Added field "skill"');
            const actionIndex = result.indexOf('⚡ Added action "cast"');

            // System changes should come first
            expect(systemIndex).toBeLessThan(fieldIndex);
            expect(fieldIndex).toBeLessThan(actionIndex);
        });

        it('should handle changes without details', () => {
            const changes = [
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added field "simple"',
                    name: 'simple',
                    // No details property
                },
            ];

            const result = (githubManager as any).generateChangelogSection(changes);

            expect(result).toContain('📝 Added field "simple"');
            expect(result).not.toContain('  -'); // No detail lines
        });

        it('should include details when provided', () => {
            const changes = [
                {
                    type: 'modified' as const,
                    category: 'field' as const,
                    description: 'Modified field "complex"',
                    name: 'complex',
                    details: 'Type changed from StringExp to NumberExp; Parameters changed',
                },
            ];

            const result = (githubManager as any).generateChangelogSection(changes);

            expect(result).toContain('📝 Modified field "complex"');
            expect(result).toContain('  - Type changed from StringExp to NumberExp; Parameters changed');
        });
    });

    describe('Edge Cases', () => {
        it('should handle undefined change properties gracefully', () => {
            const changes = [
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Added unnamed field',
                    // name and details are undefined
                },
            ];

            const result = (githubManager as any).generateChangelogSection(changes);

            expect(result).toContain('📝 Added unnamed field');
            expect(result).not.toContain('  -');
        });

        it('should handle empty change arrays', () => {
            const changes: any[] = [];

            const result = (githubManager as any).generateChangelogSection(changes);

            expect(result).toContain("### 🚀 What's New");
            expect(result).not.toContain('Breaking Changes');
            expect(result).not.toContain('New Features');
            expect(result).not.toContain('Improvements');
        });

        it('should assign correct icons for different categories', () => {
            const changes = [
                {
                    type: 'added' as const,
                    category: 'field' as const,
                    description: 'Field change',
                },
                {
                    type: 'added' as const,
                    category: 'action' as const,
                    description: 'Action change',
                },
                {
                    type: 'added' as const,
                    category: 'system' as const,
                    description: 'System change',
                },
                {
                    type: 'modified' as const,
                    category: 'implementation' as const,
                    description: 'Implementation change',
                },
            ];

            const result = (githubManager as any).generateChangelogSection(changes);

            expect(result).toContain('📝 Field change');
            expect(result).toContain('⚡ Action change');
            expect(result).toContain('🔧 System change');
            expect(result).toContain('🛠️ Implementation change');
        });
    });
});