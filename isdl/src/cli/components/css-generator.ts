import type {
    ConfigExpression,
    Entry,
    Property,
    Theme,
    ThemeParam,
} from '../../language/generated/ast.js';
import {
    isConfigExpression,
    isProperty,
    isTheme,
    isThemeParam,
    isThemeAccentParam,
    isThemeRadiusParam,
    isThemeSurfaceParam,
    isThemeTextParam,
    isThemeFontParam,
    isThemeBorderParam,
    isThemeHeadingFontParam,
} from '../../language/generated/ast.js';
import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as sass from 'sass'
import { fileURLToPath } from 'url';
import { globalGetAllOfType } from './utils.js';

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
    copyScssFile('../../_backgrounds.scss', '_backgrounds.scss');
    copyScssFile('../../_handlebars.scss', '_handlebars.scss');
    copyScssFile('../../_vuetifyOverrides.scss', '_vuetifyOverrides.scss');

    function copyScssFile(source: string, destination: string) {
        const filePath = path.join(__dirname, source);
        const tempFilePath = path.join(__dirname, destination);
        fs.copyFileSync(filePath, tempFilePath);
    }

    // Compile SCSS to CSS
    const result = sass.compile(tempScssFilePath);

    return result.css.toString();
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

// --- Declarative theme tokens ------------------------------------------------
// A single shared vocabulary (`ThemeParam`) drives both scopes:
//   - global `config { theme { ... } }`  -> defaults on the system root
//   - per-field `number HP(accent: ...)` -> override on that field's `.isdl-field-<name>` wrapper
// Both compile through the SAME token->CSS-custom-property mapping below; only the
// selector differs. Because they're custom properties, a per-field value cascades
// over the global default automatically (the wrapper carries both the type class --
// which consumes the var -- and the `.isdl-field-<name>` class that sets it).

// A `font:`/`headingFont:` value is used verbatim as a font-family list. If the
// author already wrote a stack ("'Special Elite', monospace") pass it through so the
// fallback survives; otherwise quote the single family so a name with a space stays
// one family when substituted into `font-family: var(--isdl-font)`.
function cssFontValue(value: string): string {
    return value.includes(',') ? value : `"${value}"`;
}

/** Map one theme token to its `--isdl-*` custom property declaration. */
function themeParamToCssVar(param: ThemeParam): string {
    if (isThemeAccentParam(param)) return `--isdl-accent: ${param.value};`;
    if (isThemeRadiusParam(param)) return `--isdl-radius: ${param.value}px;`;
    if (isThemeSurfaceParam(param)) return `--isdl-surface: ${param.value};`;
    if (isThemeTextParam(param)) return `--isdl-text: ${param.value};`;
    if (isThemeBorderParam(param)) return `--isdl-border: ${param.value};`;
    if (isThemeFontParam(param)) return `--isdl-font: ${cssFontValue(param.value)};`;
    if (isThemeHeadingFontParam(param)) return `--isdl-heading-font: ${cssFontValue(param.value)};`;
    return '';
}

function themeParamsToCss(params: ThemeParam[]): string {
    return params.map(themeParamToCssVar).filter(s => s.length > 0).join('\n  ');
}

export function generateThemeCss(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, 'css');
    const generatedFilePath = path.join(generatedFileDir, `${id}-theme.css`);
    const root = `.${id}.vue-application`;
    const blocks: string[] = [];

    // Global defaults from `config { theme { ... } }`.
    const theme = entry.config.body.find(x => isTheme(x)) as Theme | undefined;
    if (theme && theme.params.length > 0) {
        blocks.push(`${root} {\n  ${themeParamsToCss(theme.params)}\n}`);
    }

    // Per-field overrides: any field carrying theme tokens in its params.
    const fields = globalGetAllOfType<Property>(entry, isProperty);
    for (const field of fields) {
        const themeParams = ((field as any).params ?? []).filter(isThemeParam) as ThemeParam[];
        if (themeParams.length === 0) continue;
        blocks.push(`${root} .isdl-field-${field.name.toLowerCase()} {\n  ${themeParamsToCss(themeParams)}\n}`);
    }

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const header = `/* Generated theme tokens for ${id}. Regenerated each build -- do not edit; use config { theme { } } or per-field params. */`;
    fs.writeFileSync(generatedFilePath, `${header}\n${blocks.join('\n\n')}\n`);
}

// --- Sidecar SCSS ------------------------------------------------------------
// `config { styles = "veilrunner.scss" }` points at an author-authored stylesheet
// that lives next to the .isdl in source (version-controlled, travels with publish).
// We compile it through the same `sass` pass we already use and auto-scope it under
// the system root so a careless selector can't leak into other systems on the world.
// Returns true if a sidecar was declared + emitted (so system.json can list it).
export function compileSidecarScss(entry: Entry, id: string, sourceDir: string, destination: string): boolean {
    const stylesExpr = entry.config.body.find(
        x => isConfigExpression(x) && x.type === 'styles'
    ) as ConfigExpression | undefined;
    if (!stylesExpr) return false;

    const rel = stylesExpr.value;
    const absPath = path.resolve(sourceDir, rel);
    if (!fs.existsSync(absPath)) {
        // Fail loud, naming the file -- a silent miss here is the #100 bug class.
        throw new Error(
            `Sidecar stylesheet not found: "${rel}" (resolved to ${absPath}). ` +
            `Check the 'styles = ...' path in your config -- it is resolved relative to the .isdl file.`
        );
    }

    const authorScss = fs.readFileSync(absPath, 'utf8');
    // Wrap the SCSS *source* (not the compiled output) so SCSS nesting scopes every
    // author rule under the system root. `@use`/`@forward`/`@import` must live at the
    // top of the file (not inside a selector), so hoist those single-line statements
    // above the wrapper -- this is what lets a sidecar pull in web fonts.
    const hoistPattern = /^\s*@(use|forward|import)\b[^;]*;/;
    const head: string[] = [];
    const body: string[] = [];
    for (const line of authorScss.split(/\r?\n/)) {
        (hoistPattern.test(line) ? head : body).push(line);
    }
    const wrapped = `${head.join('\n')}\n.${id}.vue-application {\n${body.join('\n')}\n}`;

    let css: string;
    try {
        css = sass.compileString(wrapped, { loadPaths: [sourceDir] }).css.toString();
    } catch (e) {
        throw new Error(`Failed to compile sidecar stylesheet "${rel}": ${(e as Error).message}`);
    }

    const generatedFileDir = path.join(destination, 'css');
    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }
    fs.writeFileSync(path.join(generatedFileDir, `${id}-styles.css`), css);
    return true;
}
