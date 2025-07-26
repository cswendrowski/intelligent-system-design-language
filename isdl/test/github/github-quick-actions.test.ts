import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubQuickActions } from '../../src/extension/github/githubQuickActions.js';
import { GitHubManager } from '../../src/extension/github/githubManager.js';
import * as vscode from 'vscode';

// Mock VS Code
vi.mock('vscode', () => ({
    window: {
        showQuickPick: vi.fn(),
        showInputBox: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        withProgress: vi.fn(),
    },
    workspace: {
        workspaceFolders: [{
            name: 'test-workspace',
        }],
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
        })),
        findFiles: vi.fn(),
        asRelativePath: vi.fn(),
    },
    commands: {
        executeCommand: vi.fn(),
    },
    env: {
        openExternal: vi.fn(),
    },
    Uri: {
        parse: vi.fn(),
        file: vi.fn(),
    },
    ProgressLocation: {
        Notification: 15,
    },
    QuickPickItemKind: {
        Separator: 1,
    },
    TreeItem: class TreeItem {},
    TreeDataProvider: class TreeDataProvider {},
    EventEmitter: class EventEmitter {
        event = vi.fn();
        fire = vi.fn();
    },
}));

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
    basename: vi.fn((path: string) => path.split('/').pop() || path),
    join: vi.fn((...paths: string[]) => paths.join('/')),
    relative: vi.fn((from: string, to: string) => to.replace(from, '')),
}));

// Mock language services
vi.mock('../../src/language/intelligent-system-design-language-module.js', () => ({
    createIntelligentSystemDesignLanguageServices: vi.fn(() => ({
        IntelligentSystemDesignLanguage: mockLanguageService,
    })),
}));

vi.mock('../../src/cli/cli-util.js', () => ({
    extractAstNode: vi.fn(() => ({
        config: {
            body: [
                { type: 'id', value: 'test-system' },
            ],
        },
    })),
}));

const mockLanguageService = {
    // Mock language service properties
};

