import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    ClassExpression,
    Document,
    Entry,
    isAccess,
    isAction,
    isActor,
    isAttributeExp,
    isBooleanExp,
    isHookHandler,
    isHtmlExp,
    isIfStatement,
    isInitiativeProperty,
    isNumberExp,
    isNumberParamValue,
    isProperty,
    isResourceExp,
    isSection,
    isStatusProperty,
    isStringExp,
    isTrackerExp,
    Layout, isLayout, isMacroField
} from '../../language/generated/ast.js';
import { getSystemPath } from './utils.js';

export function generateBaseActiveEffectBaseSheet(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "sheets", "vue");
    const generatedFilePath = path.join(generatedFileDir, `active-effect-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateAddValue(document: Document, property: ClassExpression | Layout): CompositeGeneratorNode | undefined {

        if ( isAccess(property) || isAction(property) || isIfStatement(property) || isHookHandler(property) || isMacroField(property)) return undefined;

        if ( isLayout(property) ) {
            return joinToNode(property.body, property => generateAddValue(document, property), { appendNewLineIfNotEmpty: true });
        }

        if ( isHtmlExp(property) || isInitiativeProperty(property) || isStatusProperty(property) || !isProperty(property)) return;
        if ( property.modifier == "locked" ) return;

        if (isResourceExp(property)) {
            return expandToNode`
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value", 1);
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max");
            `;
        }

        if (isTrackerExp(property)) {
            return expandToNode`
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.min");
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value", 1);
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.temp", 1);
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max");
            `;
        }

        if (isAttributeExp(property)) {
            return expandToNode`
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value");
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max");
            `;
        }

        if (isNumberExp(property)) {
            return expandToNode`
                addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.system.${property.name.toLowerCase()}", 1);
            `;
        }

        return expandToNode`
            addChange("${document.name.toLowerCase()}", "${document.name.toLowerCase()}.${getSystemPath(property)}");
        `;
    }

    // let stringChoices = document.body.filter(x => isStringExp(x) && x.choices != undefined && x.choices.length > 0).map(x => x as StringExp);
    // for (let section of document.body.filter(x => isSection(x))) {
    //     stringChoices = stringChoices.concat((section as Section).body.filter(x => isStringExp(x) && x.choices != undefined && x.choices.length > 0).map(x => x as StringExp));
    // }

    // function generateStringChoices(document: Document, property: StringExp): CompositeGeneratorNode | undefined {
    //     // We need to map an array of form [ "A", "B", "C" ] to an object of form { A: "A", B: "B", C: "C" }
    //     return expandToNode`
    //         context.${property.name.toLowerCase()}Choices = {
    //             ${joinToNode(property.choices, x => expandToNode`${toMachineIdentifier(x)}: "${document.name}.${property.name}.${x}",`.appendNewLineIfNotEmpty())}
    //         };
    //     `;
    // }

    const fileNode = expandToNode`
        import VueRenderingMixin from './VueRenderingMixin.mjs';
        import { ActiveEffectApp } from "./components/components.vue.es.mjs";
        const { DOCUMENT_OWNERSHIP_LEVELS } = CONST;
        export default class ${entry.config.name}EffectVueSheet extends VueRenderingMixin(foundry.applications.api.DocumentSheetV2) {
            
            vueParts = {
                "active-effect": {
                    component: ActiveEffectApp,
                    template: "<active-effect :context=\\"context\\">Vue rendering for sheet failed.</active-effect>"
                }
            };

            _arrayEntryKey = 0;
            _renderKey = 0;
            
            
            /** @override */
            static DEFAULT_OPTIONS = {
                classes: ["${id}", "sheet", "vue-sheet", "active-effect", "active-effect-sheet"],
                viewPermission: DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
                editPermission: DOCUMENT_OWNERSHIP_LEVELS.OWNER,
                position: {
                    width: 600,
                    height: 600,
                },
                window: {
                    resizable: true,
                    title: "Active Effect"
                },
                tag: "form",
                actions: {
                    onEditImage: this._onEditImage
                },
                changeActions: {
                },
                // Custom property that's merged into this.options
                dragDrop: [
                ],
                form: {
                    handler: ${entry.config.name}EffectVueSheet.#onSubmitForm,
                    submitOnChange: true,
                    submitOnClose: true,
                    closeOnSubmit: false
                }
            };

            /* -------------------------------------------- */
            
            async _prepareContext(options) {
                const context = await super._prepareContext(options);
                this.object = this.document.toObject();
                context.effect = this.object;
                context.descriptionHTML = await TextEditor.enrichHTML(this.object.description, {secrets: this.object.isOwner});
            
                // Status Conditions
                const statuses = CONFIG.statusEffects.map(s => {
                  return {
                    id: s.id,
                    label: game.i18n.localize(s.name),
                    selected: context.effect.statuses.includes(s.id) ? "selected" : ""
                  };
                });
                context.statuses = statuses;
                if ( context.effect.origin ) {
                    context.originLink = await TextEditor.enrichHTML("@UUID[" + context.effect.origin + "]");
                }
                context.modes = Object.entries(CONST.ACTIVE_EFFECT_MODES).reduce((obj, e) => {
                    obj[e[1]] = game.i18n.localize(\`EFFECT.MODE_\${e[0]}\`);
                    return obj;
                });
                
                function setValue(obj, access, value, mode) {
                    if ( typeof(access)=='string' ) {
                        access = access.split('.');
                    }
                    // Split up an access path into sub-objects, such as "system.attribute.value" => "system": {"attribute": {"value": ...}}
                    if ( access.length > 1 ) {
                        const key = access.shift();
                        if ( !obj[key] ) obj[key] = {};
                        setValue(obj[key], access, value, mode);
                    }
                    else {
                        obj[access[0]] = value;
                        obj[access[0] + "-mode"] = mode;
                    }
                }

                // Turn the changes into the friendlier format
                for ( const change of context.effect.changes ) {
                    setValue(context, change.key, change.value, change.mode);
                }
                
                // Output initialization
                const vueContext = {
                    // Validates both permissions and compendium status
                    editable: this.isEditable,
                    owner: this.document.isOwner,
                    limited: this.document.limited,

                    // Add the document.
                    object: context.effect,
                    document: this.document,

                    // Add the data to context.data for easier access, as well as flags.
                    system: this.document.system,
                    flags: this.document.flags,

                    // Editors
                    editors: {},

                    // Force re-renders. Defined in the vue mixin.
                    _renderKey: this._renderKey ?? 0,
                    _arrayEntryKey: this._arrayEntryKey ?? 0,
                    // tabs: this._getTabs(options.parts),
                };
                
                await this._enrichEditor(vueContext, "description");
                
                const modes = CONST.ACTIVE_EFFECT_MODES;
                const numberModes = [modes.MULTIPLY, modes.ADD, modes.DOWNGRADE, modes.UPGRADE, modes.OVERRIDE];
                const stringModes = [modes.OVERRIDE];
                const booleanModes = [modes.OVERRIDE];

                vueContext.numberModes = numberModes.reduce((obj, mode) => {
                    obj.push({
                        value: mode,
                        label: context.modes[mode]
                    });
                    return obj;
                }, []);
                vueContext.numberModes.push({
                    value: 0,
                    label: game.i18n.localize("EFFECTS.AddOnce")
                });
                vueContext.stringModes = stringModes.map((mode) => ({
                    value: mode,
                    label: context.modes[mode]
                }));
                vueContext.booleanModes = booleanModes.map((mode) => ({
                    value: mode,
                    label: context.modes[mode]
                }));
                vueContext.resourceModes = [
                    { value: 0, label: "Add Once" }
                ];
                vueContext.trackerModes = [
                    { value: 0, label: "Add Once" }
                ];

                console.dir("Vue Active Effect Context", vueContext);
                return vueContext;
            }
            
            
            async _enrichEditor(context, field) {
                const enrichmentOptions = {
                    // Whether to show secret blocks in the finished html
                    secrets: this.document.isOwner,
                    // Data to fill in for inline rolls
                    rollData: {},
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
                context.editors[\`\${field}\`] = {
                    enriched: await TextEditor.enrichHTML(editorValue, enrichmentOptions),
                    element: foundry.applications.elements.HTMLProseMirrorElement.create({
                        ...editorOptions,
                        name: \`system.\${field}\`,
                        value: editorValue ?? ""
                    })
                };
            }
            
            /* -------------------------------------------- */
            
            _prepareSubmitData(event, form, formData) {
                // We don't modify the image via the sheet itself, so we can remove it from the submit data to avoid errors.
                delete formData.object.img;
                return super._prepareSubmitData(event, form, formData);
            }

            /* -------------------------------------------- */

            /**
             * Process form submission for the sheet
             * @this {${entry.config.name}EffectVueSheet}     The handler is called with the application as its bound scope
             * @param {SubmitEvent} event                     The originating form submission event
             * @param {HTMLFormElement} form                  The form element that was submitted
             * @param {FormDataExtended} formData             Processed data for the submitted form
             * @returns {Promise<void>}
             */
            static async #onSubmitForm(event, form, formData) {
                let ae = foundry.utils.duplicate(this.document);
                console.log("Updating Active Effect", ae, formData);
                ae.name = formData.object.name;
                ae.description = formData.object.description;
                ae.origin = formData.object.origin;
                ae.disabled = formData.object.disabled;
                ae.transfer = formData.object.transfer;

                if ( !ae.flags["${id}"] ) {
                    ae.flags["${id}"] = {};
                }

                // Retrieve the existing effects.
                let changes = this.document.changes ? [...this.document.changes] : [];

                // Build an array of effects from the form data
                let newChanges = [];

                function addChange(documentName, key, customMode) {
                    const value = foundry.utils.getProperty(formData.object, key);
                    if ( !value ) {
                        // If there is a current change for this key, remove it.
                        changes = changes.filter(c => c.key !== key);
                        return;
                    }
                    const mode = foundry.utils.getProperty(formData.object, key + "-mode");
                    newChanges.push({
                        key: key,
                        value: value,
                        mode: mode
                    });
                    if ( customMode ) ae.flags["${id}"][key + "-custommode"] = customMode;
                }

                ${joinToNode(entry.documents.filter(d => isActor(d)), document => joinToNode(document.body, property => generateAddValue(document, property), { appendNewLineIfNotEmpty: true }))}

                // Update the existing changes to replace duplicates.
                for (let i = 0; i < changes.length; i++) {
                    const newChange = newChanges.find(c => c.key == changes[i].key);
                    if (newChange) {
                        // Replace with the new change and update the array to prevent duplicates.
                        changes[i] = newChange;
                        newChanges = newChanges.filter(c => c.key != changes[i].key);
                    }
                }

                // Apply the combined effect changes.
                ae.changes = changes.concat(newChanges);

                // Filter changes for empty form fields.
                ae.changes = ae.changes.filter(c => c.value !== null);
                console.log("Active Effect Changes", ae.changes);
                await this.document.update(ae);

                // Rerender the parent sheets to update the effect lists.
                this.document.parent?.sheet?.render();
                if ( this.document.parent?.documentName === "Item" ) {
                    this.document.parent?.parent?.applyActiveEffects();

                    // Wait half a second
                    await new Promise(r => setTimeout(r, 500));
                    this.document.parent?.parent?.sheet?.render();
                }
            }
        }
        `.appendNewLineIfNotEmpty();
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

export function generateActiveEffectHandlebars(id: string, entry: Entry, destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates");
    const generatedFilePath = path.join(generatedFileDir, `active-effect-sheet.hbs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateField(document: Document, property: ClassExpression | Layout): CompositeGeneratorNode | undefined {

        if ( isAccess(property) || isAction(property) || isIfStatement(property) ) return undefined;

        if ( isSection(property) ) {
            if (property.body.length == 0) return undefined;
            let fields = [];
            for (let p of property.body) {
                let field = generateField(document, p);
                if (field != undefined) fields.push(field);
            }
            if (fields.length == 0) return undefined;
            return expandToNode`
                <!-- ${property.name} Section -->
                <fieldset>
                  <legend>{{localize "${property.name}"}}</legend>
                  ${joinToNode(fields, field => field, { appendNewLineIfNotEmpty: true })}
                </fieldset>
            `;
        }

        if (isLayout(property)) {
            return joinToNode(property.body, property => generateField(document, property), { appendNewLineIfNotEmpty: true });
        }

        if ( isHtmlExp(property) || isInitiativeProperty(property) || isStatusProperty(property) || isHookHandler(property) || !isProperty(property)) return;
        if ( property.modifier == "locked" ) return;

        if ( isNumberExp(property) ) {
            // If this is calculated, it's implicitly locked
            if (property.params.find(x => isNumberParamValue(x))) return;
            return expandToNode`
                <div class="form-group">
                    <label>{{localize "${property.name}"}}</label>
                    <select name="${document.name.toLowerCase()}.${getSystemPath(property)}-mode" data-dtype="Number">
                        {{selectOptions numberModes selected=${document.name.toLowerCase()}.${getSystemPath(property)}-mode}}
                    </select>
                    <input type="number" name="${document.name.toLowerCase()}.${getSystemPath(property)}" value="{{${document.name.toLowerCase()}.${getSystemPath(property)}}}" />
                </div>
            `;
        }

        if ( isAttributeExp(property) ) {
            // return expandToNode`
            //     <div class="form-group">
            //         <label>{{localize "${property.name}"}} Value</label>
            //         <select name="${document.name.toLowerCase()}.${getSystemPath(property)}-mode" data-dtype="Number">
            //             {{selectOptions numberModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value-mode}}
            //         </select>
            //         <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value}}" />
            //     </div>
            //     <div class="form-group">
            //         <label>{{localize "${property.name}"}} Max</label>
            //         <select name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max-mode" data-dtype="Number">
            //             {{selectOptions numberModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max-mode}}
            //         </select>
            //         <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max}}" />
            //     </div>
            // `;
            return expandToNode`
                <div class="form-group">
                    <label>{{localize "${property.name}"}} Value</label>
                    <select name="${document.name.toLowerCase()}.${getSystemPath(property)}-mode" data-dtype="Number">
                        {{selectOptions numberModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value-mode}}
                    </select>
                    <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value}}" />
                </div>
            `;
        }

        if (isResourceExp(property)) {
            return expandToNode`
                <div class="form-group">
                    <label>{{localize "${property.name}"}} Current</label>
                    <select name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value-mode" data-dtype="Number">
                        {{selectOptions resourceModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value-mode}}
                    </select>
                    <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value}}" />
                </div>
                <div class="form-group">
                    <label>{{localize "${property.name}"}} Max</label>
                    <select name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max-mode" data-dtype="Number">
                        {{selectOptions numberModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max-mode}}
                    </select>
                    <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max}}" />
                </div>
            `;
        }

        if (isTrackerExp(property)) {
            return expandToNode`
                <div class="form-group">
                    <label>{{localize "${property.name}"}} Min</label>
                    <select name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.min-mode" data-dtype="Number">
                        {{selectOptions numberModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.min-mode}}
                    </select>
                    <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.min" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.min}}" />
                </div>
                <div class="form-group">
                    <label>{{localize "${property.name}"}} Current</label>
                    <select name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value-mode" data-dtype="Number">
                        {{selectOptions resourceModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value-mode}}
                    </select>
                    <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value}}" />
                </div>
                <div class="form-group">
                    <label>{{localize "${property.name}"}} Temp</label>
                    <select name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.temp-mode" data-dtype="Number">
                        {{selectOptions resourceModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.temp-mode}}
                    </select>
                    <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.temp" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.temp}}" />
                </div>
                <div class="form-group">
                    <label>{{localize "${property.name}"}} Max</label>
                    <select name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max-mode" data-dtype="Number">
                        {{selectOptions numberModes selected=${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max-mode}}
                    </select>
                    <input type="number" name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max" value="{{${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max}}" />
                </div>
            `;
        }

        if ( isStringExp(property) ) {
            // if (property.choices != undefined && property.choices.length > 0) {
            //     return expandToNode`
            //         <div class="form-group">
            //             <label>{{localize "${property.name}"}}</label>
            //             <select name="${document.name.toLowerCase()}.${getSystemPath(property)}-mode" data-dtype="String">
            //                 {{selectOptions stringModes selected=${document.name.toLowerCase()}.${getSystemPath(property)}-mode}}
            //             </select>
            //             <select name="${document.name.toLowerCase()}.${getSystemPath(property)}">
            //                 {{selectOptions ${property.name.toLowerCase()}Choices selected=${document.name.toLowerCase()}.${getSystemPath(property)} localize=true }}
            //             </select>
            //         </div>
            //     `;
            // }
            return expandToNode`
                <div class="form-group">
                    <label>{{localize "${property.name}"}}</label>
                    <select name="${document.name.toLowerCase()}.${getSystemPath(property)}-mode" data-dtype="String">
                        {{selectOptions stringModes selected=${document.name.toLowerCase()}.${getSystemPath(property)}-mode}}
                    </select>
                    <input type="text" name="${document.name.toLowerCase()}.${getSystemPath(property)}" value="{{${document.name.toLowerCase()}.${getSystemPath(property)}}}" />
                </div>
            `;
        }

        if ( isBooleanExp(property) ) {
            return expandToNode`
                <div class="form-group">
                    <label>{{localize "${property.name}"}}</label>
                    <select name="${document.name.toLowerCase()}.${getSystemPath(property)}-mode" data-dtype="Boolean">
                        {{selectOptions booleanModes selected=${document.name.toLowerCase()}.${getSystemPath(property)}-mode}}  
                    </select>
                    <input type="checkbox" name="${document.name.toLowerCase()}.${getSystemPath(property)}" {{checked ${document.name.toLowerCase()}.${getSystemPath(property)}}} />
                </div>
            `;
        }

        return;
    }

    function generateDocumentTab(document: Document) : CompositeGeneratorNode | undefined {
        return expandToNode`
            <!-- ${document.name} Tab -->
            <section class="tab" data-tab="${document.name.toLowerCase()}">
                ${joinToNode(document.body, property => generateField(document, property), { appendNewLineIfNotEmpty: true })}
            </section>
        `;
    }


    const fileNode = expandToNode`
        <form  class="{{cssClass}}" autocomplete="off">
            <!-- Effect Header -->
            <header class="sheet-header">
                <img class="effect-icon effect-img" src="{{ effect.img }}" data-edit="img">
                <h1 class="effect-title"><input type="text" name="name" value="{{effect.name}}" placeholder="{{localize 'ARCHMAGE.name'}}"/></h1>
            </header>

            <article class="sheet-content">
                <section class="sheet-body">
                    <!-- Effect Configuration Tabs -->
                    <nav class="sheet-tabs tabs">
                        <a class="item" data-tab="info"><i class="fas fa-book"></i> {{localize "Info"}}</a>
                        ${joinToNode(entry.documents.filter(d => isActor(d)), property => `<a class="item" data-tab="${property.name.toLowerCase()}">{{localize "${property.name}"}}</a>`, { appendNewLineIfNotEmpty: true })}
                    </nav>

                    <div class="sheet-tabs-content">
                        <!-- Info Tab -->
                        <section class="tab" data-tab="info">
                            <div class="form-group stacked">
                                <label>{{ localize "EFFECT.Description" }}</label>
                                {{editor descriptionHTML target="description" button=false editable=editable engine="prosemirror" collaborate=false}}
                            </div>

                            <div class="form-group">
                                <label>{{ localize "EFFECT.Disabled" }}</label>
                                <input type="checkbox" name="disabled" {{ checked effect.disabled }}/>
                            </div>

                            {{#if originLink}}
                            <div class="form-group">
                                <label>{{ localize "EFFECT.Origin" }}</label>
                                {{{originLink}}}
                            </div>
                            {{/if}}

                            {{#if isItemEffect}}
                            <div class="form-group">
                                <label>{{ labels.transfer.name }}</label>
                                <div class="form-fields">
                                    <input type="checkbox" name="transfer" {{checked data.transfer}}/>
                                </div>
                                <p class="hint">{{ labels.transfer.hint }}</p>
                            </div>
                            {{/if}}
                        </div>

                        ${joinToNode(entry.documents, property => generateDocumentTab(property), { appendNewLineIfNotEmpty: true })}
                    </section>
                </section>
            </article>
        </form>
    `.appendNewLineIfNotEmpty();
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
