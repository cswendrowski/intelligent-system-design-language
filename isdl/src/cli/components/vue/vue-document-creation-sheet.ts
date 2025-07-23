import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Entry } from '../../../language/generated/ast.js';

export function generateDocumentCreationDialog(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "sheets", "vue");
    const generatedFilePath = path.join(generatedFileDir, `document-creation-dialog.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        import VueRenderingMixin from './VueRenderingMixin.mjs';
        import { DocumentCreationApp } from "./components/components.vue.es.mjs";
        export default class DocumentCreationVueDialog extends VueRenderingMixin(foundry.applications.api.ApplicationV2) {
            
            constructor(resolve, reject, options= {}) {
                super(options);
                this.resolve = resolve;
                this.reject = reject;
            }
            
            vueParts = {
                "document-creation": {
                    component: DocumentCreationApp,
                    template: "<document-creation :context=\\"context\\">Vue rendering for dialog failed.</document-creation>"
                }
            };

            _arrayEntryKey = 0;
            _renderKey = 0;
            
            /** @override */
            static DEFAULT_OPTIONS = {
                classes: ["${id}", "sheet", "vue-sheet", "document-creation"],
                position: {
                    width: 400,
                    height: 350,
                },
                window: {
                    resizable: false,
                    title: "Document Creation"
                },
                tag: "form",
                actions: {
                },
                changeActions: {
                },
                // Custom property that's merged into this.options
                dragDrop: [
                ],
                form: {
                    submitOnChange: false,
                    submitOnClose: true,
                    closeOnSubmit: true
                }
            };
            
            async _prepareContext(options) {
                const context = {
                    types: [],
                    folders: [],
                    title: "",
                    name: "",
                    type: "",
                };
                
                // Merge options into context
                if (this.options) {
                    foundry.utils.mergeObject(context, this.options);
                }
                
                console.dir(context);
                return context;
            }
            
             static async prompt(options = {}) {
                return new Promise((resolve, reject) => {
                    const app = new this(resolve, reject, options);
                    app.render({force: true, focus: true});
                });
            }

            close() {
                this.reject(new Error("The Dialog was closed without a choice being made."));
                super.close();
            }

            submit() {
                const formData = new FormDataExtended(this.element);
                const data = { };
                for (const [key, value] of formData.entries()) {
                    data[key] = value;
                }
                this.resolve(data);
                this.close();
            }

            cancel() {
                this.reject(new Error("The Dialog was closed without a choice being made."));
                this.close();
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
