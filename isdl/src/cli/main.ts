import type { Entry } from '../language/generated/ast.js';
import chalk from 'chalk';
import { Command } from 'commander';
import { IntelligentSystemDesignLanguageLanguageMetaData } from '../language/generated/module.js';
import { createIntelligentSystemDesignLanguageServices } from '../language/intelligent-system-design-language-module.js';
import { extractAstNode } from './cli-util.js';
import { generateJavaScript } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createLayoutServer, type LayoutServer } from '../layout-server.js';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

/**
 * Core parse-and-generate logic. Throws on failure instead of calling process.exit,
 * so it can be used both from generateAction (CLI) and the serve onSaved handler.
 */
async function generateCore(fileName: string, destination?: string): Promise<string> {
    const services = createIntelligentSystemDesignLanguageServices(NodeFileSystem).IntelligentSystemDesignLanguage;
    const model = await extractAstNode<Entry>(fileName, services);

    if (!model) {
        throw new Error('Failed to parse the ISDL file. The model is undefined.');
    }

    return generateJavaScript(model, fileName, destination);
}

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    try {
        const generatedFilePath = await generateCore(fileName, opts.destination);
        console.log(chalk.green(`Intelligent System generated successfully: ${generatedFilePath}`));
    } catch (error) {
        console.error(chalk.red('Error during generation:'));
        console.error(error);
        process.exit(1);
    }
};

export type GenerateOptions = {
    destination?: string;
}

export type ServeOptions = {
    port?: string;
    destination?: string;
}

export default function(): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = IntelligentSystemDesignLanguageLanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates a Foundry VTT system from an ISDL source file')
        .action(generateAction);

    program
        .command('serve')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-p, --port <port>', 'port to listen on', '3721')
        .option('-d, --destination <dir>', 'destination directory; if set, regenerates system on each layout save')
        .description('starts the Design Mode layout server (and optionally regenerates on save)')
        .action(async (fileName: string, opts: ServeOptions) => {
            const port = parseInt(opts.port ?? '3721', 10);
            const workspaceDir = path.dirname(path.resolve(fileName));
            const destination = opts.destination;

            let server: LayoutServer;
            try {
                server = await createLayoutServer({
                    port,
                    workspaceDir,
                    onSaved: async (id, layoutPath) => {
                        console.log(chalk.cyan(`Layout saved: ${layoutPath}`));
                        if (destination) {
                            console.log(chalk.gray(`  Regenerating ${path.basename(fileName)}...`));
                            try {
                                const outPath = await generateCore(fileName, destination);
                                console.log(chalk.green(`  Regenerated successfully: ${outPath}`));
                            } catch (err) {
                                console.error(chalk.red(`  Regeneration failed:`), err);
                            }
                        }
                    },
                });
            } catch (err) {
                console.error(chalk.red(`Failed to start layout server on port ${port}:`), err);
                process.exit(1);
            }

            console.log(chalk.green(`ISDL layout server running at http://127.0.0.1:${port}`));
            console.log(chalk.gray(`  Watching workspace: ${workspaceDir}`));
            if (destination) {
                console.log(chalk.gray(`  Auto-regenerate on save: ${chalk.white('enabled')} → ${destination}`));
            } else {
                console.log(chalk.gray(`  Auto-regenerate on save: ${chalk.white('disabled')} (pass -d to enable)`));
            }

            process.on('SIGINT', () => {
                server.stop();
                process.exit(0);
            });
        });

    program.parse(process.argv);
}
