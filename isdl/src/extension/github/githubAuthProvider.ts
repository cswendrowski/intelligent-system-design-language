import * as vscode from 'vscode';

export interface GitHubUserInfo {
    login: string;
    id: number;
    name: string;
    email: string;
    avatar_url: string;
}

export class GitHubAuthProvider {
    private static readonly GITHUB_AUTH_PROVIDER_ID = 'github';
    private static readonly SCOPES = ['repo', 'user:email', 'actions:write', 'contents:write', 'workflow', 'gist'];

    constructor(private context: vscode.ExtensionContext) {
    }

    /**
     * Authenticate user with GitHub and store credentials securely
     */
    async authenticateUser(): Promise<GitHubUserInfo | undefined> {
        try {
            // Show progress while authenticating
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Connecting to GitHub...",
                cancellable: true
            }, async (progress) => {
                // Use the editor's built-in GitHub provider, falling back to a Personal
                // Access Token on builds that don't ship it (e.g. VSCodium / OSS builds).
                const token = await this.getAccessToken(true);

                if (!token) {
                    vscode.window.showErrorMessage('Failed to authenticate with GitHub');
                    return undefined;
                }

                // Get user information
                const userInfo = await this.getUserInfo(token);

                if (userInfo) {
                    await this.storeUserInfo(userInfo);
                    vscode.window.showInformationMessage(
                        `Successfully connected to GitHub as ${userInfo.login}`,
                        'View Profile'
                    ).then(selection => {
                        if (selection === 'View Profile') {
                            vscode.env.openExternal(vscode.Uri.parse(`https://github.com/${userInfo.login}`));
                        }
                    });
                }

                return userInfo;
            });
        } catch (error) {
            console.error('GitHub authentication failed:', error);
            vscode.window.showErrorMessage(`GitHub authentication failed: ${error}`);
            return undefined;
        }
    }

    /**
     * Central access-token accessor and the single choke point for obtaining GitHub
     * credentials. Tries the editor's built-in 'github' authentication provider first; if
     * that provider is entirely absent (common on VSCodium and other non-Microsoft builds,
     * where getSession throws) or has no session, falls back to a stored Personal Access
     * Token -- prompting for one when `interactive` is true. Returns undefined if no token
     * can be obtained.
     */
    async getAccessToken(interactive: boolean = false): Promise<string | undefined> {
        const session = await this.getNativeSession(interactive);
        if (session) {
            return session.accessToken;
        }

        const storedPat = await this.context.secrets.get('github.pat');
        if (storedPat) {
            return storedPat;
        }

        if (interactive) {
            return await this.promptForPat();
        }
        return undefined;
    }

    /**
     * getSession wrapper that tolerates the 'github' provider being unregistered (in which
     * case getSession throws rather than returning null) and never surfaces UI when silent.
     */
    private async getNativeSession(interactive: boolean): Promise<vscode.AuthenticationSession | undefined> {
        try {
            return await vscode.authentication.getSession(
                GitHubAuthProvider.GITHUB_AUTH_PROVIDER_ID,
                GitHubAuthProvider.SCOPES,
                interactive ? { createIfNone: true } : { silent: true }
            );
        } catch {
            // No built-in GitHub authentication provider available on this build.
            return undefined;
        }
    }

    /**
     * Prompt for, validate, and store a GitHub Personal Access Token. Used when the editor
     * has no built-in GitHub sign-in. The scope guidance must match SCOPES so the token can
     * actually perform repo creation, publishing, workflow and gist operations.
     */
    private async promptForPat(): Promise<string | undefined> {
        const token = await vscode.window.showInputBox({
            title: 'Connect to GitHub with a Personal Access Token',
            prompt: "This editor has no built-in GitHub sign-in (common on VSCodium and other OSS builds). Create a classic token at github.com/settings/tokens with scopes: repo, workflow, gist, user:email -- then paste it here.",
            placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxx',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => (value && value.trim().length > 0) ? undefined : 'Token cannot be empty'
        });
        if (!token) {
            return undefined;
        }

        const trimmed = token.trim();
        // Validate before storing so a bad/under-scoped token fails here rather than mid-publish.
        const userInfo = await this.getUserInfo(trimmed);
        if (!userInfo) {
            vscode.window.showErrorMessage('That GitHub token could not be validated. Make sure it is a classic token with the repo, workflow, gist and user:email scopes.');
            return undefined;
        }

        await this.context.secrets.store('github.pat', trimmed);
        await this.storeUserInfo(userInfo);
        return trimmed;
    }

    /**
     * Check if user is currently authenticated (native session or stored PAT).
     */
    async isAuthenticated(): Promise<boolean> {
        return !!(await this.getAccessToken(false));
    }

    /**
     * Get current GitHub session from the built-in provider, if any. Returns undefined when
     * the provider is absent or only a PAT is configured -- callers needing a token for API
     * calls should use getAccessToken() instead, which also covers the PAT path.
     */
    async getCurrentSession(): Promise<vscode.AuthenticationSession | undefined> {
        return await this.getNativeSession(false);
    }

    /**
     * Get stored user information
     */
    async getStoredUserInfo(): Promise<GitHubUserInfo | undefined> {
        try {
            const userInfoJson = await this.context.secrets.get('github.userInfo');
            return userInfoJson ? JSON.parse(userInfoJson) : undefined;
        } catch {
            return undefined;
        }
    }

    /**
     * Sign out from GitHub
     */
    async signOut(): Promise<void> {
        try {
            const session = await this.getCurrentSession();
            if (session) {
                // Remove the session
                await vscode.authentication.getSession(
                    GitHubAuthProvider.GITHUB_AUTH_PROVIDER_ID,
                    GitHubAuthProvider.SCOPES,
                    { clearSessionPreference: true, silent: true }
                );
            }

            // Clear stored information (native session cache + PAT fallback)
            await this.context.secrets.delete('github.userInfo');
            await this.context.secrets.delete('github.session');
            await this.context.secrets.delete('github.pat');

            vscode.window.showInformationMessage('Successfully signed out from GitHub');
        } catch (error) {
            console.error('Error signing out:', error);
            vscode.window.showErrorMessage(`Failed to sign out: ${error}`);
        }
    }

    /**
     * Get user information from GitHub API
     */
    private async getUserInfo(accessToken: string): Promise<GitHubUserInfo | undefined> {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'ISDL-VSCode-Extension'
                }
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            let jsonResponse = await response.json() as GitHubUserInfo;
            return jsonResponse;
        } catch (error) {
            console.error('Failed to get user info:', error);
            return undefined;
        }
    }

    /**
     * Store user information securely
     */
    private async storeUserInfo(userInfo: GitHubUserInfo): Promise<void> {
        await this.context.secrets.store('github.userInfo', JSON.stringify(userInfo));
    }
}

