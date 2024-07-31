import type { LanguageClientOptions, ServerOptions} from 'vscode-languageclient/node.js';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { spawn } from 'child_process';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';

let client: LanguageClient;

// This function is called when the extension is activated.
export function activate(context: vscode.ExtensionContext): void {
    registerCommands(context);
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
    // Register a command that can be invoked with a keybinding, a menu item, or by running a command.
    let generate = vscode.commands.registerCommand('fsdl.generate', async () => {

        // Get list of files in the current workspace
        const files = await vscode.workspace.findFiles('**/*.fsdl');

        if (!files || files.length === 0) {
            vscode.window.showErrorMessage('No files found in the workspace');
            return;
        }

        // Create a quick pick for selecting a file
        const fileItems = files.map(file => {
            return {
                label: path.basename(file.fsPath),
                description: file.fsPath
            };
        });

        const selectedFile = await vscode.window.showQuickPick(fileItems, {
            placeHolder: 'Select a file to process',
            canPickMany: false
        });

        if (!selectedFile) {
            vscode.window.showErrorMessage('File selection is required');
            return;
        }

        const sourceFilePath = selectedFile.description;

        // Prompt the user to select the destination folder

        // Get the configuration
        const config = vscode.workspace.getConfiguration('fsdl');
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

        vscode.window.showInformationMessage('Generating Foundry System Design Language code');

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
            vscode.window.showInformationMessage(`CLI Output: ${data}`);
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
    });
    context.subscriptions.push(generate);
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
        documentSelector: [{ scheme: 'file', language: 'foundry-system-design-language' }]
    };

    // Create the language client and start the client.
    const client = new LanguageClient(
        'foundry-system-design-language',
        'Foundry System Design Language',
        serverOptions,
        clientOptions
    );

    // Start the client. This will also launch the server
    client.start();
    return client;
}
