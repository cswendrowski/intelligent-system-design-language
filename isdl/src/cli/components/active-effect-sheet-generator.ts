import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ClassExpression, Document, Entry, Section, isAccess, isAction, isActor, isAttributeExp, isBooleanExp, isHtmlExp, isIfStatement, isNumberExp, isSection, isStringExp } from '../../language/generated/ast.js';
import { getSystemPath } from './utils.js';

export function generateBaseActiveEffectBaseSheet(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "sheets");
    const generatedFilePath = path.join(generatedFileDir, `active-effect-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateAddValue(document: Document, property: ClassExpression | Section): CompositeGeneratorNode | undefined {

        if ( isAccess(property) || isAction(property) || isIfStatement(property) ) return undefined;

        if ( isSection(property) ) {
            return joinToNode(property.body, property => generateAddValue(document, property), { appendNewLineIfNotEmpty: true });
        }

        if ( isHtmlExp(property) ) return;
        if ( property.modifier == "readonly" ) return;

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
        export default class ${entry.config.name}EffectSheet extends ActiveEffectConfig {

            /** @override */
            static get defaultOptions() {
                return mergeObject(super.defaultOptions, {
                    classes: ["${id}", "sheet", "active-effect", "active-effect-sheet"],
                    template: "systems/${id}/system/templates/active-effect-sheet.hbs",
                    width: 600,
                    height: 600,
                    tabs: [{navSelector: ".tabs", contentSelector: "form", initial: "info"}],
                    closeOnSubmit: false,
                    submitOnChange: true
                });
            }

            /* -------------------------------------------- */

            /** @override */
            async getData() {
                const context = await super.getData();
                if ( context.effect.origin ) {
                    context.originLink = await TextEditor.enrichHTML("@UUID[" + context.effect.origin + "]");
                }

                function setValue(obj, access, value, mode){
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

                const modes = CONST.ACTIVE_EFFECT_MODES;
                const numberModes = [modes.MULTIPLY, modes.ADD, modes.DOWNGRADE, modes.UPGRADE, modes.OVERRIDE];
                const stringModes = [modes.OVERRIDE];
                const booleanModes = [modes.OVERRIDE];

                context.numberModes = numberModes.reduce((obj, mode) => {
                    obj[mode] = context.modes[mode];
                    return obj;
                }, {});
                context.stringModes = stringModes.reduce((obj, mode) => {
                    obj[mode] = context.modes[mode];
                    return obj;
                }, {});
                context.booleanModes = booleanModes.reduce((obj, mode) => {
                    obj[mode] = context.modes[mode];
                    return obj;
                }, {});

                return context;
            }

            /* -------------------------------------------- */

            async _updateObject(event, formData) {
                let ae = foundry.utils.duplicate(this.object);
                ae.name = formData.name;
                ae.icon = formData.icon;
                ae.description = formData.description;
                ae.origin = formData.origin;

                // Retrieve the existing effects.
                const effectData = await this.getData();
                let changes = effectData?.data?.changes ? effectData.data.changes : [];

                // Build an array of effects from the form data
                let newChanges = [];

                function addChange(documentName, key) {
                    const value = foundry.utils.getProperty(formData, key);
                    if ( !value ) return;
                    const mode = foundry.utils.getProperty(formData, key + "-mode");
                    newChanges.push({
                        key: key,
                        value: value,
                        mode: mode
                    });
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

                await this.object.update(ae);

                // Rerender the parent sheets to update the effect lists.
                this.object.parent?.sheet?.render();
                if ( this.object.parent?.documentName === "Item" ) {
                    this.object.parent?.parent?.applyActiveEffects();

                    // Wait half a second
                    await new Promise(r => setTimeout(r, 500));
                    this.object.parent?.parent?.sheet?.render();
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

    function generateField(document: Document, property: ClassExpression | Section): CompositeGeneratorNode | undefined {
        
        if ( isAccess(property) || isAction(property) || isIfStatement(property) ) return undefined;

        if ( isSection(property) ) {
            return expandToNode`
                <!-- ${property.name} Section -->
                <fieldset>
                  <legend>{{localize "${property.name}"}}</legend>
                  ${joinToNode(property.body, property => generateField(document, property), { appendNewLineIfNotEmpty: true })}
                </fieldset>
            `;
        }

        if ( isHtmlExp(property) ) return;
        if ( property.modifier == "readonly" ) return;

        if ( isNumberExp(property) ) {
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
                <img class="effect-icon" src="{{ effect.icon }}" data-edit="icon">
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
                                <input type="checkbox" name="effect.disabled" {{ checked effect.disabled }}/>
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