import * as vscode from 'vscode';

export interface GitHubPublishingConfig {
    defaultBranch: string;
    includeDocumentation: boolean;
    includeBuildScripts: boolean;
    templateRepository?: string;
    commitMessage: string;
    tagReleases: boolean;
    generateChangelog: boolean;
    respositoryVisibility: 'public' | 'private';
    licenseTemplate?: string;
}

/**
 * Simple configuration manager for GitHub settings
 */
export class GitHubConfigurationManager {
    private static readonly CONFIG_KEY = 'fsdl.github';

    /**
     * Get current publishing configuration
     */
    getConfig(): GitHubPublishingConfig {
        const config = vscode.workspace.getConfiguration(GitHubConfigurationManager.CONFIG_KEY);

        return {
            defaultBranch: config.get('defaultBranch', 'main'),
            includeDocumentation: config.get('includeDocumentation', true),
            includeBuildScripts: config.get('includeBuildScripts', true),
            templateRepository: config.get('templateRepository'),
            commitMessage: config.get('commitMessage', 'Update system files'),
            tagReleases: config.get('tagReleases', true),
            generateChangelog: config.get('generateChangelog', true),
            respositoryVisibility: config.get('repositoryVisibility', 'public'),
            licenseTemplate: config.get('licenseTemplate')
        };
    }

    /**
     * Update configuration values
     */
    async updateConfig(updates: Partial<GitHubPublishingConfig>): Promise<void> {
        const config = vscode.workspace.getConfiguration(GitHubConfigurationManager.CONFIG_KEY);
        
        for (const [key, value] of Object.entries(updates)) {
            await config.update(key, value, vscode.ConfigurationTarget.Global);
        }
    }

    /**
     * Show configuration wizard
     */
    async showConfigurationWizard(): Promise<void> {
        const currentConfig = this.getConfig();
        
        // Simple configuration dialog
        const items: vscode.QuickPickItem[] = [
            {
                label: `Default Branch: ${currentConfig.defaultBranch}`,
                description: 'Change default branch name'
            },
            {
                label: `Documentation: ${currentConfig.includeDocumentation ? 'Enabled' : 'Disabled'}`,
                description: 'Toggle automatic documentation generation'
            },
            {
                label: `Build Scripts: ${currentConfig.includeBuildScripts ? 'Enabled' : 'Disabled'}`,
                description: 'Toggle GitHub Actions workflows'
            },
            {
                label: `Repository Visibility: ${currentConfig.respositoryVisibility}`,
                description: 'Change default repository visibility'
            }
        ];

        const selection = await vscode.window.showQuickPick(items, {
            title: 'GitHub Configuration',
            placeHolder: 'Select a setting to change'
        });

        if (!selection) return;

        // Handle the selected configuration change
        if (selection.label.startsWith('Default Branch')) {
            const newBranch = await vscode.window.showInputBox({
                title: 'Default Branch',
                prompt: 'Enter default branch name',
                value: currentConfig.defaultBranch
            });
            if (newBranch) {
                await this.updateConfig({ defaultBranch: newBranch });
            }
        } else if (selection.label.startsWith('Documentation')) {
            await this.updateConfig({ includeDocumentation: !currentConfig.includeDocumentation });
        } else if (selection.label.startsWith('Build Scripts')) {
            await this.updateConfig({ includeBuildScripts: !currentConfig.includeBuildScripts });
        } else if (selection.label.startsWith('Repository Visibility')) {
            const visibility = await vscode.window.showQuickPick([
                { label: 'Public', description: 'Anyone can see this repository' },
                { label: 'Private', description: 'Only you can see this repository' }
            ], {
                title: 'Repository Visibility',
                placeHolder: 'Choose default visibility for new repositories'
            });
            if (visibility) {
                await this.updateConfig({ 
                    respositoryVisibility: visibility.label.toLowerCase() as 'public' | 'private' 
                });
            }
        }

        vscode.window.showInformationMessage('GitHub configuration updated!');
    }
}

/**
 * Simple validation utilities
 */
export class GitHubValidation {
    /**
     * Validate repository name
     */
    static validateRepositoryName(name: string): string | undefined {
        if (!name) return 'Repository name is required';
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) return 'Invalid characters in repository name';
        if (name.length > 100) return 'Repository name too long';
        return undefined;
    }

    /**
     * Validate system files
     */
    static async validateSystemFiles(
        workspaceFolder: vscode.WorkspaceFolder, 
        repositoryManager: any
    ): Promise<string[]> {
        const errors: string[] = [];
        
        // Check if ISDL files exist
        const isdlFiles = await vscode.workspace.findFiles('**/*.isdl', null, 1);
        if (isdlFiles.length === 0) {
            errors.push('No ISDL files found in workspace');
        }

        // Check if system has been generated
        const config = vscode.workspace.getConfiguration('fsdl');
        const lastSelectedFolder: string | undefined = config.get('lastSelectedFolder');
        if (!lastSelectedFolder) {
            errors.push('No generated system files found. Please generate your system first.');
        }

        return errors;
    }
}