//@ts-check
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

const success = watch ? 'Watch build succeeded' : 'Build succeeded';

function getTime() {
    const date = new Date();
    return `[${`${padZeroes(date.getHours())}:${padZeroes(date.getMinutes())}:${padZeroes(date.getSeconds())}`}] `;
}

function padZeroes(i) {
    return i.toString().padStart(2, '0');
}

function copyPackageJson(outDir) {
    const src = path.resolve('package.json');
    const dest = path.join(outDir, 'extension/package.json');
    const dest2 = path.join(outDir, 'package.json');
    fs.copyFileSync(src, dest);
    fs.copyFileSync(src, dest2);
    console.log(getTime() + 'Copied package.json to output directory ' + dest);
}

function copyAssets(outDir) {
    // Copy GitHub workflow file
    const workflowSrc = path.resolve('src/extension/github/system-workflow.yml');
    const workflowDest = path.join(outDir, 'extension/github/system-workflow.yml');
    
    // Ensure the directory exists
    const workflowDir = path.dirname(workflowDest);
    if (!fs.existsSync(workflowDir)) {
        fs.mkdirSync(workflowDir, { recursive: true });
    }
    
    if (fs.existsSync(workflowSrc)) {
        fs.copyFileSync(workflowSrc, workflowDest);
        console.log(getTime() + 'Copied workflow file to output directory ' + workflowDest);
    }
}

function copyStyles(outDir) {
    // Copy main styles.scss
    const mainStylesSrc = path.resolve('src/styles.scss');
    const mainStylesDest = path.join(outDir, 'styles.scss');
    
    if (fs.existsSync(mainStylesSrc)) {
        fs.copyFileSync(mainStylesSrc, mainStylesDest);
        console.log(getTime() + 'Copied styles.scss to output directory ' + mainStylesDest);
    }
    
    // Copy SCSS partials
    const scssPartials = ['_backgrounds.scss', '_handlebars.scss', '_vuetifyOverrides.scss', '_vuetifyStyles.scss'];
    
    for (const partial of scssPartials) {
        const src = path.resolve('src', partial);
        const dest = path.join(outDir, partial);
        const clinDest = path.join(outDir, 'cli', 'components', partial);
        
        if (fs.existsSync(src)) {
            // Copy to main out directory
            fs.copyFileSync(src, dest);
            console.log(getTime() + `Copied ${partial} to output directory ` + dest);
            
            // Copy to cli/components directory (needed for CSS generation)
            const clinDir = path.dirname(clinDest);
            if (!fs.existsSync(clinDir)) {
                fs.mkdirSync(clinDir, { recursive: true });
            }
            fs.copyFileSync(src, clinDest);
            console.log(getTime() + `Copied ${partial} to CLI components directory ` + clinDest);
        }
    }
}

const plugins = [{
    name: 'watch-plugin',
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length === 0) {
                console.log(getTime() + success);
                copyPackageJson('out');
                copyAssets('out');
                copyStyles('out');
            }
        });
    },
}];

const ctx = await esbuild.context({
    // Entry points for the vscode extension and the language server
    entryPoints: ['src/extension/main.ts', 'src/language/main.ts'],
    outdir: 'out',
    bundle: true,
    target: "ES2017",
    // VSCode's extension host is still using cjs, so we need to transform the code
    format: 'cjs',
    // To prevent confusing node, we explicitly use the `.cjs` extension
    outExtension: {
        '.js': '.cjs'
    },
    loader: { '.ts': 'ts' },
    external: ['vscode'],
    platform: 'node',
    sourcemap: !minify,
    minify,
    plugins
});

if (watch) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    copyPackageJson('out');
    copyAssets('out');
    copyStyles('out');
    ctx.dispose();
}
