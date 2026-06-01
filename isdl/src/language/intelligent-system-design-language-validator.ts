import type { ValidationAcceptor, ValidationChecks } from 'langium';
import {
    type IntelligentSystemDesignLanguageAstType,
    type Actor,
    type Property,
    type Item,
    type Entry,
    isProperty,
    Config,
    isConfigExpression,
    TrackerExp,
    isSegmentsParameter,
    isTrackerStyleParameter,
    isNumberParamMin,
    isNumberParamValue,
    isNumberParamMax,
    NumberParamMin,
    NumberParamValue,
    NumberParamMax,
    isStringParamChoices,
    StringParamChoices,
    isStringExtendedChoice,
    isChoiceStringValue,
    ChoiceStringValue, StringChoiceField,
    Document, ClassExpression, Layout, isLayout, isNumberExp, isStringExp,
    Prompt,
    isAttributeExp, isResourceExp, isTrackerExp, isStringParamValue, isStringChoiceField,
    StringParamValue, isAttributeParamMod, AttributeParamMod,
    isAttributeRollParam, isAttributeFunctionParam, AttributeFunctionParam,
    MethodBlock, isMethodBlock, isAccess,
    InventoryField, isInventorySlotsParam, isInventoryRowsParam,
    isInventorySlotSizeParam, isInventoryQuantityParam, isInventoryMoneyParam,
    isInventorySumParam, isItem, isMoneyField, isActor,
    isBinaryExpression, isLiteral, NumberExp,
    MethodBlockExpression, isReturnExpression, ResourceExp, AttributeExp,
    Action, isAction,
    DamageTrackExp,
    ParentAccess, ParentAssignment, IfStatement,
    isIfStatement, isParentTypeCheckExpression,
    TargetAccess, TargetAssignment, isTargetTypeCheckExpression
} from './generated/ast.js';
import type { IntelligentSystemDesignLanguageServices } from './intelligent-system-design-language-module.js';
import { getAllOfType } from '../cli/components/utils.js';
import { DiagnosticTag } from 'vscode-languageserver';
import { AstUtils, type AstNode } from 'langium';

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
        TrackerExp: validator.validateTrackerExpressions,
        StringChoiceField: validator.validateStringChoiceField,
        Document: validator.validateDependencyCycles,
        InventoryField: validator.validateInventoryField,
        NumberExp: validator.validateNumberExp,
        ResourceExp: validator.validateResourceExp,
        AttributeExp: validator.validateAttributeExp,
        DamageTrackExp: validator.validateWipField,
        ParentAccess: validator.validateParentAccess,
        ParentAssignment: validator.validateParentAccess,
        TargetAccess: validator.validateTargetAccess,
        TargetAssignment: validator.validateTargetAccess,
        Prompt: validator.validatePrompt
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class IntelligentSystemDesignLanguageValidator {

    // Prompts are one-shot input dialogs, so only fields that yield a single user-supplied value
    // are allowed. Persistent widgets (attribute/resource/tracker/money), display/aggregate fields,
    // embedded collections (tables/inventories), layouts, etc. are rejected with a clear message.
    validatePrompt(prompt: Prompt, accept: ValidationAcceptor): void {
        const allowed = new Set([
            'StringExp', 'NumberExp', 'BooleanExp',
            'StringChoiceField', 'StringChoicesField', 'DamageTypeChoiceField',
            'DocumentChoiceExp', 'DocumentChoicesExp', 'SingleDocumentExp',
            'ParentPropertyRefExp', 'SelfPropertyRefExp',
            'DieField', 'DiceField',
            'DateExp', 'TimeExp', 'DateTimeExp'
        ]);
        for (const field of prompt.body) {
            if (!allowed.has(field.$type)) {
                const label = (field as any).name ?? field.$type;
                accept('error',
                    `'${label}' can't be used in a prompt. Prompts only accept input fields: string, number, boolean, `
                    + `choice/choices (string, damageType, or document), parent/self references, die, dice, and date/time/datetime.`,
                    { node: field });
            }
        }
    }

    validateEntry(entry: Entry, accept: ValidationAcceptor): void {
        if (!entry.config) {
            accept('error', 'Entry requires a config.', { node: entry, property: 'config' });
        }
    }

    validateConfig(config: Config, accept: ValidationAcceptor): void {
        const id = config.body.find(x => isConfigExpression(x) && x.type == "id");
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
            validateUniqueName(property, property.name);
        }

        // Validate only one macro action per document
        const actions = getAllOfType<Action>(actor.body, isAction, false);
        const macroActions = actions.filter(a => a.isMacro);
        if (macroActions.length > 1) {
            for (const action of macroActions) {
                accept('error', 'Only one action per document can be tagged as macro.', { node: action, property: 'isMacro' });
            }
        }
    }

    validateProperty(property: Property, accept: ValidationAcceptor): void {
        if (property.name) {
            const firstChar = property.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Property names should start with a capital.', { node: property, property: 'name' });
            }
        }

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

        // Validate only one macro action per document
        const actions = getAllOfType<Action>(item.body, isAction, false);
        const macroActions = actions.filter(a => a.isMacro);
        if (macroActions.length > 1) {
            for (const action of macroActions) {
                accept('error', 'Only one action per document can be tagged as macro.', { node: action, property: 'isMacro' });
            }
        }
    }

    validateTrackerExpressions(tracker: TrackerExp, accept: ValidationAcceptor): void {
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

        // Check for NaN-producing expressions in value, min, and max
        const valueParam = tracker.params.find(isNumberParamValue) as NumberParamValue | undefined;
        const minParam = tracker.params.find(isNumberParamMin) as NumberParamMin | undefined;
        const maxParam = tracker.params.find(isNumberParamMax) as NumberParamMax | undefined;

        if (valueParam && isMethodBlock(valueParam.value)) {
            this.validateNumericExpression(valueParam.value.body, accept);
        }

        if (minParam && isMethodBlock(minParam.value)) {
            this.validateNumericExpression(minParam.value.body, accept);
        }

        if (maxParam && isMethodBlock(maxParam.value)) {
            this.validateNumericExpression(maxParam.value.body, accept);
        }
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

    validateInventoryField(field: InventoryField, accept: ValidationAcceptor): void {
        // Validate that inventory only references item documents
        if (field.document.ref && isActor(field.document.ref)) {
            accept('error', 'Inventory fields can only reference item documents, not actors.',
                { node: field, property: 'document' });
        }

        const slotsParam = field.params.find(isInventorySlotsParam);
        const rowsParam = field.params.find(isInventoryRowsParam);
        const slotSizeParam = field.params.find(isInventorySlotSizeParam);
        const quantityParam = field.params.find(isInventoryQuantityParam);
        const moneyParam = field.params.find(isInventoryMoneyParam);
        const sumParam = field.params.find(isInventorySumParam);

        // Validate slots and rows are positive
        if (slotsParam && slotsParam.value <= 0) {
            accept('error', 'Slots parameter must be greater than 0.',
                { node: slotsParam, property: 'value' });
        }

        if (rowsParam && rowsParam.value <= 0) {
            accept('error', 'Rows parameter must be greater than 0.',
                { node: rowsParam, property: 'value' });
        }

        // Validate slotSize range (20-150px)
        if (slotSizeParam) {
            const sizeValue = parseInt(slotSizeParam.value.replace('px', ''));
            if (sizeValue < 20 || sizeValue > 150) {
                accept('warning', 'SlotSize should be between 20px and 150px for optimal display.',
                    { node: slotSizeParam, property: 'value' });
            }
        }

        // Validate quantity field exists on item
        if (quantityParam && quantityParam.field.ref) {
            const itemDocument = field.document.ref;
            if (itemDocument && isItem(itemDocument)) {
                const itemProperties = getAllOfType<Property>(itemDocument.body, isProperty, false);
                const quantityField = itemProperties.find(p => p.name === quantityParam.field.ref?.name);
                if (!quantityField) {
                    accept('error', `Quantity field '${quantityParam.field.ref.name}' does not exist on item '${itemDocument.name}'.`,
                        { node: quantityParam, property: 'field' });
                } else if (!isNumberExp(quantityField) && !isResourceExp(quantityField) &&
                           !isAttributeExp(quantityField) && !isTrackerExp(quantityField)) {
                    accept('error', 'Quantity field must be a numeric type (number, resource, attribute, or tracker).',
                        { node: quantityParam, property: 'field' });
                }
            }
        }

        // Validate money field exists and is MoneyField type
        if (moneyParam && moneyParam.field.ref && !isMoneyField(moneyParam.field.ref)) {
            accept('error', 'Money parameter must reference a money field.',
                { node: moneyParam, property: 'field' });
        }

        // Validate sum properties exist on item and are numeric
        if (sumParam) {
            const itemDocument = field.document.ref;
            if (itemDocument && isItem(itemDocument)) {
                const itemProperties = getAllOfType<Property>(itemDocument.body, isProperty, false);

                // Handle single property or array of properties
                const properties = sumParam.properties.property
                    ? [sumParam.properties.property]
                    : sumParam.properties.properties || [];

                for (const prop of properties) {
                    if (prop.ref) {
                        const sumField = itemProperties.find(p => p.name === prop.ref?.name);
                        if (!sumField) {
                            accept('error', `Sum property '${prop.ref.name}' does not exist on item '${itemDocument.name}'.`,
                                { node: sumParam, property: 'properties' });
                        } else if (!isNumberExp(sumField) && !isResourceExp(sumField) &&
                                   !isAttributeExp(sumField) && !isTrackerExp(sumField) && !isMoneyField(sumField)) {
                            accept('error', 'Sum property must be a numeric type (number, resource, attribute, tracker, or money).',
                                { node: sumParam, property: 'properties' });
                        }
                    }
                }
            }
        }
    }

    validateNumberExp(field: NumberExp, accept: ValidationAcceptor): void {
        const valueParam = field.params.find(isNumberParamValue) as NumberParamValue | undefined;
        const minParam = field.params.find(isNumberParamMin) as NumberParamMin | undefined;
        const maxParam = field.params.find(isNumberParamMax) as NumberParamMax | undefined;

        // Check value parameter for type mismatches
        if (valueParam && isMethodBlock(valueParam.value)) {
            this.validateNumericExpression(valueParam.value.body, accept);
        }

        // Check min parameter for type mismatches
        if (minParam && isMethodBlock(minParam.value)) {
            this.validateNumericExpression(minParam.value.body, accept);
        }

        // Check max parameter for type mismatches
        if (maxParam && isMethodBlock(maxParam.value)) {
            this.validateNumericExpression(maxParam.value.body, accept);
        }
    }

    validateResourceExp(field: ResourceExp, accept: ValidationAcceptor): void {
        const valueParam = field.params.find(isNumberParamValue) as NumberParamValue | undefined;
        const minParam = field.params.find(isNumberParamMin) as NumberParamMin | undefined;
        const maxParam = field.params.find(isNumberParamMax) as NumberParamMax | undefined;

        // Check value parameter for type mismatches
        if (valueParam && isMethodBlock(valueParam.value)) {
            this.validateNumericExpression(valueParam.value.body, accept);
        }

        // Check min parameter for type mismatches
        if (minParam && isMethodBlock(minParam.value)) {
            this.validateNumericExpression(minParam.value.body, accept);
        }

        // Check max parameter for type mismatches
        if (maxParam && isMethodBlock(maxParam.value)) {
            this.validateNumericExpression(maxParam.value.body, accept);
        }
    }

    validateAttributeExp(field: AttributeExp, accept: ValidationAcceptor): void {
        const modParam = field.params.find(isAttributeParamMod) as AttributeParamMod | undefined;

        // Check mod parameter for type mismatches
        if (modParam && isMethodBlock(modParam.method)) {
            this.validateNumericExpression(modParam.method.body, accept);
        }

        // `roll:` and `function:` are two ways to hang click behavior on an attribute - allow one, not both.
        const rollParam = field.params.find(isAttributeRollParam);
        const functionParam = field.params.find(isAttributeFunctionParam) as AttributeFunctionParam | undefined;
        if (rollParam && functionParam) {
            accept('error',
                `An attribute can have either a 'roll:' or a 'function:' on click, but not both. ` +
                `Use 'roll:' for a simple roll that posts a standard card, or 'function:' for full control over the result.`,
                { node: functionParam });
        }

        // The click invokes the function with no arguments, so any required (non-defaulted) parameter
        // would be undefined at call time. Require the referenced function to take no required params.
        if (functionParam?.function.ref) {
            const requiredParams = functionParam.function.ref.params.filter(p => p.defaultValue === undefined);
            if (requiredParams.length > 0) {
                accept('error',
                    `The function '${functionParam.function.ref.name}' cannot be used as an attribute click handler ` +
                    `because it requires parameter(s): ${requiredParams.map(p => p.param.name).join(', ')}. ` +
                    `A click handler is called with no arguments - use a function with no parameters (or give every parameter a default).`,
                    { node: functionParam });
            }
        }
    }

    /**
     * `parent.X` only resolves inside an `if (parent is SomeActor)` check, because an
     * Item can be owned by any Actor type. Without the guard the property reference
     * fails to resolve, producing a cryptic "Could not resolve reference to Property"
     * error. Detect the missing guard and surface a clear, actionable message instead.
     */
    validateParentAccess(node: ParentAccess | ParentAssignment, accept: ValidationAcceptor): void {
        // Is there an enclosing `if (parent is SomeActor) { ... }`?
        const guard = AstUtils.getContainerOfType(node as AstNode, (n: AstNode): n is IfStatement =>
            isIfStatement(n) && isParentTypeCheckExpression(n.expression));
        if (guard) return;

        const propName = (node as any).property?.$refText ?? "<property>";
        accept('error',
            `'parent' access must be wrapped in an 'if (parent is SomeActor)' check. ` +
            `An Item can be owned by any Actor type, so ISDL needs to know which Actor's fields ` +
            `you mean before it can resolve 'parent.${propName}'.\n\n` +
            `Example:\n` +
            `    if (parent is Hero) {\n` +
            `        parent.${propName} -= 1\n` +
            `    }`,
            { node, property: 'property' }
        );
    }

    /**
     * `target.X` only resolves inside an `if (target is SomeActor)` check, for the same
     * reason as `parent` — the targeted token can be any Actor type. Surface a clear
     * message when the guard is missing.
     */
    validateTargetAccess(node: TargetAccess | TargetAssignment, accept: ValidationAcceptor): void {
        const guard = AstUtils.getContainerOfType(node as AstNode, (n: AstNode): n is IfStatement =>
            isIfStatement(n) && isTargetTypeCheckExpression(n.expression));
        if (guard) return;

        const propName = (node as any).property?.$refText ?? "<property>";
        accept('error',
            `'target' access must be wrapped in an 'if (target is SomeActor)' check. ` +
            `The targeted token can be any Actor type, so ISDL needs to know which Actor's fields ` +
            `you mean before it can resolve 'target.${propName}'.\n\n` +
            `Example:\n` +
            `    if (target is Monster) {\n` +
            `        target.${propName} -= 1\n` +
            `    }`,
            { node, property: 'property' }
        );
    }

    private validateNumericExpression(body: MethodBlockExpression[], accept: ValidationAcceptor): void {
        for (const expr of body) {
            if (isReturnExpression(expr) && expr.value) {
                this.checkExpressionTypes(expr.value, accept);
            }
        }
    }

    private checkExpressionTypes(expr: any, accept: ValidationAcceptor): void {
        if (isBinaryExpression(expr)) {
            const op = expr.op;

            // Check for string + number operations (or other arithmetic with strings)
            if (op === '+' || op === '-' || op === '*' || op === '/') {
                const leftIsString = this.isStringExpression(expr.e1);
                const rightIsString = this.isStringExpression(expr.e2);
                const leftIsNumber = this.isNumericExpression(expr.e1);
                const rightIsNumber = this.isNumericExpression(expr.e2);

                // Error if mixing strings and numbers in arithmetic
                if ((leftIsString && rightIsNumber) || (rightIsString && leftIsNumber)) {
                    accept('error',
                        `Type mismatch: cannot perform arithmetic operation '${op}' between string and number. This will result in NaN (Not a Number).`,
                        { node: expr, property: 'op' });
                }
                // Error if both are clearly strings and using non-addition operators
                else if (leftIsString && rightIsString && op !== '+') {
                    accept('error',
                        `Type mismatch: cannot perform operation '${op}' on strings. This will result in NaN (Not a Number).`,
                        { node: expr, property: 'op' });
                }
            }

            // Recursively check sub-expressions
            this.checkExpressionTypes(expr.e1, accept);
            this.checkExpressionTypes(expr.e2, accept);
        }
    }

    private isStringExpression(expr: any): boolean {
        // Check if expression is a string literal
        if (isLiteral(expr) && typeof expr.val === 'string') {
            return true;
        }

        // Check if expression is accessing a string property
        if (isAccess(expr) && expr.property?.ref) {
            const referencedProperty = expr.property.ref;
            return isStringExp(referencedProperty) || isStringChoiceField(referencedProperty);
        }

        return false;
    }

    private isNumericExpression(expr: any): boolean {
        // Check if expression is a numeric literal
        if (isLiteral(expr) && typeof expr.val === 'number') {
            return true;
        }

        // Check if expression is accessing a numeric property
        if (isAccess(expr) && expr.property?.ref) {
            const referencedProperty = expr.property.ref;
            return isNumberExp(referencedProperty) ||
                   isResourceExp(referencedProperty) ||
                   isAttributeExp(referencedProperty) ||
                   isTrackerExp(referencedProperty);
        }

        return false;
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

        if (isTrackerExp(property) || isResourceExp(property)) {
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
        } else if (isTrackerExp(property) || isResourceExp(property)) {
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

            if (isAccess(node)) {
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

    validateWipField(field: DamageTrackExp, accept: ValidationAcceptor): void {
        accept('warning', 'This field is a WIP and may not be fully implemented or may change in a future version.', {
            node: field,
            property: 'name'
        });
    }
}
