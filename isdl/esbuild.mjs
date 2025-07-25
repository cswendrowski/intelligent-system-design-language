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

const plugins = [{
    name: 'watch-plugin',
    setup(build) {
        build.onEnd(result => {
            if (result.errors.length === 0) {
                console.log(getTime() + success);
                copyPackageJson('out');
                copyAssets('out');
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
    ctx.dispose();
}
