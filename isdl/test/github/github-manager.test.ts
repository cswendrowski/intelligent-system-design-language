import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { GitHubManager } from '../../src/extension/github/githubManager.js';
import { GitHubAuthProvider } from '../../src/extension/github/githubAuthProvider.js';
import { GitHubConfigurationManager } from '../../src/extension/github/githubConfig.js';
import { Octokit } from '@octokit/rest';

// Mock VS Code
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        withProgress: vi.fn(),
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
        })),
        findFiles: vi.fn(),
        asRelativePath: vi.fn(),
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
    TreeItem: class TreeItem {},
    TreeDataProvider: class TreeDataProvider {},
    EventEmitter: class EventEmitter {
        event = vi.fn();
        fire = vi.fn();
    },
}));

// Mock Octokit
vi.mock('@octokit/rest');

// Mock the language services
vi.mock('../../src/language/intelligent-system-design-language-module.js', () => ({
    createIntelligentSystemDesignLanguageServices: vi.fn(() => ({
        IntelligentSystemDesignLanguage: {
            shared: {
                workspace: {
                    LangiumDocuments: {
                        createDocument: vi.fn(() => ({
                            parseResult: {
                                value: {
                                    documents: [],
                                    config: {
                                        body: [
                                            { type: 'id', value: 'test-system' },
                                            { type: 'title', value: 'Test System' },
                                        ],
                                    },
                                },
                            },
                        })),
                    },
                    DocumentBuilder: {
                        build: vi.fn(),
                    },
                },
            },
        },
    })),
}));

// Mock fs
vi.mock('fs', () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
}));

// Mock crypto
vi.mock('crypto', () => ({
    createHash: vi.fn(() => {
        let content = '';
        const hashObject = {
            update: vi.fn().mockImplementation((data) => {
                content = data;
                return hashObject;
            }),
            digest: vi.fn(() => {
                // Return different hashes based on blob content (git format: blob <size>\0<content>)
                if (content.includes('{"version": "1.0.0"}')) {
                    return 'mock-hash-12345'; // system.json hash
                } else if (content.includes('{"Actor": {}}')) {
                    return 'mock-hash-67890'; // template.json hash
                } else if (content.includes('console.log("hello");')) {
                    return 'mock-hash-newfile'; // new file hash
                } else {
                    return 'mock-hash-default';
                }
            }),
        };
        return hashObject;
    }),
}));

