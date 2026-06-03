import type { AstNode, LangiumCoreServices, LangiumDocument } from 'langium';
import chalk from 'chalk';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { URI } from 'langium';

export async function extractDocument(fileName: string, services: LangiumCoreServices): Promise<LangiumDocument> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(chalk.yellow(`Please choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} does not exist.`));
        process.exit(1);
    }

    const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
    await services.shared.workspace.DocumentBuilder.build([document], { validation: true });

    // An empty file is almost always an unsaved-editor mistake (VS Code auto-save is off by
    // default), which otherwise surfaces as a cryptic "Expecting token of type 'config'" error.
    if (document.textDocument.getText().trim().length === 0) {
        console.error(chalk.yellow(
            `${path.basename(fileName)} is empty. If you're editing it in an editor, make sure the file is saved to disk — `
            + `VS Code's auto-save is off by default. Every ISDL system starts with a 'config { ... }' block.`
        ));
        process.exit(1);
    }

    const validationErrors = (document.diagnostics ?? []).filter(e => e.severity === 1);
    if (validationErrors.length > 0) {
        console.error(chalk.red('There are validation errors:'));
        for (const validationError of validationErrors) {
            console.error(chalk.red(
                `line ${validationError.range.start.line + 1}: ${validationError.message} [${document.textDocument.getText(validationError.range)}]`
            ));
        }
        // The grammar requires `config` as the first token, so a missing/misplaced config block
        // produces an "Expecting token of type 'config'" parser error. Point the author at the fix.
        if (validationErrors.some(e => /Expecting token of type 'config'/.test(e.message))) {
            console.error(chalk.yellow(
                `\nHint: every ISDL system must begin with a 'config { ... }' block. If the file looks correct `
                + `in your editor, make sure it's saved to disk (VS Code auto-save is off by default).`
            ));
        }
        process.exit(1);
    }

    return document;
}

export async function extractAstNode<T extends AstNode>(fileName: string, services: LangiumCoreServices): Promise<T> {
    return (await extractDocument(fileName, services)).parseResult?.value as T;
}

interface FilePathData {
    destination: string,
    name: string
}

export function extractDestinationAndName(filePath: string, destination: string | undefined): FilePathData {
    filePath = path.basename(filePath, path.extname(filePath)).replace(/[.-]/g, '');
    return {
        destination: destination ?? path.join(path.dirname(filePath), 'generated'),
        name: path.basename(filePath)
    };
}
