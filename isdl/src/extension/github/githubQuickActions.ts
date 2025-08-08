import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitHubManager, GitHubRepository } from './githubManager.js';
import { createIntelligentSystemDesignLanguageServices } from '../../language/intelligent-system-design-language-module.js';
import { extractAstNode } from '../../cli/cli-util.js';
import { NodeFileSystem } from 'langium/node';
import { Entry } from '../../language/generated/ast.js';

export class GitHubQuickActions {
    constructor(private githubManager: GitHubManager) {}

    /**
     * Quick repository selection with search
     */
    async selectRepository(): Promise<void> {
        const repositories = await this.githubManager.listRepositories();

        if (repositories.length === 0) {
            const action = await vscode.window.showInformationMessage(
                'No repositories found in your GitHub account.',
                'Create Repository',
                'Cancel'
            );

            if (action === 'Create Repository') {
                await this.createRepository();
            }
            return;
        }

        // Create quick pick items
        const items: (vscode.QuickPickItem & { repository?: GitHubRepository })[] = [
            {
                label: '$(repo-create) Create New Repository',
                description: 'Create a fresh repository for this system',
                alwaysShow: true
            },
            {
                label: '',
                kind: vscode.QuickPickItemKind.Separator
            }
        ];

        // Add recommended repositories (those with ISDL/Foundry keywords)
        const recommended = repositories.filter(repo =>
            repo.topics.some(topic => ['foundry-vtt', 'isdl', 'tabletop-rpg'].includes(topic)) ||
            repo.description.toLowerCase().includes('foundry') ||
            repo.description.toLowerCase().includes('isdl')
        );

        if (recommended.length > 0) {
            items.push({
                label: 'Recommended',
                kind: vscode.QuickPickItemKind.Separator
            });

            recommended.forEach(repo => {
                items.push({
                    label: `$(repo) ${repo.name}`,
                    description: repo.private ? '$(lock) Private' : '$(unlock) Public',
                    detail: repo.description || 'No description',
                    repository: repo
                });
            });
        }

        // Add other repositories
        const others = repositories.filter(repo => !recommended.includes(repo));
        if (others.length > 0) {
            items.push({
                label: 'All Repositories',
                kind: vscode.QuickPickItemKind.Separator
            });

            others.forEach(repo => {
                items.push({
                    label: `$(repo) ${repo.name}`,
                    description: repo.private ? '$(lock) Private' : '$(unlock) Public',
                    detail: repo.description || 'No description',
                    repository: repo
                });
            });
        }

        const selection = await vscode.window.showQuickPick(items, {
            title: 'Select GitHub Repository',
            placeHolder: 'Choose a repository for your ISDL system',
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: true
        });

        if (!selection) return;

        if (selection.label.includes('Create New Repository')) {
            await this.createRepository();
        } else if (selection.repository) {
            await this.githubManager.setRepository(selection.repository);
            vscode.window.showInformationMessage(
                `Connected to repository '${selection.repository.name}'`
            );
        }
    }

