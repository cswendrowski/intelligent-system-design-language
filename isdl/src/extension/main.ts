import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node.js';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { spawn } from 'child_process';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';
import { IntelligentSystemDesignLanguageQuickfixes } from '../language/intelligent-system-design-language-quickfixes.js';
import { GitHubManager } from "./github/githubManager.js";
import { GitHubTreeProvider } from "./github/githubTreeProvider.js";
import { GitHubQuickActions } from "./github/githubQuickActions.js";

let client: LanguageClient;

// This function is called when the extension is activated.
export function activate(context: vscode.ExtensionContext): void {
    registerCommands(context);
    registerFormatter(context);
    registerCodeActions(context);
    registerGithub(context);
    client = startLanguageClient(context);
}

// This function is called when the extension is deactivated.
export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

function registerCommands(context: vscode.ExtensionContext) {

    function generate(sourceFilePath: string, destinationPath: string) {

        vscode.window.showInformationMessage('Generating Intelligent System Design Language code');

        // Define the path to the CLI script
        vscode.window.showInformationMessage(context.extensionPath);
        const cliPath = path.resolve(context.extensionPath, 'bin', 'cli.js');

        // Spawn a new process to run the CLI script with the provided parameters
        vscode.window.showInformationMessage(`node ${cliPath} generate "${sourceFilePath}" --destination "${destinationPath}"`);
        const cliProcess = spawn('node', [cliPath, 'generate', `"${sourceFilePath}"`, '--destination', `"${destinationPath}"`], {
            cwd: context.extensionPath,
            shell: true
        });

        cliProcess.stdout.on('data', (data) => {
            //vscode.window.showInformationMessage(`CLI Output: ${data}`);
        });

        cliProcess.stderr.on('data', (data) => {
            vscode.window.showErrorMessage(`CLI Error: ${data}`);
        });

        cliProcess.on('close', (code) => {
            vscode.window.showInformationMessage(`CLI process exited with code ${code}`);
        });

        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage('Generation complete!');
    }

    // Register a command that can be invoked with a keybinding, a menu item, or by running a command.
    context.subscriptions.push(vscode.commands.registerCommand('fsdl.generate', async () => {

        // Get list of files in the current workspace
        const files = await vscode.workspace.findFiles('**/*.fsdl');

        // Add .isdl files
        const isdlFiles = await vscode.workspace.findFiles('**/*.isdl');
        files.push(...isdlFiles);

        if (!files || files.length === 0) {
            vscode.window.showErrorMessage('No files found in the workspace');
            return;
        }

        // Get the configuration
        const config = vscode.workspace.getConfiguration('fsdl');
        const lastSelectedFile: string | undefined = config.get('lastSelectedFile');

        // Create a quick pick for selecting a file
        const fileItems = files.map(file => {
            return {
                label: path.basename(file.fsPath),
                description: file.fsPath,
                picked: file.fsPath === lastSelectedFile
            };
        });

        const selectedFile = await vscode.window.showQuickPick(fileItems, {
            placeHolder: 'Select a file to process',
            canPickMany: false,
        });

        if (!selectedFile) {
            vscode.window.showErrorMessage('File selection is required');
            return;
        }
        config.update('lastSelectedFile', selectedFile.description, vscode.ConfigurationTarget.Global);

        const sourceFilePath = selectedFile.description;

        // Prompt the user to select the destination folder
        const lastSelectedFolder: string | undefined = config.get('lastSelectedFolder');

        const destinationFolderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Destination Folder',
            defaultUri: lastSelectedFolder ? vscode.Uri.file(lastSelectedFolder) : undefined
        });

        if (!destinationFolderUri || destinationFolderUri.length === 0) {
            vscode.window.showErrorMessage('Destination folder selection is required');
            return;
        }

        const destinationPath = destinationFolderUri[0].fsPath;
        config.update('lastSelectedFolder', destinationPath, vscode.ConfigurationTarget.Workspace);

        generate(sourceFilePath, destinationPath);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('fsdl.regenerate', async () => {
        const config = vscode.workspace.getConfiguration('fsdl');
        const lastSelectedFile: string | undefined = config.get('lastSelectedFile');
        const lastSelectedFolder: string | undefined = config.get('lastSelectedFolder');

        if (!lastSelectedFile || !lastSelectedFolder) {
            vscode.window.showErrorMessage('No file selected for regeneration. Run the "Generate" command first.');
            return;
        }

        generate(lastSelectedFile, lastSelectedFolder);
    }));
}

function startLanguageClient(context: vscode.ExtensionContext): LanguageClient {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging.
    // By setting `process.env.DEBUG_BREAK` to a truthy value, the language server will wait until a debugger is attached.
    const debugOptions = { execArgv: ['--nolazy', `--inspect${process.env.DEBUG_BREAK ? '-brk' : ''}=${process.env.DEBUG_SOCKET || '6009'}`] };

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'intelligent-system-design-language' }]
    };

    // Create the language client and start the client.
    const client = new LanguageClient(
        'intelligent-system-design-language',
        'Intelligent System Design Language',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    client.start();
    return client;
}

