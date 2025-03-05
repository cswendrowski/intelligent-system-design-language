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

function copyVueMixin(description: string) {
    const generatedFilePath = path.join(description, "system", "sheets", "vue", "VueRenderingMixin.mjs");

    const fileNode = expandToNode`
        import { createApp } from "../../../lib/vue.esm-browser.js";
        import * as Vuetify from "../../../lib/vuetify.esm.js";
        import { Attribute } from "./components/components.vue.es.mjs";

        /**
         * Vue rendering mixin for ApplicationV2.
         *
         * @param {Constructor} BaseApplication
         * @returns {VueApplication}
         */
        export default function VueRenderingMixin(BaseApplication) {

            class VueApplication extends BaseApplication {

                /** Vue application instance created with createApp(). */
                vueApp = null;

                /** Vue root for the mounted application instance. */
                vueRoot = null;

                /** Constant to force updates on change. */
                _renderKey = 0;

                /**
                 * Object to store vue parts.
                 *
                 * @example
                 * vueParts = {
                 *   'document-sheet': {
                 *     component: DocumentSheetVue,
                 *     template: \`<document-sheet :context="context">Failed to render</document-sheet>\`
                 *   },
                 *   'foobar': {
                 *     component: Foobar,
                 *     template: \`<foobar :context="context"/>\`
                 *   }
                 * }
                 */
                vueParts = {};

                /**
                 * Getter for vueComponents
                 *
                 * Retrieves an object of component tags to component instances from the vueParts property.
                 *
                 * @example
                 * {
                 *   'document-sheet': DocumentSheet,
                 *   'foobar': Foobar,
                 * }
                 *
                 * @returns {object} Object with component tags mapped to components.
                 */
                get vueComponents() {
                    const components = {};
                    for (let [key, part] of Object.entries(this.vueParts)) {
                        if (part?.component) {
                            components[key] = part.component;
                        }
                    }
                    return components;
                }

                /**
                 * Getter for vueTemplates
                 *
                 * Retrieves an array of template part strings to render.
                 *
                 * @example
                 * [
                 *   '<document-sheet :context="context">Failed to render</document-sheet>',
                 *   '<foobar :context="context"/>'
                 * ]
                 *
                 * @returns {Array} Array of vue template mount points.
                 */
                get vueTemplates() {
                    return Object.values(this.vueParts).map((part) => part.template);
                }

                /**
                 * Render the outer framing HTMLElement and mount the Vue application.
                 *
                 * This occurs when the application is opened, but not on subsequent renders.
                 *
                 * @param {RenderOptions} options
                 * @returns {Promise<HTMLElement>}
                 *
                 * @protected
                 * @override
                 */
                async _renderFrame(options) {
                    // Retrieve the context and element.
                    const context = await this._prepareContext(options);
                    console.log("Vue App Context:", context);
                    const element = await super._renderFrame(options);

                    // Grab our application target and render our parts.
                    const target = this.hasFrame ? element.querySelector(".window-content") : element;
                    target.innerHTML = this.vueTemplates.join("");

                    // Create and store the Vue application instance.
                    this.vueApp = createApp({
                        // Data available in the template.
                        data() {
                            return {
                                context: context
                            };
                        },
                        // Components allowed by the application.
                        components: this.vueComponents,
                        // Method to update the template data on subsequent changes.
                        methods: {
                            updateContext(newContext) {
                                // Note that 'this' refers to this.vueApp, not the full AppV2 instance.
                                for (let key of Object.keys(this.context)) {
                                    if (newContext[key]) {
                                        this.context[key] = newContext[key];
                                    }
                                }
                            }
                        }
                    });
                    this.vueApp.component("i-attribute", Attribute);
                    const vuetify = Vuetify.createVuetify({
                        components: {
                            VNumberInput: Vuetify.components.VNumberInput
                        }
                    });
                    this.vueApp.use(vuetify);

                    // Expose global Foundry variables.
                    this.vueApp.config.globalProperties.game = game;
                    this.vueApp.config.globalProperties.CONFIG = CONFIG;
                    this.vueApp.config.globalProperties.foundry = foundry;

                    // Expose the document.
                    this.vueApp.provide("rawDocument", this.document);

                    // Mount and store the vue application.
                    this.vueRoot = this.vueApp.mount(target);

                    return element;
                }

                /**
                 * Handle updates for the Vue application instance.
                 *
                 * Normally, this would render the HTML for the content within the application.
                 * However, for Vue, all we want to do is update the 'context' property that's
                 * passed into the Vue application instance.
                 *
                 * Unlinke _renderFrame(), this occurs on every update for the application.
                 *
                 * @param {ApplicationRenderContext} context
                 * @param {RenderOptions} options
                 * @returns {Promise<string>}
                 *
                 * @protected
                 * @override
                 */
                async _renderHTML(context, options) {
                    // Force certain updates.
                    this._renderKey++;
                    context._renderKey = this._renderKey;
                    // Update the application root with new values.
                    this.vueRoot.updateContext(context);
                    // Return doesn't matter, Vue handles updates.

                }

                /** @override */
                _replaceHTML(result, content, options) {
                    // Pass. We don't need this in Vue land! But Foundry itself does...
                }

                /**
                 * Closes the application and unmounts the vue application instance.
                 *
                 * @param {ApplicationClosingOptions} options
                 * @returns {Promise<BaseApplication>}
                 *
                 * @override
                 */
                async close(options = {}) {
                    if (this.options.form.submitOnClose && this.isEditable) {
                        await this.submit();
                    }
                    // Unmount the vue instance.
                    if (this.vueApp) this.vueApp.unmount();
                    await super.close(options);
                }

                async _onFirstRender(context) {
                    super._onFirstRender(context);

                    // Replace the .application class with .vue-application
                    this.element.classList.remove("application");
                    this.element.classList.add("vue-application");
                }
            }

            return VueApplication;
        }   
    `.appendNewLine();
    
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

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
    ${joinToNode(entry.documents.map(generateExport), { appendNewLineIfNotEmpty: true })}
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
