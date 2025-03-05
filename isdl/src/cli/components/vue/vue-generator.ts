import * as path from 'node:path';
import * as fs from 'node:fs';
import { Document, Entry, isActor } from "../../../language/generated/ast.js";
import { generateDocumentVueComponent } from "./vue-component-generator.js";
import { expandToNode, joinToNode, toString } from 'langium/generate';
import { generateDocumentVueSheet } from './vue-sheet-generator.js';
import { build, defineConfig } from "vite";
import vue from '@vitejs/plugin-vue';
import { titleize } from 'inflection';
import { fileURLToPath } from 'node:url';
import vuetify from 'vite-plugin-vuetify';
import vueDevTools from 'vite-plugin-vue-devtools';
import { generateBaseVueComponents } from './vue-base-components-generator.js';
import { copyVueMixin } from './vue-mixin.js';

export function generateVue(entry: Entry, id: string, destination: string) {

    copyVueMixin(destination);
    copyVueBrowserJs(destination);
    copyVuetifyJs(destination);
    copyVuetifyCss(destination);
    copyMaterialDesign(destination);

    generateIndexMjs(entry, destination);
    generateBaseVueComponents(destination);

    entry.documents.forEach(x => {
        generateDocumentVueSheet(id, x, destination);
        generateDocumentVueComponent(id, x, destination);
    });
}

export function runViteBuild(destination: string) {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        const config = defineConfig({
            root: destination,
            plugins: [
                vue(),
                vuetify({ autoImport: true }),
                vueDevTools()
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
                sourcemap: true, // Optional: Enable for debugging
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
        build(config);
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
    const generatedFilePath = path.join(destination, "system", "templates", "vue", "index.mjs");

    function generateExport(document: Document) {
        const type = isActor(document) ? 'actor' : 'item';
        return `export { default as ${document.name}${titleize(type)}App } from './${type}/${document.name.toLowerCase()}App.vue';`;
    }

    const fileNode = expandToNode`
    export { default as Attribute } from './components/attribute.vue';
    export { default as Resource } from './components/resource.vue';
    ${joinToNode(entry.documents.map(generateExport), { appendNewLineIfNotEmpty: true })}
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
