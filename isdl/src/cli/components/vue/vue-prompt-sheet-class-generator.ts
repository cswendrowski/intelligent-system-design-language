import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Document, Entry, isActor, isDamageTypeChoiceField, isProperty, isStringChoiceField, Prompt } from '../../../language/generated/ast.js';
import { titleize } from 'inflection';

export function generatePromptSheetClass(name: string, entry: Entry, id: string,  document: Document, prompt: Prompt, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';

    // `name` is the prompt identity (action + variable). The prompt's fields live under
    // system.<identity-lowercased>, matching the v-model paths in the generated component.
    const promptPath = name.toLowerCase();

    // Single-choice fields (choice<string>/choice<damageType>) are stored as {value,icon,color}
    // objects in the datamodel. The action expects first.Field === the chosen value, so flatten
    // those to their .value on harvest. (choices<string> already stores an array of plain values.)
    const choiceFieldNames = prompt.body
        .filter(p => isProperty(p) && (isStringChoiceField(p) || isDamageTypeChoiceField(p)))
        .map(p => (p as any).name.toLowerCase());
    const generatedFileDir = path.join(destination, "system", "sheets", "vue", type, "prompts");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}-${name}-prompt-app.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const vueComponentName = `${document.name.toLowerCase()}-${type}-${name.toLowerCase()}-prompt`;

    const fileNode = expandToNode`
        import VueRenderingMixin from '../../VueRenderingMixin.mjs';
        import { ${document.name}${titleize(type)}${name}Prompt } from "../../components/components.vue.es.mjs";

        export default class ${document.name}${name}PromptApp extends VueRenderingMixin(foundry.applications.api.ApplicationV2) {
            
            document;
            promptResolve;
            #promptResolved = false;
            constructor(document, options = {}) {
                super(options);
                this.#dragDrop = this.#createDragDropHandlers();
                this.document = document;
                this.promptResolve = options.promptResolve;
            }

            // Plain, writable scratch copy of the document's system data that the Vue v-models bind
            // to (context.system points here). Using a toObject() clone -- not the live DataModel --
            // means every field type is writable, including getter-only document-reference fields.
            #promptData;

            // Resolve the awaiting action with the user's input, harvested from the scratch data.
            // Shape matches the legacy dialog path: { ...fields, system: { ...fields } } so
            // userInput.X access is unchanged.
            _resolvePrompt() {
                if (this.#promptResolved) return;
                this.#promptResolved = true;
                const data = foundry.utils.deepClone(foundry.utils.getProperty(this.#promptData, "${promptPath}")) ?? {};
                // Flatten single-choice fields ({value,icon,color}) to their chosen value.
                for (const key of ${JSON.stringify(choiceFieldNames)}) {
                    if (data[key] && typeof data[key] === "object" && "value" in data[key]) data[key] = data[key].value;
                }
                this.promptResolve?.({ ...data, system: data });
                this.close();
            }

            _cancelPrompt() {
                if (this.#promptResolved) return;
                this.#promptResolved = true;
                this.promptResolve?.({});
                this.close();
            }

            async close(options = {}) {
                // If closed without an explicit submit/cancel, don't leave the action hanging.
                if (!this.#promptResolved) {
                    this.#promptResolved = true;
                    this.promptResolve?.({});
                }
                return super.close(options);
            }

            vueParts = {
                "${vueComponentName}": {
                    component: ${document.name}${titleize(type)}${name}Prompt,
                    template: "<${vueComponentName} :context=\\"context\\">Vue rendering for application failed.</${vueComponentName}>"
                }
            };

            _arrayEntryKey = 0;
            _renderKey = 0;

            /** @override */
            static DEFAULT_OPTIONS = {
                classes: ["${id}", "dialog", "vue-sheet", "isdl-prompt", "${type}", "${document.name.toLowerCase()}-prompt"],
                position: {
                    width: 400,
                    height: 600,
                },
                window: {
                    resizable: true,
                    title: "${name} Prompt",
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
                    submitOnClose: false,
                    closeOnSubmit: false,
                }
            };

            async _prepareContext(options) {
                // Fresh, writable scratch copy of system data for the prompt's inputs to bind to.
                this.#promptData = foundry.utils.deepClone(this.document.toObject().system);
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
                    system: this.#promptData,
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

                // Callbacks the Vue Submit/Cancel buttons invoke.
                context.promptSubmit = () => this._resolvePrompt();
                context.promptCancel = () => this._cancelPrompt();

                return context;
            }

            // Field components (i-die, i-money, etc.) inject "rawDocument" and call .update() to
            // persist on change. A prompt is transient scratch input, so override rawDocument with
            // a proxy whose .update() is a no-op: fields still read/write the in-memory context
            // (which we harvest on submit), but nothing is written to the actual document.
            _getProvidedData() {
                const realDocument = this.document;
                const noPersistDocument = new Proxy(realDocument, {
                    get(target, prop) {
                        if (prop === "update" || prop === "updateSource") return async () => {};
                        const value = target[prop];
                        return typeof value === "function" ? value.bind(target) : value;
                    }
                });
                return { rawDocument: noPersistDocument };
            }

            /**
             * Actions performed after any render of the Application.
             * Post-render steps are not awaited by the render process.
             * @param {ApplicationRenderContext} context      Prepared context data
             * @param {RenderOptions} options                 Provided render options
             * @protected
             */
            _onRender(context, options) {
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

                // Prevent duplicates when dropping an item that's already owned by this document
                if ( item.parent?.uuid === this.document.uuid ) return;

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
