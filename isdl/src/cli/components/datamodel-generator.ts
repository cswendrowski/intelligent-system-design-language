import type {
    ClassExpression,
    Config,
    Document,
    Section,
} from '../../language/generated/ast.js';
import {
    isActor,
    isNumberExp,
    isHtmlExp,
    isSection,
    isStringExp,
    isBooleanExp,
    isResourceExp,
    isAttributeExp,
    isLiteral,
    isPipsExp,
    isDamageTrackExp,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { toMachineIdentifier } from './utils.js';

export function generateDocumentDataModel(config: Config, document: Document, destination: string) {
    const typePath = isActor(document) ? 'actor' : 'item';
    const dataModelPath = path.join(destination, "system", "datamodels", typePath);
    const generatedFilePath = `${path.join(dataModelPath, document.name.toLowerCase())}.mjs`;

    function generateField(property: ClassExpression | Section): CompositeGeneratorNode | undefined {

        if (isNumberExp(property)) {
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.NumberField({initial: 0, integer: true}),
            `;
        }
        if (isStringExp(property)) {
            if (property.choices != undefined && property.choices.length > 0) {
                return expandToNode`
                    ${property.name.toLowerCase()}: new fields.StringField({
                        choices: [${property.choices.map(x => `"${toMachineIdentifier(x)}"`).join(", ")}],
                        initial: "${toMachineIdentifier(property.choices[0])}"
                    }),
                `;
            }
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.StringField({initial: ""}),
            `;
        }
        if (isHtmlExp(property)) {
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.HTMLField({required: false, blank: true, initial: ""}),
            `;
        }
        if (isBooleanExp(property)) {
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.BooleanField(),
            `;
        }
        if (isResourceExp(property)) {
            const max = isLiteral(property.max) ? property.max?.val ?? 0 : 0;
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    value: new fields.NumberField({initial: ${max}, integer: true}),
                    max: new fields.NumberField({min: 0, initial: ${max}, integer: true}),
                }),
            `;
        }
        if (isAttributeExp(property)) {
            const min = property.min ?? 0;
            const max = property.max ?? 0;
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.NumberField({integer: true, min: ${min}, max: ${max}, initial: ${min}}),
            `;
        }
        if ( isPipsExp(property) ) {
            let max = 0;
            if ( Number.isInteger(property.max) ) {
                max = property.max as number;
            }
            let initial = 0;
            if ( Number.isInteger(property.initial) ) {
                initial = property.initial as number;
            }
            if ( max > 0 ) {
                return expandToNode`
                    ${property.name.toLowerCase()}: new fields.NumberField({initial: ${initial}, min: 0, max: ${max}, integer: true}),
                `;
            }
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.NumberField({initial: ${initial}, min: 0, integer: true}),
            `;
        }
        if ( isDamageTrackExp(property) ) {
            if ( Number.isInteger(property.max) ) {
                return expandToNode`
                    ${property.name.toLowerCase()}: new fields.SchemaField({
                        empty: new fields.NumberField({initial: ${property.max}, min: 0, max: ${property.max}, integer: true}),
                        ${joinToNode(property.types, type => `${type}: new fields.NumberField({initial: 0, min: 0, max: ${property.max}, integer: true}),`, { appendNewLineIfNotEmpty: true })}
                    }),
                `;
            }
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    "empty": new fields.NumberField({initial: 0, min: 0, integer: true}),
                    ${joinToNode(property.types, type => `${type}: new fields.NumberField({initial: 0, min: 0, integer: true}),`, { appendNewLineIfNotEmpty: true })}
                }),
            `;
        }

        // if ( isDocumentArrayExp(property) ) {
        //     return expandToNode`
        //         ${property.name.toLowerCase()}: new fields.EmbeddedCollectionField(new fields.ForeignDocumentField(, {required: true, type: "${property.document.ref?.name.toLowerCase()}"})),
        //     `;
        // }

        if (isSection(property)) {
            return joinToNode(property.body, property => generateField(property), { appendNewLineIfNotEmpty: true });

            // TODO: It would be nice to support sections in the data model, but we would need to complicate 
            // how we do html template generation to point to the section path, which is possibly nested.
            // return expandToNode`
            //     ${property.name.toLowerCase()}: new fields.SchemaField({
            //         ${joinToNode(property.body, property => generateField(property), { appendNewLineIfNotEmpty: true })}
            //     }),
            // `;
        }
        return
    }

    // Name and img come with all docs. We'll go ahead and staple Description on as well
    const fileNode = expandToNode`
        import ${config.name}Actor from "../../documents/actor.mjs";
        import ${config.name}Item from "../../documents/item.mjs";

        export default class ${document.name}TypeDataModel extends foundry.abstract.DataModel {
            /** @inheritDoc */
            static defineSchema() {
                const fields = foundry.data.fields;
                return {
                    description: new fields.HTMLField({required: false, blank: true, initial: ""}),
                    ${joinToNode(document.body, property => generateField(property), { appendNewLineIfNotEmpty: true })}
                };
            }
        };
    `.appendNewLineIfNotEmpty();

    if (!fs.existsSync(dataModelPath)) {
        fs.mkdirSync(dataModelPath, { recursive: true });
    }
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
