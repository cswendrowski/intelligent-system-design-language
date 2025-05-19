import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { Document, DocumentArrayExp, Entry, isActor, isDocumentArrayExp, isPage } from '../../../language/generated/ast.js';
import { getAllOfType } from '../utils.js';
import { AstUtils } from 'langium';

export function generateDatatableVueSheet( entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "sheets", "vue");
    const generatedFilePath = path.join(generatedFileDir, `datatable-app.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateImportForDocument(document: Document): CompositeGeneratorNode {

        function generateDatatableImport(datatable: DocumentArrayExp): CompositeGeneratorNode {
            const type = isActor(document) ? 'actor' : 'item';
            const page = AstUtils.getContainerOfType(datatable, isPage);
            const pageName = page ? page.name : document.name;

            return expandToNode`
                import { ${type}${document.name}${pageName}${datatable.name}Datatable } from "./components/components.vue.es.mjs";
            `;
        }

        const datatables = getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, false);
        return expandToNode`
            ${joinToNode(datatables, generateDatatableImport, { appendNewLineIfNotEmpty: true })}
        `;
    }

    function generateDatatableSwitch(document: Document): CompositeGeneratorNode {
        function generateDatatableCase(datatable: DocumentArrayExp): CompositeGeneratorNode {
            const type = isActor(document) ? 'actor' : 'item';
            const page = AstUtils.getContainerOfType(datatable, isPage);
            const pageName = page ? page.name : document.name;

            return expandToNode`
                case "${type}${document.name}${pageName}${datatable.name}": return ${type}${document.name}${pageName}${datatable.name}Datatable; break;
            `;
        }

        const datatables = getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, false);
        return expandToNode`
            ${joinToNode(datatables, generateDatatableCase, { appendNewLineIfNotEmpty: true })}
        `;
    }

    const fileNode = expandToNode`
        import VueRenderingMixin from './VueRenderingMixin.mjs';
        ${joinToNode(entry.documents, generateImportForDocument, { appendNewLineIfNotEmpty: true })}

        export default class DatatableApp extends VueRenderingMixin(foundry.applications.api.ApplicationV2) {
            
            document;
            constructor(document, table, systemPath, tabName, options = {}) {
                super(options);
                this.#dragDrop = this.#createDragDropHandlers();
                this.document = document;
                this.systemPath = systemPath;
                this.tabName = tabName;

                const component = this._chooseComponent(table);
                console.log("Component: ", component);
                console.log("System Path: ", this.systemPath);
                this.vueParts = {
                    "datatable": {
                        component,
                        template: \`<datatable :is="component" :systemPath="systemPath" :context="context">Vue rendering for datatable failed.</datatable>\`
                    }
                };
               
            }

            vueData(context) {
                return {
                    systemPath: this.systemPath,
                    context: context
                };
            }

            _getProvidedData() {
                // This is a placeholder for any data you want to provide to the Vue app.
                // You can override this method in your subclass to provide additional data.
                return {
                    systemPath: this.systemPath,
                };
            }

            _chooseComponent(table) {
                switch (table) {
                    ${joinToNode(entry.documents, generateDatatableSwitch, { appendNewLineIfNotEmpty: true })}
                    default: throw new Error("No component found for table " + table);
                }
            }

            _arrayEntryKey = 0;
            _renderKey = 0;

            /** @override */
            static DEFAULT_OPTIONS = {
                classes: ["${id}", "dialog", "vue-sheet", "isdl-datatable"],
                position: {
                    width: 800,
                    height: 400,
                },
                window: {
                    resizable: true,
                    title: "Datatable",
                },
                tag: "form",
                actions: {
                },
                changeActions: {
                },
                // Custom property that's merged into this.options
                dragDrop: [
                    {dropSelector: ".single-document"},
                    {dragSelector: ".paper-doll-slot", dropSelector: ".paper-doll-slot"}
                ],
                form: {
                    submitOnChange: false,
                    submitOnClose: true,
                    closeOnSubmit: true,
                }
            };

            get title() {
                //return \`\${this.document.name} - \${this.tabName}\`;
                return this.document.name;
            }

            async _prepareContext(options) {
                // Output initialization
                const context = {
                    // Validates both permissions and compendium status
                    editable: true,
                    owner: this.document.isOwner,
                    limited: this.document.limited,

                    // Add the document.
                    object: this.document.toObject(),
                    document: this.document,

                    // Add the data to context.data for easier access, as well as flags.
                    system: this.document.system,
                    flags: this.document.flags,

                    // Roll data.
                    rollData: this.document.getRollData() ?? {},

                    // Editors
                    editors: {},

                    // Force re-renders. Defined in the vue mixin.
                    _renderKey: this._renderKey ?? 0,
                    _arrayEntryKey: this._arrayEntryKey ?? 0,

                    // Necessary for formInput and formFields helpers
                    fields: this.document.schema.fields,
                    systemFields: this.document.system.schema.fields
                };

                return context;
            }

            /**
             * Actions performed after any render of the Application.
             * Post-render steps are not awaited by the render process.
             * @param {ApplicationRenderContext} context      Prepared context data
             * @param {RenderOptions} options                 Provided render options
             * @protected
             */
            _onRender(context, options) {
                if (options.isFirstRender) {
                    function update(doc, context, id) {
                        console.dir(doc);
                        if (doc.parent?.uuid === this.document.uuid) {
                            console.log("Updating document: ", doc);
                            this.document = doc.parent;
                            this.render();
                        }
                    }
                    Hooks.on("createItem", update.bind(this));
                    Hooks.on("updateItem", update.bind(this));
                    Hooks.on("deleteItem", update.bind(this));
                }
                this.#dragDrop.forEach((d) => d.bind(this.element));
                // You may want to add other special handling here
                // Foundry comes with a large number of utility classes, e.g. SearchFilter
                // That you may want to implement yourself.
            }

            
            // Drag and Drop
 
            /**
             * Returns an array of DragDrop instances
             * @type {DragDrop[]}
             */
            get dragDrop() {
                return this.#dragDrop;
            }

            /**
             * Define whether a user is able to begin a dragstart workflow for a given drag selector
             * @param {string} selector       The candidate HTML selector for dragging
             * @returns {boolean}             Can the current user drag this selector?
             * @protected
             */
            _canDragStart(selector) {
                return this.isEditable;
            }

            /**
             * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
             * @param {string} selector       The candidate HTML selector for the drop target
             * @returns {boolean}             Can the current user drop on this selector?
             * @protected
             */
            _canDragDrop(selector) {
                return this.isEditable;
            }

            /**
             * Callback actions which occur at the beginning of a drag start workflow.
             * @param {DragEvent} event       The originating DragEvent
             * @protected
             */
            _onDragStart(event) {
                console.log("Drag Start");

                if (event.currentTarget.classList.contains("paper-doll-slot")) {
                    // Remove the item from the slot
                    const name = event.currentTarget.dataset.name;
                    const update = {};
                    update[name] = null;
                    this.document.update(update);
                }
                else {
                    const tr = event.currentTarget.closest("tr");
                    const data = {
                        type: tr.dataset.type == "ActiveEffect" ? "ActiveEffect" : "Item",
                        uuid: tr.dataset.uuid
                    };

                    event.dataTransfer.setData("text/plain", JSON.stringify(data));
                }
            }

            /**
             * Callback actions which occur when a dragged element is over a drop target.
             * @param {DragEvent} event       The originating DragEvent
             * @protected
             */
            _onDragOver(event) {}

            /* -------------------------------------------- */

            async _onDrop(event) {
                const data = JSON.parse(event.dataTransfer.getData("text/plain"));

                // If the drop target is a single document, handle it differently
                const linkedClasses = [ "single-document", "paper-doll-slot" ];
                const eventClasses = Array.from(event.currentTarget.classList);
                if (eventClasses.find(c => linkedClasses.includes(c))) {
                    const doc = await fromUuid(data.uuid);
                    if ( !doc ) return;
                    if ( doc.type !== event.currentTarget.dataset.type ) {
                        ui.notifications.error(\`Expected a \${event.currentTarget.dataset.type} type Document, but got a \${doc.type} type one instead. \`);
                        return;
                    }

                    const update = {};
                    update[event.currentTarget.dataset.name] = data.uuid;
                    await this.document.update(update);
                    return;
                }

                const dropTypes = ["Item", "ActiveEffect"];
                if ( !dropTypes.includes(data.type) ) return;
                const item = await fromUuid(data.uuid);
                if ( !item ) return;

                if ( data.type === "ActiveEffect" ) {
                    ActiveEffect.createDocuments([item], {parent: this.document})
                    return;
                }

                Item.createDocuments([item], {parent: this.document})
            }

            /* -------------------------------------------- */

            /**
             * Returns an array of DragDrop instances
             * @type {DragDrop[]}
             */
            get dragDrop() {
                return this.#dragDrop;
            }

            // This is marked as private because there's no real need
            // for subclasses or external hooks to mess with it directly
            #dragDrop;

            /**
             * Create drag-and-drop workflow handlers for this Application
             * @returns {DragDrop[]}     An array of DragDrop handlers
             * @private
             */
            #createDragDropHandlers() {
                return this.options.dragDrop.map((d) => {
                    d.permissions = {
                        dragstart: this._canDragStart.bind(this),
                        drop: this._canDragDrop.bind(this)
                    };
                    d.callbacks = {
                        dragstart: this._onDragStart.bind(this),
                        dragover: this._onDragOver.bind(this),
                        drop: this._onDrop.bind(this)
                    };
                    return new DragDrop(d);
                });
            }
        }
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
