import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { Action, AttributeExp, AttributeFunctionParam, AttributeRollParam, Document, Entry, FunctionDefinition, HtmlExp, HeightParam, WidthParam, ZoomParam, isAction, isActor, isAttributeExp, isAttributeFunctionParam, isAttributeRollParam, isFunctionDefinition, isHeightParam, isHtmlExp, isMethodBlock, isWidthParam, isZoomParam } from "../../../language/generated/ast.js";
import { humanize, titleize } from 'inflection';
import { getAllOfType, toMachineIdentifier } from '../utils.js';
import { translateBodyExpressionToJavascript, translateExpression } from '../method-generator.js';

export function generateDocumentVueSheet(entry: Entry, id: string, document: Document, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "sheets", "vue", type);
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const vueComponentName = `${document.name.toLowerCase()}-${type}-app`;

    // Default sheet window size, overridable via `width:`/`height:` params on the actor/item.
    // A value of `auto` lets Foundry size that dimension to its content.
    const formatDimension = (value: 'auto' | number): string => value === 'auto' ? '"auto"' : `${value}`;
    const widthParam = document.params?.find(isWidthParam) as WidthParam | undefined;
    const heightParam = document.params?.find(isHeightParam) as HeightParam | undefined;
    const zoomParam = document.params?.find(isZoomParam) as ZoomParam | undefined;
    const sheetWidth = widthParam ? formatDimension(widthParam.value) : (type == "item" ? 1050 : 1200);
    const sheetHeight = heightParam ? formatDimension(heightParam.value) : (type == "item" ? 875 : 950);

    const htmlElements = getAllOfType<HtmlExp>(document.body, isHtmlExp);
    let actions = getAllOfType<Action>(document.body, isAction);

    const functions = getAllOfType<FunctionDefinition>(document.body, isFunctionDefinition, false);

    // Attributes with a `function:` click handler. The referenced function runs as if it were an
    // action on click (same update/flush semantics), so the author gets full control over the result.
    const attributeFunctions = getAllOfType<AttributeExp>(document.body, isAttributeExp, false)
        .map(attr => ({ attr, param: attr.params.find(isAttributeFunctionParam) as AttributeFunctionParam | undefined }))
        .filter((x): x is { attr: AttributeExp, param: AttributeFunctionParam } => x.param?.function.ref != undefined);

    // Attributes with a block-style `roll: { ... }` click handler. The block is a method body that can
    // call user functions (self.Foo(...)) and mutate the document (self.X += 1), which require `this`,
    // the six flush objects, and an action-style flush — none of which exist in the sheet's Vue
    // <script setup> scope. So, like `function:`, the block runs as a real sheet method here instead.
    const attributeRolls = getAllOfType<AttributeExp>(document.body, isAttributeExp, false)
        .map(attr => ({ attr, param: attr.params.find(isAttributeRollParam) as AttributeRollParam | undefined }))
        .filter((x): x is { attr: AttributeExp, param: AttributeRollParam } => x.param != undefined && isMethodBlock(x.param.roll));
    function generateFunctionDefinition(functionDef: FunctionDefinition): CompositeGeneratorNode {
        const functionName = toMachineIdentifier(functionDef.name);
        console.log(`Generating function ${functionName} for ${document.name} Vue sheet.`);
        if (functionDef.params.length > 0) {

            return expandToNode`
            async function_${functionName}(context, update, embeddedUpdate, parentUpdate, parentEmbeddedUpdate, targetUpdate, targetEmbeddedUpdate, ${joinToNode(functionDef.params, param => expandToNode`${param.param.name}`, { separator: ', ' })}) {
                let system = context.object.system;
                ${translateBodyExpressionToJavascript(entry, id, functionDef.method.body, false, functionDef)}
            }
            `.appendNewLine();
        }
        // No-arg functions take the caller's `context` as their first argument too (the call site
        // passes context regardless of arity). Deriving `system` from it — mirroring the param
        // branch — keeps `self.*` (which compiles to `system.*`) and `context.object` both valid.
        return expandToNode`
        async function_${functionName}(context, update, embeddedUpdate, parentUpdate, parentEmbeddedUpdate, targetUpdate, targetEmbeddedUpdate) {
            let system = context.object.system;
            ${translateBodyExpressionToJavascript(entry, id, functionDef.method.body, false, functionDef)}
        }
        `.appendNewLine();
    }

    const fileNode = expandToNode`
        import VueRenderingMixin from '../VueRenderingMixin.mjs';
        import { ${document.name}${titleize(type)}App } from "../components/components.vue.es.mjs";
        import ${entry.config.name}Roll from "../../../rolls/roll.mjs";
        import ${entry.config.name}DamageRoll from "../../../rolls/damage-roll.mjs";
        const { DOCUMENT_OWNERSHIP_LEVELS } = CONST;

        export default class ${document.name}VueSheet extends VueRenderingMixin(foundry.applications.sheets.${titleize(type)}SheetV2) {
            
            constructor(options = {}) {
                super(options);
                this.#dragDrop = this.#createDragDropHandlers();
            }
        
            vueParts = {
                "${vueComponentName}": {
                    component: ${document.name}${titleize(type)}App,
                    template: "<${vueComponentName} :context=\\"context\\">Vue rendering for sheet failed.</${vueComponentName}>"
                }
            };

            _arrayEntryKey = 0;
            _renderKey = 0;

            /** @override */
            static DEFAULT_OPTIONS = {
                classes: ["${id}", "sheet", "vue-sheet", "${type}", "${document.name.toLowerCase()}-sheet"],
                viewPermission: DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
                editPermission: DOCUMENT_OWNERSHIP_LEVELS.OWNER,
                position: {
                    width: ${sheetWidth},
                    height: ${sheetHeight},
                },
                window: {
                    resizable: true,
                    title: "${humanize(document.name)}",
                    controls: ${type == "item" ? expandToNode`[]` : expandToNode`[
                        {
                            action: "configurePrototypeToken",
                            icon: "fa-solid fa-user-circle",
                            label: "TOKEN.TitlePrototype",
                            ownership: "OWNER"
                        },
                        {
                            action: "showPortraitArtwork",
                            icon: "fa-solid fa-image",
                            label: "SIDEBAR.CharArt",
                            ownership: "OWNER"
                        },
                        {
                            action: "showTokenArtwork",
                            icon: "fa-solid fa-image",
                            label: "SIDEBAR.TokenArt",
                            ownership: "OWNER"
                        }
                    ]`}
                },
                tag: "form",
                actions: {
                    onEditImage: this._onEditImage
                },
                changeActions: {
                },
                // Custom property that's merged into this.options
                dragDrop: [
                    {dragSelector: "tr", dropSelector: ".tabs-container, .datatable-drop-zone"},
                    {dropSelector: ".single-document"},
                    {dragSelector: ".paper-doll-slot", dropSelector: ".paper-doll-slot"},
                    {dragSelector: ".inventory-slot.filled", dropSelector: ".inventory-grid-container"}
                ],
                form: {
                    submitOnChange: true,
                    submitOnClose: true,
                    closeOnSubmit: false,
                }
            };

            async _prepareContext(options) {
                // Output initialization
                const context = {
                    // Validates both permissions and compendium status
                    editable: this.isEditable,
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
                    // tabs: this._getTabs(options.parts),

                    // Necessary for formInput and formFields helpers
                    fields: this.document.schema.fields,
                    systemFields: this.document.system.schema.fields
                };

                // Enrich editors
                await this._enrichEditor(context, "description");
                ${joinToNode(htmlElements, htmlElement => expandToNode`await this._enrichEditor(context, "${htmlElement.name.toLowerCase()}");`, { appendNewLineIfNotEmpty: true })}

                // Make another pass through the editors to fix the element contents.
                for (let [field, editor] of Object.entries(context.editors)) {
                    if (context.editors[field].element) {
                        context.editors[field].element.innerHTML = context.editors[field].enriched;
                    }
                }

                return context;
            }

            async _enrichEditor(context, field) {
                const enrichmentOptions = {
                    // Whether to show secret blocks in the finished html
                    secrets: this.document.isOwner,
                    // Data to fill in for inline rolls
                    rollData: this.document.getRollData() ?? {},
                    // Relative UUID resolution
                    relativeTo: this.document
                };

                const editorOptions = {
                    toggled: true,
                    collaborate: true,
                    documentUUID: this.document.uuid,
                    height: 300
                };

                const editorValue = this.document.system?.[field] ?? foundry.utils.getProperty(this.document.system, field);
                context.editors[\`system.\${field}\`] = {
                    enriched: await TextEditor.enrichHTML(editorValue, enrichmentOptions),
                    element: foundry.applications.elements.HTMLProseMirrorElement.create({
                        ...editorOptions,
                        name: \`system.\${field}\`,
                        value: editorValue ?? ""
                    })
                };
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
                ${zoomParam ? expandToNode`this.element.querySelector('.window-content').style.zoom = '${zoomParam.value / 100}';` : ''}
            }

            /**
             * Handle changing a Document's image.
             *
             * @this ArchmageBaseItemSheetV2
             * @param {PointerEvent} event   The originating click event
             * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
             * @returns {Promise}
             * @protected
             */
            static async _onEditImage(event, target) {
                if (!this.isEditable) return false;
                // Prefer data-edit-path (set by the <i-image> field component, which deliberately
                // avoids data-edit so Foundry's FormDataExtended never serializes the v-img wrapper's
                // innerHTML back into the field). Fall back to data-edit for the legacy drawer portrait.
                const attr = target.dataset.editPath ?? target.dataset.edit;
                const current = foundry.utils.getProperty(this.document, attr);
                const { img } = this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ?? {};
                const fp = new FilePicker({
                    current,
                    type: "image",
                    redirectToRoot: img ? [img] : [],
                    callback: (path) => {
                        target.src = path;
                        this.document.update({ [attr]: path });
                        this._renderKey++;
                    },
                    top: this.position.top + 40,
                    left: this.position.left + 10
                });
                return fp.browse();
            }

            _prepareSubmitData(event, form, formData) {
                // We don't modify the image via the sheet itself, so we can remove it from the submit data to avoid errors.
                delete formData.object.img;
                return super._prepareSubmitData(event, form, formData);
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
                if (event.currentTarget.classList.contains("paper-doll-slot")) {
                    // Remove the item from the slot
                    const name = event.currentTarget.dataset.name;
                    const update = {};
                    update[name] = null;
                    this.document.update(update);
                }
                else if (event.currentTarget.classList.contains("inventory-slot")) {
                    // Inventory slots - data is set by Vue component's @dragstart handler
                    // Nothing to do here, the Vue component handles it
                    return;
                }
                else {
                    // For table rows, currentTarget should already be the tr element
                    const tr = event.currentTarget.tagName === "TR" ? event.currentTarget : event.currentTarget.closest("tr");
                    if (tr) {
                        // Try to get UUID from data attributes
                        let uuid = tr.dataset.uuid;
                        let type = tr.dataset.type;

                        // If not found, try to get from item map (for Vuetify tables)
                        if (!uuid && tr.dataset.itemId && tr.dataset.documentId) {
                            const itemMap = window.isdlItemMaps?.get(tr.dataset.documentId);
                            if (itemMap) {
                                const item = itemMap.value.get(tr.dataset.itemId);
                                if (item) {
                                    uuid = item.uuid;
                                    type = item.type || 'Item';
                                }
                            }
                        }

                        if (!uuid) {
                            console.error("No UUID found on tr element", tr);
                            return;
                        }

                        const data = {
                            type: type == "ActiveEffect" ? "ActiveEffect" : "Item",
                            uuid: uuid
                        };

                        event.dataTransfer.setData("text/plain", JSON.stringify(data));
                    }
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

            /* -------------------------------------------- */

            async _onAction(event) {
                if (event.preventDefault) event.preventDefault();
                const action = event.currentTarget.dataset.action;
                switch ( action ) {
                    ${joinToNode(actions, property => `case "${property.name.toLowerCase()}": this._on${property.name}Action(event, this.document.system); break;`, { appendNewLineIfNotEmpty: true })}
                }
            }

            ${joinToNode(actions, property => generateAction(property), { appendNewLineIfNotEmpty: true })}

            /* -------------------------------------------- */

            // Attribute click handlers (function: param)
            ${joinToNode(attributeFunctions, generateAttributeFunctionMethod, { appendNewLineIfNotEmpty: true })}

            /* -------------------------------------------- */

            // Attribute click handlers (block-style roll: param)
            ${joinToNode(attributeRolls, generateAttributeRollMethod, { appendNewLineIfNotEmpty: true })}

            /* -------------------------------------------- */

            // User defined methods
            ${joinToNode(functions, generateFunctionDefinition, { appendNewLineIfNotEmpty: true })}
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));

    function generateAction(action: Action): CompositeGeneratorNode | undefined {
        console.log(`Generating action ${action.name} for ${document.name} Vue sheet.`);
        return expandToNode`

            /* -------------------------------------------- */

            async _on${action.name}Action(event, system) {
                if (event.preventDefault) event.preventDefault();
                let update = {};
                let embeddedUpdate = {};
                let parentUpdate = {};
                let parentEmbeddedUpdate = {};
                let targetUpdate = {};
                let targetEmbeddedUpdate = {};
                let selfDeleted = false;
                let rerender = false;
                let document = this.document;
                const context = {
                    object: this.document,
                    target: game.user.getTargetOrNothing()
                };
                // If this is an item, attach the parent
                if (document.documentName === "Item" && document.parent) {
                    context.actor = document.parent;
                }
                else {
                    context.actor = document;
                }
                ${translateExpression(entry, id, action.method, false, action)}
                if (!selfDeleted && Object.keys(update).length > 0) {
                    await this.document.update(update);
                    rerender = true;
                }
                if (!selfDeleted && Object.keys(embeddedUpdate).length > 0) {
                    for (let key of Object.keys(embeddedUpdate)) {
                        await this.document.updateEmbeddedDocuments("Item", embeddedUpdate[key]);
                    }
                    rerender = true;
                }
                if (Object.keys(parentUpdate).length > 0) {
                    await this.document.parent.update(parentUpdate);
                    rerender = true;
                }
                if (Object.keys(parentEmbeddedUpdate).length > 0) {
                    for (let key of Object.keys(parentEmbeddedUpdate)) {
                        await document.parent.updateEmbeddedDocuments("Item", parentEmbeddedUpdate[key]);
                    }
                }
                if (Object.keys(targetUpdate).length > 0) {
                    await context.target.update(targetUpdate);
                }
                if (Object.keys(targetEmbeddedUpdate).length > 0) {
                    for (let key of Object.keys(targetEmbeddedUpdate)) {
                        await context.target.updateEmbeddedDocuments("Item", targetEmbeddedUpdate[key]);
                    }
                }
                if (rerender) {
                    this.render();
                }
            }
        `;
    }

    // Generates a sheet method that runs an attribute's `function:` body with the same update/flush
    // semantics as an action. The function body is inlined here (rather than calling the generated
    // function_<name> helper) so it runs with a correctly-shaped context regardless of arity.
    function generateAttributeFunctionMethod({ attr, param }: { attr: AttributeExp, param: AttributeFunctionParam }): CompositeGeneratorNode {
        const functionDef = param.function.ref!;
        console.log(`Generating attribute function handler ${attr.name} -> ${functionDef.name} for ${document.name} Vue sheet.`);
        return expandToNode`

            /* -------------------------------------------- */

            async _on${attr.name}AttributeFunction(event) {
                if (event?.preventDefault) event.preventDefault();
                let update = {};
                let embeddedUpdate = {};
                let parentUpdate = {};
                let parentEmbeddedUpdate = {};
                let targetUpdate = {};
                let targetEmbeddedUpdate = {};
                let selfDeleted = false;
                let rerender = false;
                let document = this.document;
                const context = {
                    object: this.document,
                    target: game.user.getTargetOrNothing()
                };
                // If this is an item, attach the parent
                if (document.documentName === "Item" && document.parent) {
                    context.actor = document.parent;
                }
                else {
                    context.actor = document;
                }
                ${translateExpression(entry, id, functionDef.method, false, functionDef)}
                if (!selfDeleted && Object.keys(update).length > 0) {
                    await this.document.update(update);
                    rerender = true;
                }
                if (!selfDeleted && Object.keys(embeddedUpdate).length > 0) {
                    for (let key of Object.keys(embeddedUpdate)) {
                        await this.document.updateEmbeddedDocuments("Item", embeddedUpdate[key]);
                    }
                    rerender = true;
                }
                if (Object.keys(parentUpdate).length > 0) {
                    await this.document.parent.update(parentUpdate);
                    rerender = true;
                }
                if (Object.keys(parentEmbeddedUpdate).length > 0) {
                    for (let key of Object.keys(parentEmbeddedUpdate)) {
                        await document.parent.updateEmbeddedDocuments("Item", parentEmbeddedUpdate[key]);
                    }
                }
                if (Object.keys(targetUpdate).length > 0) {
                    await context.target.update(targetUpdate);
                }
                if (Object.keys(targetEmbeddedUpdate).length > 0) {
                    for (let key of Object.keys(targetEmbeddedUpdate)) {
                        await context.target.updateEmbeddedDocuments("Item", targetEmbeddedUpdate[key]);
                    }
                }
                if (rerender) {
                    this.render();
                }
            }
        `;
    }

    // Generates a sheet method that runs an attribute's block-style `roll: { ... }` body with the same
    // update/flush semantics as an action. The block is inlined here (rather than emitted as an arrow in
    // the sheet's Vue <script setup>) because it may call user functions and mutate the document, which
    // need `this`, the six flush objects, and the action-style flush/render tail — none of which exist
    // in <script setup> scope (where `this` is undefined and `update` is never declared). Mirrors
    // _on<Attr>AttributeFunction exactly; only the inlined body differs.
    function generateAttributeRollMethod({ attr, param }: { attr: AttributeExp, param: AttributeRollParam }): CompositeGeneratorNode {
        console.log(`Generating attribute roll handler ${attr.name} for ${document.name} Vue sheet.`);
        return expandToNode`

            /* -------------------------------------------- */

            async _on${attr.name}AttributeRoll(event) {
                if (event?.preventDefault) event.preventDefault();
                let update = {};
                let embeddedUpdate = {};
                let parentUpdate = {};
                let parentEmbeddedUpdate = {};
                let targetUpdate = {};
                let targetEmbeddedUpdate = {};
                let selfDeleted = false;
                let rerender = false;
                let document = this.document;
                const context = {
                    object: this.document,
                    target: game.user.getTargetOrNothing()
                };
                // If this is an item, attach the parent
                if (document.documentName === "Item" && document.parent) {
                    context.actor = document.parent;
                }
                else {
                    context.actor = document;
                }
                // Roll-block translation emits bare 'system' references (e.g. for 'success:'/comparison
                // thresholds like 'self.X'), so provide it in scope -- matching the original inline block
                // and the action handler's 'system' parameter.
                let system = context.object.system;
                ${translateExpression(entry, id, param.roll, false, attr)}
                if (!selfDeleted && Object.keys(update).length > 0) {
                    await this.document.update(update);
                    rerender = true;
                }
                if (!selfDeleted && Object.keys(embeddedUpdate).length > 0) {
                    for (let key of Object.keys(embeddedUpdate)) {
                        await this.document.updateEmbeddedDocuments("Item", embeddedUpdate[key]);
                    }
                    rerender = true;
                }
                if (Object.keys(parentUpdate).length > 0) {
                    await this.document.parent.update(parentUpdate);
                    rerender = true;
                }
                if (Object.keys(parentEmbeddedUpdate).length > 0) {
                    for (let key of Object.keys(parentEmbeddedUpdate)) {
                        await document.parent.updateEmbeddedDocuments("Item", parentEmbeddedUpdate[key]);
                    }
                }
                if (Object.keys(targetUpdate).length > 0) {
                    await context.target.update(targetUpdate);
                }
                if (Object.keys(targetEmbeddedUpdate).length > 0) {
                    for (let key of Object.keys(targetEmbeddedUpdate)) {
                        await context.target.updateEmbeddedDocuments("Item", targetEmbeddedUpdate[key]);
                    }
                }
                if (rerender) {
                    this.render();
                }
            }
        `;
    }
}