    /**
     * Quick repository creation with enhanced validation and options
     */
    async createRepository(): Promise<void> {
        // Get repository name with validation
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const defaultName = workspaceFolder ? 
            workspaceFolder.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') : '';

        const name = await vscode.window.showInputBox({
            title: 'Create GitHub Repository - Step 1 of 4',
            prompt: 'Repository name',
            value: defaultName,
            validateInput: async (value) => {
                if (!value) return 'Repository name is required';
                if (!/^[a-zA-Z0-9._-]+$/.test(value)) return 'Invalid characters in repository name';
                if (value.length > 100) return 'Repository name too long (max 100 characters)';
                
                // Check if repository already exists
                const exists = await this.checkRepositoryExists(value);
                if (exists) return `Repository '${value}' already exists in your account`;
                
                return undefined;
            }
        });

        if (!name) return;

        // Get description
        const description = await vscode.window.showInputBox({
            title: 'Create GitHub Repository - Step 2 of 4',
            prompt: 'Repository description (optional)',
            placeHolder: 'A Foundry VTT system built with ISDL'
        }) || 'A Foundry VTT system built with ISDL';

        // Get visibility
        const visibility = await vscode.window.showQuickPick([
            {
                label: '$(unlock) Public',
                description: 'Anyone can see this repository',
                detail: 'Required for publishing systems that others can install',
                picked: true
            },
            {
                label: '$(lock) Private',
                description: 'Only you and those you add can see this repository',
                detail: 'Good for work-in-progress systems'
            }
        ], {
            title: 'Create GitHub Repository - Step 3 of 4',
            placeHolder: 'Choose repository visibility'
        });

        if (!visibility) return;
        const isPrivate = visibility.label.includes('Private');

        // Get initialization options
        const options = await vscode.window.showQuickPick([
            {
                label: '$(book) Include README',
                description: 'Generate an initial README.md',
                picked: true
            },
            {
                label: '$(package) Initialize with System Files',
                description: 'Upload current ISDL system files',
                picked: false
            }
        ], {
            title: 'Create GitHub Repository - Step 4 of 4',
            placeHolder: 'Select initialization options (use Space to toggle)',
            canPickMany: true
        });

        if (!options) return;

        // Get license type if selected
        let licenseTemplate: string | undefined;
        licenseTemplate = await this.selectLicense();
        if (!licenseTemplate) return;

        // Prepare repository options
        const repoOptions = {
            name,
            description,
            isPrivate,
            includeReadme: options.some(opt => opt.label.includes('README')),
            includeLicense: licenseTemplate,
            includeGitignore: true,
            initializeWithSystemFiles: options.some(opt => opt.label.includes('System Files'))
        };

        // Create repository with enhanced options
        const repository = await this.createRepositoryWithOptions(repoOptions);
        
        if (repository) {
            vscode.window.showInformationMessage(
                `Repository '${name}' created successfully!`,
                'Open in GitHub',
                'Publish System'
            ).then(action => {
                if (action === 'Open in GitHub') {
                    vscode.env.openExternal(vscode.Uri.parse(repository.html_url));
                } else if (action === 'Publish System') {
                    vscode.commands.executeCommand('isdl.github.publish');
                }
            });
        }
    }

    /**
     * Quick publish with progress
     */
    async publishSystem(): Promise<void> {
        const currentRepo = this.githubManager.getCurrentRepository();
        
        if (!currentRepo) {
            const action = await vscode.window.showInformationMessage(
                'No repository connected. Please select a repository first.',
                'Select Repository',
                'Create Repository'
            );

            if (action === 'Select Repository') {
                await this.selectRepository();
            } else if (action === 'Create Repository') {
                await this.createRepository();
            }
            return;
        }

        await this.githubManager.publishSystem();
        
        // The publishSystem method now handles its own success notifications
        // including creating releases and providing appropriate action buttons
    }

    /**
     * Quick update without release
     */
    async updateSystem(): Promise<void> {
        const currentRepo = this.githubManager.getCurrentRepository();
        
        if (!currentRepo) {
            const action = await vscode.window.showInformationMessage(
                'No repository connected. Please select a repository first.',
                'Select Repository',
                'Create Repository'
            );

            if (action === 'Select Repository') {
                await this.selectRepository();
            } else if (action === 'Create Repository') {
                await this.createRepository();
            }
            return;
        }

        await this.githubManager.updateSystem();
        
        // The updateSystem method handles its own success notifications
    }

    /**
     * Disconnect repository with confirmation
     */
    async disconnectRepository(): Promise<void> {
        const currentRepo = this.githubManager.getCurrentRepository();
        if (!currentRepo) return;

        const confirm = await vscode.window.showWarningMessage(
            `Disconnect from repository '${currentRepo.name}'?`,
            { modal: true },
            'Disconnect'
        );

        if (confirm === 'Disconnect') {
            await this.githubManager.disconnectRepository();
            vscode.window.showInformationMessage('Repository disconnected');
        }
    }

