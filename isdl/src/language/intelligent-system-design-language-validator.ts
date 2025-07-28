import type { ValidationAcceptor, ValidationChecks } from 'langium';
import {
    type IntelligentSystemDesignLanguageAstType,
    type Actor,
    type Property,
    type Item,
    type Entry,
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
    ChoiceStringValue, StringChoiceField, StringExp, DocumentArrayExp,
    Document, ClassExpression, Layout, isLayout, isNumberExp, isStringExp,
    isAttributeExp, isResourceExp, isTrackerExp, isStringParamValue,
    StringParamValue, isAttributeParamMod, AttributeParamMod, isPipsExp,
    MethodBlock, isMethodBlock, isAccess, isSelfPropertyRefExp
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
        Actor: validator.validateActor,
        Item: validator.validateItem,
        Property: validator.validateProperty,
        TrackerExp: validator.validateTracker,
        PipsExp: validator.validatePips,
        StringChoiceField: validator.validateStringChoiceField,
        StringExp: validator.validateStringExp,
        DocumentArrayExp: validator.validateDocumentArrayExp,
        Document: validator.validateDependencyCycles
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

    validateActor(actor: Actor, accept: ValidationAcceptor): void {
        const discoveredPropertyNames = new Set();

        function validateUniqueName(node: any, name: string): void {
            if (discoveredPropertyNames.has(name)) {
                accept('error', `Actor has non-unique property name '${name}'.`, { node: node, property: 'name' });
            }
            discoveredPropertyNames.add(name);
        }

        const properties = getAllOfType<Property>(actor.body, isProperty, false);
        for (const property of properties) {
            if (isDocumentArrayExp(property)) continue; // We allow multiple copies of the same document array exp in an actor
            validateUniqueName(property, property.name);
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

        function validateUniqueName(node: any, name: string): void {
            if (discoveredPropertyNames.has(name)) {
                accept('error', `Item has non-unique property name '${name}'.`, { node: node, property: 'name' });
            }
            discoveredPropertyNames.add(name);
        }

        // If the item has a body, validate the names of the properties
        //if (!item.body) accept('error', 'Item requires at least one property.', { node: item, property: 'body' });

        const properties = getAllOfType<Property>(item.body, isProperty, false);
        for (const property of properties) {
            validateUniqueName(property, property.name);
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

    validateDependencyCycles(document: Document, accept: ValidationAcceptor): void {
        // Build dependency graph for all properties
        const allProperties = getAllOfType<ClassExpression | Layout>(document.body, (p): p is ClassExpression | Layout => true);
        const dependencies = this.buildDependencyGraph(allProperties);
        const cycles = this.detectCycles(dependencies);

        // Report dependency cycles as warnings
        for (const cycle of cycles) {
            const cycleDescription = cycle.join(' → ');
            const affectedProperty = allProperties.find(p => ('name' in p && p.name) ? p.name.toLowerCase() === cycle[0] : false);

            if (affectedProperty) {
                accept('warning',
                    `Dependency cycle detected: ${cycleDescription}. This may cause infinite loops in computed values.`,
                    {
                        node: affectedProperty,
                        property: 'name',
                        code: 'dependency-cycle'
                    }
                );
            }
        }
    }

    private buildDependencyGraph(properties: (ClassExpression | Layout)[]): Map<string, Set<string>> {
        const dependencies = new Map<string, Set<string>>();

        for (const property of properties) {
            if (isLayout(property)) {
                // Recursively process layout children
                for (const child of property.body) {
                    const childDeps = this.buildDependencyGraph([child]);
                    for (const [key, value] of childDeps) {
                        dependencies.set(key, value);
                    }
                }
                continue;
            }

            const deps = new Set<string>();
            const propertyName = ('name' in property && property.name) ? property.name.toLowerCase() : 'unknown';

            // Check if property has computed values that might depend on other properties
            if (this.isPropertyComputed(property)) {
                const extractedDeps = this.extractDependencies(property);
                extractedDeps.forEach(dep => deps.add(dep));

                // Remove self-references
                deps.delete(propertyName);
            }

            dependencies.set(propertyName, deps);
        }

        return dependencies;
    }

    private isPropertyComputed(property: ClassExpression | Layout): boolean {
        if (isLayout(property)) {
            return false; // Layouts don't have computed values themselves
        }

        // Check if any parameter contains a method block
        if (isNumberExp(property)) {
            const valueParam = property.params.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
            const minParam = property.params.find((p: any) => isNumberParamMin(p)) as NumberParamMin | undefined;
            const maxParam = property.params.find((p: any) => isNumberParamMax(p)) as NumberParamMax | undefined;

            return !!(valueParam && isMethodBlock(valueParam.value)) ||
                   !!(minParam && isMethodBlock(minParam.value)) ||
                   !!(maxParam && isMethodBlock(maxParam.value));
        }

        if (isStringExp(property)) {
            const stringValue = property.params.find((p: any) => isStringParamValue(p)) as StringParamValue | undefined;
            return !!(stringValue && isMethodBlock(stringValue.value));
        }

        if (isAttributeExp(property)) {
            const modParam = property.params.find((p: any) => isAttributeParamMod(p)) as AttributeParamMod | undefined;
            return !!(modParam && isMethodBlock(modParam.method));
        }

        if (isTrackerExp(property) || isResourceExp(property) || isPipsExp(property)) {
            const numberParams = property.params as (NumberParamValue | NumberParamMin | NumberParamMax)[];
            const valueParam = numberParams.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
            const minParam = numberParams.find((p: any) => isNumberParamMin(p)) as NumberParamMin | undefined;
            const maxParam = numberParams.find((p: any) => isNumberParamMax(p)) as NumberParamMax | undefined;

            return !!(valueParam && isMethodBlock(valueParam.value)) ||
                   !!(minParam && isMethodBlock(minParam.value)) ||
                   !!(maxParam && isMethodBlock(maxParam.value));
        }

        return false;
    }

    private extractDependencies(property: ClassExpression | Layout): Set<string> {
        const dependencies = new Set<string>();

        if (isLayout(property)) {
            return dependencies;
        }

        // Extract dependencies from method blocks
        if (isNumberExp(property)) {
            const valueParam = property.params.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
            const minParam = property.params.find((p: any) => isNumberParamMin(p)) as NumberParamMin | undefined;
            const maxParam = property.params.find((p: any) => isNumberParamMax(p)) as NumberParamMax | undefined;

            if (valueParam && isMethodBlock(valueParam.value)) {
                this.extractMethodBlockDependencies(valueParam.value).forEach(dep => dependencies.add(dep));
            }
            if (minParam && isMethodBlock(minParam.value)) {
                this.extractMethodBlockDependencies(minParam.value).forEach(dep => dependencies.add(dep));
            }
            if (maxParam && isMethodBlock(maxParam.value)) {
                this.extractMethodBlockDependencies(maxParam.value).forEach(dep => dependencies.add(dep));
            }
        } else if (isStringExp(property)) {
            const stringValue = property.params.find((p: any) => isStringParamValue(p)) as StringParamValue | undefined;
            if (stringValue && isMethodBlock(stringValue.value)) {
                this.extractMethodBlockDependencies(stringValue.value).forEach(dep => dependencies.add(dep));
            }
        } else if (isAttributeExp(property)) {
            const modParam = property.params.find((p: any) => isAttributeParamMod(p)) as AttributeParamMod | undefined;
            if (modParam && isMethodBlock(modParam.method)) {
                this.extractMethodBlockDependencies(modParam.method).forEach(dep => dependencies.add(dep));
            }
        } else if (isTrackerExp(property) || isResourceExp(property) || isPipsExp(property)) {
            const numberParams = property.params as (NumberParamValue | NumberParamMin | NumberParamMax)[];
            const valueParam = numberParams.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
            const minParam = numberParams.find((p: any) => isNumberParamMin(p)) as NumberParamMin | undefined;
            const maxParam = numberParams.find((p: any) => isNumberParamMax(p)) as NumberParamMax | undefined;

            if (valueParam && isMethodBlock(valueParam.value)) {
                this.extractMethodBlockDependencies(valueParam.value).forEach(dep => dependencies.add(dep));
            }
            if (minParam && isMethodBlock(minParam.value)) {
                this.extractMethodBlockDependencies(minParam.value).forEach(dep => dependencies.add(dep));
            }
            if (maxParam && isMethodBlock(maxParam.value)) {
                this.extractMethodBlockDependencies(maxParam.value).forEach(dep => dependencies.add(dep));
            }
        }

        return dependencies;
    }

    private extractMethodBlockDependencies(methodBlock: MethodBlock): Set<string> {
        const dependencies = new Set<string>();

        function traverseExpression(node: any): void {
            if (!node) return;

            if (isAccess(node) && node.property?.ref) {
                dependencies.add(node.property.ref.name.toLowerCase());
            }

            if (isSelfPropertyRefExp(node)) {
                // Self-reference expressions don't create dependencies on specific properties
                // since they're resolved at runtime based on user selection
                return;
            }

            // Recursively traverse child nodes
            if (node.$children) {
                for (const child of node.$children) {
                    traverseExpression(child);
                }
            }

            // Handle common expression properties
            if (node.left) traverseExpression(node.left);
            if (node.right) traverseExpression(node.right);
            if (node.value) traverseExpression(node.value);
            if (node.expression) traverseExpression(node.expression);
            if (node.body && Array.isArray(node.body)) {
                for (const expr of node.body) {
                    traverseExpression(expr);
                }
            }
        }

        traverseExpression(methodBlock);
        return dependencies;
    }

    private detectCycles(dependencies: Map<string, Set<string>>): string[][] {
        const cycles: string[][] = [];
        const visiting = new Set<string>();
        const visited = new Set<string>();

        function visit(property: string, path: string[] = []): void {
            if (visiting.has(property)) {
                // Found a cycle
                const cycleStart = path.indexOf(property);
                if (cycleStart >= 0) {
                    cycles.push([...path.slice(cycleStart), property]);
                }
                return;
            }

            if (visited.has(property)) {
                return;
            }

            visiting.add(property);
            path.push(property);

            // Visit dependencies
            const deps = dependencies.get(property);
            if (deps) {
                for (const dep of deps) {
                    if (dependencies.has(dep)) {
                        visit(dep, [...path]);
                    }
                }
            }

            visiting.delete(property);
            visited.add(property);
            path.pop();
        }

        // Visit all properties
        for (const property of dependencies.keys()) {
            if (!visited.has(property)) {
                visit(property);
            }
        }

        return cycles;
    }
}
