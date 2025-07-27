import type { ValidationAcceptor, ValidationChecks } from 'langium';
import {
    type IntelligentSystemDesignLanguageAstType,
    type Actor,
    type Property,
    type Item,
    type Entry,
    type Template,
    isProperty,
    Config,
    TrackerExp,
    isSegmentsParameter,
    isTrackerStyleParameter,
    PipsExp,
    isNumberParamMin,
    isNumberParamValue,
    isNumberParamMax,
    isNumberParamInitial,
    PipsStyleParameter,
    NumberParamMin,
    NumberParamValue,
    NumberParamInitial,
    NumberParamMax,
    isPipsStyleParameter,
    isDocumentArrayExp,
    isStringParamChoices,
    StringParamChoices,
    isStringExtendedChoice,
    isChoiceStringValue,
    ChoiceStringValue, StringChoiceField, StringExp, DocumentArrayExp
} from './generated/ast.js';
import type { IntelligentSystemDesignLanguageServices } from './intelligent-system-design-language-module.js';
import { getAllOfType } from '../cli/components/utils.js';
import { DiagnosticTag } from 'vscode-languageserver';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: IntelligentSystemDesignLanguageServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.IntelligentSystemDesignLanguageValidator;
    const checks: ValidationChecks<IntelligentSystemDesignLanguageAstType> = {
        Entry: validator.validateEntry,
        Config: validator.validateConfig,
        Template: validator.validateTemplate,
        Actor: validator.validateActor,
        Item: validator.validateItem,
        Property: validator.validateProperty,
        TrackerExp: validator.validateTracker,
        PipsExp: validator.validatePips,
        StringChoiceField: validator.validateStringChoiceField,
        StringExp: validator.validateStringExp,
        DocumentArrayExp: validator.validateDocumentArrayExp
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class IntelligentSystemDesignLanguageValidator {

    validateEntry(entry: Entry, accept: ValidationAcceptor): void {
        if (!entry.config) {
            accept('error', 'Entry requires a config.', { node: entry, property: 'config' });
        }
    }

    validateConfig(config: Config, accept: ValidationAcceptor): void {
        const id = config.body.find(x => x.type == "id");
        if (!id) {
            accept('error', 'Config requires an id.', { node: config, property: 'body' });
        }
    }

    validateTemplate(template: Template, accept: ValidationAcceptor): void {
        if (!template.body) {
            accept('error', 'Template requires at least one property.', { node: template, property: 'body' });
            return;
        }

        const discoveredPropertyNames = new Set();

        function validateUniqueName(node: any, name: string): void {
            if (discoveredPropertyNames.has(name)) {
                accept('error', `Template has non-unique property name '${name}'.`, { node: node, property: 'name' });
            }
            discoveredPropertyNames.add(name);
        }

        const properties = getAllOfType<Property>(template.body, isProperty, false);
        for (const property of properties) {
            if (isDocumentArrayExp(property)) continue; // We allow multiple copies of the same document array exp in a template
            validateUniqueName(property, property.name);
        }

        // Template names should be CapitalCase
        if (template.name) {
            const firstChar = template.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Template names should start with a capital.', { node: template, property: 'name' });
            }
        }
    }

    validateActor(actor: Actor, accept: ValidationAcceptor): void {
        const discoveredPropertyNames = new Set();

        // Collect property names from template if extending one
        // if (actor.extends && actor.extends.ref && actor.extends.ref.body) {
        //     const templateProperties = getAllOfType<Property>(actor.extends.ref.body, isProperty, false);
        //     for (const templateProperty of templateProperties) {
        //         discoveredPropertyNames.add(templateProperty.name);
        //     }
        // }

        function validateUniqueName(node: any, name: string): void {
            if (discoveredPropertyNames.has(name)) {
                if (actor.extends && actor.extends.ref) {
                    accept('error', `Actor property '${name}' conflicts with inherited template property. Use a different name or override explicitly.`, { node: node, property: 'name' });
                } else {
                    accept('error', `Actor has non-unique property name '${name}'.`, { node: node, property: 'name' });
                }
            }
            discoveredPropertyNames.add(name);
        }

        const properties = getAllOfType<Property>(actor.body, isProperty, false);
        for (const property of properties) {
            if (isDocumentArrayExp(property)) continue; // We allow multiple copies of the same document array exp in an actor
            validateUniqueName(property, property.name);
        }

        // Validate that the extended template exists
        if (actor.extends && !actor.extends.ref) {
            accept('error', `Template '${actor.extends.$refText}' not found.`, { node: actor, property: 'extends' });
        }
    }

    validateProperty(property: Property, accept: ValidationAcceptor): void {
        if (property.name) {
            const firstChar = property.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Property names should start with a capital.', { node: property, property: 'name' });
            }
        }

        // if (isDeprecatedFields(property)) {
        //     accept('warning', 'This field is deprecated and will be removed in a future version.',
        //     {
        //         node: property,
        //         code: 'deprecated',
        //         tags: [DiagnosticTag.Deprecated]
        //     });
        // }
    }

    validateItem(item: Item, accept: ValidationAcceptor): void {
        const discoveredPropertyNames = new Set();

        // // Collect property names from template if extending one
        // if (item.extends && item.extends.ref && item.extends.ref.body) {
        //     const templateProperties = getAllOfType<Property>(item.extends.ref.body, isProperty, false);
        //     for (const templateProperty of templateProperties) {
        //         discoveredPropertyNames.add(templateProperty.name);
        //     }
        // }

        function validateUniqueName(node: any, name: string): void {
            if (discoveredPropertyNames.has(name)) {
                if (item.extends && item.extends.ref) {
                    accept('error', `Item property '${name}' conflicts with inherited template property. Use a different name or override explicitly.`, { node: node, property: 'name' });
                } else {
                    accept('error', `Item has non-unique property name '${name}'.`, { node: node, property: 'name' });
                }
            }
            discoveredPropertyNames.add(name);
        }

        // If the item has a body, validate the names of the properties
        //if (!item.body) accept('error', 'Item requires at least one property.', { node: item, property: 'body' });

        const properties = getAllOfType<Property>(item.body, isProperty, false);
        for (const property of properties) {
            validateUniqueName(property, property.name);
        }

        // Validate that the extended template exists
        if (item.extends && !item.extends.ref) {
            accept('error', `Template '${item.extends.$refText}' not found.`, { node: item, property: 'extends' });
        }
    }

    validateTracker(tracker: TrackerExp, accept: ValidationAcceptor): void {
        const segmentsParam = tracker.params.find(isSegmentsParameter);
        const styleParam = tracker.params.find(isTrackerStyleParameter);

        if (styleParam && styleParam.style !== 'segmented' && segmentsParam) {
            accept('hint', 'The segments param is only supported on the segmented style and will do nothing for other styles',
                {
                    node: segmentsParam,
                    code: 'tracker-segments-unnecessary',
                    tags: [DiagnosticTag.Unnecessary],
                });
        }
    }

    validatePips(pips: PipsExp, accept: ValidationAcceptor): void {
        const styleParam = pips.params.find(isPipsStyleParameter) as PipsStyleParameter | undefined;
        const minParam = pips.params.find(isNumberParamMin) as NumberParamMin | undefined;
        const valueParam = pips.params.find(isNumberParamValue) as NumberParamValue | undefined;
        const initialParam = pips.params.find(isNumberParamInitial) as NumberParamInitial | undefined;
        const maxParam = pips.params.find(isNumberParamMax) as NumberParamMax | undefined;

        function numberOrMethodBlockToString(param: NumberParamMin | NumberParamValue | NumberParamInitial | NumberParamMax | undefined): string | undefined {
            if (param && param.value) {
                return param.$cstNode?.text
            }
            return undefined;
        }

        accept('warning', 'Pips are deprecated in favor of Trackers and will be removed in a future version.',
            {
                node: pips,
                code: 'pips-deprecated',
                tags: [DiagnosticTag.Deprecated],
                data: {
                    name: pips.name,
                    style: styleParam ? styleParam.style : undefined,
                    min: numberOrMethodBlockToString(minParam),
                    value: numberOrMethodBlockToString(valueParam),
                    initial: initialParam ? initialParam.value.toString() : undefined,
                    max: numberOrMethodBlockToString(maxParam)
                }
            });
    }

    validateStringChoiceField(field: StringChoiceField, accept: ValidationAcceptor): void {
        const choices = field.params.find(isStringParamChoices) as StringParamChoices | undefined;

        if (!choices || !choices.choices || choices.choices.length === 0) {
            accept('error', 'String choice fields must have at least one choice defined.', { node: field, property: 'params' });
            return;
        }

        for (const choice of choices.choices) {
            if (isStringExtendedChoice(choice.value)) {
                const valueProperty = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                if (!valueProperty || !valueProperty.value || valueProperty.value.trim() === '') {
                    accept('error', 'String choices must have a non-empty value.', { node: choice, property: 'value' });
                }
            }
            else {
                if (choice.value.trim() === '') {
                    accept('error', 'String choices must not be empty.', { node: choice, property: 'value' });
                }
            }
        }
    }

    validateStringExp(field: StringExp, accept: ValidationAcceptor): void {
        const choices = field.params.find(isStringParamChoices) as StringParamChoices | undefined;

        if (choices) {
            accept('warning', 'String choices are deprecated and will be removed in a future version. Use choice<string> instead.', {
                node: field,
                code: 'string-choices-deprecated',
                tags: [DiagnosticTag.Deprecated],
                data: {
                    name: field.name
                }
            })
            if (!choices.choices || choices.choices.length === 0) {
                accept('error', 'String choices must have at least one choice defined.', { node: field, property: 'params' });
                return;
            }
            for (const choice of choices.choices) {
                if (isStringExtendedChoice(choice.value)) {
                    const valueProperty = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                    if (!valueProperty || !valueProperty.value || valueProperty.value.trim() === '') {
                        accept('error', 'String choices must have a non-empty value.', {
                            node: choice,
                            property: 'value'
                        });
                    }
                } else {
                    if (choice.value.trim() === '') {
                        accept('error', 'String choices must not be empty.', {node: choice, property: 'value'});
                    }
                }
            }
        }
    }

    validateDocumentArrayExp(field: DocumentArrayExp, accept: ValidationAcceptor): void {
        const type = field.document.ref?.name;
        accept('warning', 'Document Arrays are deprecated and will be removed in a future version. Use table<DOCUMENT> instead.', {
            node: field,
            code: 'document-array-deprecated',
            tags: [DiagnosticTag.Deprecated],
            data: {
                name: field.name,
                type: type
            }
        })
    }
}
