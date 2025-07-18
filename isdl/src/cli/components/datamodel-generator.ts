import type {
    Action,
    ClassExpression, DieInitialParam,
    Document,
    Entry,
    NumberParamInitial,
    NumberParamMax,
    NumberParamMin,
    PaperDollElement,
    Prompt,
    StatusParamWhen,
    StringParamChoices,
    VariableExpression,
} from '../../language/generated/ast.js';
import {
    isActor,
    isNumberExp,
    isHtmlExp,
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
    isStringParamChoices,
    StatusProperty,
    isStatusProperty,
    isStatusParamWhen,
    isDateExp,
    isTimeExp,
    isDateTimeExp,
    isPaperDollExp,
    isParentPropertyRefExp,
    isDocumentChoiceExp,
    isAction,
    isVariableExpression,
    isPrompt,
    isTrackerExp,
    isDiceFields,
    isDieField,
    isDieInitialParam,
    isDiceField,
    Layout,
    isLayout,
    isMacroField,
    isMeasuredTemplateField,
    isLabelParam,
    LabelParam,
    isChoiceStringValue,
    ChoiceStringValue,
    isStringExtendedChoice,
    StringChoice, isStringChoiceField, ChoiceCustomProperty, isChoiceCustomProperty
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAllOfType, toMachineIdentifier } from './utils.js';
import { translateExpression } from './method-generator.js';
import { AstUtils } from 'langium';

