import type {
    ClassExpression,
    Document,
    Entry,
    NumberParamInitial,
    NumberParamMax,
    NumberParamMin,
    Page,
    PaperDollElement,
    Section,
    StatusParamWhen,
    StringParamChoices,
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
    isStringParamChoices,
    StatusProperty,
    isStatusProperty,
    isStatusParamWhen,
    isDateExp,
    isTimeExp,
    isDateTimeExp,
    isPaperDollExp,
    isParentPropertyRefExp,
    isDocumentChoiceExp
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAllOfType, toMachineIdentifier } from './utils.js';
import { translateExpression } from './method-generator.js';

export function generateDocumentDataModel(entry: Entry, document: Document, destination: string) {
    const typePath = isActor(document) ? 'actor' : 'item';
    const dataModelPath = path.join(destination, "system", "datamodels", typePath);
    const generatedFilePath = `${path.join(dataModelPath, document.name.toLowerCase())}.mjs`;
    const config = entry.config;
    const id = config.body.find(x => x.type == "id")!.value;

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
            let choices = property.params.find(p => isStringParamChoices(p)) as StringParamChoices;
            if (choices != undefined && choices.choices.length > 0) {
                return expandToNode`
                    ${property.name.toLowerCase()}: new fields.StringField({
                        choices: [${choices.choices.map(x => `"${toMachineIdentifier(x)}"`).join(", ")}],
                        initial: "${toMachineIdentifier(choices.choices[0])}"
                    }),
                `;
            }
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.StringField({initial: ""}),
            `;
        }
        if (isDateExp(property)) {
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.StringField({initial: new Intl.DateTimeFormat('en-CA').format(new Date()) }),
            `;
        }
        if (isTimeExp(property)) {
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.StringField({initial: new Date().toTimeString().slice(0, 5) }),
            `;
        }
        if (isDateTimeExp(property)) {
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.StringField({initial: new Date().toISOString().slice(0, 16) }),
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
            const minParam = property.params.find(p => isNumberParamMin(p)) as NumberParamMin;
            const maxParam = property.params.find(p => isNumberParamMax(p)) as NumberParamMax;
            const min = minParam?.value ?? 0;
            const max = maxParam?.value ?? 100;
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    value: new fields.NumberField({integer: true, min: ${min}, initial: ${min}}),
                    max: new fields.NumberField({integer: true, min: 0, initial: ${max}}),
                }),
            `;
        }

        if ( isPipsExp(property) ) {
            const maxParam = property.params.find(x => isNumberParamMax(x)) as NumberParamMax;
            const minParam = property.params.find(x => isNumberParamMin(x)) as NumberParamMin;
            const initialParam = property.params.find(x => isNumberParamInitial(x)) as NumberParamInitial;

            let options = "integer: true";

            if (maxParam && typeof(maxParam.value) === 'number') {
                options += `, max: ${maxParam.value}`;
            }

            if (minParam && typeof(minParam.value) === 'number') {
                options += `, min: ${minParam.value}`;
            }

            if (initialParam && typeof(initialParam.value) === 'number') {
                options += `, initial: ${initialParam.value}`;
            }

            return expandToNode`
                ${property.name.toLowerCase()}: new fields.NumberField({${options}}),
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

        if (isDocumentChoiceExp(property)) {
            // const multiple = (property.params.find(p => isMultipleParam(p)) as MultipleParam | undefined)?.value ?? false;

            // if (multiple) {
            //     return expandToNode`
            //         ${property.name.toLowerCase()}: new fields.ArrayField(new UuidDocumentField()),
            //     `;
            // }

            return expandToNode`
                ${property.name.toLowerCase()}: new UuidDocumentField(),
            `;
        }

        if (isPaperDollExp(property)) {

            function generatePaperDollElementField(property: PaperDollElement): CompositeGeneratorNode | undefined {
                return expandToNode`
                    ${property.name.toLowerCase()}: new UuidDocumentField()
                `;
            }

            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    ${joinToNode(property.elements, property => generatePaperDollElementField(property), { appendNewLineIfNotEmpty: true, separator: ',' })}
                }),
            `;
        }

        if (isParentPropertyRefExp(property)) {
            console.log(`Parent property ref: ${property.name}`);

            return expandToNode`
                ${property.name.toLowerCase()}: new fields.StringField({initial: ""}),
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

    function generateCalculatedStatusEffect(property: StatusProperty): CompositeGeneratorNode | undefined {
        let whenParam = property.params.find(p => isStatusParamWhen(p)) as StatusParamWhen;

        if (whenParam == undefined || whenParam.when == undefined) return undefined;

        console.log(`Generating calculated status effect for ${property.name}`);

        return expandToNode`
            get ${property.name.toLowerCase()}() {
                return ${translateExpression(entry, id, whenParam?.when, true, property)};
            }
        `.appendNewLine().appendNewLine();
    }

    function generateStatusEffect(property: StatusProperty): CompositeGeneratorNode {
        return expandToNode`
            get ${property.name.toLowerCase()}() {
                return this.parent.statuses.has("${property.name.toLowerCase()}");
            }
        `;
    }

    let statusEffects = getAllOfType<StatusProperty>(document.body, isStatusProperty);
    let calculatedStatusEffects = statusEffects.filter(x => x.params.some(p => isStatusParamWhen(p)));
    let nonCalculatedStatusEffects = statusEffects.filter(x => !x.params.some(p => isStatusParamWhen(p)));

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

            /* -------------------------------------------- */

            ${joinToNode(calculatedStatusEffects, effect => generateCalculatedStatusEffect(effect), { appendNewLineIfNotEmpty: true })}
            ${joinToNode(nonCalculatedStatusEffects, effect => generateStatusEffect(effect), { appendNewLineIfNotEmpty: true })}
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