// src/github/GitHubSetupWizard.ts
export class GitHubSetupWizard {
    constructor(
        private authProvider: GitHubAuthProvider
    ) {}

    /**
     * Run the complete GitHub setup wizard
     */
    async runSetupWizard(): Promise<boolean> {
        // Step 1: Welcome and explanation
        const shouldContinue = await this.showWelcomeStep();
        if (!shouldContinue) return false;

        // Step 2: Check if already authenticated
        const isAuthenticated = await this.authProvider.isAuthenticated();
        if (isAuthenticated) {
            const userInfo = await this.authProvider.getStoredUserInfo();
            const reconnect = await vscode.window.showInformationMessage(
                `You're already connected to GitHub as ${userInfo?.login || 'unknown user'}. Would you like to reconnect?`,
                'Reconnect',
                'Cancel'
            );

            if (reconnect !== 'Reconnect') return false;

            // Sign out first
            await this.authProvider.signOut();
        }

        // Step 3: Authenticate with GitHub
        const userInfo = await this.authProvider.authenticateUser();
        if (!userInfo) return false;

        // Step 4: Show success and next steps
        await this.showSuccessStep(userInfo);

        return true;
    }

    /**
     * Show welcome step with explanation
     */
    private async showWelcomeStep(): Promise<boolean> {
        const items: vscode.QuickPickItem[] = [
            {
                label: '$(github) Connect to GitHub',
                description: 'Set up GitHub publishing for your ISDL systems',
                detail: 'This will allow you to publish and share your tabletop RPG systems'
            },
            {
                label: '$(x) Cancel',
                description: 'Skip GitHub setup for now'
            }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            title: 'ISDL GitHub Publishing Setup',
            placeHolder: 'Choose an option to continue',
            ignoreFocusOut: true
        });

