import type {
    ConfigExpression,
    Entry,
    Property,
    Theme,
    ThemeFieldParam,
    ThemeBorderGroup,
    ThemeFontGroup,
    ThemeHeadingGroup,
    ThemeDisabledGroup,
    ThemeWidthGroup,
    ThemeHeightGroup,
} from '../../language/generated/ast.js';
import {
    isConfigExpression,
    isProperty,
    isTheme,
    isThemeFieldParam,
    isThemePrimaryParam,
    isThemeSecondaryParam,
    isThemeTertiaryParam,
    isThemeBackgroundParam,
    isThemeTextParam,
    isThemeBorderGroup,
    isThemeFontGroup,
    isThemeHeadingGroup,
    isThemeDisabledGroup,
    isThemeWidthGroup,
    isThemeHeightGroup,
    // shared, reusable group leaf props (the parent group decides the var prefix)
    isThemeColorProp,
    isThemeSizeProp,
    isThemeWidthProp,
    isThemeRadiusProp,
    isThemeFamilyProp,
    isThemeFontFaceProp,
    isThemeTransformProp,
    isThemeMinProp,
    isThemeMaxProp,
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
// ONE vocabulary, two scopes (same grouped syntax, served by the same code):
//   - global `config { theme { ... } }`       -> defaults on the system root.
//   - per-field `attribute Luck(theme: { ... })` -> override on that field's
//     `.isdl-field-<name>` wrapper. A per-field value cascades over the global default
//     for free (the wrapper carries both the type class that reads the var and the
//     `.isdl-field-<name>` class that sets it).
// Both call `themeBlockToCss`, which takes anything with a `params` list (the global
// `Theme` node or the per-field `ThemeFieldParam` block).

// A font value is used verbatim as a font-family list. If the author already wrote a
// stack ("'Special Elite', monospace") pass it through so the fallback survives; otherwise
// quote the single family so a name with a space stays one family in `font-family: var(...)`.
function cssFontValue(value: string): string {
    return value.includes(',') ? value : `"${value}"`;
}

// A size-like value is either a PX literal (string `"42px"`, used verbatim) or a bare
// number (px appended). Lets authors write `radius: 6` or `width { min: 50px }`.
function dim(value: number | string): string {
    return typeof value === 'number' ? `${value}px` : value;
}

/** Map one flat palette leaf to its `--isdl-*` decl. */
function paletteLeafToCss(param: { $type: string }): string {
    if (isThemePrimaryParam(param)) return `--isdl-primary: ${param.value};`;
    if (isThemeSecondaryParam(param)) return `--isdl-secondary: ${param.value};`;
    if (isThemeTertiaryParam(param)) return `--isdl-tertiary: ${param.value};`;
    if (isThemeBackgroundParam(param)) return `--isdl-background: ${param.value};`;
    if (isThemeTextParam(param)) return `--isdl-text: ${param.value};`;
    return '';
}

// Expand a grouped component block into its `--isdl-*` declarations. The props are the
// SHARED leaf rules (color/size/width/...), so each group maps the same prop type to its
// own var prefix (border `color` -> --isdl-border, heading `color` -> --isdl-heading-color).
function borderGroupToCss(g: ThemeBorderGroup): string[] {
    return g.props.map(p => {
        if (isThemeColorProp(p)) return `--isdl-border: ${p.value};`;
        if (isThemeWidthProp(p)) return `--isdl-border-width: ${dim(p.value)};`;
        if (isThemeRadiusProp(p)) return `--isdl-radius: ${dim(p.value)};`;
        return '';
    }).filter(s => s.length > 0);
}
function fontGroupToCss(g: ThemeFontGroup): string[] {
    return g.props.map(p => {
        if (isThemeFamilyProp(p)) return `--isdl-font: ${cssFontValue(p.value)};`;
        if (isThemeSizeProp(p)) return `--isdl-font-size: ${dim(p.value)};`;
        return '';
    }).filter(s => s.length > 0);
}
function headingGroupToCss(g: ThemeHeadingGroup): string[] {
    return g.props.map(p => {
        if (isThemeColorProp(p)) return `--isdl-heading-color: ${p.value};`;
        if (isThemeFontFaceProp(p)) return `--isdl-heading-font: ${cssFontValue(p.value)};`;
        if (isThemeSizeProp(p)) return `--isdl-heading-size: ${dim(p.value)};`;
        // `transform` is a CSS keyword (uppercase/none/...), not a quoted family.
        if (isThemeTransformProp(p)) return `--isdl-heading-transform: ${p.value};`;
        return '';
    }).filter(s => s.length > 0);
}
function disabledGroupToCss(g: ThemeDisabledGroup): string[] {
    return g.props.map(p => {
        if (isThemeColorProp(p)) return `--isdl-disabled-color: ${p.value};`;
        if (isThemeSizeProp(p)) return `--isdl-disabled-size: ${dim(p.value)};`;
        return '';
    }).filter(s => s.length > 0);
}
// NOTE: width/height are per-field-ONLY tokens (the validator rejects them in a global theme).
// They are NOT emitted as `--isdl-*` vars consumed on `.isdl-field` -- that loses to later
// per-type floors of equal specificity (e.g. `.isdl-tracker { min-width: 300px; max-width: 600px }`),
// so a themed `max` on a resource/tracker was silently dead. Instead `generateThemeCss` emits them
// as DIRECT `min/max-width` declarations on the per-field selector (`.<id>.vue-application
// .isdl-field-<name>`, specificity (0,3,0)), which outranks every per-type floor for all field
// types -- via the shared `themeWidthToInlineStyle`/`themeHeightToInlineStyle` helpers (which also
// carry the `max`-without-`min` -> `min-width: 0` rule needed to beat those floors).

// --- Inline layout-container theming ----------------------------------------
// row/column/section carry a `theme: { ... }` too, but they CANNOT use the `--isdl-*`
// custom-property path: custom properties INHERIT, so a sized container would leak its
// min-width/etc. into every nested child. Instead we emit ACTUAL CSS declarations as an
// inline `style="..."` on the container element, which does not cascade to descendants.
// Scope rules (validated): row/column accept width/height only; section additionally
// accepts border, background, text.
function borderGroupToInlineStyle(g: ThemeBorderGroup): string[] {
    return g.props.map(p => {
        if (isThemeColorProp(p)) return `border-color: ${p.value}`;
        if (isThemeWidthProp(p)) return `border-width: ${dim(p.value)}; border-style: solid`;
        if (isThemeRadiusProp(p)) return `border-radius: ${dim(p.value)}`;
        return '';
    }).filter(s => s.length > 0);
}
function widthGroupToInlineStyle(g: ThemeWidthGroup): string[] {
    const decls = g.props.map(p => {
        if (isThemeMinProp(p)) return `min-width: ${dim(p.value)}`;
        if (isThemeMaxProp(p)) return `max-width: ${dim(p.value)}`;
        return '';
    }).filter(s => s.length > 0);
    // A `max` with no explicit `min` is otherwise defeated by a hardcoded min-width floor
    // (e.g. `.v-col.section { min-width: 332px }`) and the flexbox `min-width: auto` content
    // floor -- min-width always beats max-width. Drop the floor to 0 so the author's max
    // actually constrains. An explicit `min` is left untouched (it's the author's floor).
    if (g.props.some(isThemeMaxProp) && !g.props.some(isThemeMinProp)) {
        decls.unshift('min-width: 0');
    }
    return decls;
}
function heightGroupToInlineStyle(g: ThemeHeightGroup): string[] {
    return g.props.map(p => {
        if (isThemeMinProp(p)) return `min-height: ${dim(p.value)}`;
        if (isThemeMaxProp(p)) return `max-height: ${dim(p.value)}`;
        return '';
    }).filter(s => s.length > 0);
}

// A container's themed style is split across DOM nodes by who actually owns the geometry:
//   - WIDTH governs the flex item that lays out in the row -> the container's own `v-col`
//     (for a section, the OUTER `v-col`, never the inner card, or the column can't shrink).
//   - HEIGHT + PAINT (border/bg/text) belong on the visible surface -> the section's inner
//     `v-card`; for a bare row/column there is no card, so they ride the element itself.
// Each function returns '' when nothing applies. Tokens invalid for a container are rejected
// by the validator before reaching here.

/** Width tokens only -- for the flex item (`v-col`/`v-row`) that owns layout width. */
export function themeWidthToInlineStyle(block: { params: any[] } | undefined): string {
    if (!block) return '';
    const decls: string[] = [];
    for (const p of block.params) {
        if (isThemeWidthGroup(p)) decls.push(...widthGroupToInlineStyle(p));
    }
    return decls.join('; ');
}

/** Height tokens only. */
export function themeHeightToInlineStyle(block: { params: any[] } | undefined): string {
    if (!block) return '';
    const decls: string[] = [];
    for (const p of block.params) {
        if (isThemeHeightGroup(p)) decls.push(...heightGroupToInlineStyle(p));
    }
    return decls.join('; ');
}

/** Paint tokens (border/background/text) -- section-only, for the inner `v-card` surface. */
export function themePaintToInlineStyle(block: { params: any[] } | undefined): string {
    if (!block) return '';
    const decls: string[] = [];
    for (const p of block.params) {
        if (isThemeBorderGroup(p)) decls.push(...borderGroupToInlineStyle(p));
        else if (isThemeBackgroundParam(p)) decls.push(`background-color: ${p.value}`);
        else if (isThemeTextParam(p)) decls.push(`color: ${p.value}`);
    }
    return decls.join('; ');
}

/** Width + height combined -- for a bare `row`/`column` (no inner card), applied to itself. */
export function themeSizingToInlineStyle(block: { params: any[] } | undefined): string {
    return [themeWidthToInlineStyle(block), themeHeightToInlineStyle(block)]
        .filter(s => s.length > 0).join('; ');
}

/** A theme body (global `Theme` or per-field `ThemeFieldParam`): palette flats + groups. */
function themeBlockToCss(block: { params: any[] }): string {
    const decls: string[] = [];
    for (const p of block.params) {
        if (isThemeBorderGroup(p)) decls.push(...borderGroupToCss(p));
        else if (isThemeFontGroup(p)) decls.push(...fontGroupToCss(p));
        else if (isThemeHeadingGroup(p)) decls.push(...headingGroupToCss(p));
        else if (isThemeDisabledGroup(p)) decls.push(...disabledGroupToCss(p));
        // width/height are NOT emitted here (see note above widthGroupToCss removal) -- they ride
        // direct min/max declarations on the per-field rule via generateThemeCss instead.
        else if (isThemeWidthGroup(p) || isThemeHeightGroup(p)) continue;
        else decls.push(paletteLeafToCss(p));
    }
    return decls.filter(s => s.length > 0).join('\n  ');
}

export function generateThemeCss(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, 'css');
    const generatedFilePath = path.join(generatedFileDir, `${id}-theme.css`);
    const root = `.${id}.vue-application`;
    const blocks: string[] = [];

    // Global defaults from `config { theme { ... } }`.
    const theme = entry.config.body.find(x => isTheme(x)) as Theme | undefined;
    if (theme && theme.params.length > 0) {
        const css = themeBlockToCss(theme);
        if (css.length > 0) blocks.push(`${root} {\n  ${css}\n}`);
    }

    // Per-field overrides: any field carrying a `theme: { ... }` param, emitted on the field's
    // `.isdl-field-<name>` wrapper. Palette/border/font/etc. ride `--isdl-*` vars (themeBlockToCss);
    // width/height ride DIRECT min/max declarations (themeWidth/HeightToInlineStyle) so they outrank
    // the per-type size floors (`.isdl-tracker` etc.) that a var on `.isdl-field` would lose to.
    const fields = globalGetAllOfType<Property>(entry, isProperty);
    for (const field of fields) {
        const themeBlock = ((field as any).params ?? []).find(isThemeFieldParam) as ThemeFieldParam | undefined;
        if (!themeBlock) continue;
        const varCss = themeBlockToCss(themeBlock);
        // Sizing must beat the base per-type floors, which compile DEEP-scoped -- e.g.
        // `.<id>.vue-application .window-content .v-application .isdl-tracker { min-width: 300px }`
        // is specificity (0,5,0), far above this per-field rule's (0,3,0). Rather than couple to
        // that scope depth, mark the explicit author sizing `!important` (the section path wins for
        // free via inline style; this is the rule-based equivalent). Palette/border ride `--isdl-*`
        // vars and don't fight on the same property, so they stay normal-weight.
        const sizing = [themeWidthToInlineStyle(themeBlock), themeHeightToInlineStyle(themeBlock)]
            .filter(s => s.length > 0).join('; ');
        const sizingImportant = sizing.split(';').map(s => s.trim()).filter(s => s.length > 0)
            .map(s => `${s} !important`).join('; ');
        const parts: string[] = [];
        if (varCss.length > 0) parts.push(varCss);
        if (sizingImportant.length > 0) parts.push(`${sizingImportant};`);
        if (parts.length === 0) continue;
        blocks.push(`${root} .isdl-field-${field.name.toLowerCase()} {\n  ${parts.join('\n  ')}\n}`);
    }

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const header = `/* Generated theme tokens for ${id}. Regenerated each build -- do not edit; use config { theme { } } or per-field params. */`;
    fs.writeFileSync(generatedFilePath, `${header}\n${blocks.join('\n\n')}\n`);
}

