import * as path from 'node:path';
import * as fs from 'node:fs';
import { Action, Document, DocumentArrayExp, Entry, isAction, isActor, isDocumentArrayExp, isPage, isPrompt, isVariableExpression, Prompt, VariableExpression } from "../../../language/generated/ast.js";
import { generateDocumentVueComponent } from "./vue-sheet-application-generator.js";
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { generateDocumentVueSheet } from './vue-sheet-class-generator.js';
import { build, defineConfig } from "vite";
import vue from '@vitejs/plugin-vue';
import { titleize } from 'inflection';
import { fileURLToPath } from 'node:url';
import vuetify from 'vite-plugin-vuetify';
import { generateBaseVueComponents } from './vue-base-components-generator.js';
import { generateVueMixin } from './vue-mixin.js';
import { getAllOfType } from '../utils.js';
import { generateDatatableVueSheet } from './vue-datatable-sheet-class-generator.js';
import { AstUtils } from 'langium';

export function generateVue(entry: Entry, id: string, destination: string) {

    // Clear the vue directory
    const vueDir = path.join(destination, "system", "templates", "vue");
    try {
        if (fs.existsSync(vueDir)) {
            fs.rmSync(vueDir, { recursive: true, force: true });
        }
    } catch (err) {
        console.error(`Error while deleting directory ${vueDir}:`, err);
    }

    copyVueBrowserJs(destination);
    copyVuetifyJs(destination);
    copyVuetifyCss(destination);
    copyMaterialDesign(destination);

    generateVueMixin(destination);
    generateIndexMjs(entry, destination);
    generateBaseVueComponents(destination);

    generateDatatableVueSheet(entry, id, destination);

    entry.documents.forEach(x => {
        generateDocumentVueSheet(entry, id, x, destination);
        generateDocumentVueComponent(entry, id, x, destination);
    });
}

export async function runViteBuild(destination: string) {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        const config = defineConfig({
            root: destination,
            plugins: [
                vue(),
                vuetify({ autoImport: true })
            ],
            optimizeDeps: {
                include: ["vuetify"]
            },
            resolve: {
                alias: {
                    vuetify: path.resolve(__dirname, "../../../../node_modules/vuetify"),
                    "datatables.net-vue3": path.resolve(__dirname, "../../../../node_modules/datatables.net-vue3"),
                    "datatables.net-dt": path.resolve(__dirname, "../../../../node_modules/datatables.net-dt"),
                    "datatables.net-responsive-dt": path.resolve(__dirname, "../../../../node_modules/datatables.net-responsive-dt"),
                    "datatables.net-buttons-dt": path.resolve(__dirname, "../../../../node_modules/datatables.net-buttons-dt"),
                    "datatables.net-colreorder-dt": path.resolve(__dirname, "../../../../node_modules/datatables.net-colreorder-dt"),
                    "datatables.net-rowreorder-dt": path.resolve(__dirname, "../../../../node_modules/datatables.net-rowreorder-dt"),
                    "datatables.net-buttons": path.resolve(__dirname, "../../../../node_modules/datatables.net-buttons"),
                }
            },
            build: {
                emptyOutDir: true, // Clears previous builds
                sourcemap: false, // Optional: Enable for debugging
                outDir: "./system/sheets/vue/components",
                lib: {
                    entry: "./system/templates/vue/index.mjs", // Entry point
                    name: "vueComponents",
                    fileName: "components.vue.es"
                },
                rollupOptions: {
                    external: ["vue"], // Keep Vue as an external dependency
                    output: {
                        globals: {
                            vue: "Vue"
                        },
                        // Map the external dependency to a local copy of Vue 3 esm.
                        paths: {
                            vue: "../../../../lib/vue.esm-browser.js"
                        },
                    }
                }
            }
        });
        process.env.DEBUG = '*';
        await build(config);
    }
    catch (e) {
        console.error(e);
    }
}

// function copyViteConfig(destination: string) {
//     const generatedFilePath = path.join(destination, "vite.config.js");

//     const fileNode = expandToNode`
//     import { defineConfig } from "vite";

//     export default defineConfig(async () => {
//         const vuePlugin = (await import(await import.meta.resolve("@vitejs/plugin-vue"))).default;
//         return {
//             plugins: [vuePlugin()]
//         };
//     });
//     `.appendNewLine();
    
//     fs.writeFileSync(generatedFilePath, toString(fileNode));
// }



function copyVueBrowserJs(description: string) {
    const generatedFilePath = path.join(description, "lib", "vue.esm-browser.js");

    copyFromNodeModules("vue/dist/vue.esm-browser.js", generatedFilePath);
}

function copyFromNodeModules(source: string, destination: string) {
    // Recursively create the directory if it doesn't exist
    const generatedFileDir = path.dirname(destination);
    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    // Copy the file from our extension's node_modules
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const sourceFilePath = path.join(__dirname, "..", "..", "..", "..", "node_modules", source);
    fs.copyFileSync(sourceFilePath, destination);
}