export function generateDocumentDataModel(entry: Entry, document: Document, destination: string) {
    const typePath = isActor(document) ? 'actor' : 'item';
    const dataModelPath = path.join(destination, "system", "datamodels", typePath);
    const generatedFilePath = `${path.join(dataModelPath, document.name.toLowerCase())}.mjs`;
    const config = entry.config;
    const id = config.body.find(x => x.type == "id")!.value;

    function generateField(property: ClassExpression | Layout): CompositeGeneratorNode | undefined {

        if (isNumberExp(property)) {

            // Check to see if we have literal values for min, initial, and max
            let options = "integer: true";

            const minParam = property.params.find(p => isNumberParamMin(p)) as NumberParamMin;
            const maxParam = property.params.find(p => isNumberParamMax(p)) as NumberParamMax;
            const initialParam = property.params.find(p => isNumberParamInitial(p)) as NumberParamInitial;

            if (initialParam && typeof(initialParam.value) === 'number') {
                options += `, initial: ${initialParam.value}`;
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

                function choiceValue(choice: StringChoice): string {
                    if (!isStringExtendedChoice(choice.value)) {
                        return toMachineIdentifier(choice.value);
                    }
                    let value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                    if (value) {
                        return toMachineIdentifier(value.value);
                    }
                    let label = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
                    if (label) {
                        return toMachineIdentifier(label.value);
                    }
                    return "unknown";
                }

                return expandToNode`
                    ${property.name.toLowerCase()}: new fields.StringField({
                        choices: [${choices.choices.map(x => `"${choiceValue(x)}"`).join(", ")}],
                        initial: "${choiceValue(choices.choices[0])}"
                    }),
                `;
            }
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.StringField({initial: ""}),
            `;
        }

        if (isStringChoiceField(property)) {
            let choices = property.params.find(p => isStringParamChoices(p)) as StringParamChoices;

            function choiceValue(choice: StringChoice): string {
                if (!isStringExtendedChoice(choice.value)) {
                    return toMachineIdentifier(choice.value);
                }
                let value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                if (value) {
                    return toMachineIdentifier(value.value);
                }
                let label = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
                if (label) {
                    return toMachineIdentifier(label.value);
                }
                return "unknown";
            }

            function getDefaultValueForType(type: string): any {
                switch (type) {
                    case 'string':
                        return '';
                    case 'number':
                        return 0;
                    case 'boolean':
                        return false;
                    default:
                        return null; // or throw an error if you prefer
                }
            }

            // For each extended choice, we need to gather a list of additional custom fields such as  bonus: 0 and add them to the datamodel
            let additionalFields = choices.choices.reduce((acc, choice) => {
                if (isStringExtendedChoice(choice.value)) {
                    let customProperties = choice.value.properties.filter(isChoiceCustomProperty) as ChoiceCustomProperty[];

                    customProperties.forEach(prop => {
                        // Only add if we haven't seen this field name before
                        if (!acc.find(field => field.key === prop.key)) {
                            acc.push({
                                key: prop.key,
                                type: typeof prop.value, // or determine type from prop.value
                                defaultValue: getDefaultValueForType(typeof prop.value)
                            });
                        }
                    });
                }
                return acc;
            }, [] as Array<{ key: string; type: string; defaultValue: any }>);

            if (additionalFields.length > 0) {
                return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    value: new fields.StringField({
                        choices: [${choices.choices.map(x => `"${choiceValue(x)}"`).join(", ")}],
                        initial: "${choiceValue(choices.choices[0])}"
                    }),
                    icon: new fields.StringField({initial: ""}),
                    color: new fields.StringField({initial: "#ffffff"}),
                    ${joinToNode(additionalFields, field => `${field.key.toLowerCase()}: new fields.${field.type.charAt(0).toUpperCase() + field.type.slice(1)}Field({initial: ${JSON.stringify(field.defaultValue)}})`,
                    { appendNewLineIfNotEmpty: true, separator: ',' })}
                }),
                `;
            }

            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    value: new fields.StringField({
                        choices: [${choices.choices.map(x => `"${choiceValue(x)}"`).join(", ")}],
                        initial: "${choiceValue(choices.choices[0])}"
                    }),
                    icon: new fields.StringField({initial: ""}),
                    color: new fields.StringField({initial: "#ffffff"})
                }),
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

        function getNumberOrNothing(param: NumberParamMin | NumberParamMax | NumberParamInitial | undefined): number | undefined {
            if (param && typeof(param.value) === 'number') {
                return param.value;
            }
            return undefined;
        }

        if (isResourceExp(property)) {
            const minParam = property.params.find(p => isNumberParamMin(p)) as NumberParamMin;
            const maxParam = property.params.find(p => isNumberParamMax(p)) as NumberParamMax;
            const initialParam = property.params.find(p => isNumberParamInitial(p)) as NumberParamInitial;
            const min = getNumberOrNothing(minParam) ?? -100;
            const max = getNumberOrNothing(maxParam) ?? 100;
            const initial = getNumberOrNothing(initialParam) ?? 0;
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    value: new fields.NumberField({min: ${min}, initial: ${initial}, integer: true}),
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

        if (isTrackerExp(property)) {
            const minParam = property.params.find(p => isNumberParamMin(p)) as NumberParamMin;
            const maxParam = property.params.find(p => isNumberParamMax(p)) as NumberParamMax;
            const initialParam = property.params.find(p => isNumberParamInitial(p)) as NumberParamInitial;
            const min = getNumberOrNothing(minParam) ?? -10;
            const max = getNumberOrNothing(maxParam) ?? 10;
            const initial = getNumberOrNothing(initialParam) ?? 0;

            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    min: new fields.NumberField({integer: true, initial: ${min}}),
                    value: new fields.NumberField({integer: true, initial: ${initial}}),
                    temp: new fields.NumberField({initial: 0, min: 0, integer: true}),
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
            return undefined;
            // if ( Number.isInteger(property.max) ) {
            //     return expandToNode`
            //         ${property.name.toLowerCase()}: new fields.SchemaField({
            //             empty: new fields.NumberField({initial: ${property.max}, min: 0, max: ${property.max}, integer: true}),
            //             ${joinToNode(property.types, type => `${type}: new fields.NumberField({initial: 0, min: 0, max: ${property.max}, integer: true}),`, { appendNewLineIfNotEmpty: true })}
            //         }),
            //     `;
            // }
            // return expandToNode`
            //     ${property.name.toLowerCase()}: new fields.SchemaField({
            //         "empty": new fields.NumberField({initial: 0, min: 0, integer: true}),
            //         ${joinToNode(property.types, type => `${type}: new fields.NumberField({initial: 0, min: 0, integer: true}),`, { appendNewLineIfNotEmpty: true })}
            //     }),
            // `;
        }

        if (isSingleDocumentExp(property) || isMacroField(property)) {
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

        if (isDiceFields(property)) {

            let initialParam = property.params.find(p => isDieInitialParam(p)) as DieInitialParam | undefined;
            let initialDie = initialParam?.value ?? "d20";

            if (isDieField(property)) {
                return expandToNode`
                    ${property.name.toLowerCase()}: new fields.StringField({initial: "${initialDie}"}),
                `;
            }

            if (isDiceField(property)) {
                return expandToNode`
                    ${property.name.toLowerCase()}: new fields.SchemaField({
                        die: new fields.StringField({initial: "${initialDie}"}),
                        number: new fields.NumberField({integer: true, initial: 0}),
                    }),
                `;
            }
        }

        if (isMeasuredTemplateField(property)) {
            return expandToNode`
                ${property.name.toLowerCase()}: new fields.SchemaField({
                    type: new fields.StringField({initial: "circle"}),
                    distance: new fields.NumberField({integer: true, initial: 5}),
                    direction: new fields.NumberField({integer: true, initial: 0}),
                    angle: new fields.NumberField({integer: true, initial: 0}),
                    width: new fields.NumberField({integer: true, initial: 0}),
                }),
            `;
        }

        // if ( isDocumentArrayExp(property) ) {
        //     return expandToNode`
        //         ${property.name.toLowerCase()}: new fields.EmbeddedCollectionField(new fields.ForeignDocumentField(, {required: true, type: "${property.document.ref?.name.toLowerCase()}"})),
        //     `;
        // }

        if (isLayout(property)) {
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
                    ${expandToNode`${generateDocumentPromptModels(document)}`.appendNewLineIfNotEmpty()}
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

    function generateDocumentPromptModels(document: Document): CompositeGeneratorNode | undefined {
        const actions = getAllOfType<Action>(document.body, isAction, false);
        return joinToNode(actions.map(x => generatePromptModels(x, document)).filter(x => x !== undefined).map(x => x as CompositeGeneratorNode), { appendNewLineIfNotEmpty: true });
    }

    function generatePromptModels(action: Action, document: Document): CompositeGeneratorNode | undefined {
        const variables = action.method.body.filter(x => isVariableExpression(x)) as VariableExpression[];
        const prompts = variables.filter(x => isPrompt(x.value)).map(x => x.value) as Prompt[]

        return joinToNode(prompts.map(p => generatePromptModel(p)), { appendNewLineIfNotEmpty: true });
    }

    function generatePromptModel(prompt: Prompt) {
        const variable = AstUtils.getContainerOfType(prompt.$container, isVariableExpression);
        const action = AstUtils.getContainerOfType(prompt.$container, isAction);
        return expandToNode`
            ${action?.name.toLowerCase()}${variable?.name.toLowerCase()}: new foundry.data.fields.SchemaField({
                ${joinToNode(prompt.body, property => generateField(property), { appendNewLineIfNotEmpty: true })}
            }),
        `;
    }
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