    /**
     * Check if repository exists in user's account
     */
    private async checkRepositoryExists(name: string): Promise<boolean> {
        try {
            const repositories = await this.githubManager.listRepositories();
            return repositories.some(repo => repo.name.toLowerCase() === name.toLowerCase());
        } catch (error) {
            // If we can't check, assume it doesn't exist to allow creation
            return false;
        }
    }

    /**
     * Show license selection dialog
     */
    private async selectLicense(): Promise<string | undefined> {
        const licenseOptions = [
            {
                label: "lGPL-3.0 License",
                description: 'Lesser General Public License',
                detail: 'Allows Modules written against your System to be whatever License they choose, but requires modifications to your System to be open source',
                value: 'lgpl-3.0'
            },
            {
                label: 'MIT License',
                description: 'Permissive license',
                detail: 'Short and simple permissive license with conditions only requiring preservation of copyright and license notices',
                value: 'mit'
            },
            {
                label: 'The Unlicense',
                description: 'Public domain',
                detail: 'Releases your work into the public domain with no restrictions',
                value: 'unlicense'
            }
        ];

        const selection = await vscode.window.showQuickPick(licenseOptions, {
            title: 'Select License',
            placeHolder: 'Choose a license for your repository',
            ignoreFocusOut: true
        });

        return selection?.value;
    }

