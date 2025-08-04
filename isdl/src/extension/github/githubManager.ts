import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { GitHubAuthProvider, GitHubUserInfo } from './githubAuthProvider.js';
import { GitHubConfigurationManager } from './githubConfig.js';
import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';
import { NodeFileSystem } from 'langium/node';
import { Entry } from '../../language/generated/ast.js';
import { URI, type AstNode, type LangiumCoreServices, type LangiumDocument } from 'langium';

/**
 * Extension-safe document extraction that doesn't call process.exit()
 */
async function extractDocumentSafe(fileName: string, services: LangiumCoreServices): Promise<LangiumDocument | null> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(`Invalid file extension. Expected one of: ${extensions}`);
        return null;
    }

    if (!fs.existsSync(fileName)) {
        console.error(`File ${fileName} does not exist.`);
        return null;
    }

    try {
        const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
        await services.shared.workspace.DocumentBuilder.build([document], { validation: true });

        const validationErrors = (document.diagnostics ?? []).filter(e => e.severity === 1);
        if (validationErrors.length > 0) {
            console.error('Validation errors found:');
            for (const validationError of validationErrors) {
                console.error(
                    `line ${validationError.range.start.line + 1}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
                );
            }
            return null;
        }

        return document;
    } catch (error) {
        console.error('Error processing document:', error);
        return null;
    }
}

export interface GitHubRepository {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    clone_url: string;
    ssh_url: string;
    private: boolean;
    description: string;
    topics: string[];
}

interface IsdlChange {
    type: 'added' | 'removed' | 'modified' | 'renamed';
    category: 'field' | 'action' | 'actor' | 'item' | 'system' | 'implementation';
    description: string;
    name?: string;
    oldName?: string;
    details?: string;
}

interface IsdlFieldInfo {
    name: string;
    type: string;
    category: 'field' | 'action';
    location: string; // actor.character, item.weapon, etc.
    modifiers?: string[];
    parameters?: string[];
}

/**
 * Unified GitHub manager that handles all GitHub operations
 * Combines authentication, repository management, and publishing
 */
export class GitHubManager {
    private _onDidChangeState = new vscode.EventEmitter<void>();
    readonly onDidChangeState = this._onDidChangeState.event;

    private authProvider: GitHubAuthProvider;
    private configManager: GitHubConfigurationManager;
    private octokit: Octokit | null = null;
    private currentRepository: GitHubRepository | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.authProvider = new GitHubAuthProvider(context);
        this.configManager = new GitHubConfigurationManager();
    }

    // Authentication methods
    async isAuthenticated(): Promise<boolean> {
        return await this.authProvider.isAuthenticated();
    }

    async authenticate(): Promise<boolean> {
        const userInfo = await this.authProvider.authenticateUser();
        if (userInfo) {
            await this.initializeOctokit();
            this._onDidChangeState.fire();
            return true;
        }
        return false;
    }

    async signOut(): Promise<void> {
        await this.authProvider.signOut();
        this.octokit = null;
        this.currentRepository = null;
        this._onDidChangeState.fire();
    }

    async getUserInfo(): Promise<GitHubUserInfo | undefined> {
        return await this.authProvider.getStoredUserInfo();
    }

    // Configuration methods
    getConfigManager(): GitHubConfigurationManager {
        return this.configManager;
    }

    getAuthProvider(): GitHubAuthProvider {
        return this.authProvider;
    }

    // Repository methods
    getCurrentRepository(): GitHubRepository | null {
        return this.currentRepository;
    }

    async setRepository(repository: GitHubRepository): Promise<void> {
        this.currentRepository = repository;
        this._onDidChangeState.fire();
    }

    async disconnectRepository(): Promise<void> {
        this.currentRepository = null;
        this._onDidChangeState.fire();
    }

    async listRepositories(): Promise<GitHubRepository[]> {
        if (!await this.initializeOctokit()) return [];

        try {
            const response = await this.octokit!.repos.listForAuthenticatedUser({
                type: 'owner',
                sort: 'updated',
                per_page: 50
            });

            return response.data.map((repo: any) => ({
                id: repo.id,
                name: repo.name,
                full_name: repo.full_name,
                html_url: repo.html_url,
                clone_url: repo.clone_url,
                ssh_url: repo.ssh_url,
                private: repo.private,
                description: repo.description || '',
                topics: repo.topics || []
            }));
        } catch (error) {
            console.error('Failed to list repositories:', error);
            return [];
        }
    }

    async createRepository(name: string, description: string, isPrivate: boolean = false, licenseTemplate?: string): Promise<GitHubRepository | undefined> {
        if (!await this.initializeOctokit()) return undefined;

        try {
            const response = await this.octokit!.repos.createForAuthenticatedUser({
                name,
                description,
                private: isPrivate,
                auto_init: false,
                has_issues: true,
                has_projects: false,
                has_wiki: true,
                has_discussions: true,
                license_template: licenseTemplate,
                gitignore_template: 'Node'
            });

            const repository = response.data as GitHubRepository;
            await this.setRepository(repository);
            return repository;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to create repository: ${error.message}`);
            return undefined;
        }
    }

    /**
     * Add topics to a repository
     */
    async addRepositoryTopics(repository: GitHubRepository, topics: string[]): Promise<void> {
        if (!await this.initializeOctokit()) return;

        try {
            await this.octokit!.repos.replaceAllTopics({
                owner: repository.full_name.split('/')[0],
                repo: repository.name,
                names: topics
            });
        } catch (error: any) {
            console.error('Failed to add topics:', error);
        }
    }

    /**
     * Create or update a file in the repository
     */
    async createFile(repository: GitHubRepository, path: string, content: string, message: string, branch?: string): Promise<void> {
        if (!await this.initializeOctokit()) return;

        try {
            const config = this.configManager.getConfig();
            const targetBranch = branch || config.defaultBranch;

            await this.octokit!.repos.createOrUpdateFileContents({
                owner: repository.full_name.split('/')[0],
                repo: repository.name,
                path,
                message,
                content: Buffer.from(content).toString('base64'),
                branch: targetBranch
            });
        } catch (error: any) {
            console.error(`Failed to create file ${path}:`, error);
        }
    }

    /**
     * Initialize repository with main branch using Git Data API
     */
    async initializeMainBranch(repository: GitHubRepository): Promise<void> {
        if (!await this.initializeOctokit()) return;

        try {
            const config = this.configManager.getConfig();
            const owner = repository.full_name.split('/')[0];

            // Check if repository has existing files on the default branch (usually master)
            let baseTreeSha: string | undefined;
            let parentCommitSha: string | undefined;

            try {
                // Try to get the existing master/main branch to preserve existing files
                const defaultRef = await this.octokit!.git.getRef({
                    owner,
                    repo: repository.name,
                    ref: 'heads/master'  // GitHub default for new repos with license
                });

                // Get the commit to extract the tree
                const commit = await this.octokit!.git.getCommit({
                    owner,
                    repo: repository.name,
                    commit_sha: defaultRef.data.object.sha
                });

                baseTreeSha = commit.data.tree.sha;
                parentCommitSha = defaultRef.data.object.sha;

                console.log('Found existing files on master branch, preserving them...');

            } catch (error) {
                // No existing branch or files, we'll create from scratch
                console.log('No existing files found, creating new repository structure...');
            }

            let tree: any;
            let commitParents: string[] = [];

            if (baseTreeSha && parentCommitSha) {
                // Use existing tree as base to preserve LICENSE, .gitignore, etc.
                tree = await this.octokit!.git.createTree({
                    owner,
                    repo: repository.name,
                    base_tree: baseTreeSha,
                    tree: [{
                        path: '.gitkeep',
                        mode: '100644',
                        type: 'blob',
                        content: '# Repository initialized with ISDL\n'
                    }]
                });
                commitParents = [parentCommitSha];
            } else {
                // Create new tree from scratch
                const blob = await this.octokit!.git.createBlob({
                    owner,
                    repo: repository.name,
                    content: Buffer.from('# Repository initialized with ISDL\n').toString('base64'),
                    encoding: 'base64'
                });

                tree = await this.octokit!.git.createTree({
                    owner,
                    repo: repository.name,
                    tree: [{
                        path: '.gitkeep',
                        mode: '100644',
                        type: 'blob',
                        sha: blob.data.sha
                    }]
                });
            }

            // Create the initial commit
            const commit = await this.octokit!.git.createCommit({
                owner,
                repo: repository.name,
                message: 'Initialize main branch',
                tree: tree.data.sha,
                parents: commitParents
            });

            // Create the main branch reference
            await this.octokit!.git.createRef({
                owner,
                repo: repository.name,
                ref: `refs/heads/${config.defaultBranch}`,
                sha: commit.data.sha
            });

            // Now set the default branch
            if (config.defaultBranch !== 'master') {
                await this.updateDefaultBranch(repository, config.defaultBranch);
            }

        } catch (error: any) {
            console.error('Failed to initialize main branch:', error);
            throw error;
        }
    }

    /**
     * Update the default branch of a repository
     */
    async updateDefaultBranch(repository: GitHubRepository, branchName: string): Promise<void> {
        if (!await this.initializeOctokit()) return;

        try {
            const owner = repository.full_name.split('/')[0];

            await this.octokit!.repos.update({
                owner,
                repo: repository.name,
                default_branch: branchName
            });

            // Delete master branch if we switched to a different branch
            if (branchName !== 'master') {
                await this.deleteBranch(repository, 'master');
            }
        } catch (error: any) {
            console.error(`Failed to update default branch to ${branchName}:`, error);
        }
    }

    /**
     * Delete a branch from the repository
     */
    async deleteBranch(repository: GitHubRepository, branchName: string): Promise<void> {
        if (!await this.initializeOctokit()) return;

        try {
            const owner = repository.full_name.split('/')[0];

            // Check if branch exists before trying to delete
            try {
                await this.octokit!.git.getRef({
                    owner,
                    repo: repository.name,
                    ref: `heads/${branchName}`
                });

                // Branch exists, delete it
                await this.octokit!.git.deleteRef({
                    owner,
                    repo: repository.name,
                    ref: `heads/${branchName}`
                });

                console.log(`Successfully deleted ${branchName} branch`);
            } catch (error: any) {
                if (error.status === 404) {
                    // Branch doesn't exist, which is fine
                    console.log(`Branch ${branchName} doesn't exist, nothing to delete`);
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error(`Failed to delete branch ${branchName}:`, error);
        }
    }

    /**
     * Check if files need to be committed by comparing content hashes
     */
    private async getFilesNeedingCommit(
        repository: GitHubRepository,
        files: { path: string; content: string }[],
        progressCallback?: (progress: number, current: string) => void
    ): Promise<{ path: string; content: string; hash: string; needsCommit: boolean }[]> {
        if (!await this.initializeOctokit()) return files.map(f => ({ ...f, hash: '', needsCommit: true }));

        const owner = repository.full_name.split('/')[0];
        const config = this.configManager.getConfig();
        const filesWithStatus = [];

        console.log(`🔍 Checking ${files.length} files for changes...`);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (progressCallback) {
                const progress = (i / files.length) * 80; // Reserve 20% for final processing
                progressCallback(progress, `Analyzing ${file.path}...`);
            }
            try {
                // Calculate local file hash
                const localHash = crypto.createHash('sha1')
                    .update(`blob ${Buffer.byteLength(file.content, 'utf8')}\0${file.content}`)
                    .digest('hex');

                let needsCommit = true;

                try {
                    // Check if file exists in repository
                    const existingFile = await this.octokit!.repos.getContent({
                        owner,
                        repo: repository.name,
                        path: file.path,
                        ref: config.defaultBranch
                    });

                    // Compare SHA hashes (GitHub uses Git's blob SHA)
                    if ('sha' in existingFile.data && existingFile.data.sha === localHash) {
                        needsCommit = false;
                        console.log(`✓ ${file.path} - no changes needed`);
                    } else {
                        console.log(`🔄 ${file.path} - content changed`);
                    }
                } catch (error: any) {
                    if (error.status === 404) {
                        console.log(`➕ ${file.path} - new file`);
                    } else {
                        console.log(`⚠️ ${file.path} - cannot check, assuming changed`);
                    }
                }

                filesWithStatus.push({
                    ...file,
                    hash: localHash,
                    needsCommit
                });
            } catch (error) {
                console.warn(`Failed to process ${file.path}:`, error);
                filesWithStatus.push({
                    ...file,
                    hash: '',
                    needsCommit: true
                });
            }
        }

        if (progressCallback) {
            progressCallback(90, 'Finalizing change analysis...');
        }

        const changedFiles = filesWithStatus.filter(f => f.needsCommit);
        console.log(`📊 Change summary: ${changedFiles.length}/${files.length} files need updating`);

        if (progressCallback) {
            progressCallback(100, `Analysis complete: ${changedFiles.length}/${files.length} files need updating`);
        }

        return filesWithStatus;
    }

    /**
     * Analyze ISDL file changes to determine semantic version bump type
     */
    private async analyzeChangeType(files: { path: string; content: string }[]): Promise<{
        changeType: 'major' | 'minor' | 'patch',
        changes: IsdlChange[]
    }> {
        // Find ISDL file in current files
        const isdlFile = files.find(f => f.path.endsWith('.isdl'));
        if (!isdlFile) {
            console.log('📝 No ISDL file found in changes, defaulting to patch version');
            return {
                changeType: 'patch',
                changes: [{ type: 'modified', category: 'implementation', description: 'System implementation updated' }]
            };
        }

        console.log(`🔍 Analyzing ISDL changes in ${isdlFile.path}...`);

        try {
            // Get previous version of ISDL file from repository
            const previousIsdlContent = await this.getPreviousFileContent(isdlFile.path);
            if (!previousIsdlContent) {
                console.log('📝 No previous ISDL version found, treating as new system (minor)');
                return { changeType: 'minor', changes: [{ type: 'added', category: 'system', description: 'New ISDL system created' }] };
            }

            // Parse both versions and compare
            const changes = await this.compareIsdlVersions(previousIsdlContent, isdlFile.content);
            const changeType = this.determineVersionFromIsdlChanges(changes);

            console.log(`📊 ISDL analysis complete: ${changeType} version bump with ${changes.length} changes`);
            return { changeType, changes };

        } catch (error) {
            console.error('❌ Failed to analyze ISDL changes, defaulting to patch version:', error);
            return {
                changeType: 'patch',
                changes: [{ type: 'modified', category: 'implementation', description: 'System updated (ISDL analysis failed)' }]
            };
        }
    }

    /**
     * Upload multiple files to repository as a single commit with efficient change detection
     */
    async uploadFiles(
        repository: GitHubRepository,
        files: { path: string; content: string }[],
        commitMessage: string,
        progressCallback?: (progress: number, current: string) => void
    ): Promise<{ success: boolean; hasChanges: boolean; changedFiles: number }> {
        if (!await this.initializeOctokit()) return { success: false, hasChanges: false, changedFiles: 0 };
        if (files.length === 0) return { success: true, hasChanges: false, changedFiles: 0 };

        try {
            const owner = repository.full_name.split('/')[0];
            const config = this.configManager.getConfig();

            if (progressCallback) {
                progressCallback(5, 'Analyzing file changes...');
            }

            // Check which files actually need to be committed with progress updates
            const filesWithStatus = await this.getFilesNeedingCommit(
                repository,
                files,
                progressCallback ? (analyzeProgress, message) => {
                    // Scale analysis progress to 5-25% of total progress
                    const scaledProgress = 5 + (analyzeProgress * 0.2);
                    progressCallback(scaledProgress, message);
                } : undefined
            );
            const filesToCommit = filesWithStatus.filter(f => f.needsCommit);

            if (filesToCommit.length === 0) {
                console.log('✓ No files need updating - all files are already up to date');
                if (progressCallback) {
                    progressCallback(100, 'All files up to date!');
                }
                return { success: true, hasChanges: false, changedFiles: 0 };
            }

            console.log(`🚀 Committing ${filesToCommit.length} changed files out of ${files.length} total`);

            if (progressCallback) {
                progressCallback(30, `Preparing to commit ${filesToCommit.length} changed files...`);
            }

            // Get the current default branch reference
            let branchRef;
            try {
                branchRef = await this.octokit!.git.getRef({
                    owner,
                    repo: repository.name,
                    ref: `heads/${config.defaultBranch}`
                });
            } catch (error: any) {
                // If branch doesn't exist, initialize it first
                if (error.status === 404) {
                    await this.initializeMainBranch(repository);
                    branchRef = await this.octokit!.git.getRef({
                        owner,
                        repo: repository.name,
                        ref: `heads/${config.defaultBranch}`
                    });
                } else {
                    throw error;
                }
            }

            if (progressCallback) {
                progressCallback(20, 'Creating file blobs...');
            }

            // Create blobs only for files that need committing
            const blobs: { path: string; sha: string }[] = [];
            for (let i = 0; i < filesToCommit.length; i++) {
                const file = filesToCommit[i];

                try {
                    // Always create blob for files that need committing
                    const blob = await this.octokit!.git.createBlob({
                        owner,
                        repo: repository.name,
                        content: Buffer.from(file.content).toString('base64'),
                        encoding: 'base64'
                    });

                    blobs.push({
                        path: file.path.replace(/\\/g, '/'), // Ensure forward slashes for GitHub
                        sha: blob.data.sha
                    });

                    if (progressCallback) {
                        const progress = 35 + ((i + 1) / filesToCommit.length) * 40; // 35-75%
                        progressCallback(progress, `Processing ${file.path}...`);
                    }
                } catch (error: any) {
                    console.error(`Failed to process blob for ${file.path}:`, error);
                }
            }

            if (blobs.length === 0) {
                console.log('✓ No blobs needed - using existing file hashes');
                return { success: true, hasChanges: false, changedFiles: 0 };
            }

            if (progressCallback) {
                progressCallback(75, 'Creating commit tree...');
            }

            // Create a tree with all the blobs
            const treeParams: any = {
                owner,
                repo: repository.name,
                tree: blobs.map(blob => ({
                    path: blob.path,
                    mode: '100644' as const,
                    type: 'blob' as const,
                    sha: blob.sha
                }))
            };

            // Only include base_tree if we have a valid commit SHA (not for empty repositories)
            if (branchRef.data.object.sha && branchRef.data.object.sha !== '0000000000000000000000000000000000000000') {
                // Get the tree SHA from the commit, not the commit SHA itself
                try {
                    const commit = await this.octokit!.git.getCommit({
                        owner,
                        repo: repository.name,
                        commit_sha: branchRef.data.object.sha
                    });
                    treeParams.base_tree = commit.data.tree.sha;
                    console.log(`🌳 Using base tree: ${commit.data.tree.sha} from commit ${branchRef.data.object.sha}`);
                } catch (error) {
                    console.warn('Failed to get base tree from commit, creating tree without base:', error);
                    // Continue without base_tree - will create a full tree
                }
            }

            console.log(`🌳 Creating tree with ${blobs.length} blobs, base_tree: ${treeParams.base_tree || 'none'}`);
            const tree = await this.octokit!.git.createTree(treeParams);
            console.log(`✅ Tree created successfully: ${tree.data.sha}`);

            if (progressCallback) {
                progressCallback(85, 'Creating commit...');
            }

            // Update commit message to reflect actual changes
            const updatedCommitMessage = filesToCommit.length === files.length
                ? commitMessage
                : `${commitMessage} (${filesToCommit.length}/${files.length} files changed)`;

            // Create the commit
            const commitParams: any = {
                owner,
                repo: repository.name,
                message: updatedCommitMessage,
                tree: tree.data.sha,
                parents: []
            };

            // Only include parent if we have a valid SHA (not for the first commit)
            if (branchRef.data.object.sha && branchRef.data.object.sha !== '0000000000000000000000000000000000000000') {
                commitParams.parents = [branchRef.data.object.sha];
            }

            const commit = await this.octokit!.git.createCommit(commitParams);

            if (progressCallback) {
                progressCallback(95, 'Updating branch reference...');
            }

            // Update the branch reference to point to the new commit
            await this.octokit!.git.updateRef({
                owner,
                repo: repository.name,
                ref: `heads/${config.defaultBranch}`,
                sha: commit.data.sha
            });

            if (progressCallback) {
                progressCallback(100, 'Upload complete!');
            }

            return { success: true, hasChanges: true, changedFiles: filesToCommit.length };

        } catch (error: any) {
            console.error('Failed to upload files as batch commit:', error);
            return { success: false, hasChanges: false, changedFiles: 0 };
        }
    }

    // Publishing methods
    async updateSystem(): Promise<boolean> {
        if (!this.currentRepository) {
            vscode.window.showErrorMessage('No repository connected. Please select a repository first.');
            return false;
        }

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Updating system files...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Selecting ISDL file...', increment: 10 });

                // Select which .isdl file to use
                const selectedFile = await this.selectIsdlFile();
                if (!selectedFile) {
                    vscode.window.showWarningMessage('No ISDL file selected. Update cancelled.');
                    return false;
                }

                progress.report({ message: 'Collecting system files...', increment: 10 });

                // Get the system files
                const systemFiles = await this.collectSystemFilesForPublish(selectedFile);

                if (systemFiles.length === 0) {
                    vscode.window.showWarningMessage('No system files found. Please generate your system first.');
                    return false;
                }

                progress.report({ message: 'Ensuring workflow file exists...', increment: 10 });

                // Always ensure workflow file exists
                await this.ensureWorkflowFile(this.currentRepository!);

                progress.report({ message: 'Uploading files...', increment: 20 });

                // Upload files without creating a release
                const systemJsonFile = systemFiles.find(f => f.path === 'system.json');
                const systemInfo = systemJsonFile ? JSON.parse(systemJsonFile.content) : null;
                const systemId = systemInfo?.id || this.currentRepository!.name;

                const uploadResult = await this.uploadFiles(
                    this.currentRepository!,
                    systemFiles,
                    `Update ${systemId} system files`,
                    (progressPercent, currentStep) => {
                        progress.report({
                            message: currentStep,
                            increment: Math.min(progressPercent * 0.5, 50) // Use up to 50% of remaining progress
                        });
                    }
                );

                if (!uploadResult.success) {
                    vscode.window.showErrorMessage('Failed to update system files. Check the output for details.');
                    return false;
                }

                // Check if there were actually any changes to update
                if (!uploadResult.hasChanges) {
                    progress.report({ message: 'No changes detected', increment: 10 });
                    
                    const action = await vscode.window.showInformationMessage(
                        'No changes detected in your system files. All files are already up to date in the repository.',
                        'Regenerate System',
                        'Open Repository',
                        'Cancel'
                    );

                    if (action === 'Regenerate System') {
                        await vscode.commands.executeCommand('fsdl.generate');
                    } else if (action === 'Open Repository') {
                        vscode.env.openExternal(vscode.Uri.parse(this.currentRepository!.html_url));
                    }
                    
                    return false;
                }

                progress.report({ message: 'Update complete!', increment: 10 });

                const repo = this.currentRepository!;
                vscode.window.showInformationMessage(
                    `System files updated in ${repo.name} successfully! (${uploadResult.changedFiles} of ${systemFiles.length} files changed)`,
                    'Open Repository',
                    'View Commits'
                ).then(selection => {
                    if (selection === 'Open Repository') {
                        vscode.env.openExternal(vscode.Uri.parse(repo.html_url));
                    } else if (selection === 'View Commits') {
                        vscode.env.openExternal(vscode.Uri.parse(`${repo.html_url}/commits`));
                    }
                });

                return true;

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to update system: ${error.message}`);
                return false;
            }
        });
    }

    async publishSystem(): Promise<boolean> {
        if (!this.currentRepository) {
            vscode.window.showErrorMessage('No repository connected. Please select a repository first.');
            return false;
        }

        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Publishing system...',
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Selecting ISDL file...', increment: 5 });

                // Select which .isdl file to use
                const selectedFile = await this.selectIsdlFile();
                if (!selectedFile) {
                    vscode.window.showWarningMessage('No ISDL file selected. Publishing cancelled.');
                    return false;
                }

                progress.report({ message: 'Collecting system files...', increment: 5 });

                // Get the system files
                const systemFiles = await this.collectSystemFilesForPublish(selectedFile);

                if (systemFiles.length === 0) {
                    vscode.window.showWarningMessage('No system files found. Please generate your system first.');
                    return false;
                }

                // Get version from system.json for release
                const systemJsonFile = systemFiles.find(f => f.path === 'system.json');
                const systemInfo = systemJsonFile ? JSON.parse(systemJsonFile.content) : null;

                progress.report({ message: 'Ensuring workflow file exists...', increment: 5 });

                // Always ensure workflow file exists
                await this.ensureWorkflowFile(this.currentRepository!);

                progress.report({ message: 'Creating GitHub release...', increment: 5 });

                // Create a GitHub release
                const releaseUrl = await this.createRelease(systemInfo, systemFiles, progress);

                // Handle case where no changes were detected
                if (releaseUrl === 'NO_CHANGES') {
                    progress.report({ message: 'No changes detected', increment: 10 });
                    
                    const action = await vscode.window.showInformationMessage(
                        'No changes detected in your system files. All files are already up to date in the repository.',
                        'Regenerate System',
                        'Open Repository',
                        'Cancel'
                    );

                    if (action === 'Regenerate System') {
                        await vscode.commands.executeCommand('fsdl.generate');
                    } else if (action === 'Open Repository') {
                        vscode.env.openExternal(vscode.Uri.parse(this.currentRepository!.html_url));
                    }
                    
                    return false;
                }

                progress.report({ message: 'Publish complete!', increment: 10 });

                const repo = this.currentRepository!;
                const actions = releaseUrl ?
                    ['View Release', 'Open Repository', 'View Commits'] :
                    ['Open Repository', 'View Commits'];

                vscode.window.showInformationMessage(
                    `System published to ${repo.name} successfully! (${systemFiles.length} files)`,
                    ...actions
                ).then(selection => {
                    if (selection === 'Open Repository') {
                        vscode.env.openExternal(vscode.Uri.parse(repo.html_url));
                    } else if (selection === 'View Release' && releaseUrl) {
                        vscode.env.openExternal(vscode.Uri.parse(releaseUrl));
                    } else if (selection === 'View Commits') {
                        vscode.env.openExternal(vscode.Uri.parse(`${repo.html_url}/commits`));
                    }
                });

                return true;




            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to publish system: ${error.message}`);
                return false;
            }
        });
    }

    /**
     * Select .isdl file to use for system generation
     */
    private async selectIsdlFile(): Promise<string | undefined> {
        // Find all .isdl files in the workspace
        const isdlFiles = await vscode.workspace.findFiles('**/*.isdl');

        if (isdlFiles.length === 0) {
            vscode.window.showErrorMessage('No .isdl files found in the workspace.');
            return undefined;
        }

        // If only one file, use it
        if (isdlFiles.length === 1) {
            return isdlFiles[0].fsPath;
        }

        // Multiple files - prompt user to select
        const items = isdlFiles.map(uri => {
            const relativePath = vscode.workspace.asRelativePath(uri);
            return {
                label: path.basename(uri.fsPath),
                description: relativePath,
                detail: uri.fsPath,
                uri: uri
            };
        });

        const selection = await vscode.window.showQuickPick(items, {
            title: 'Select ISDL File',
            placeHolder: 'Choose which .isdl file to use for publishing',
            ignoreFocusOut: true
        });

        if (!selection) {
            return undefined;
        }

        return selection.uri.fsPath;
    }

    /**
     * Collect system files for publishing
     */
    private async collectSystemFilesForPublish(isdlFilePath: string): Promise<{ path: string; content: string }[]> {
        try {
            // Get the configuration to find the last selected folder
            const config = vscode.workspace.getConfiguration('fsdl');
            const lastSelectedFolder: string | undefined = config.get('lastSelectedFolder');

            if (!lastSelectedFolder || !fs.existsSync(lastSelectedFolder)) {
                vscode.window.showErrorMessage('No generated system files found. Please generate your system first.');
                return [];
            }

            // Parse the ISDL file to get the system ID
            const services = createIntelligentSystemDesignLanguageServices(NodeFileSystem).IntelligentSystemDesignLanguage;
            const model = await this.extractAstNodeSafe<Entry>(isdlFilePath, services);
            if (!model) {
                vscode.window.showErrorMessage('Failed to parse the selected ISDL file.');
                return [];
            }
            const id = model.config.body.find(x => x.type === "id")?.value;

            if (!id) {
                vscode.window.showErrorMessage('Could not find system ID in the selected ISDL file.');
                return [];
            }

            const systemFolder = path.join(lastSelectedFolder, id);
            if (!fs.existsSync(systemFolder)) {
                vscode.window.showErrorMessage(`System folder not found: ${systemFolder}. Please generate your system first.`);
                return [];
            }

            // Collect all files from the system folder
            const files = await this.collectFilesRecursively(systemFolder, systemFolder, []);

            // Add the source ISDL file to the repository
            try {
                const isdlContent = fs.readFileSync(isdlFilePath, 'utf8');
                const isdlFileName = path.basename(isdlFilePath);
                files.push({
                    path: isdlFileName,
                    content: isdlContent
                });
                console.log(`📝 Added source ISDL file: ${isdlFileName}`);
            } catch (error) {
                console.warn(`Failed to read ISDL file ${isdlFilePath}:`, error);
            }

            return files;

        } catch (error: any) {
            console.error('Error collecting system files for publish:', error);
            vscode.window.showErrorMessage(`Failed to collect system files: ${error.message}`);
            return [];
        }
    }

    /**
     * Recursively collect files from directory
     */
    private async collectFilesRecursively(
        currentPath: string,
        basePath: string,
        files: { path: string; content: string }[]
    ): Promise<{ path: string; content: string }[]> {
        const items = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(currentPath, item.name);

            if (item.isDirectory()) {
                // Skip common directories that shouldn't be uploaded
                if (this.shouldSkipDirectory(item.name)) {
                    continue;
                }

                // Recursively process subdirectories
                await this.collectFilesRecursively(fullPath, basePath, files);
            } else if (item.isFile()) {
                // Skip files that shouldn't be uploaded
                if (this.shouldSkipFile(item.name)) {
                    continue;
                }

                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

                    files.push({
                        path: relativePath,
                        content: content
                    });
                } catch (error) {
                    console.warn(`Failed to read file ${fullPath}:`, error);
                }
            }
        }

        return files;
    }

    /**
     * Determine if a directory should be skipped
     */
    private shouldSkipDirectory(dirName: string): boolean {
        const skipDirs = [
            'node_modules',
            '.git',
            '.vscode',
            'dist',
            'build',
            'out',
            '.next',
            '.cache',
            'coverage',
            '.nyc_output',
            'logs'
        ];

        return skipDirs.includes(dirName) || !!dirName.match(/.*\.log$/);
    }

    /**
     * Determine if a file should be skipped
     */
    private shouldSkipFile(fileName: string): boolean {
        const skipFiles = [
            '.DS_Store',
            'Thumbs.db',
            '.env',
            '.env.local',
            '.env.production'
        ];

        return skipFiles.includes(fileName) ||
            !!fileName.match(/.*\.(log|tmp|temp|key|pem|p12|pfx)$/);
    }

    /**
     * Get the GitHub workflow content for system releases
     */
    async getWorkflowContent(): Promise<string> {
        try {
            const workflowPath = path.join(__dirname, '/github/system-workflow.yml');
            return fs.readFileSync(workflowPath, 'utf8');
        } catch (error) {
            // Fallback to inline workflow content if file is not found
            console.warn('Workflow file not found');
            throw error;
        }
    }

    /**
     * Create a GitHub release for the system
     */
    async createRelease(systemInfo: any, systemFiles: { path: string; content: string }[], progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>): Promise<string | undefined> {
        if (!await this.initializeOctokit() || !this.currentRepository) return undefined;

        try {
            console.log('🚀 Starting release creation...');
            const owner = this.currentRepository.full_name.split('/')[0];
            const repo = this.currentRepository.name;

            console.log(`📁 Repository: ${owner}/${repo}`);
            console.log('📊 System info:', JSON.stringify(systemInfo, null, 2));

            // Analyze changes and determine version bump type if files provided
            const changeAnalysis = systemFiles ? await this.analyzeChangeType(systemFiles) : { changeType: 'patch' as const, changes: [] };
            console.log(`🔍 Detected change type: ${changeAnalysis.changeType}`);

            // Generate version number based on change analysis
            const rawVersion = await this.generateVersionNumber(changeAnalysis.changeType);
            console.log(`📝 Raw version: "${rawVersion}"`);

            // Sanitize and validate version
            const version = this.sanitizeVersion(rawVersion);
            const tagName = `v${version}`;

            console.log(`🏷️ Sanitized version: "${version}"`);
            console.log(`🏷️ Tag name: "${tagName}"`);

            // Validate tag name
            if (!this.isValidTagName(tagName)) {
                throw new Error(`Invalid tag name: "${tagName}". Tag names must contain only letters, numbers, periods, hyphens, and underscores.`);
            }

            // Generate release notes with ISDL changes
            console.log('📄 Generating release notes...');
            const releaseNotes = await this.generateReleaseNotes(systemInfo, changeAnalysis.changes, tagName);
            console.log(`📄 Release notes length: ${releaseNotes.length} characters`);


            progress.report({ message: 'Analyzing and uploading files to repository...', increment: 5 });

            // Upload files with progress tracking including analysis phase
            let lastProgress = 25;
            const uploadResult = await this.uploadFiles(
                this.currentRepository!,
                systemFiles,
                `Update system files (${systemFiles.length} files)`,
                (progressPercent, currentStep) => {
                    const increment = (progressPercent * 0.55) - (lastProgress - 25); // 55% of remaining progress
                    lastProgress = 25 + (progressPercent * 0.55);

                    progress.report({
                        message: currentStep,
                        increment: increment
                    });
                }
            );

            if (!uploadResult.success) {
                vscode.window.showErrorMessage('Failed to upload system files. Check the output for details.');
                return;
            }

            // Check if there were actually any changes to publish
            if (!uploadResult.hasChanges) {
                console.log('📋 No changes detected, skipping release creation');
                return 'NO_CHANGES';
            }

            // Create the release
            console.log('🎯 Creating GitHub release...');
            const releaseData = {
                owner,
                repo,
                tag_name: tagName,
                name: `${systemInfo?.title || repo} v${version}`,
                body: releaseNotes,
                draft: false,
                prerelease: false,
                make_latest: "true",
                generate_release_notes: false, // We provide our own notes
            } as RestEndpointMethodTypes['repos']['createRelease']['parameters'];

            console.log('📋 Release data:', JSON.stringify(releaseData, null, 2));

            const response = await this.octokit!.repos.createRelease(releaseData);

            console.log('✅ Release created successfully!');
            console.log(`🔗 Release URL: ${response.data.html_url}`);
            return response.data.html_url;

        } catch (error: any) {
            console.error('❌ Failed to create release:', error);
            console.error('❌ Error details:', {
                status: error.status,
                message: error.message,
                response: error.response?.data
            });

            // Check if it's a duplicate tag error
            if (error.status === 422 && error.message.includes('tag_name already exists')) {
                vscode.window.showWarningMessage(
                    'A release with this version already exists. The files have been updated but no new release was created.',
                    'View Releases'
                ).then(action => {
                    if (action === 'View Releases') {
                        vscode.env.openExternal(vscode.Uri.parse(`${this.currentRepository!.html_url}/releases`));
                    }
                });
            } else {
                vscode.window.showWarningMessage(`Could not create release: ${error.message}`);
            }

            return undefined;
        }
    }

    /**
     * Sanitize version string to ensure it's valid for Git tags
     */
    private sanitizeVersion(version: string): string {
        if (!version || typeof version !== 'string') {
            console.warn('⚠️ Invalid version input, using default 1.0.0');
            return '1.0.0';
        }

        // Remove any 'v' prefix if present
        let sanitized = version.replace(/^v/, '');

        // Replace invalid characters with valid ones
        sanitized = sanitized.replace(/[^a-zA-Z0-9.-]/g, '');

        // Ensure it starts with a number
        if (!/^\d/.test(sanitized)) {
            sanitized = '1.0.0';
        }

        // If empty after sanitization, use default
        if (!sanitized) {
            sanitized = '1.0.0';
        }

        // Ensure it's a valid semver-like format
        const parts = sanitized.split('.');
        while (parts.length < 3) {
            parts.push('0');
        }

        // Take only first 3 parts and ensure they're numbers
        const validParts = parts.slice(0, 3).map(part => {
            const num = parseInt(part) || 0;
            return num.toString();
        });

        return validParts.join('.');
    }

    /**
     * Validate that a tag name is acceptable to GitHub
     */
    private isValidTagName(tagName: string): boolean {
        // GitHub tag name requirements:
        // - Cannot be empty
        // - Cannot contain ASCII control characters
        // - Cannot contain spaces
        // - Cannot contain: ~ ^ : ? * [ ]
        // - Cannot start or end with /
        // - Cannot contain consecutive /
        // - Cannot end with .lock

        if (!tagName || tagName.length === 0) {
            return false;
        }

        // Check for invalid characters
        const invalidChars = /[\s~^:?*[\]]/;
        if (invalidChars.test(tagName)) {
            return false;
        }

        // Check for forward slash issues
        if (tagName.startsWith('/') || tagName.endsWith('/') || tagName.includes('//')) {
            return false;
        }

        // Check for .lock ending
        if (tagName.endsWith('.lock')) {
            return false;
        }

        // Check for ASCII control characters (0-31, 127)
        for (let i = 0; i < tagName.length; i++) {
            const charCode = tagName.charCodeAt(i);
            if (charCode <= 31 || charCode === 127) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate a semantic version number based on existing releases and change analysis
     */
    private async generateVersionNumber(changeType: 'major' | 'minor' | 'patch' = 'patch'): Promise<string> {
        if (!await this.initializeOctokit() || !this.currentRepository) {
            console.log('📝 No GitHub connection, using default version 1.0.0');
            return '1.0.0';
        }

        try {
            console.log('🔍 Fetching existing tags to determine next version...');
            const owner = this.currentRepository.full_name.split('/')[0];
            const repo = this.currentRepository.name;

            // Get all tags instead of just releases to catch all versions
            const tags = await this.octokit!.repos.listTags({
                owner,
                repo,
                per_page: 100
            });

            console.log(`📊 Found ${tags.data.length} existing tags`);

            if (tags.data.length === 0) {
                console.log('📝 No existing tags, using version 1.0.0');
                return '1.0.0';
            }

            // Parse all versions and find the highest semantic version
            const versions = tags.data
                .map(tag => {
                    const version = tag.name.replace(/^v/, '');
                    const parts = version.split('.').map(n => parseInt(n) || 0);
                    // Ensure we have major.minor.patch format
                    while (parts.length < 3) parts.push(0);
                    return {
                        original: tag.name,
                        version: version,
                        major: parts[0],
                        minor: parts[1],
                        patch: parts[2],
                        numeric: parts[0] * 10000 + parts[1] * 100 + parts[2]
                    };
                })
                .filter(v => !isNaN(v.major) && !isNaN(v.minor) && !isNaN(v.patch))
                .sort((a, b) => b.numeric - a.numeric);

            if (versions.length === 0) {
                console.log('📝 No valid semantic versions found, using version 1.0.0');
                return '1.0.0';
            }

            const latest = versions[0];
            console.log(`🏷️ Latest semantic version: "${latest.version}" (${latest.original})`);

            // Increment based on change type
            let newMajor = latest.major;
            let newMinor = latest.minor;
            let newPatch = latest.patch;

            switch (changeType) {
                case 'major':
                    newMajor += 1;
                    newMinor = 0;
                    newPatch = 0;
                    break;
                case 'minor':
                    newMinor += 1;
                    newPatch = 0;
                    break;
                case 'patch':
                default:
                    newPatch += 1;
                    break;
            }

            const newVersion = `${newMajor}.${newMinor}.${newPatch}`;
            console.log(`📝 Generated new ${changeType} version: "${newVersion}"`);

            return newVersion;

        } catch (error) {
            console.error('❌ Failed to generate version number:', error);
            console.log('📝 Falling back to default version 1.0.0');
            return '1.0.0';
        }
    }

    /**
     * Generate release notes for the system with ISDL change analysis
     */
    private async generateReleaseNotes(systemInfo: any, changes: IsdlChange[] = [], tagName: string): Promise<string> {
        const currentDate = new Date().toISOString().split('T')[0];
        const systemName = systemInfo?.title || systemInfo?.id || 'ISDL System';

        // Generate changelog section from ISDL changes
        const changelogSection = this.generateChangelogSection(changes);

        return `## ${systemName} Release

📅 **Release Date:** ${currentDate}
🎲 **Foundry VTT Compatibility:** v${systemInfo?.compatibility?.minimum || '12'} - v${systemInfo?.compatibility?.verified || '13'}

### 📦 Installation

**Manifest URL:**
\`\`\`
https://github.com/${this.currentRepository!.full_name}/releases/download/${tagName}/system.json
\`\`\`

${changelogSection}

### 📖 Documentation

For installation instructions, usage guides, and troubleshooting:
- 📚 [Repository README](https://github.com/${this.currentRepository!.full_name}#readme)
- 🐛 [Report Issues](https://github.com/${this.currentRepository!.full_name}/issues)
- 💬 [Community Discussions](https://github.com/${this.currentRepository!.full_name}/discussions)

### ⚡ Quick Start

1. Copy the manifest URL above
2. Open Foundry VTT
3. Go to "Game Systems" → "Install System"
4. Paste the manifest URL and click "Install"
5. Create a new world using this system

---

*Built with ❤️ using [ISDL](https://marketplace.visualstudio.com/items?itemName=IronMooseDevelopment.fsdl)*`;
    }

    /**
     * Generate changelog section from ISDL changes
     */
    private generateChangelogSection(changes: IsdlChange[]): string {
        if (changes.length === 0) {
            return `### 🚀 What's New

- 🛠️ System implementation updated
- 🔧 Bug fixes and performance improvements
- 📱 Enhanced user interface`;
        }

        // Group changes by type
        const addedChanges = changes.filter(c => c.type === 'added');
        const removedChanges = changes.filter(c => c.type === 'removed');
        const modifiedChanges = changes.filter(c => c.type === 'modified');

        let changelog = '### 🚀 What\'s New\n\n';

        // Breaking changes first (removed/renamed)
        if (removedChanges.length > 0) {
            changelog += '#### ⚠️ Breaking Changes\n\n';
            for (const change of removedChanges) {
                changelog += `- **REMOVED:** ${change.description}\n`;
                if (change.details) {
                    changelog += `  - ${change.details}\n`;
                }
            }
            changelog += '\n';
        }

        // New features (added fields/actions)
        if (addedChanges.length > 0) {
            const fieldAdditions = addedChanges.filter(c => c.category === 'field');
            const actionAdditions = addedChanges.filter(c => c.category === 'action');
            const systemAdditions = addedChanges.filter(c => c.category === 'system');

            if (fieldAdditions.length > 0 || actionAdditions.length > 0 || systemAdditions.length > 0) {
                changelog += '#### ✨ New Features\n\n';

                for (const change of [...systemAdditions, ...fieldAdditions, ...actionAdditions]) {
                    const icon = change.category === 'action' ? '⚡' :
                        change.category === 'field' ? '📝' : '🔧';
                    changelog += `- ${icon} ${change.description}\n`;
                    if (change.details) {
                        changelog += `  - ${change.details}\n`;
                    }
                }
                changelog += '\n';
            }
        }

        // Improvements and bug fixes (modified)
        if (modifiedChanges.length > 0) {
            changelog += '#### 🔧 Improvements\n\n';
            for (const change of modifiedChanges) {
                const icon = change.category === 'field' ? '📝' :
                    change.category === 'action' ? '⚡' :
                        change.category === 'system' ? '🔧' : '🛠️';
                changelog += `- ${icon} ${change.description}\n`;
                if (change.details) {
                    changelog += `  - ${change.details}\n`;
                }
            }
        }

        return changelog;
    }

    /**
     * Extension-safe AST node extraction that doesn't call process.exit()
     */
    private async extractAstNodeSafe<T extends AstNode>(fileName: string, services: LangiumCoreServices): Promise<T | null> {
        const document = await extractDocumentSafe(fileName, services);
        if (!document) {
            return null;
        }
        return document.parseResult?.value as T || null;
    }

    /**
     * Ensure GitHub workflow file exists in the repository and update it if content differs
     */
    async ensureWorkflowFile(repository: GitHubRepository): Promise<boolean> {
        if (!await this.initializeOctokit()) return false;

        try {
            console.log('🔧 Starting workflow file check/update...');
            const owner = repository.full_name.split('/')[0];
            const repo = repository.name;

            console.log(`📁 Repository: ${owner}/${repo}`);

            // Get current workflow content that we want
            console.log('📄 Getting desired workflow content...');
            const desiredWorkflowContent = await this.getWorkflowContent();
            console.log(`📄 Desired workflow content length: ${desiredWorkflowContent.length} characters`);

            // Check if workflow file already exists and get its content
            let existingContent: string | null = null;
            let existingSha: string | undefined;

            try {
                console.log('🔍 Checking existing workflow file...');
                const existingFile = await this.octokit!.repos.getContent({
                    owner,
                    repo,
                    path: '.github/workflows/main.yml'
                });

                if ('content' in existingFile.data && existingFile.data.content) {
                    existingContent = Buffer.from(existingFile.data.content, 'base64').toString('utf8');
                    existingSha = existingFile.data.sha;
                    console.log(`📄 Existing workflow content length: ${existingContent.length} characters`);
                }
            } catch (error: any) {
                if (error.status === 404) {
                    console.log('📝 Workflow file does not exist, will create it');
                } else {
                    console.error('❌ Error checking for existing workflow:', error);
                    throw error;
                }
            }

            // Compare content and decide if update is needed
            let needsUpdate = false;
            let commitMessage = '';

            if (existingContent === null) {
                console.log('📝 No existing workflow file, creating new one');
                needsUpdate = true;
                commitMessage = 'Add GitHub workflow for automated system releases';
            } else if (existingContent.trim() !== desiredWorkflowContent.trim()) {
                console.log('🔄 Workflow content differs, updating...');
                needsUpdate = true;
                commitMessage = 'Update GitHub workflow for automated system releases';
            } else {
                console.log('✅ Workflow file is already up to date');
                return true;
            }

            if (needsUpdate) {
                // Create or update the workflow file
                console.log('🚀 Updating workflow file via GitHub API...');
                const updateParams: any = {
                    owner,
                    repo,
                    path: '.github/workflows/main.yml',
                    message: commitMessage,
                    content: Buffer.from(desiredWorkflowContent).toString('base64'),
                    committer: {
                        name: 'ISDL Extension',
                        email: 'noreply@isdl.dev'
                    },
                    branch: 'main'
                };

                // Include SHA if updating existing file
                if (existingSha) {
                    updateParams.sha = existingSha;
                }

                const result = await this.octokit!.repos.createOrUpdateFileContents(updateParams);

                console.log('✅ Workflow file updated successfully');
                console.log(`📊 Commit SHA: ${result.data.commit.sha}`);
            }

            return true;

        } catch (error: any) {
            console.error('❌ Failed to ensure workflow file:', error);
            console.error('❌ Error details:', {
                status: error.status,
                message: error.message,
                response: error.response?.data
            });

            vscode.window.showWarningMessage(
                `Could not create/update GitHub workflow file: ${error.message}. The system files were published but automated releases may not work.`,
                'View Documentation'
            ).then(action => {
                if (action === 'View Documentation') {
                    vscode.env.openExternal(vscode.Uri.parse('https://docs.github.com/en/actions/quickstart'));
                }
            });

            return false;
        }
    }

    // Private helper methods
    private async initializeOctokit(): Promise<boolean> {
        const session = await this.authProvider.getCurrentSession();
        if (!session) {
            vscode.window.showErrorMessage('GitHub authentication required.');
            return false;
        }

        this.octokit = new Octokit({
            auth: session.accessToken,
            userAgent: 'ISDL-VSCode-Extension'
        });

        return true;
    }

    /**
     * Get the latest semantic version tag from the repository
     */
    private async getLatestSemanticTag(): Promise<string | null> {
        if (!await this.initializeOctokit() || !this.currentRepository) return null;

        try {
            const owner = this.currentRepository.full_name.split('/')[0];
            const repo = this.currentRepository.name;

            // Get all tags
            const tags = await this.octokit!.repos.listTags({
                owner,
                repo,
                per_page: 100
            });

            if (tags.data.length === 0) {
                return null;
            }

            // Parse all versions and find the highest semantic version
            const versions = tags.data
                .map(tag => {
                    const version = tag.name.replace(/^v/, '');
                    const parts = version.split('.');
                    
                    // Must have at least 2 parts and all parts must be valid numbers
                    if (parts.length < 2) return null;
                    
                    const numericParts = parts.map(part => {
                        const num = parseInt(part, 10);
                        return isNaN(num) ? null : num;
                    });
                    
                    // Check if any part failed to parse
                    if (numericParts.some(part => part === null)) return null;
                    
                    // Ensure we have major.minor.patch format
                    while (numericParts.length < 3) numericParts.push(0);
                    
                    return {
                        original: tag.name,
                        version: version,
                        major: numericParts[0]!,
                        minor: numericParts[1]!,
                        patch: numericParts[2]!,
                        numeric: numericParts[0]! * 10000 + numericParts[1]! * 100 + numericParts[2]!
                    };
                })
                .filter((v): v is NonNullable<typeof v> => v !== null)
                .sort((a, b) => b.numeric - a.numeric);

            if (versions.length === 0) {
                return null;
            }

            const latestVersion = versions[0];
            console.log(`🏷️ Latest semantic version: "${latestVersion.version}" (${latestVersion.original})`);
            return latestVersion.original;

        } catch (error: any) {
            console.warn('Failed to get latest semantic tag:', error);
            return null;
        }
    }

    /**
     * Get previous version of a file from the repository
     */
    private async getPreviousFileContent(filePath: string): Promise<string | null> {
        if (!await this.initializeOctokit() || !this.currentRepository) return null;

        try {
            const owner = this.currentRepository.full_name.split('/')[0];
            
            // Get the latest tag to compare against
            const latestTag = await this.getLatestSemanticTag();
            if (!latestTag) {
                console.log(`📝 No previous tags found, treating as new system`);
                return null;
            }

            console.log(`🏷️ Comparing against last release: ${latestTag}`);

            const response = await this.octokit!.repos.getContent({
                owner,
                repo: this.currentRepository.name,
                path: filePath,
                ref: latestTag // Use the latest tag instead of default branch
            });

            if ('content' in response.data && response.data.content) {
                return Buffer.from(response.data.content, 'base64').toString('utf8');
            }
        } catch (error: any) {
            if (error.status === 404) {
                console.log(`📝 File ${filePath} not found in last release (${await this.getLatestSemanticTag()})`);
            } else {
                console.warn(`Failed to get previous version of ${filePath}:`, error);
            }
        }

        return null;
    }

    /**
     * Compare two ISDL file versions and identify changes
     */
    private async compareIsdlVersions(previousContent: string, currentContent: string): Promise<IsdlChange[]> {
        const changes: IsdlChange[] = [];

        try {
            // Parse both versions using the language services
            const services = createIntelligentSystemDesignLanguageServices(NodeFileSystem).IntelligentSystemDesignLanguage;

            const previousAst = await this.parseIsdlContent("previous", previousContent, services);
            const currentAst = await this.parseIsdlContent("current", currentContent, services);

            if (!previousAst || !currentAst) {
                changes.push({ type: 'modified', category: 'system', description: 'ISDL file structure changed (parsing failed)' });
                return changes;
            }

            // Extract field information from both versions
            const previousFields = this.extractIsdlFields(previousAst);
            const currentFields = this.extractIsdlFields(currentAst);

            // Compare fields to find changes
            changes.push(...this.compareIsdlFields(previousFields, currentFields));

            // Check for system-level changes (config)
            changes.push(...this.compareIsdlConfig(previousAst, currentAst));

        } catch (error) {
            console.error('Failed to compare ISDL versions:', error);
            changes.push({ type: 'modified', category: 'system', description: 'ISDL file changed (comparison failed)' });
        }

        return changes;
    }

    /**
     * Parse ISDL content into AST
     */
    private async parseIsdlContent(name: string, content: string, services: any): Promise<any | null> {
        try {
            // Create a temporary document for parsing
            const tempDocument = services.shared.workspace.LangiumDocuments.createDocument(
                URI.file(`/${name}-temp.isdl`),
                content
            );

            await services.shared.workspace.DocumentBuilder.build([tempDocument], { validation: false });
            return tempDocument.parseResult?.value || null;
        } catch (error) {
            console.error('Failed to parse ISDL content:', error);
            return null;
        }
    }

    /**
     * Extract field and action information from ISDL AST
     */
    private extractIsdlFields(ast: any): IsdlFieldInfo[] {
        const fields: IsdlFieldInfo[] = [];

        try {
            // Process actors and items
            for (const document of ast.documents || []) {
                const docType = document.$type;
                const docName = document.name;

                if (docType === 'Actor' || docType === 'Item') {
                    this.extractFieldsFromDocument(document, docName, fields);
                }
            }
        } catch (error) {
            console.error('Failed to extract ISDL fields:', error);
        }

        return fields;
    }

    /**
     * Recursively extract fields from a document or layout block
     */
    private extractFieldsFromDocument(node: any, location: string, fields: IsdlFieldInfo[]): void {
        if (!node || !node.body) return;

        for (const item of node.body) {
            const itemType = item.$type;

            // Handle properties (fields)
            if (this.isPropertyType(itemType)) {
                const fieldInfo: IsdlFieldInfo = {
                    name: item.name,
                    type: itemType,
                    category: 'field',
                    location: location,
                    modifiers: item.modifier ? [item.modifier] : [],
                    parameters: this.extractParameters(item)
                };
                fields.push(fieldInfo);
            }
            // Handle actions
            else if (itemType === 'Action') {
                const actionInfo: IsdlFieldInfo = {
                    name: item.name,
                    type: 'Action',
                    category: 'action',
                    location: location,
                    modifiers: [
                        ...(item.isQuick ? ['quick'] : []),
                        ...(item.isMacro ? ['macro'] : []),
                        ...(item.modifier ? [item.modifier] : [])
                    ],
                    parameters: this.extractParameters(item)
                };
                fields.push(actionInfo);
            }
            // Handle layout elements (sections, rows, columns, etc.)
            else if (['Section', 'Row', 'Column', 'Page', 'Tab'].includes(itemType)) {
                const layoutLocation = item.name ? `${location} - ${item.name}` : location;
                this.extractFieldsFromDocument(item, layoutLocation, fields);
            }
        }
    }

    /**
     * Check if a type represents a property/field
     */
    private isPropertyType(type: string): boolean {
        const propertyTypes = [
            'StringExp', 'NumberExp', 'BooleanExp', 'HtmlExp',
            'ResourceExp', 'TrackerExp', 'AttributeExp', 'DamageTrackExp',
            'DateExp', 'TimeExp', 'DateTimeExp',
            'DieField', 'DiceField',
            'DocumentArrayExp', 'SingleDocumentExp', 'DocumentChoiceExp',
            'ParentPropertyRefExp', 'StringChoiceField', 'MeasuredTemplateField',
            'PaperDollExp', 'MacroField', 'TableField'
        ];
        return propertyTypes.includes(type);
    }

    /**
     * Extract parameters from a field or action
     */
    private extractParameters(item: any): string[] {
        const params: string[] = [];

        if (item.params) {
            for (const param of item.params) {
                if (param.value !== undefined) {
                    params.push(`${param.$type}=${param.value}`);
                } else {
                    params.push(param.$type);
                }
            }
        }

        return params;
    }

    /**
     * Compare field lists to find changes
     */
    private compareIsdlFields(previousFields: IsdlFieldInfo[], currentFields: IsdlFieldInfo[]): IsdlChange[] {
        const changes: IsdlChange[] = [];

        // Create maps for easier comparison
        const previousMap = new Map(previousFields.map(f => [`${f.location}.${f.name}`, f]));
        const currentMap = new Map(currentFields.map(f => [`${f.location}.${f.name}`, f]));

        // Find removed fields (MAJOR change)
        for (const [key, field] of previousMap) {
            if (!currentMap.has(key)) {
                changes.push({
                    type: 'removed',
                    category: field.category,
                    description: `Removed ${field.category} '${field.name}' from ${field.location}`,
                    name: field.name,
                    details: `Type: ${field.name}${field.modifiers?.length ? `, Modifiers: ${field.modifiers.join(', ')}` : ''}`
                });
            }
        }

        // Find added fields (MINOR change)
        for (const [key, field] of currentMap) {
            if (!previousMap.has(key)) {
                changes.push({
                    type: 'added',
                    category: field.category,
                    description: `Added ${field.category} '${field.name}' to ${field.location}`,
                    name: field.name,
                    details: `Type: ${field.name}${field.modifiers?.length ? `, Modifiers: ${field.modifiers.join(', ')}` : ''}`
                });
            }
        }

        // Find modified fields (MINOR or PATCH change depending on modification)
        for (const [key, currentField] of currentMap) {
            const previousField = previousMap.get(key);
            if (previousField && !this.fieldsEqual(previousField, currentField)) {
                const changeDetails = this.getFieldChangeDetails(previousField, currentField);
                changes.push({
                    type: 'modified',
                    category: currentField.category,
                    description: `Modified ${currentField.category} '${currentField.name}' in ${currentField.location}`,
                    name: currentField.name,
                    details: changeDetails
                });
            }
        }

        return changes;
    }

    /**
     * Compare ISDL config sections
     */
    private compareIsdlConfig(previousAst: any, currentAst: any): IsdlChange[] {
        const changes: IsdlChange[] = [];

        try {
            const previousConfig = previousAst.config?.body || [];
            const currentConfig = currentAst.config?.body || [];

            const previousConfigMap = new Map(previousConfig.map((c: any) => [c.type, c.value]));
            const currentConfigMap = new Map(currentConfig.map((c: any) => [c.type, c.value]));

            // Check for config changes
            for (const [key, value] of currentConfigMap) {
                const previousValue = previousConfigMap.get(key);
                if (previousValue !== value) {
                    changes.push({
                        type: previousValue ? 'modified' : 'added',
                        category: 'system',
                        description: `${previousValue ? 'Updated' : 'Added'} system ${key}: ${value}`,
                        details: previousValue ? `Changed from '${previousValue}' to '${value}'` : undefined
                    });
                }
            }
        } catch (error) {
            console.error('Failed to compare ISDL config:', error);
        }

        return changes;
    }

    /**
     * Check if two fields are equal
     */
    private fieldsEqual(field1: IsdlFieldInfo, field2: IsdlFieldInfo): boolean {
        return field1.type === field2.type &&
            JSON.stringify(field1.modifiers) === JSON.stringify(field2.modifiers) &&
            JSON.stringify(field1.parameters) === JSON.stringify(field2.parameters);
    }

    /**
     * Get details about what changed in a field
     */
    private getFieldChangeDetails(oldField: IsdlFieldInfo, newField: IsdlFieldInfo): string {
        const details: string[] = [];

        if (oldField.type !== newField.type) {
            details.push(`Type changed from ${oldField.name} to ${newField.name}`);
        }

        if (JSON.stringify(oldField.modifiers) !== JSON.stringify(newField.modifiers)) {
            details.push(`Modifiers changed from [${oldField.modifiers?.join(', ')}] to [${newField.modifiers?.join(', ')}]`);
        }

        if (JSON.stringify(oldField.parameters) !== JSON.stringify(newField.parameters)) {
            details.push(`Parameters changed`);
        }

        return details.join('; ');
    }

    /**
     * Determine version bump type from ISDL changes
     */
    private determineVersionFromIsdlChanges(changes: IsdlChange[]): 'major' | 'minor' | 'patch' {
        // Any removed or renamed fields = MAJOR version (breaking change)
        const hasBreakingChanges = changes.some(c => c.type === 'removed' || c.type === 'renamed');
        if (hasBreakingChanges) {
            return 'major';
        }

        // Any added fields or actions = MINOR version (new feature)
        const hasNewFeatures = changes.some(c =>
            c.type === 'added' && (c.category === 'field' || c.category === 'action')
        );
        if (hasNewFeatures) {
            return 'minor';
        }

        // System config changes = MINOR version
        const hasSystemChanges = changes.some(c => c.category === 'system');
        if (hasSystemChanges) {
            return 'minor';
        }

        // Other modifications = PATCH version (implementation details)
        return 'patch';
    }
}