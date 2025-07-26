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
                // Use VS Code's built-in GitHub authentication
                const session = await vscode.authentication.getSession(
                    GitHubAuthProvider.GITHUB_AUTH_PROVIDER_ID,
                    GitHubAuthProvider.SCOPES,
                    { createIfNone: true }
                );

                if (!session) {
                    vscode.window.showErrorMessage('Failed to authenticate with GitHub');
                    return undefined;
                }

                // Store the session information securely
                await this.storeGitHubSession(session);

                // Get user information
                const userInfo = await this.getUserInfo(session.accessToken);

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
     * Check if user is currently authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const session = await vscode.authentication.getSession(
                GitHubAuthProvider.GITHUB_AUTH_PROVIDER_ID,
                GitHubAuthProvider.SCOPES,
                { silent: true }
            );
            return !!session;
        } catch {
            return false;
        }
    }

    /**
     * Get current GitHub session
     */
    async getCurrentSession(): Promise<vscode.AuthenticationSession | undefined> {
        try {
            return await vscode.authentication.getSession(
                GitHubAuthProvider.GITHUB_AUTH_PROVIDER_ID,
                GitHubAuthProvider.SCOPES,
                { silent: true }
            );
        } catch {
            return undefined;
        }
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

            // Clear stored information
            await this.context.secrets.delete('github.userInfo');
            await this.context.secrets.delete('github.session');

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
     * Store GitHub session securely
     */
    private async storeGitHubSession(session: vscode.AuthenticationSession): Promise<void> {
        const sessionData = {
            accessToken: session.accessToken,
            account: session.account,
            id: session.id,
            scopes: session.scopes
        };
        await this.context.secrets.store('github.session', JSON.stringify(sessionData));
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
                            command: 'fsdl.github.setup',
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
                        command: 'fsdl.github.publish',
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
    const treeView = vscode.window.createTreeView('fsdl.github', {
        treeDataProvider: statusProvider,
        showCollapseAll: false
    });

    // Register commands
    const setupCommand = vscode.commands.registerCommand('fsdl.github.setup', async () => {
        await setupWizard.runSetupWizard();
        statusProvider.refresh();
    });

    const signOutCommand = vscode.commands.registerCommand('fsdl.github.signout', async () => {
        await authProvider.signOut();
        statusProvider.refresh();
    });

    const refreshCommand = vscode.commands.registerCommand('fsdl.github.refresh', () => {
        statusProvider.refresh();
    });

    // Placeholder for future publish command
    const publishCommand = vscode.commands.registerCommand('fsdl.github.publish', () => {
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
