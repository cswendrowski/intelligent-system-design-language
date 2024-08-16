import type {
    ClassExpression,
    Document,
    Entry,
    Section,
    MethodBlock,
    NumberParameter,
    NumberExp,
    Page,
} from '../../language/generated/ast.js';
import {
    isActor,
    isItem,
    isSection,
    isResourceExp,
    isAttributeExp,
    isMethodBlock,
    isDocumentArrayExp,
    isNumberExp,
    isNumberParamMax,
    isNumberParamValue,
    isNumberParamMin,
    isWhereParam,
    isPage,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { translateExpression } from './method-generator.js';

export function generateExtendedDocumentClasses(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "documents");


    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateExtendedDocumentClass(type: string, entry: Entry) {
        const generatedFilePath = path.join(generatedFileDir, `${type.toLowerCase()}.mjs`);

        const toBeReapplied = new Set<string>();
        function generateDerivedAttribute(property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {

            if (isSection(property)) {
                return joinToNode(property.body, property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true });
            }

            if (isPage(property)) {
                return joinToNode(property.body, property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true });
            }

            if (isNumberExp(property)) {
                function translateMethodOrValueOrStored(property: NumberExp, param: NumberParameter | undefined): CompositeGeneratorNode {
                    if (param == undefined) {
                        return expandToNode`
                            return system.${property.name.toLowerCase()} ?? 0
                        `
                    }

                    if (isMethodBlock(param.value)) {

                        if (isNumberParamValue(param)) {
                            toBeReapplied.add("system." + property.name.toLowerCase());
                        }

                        return expandToNode`
                            ${translateExpression(entry, id, param.value, true, property)}
                        `
                    }

                    return expandToNode`
                        return ${param.value}
                    `
                }

                const valueParam = property.params.find(p => isNumberParamValue(p));
                const minParam = property.params.find(p => isNumberParamMin(p));
                const maxParam = property.params.find(p => isNumberParamMax(p));

                return expandToNode`
                    // ${property.name} Number Derived Data
                    const ${property.name.toLowerCase()}CurrentValueFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, valueParam)}
                    };
                    this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}CurrentValueFunc(this.system);

                    ${minParam != undefined ? expandToNode`
                    const ${property.name.toLowerCase()}MinFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, minParam)}
                    };
                    const ${property.name.toLowerCase()}Min = ${property.name.toLowerCase()}MinFunc(this.system);
                    if ( this.system.${property.name.toLowerCase()} < ${property.name.toLowerCase()}Min ) {
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}Min;
                    }
                    `.appendNewLine() : ""}

                    ${maxParam != undefined ? expandToNode`
                    const ${property.name.toLowerCase()}MaxFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, maxParam)}
                    };
                    const ${property.name.toLowerCase()}Max = ${property.name.toLowerCase()}MaxFunc(this.system);
                    if ( this.system.${property.name.toLowerCase()} > ${property.name.toLowerCase()}Max ) {
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}Max;
                    }
                    `.appendNewLine() : ""}
                `.appendNewLineIfNotEmpty();
            }

            if ( isAttributeExp(property) ) {
                console.log("Processing Derived Attribute: " + property.name);
                return expandToNode`

                    // ${property.name} Attribute Derived Data
                    const ${property.name.toLowerCase()}CurrentValue = this.system.${property.name.toLowerCase()} ?? 0;
                    const ${property.name.toLowerCase()}ModFunc = (system) => {
                        ${translateExpression(entry, id, property.method, true, property)}
                    };
                    this.system.${property.name.toLowerCase()} = {
                        value: ${property.name.toLowerCase()}CurrentValue,
                        mod: ${property.name.toLowerCase()}ModFunc(this.system)
                    };
                `.appendNewLineIfNotEmpty();
            };

            if ( isResourceExp(property) && property.max != undefined && isMethodBlock(property.max) ) {
                console.log("Processing Derived Resource: " + property.name);
                toBeReapplied.add("system." + property.name.toLowerCase() + ".max");
                return expandToNode`
                    // ${property.name} Resource Derived Data
                    const ${property.name.toLowerCase()}CurrentValue = this.system.${property.name.toLowerCase()}.value ?? 0;
                    const ${property.name.toLowerCase()}TempValue = this.system.${property.name.toLowerCase()}.temp ?? 0;
                    const ${property.name.toLowerCase()}MaxFunc = (system) => {
                        ${translateExpression(entry, id, property.max as MethodBlock, true, property)}
                    };
                    this.system.${property.name.toLowerCase()} = {
                        value: ${property.name.toLowerCase()}CurrentValue,
                        temp: ${property.name.toLowerCase()}TempValue,
                        max: ${property.name.toLowerCase()}MaxFunc(this.system)
                    };
                    if ( this.system.${property.name.toLowerCase()}.value > this.system.${property.name.toLowerCase()}.max ) {
                        this.system.${property.name.toLowerCase()}.value = this.system.${property.name.toLowerCase()}.max;
                    }
                `.appendNewLineIfNotEmpty();
            }

            if ( isDocumentArrayExp(property) ) {
                console.log("Processing Derived Document Array: " + property.name);

                const whereParam = property.params.find(p => isWhereParam(p));
                if ( whereParam ) {
                    return expandToNode`
                    // ${property.name} Document Array Derived Data
                    this.system.${property.name.toLowerCase()} = this.items.filter((item) => {
                        if ( item.type !== "${property.document.ref?.name.toLowerCase()}") return false;
                        return ${translateExpression(entry, id, whereParam.value, true, property)};
                    });
                    `.appendNewLineIfNotEmpty();
                }
                return expandToNode`
                    // ${property.name} Document Array Derived Data
                    // this.system.${property.name.toLowerCase()} = this.system.${property.name.toLowerCase()}.map((item) => {
                    //     return item();
                    // });
                    this.system.${property.name.toLowerCase()} = this.items.filter((item) => item.type == "${property.document.ref?.name.toLowerCase()}");
                `.appendNewLineIfNotEmpty();
            }

            return
        }

        function generateDerivedData(document: Document): CompositeGeneratorNode | undefined {
            return expandToNode`
                async _prepare${document.name}DerivedData() {
                    ${joinToNode(document.body, property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true })}

                    ${isActor(document) ? expandToNode`
                        // Reapply Active Effects for calculated values
                        ${joinToNode(toBeReapplied, name => expandToNode`this.reapplyActiveEffectsForName("${name}");`, { appendNewLineIfNotEmpty: true})}
                    ` : ""}
                }
            `.appendNewLineIfNotEmpty().appendNewLine();
        }

        const fileNode = expandToNode`
            export default class ${entry.config.name}${type} extends ${type} {
                /** @override */
                prepareDerivedData() {
                    switch ( this.type ) {
                        ${joinToNode(entry.documents.filter(d => type == "Actor" ? isActor(d) : isItem(d)), document => `case "${document.name.toLowerCase()}": return this._prepare${document.name}DerivedData();`, { appendNewLineIfNotEmpty: true })}
                    }
                }

                /* -------------------------------------------- */

                ${joinToNode(entry.documents.filter(d => type == "Actor" ? isActor(d) : isItem(d)), document => generateDerivedData(document), { appendNewLineIfNotEmpty: true })}
            
                /* -------------------------------------------- */

                reapplyActiveEffectsForName(name) {
                    for (const effect of this.appliedEffects) {
                        for (const change of effect.changes) {
                            if (change.key == name) {
                                const changes = effect.apply(this, change);
                                Object.assign(this.overrides, changes);
                            }
                        }
                    }
                }

                /* -------------------------------------------- */

                // In order to support per-document type effects, we need to override the allApplicableEffects method to yield virtualized effects with only changes that match the document type
                /** @override */
                *allApplicableEffects() {
                    const systemFlags = this.flags["${id}"] ?? {};
                    const edit = systemFlags["edit-mode"] ?? true;

                    function getTypedEffect(type, edit, effect, source) {
                        const typedEffect = new ActiveEffect(foundry.utils.duplicate(effect));
                        typedEffect.changes = typedEffect.changes.filter(c => c.key.startsWith(type));
                        for ( const change of typedEffect.changes ) {
                            change.key = change.key.replace(type + ".", "");
                        }
                        if ( edit ) typedEffect.disabled = true;
                        typedEffect.source = source;
                        return typedEffect;
                    }

                    for ( const effect of this.effects ) {
                        yield getTypedEffect(this.type, edit, effect, game.i18n.localize("Self"));
                    }
                    for ( const item of this.items ) {
                        for ( const effect of item.effects ) {
                            if ( effect.transfer ) yield getTypedEffect(this.type, edit, effect, item.name);
                        }
                    }
                }

                /* -------------------------------------------- */

                _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
                    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);

                    for (const document of documents) {
                        if (document.documentName !== "ActiveEffect") continue;
                        
                        for (const change of document.changes) {
                            if (change.mode != 0) continue;
                            const customMode = foundry.utils.getProperty(document.flags["${id}"], change.key + "-custommode");
                            switch (customMode) {
                                case 1: // Add Once
                                    this._effectAddOnce(parent, document, change);
                                    break;
                                default:
                                    console.error("Unknown custom mode", customMode);
                                    break;
                            }
                        }
                    }
                }

                /* -------------------------------------------- */

                _effectAddOnce(parent, ae, change) {
                    console.dir("AddOnce", parent, ae, change);

                    const key = change.key.replace(parent.type + ".", "");
                    const currentValue = foundry.utils.getProperty(parent.data, key);

                    // Create an update for the parent
                    const update = {
                        [key]: currentValue + parseInt(change.value)
                    };
                    parent.update(update);

                    // Create a chat card
                    const chatData = {
                        user: game.user._id,
                        speaker: ChatMessage.getSpeaker({ actor: parent }),
                        content: \`<p>Added "\${ae.name}" once</p>\`
                    };
                    ChatMessage.create(chatData);
                }
            }
            `.appendNewLineIfNotEmpty();
        fs.writeFileSync(generatedFilePath, toString(fileNode));
    }

    generateExtendedDocumentClass("Actor", entry);
    generateExtendedDocumentClass("Item", entry);
}