function copyVuetifyJs(description: string) {
    const generatedFilePath = path.join(description, "lib", "vuetify.esm.js");

    copyFile("../../../vuetify.esm.js", generatedFilePath);
}

function copyVuetifyCss(description: string) {
    const generatedFilePath = path.join(description, "css", "vuetify.min.css");

    copyFromNodeModules("vuetify/dist/vuetify-labs.min.css", generatedFilePath);
}

function copyFile(source: string, destination: string) {
    // Recursively create the directory if it doesn't exist
    const generatedFileDir = path.dirname(destination);
    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const sourceFilePath = path.join(__dirname, source);

    console.log(`Copying ${sourceFilePath} to ${destination}`);

    fs.copyFileSync(sourceFilePath, destination);
}

function copyMaterialDesign(destination: string) {
    // Copy Css
    copyFromNodeModules("@mdi/font/css/materialdesignicons.min.css", path.join(destination, "css", "materialdesignicons.min.css"));

    // Copy Fonts
    copyFromNodeModules("@mdi/font/fonts/materialdesignicons-webfont.eot", path.join(destination, "fonts", "materialdesignicons-webfont.eot"));
    copyFromNodeModules("@mdi/font/fonts/materialdesignicons-webfont.ttf", path.join(destination, "fonts", "materialdesignicons-webfont.ttf"));
    copyFromNodeModules("@mdi/font/fonts/materialdesignicons-webfont.woff", path.join(destination, "fonts", "materialdesignicons-webfont.woff"));
    copyFromNodeModules("@mdi/font/fonts/materialdesignicons-webfont.woff2", path.join(destination, "fonts", "materialdesignicons-webfont.woff2"));
}

function generateIndexMjs(entry: Entry, destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue");
    const generatedFilePath = path.join(generatedFileDir, "index.mjs");

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateExport(document: Document) {
        const type = isActor(document) ? 'actor' : 'item';
        return `export { default as ${document.name}${titleize(type)}App } from './${type}/${document.name.toLowerCase()}/${document.name.toLowerCase()}App.vue';`;
    }

    function generateDocumentPromptExports(document: Document): CompositeGeneratorNode | undefined {
        const actions = getAllOfType<Action>(document.body, isAction, false);
        return joinToNode(actions.map(x => generatePromptExports(x, document)).filter(x => x !== undefined).map(x => x as CompositeGeneratorNode), { appendNewLineIfNotEmpty: true });
    }

    function generatePromptExports(action: Action, document: Document): CompositeGeneratorNode | undefined {
        const type = isActor(document) ? 'actor' : 'item';
        const variables = action.method.body.filter(x => isVariableExpression(x)) as VariableExpression[];
        const prompts = variables.filter(x => isPrompt(x.value)).map(x => x.value) as Prompt[];
        
        return joinToNode(prompts.map(x => `export { default as ${document.name}${titleize(type)}${action.name}Prompt } from './${type}/${document.name.toLowerCase()}/components/prompts/${document.name.toLowerCase()}${action.name}Prompt.vue';`), { appendNewLineIfNotEmpty: true });
    }

    function generateDatatableExportForDocument(document: Document): CompositeGeneratorNode {

        function generateDatatableExport(datatable: DocumentArrayExp): CompositeGeneratorNode {
            const type = isActor(document) ? 'actor' : 'item';
            const page = AstUtils.getContainerOfType(datatable, isPage);
            const pageName = page ? page.name : document.name;

            return expandToNode`
                export { default as ${type}${document.name}${pageName}${datatable.name}Datatable } from "./${type}/${document.name.toLowerCase()}/components/datatables/${document.name.toLowerCase()}${pageName.toLowerCase()}${datatable.name}Datatable.vue";
            `;
        }

        const datatables = getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, false);
        return expandToNode`
            ${joinToNode(datatables, generateDatatableExport, { separator: "\n" })}
        `;
    }

    const fileNode = expandToNode`
    export { default as Attribute } from './components/attribute.vue';
    export { default as Resource } from './components/resource.vue';
    export { default as DocumentLink } from './components/document-link.vue';
    export { default as ProseMirror } from './components/prosemirror.vue';
    export { default as RollVisualizer } from './components/roll-visualizer.vue';
    export { default as Paperdoll } from './components/paperdoll.vue';
    export { default as Calculator } from './components/calculator.vue';
    export { default as TextField } from './components/text-field.vue';
    export { default as DateTime } from './components/date-time.vue';
    export { default as Tracker } from './components/tracker.vue';
    ${joinToNode(entry.documents.map(generateExport), { appendNewLineIfNotEmpty: true })}
    ${joinToNode(entry.documents.map(generateDocumentPromptExports), { appendNewLineIfNotEmpty: true })}
    ${joinToNode(entry.documents.map(generateDatatableExportForDocument), { appendNewLineIfNotEmpty: true })}
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