describe('GitHubManager', () => {
    let githubManager: GitHubManager;
    let mockContext: any;
    let mockOctokit: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock VS Code extension context
        mockContext = {
            secrets: {
                get: vi.fn(),
                store: vi.fn(),
                delete: vi.fn(),
            },
            globalState: {
                get: vi.fn(),
                update: vi.fn(),
            },
        };

        // Create mock Octokit instance
        mockOctokit = {
            repos: {
                listForAuthenticatedUser: vi.fn(),
                createForAuthenticatedUser: vi.fn(),
                replaceAllTopics: vi.fn(),
                createOrUpdateFileContents: vi.fn(),
                getContent: vi.fn(),
                update: vi.fn(),
                listReleases: vi.fn(),
                listTags: vi.fn(),
                createRelease: vi.fn(),
            },
            git: {
                getRef: vi.fn(),
                createRef: vi.fn(),
                updateRef: vi.fn(),
                deleteRef: vi.fn(),
                createBlob: vi.fn(),
                createTree: vi.fn(),
                createCommit: vi.fn(),
                getCommit: vi.fn(),
            },
        };

        // Mock Octokit constructor
        (Octokit as any).mockImplementation(() => mockOctokit);

        githubManager = new GitHubManager(mockContext);

        // Manually set the octokit instance and mock initializeOctokit
        (githubManager as any).octokit = mockOctokit;
        vi.spyOn(githubManager as any, 'initializeOctokit').mockResolvedValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Repository Management', () => {
        it('should list repositories successfully', async () => {
            const mockRepos = [
                {
                    id: 1,
                    name: 'test-repo',
                    full_name: 'user/test-repo',
                    html_url: 'https://github.com/user/test-repo',
                    clone_url: 'https://github.com/user/test-repo.git',
                    ssh_url: 'git@github.com:user/test-repo.git',
                    private: false,
                    description: 'Test repository',
                    topics: ['foundry-vtt', 'isdl'],
                },
            ];

            mockOctokit.repos.listForAuthenticatedUser.mockResolvedValue({
                data: mockRepos,
            });

            // Authentication is handled by setting octokit directly in beforeEach

            const result = await githubManager.listRepositories();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({
                id: 1,
                name: 'test-repo',
                full_name: 'user/test-repo',
                topics: ['foundry-vtt', 'isdl'],
            });
        });

        it('should create repository with correct parameters', async () => {
            const mockRepo = {
                id: 1,
                name: 'new-repo',
                full_name: 'user/new-repo',
                html_url: 'https://github.com/user/new-repo',
                clone_url: 'https://github.com/user/new-repo.git',
                ssh_url: 'git@github.com:user/new-repo.git',
                private: false,
                description: 'New repository',
                topics: [],
            };

            mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
                data: mockRepo,
            });

            // Authentication is handled by setting octokit directly in beforeEach

            const result = await githubManager.createRepository(
                'new-repo',
                'New repository',
                false,
                'mit'
            );

            expect(mockOctokit.repos.createForAuthenticatedUser).toHaveBeenCalledWith({
                name: 'new-repo',
                description: 'New repository',
                private: false,
                auto_init: false,
                has_issues: true,
                has_projects: false,
                has_wiki: true,
                has_discussions: true,
                license_template: 'mit',
                gitignore_template: 'Node',
            });

            expect(result).toMatchObject(mockRepo);
        });
    });

    describe('File Change Detection', () => {
        it('should detect files that need committing based on hash comparison', async () => {
            const mockFiles = [
                { path: 'system.json', content: '{"version": "1.0.0"}' },
                { path: 'template.json', content: '{"Actor": {}}' },
            ];

            const mockRepository = {
                id: 1,
                name: 'test-repo',
                full_name: 'user/test-repo',
                html_url: 'https://github.com/user/test-repo',
                clone_url: 'https://github.com/user/test-repo.git',
                ssh_url: 'git@github.com:user/test-repo.git',
                private: false,
                description: 'Test repo',
                topics: [],
            };

            // Mock existing file (system.json unchanged, template.json changed)
            mockOctokit.repos.getContent
                .mockResolvedValueOnce({
                    data: {
                        sha: 'mock-hash-12345', // Same hash as generated for system.json (unchanged)
                    },
                })
                .mockResolvedValueOnce({
                    data: {
                        sha: 'different-hash-template', // Different from mock-hash-67890 (changed)
                    },
                });

            // Authentication is handled by setting octokit directly in beforeEach

            const result = await (githubManager as any).getFilesNeedingCommit(
                mockRepository,
                mockFiles
            );

            expect(result).toHaveLength(2);
            expect(result[0].needsCommit).toBe(false); // system.json unchanged (same hash)
            expect(result[1].needsCommit).toBe(true);  // template.json changed (different hash)
        });

        it('should mark new files as needing commit', async () => {
            const mockFiles = [
                { path: 'new-file.js', content: 'console.log("hello");' },
            ];

            const mockRepository = {
                id: 1,
                name: 'test-repo',
                full_name: 'user/test-repo',
                html_url: 'https://github.com/user/test-repo',
                clone_url: 'https://github.com/user/test-repo.git',
                ssh_url: 'git@github.com:user/test-repo.git',
                private: false,
                description: 'Test repo',
                topics: [],
            };

            // Mock file not found (404)
            mockOctokit.repos.getContent.mockRejectedValue({ status: 404 });

            // Authentication is handled by setting octokit directly in beforeEach

            const result = await (githubManager as any).getFilesNeedingCommit(
                mockRepository,
                mockFiles
            );

            expect(result).toHaveLength(1);
            expect(result[0].needsCommit).toBe(true);
        });
    });

    describe('Semantic Version Generation', () => {
        it('should generate next patch version when no major/minor changes', async () => {
            const mockTags = [
                { name: 'v1.2.3' },
                { name: 'v1.2.2' },
                { name: 'v1.1.0' },
            ];

            mockOctokit.repos.listTags.mockResolvedValue({ data: mockTags });

            // Authentication is handled by setting octokit directly in beforeEach
            githubManager['currentRepository'] = {
                full_name: 'user/test-repo',
                name: 'test-repo',
            } as any;

            const result = await (githubManager as any).generateVersionNumber('patch');

            expect(result).toBe('1.2.4');
        });

        it('should generate next minor version', async () => {
            const mockTags = [
                { name: 'v1.2.3' },
                { name: 'v1.2.2' },
            ];

            mockOctokit.repos.listTags.mockResolvedValue({ data: mockTags });

            // Authentication is handled by setting octokit directly in beforeEach
            githubManager['currentRepository'] = {
                full_name: 'user/test-repo',
                name: 'test-repo',
            } as any;

            const result = await (githubManager as any).generateVersionNumber('minor');

            expect(result).toBe('1.3.0');
        });

        it('should generate next major version', async () => {
            const mockTags = [
                { name: 'v1.2.3' },
            ];

            mockOctokit.repos.listTags.mockResolvedValue({ data: mockTags });

            // Authentication is handled by setting octokit directly in beforeEach
            githubManager['currentRepository'] = {
                full_name: 'user/test-repo',
                name: 'test-repo',
            } as any;

            const result = await (githubManager as any).generateVersionNumber('major');

            expect(result).toBe('2.0.0');
        });

        it('should handle non-semantic version tags gracefully', async () => {
            const mockTags = [
                { name: 'release-1.0' }, // Invalid - should be ignored
                { name: 'v1.2.3' },      // Valid semantic version
                { name: 'beta' },        // Invalid - should be ignored
                { name: 'v2.0.0-alpha' }, // Valid semantic version with pre-release
            ];

            mockOctokit.repos.listTags.mockResolvedValue({ data: mockTags });

            // Authentication is handled by setting octokit directly in beforeEach
            githubManager['currentRepository'] = {
                full_name: 'user/test-repo',
                name: 'test-repo',
            } as any;

            const result = await (githubManager as any).generateVersionNumber('patch');

            expect(result).toBe('2.0.1'); // Should use the highest valid semantic version (2.0.0-alpha)
        });
    });

    describe('Git Tree Creation', () => {
        it('should create tree with proper base tree reference', async () => {
            const mockFiles = [
                { path: 'file1.js', content: 'content1', hash: '', needsCommit: true },
                { path: 'file2.js', content: 'content2', hash: '', needsCommit: true },
            ];

            const mockRepository = {
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            const mockCommit = {
                data: {
                    tree: { sha: 'tree-sha-12345' },
                },
            };

            const mockBranchRef = {
                data: {
                    object: { sha: 'commit-sha-67890' },
                },
            };

            // Mock file hash check - both files need committing (different from generated hashes)
            mockOctokit.repos.getContent
                .mockResolvedValueOnce({ data: { sha: 'remote-hash-1' } }) // Different from mock-hash-default
                .mockResolvedValueOnce({ data: { sha: 'remote-hash-2' } }); // Different from mock-hash-default

            mockOctokit.git.getRef.mockResolvedValue(mockBranchRef);
            mockOctokit.git.getCommit.mockResolvedValue(mockCommit);
            mockOctokit.git.createBlob
                .mockResolvedValueOnce({ data: { sha: 'blob1-sha' } })
                .mockResolvedValueOnce({ data: { sha: 'blob2-sha' } });
            mockOctokit.git.createTree.mockResolvedValue({ data: { sha: 'new-tree-sha' } });
            mockOctokit.git.createCommit.mockResolvedValue({ data: { sha: 'new-commit-sha' } });
            mockOctokit.git.updateRef.mockResolvedValue({});

            // Authentication is handled by setting octokit directly in beforeEach
            // Let getFilesNeedingCommit run normally to test the full flow

            const result = await githubManager.uploadFiles(
                mockRepository as any,
                mockFiles,
                'Test commit'
            );

            expect(result.success).toBe(true);
            expect(result.hasChanges).toBe(true);
            expect(result.changedFiles).toBe(2);
            expect(mockOctokit.git.getCommit).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                commit_sha: 'commit-sha-67890',
            });
            expect(mockOctokit.git.createTree).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                tree: [
                    { path: 'file1.js', mode: '100644', type: 'blob', sha: 'blob1-sha' },
                    { path: 'file2.js', mode: '100644', type: 'blob', sha: 'blob2-sha' },
                ],
                base_tree: 'tree-sha-12345',
            });
        });

        it('should handle empty repository without base tree', async () => {
            const mockFiles = [
                { path: 'system.json', content: '{}', hash: '', needsCommit: true },
            ];

            const mockRepository = {
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            // Mock file not found in repository (new file)
            mockOctokit.repos.getContent.mockRejectedValue({ status: 404 });

            // Mock empty repository (no main branch exists initially, but gets created)
            mockOctokit.git.getRef
                .mockRejectedValueOnce({ status: 404 }) // First call fails (branch doesn't exist)
                .mockResolvedValueOnce({ // Second call succeeds (after initializeMainBranch)
                    data: { object: { sha: '0000000000000000000000000000000000000000' } }
                });
            
            mockOctokit.git.createBlob.mockResolvedValue({ data: { sha: 'blob-sha' } });
            mockOctokit.git.createTree.mockResolvedValue({ data: { sha: 'tree-sha' } });
            mockOctokit.git.createCommit.mockResolvedValue({ data: { sha: 'commit-sha' } });
            
            // For empty repo, updateRef will fail, but we'll mock it to succeed
            mockOctokit.git.updateRef.mockResolvedValue({});

            // Authentication is handled by setting octokit directly in beforeEach
            // Let getFilesNeedingCommit run normally to test the full flow
            vi.spyOn(githubManager as any, 'initializeMainBranch').mockResolvedValue(undefined);

            const result = await githubManager.uploadFiles(
                mockRepository as any,
                mockFiles,
                'Initial commit'
            );

            expect(result.success).toBe(true);
            expect(result.hasChanges).toBe(true);
            expect(result.changedFiles).toBe(1);
            expect(mockOctokit.git.createTree).toHaveBeenCalledWith(
                expect.objectContaining({
                    owner: 'user',
                    repo: 'test-repo',
                    tree: expect.any(Array),
                    // Should not have base_tree for empty repo
                })
            );
            // Verify base_tree is not set
            const createTreeCall = mockOctokit.git.createTree.mock.calls[0][0];
            expect(createTreeCall).not.toHaveProperty('base_tree');
        });
    });

    describe('Tag-based Comparison', () => {
        it('should get latest semantic tag for comparison', async () => {
            const mockTags = [
                { name: 'v1.0.0' },
                { name: 'v1.1.0' },
                { name: 'v1.2.3' },
                { name: 'v0.9.0' },
                { name: 'random-tag' }, // Non-semantic tag
            ];

            // Set up repository
            (githubManager as any).currentRepository = {
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            mockOctokit.repos.listTags.mockResolvedValue({
                data: mockTags
            });

            const latestTag = await (githubManager as any).getLatestSemanticTag();

            expect(mockOctokit.repos.listTags).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                per_page: 100
            });

            expect(latestTag).toBe('v1.2.3'); // Should get the highest semantic version
        });

        it('should return null when no semantic tags exist', async () => {
            // Set up repository
            (githubManager as any).currentRepository = {
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            mockOctokit.repos.listTags.mockResolvedValue({
                data: [
                    { name: 'random-tag' },
                    { name: 'another-tag' }
                ]
            });

            const latestTag = await (githubManager as any).getLatestSemanticTag();

            expect(latestTag).toBeNull();
        });

        it('should return null when no tags exist', async () => {
            // Set up repository
            (githubManager as any).currentRepository = {
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            mockOctokit.repos.listTags.mockResolvedValue({
                data: []
            });

            const latestTag = await (githubManager as any).getLatestSemanticTag();

            expect(latestTag).toBeNull();
        });

        it('should get file content from latest tag for comparison', async () => {
            // Set up repository
            (githubManager as any).currentRepository = {
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            // Mock getting the latest tag
            mockOctokit.repos.listTags.mockResolvedValue({
                data: [{ name: 'v1.0.0' }]
            });

            // Mock getting file content from that tag
            mockOctokit.repos.getContent.mockResolvedValue({
                data: {
                    content: Buffer.from('previous isdl content').toString('base64')
                }
            });

            const content = await (githubManager as any).getPreviousFileContent('system.isdl');

            expect(mockOctokit.repos.listTags).toHaveBeenCalled();
            expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                path: 'system.isdl',
                ref: 'v1.0.0' // Should use the tag, not the default branch
            });

            expect(content).toBe('previous isdl content');
        });
    });

    describe('Main Branch Initialization', () => {
        it('should preserve existing files when initializing main branch', async () => {
            const mockRepository = {
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            // Mock existing master branch with LICENSE and .gitignore
            const mockMasterRef = {
                data: { object: { sha: 'master-commit-sha' } }
            };

            const mockMasterCommit = {
                data: { tree: { sha: 'master-tree-sha' } }
            };

            mockOctokit.git.getRef.mockResolvedValue(mockMasterRef);
            mockOctokit.git.getCommit.mockResolvedValue(mockMasterCommit);
            mockOctokit.git.createTree.mockResolvedValue({ data: { sha: 'new-tree-sha' } });
            mockOctokit.git.createCommit.mockResolvedValue({ data: { sha: 'new-commit-sha' } });
            mockOctokit.git.createRef.mockResolvedValue({});
            mockOctokit.repos.update.mockResolvedValue({});

            await (githubManager as any).initializeMainBranch(mockRepository);

            // Should check for existing master branch
            expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                ref: 'heads/master'
            });

            // Should get the commit to extract tree
            expect(mockOctokit.git.getCommit).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                commit_sha: 'master-commit-sha'
            });

            // Should create tree with base_tree to preserve existing files
            expect(mockOctokit.git.createTree).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                base_tree: 'master-tree-sha',
                tree: [{
                    path: '.gitkeep',
                    mode: '100644',
                    type: 'blob',
                    content: '# Repository initialized with ISDL\n'
                }]
            });

            // Should create commit with parent
            expect(mockOctokit.git.createCommit).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                message: 'Initialize main branch',
                tree: 'new-tree-sha',
                parents: ['master-commit-sha']
            });
        });

        it('should create new repository structure when no existing files found', async () => {
            const mockRepository = {
                name: 'test-repo',
                full_name: 'user/test-repo',
            };

            // Mock no existing master branch
            mockOctokit.git.getRef.mockRejectedValue({ status: 404 });
            mockOctokit.git.createBlob.mockResolvedValue({ data: { sha: 'blob-sha' } });
            mockOctokit.git.createTree.mockResolvedValue({ data: { sha: 'new-tree-sha' } });
            mockOctokit.git.createCommit.mockResolvedValue({ data: { sha: 'new-commit-sha' } });
            mockOctokit.git.createRef.mockResolvedValue({});

            await (githubManager as any).initializeMainBranch(mockRepository);

            // Should check for existing master branch
            expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                ref: 'heads/master'
            });

            // Should create blob for new file
            expect(mockOctokit.git.createBlob).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                content: Buffer.from('# Repository initialized with ISDL\n').toString('base64'),
                encoding: 'base64'
            });

            // Should create tree without base_tree
            expect(mockOctokit.git.createTree).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                tree: [{
                    path: '.gitkeep',
                    mode: '100644',
                    type: 'blob',
                    sha: 'blob-sha'
                }]
            });

            // Should create commit without parents
            expect(mockOctokit.git.createCommit).toHaveBeenCalledWith({
                owner: 'user',
                repo: 'test-repo',
                message: 'Initialize main branch',
                tree: 'new-tree-sha',
                parents: []
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle authentication failures gracefully', async () => {
            vi.spyOn(githubManager as any, 'initializeOctokit').mockResolvedValue(false);

            const result = await githubManager.listRepositories();

            expect(result).toEqual([]);
        });

        it('should handle API errors during file upload', async () => {
            const mockFiles = [{ path: 'test.js', content: 'test content', hash: '', needsCommit: true }];
            const mockRepository = { name: 'test-repo', full_name: 'user/test-repo' };

            // Mock file not found so it needs committing
            mockOctokit.repos.getContent.mockRejectedValue({ status: 404 });
            
            // Mock API error during blob creation
            mockOctokit.git.getRef.mockResolvedValue({
                data: { object: { sha: 'existing-commit-sha' } }
            });
            mockOctokit.git.getCommit.mockResolvedValue({
                data: { tree: { sha: 'existing-tree-sha' } }
            });
            mockOctokit.git.createBlob.mockRejectedValue(new Error('API Error'));

            // Authentication is handled by setting octokit directly in beforeEach
            // Let getFilesNeedingCommit run normally to test the full flow

            const result = await githubManager.uploadFiles(
                mockRepository as any,
                mockFiles,
                'Test commit'
            );

            // When blob creation fails, no files get committed so hasChanges is false
            expect(result.success).toBe(true);
            expect(result.hasChanges).toBe(false);
            expect(result.changedFiles).toBe(0);
        });

        it('should sanitize invalid version strings', async () => {
            const testCases = [
                { input: 'v1.2.3', expected: '1.2.3' },
                { input: '1.2.3-beta', expected: '1.2.3' },
                { input: 'invalid-version', expected: '1.0.0' },
                { input: '', expected: '1.0.0' },
                { input: null, expected: '1.0.0' },
                { input: '1.2', expected: '1.2.0' },
                { input: '1', expected: '1.0.0' },
            ];

            for (const testCase of testCases) {
                const result = (githubManager as any).sanitizeVersion(testCase.input);
                expect(result).toBe(testCase.expected);
            }
        });
    });
});