    /**
     * Create repository with enhanced options
     */
    private async createRepositoryWithOptions(options: {
        name: string;
        description: string;
        isPrivate: boolean;
        includeReadme: boolean;
        includeLicense?: string;
        includeGitignore: boolean;
        initializeWithSystemFiles: boolean;
    }): Promise<GitHubRepository | undefined> {
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating repository ${options.name}...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Creating repository...', increment: 25 });

                // Create the repository with license
                const repository = await this.githubManager.createRepository(
                    options.name, 
                    options.description, 
                    options.isPrivate,
                    options.includeLicense
                );

                if (!repository) return undefined;

                progress.report({ message: 'Setting up repository features...', increment: 25 });

                // Add topics for better discoverability
                const topics = ['foundry-vtt', 'foundryvtt', 'isdl', 'tabletop-rpg', 'game-system'];
                await this.githubManager.addRepositoryTopics(repository, topics);

                progress.report({ message: 'Initializing main branch...', increment: 25 });

                // Initialize the main branch using Git Data API
                await this.githubManager.initializeMainBranch(repository);

                progress.report({ message: 'Adding initial files...', increment: 25 });

                // Now add additional files if requested
                if (options.includeReadme) {
                    const readmeContent = this.generateReadmeContent(repository, options.description);
                    await this.githubManager.createFile(
                        repository,
                        'README.md',
                        readmeContent,
                        'Add initial README'
                    );
                }

                // Initialize with system files if requested
                if (options.initializeWithSystemFiles) {
                    await this.initializeWithSystemFiles(repository);
                }

                return repository;

            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to create repository: ${error.message}`);
                return undefined;
            }
        });
    }


    /**
     * Generate comprehensive README content
     */
    private generateReadmeContent(repository: GitHubRepository, description: string): string {
        return `# ${repository.name}

${description}

[![Foundry VTT](https://img.shields.io/badge/Foundry-v12-informational?logo=foundryvirtualtabletop)](https://foundryvtt.com/)
[![License](https://img.shields.io/github/license/${repository.full_name})](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/${repository.full_name})](https://github.com/${repository.full_name}/releases)

## 🎲 About

This is a **Foundry Virtual Tabletop** system built using **ISDL** (Intelligent System Design Language). ISDL allows for rapid development of complex tabletop RPG systems with modern, reactive character sheets and comprehensive game mechanics.

## 📦 Installation

### Automatic Installation (Recommended)
1. Open Foundry VTT
2. Go to the **"Game Systems"** tab
3. Click **"Install System"**
4. Enter this manifest URL:
   \`\`\`
   https://github.com/${repository.full_name}/releases/latest/download/system.json
   \`\`\`
5. Click **"Install"**

### Manual Installation
1. Download the latest release from [Releases](https://github.com/${repository.full_name}/releases)
2. Extract the contents to your Foundry \`Data/systems/${repository.name}\` folder
3. Restart Foundry VTT

## 🚀 Features

- **🎨 Modern UI**: Responsive Vue.js components with Vuetify Material Design
- **⚡ Reactive Sheets**: Real-time updates and smooth interactions
- **🔧 Highly Configurable**: Extensive customization options for different playstyles
- **📱 Mobile Friendly**: Optimized for both desktop and tablet play
- **🎯 Dice Integration**: Advanced dice rolling with custom formulas
- **👥 Actor Management**: Comprehensive character, NPC, and creature support
- **📋 Item System**: Flexible items with custom properties and actions
- **🎭 Active Effects**: Dynamic character modifications and status tracking
- **🎪 Automation**: Built-in automation for common tasks and calculations

## 🛠️ Development

This system was created using the ISDL VS Code extension. To modify or contribute:

### Prerequisites
- [VS Code](https://code.visualstudio.com/)
- [ISDL Extension](https://marketplace.visualstudio.com/items?itemName=IronMooseDevelopment.fsdl)
- [Node.js](https://nodejs.org/) (v18+)
- [Foundry VTT](https://foundryvtt.com/) (v12-v13)

### Setup
\`\`\`bash
# Clone the repository
git clone https://github.com/${repository.full_name}.git
cd ${repository.name}

# Install dependencies (if any)
npm install

# Open in VS Code
code .
\`\`\`

### Making Changes
1. Open the \`.isdl\` files in VS Code
2. Make your modifications using ISDL syntax
3. Run **"ISDL: Generate System"** command (\`Ctrl+Shift+P\`)
4. Test changes in Foundry VTT
5. Create a pull request with your improvements


## 📁 Project Structure

\`\`\`
${repository.name}/
├── system.json          # System manifest
├── template.json        # Data templates
├── *.isdl              # Source ISDL files
├── scripts/            # Generated JavaScript
├── styles/             # Generated CSS
├── templates/          # Handlebars templates
├── lang/              # Localization files
└── assets/            # Images and media
\`\`\`


## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **🐛 Report Bugs**: Use the [issue tracker](https://github.com/${repository.full_name}/issues)
2. **💡 Suggest Features**: Share your ideas for improvements
3. **📝 Improve Documentation**: Help make our docs clearer
4. **🔧 Submit Code**: Fork, modify, and create pull requests
5. **🌍 Translate**: Help localize the system

### Development Guidelines
- Follow ISDL best practices
- Test thoroughly before submitting
- Update documentation as needed
- Use descriptive commit messages

## 📜 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.

## 🆘 Support

### Getting Help
- **📖 Documentation**: Check the [Wiki](https://github.com/${repository.full_name}/wiki)
- **💬 Community**: Join our [Discord](https://discord.gg/foundryvtt)
- **🐛 Issues**: Report bugs on [GitHub Issues](https://github.com/${repository.full_name}/issues)
- **❓ Questions**: Use [GitHub Discussions](https://github.com/${repository.full_name}/discussions)

---

**Built with ❤️ using [ISDL](https://marketplace.visualstudio.com/items?itemName=IronMooseDevelopment.fsdl)**

*Ready to create your own ISDL system? [Get started here!](https://github.com/IronMooseDevelopment/isdl-docs)*
`;
    }

    /**
     * Initialize repository with current system files
     */
    private async initializeWithSystemFiles(repository: GitHubRepository): Promise<void> {
        // Check if we have generated system files
        const config = vscode.workspace.getConfiguration('fsdl');
        const lastSelectedFolder: string | undefined = config.get('lastSelectedFolder');
        
        if (!lastSelectedFolder) {
            vscode.window.showWarningMessage(
                'No generated system files found. Generate your system first to upload files.',
                'Generate System'
            ).then(action => {
                if (action === 'Generate System') {
                    vscode.commands.executeCommand('fsdl.generate');
                }
            });
            return;
        }

        // Check if folder exists
        if (!fs.existsSync(lastSelectedFolder)) {
            vscode.window.showErrorMessage(`System files folder not found: ${lastSelectedFolder}`);
            return;
        }

        try {
            // Select which .isdl file to use if multiple exist
            const selectedFile = await this.selectIsdlFile();
            if (!selectedFile) {
                return;
            }

            // Collect system files from the folder
            const services = createIntelligentSystemDesignLanguageServices(NodeFileSystem).IntelligentSystemDesignLanguage;
            const model = await extractAstNode<Entry>(selectedFile, services);
            const id = model.config.body.find(x => x.type == "id")!.value;
            const systemFiles = await this.collectSystemFiles(`${lastSelectedFolder}/${id}`);
            
            // Add the source ISDL file to the repository
            try {
                const isdlContent = fs.readFileSync(selectedFile, 'utf8');
                const isdlFileName = path.basename(selectedFile);
                systemFiles.push({
                    path: isdlFileName,
                    content: isdlContent
                });
                console.log(`📝 Added source ISDL file: ${isdlFileName}`);
            } catch (error) {
                console.warn(`Failed to read ISDL file ${selectedFile}:`, error);
            }
            
            if (systemFiles.length === 0) {
                vscode.window.showWarningMessage('No system files found in the selected folder.');
                return;
            }

            // Upload files with progress tracking
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Uploading ${systemFiles.length} system files...`,
                cancellable: false
            }, async (progress) => {
                let lastProgress = 0;
                
                const success = await this.githubManager.uploadFiles(
                    repository,
                    systemFiles,
                    `Add ${id} system files (${systemFiles.length} files)`,
                    (progressPercent, currentStep) => {
                        const increment = progressPercent - lastProgress;
                        lastProgress = progressPercent;
                        
                        progress.report({
                            message: currentStep,
                            increment: increment
                        });
                    }
                );

                if (success) {
                    // Always ensure workflow file exists after uploading system files
                    progress.report({ message: 'Adding GitHub workflow...', increment: 10 });
                    await this.githubManager.ensureWorkflowFile(repository);
                    
                    vscode.window.showInformationMessage(
                        `Successfully uploaded ${systemFiles.length} system files to ${repository.name} in a single commit!`
                    );
                } else {
                    vscode.window.showWarningMessage('Failed to upload system files. Check the output for details.');
                }
            });

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to upload system files: ${error.message}`);
        }
    }

    /**
     * Collect all system files from the generated folder
     */
    private async collectSystemFiles(folderPath: string): Promise<{ path: string; content: string }[]> {
        const systemFiles: { path: string; content: string }[] = [];
        
        try {
            await this.collectFilesRecursively(folderPath, folderPath, systemFiles);
        } catch (error: any) {
            console.error('Error collecting system files:', error);
        }

        return systemFiles;
    }

    /**
     * Recursively collect files from directory
     */
    private async collectFilesRecursively(
        currentPath: string, 
        basePath: string, 
        files: { path: string; content: string }[]
    ): Promise<void> {
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
            'logs',
            '*.log'
        ];

        return skipDirs.some(pattern => {
            if (pattern.includes('*')) {
                return dirName.match(new RegExp(pattern.replace('*', '.*')));
            }
            return dirName === pattern;
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
            placeHolder: 'Choose which .isdl file to use for system generation',
            ignoreFocusOut: true
        });

        if (!selection) {
            return undefined;
        }

        return selection.uri.fsPath;
    }

    /**
     * Determine if a file should be skipped
     */
    private shouldSkipFile(fileName: string): boolean {
        const skipFiles = [
            '.DS_Store',
            'Thumbs.db',
            '*.log',
            '*.tmp',
            '*.temp',
            '.env',
            '.env.local',
            '.env.production',
            '*.key',
            '*.pem',
            '*.p12',
            '*.pfx'
        ];

        return skipFiles.some(pattern => {
            if (pattern.includes('*')) {
                return fileName.match(new RegExp(pattern.replace('*', '.*')));
            }
            return fileName === pattern;
        });
    }
}