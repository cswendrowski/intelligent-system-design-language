import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitHubGistManager, GitHubGist } from './githubGistManager.js';

export class GitHubGistActions {
    constructor(private gistManager: GitHubGistManager) {}

    /**
     * Select a gist from user's existing gists
     */
    async selectGist(): Promise<void> {
        const gists = await this.gistManager.listGists();

        if (gists.length === 0) {
            const action = await vscode.window.showInformationMessage(
                'No ISDL gists found in your GitHub account.',
                'Create Gist',
                'Cancel'
            );

            if (action === 'Create Gist') {
                await this.createGist();
            }
            return;
        }

        // Create quick pick items
        const items: (vscode.QuickPickItem & { gist?: GitHubGist })[] = [
            {
                label: '$(gist-new) Create New Gist',
                description: 'Create a new gist for your ISDL file',
                alwaysShow: true
            },
            {
                label: '',
                kind: vscode.QuickPickItemKind.Separator
            }
        ];

        // Add existing gists
        gists.forEach(gist => {
            const isdlFiles = Object.keys(gist.files).filter(name => 
                name.endsWith('.isdl') || name.endsWith('.fsdl')
            );
            
            items.push({
                label: `$(gist) ${gist.description}`,
                description: gist.public ? '$(unlock) Public' : '$(lock) Private',
                detail: `${isdlFiles.join(', ')} • Updated ${new Date(gist.updated_at).toLocaleDateString()}`,
                gist
            });
        });

        const selection = await vscode.window.showQuickPick(items, {
            title: 'Select GitHub Gist',
            placeHolder: 'Choose a gist for your ISDL files',
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: true
        });

        if (!selection) return;

        if (selection.label.includes('Create New Gist')) {
            await this.createGist();
        } else if (selection.gist) {
            this.gistManager.setCurrentGist(selection.gist);
            vscode.window.showInformationMessage(
                `Connected to gist: ${selection.gist.description}`
            );
        }
    }

    /**
     * Create a new gist
     */
    async createGist(): Promise<void> {
        // Select ISDL file
        const isdlFile = await this.selectIsdlFile();
        if (!isdlFile) return;

        // Get description
        const defaultDescription = `ISDL System: ${path.basename(isdlFile, path.extname(isdlFile))}`;
        const description = await vscode.window.showInputBox({
            title: 'Create Gist - Step 1 of 2',
            prompt: 'Gist description',
            value: defaultDescription,
            placeHolder: 'Describe your ISDL system'
        });

        if (!description) return;

        // Get visibility
        const visibility = await vscode.window.showQuickPick([
            {
                label: '$(unlock) Public',
                description: 'Anyone can see this gist',
                detail: 'Good for sharing with the community',
                picked: false
            },
            {
                label: '$(lock) Secret',
                description: 'Only people with the link can see this gist',
                detail: 'Good for private development or sharing with specific people',
                picked: true
            }
        ], {
            title: 'Create Gist - Step 2 of 2',
            placeHolder: 'Choose gist visibility'
        });

        if (!visibility) return;
        const isPublic = visibility.label.includes('Public');

        // Create gist with progress
        const gist = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating gist...',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Uploading ISDL file...', increment: 50 });
            
            const result = await this.gistManager.createGist(description, isPublic, isdlFile);
            
            progress.report({ message: 'Gist created!', increment: 50 });
            return result;
        });

        if (gist) {
            vscode.window.showInformationMessage(
                `Gist created successfully: ${gist.description}`,
                'Open in GitHub',
                'Sync Now'
            ).then(action => {
                if (action === 'Open in GitHub') {
                    vscode.env.openExternal(vscode.Uri.parse(gist.html_url));
                } else if (action === 'Sync Now') {
                    this.syncToGist();
                }
            });
        }
    }

    /**
     * Sync current ISDL file to the selected gist
     */
    async syncToGist(): Promise<void> {
        const currentGist = this.gistManager.getCurrentGist();
        
        if (!currentGist) {
            const action = await vscode.window.showInformationMessage(
                'No gist connected. Please select a gist first.',
                'Select Gist',
                'Create Gist'
            );

            if (action === 'Select Gist') {
                await this.selectGist();
            } else if (action === 'Create Gist') {
                await this.createGist();
            }
            return;
        }

        // Select ISDL file to sync
        const isdlFile = await this.selectIsdlFile();
        if (!isdlFile) return;

        // Sync with progress
        const success = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Syncing to gist: ${currentGist.description}`,
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Uploading file...', increment: 50 });
            
            const result = await this.gistManager.updateGist(currentGist.id, isdlFile);
            
            progress.report({ message: 'Sync complete!', increment: 50 });
            return result;
        });

        if (success) {
            vscode.window.showInformationMessage(
                `ISDL file synced to gist successfully!`,
                'Open in GitHub'
            ).then(action => {
                if (action === 'Open in GitHub') {
                    vscode.env.openExternal(vscode.Uri.parse(currentGist.html_url));
                }
            });
        }
    }

    /**
     * Download ISDL file from the selected gist
     */
    async downloadFromGist(): Promise<void> {
        const currentGist = this.gistManager.getCurrentGist();
        
        if (!currentGist) {
            vscode.window.showWarningMessage('No gist connected. Please select a gist first.');
            return;
        }

        // Download with progress
        const fileData = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Downloading from gist: ${currentGist.description}`,
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Downloading file...', increment: 50 });
            
            const result = await this.gistManager.downloadFromGist(currentGist.id);
            
            progress.report({ message: 'Download complete!', increment: 50 });
            return result;
        });

        if (!fileData) return;

        // Ask where to save
        const saveLocation = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                fileData.filename
            )),
            filters: {
                'ISDL Files': ['isdl', 'fsdl']
            }
        });

        if (!saveLocation) return;

        // Save file
        try {
            fs.writeFileSync(saveLocation.fsPath, fileData.content, 'utf8');
            
            const action = await vscode.window.showInformationMessage(
                `ISDL file downloaded: ${path.basename(saveLocation.fsPath)}`,
                'Open File'
            );

            if (action === 'Open File') {
                const document = await vscode.workspace.openTextDocument(saveLocation);
                await vscode.window.showTextDocument(document);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to save file: ${error.message}`);
        }
    }

    /**
     * Disconnect from current gist
     */
    async disconnectGist(): Promise<void> {
        const currentGist = this.gistManager.getCurrentGist();
        if (!currentGist) return;

        const confirm = await vscode.window.showWarningMessage(
            `Disconnect from gist: ${currentGist.description}?`,
            { modal: true },
            'Disconnect'
        );

        if (confirm === 'Disconnect') {
            this.gistManager.disconnectGist();
            vscode.window.showInformationMessage('Gist disconnected');
        }
    }

    /**
     * Select an ISDL file from the workspace
     */
    private async selectIsdlFile(): Promise<string | undefined> {
        // Find all ISDL files in the workspace
        const isdlFiles = await vscode.workspace.findFiles('**/*.{isdl,fsdl}');
        
        if (isdlFiles.length === 0) {
            vscode.window.showErrorMessage('No ISDL files found in the workspace.');
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
            placeHolder: 'Choose which ISDL file to sync with the gist',
            ignoreFocusOut: true
        });

        if (!selection) {
            return undefined;
        }

        return selection.uri.fsPath;
    }
}