// --- Sidecar SCSS ------------------------------------------------------------
// Two author-authored stylesheets live next to the .isdl in source (version-controlled,
// travels with publish), each compiled through the same `sass` pass and AUTO-SCOPED so a
// careless selector can't leak into other systems on the world:
//   - `sheetStyles = "x.scss"`  -> scoped under `.<id>.vue-application` (the generated Vue
//     sheets only). For sheet atmosphere: grain, field tweaks, display type.
//   - `globalStyles = "y.scss"` -> scoped under `.<id>` (EVERY surface the system renders:
//     sheets, chat cards, dialogs, datatables, prompts — anything carrying the system class).
//     For styling chat cards and other non-sheet surfaces.
export interface SidecarResult { sheet: boolean; global: boolean; }

export function compileSidecarScss(entry: Entry, id: string, sourceDir: string, destination: string): SidecarResult {
    return {
        sheet: compileOneSidecar(entry, id, sourceDir, destination, 'sheetStyles', `.${id}.vue-application`, `${id}-sheet-styles.css`),
        global: compileOneSidecar(entry, id, sourceDir, destination, 'globalStyles', `.${id}`, `${id}-global-styles.css`),
    };
}

// Compile one sidecar stylesheet declared by `<configType> = "..."`, wrapping its source
// under `scopeSelector` and writing `<outFile>`. Returns true if the sidecar was declared.
function compileOneSidecar(
    entry: Entry, id: string, sourceDir: string, destination: string,
    configType: string, scopeSelector: string, outFile: string,
): boolean {
    const stylesExpr = entry.config.body.find(
        x => isConfigExpression(x) && x.type === configType
    ) as ConfigExpression | undefined;
    if (!stylesExpr) return false;

    const rel = stylesExpr.value;
    const absPath = path.resolve(sourceDir, rel);
    if (!fs.existsSync(absPath)) {
        // Fail loud, naming the file -- a silent miss here is the #100 bug class.
        throw new Error(
            `Sidecar stylesheet not found: "${rel}" (resolved to ${absPath}). ` +
            `Check the '${configType} = ...' path in your config -- it is resolved relative to the .isdl file.`
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
    const wrapped = `${head.join('\n')}\n${scopeSelector} {\n${body.join('\n')}\n}`;

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
    fs.writeFileSync(path.join(generatedFileDir, outFile), css);
    return true;
}
