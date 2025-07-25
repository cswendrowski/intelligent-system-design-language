import * as vscode from 'vscode';
import { GitHubManager } from './githubManager.js';

export class GitHubTreeProvider implements vscode.TreeDataProvider<GitHubTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<GitHubTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private githubManager: GitHubManager) {
        // Listen for GitHub state changes
        githubManager.onDidChangeState(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: GitHubTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: GitHubTreeItem): Promise<GitHubTreeItem[]> {
        if (!element) {
            return this.getRootItems();
        }

        switch (element.contextValue) {
            case 'repository-section':
                return this.getRepositoryItems();
            case 'publishing-section':
                return this.getPublishingItems();
            default:
                return [];
        }
    }

    private async getRootItems(): Promise<GitHubTreeItem[]> {
        const isAuthenticated = await this.githubManager.isAuthenticated();
        
        if (!isAuthenticated) {
            return [
                new GitHubTreeItem(
                    'Connect to GitHub',
                    'Sign in to publish your systems',
                    vscode.TreeItemCollapsibleState.None,
                    'connect',
                    {
                        command: 'isdl.github.authenticate',
                        title: 'Connect to GitHub'
                    },
                    '$(github)'
                )
            ];
        }

        const userInfo = await this.githubManager.getUserInfo();
        const currentRepo = this.githubManager.getCurrentRepository();

        const items: GitHubTreeItem[] = [
            new GitHubTreeItem(
                `Connected as ${userInfo?.login || 'Unknown'}`,
                userInfo?.name || 'GitHub User',
                vscode.TreeItemCollapsibleState.None,
                'user',
                {
                    command: 'isdl.github.openProfile',
                    title: 'Open Profile',
                    arguments: [userInfo?.login]
                },
                '$(account)'
            ),
            new GitHubTreeItem(
                'Repository',
                currentRepo ? `Connected to ${currentRepo.name}` : 'No repository selected',
                vscode.TreeItemCollapsibleState.Expanded,
                'repository-section',
                undefined,
                currentRepo ? '$(repo)' : '$(repo-create)'
            )
        ];

        if (currentRepo) {
            items.push(
                new GitHubTreeItem(
                    'Publishing',
                    'Publish and manage your system',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'publishing-section',
                    undefined,
                    '$(rocket)'
                )
            );
        }

        items.push(
            new GitHubTreeItem(
                'Sign Out',
                'Disconnect from GitHub',
                vscode.TreeItemCollapsibleState.None,
                'signout',
                {
                    command: 'isdl.github.signOut',
                    title: 'Sign Out'
                },
                '$(sign-out)'
            )
        );

        return items;
    }

    private async getRepositoryItems(): Promise<GitHubTreeItem[]> {
        const currentRepo = this.githubManager.getCurrentRepository();

        if (!currentRepo) {
            return [
                new GitHubTreeItem(
                    'Select Repository',
                    'Choose from your existing repositories',
                    vscode.TreeItemCollapsibleState.None,
                    'select-repo',
                    {
                        command: 'isdl.github.selectRepository',
                        title: 'Select Repository'
                    },
                    '$(repo)'
                ),
                new GitHubTreeItem(
                    'Create Repository',
                    'Create a new GitHub repository',
                    vscode.TreeItemCollapsibleState.None,
                    'create-repo',
                    {
                        command: 'isdl.github.createRepository',
                        title: 'Create Repository'
                    },
                    '$(repo-create)'
                )
            ];
        }

        return [
            new GitHubTreeItem(
                currentRepo.name,
                currentRepo.description || 'No description',
                vscode.TreeItemCollapsibleState.None,
                'current-repo',
                {
                    command: 'vscode.open',
                    title: 'Open in GitHub',
                    arguments: [vscode.Uri.parse(currentRepo.html_url)]
                },
                currentRepo.private ? '$(lock)' : '$(unlock)'
            ),
            new GitHubTreeItem(
                'Change Repository',
                'Switch to a different repository',
                vscode.TreeItemCollapsibleState.None,
                'change-repo',
                {
                    command: 'isdl.github.selectRepository',
                    title: 'Change Repository'
                },
                '$(arrow-swap)'
            ),
            new GitHubTreeItem(
                'Disconnect',
                'Remove repository connection',
                vscode.TreeItemCollapsibleState.None,
                'disconnect-repo',
                {
                    command: 'isdl.github.disconnectRepository',
                    title: 'Disconnect Repository'
                },
                '$(unlink)'
            )
        ];
    }

    private async getPublishingItems(): Promise<GitHubTreeItem[]> {
        const config = vscode.workspace.getConfiguration('fsdl');
        const lastSelectedFolder: string | undefined = config.get('lastSelectedFolder');

        const items: GitHubTreeItem[] = [];

        if (lastSelectedFolder) {
            items.push(
                new GitHubTreeItem(
                    'Publish System',
                    'Upload your system to GitHub',
                    vscode.TreeItemCollapsibleState.None,
                    'publish',
                    {
                        command: 'isdl.github.publish',
                        title: 'Publish System'
                    },
                    '$(cloud-upload)'
                )
            );
        } else {
            items.push(
                new GitHubTreeItem(
                    'Generate System First',
                    'No system files found to publish',
                    vscode.TreeItemCollapsibleState.None,
                    'generate-first',
                    {
                        command: 'fsdl.generate',
                        title: 'Generate System'
                    },
                    '$(warning)'
                )
            );
        }

        return items;
    }
}

class GitHubTreeItem extends vscode.TreeItem {
    constructor(
        public override readonly label: string,
        public override readonly description: string,
        public override readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public override readonly contextValue: string,
        public override readonly command?: vscode.Command,
        iconPath?: string
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.tooltip = `${label}: ${description}`;
        this.contextValue = contextValue;

        if (iconPath) {
            this.iconPath = new vscode.ThemeIcon(iconPath.replace('$(', '').replace(')', ''));
        }

        if (command) {
            this.command = command;
        }
    }
}