describe('GitHubQuickActions', () => {
    let quickActions: GitHubQuickActions;
    let mockGitHubManager: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock GitHub manager
        mockGitHubManager = {
            listRepositories: vi.fn(),
            createRepository: vi.fn(),
            setRepository: vi.fn(),
            getCurrentRepository: vi.fn(),
            disconnectRepository: vi.fn(),
            addRepositoryTopics: vi.fn(),
            initializeMainBranch: vi.fn(),
            createFile: vi.fn(),
            uploadFiles: vi.fn(),
            ensureWorkflowFile: vi.fn(),
            publishSystem: vi.fn(),
            updateSystem: vi.fn(),
        };

        quickActions = new GitHubQuickActions(mockGitHubManager);
    });

    describe('Repository Selection', () => {
        it('should show create repository option when no repositories exist', async () => {
            mockGitHubManager.listRepositories.mockResolvedValue([]);
            
            const mockShowInformationMessage = vi.mocked(vscode.window.showInformationMessage);
            mockShowInformationMessage.mockResolvedValue('Create Repository');

            const createRepositorySpy = vi.spyOn(quickActions as any, 'createRepository').mockResolvedValue(undefined);

            await quickActions.selectRepository();

            expect(mockShowInformationMessage).toHaveBeenCalledWith(
                'No repositories found in your GitHub account.',
                'Create Repository',
                'Cancel'
            );
            expect(createRepositorySpy).toHaveBeenCalled();
        });

        it('should categorize repositories as recommended based on topics', async () => {
            const mockRepos = [
                {
                    id: 1,
                    name: 'foundry-system',
                    topics: ['foundry-vtt', 'isdl'],
                    description: 'A Foundry system',
                    private: false,
                },
                {
                    id: 2,
                    name: 'other-project',
                    topics: ['web'],
                    description: 'Other project',
                    private: false,
                },
                {
                    id: 3,
                    name: 'isdl-project',
                    topics: [],
                    description: 'ISDL based project',
                    private: true,
                },
            ];

            mockGitHubManager.listRepositories.mockResolvedValue(mockRepos);

            const mockShowQuickPick = vi.mocked(vscode.window.showQuickPick);
            mockShowQuickPick.mockResolvedValue({
                label: '$(repo) foundry-system',
                repository: mockRepos[0],
            });

            await quickActions.selectRepository();

            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: '$(repo-create) Create New Repository',
                    }),
                    expect.objectContaining({
                        label: 'Recommended',
                        kind: expect.anything(),
                    }),
                    expect.objectContaining({
                        label: '$(repo) foundry-system',
                        description: '$(unlock) Public',
                        detail: 'A Foundry system',
                    }),
                    expect.objectContaining({
                        label: 'All Repositories',
                        kind: expect.anything(),
                    }),
                    expect.objectContaining({
                        label: '$(repo) other-project',
                    }),
                ]),
                expect.objectContaining({
                    title: 'Select GitHub Repository',
                })
            );

            expect(mockGitHubManager.setRepository).toHaveBeenCalledWith(mockRepos[0]);
        });

        it('should handle repository selection with private repos', async () => {
            const mockRepos = [
                {
                    id: 1,
                    name: 'private-repo',
                    topics: ['foundry-vtt'],
                    description: 'Private repository',
                    private: true,
                },
            ];

            mockGitHubManager.listRepositories.mockResolvedValue(mockRepos);

            const mockShowQuickPick = vi.mocked(vscode.window.showQuickPick);
            mockShowQuickPick.mockResolvedValue({
                label: '$(repo) private-repo',
                repository: mockRepos[0],
            });

            await quickActions.selectRepository();

            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: '$(repo) private-repo',
                        description: '$(lock) Private',
                    }),
                ]),
                expect.anything()
            );
        });
    });

    describe('Repository Creation', () => {
        it('should validate repository name input', async () => {
            const mockShowInputBox = vi.mocked(vscode.window.showInputBox);
            
            // Mock the name input validation
            mockShowInputBox.mockImplementation(async ({ validateInput }) => {
                if (validateInput) {
                    // Test various invalid inputs
                    expect(await validateInput('')).toBe('Repository name is required');
                    expect(await validateInput('invalid name!')).toBe('Invalid characters in repository name');
                    expect(await validateInput('a'.repeat(101))).toBe('Repository name too long (max 100 characters)');
                }
                return 'valid-repo-name';
            });

            // Mock subsequent inputs
            mockShowInputBox
                .mockResolvedValueOnce('valid-repo-name')
                .mockResolvedValueOnce('Test description');

            const mockShowQuickPick = vi.mocked(vscode.window.showQuickPick);
            mockShowQuickPick
                .mockResolvedValueOnce({ label: '$(unlock) Public' })
                .mockResolvedValueOnce([
                    { label: '$(book) Include README' },
                    { label: '$(law) Include License' },
                ]);

            const selectLicenseSpy = vi.spyOn(quickActions as any, 'selectLicense').mockResolvedValue('mit');
            const createRepositoryWithOptionsSpy = vi.spyOn(quickActions as any, 'createRepositoryWithOptions').mockResolvedValue({
                name: 'valid-repo-name',
                html_url: 'https://github.com/user/valid-repo-name',
            });

            await quickActions.createRepository();

            expect(createRepositoryWithOptionsSpy).toHaveBeenCalledWith({
                name: 'valid-repo-name',
                description: 'Test description',
                isPrivate: false,
                includeReadme: true,
                includeLicense: 'mit',
                includeGitignore: true,
                initializeWithSystemFiles: false,
            });
        });

        it('should check for existing repository names', async () => {
            const mockRepos = [
                { name: 'existing-repo' },
            ];

            mockGitHubManager.listRepositories.mockResolvedValue(mockRepos);

            const mockShowInputBox = vi.mocked(vscode.window.showInputBox);
            mockShowInputBox.mockImplementation(async ({ validateInput }) => {
                if (validateInput) {
                    const result = await validateInput('existing-repo');
                    expect(result).toBe("Repository 'existing-repo' already exists in your account");
                }
                return null; // Cancel
            });

            await quickActions.createRepository();

            expect(mockShowInputBox).toHaveBeenCalled();
        });

        it('should handle license selection', async () => {
            const licenses = [
                { label: 'MIT License', value: 'mit' },
                { label: 'Apache License 2.0', value: 'apache-2.0' },
                { label: 'GNU GPL v3.0', value: 'gpl-3.0' },
            ];

            const mockShowQuickPick = vi.mocked(vscode.window.showQuickPick);
            mockShowQuickPick.mockResolvedValue(licenses[0]);

            const result = await (quickActions as any).selectLicense();

            expect(result).toBe('mit');
            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'MIT License',
                        value: 'mit',
                    }),
                ]),
                expect.objectContaining({
                    title: 'Select License',
                })
            );
        });
    });

    describe('System File Initialization', () => {
        it('should include ISDL file when initializing with system files', async () => {
            const fs = await import('fs');
            const mockFs = vi.mocked(fs);
            
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync
                .mockReturnValueOnce('{"version": "1.0.0"}') // system file (first)
                .mockReturnValueOnce('config test { id = "test-system" }'); // ISDL file (second)

            mockFs.readdirSync.mockReturnValue([
                { name: 'system.json', isDirectory: () => false, isFile: () => true },
            ] as any);

            const mockConfig = {
                get: vi.fn().mockReturnValue('/mock/path'),
            };
            vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

            const selectIsdlFileSpy = vi.spyOn(quickActions as any, 'selectIsdlFile').mockResolvedValue('/mock/test.isdl');

            const mockRepository = {
                id: 1,
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            mockGitHubManager.uploadFiles.mockResolvedValue(true);
            mockGitHubManager.ensureWorkflowFile.mockResolvedValue(true);

            const mockWithProgress = vi.mocked(vscode.window.withProgress);
            mockWithProgress.mockImplementation(async (options, callback) => {
                const mockProgress = {
                    report: vi.fn(),
                };
                return await callback(mockProgress as any, {} as any);
            });

            await (quickActions as any).initializeWithSystemFiles(mockRepository);

            expect(mockGitHubManager.uploadFiles).toHaveBeenCalledWith(
                mockRepository,
                [
                    {
                        path: '/system.json',
                        content: '{"version": "1.0.0"}',
                    },
                    {
                        path: 'test.isdl',
                        content: 'config test { id = "test-system" }',
                    },
                ],
                'Add test-system system files (2 files)',
                expect.any(Function)
            );
        });

        it('should handle missing ISDL files gracefully', async () => {
            const mockFindFiles = vi.mocked(vscode.workspace.findFiles);
            mockFindFiles.mockResolvedValue([]);

            const mockShowErrorMessage = vi.mocked(vscode.window.showErrorMessage);

            const result = await (quickActions as any).selectIsdlFile();

            expect(result).toBeUndefined();
            expect(mockShowErrorMessage).toHaveBeenCalledWith('No .isdl files found in the workspace.');
        });

        it('should auto-select single ISDL file', async () => {
            const mockUri = {
                fsPath: '/mock/single.isdl',
            };

            const mockFindFiles = vi.mocked(vscode.workspace.findFiles);
            mockFindFiles.mockResolvedValue([mockUri] as any);

            const result = await (quickActions as any).selectIsdlFile();

            expect(result).toBe('/mock/single.isdl');
        });

        it('should prompt for selection with multiple ISDL files', async () => {
            const mockUris = [
                { fsPath: '/mock/system1.isdl' },
                { fsPath: '/mock/system2.isdl' },
            ];

            const mockFindFiles = vi.mocked(vscode.workspace.findFiles);
            mockFindFiles.mockResolvedValue(mockUris as any);

            const mockAsRelativePath = vi.mocked(vscode.workspace.asRelativePath);
            mockAsRelativePath
                .mockReturnValueOnce('system1.isdl')
                .mockReturnValueOnce('system2.isdl');

            const mockShowQuickPick = vi.mocked(vscode.window.showQuickPick);
            mockShowQuickPick.mockResolvedValue({
                label: 'system1.isdl',
                uri: mockUris[0],
            });

            const result = await (quickActions as any).selectIsdlFile();

            expect(result).toBe('/mock/system1.isdl');
            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: 'system1.isdl',
                        description: 'system1.isdl',
                    }),
                ]),
                expect.objectContaining({
                    title: 'Select ISDL File',
                })
            );
        });
    });

    describe('Publishing Integration', () => {
        it('should redirect to repository selection when no repository connected', async () => {
            mockGitHubManager.getCurrentRepository.mockReturnValue(null);

            const mockShowInformationMessage = vi.mocked(vscode.window.showInformationMessage);
            mockShowInformationMessage.mockResolvedValue('Select Repository');

            const selectRepositorySpy = vi.spyOn(quickActions, 'selectRepository').mockResolvedValue(undefined);

            await quickActions.publishSystem();

            expect(mockShowInformationMessage).toHaveBeenCalledWith(
                'No repository connected. Please select a repository first.',
                'Select Repository',
                'Create Repository'
            );
            expect(selectRepositorySpy).toHaveBeenCalled();
        });

        it('should call GitHub manager publish when repository is connected', async () => {
            const mockRepo = {
                id: 1,
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            mockGitHubManager.getCurrentRepository.mockReturnValue(mockRepo);
            mockGitHubManager.publishSystem.mockResolvedValue(true);

            await quickActions.publishSystem();

            expect(mockGitHubManager.publishSystem).toHaveBeenCalled();
        });
    });

    describe('Update Integration', () => {
        it('should redirect to repository selection when no repository connected for update', async () => {
            mockGitHubManager.getCurrentRepository.mockReturnValue(null);

            const mockShowInformationMessage = vi.mocked(vscode.window.showInformationMessage);
            mockShowInformationMessage.mockResolvedValue('Select Repository');

            const selectRepositorySpy = vi.spyOn(quickActions, 'selectRepository').mockResolvedValue(undefined);

            await quickActions.updateSystem();

            expect(mockShowInformationMessage).toHaveBeenCalledWith(
                'No repository connected. Please select a repository first.',
                'Select Repository',
                'Create Repository'
            );
            expect(selectRepositorySpy).toHaveBeenCalled();
        });

        it('should call GitHub manager update when repository is connected', async () => {
            const mockRepo = {
                id: 1,
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            mockGitHubManager.getCurrentRepository.mockReturnValue(mockRepo);
            mockGitHubManager.updateSystem.mockResolvedValue(true);

            await quickActions.updateSystem();

            expect(mockGitHubManager.updateSystem).toHaveBeenCalled();
        });
    });

    describe('Disconnect Repository', () => {
        it('should confirm before disconnecting repository', async () => {
            const mockRepo = {
                name: 'test-repo',
            };

            mockGitHubManager.getCurrentRepository.mockReturnValue(mockRepo);

            const mockShowWarningMessage = vi.mocked(vscode.window.showWarningMessage);
            mockShowWarningMessage.mockResolvedValue('Disconnect');

            const mockShowInformationMessage = vi.mocked(vscode.window.showInformationMessage);

            await quickActions.disconnectRepository();

            expect(mockShowWarningMessage).toHaveBeenCalledWith(
                "Disconnect from repository 'test-repo'?",
                { modal: true },
                'Disconnect'
            );
            expect(mockGitHubManager.disconnectRepository).toHaveBeenCalled();
            expect(mockShowInformationMessage).toHaveBeenCalledWith('Repository disconnected');
        });

        it('should not disconnect if user cancels', async () => {
            const mockRepo = {
                name: 'test-repo',
            };

            mockGitHubManager.getCurrentRepository.mockReturnValue(mockRepo);

            const mockShowWarningMessage = vi.mocked(vscode.window.showWarningMessage);
            mockShowWarningMessage.mockResolvedValue(undefined); // Cancel

            await quickActions.disconnectRepository();

            expect(mockGitHubManager.disconnectRepository).not.toHaveBeenCalled();
        });

        it('should handle no repository gracefully', async () => {
            mockGitHubManager.getCurrentRepository.mockReturnValue(null);

            await quickActions.disconnectRepository();

            expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        });
    });
});