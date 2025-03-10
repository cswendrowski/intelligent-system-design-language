import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, joinToNode, toString } from 'langium/generate';

export function generateVueMixin(description: string) {
    const generatedFileDir = path.join(description, "system", "sheets", "vue");
    const generatedFilePath = path.join(generatedFileDir, "VueRenderingMixin.mjs");

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const customComponents = {
        'i-attribute': 'Attribute',
        'i-resource': 'Resource',
        'i-document-link': 'DocumentLink',
        'i-prosemirror': 'ProseMirror',
    };

    const fileNode = expandToNode`
        import { createApp } from "../../../lib/vue.esm-browser.js";
        import * as Vuetify from "../../../lib/vuetify.esm.js";
        import { ${joinToNode(Object.values(customComponents), c => expandToNode`${c}`, { separator: ", "})} } from "./components/components.vue.es.mjs";

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
                    console.log("Vue App Context:", context, this.document);
                    const element = await super._renderFrame(options);

                    // Grab our application target and render our parts.
                    const target = this.hasFrame ? element.querySelector(".window-content") : element;
                    target.innerHTML = this.vueTemplates.join("");

                    const aliases = {
                        collapse: 'fas fa-chevron-up',
                        complete: 'fas fa-check',
                        cancel: 'fas fa-times-circle',
                        close: 'fas fa-times',
                        delete: 'fas fa-times-circle',
                        // delete (e.g. v-chip close)
                        clear: 'fas fa-times-circle',
                        // delete (e.g. v-chip close)
                        success: 'fas fa-check-circle',
                        info: 'fas fa-info-circle',
                        warning: 'fas fa-exclamation',
                        error: 'fas fa-exclamation-triangle',
                        prev: 'fas fa-chevron-left',
                        next: 'fas fa-chevron-right',
                        checkboxOn: 'fas fa-check-square',
                        checkboxOff: 'far fa-square',
                        // note 'far'
                        checkboxIndeterminate: 'fas fa-minus-square',
                        delimiter: 'fas fa-circle',
                        // for carousel
                        sortAsc: 'fas fa-arrow-up',
                        sortDesc: 'fas fa-arrow-down',
                        expand: 'fas fa-chevron-down',
                        menu: 'fas fa-bars',
                        subgroup: 'fas fa-caret-down',
                        dropdown: 'fas fa-caret-down',
                        radioOn: 'far fa-dot-circle',
                        radioOff: 'far fa-circle',
                        edit: 'fas fa-edit',
                        ratingEmpty: 'far fa-star',
                        ratingFull: 'fas fa-star',
                        ratingHalf: 'fas fa-star-half',
                        loading: 'fas fa-sync',
                        first: 'fas fa-step-backward',
                        last: 'fas fa-step-forward',
                        unfold: 'fas fa-arrows-alt-v',
                        file: 'fas fa-paperclip',
                        plus: 'fas fa-plus',
                        minus: 'fas fa-minus',
                        calendar: 'fas fa-calendar',
                        treeviewCollapse: 'fas fa-caret-down',
                        treeviewExpand: 'fas fa-caret-right',
                        eyeDropper: 'fas fa-eye-dropper'
                    };
                    const fa = {
                        component: Vuetify.components.VClassIcon
                    };

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
                        },
                        watch: {
                            "context.system": {
                                handler: function (newVal, oldVal) {
                                    this.$nextTick(() => {
                                        const changeEvent = new Event("change", { bubbles: true });
                                        this.$el.dispatchEvent(changeEvent);
                                    });
                                },
                                deep: true
                            }
                        }
                    });
                    ${joinToNode(Object.keys(customComponents) as Array<keyof typeof customComponents>, c => expandToNode`this.vueApp.component("${c}", ${customComponents[c]});`, { appendNewLineIfNotEmpty: true})}
                    const vuetify = Vuetify.createVuetify({
                        icons: {
                            defaultSet: 'fa',
                            aliases,
                            sets: {
                                fa,
                            },
                        },
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
