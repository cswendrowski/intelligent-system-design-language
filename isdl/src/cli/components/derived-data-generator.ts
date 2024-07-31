import type {
    ClassExpression,
    Document,
    Entry,
    Section,
    MethodBlock,
} from '../../language/generated/ast.js';
import {
    isActor,
    isItem,
    isSection,
    isResourceExp,
    isAttributeExp,
    isMethodBlock,
    isDocumentArrayExp,
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

        function generateDerivedAttribute(property: ClassExpression | Section): CompositeGeneratorNode | undefined {

            if ( isSection(property) ) {
                return joinToNode(property.body, property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true });
            }

            if ( isAttributeExp(property) ) {
                console.log("Processing Derived Attribute: " + property.name);
                return expandToNode`

                    // ${property.name} Attribute Derived Data
                    const ${property.name.toLowerCase()}CurrentValue = this.system.${property.name.toLowerCase()} ?? 0;
                    const ${property.name.toLowerCase()}ModFunc = (system) => {
                        ${translateExpression(id, property.method, true)}
                    };
                    this.system.${property.name.toLowerCase()} = {
                        value: ${property.name.toLowerCase()}CurrentValue,
                        mod: ${property.name.toLowerCase()}ModFunc(this.system)
                    };
                `.appendNewLineIfNotEmpty();
            };

            if ( isResourceExp(property) && property.max != undefined && isMethodBlock(property.max) ) {
                console.log("Processing Derived Resource: " + property.name);
                return expandToNode`
                    // ${property.name} Resource Derived Data
                    const ${property.name.toLowerCase()}CurrentValue = this.system.${property.name.toLowerCase()}.value ?? 0;
                    const ${property.name.toLowerCase()}MaxFunc = (system) => {
                        ${translateExpression(id, property.max as MethodBlock, true)}
                    };
                    this.system.${property.name.toLowerCase()} = {
                        value: ${property.name.toLowerCase()}CurrentValue,
                        max: ${property.name.toLowerCase()}MaxFunc(this.system)
                    };
                `.appendNewLineIfNotEmpty();
            }

            if ( isDocumentArrayExp(property) ) {
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
                }
            `.appendNewLineIfNotEmpty();
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

                // In order to support per-document type effects, we need to override the allApplicableEffects method to yield virtualized effects with only changes that match the document type
                /** @override */
                *allApplicableEffects() {
                    const systemFlags = this.flags["fabula-ultima"] ?? {};
                    const edit = systemFlags["edit-mode"] ?? true;

                    function getTypedEffect(type, edit, effect) {
                        const typedEffect = new ActiveEffect(foundry.utils.duplicate(effect));
                        typedEffect.changes = typedEffect.changes.filter(c => c.key.startsWith(type));
                        for ( const change of typedEffect.changes ) {
                            change.key = change.key.replace(type + ".", "");
                        }
                        if ( edit ) typedEffect.disabled = true;
                        return typedEffect;
                    }

                    for ( const effect of this.effects ) {
                        yield getTypedEffect(this.type, edit, effect);
                    }
                    for ( const item of this.items ) {
                        for ( const effect of item.effects ) {
                            if ( effect.transfer ) yield getTypedEffect(this.type, edit, effect);
                        }
                    }
                }
            }
            `.appendNewLineIfNotEmpty();
        fs.writeFileSync(generatedFilePath, toString(fileNode));
    }

    generateExtendedDocumentClass("Actor", entry);
    generateExtendedDocumentClass("Item", entry);
}
