import type {
    ClassExpression,
    Config,
    Document,
    Page,
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
    isPipsExp,
    isDamageTrackExp,
    isSingleDocumentExp,
    isNumberParamInitial,
    isNumberParamMin,
    isNumberParamMax,
    isPage,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { toMachineIdentifier } from './utils.js';

export function generateDocumentDataModel(config: Config, document: Document, destination: string) {
    const typePath = isActor(document) ? 'actor' : 'item';
    const dataModelPath = path.join(destination, "system", "datamodels", typePath);
    const generatedFilePath = `${path.join(dataModelPath, document.name.toLowerCase())}.mjs`;

    function generateField(property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {

        if (isNumberExp(property)) {

            // Check to see if we have literal values for min, initial, and max
            let options = "integer: true";

            const initalParam = property.params.find(p => isNumberParamInitial(p));
            const minParam = property.params.find(p => isNumberParamMin(p));
            const maxParam = property.params.find(p => isNumberParamMax(p));

            if (initalParam && typeof(initalParam.value) === 'number') {
                options += `, initial: ${initalParam.value}`;
            }
            if (minParam && typeof(minParam.value) === 'number') {
                options += `, min: ${minParam.value}`;
            }
            if (maxParam && typeof(maxParam.value) === 'number') {
                options += `, max: ${maxParam.value}`;
            }

            return expandToNode`
                ${property.name.toLowerCase()}: new fields.NumberField({${options}}),
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
            const max = typeof(property.max) === 'number' ? property.max ?? 0 : 0;
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    value: new fields.NumberField({initial: ${max}, integer: true}),
                    temp: new fields.NumberField({initial: 0, min: 0, integer: true}),
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

        if (isSingleDocumentExp(property)) {
            return expandToNode`
                ${property.name.toLowerCase()}: new UuidDocumentField(),
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

        if (isPage(property)) {
            return joinToNode(property.body, property => generateField(property), { appendNewLineIfNotEmpty: true });
        }

        return
    }

    // Name and img come with all docs. We'll go ahead and staple Description on as well
    const fileNode = expandToNode`
        import ${config.name}Actor from "../../documents/actor.mjs";
        import ${config.name}Item from "../../documents/item.mjs";
        import UuidDocumentField from "../UuidDocumentField.mjs";

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

export function generateUuidDocumentField(destination: string) {
    const dataModelPath = path.join(destination, "system", "datamodels");
    const generatedFilePath = path.join(dataModelPath, "UuidDocumentField.mjs");

    const fileNode = expandToNode`
        export default class UuidDocumentField extends foundry.data.fields.StringField {

            /** @inheritdoc */
            static get _defaults() {
            return foundry.utils.mergeObject(super._defaults, {
                required: true,
                blank: false,
                nullable: true,
                initial: null,
                readonly: false,
                validationError: "is not a valid Document UUID string"
            });
            }
        
            /** @override */
            _cast(value) {
                if ( value instanceof foundry.abstract.Document ) return value.uuid;
                else return String(value);
            }

            /** @inheritdoc */
            initialize(value, model, options={}) {
                if ( !game.collections ) return value; // server-side

                return () => fromUuidSync(value);
            }
        }
    `.appendNewLineIfNotEmpty();

    if (!fs.existsSync(dataModelPath)) {
        fs.mkdirSync(dataModelPath, { recursive: true });
    }
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