        return selection?.label.includes('Connect to GitHub') ?? false;
    }

    /**
     * Show success step with next actions
     */
    private async showSuccessStep(userInfo: GitHubUserInfo): Promise<void> {
        const items: vscode.QuickPickItem[] = [
            {
                label: '$(repo-create) Create New Repository',
                description: 'Create a new GitHub repository for your system',
                detail: 'Set up a fresh repository to publish your ISDL system'
            },
            {
                label: '$(repo) Use Existing Repository',
                description: 'Connect to an existing GitHub repository',
                detail: 'Publish to a repository you already own'
            },
            {
                label: '$(gear) Configure Settings',
                description: 'Configure publishing preferences',
                detail: 'Set up default options for system publishing'
            },
            {
                label: '$(check) Done',
                description: 'Complete setup and return to work'
            }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            title: `Welcome ${userInfo.name || userInfo.login}!`,
            placeHolder: 'What would you like to do next?',
            ignoreFocusOut: true
        });

        // Handle the selection
        switch (selection?.label) {
            case '$(repo-create) Create New Repository':
                await this.showCreateRepositoryWizard();
                break;
            case '$(repo) Use Existing Repository':
                await this.showSelectRepositoryWizard();
                break;
            case '$(gear) Configure Settings':
                await this.showSettingsWizard();
                break;
        }
    }

    /**
     * Show create repository wizard (placeholder)
     */
    private async showCreateRepositoryWizard(): Promise<void> {
        vscode.window.showInformationMessage('Create repository wizard coming soon!');
    }

    /**
     * Show select repository wizard (placeholder)
     */
    private async showSelectRepositoryWizard(): Promise<void> {
        vscode.window.showInformationMessage('Select repository wizard coming soon!');
    }

    /**
     * Show settings wizard (placeholder)
     */
    private async showSettingsWizard(): Promise<void> {
        vscode.window.showInformationMessage('Settings wizard coming soon!');
    }
}

// src/github/GitHubStatusProvider.ts
export class GitHubStatusProvider implements vscode.TreeDataProvider<GitHubStatusItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<GitHubStatusItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private authProvider: GitHubAuthProvider
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: GitHubStatusItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: GitHubStatusItem): Promise<GitHubStatusItem[]> {
        if (!element) {
            // Root level items
            const isAuthenticated = await this.authProvider.isAuthenticated();

            if (!isAuthenticated) {
                return [
                    new GitHubStatusItem(
                        'Not Connected',
                        'Click to connect to GitHub',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'isdl.github.setup',
                            title: 'Connect to GitHub'
                        },
                        'warning'
                    )
                ];
            }

            // User is authenticated
            const userInfo = await this.authProvider.getStoredUserInfo();
            return [
                new GitHubStatusItem(
                    `Connected as ${userInfo?.login || 'Unknown'}`,
                    userInfo?.name || 'GitHub User',
                    vscode.TreeItemCollapsibleState.Expanded,
                    undefined,
                    'account'
                ),
                new GitHubStatusItem(
                    'Publish System',
                    'Publish your ISDL system to GitHub',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'isdl.github.publish',
                        title: 'Publish System'
                    },
                    'repo-push'
                )
            ];
        }

        return [];
    }
}

class GitHubStatusItem extends vscode.TreeItem {
    constructor(
        public override readonly label: string,
        public override readonly description: string,
        public override readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public override readonly command?: vscode.Command,
        iconName?: string
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.tooltip = description;

        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName);
        }

        if (command) {
            this.command = command;
        }
    }
}

// Extension activation code (add to your main extension file)
export function registerGitHubCommands(context: vscode.ExtensionContext) {
    const authProvider = new GitHubAuthProvider(context);
    const setupWizard = new GitHubSetupWizard(authProvider);
    const statusProvider = new GitHubStatusProvider(authProvider);

    // Register tree view
    const treeView = vscode.window.createTreeView('isdl.github', {
        treeDataProvider: statusProvider,
        showCollapseAll: false
    });

    // Register commands
    const setupCommand = vscode.commands.registerCommand('isdl.github.setup', async () => {
        await setupWizard.runSetupWizard();
        statusProvider.refresh();
    });

    const signOutCommand = vscode.commands.registerCommand('isdl.github.signout', async () => {
        await authProvider.signOut();
        statusProvider.refresh();
    });

    const refreshCommand = vscode.commands.registerCommand('isdl.github.refresh', () => {
        statusProvider.refresh();
    });

    // Placeholder for future publish command
    const publishCommand = vscode.commands.registerCommand('isdl.github.publish', () => {
        vscode.window.showInformationMessage('Publishing feature coming soon!');
    });

    // Add to context subscriptions
    context.subscriptions.push(
        treeView,
        setupCommand,
        signOutCommand,
        refreshCommand,
        publishCommand
    );

    // Refresh status on activation
    statusProvider.refresh();
}
