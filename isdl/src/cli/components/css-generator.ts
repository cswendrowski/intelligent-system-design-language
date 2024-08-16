import type {
    Entry,
} from '../../language/generated/ast.js';
import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as sass from 'sass'
import { fileURLToPath } from 'url';

export function compileSCSS(dynamicId: string) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    console.log(__filename, __dirname);

    // Path to the SCSS file
    const scssFilePath = path.join(__dirname, '../../styles.scss');

    // Read the SCSS file content
    let scssContent = fs.readFileSync(scssFilePath, 'utf8');

    // Replace the placeholder with the dynamic ID
    scssContent = scssContent.replace(/\#\{\$dynamic-id\}/g, `${dynamicId}`);

    // Create a temporary file to hold the modified SCSS
    const tempScssFilePath = path.join(__dirname, 'temp-styles.scss');

    fs.writeFileSync(tempScssFilePath, scssContent);

    // Copy the _backgrounds.scss file to the same directory as the temp SCSS file
    const backgroundsFilePath = path.join(__dirname, '../../_backgrounds.scss');
    const tempBackgroundsFilePath = path.join(__dirname, '_backgrounds.scss');
    fs.copyFileSync(backgroundsFilePath, tempBackgroundsFilePath);

    // Compile SCSS to CSS
    const result = sass.compile(tempScssFilePath);

    return result.css.toString();
}

export function generateRpgAwesomeCss(destination: string) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Path to the SCSS file
    const scssFilePath = path.join(__dirname, '../../../node_modules/rpg-awesome/scss/rpg-awesome.scss');

    // Compile SCSS to CSS
    const result = sass.compile(scssFilePath);

    var css = result.css.toString();

    const generatedFileDir = path.join(destination, "css");
    const generatedFilePath = path.join(generatedFileDir, `rpg-awesome.css`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        ${css}
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

export function generateSystemCss(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "css");
    const generatedFilePath = path.join(generatedFileDir, `${id}.css`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        ${compileSCSS(id)}
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

export function generateCustomCss(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "css");
    const generatedFilePath = path.join(generatedFileDir, `${id}-custom.css`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    // If the file already exists, don't overwrite it
    if (fs.existsSync(generatedFilePath)) {
        return;
    }

    const fileNode = expandToNode`
        /* Custom CSS for ${id}. This file is empty by default and won't be overwritten by the generator. */
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