function registerFormatter(context: vscode.ExtensionContext) {
    let disposable = vscode.languages.registerDocumentFormattingEditProvider('intelligent-system-design-language', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            const textEdits: vscode.TextEdit[] = [];
            const indentation = '    '; // Four spaces for indentation
            let indentLevel = 0;

            for (let i = 0; i < document.lineCount; i++) {
                try {
                    const line = document.lineAt(i);
                    const trimmedLine = line.text.trim();
                    // console.log(`Line ${i}: ${trimmedLine}`);

                    if (trimmedLine.includes('{') && trimmedLine.includes('}')) {
                        // Split the line into 3 parts: before {, between { and }, and after }
                        // const parts = trimmedLine.split('{');
                        // const before = parts[0];
                        // const between = parts[1].split('}')[0];
                        // const after = parts[1].split('}')[1];

                        // // Write the before part
                        // const beforeText = indentation.repeat(indentLevel) + before;
                        // textEdits.push(vscode.TextEdit.replace(line.range, beforeText));

                        // // Indent and write the between part
                        // indentLevel++;
                        // const betweenText = indentation.repeat(indentLevel) + between;
                        // textEdits.push(vscode.TextEdit.insert(new vscode.Position(i + 1, 0), betweenText));

                        // // Decrease indent and write the after part
                        // indentLevel--;
                        // const afterText = indentation.repeat(indentLevel) + after;
                        // textEdits.push(vscode.TextEdit.insert(new vscode.Position(i + 2, 0), afterText));

                        const newText = indentation.repeat(indentLevel) + trimmedLine;
                        if (newText !== line.text) {
                            textEdits.push(vscode.TextEdit.replace(line.range, newText));
                        }
                        continue;
                    }

                    if (trimmedLine.endsWith('}') ||trimmedLine.startsWith('}')) {
                        if (indentLevel > 0) indentLevel--;
                        // console.log(`Decreasing indent level. ${indentLevel}`);
                    }


                    const newText = indentation.repeat(indentLevel) + trimmedLine;
                    if (newText !== line.text) {
                        textEdits.push(vscode.TextEdit.replace(line.range, newText));
                    }

                    if (trimmedLine.endsWith('{') || trimmedLine.startsWith('{')) {
                        indentLevel++;
                        // console.log(`Increasing indent level. ${indentLevel}`);
                    }
                } catch (e) {
                    console.error(e);
                }
            }

            return textEdits;
        }
    });

    context.subscriptions.push(disposable);
}

function registerCodeActions(context: vscode.ExtensionContext) {
    vscode.languages.registerCodeActionsProvider('intelligent-system-design-language', new IntelligentSystemDesignLanguageQuickfixes(), {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    });
}

function registerGithub(context: vscode.ExtensionContext) {
    // Initialize GitHub components
    const githubManager = new GitHubManager(context);
    const treeProvider = new GitHubTreeProvider(githubManager);
    const quickActions = new GitHubQuickActions(githubManager);

    // Register tree view
    const treeView = vscode.window.createTreeView('fsdl.github', {
        treeDataProvider: treeProvider,
        showCollapseAll: false
    });

    // Register simplified commands
    const commands = [
        vscode.commands.registerCommand('isdl.github.authenticate', async () => {
            await githubManager.authenticate();
        }),
        vscode.commands.registerCommand('isdl.github.signOut', async () => {
            await githubManager.signOut();
        }),
        vscode.commands.registerCommand('isdl.github.selectRepository', async () => {
            await quickActions.selectRepository();
        }),
        vscode.commands.registerCommand('isdl.github.createRepository', async () => {
            await quickActions.createRepository();
        }),
        vscode.commands.registerCommand('isdl.github.disconnectRepository', async () => {
            await quickActions.disconnectRepository();
        }),
        vscode.commands.registerCommand('isdl.github.publish', async () => {
            await quickActions.publishSystem();
        }),
        vscode.commands.registerCommand('isdl.github.refresh', () => {
            treeProvider.refresh();
        }),
        vscode.commands.registerCommand('isdl.github.openProfile', (username: string) => {
            if (username) {
                vscode.env.openExternal(vscode.Uri.parse(`https://github.com/${username}`));
            }
        })
    ];

    // Add to context subscriptions
    context.subscriptions.push(treeView, ...commands);

    updateWorkspaceContext();

    // Watch for ISDL files to update context
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.isdl');
    fileWatcher.onDidCreate(updateWorkspaceContext);
    fileWatcher.onDidDelete(updateWorkspaceContext);
    context.subscriptions.push(fileWatcher);
}

/**
 * Update workspace context for when clauses
 */
async function updateWorkspaceContext() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        await vscode.commands.executeCommand('setContext', 'fsdl.workspaceHasIsdlFiles', false);
        return;
    }

    // Check if workspace has ISDL files
    const isdlFiles = await vscode.workspace.findFiles('**/*.isdl', null, 1);
    const hasIsdlFiles = isdlFiles.length > 0;

    await vscode.commands.executeCommand('setContext', 'fsdl.workspaceHasIsdlFiles', hasIsdlFiles);
}

