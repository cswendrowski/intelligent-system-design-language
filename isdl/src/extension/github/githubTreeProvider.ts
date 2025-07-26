import * as vscode from 'vscode';
import { GitHubManager } from './githubManager.js';
import { GitHubGistManager } from './githubGistManager.js';

export class GitHubTreeProvider implements vscode.TreeDataProvider<GitHubTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<GitHubTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        private githubManager: GitHubManager,
        private gistManager: GitHubGistManager
    ) {
        // Listen for GitHub state changes
        githubManager.onDidChangeState(() => {
            this.refresh();
        });
        
        // Listen for Gist state changes
        gistManager.onDidChangeState(() => {
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
            case 'gist-section':
                return this.getGistItems();
            default:
                return [];
        }
    }

    private async getRootItems(): Promise<GitHubTreeItem[]> {
        const isAuthenticated = await this.githubManager.isAuthenticated();
        const userInfo = await this.githubManager.getUserInfo();
        
        // If not authenticated or no valid user info, show connect option
        if (!isAuthenticated || !userInfo) {
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

        const currentRepo = this.githubManager.getCurrentRepository();

        const currentGist = this.gistManager.getCurrentGist();

        const items: GitHubTreeItem[] = [
            new GitHubTreeItem(
                `Connected as ${userInfo.login}`,
                userInfo.name || 'GitHub User',
                vscode.TreeItemCollapsibleState.None,
                'user',
                {
                    command: 'isdl.github.openProfile',
                    title: 'Open Profile',
                    arguments: [userInfo.login]
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
            ),
            new GitHubTreeItem(
                'Gist',
                currentGist ? `Connected to ${currentGist.description}` : 'No gist selected',
                vscode.TreeItemCollapsibleState.Expanded,
                'gist-section',
                undefined,
                currentGist ? '$(gist)' : '$(gist-new)'
            )
        ];


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

        const items = [
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
            )
        ];

        // Add publish and update actions based on whether system files are available
        const config = vscode.workspace.getConfiguration('fsdl');
        const lastSelectedFolder: string | undefined = config.get('lastSelectedFolder');

        if (lastSelectedFolder) {
            items.push(
                new GitHubTreeItem(
                    'Publish System',
                    'Create new release with system files',
                    vscode.TreeItemCollapsibleState.None,
                    'publish',
                    {
                        command: 'isdl.github.publish',
                        title: 'Publish System'
                    },
                    '$(rocket)'
                ),
                new GitHubTreeItem(
                    'Update Files',
                    'Update repository files without releasing',
                    vscode.TreeItemCollapsibleState.None,
                    'update',
                    {
                        command: 'isdl.github.update',
                        title: 'Update Files'
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

        items.push(
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
                '$(diff-removed)'
            )
        );

        return items;
    }

    private async getGistItems(): Promise<GitHubTreeItem[]> {
        const currentGist = this.gistManager.getCurrentGist();

        if (!currentGist) {
            return [
                new GitHubTreeItem(
                    'Select Gist',
                    'Choose from your existing gists',
                    vscode.TreeItemCollapsibleState.None,
                    'select-gist',
                    {
                        command: 'isdl.github.selectGist',
                        title: 'Select Gist'
                    },
                    '$(gist)'
                ),
                new GitHubTreeItem(
                    'Create Gist',
                    'Create a new gist for your ISDL file',
                    vscode.TreeItemCollapsibleState.None,
                    'create-gist',
                    {
                        command: 'isdl.github.createGist',
                        title: 'Create Gist'
                    },
                    '$(gist-new)'
                )
            ];
        }

        const items = [
            new GitHubTreeItem(
                currentGist.description,
                currentGist.public ? 'Public gist' : 'Secret gist',
                vscode.TreeItemCollapsibleState.None,
                'current-gist',
                {
                    command: 'vscode.open',
                    title: 'Open in GitHub',
                    arguments: [vscode.Uri.parse(currentGist.html_url)]
                },
                currentGist.public ? '$(unlock)' : '$(lock)'
            )
        ];

        // Show ISDL files in the gist
        const isdlFiles = Object.keys(currentGist.files).filter(name => 
            name.endsWith('.isdl') || name.endsWith('.fsdl')
        );

        if (isdlFiles.length > 0) {
            isdlFiles.forEach(filename => {
                items.push(
                    new GitHubTreeItem(
                        filename,
                        `${currentGist.files[filename].size} bytes`,
                        vscode.TreeItemCollapsibleState.None,
                        'gist-file',
                        {
                            command: 'isdl.github.downloadFromGist',
                            title: 'Download File',
                            arguments: [filename]
                        },
                        '$(file-code)'
                    )
                );
            });
        }

        // Add sync and management actions
        items.push(
            new GitHubTreeItem(
                'Sync to Gist',
                'Upload current ISDL file to this gist',
                vscode.TreeItemCollapsibleState.None,
                'sync-gist',
                {
                    command: 'isdl.github.syncToGist',
                    title: 'Sync to Gist'
                },
                '$(cloud-upload)'
            ),
            new GitHubTreeItem(
                'Download from Gist',
                'Download ISDL file from this gist',
                vscode.TreeItemCollapsibleState.None,
                'download-gist',
                {
                    command: 'isdl.github.downloadFromGist',
                    title: 'Download from Gist'
                },
                '$(cloud-download)'
            ),
            new GitHubTreeItem(
                'Change Gist',
                'Switch to a different gist',
                vscode.TreeItemCollapsibleState.None,
                'change-gist',
                {
                    command: 'isdl.github.selectGist',
                    title: 'Change Gist'
                },
                '$(arrow-swap)'
            ),
            new GitHubTreeItem(
                'Disconnect',
                'Remove gist connection',
                vscode.TreeItemCollapsibleState.None,
                'disconnect-gist',
                {
                    command: 'isdl.github.disconnectGist',
                    title: 'Disconnect Gist'
                },
                '$(diff-removed)'
            )
        );

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