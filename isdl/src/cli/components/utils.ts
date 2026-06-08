import { AstNode, AstUtils } from 'langium';
import {
    Action,
    ClassExpression,
    Document,
    Entry,
    IfStatement, isDamageTypeChoiceField,
    isVariableExpression,
    Page,
    ParentAccess,
    ParentTypeCheckExpression,
    Prompt,
    Property,
    TargetAccess,
    TargetTypeCheckExpression,
    VariableExpression,
    FunctionDefinition,
} from '../../language/generated/ast.js';
import {
    isResourceExp,
    isAttributeExp,
    isPage,
    isInitiativeProperty,
    isDocument,
    isIfStatement,
    isParentTypeCheckExpression,
    isTrackerExp,
    isParentAccess,
    isTargetTypeCheckExpression,
    Layout,
    isLayout, isStringChoiceField, isTargetAccess, isDocumentChoiceExp, Access, isDiceField,
    isRoll, isDamageRoll, isChatCard, isUpdate, isPrompt, isWait,
    isPlayAudio, isMacroExecute, isAssignment, isParentAssignment,
    isTargetAssignment, isCombat, isUser, isFunctionCall, isParentFunctionCall,
    SettingField, isSettings, isAction, isFunctionDefinition,
} from "../../language/generated/ast.js"

// --- Prompt identity helpers -------------------------------------------------
// A prompt is uniquely identified by its enclosing container (an `action` OR a
// `function`) AND the fleeting variable it's assigned to, so a container may hold
// multiple prompts without collision. All prompt generators (app class, component,
// registry, index export, caller) MUST derive names from these helpers to stay
// consistent. Both Action and FunctionDefinition expose `name` + `method.body`, so
// the same prompt machinery works for either.

/** A prompt can live inside an `action` or a `function` body. */
export type PromptContainer = Action | FunctionDefinition;

export function getPromptVariable(prompt: Prompt): VariableExpression | undefined {
    return AstUtils.getContainerOfType(prompt, isVariableExpression);
}

/** The nearest `action`/`function` enclosing a prompt (the registry/key owner). */
export function getPromptContainer(node: AstNode): PromptContainer | undefined {
    return AstUtils.getContainerOfType(node, (n): n is PromptContainer => isAction(n) || isFunctionDefinition(n));
}

/** Every `action` and `function` in a document that may hold prompts. */
export function getDocumentPromptContainers(document: Document): PromptContainer[] {
    return [
        ...getAllOfType<Action>(document.body, isAction, false),
        ...getAllOfType<FunctionDefinition>(document.body, isFunctionDefinition, false),
    ];
}

// --- System settings helpers -------------------------------------------------
// Settings live in the `config { settings { <scope> { ... } } }` block. All
// consumers (scope provider, validator, init-hook/localization generators)
// resolve them through here so the traversal stays in one place.

/** All declared settings across every scope group, flattened. */
export function getAllSettings(entry: Entry): SettingField[] {
    const result: SettingField[] = [];
    for (const member of entry.config.body) {
        if (isSettings(member)) {
            for (const group of member.groups) {
                result.push(...group.settings);
            }
        }
    }
    return result;
}

/** The Foundry scope ("world" | "client") a setting was declared under. */
export function getSettingScope(setting: SettingField): 'world' | 'client' {
    const group = setting.$container; // SettingScope
    return group.scope;
}

/**
 * Localization key for one choice value of a choice<string> setting. Shared by
 * the init-hook generator (which references it) and the localization generator
 * (which defines it) so they always agree. Non-alphanumerics are stripped to
 * keep the key segment valid.
 */
export function settingChoiceKeySegment(choiceValue: string): string {
    return toMachineIdentifier(choiceValue);
}
export function settingChoiceKey(setting: SettingField, choiceValue: string): string {
    return `SETTINGS.${setting.name}.${settingChoiceKeySegment(choiceValue)}`;
}

/** PascalCase-ish identity used for class/file/component names, e.g. "GetUserChoiceuserInput". */
export function getPromptIdentity(container: PromptContainer, variable: VariableExpression | undefined): string {
    return `${container.name}${variable?.name ?? ''}`;
}

/** game.system.prompts registry key, e.g. "herogetuserchoiceuserInput". */
export function getPromptRegistryKey(document: Document, container: PromptContainer, variable: VariableExpression | undefined): string {
    return `${document.name.toLowerCase()}${getPromptIdentity(container, variable)}`;
}

/** Lowercase system sub-path the prompt's fields live under, e.g. "getuserchoiceuserinput". */
export function getPromptDataPath(container: PromptContainer, variable: VariableExpression | undefined): string {
    return `${container.name.toLowerCase()}${(variable?.name ?? '').toLowerCase()}`;
}

export function toMachineIdentifier(s: string): string {
    // Normalize to NFD so accented chars decompose (e.g. á → a + combining accent),
    // strip the combining marks, then strip any remaining non-alphanumeric chars.
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

function getPropertyAccessorSuffix(property: ClassExpression): string {
    if (isResourceExp(property) || isTrackerExp(property) || isStringChoiceField(property) || isDiceField(property) || isDamageTypeChoiceField(property)) {
        return '.value';
    } else if (isAttributeExp(property)) {
        return '.mod';
    }
    // For numbers and other types (string, boolean, etc.), no additional accessor needed
    return '';
}

function appendPropertyAccessor(systemPath: string, document: Document, propertyName: string, safeAccess: boolean = true): string {
    if (!document || !document.body) {
        return systemPath;
    }

    const allProperties = getAllOfType(document.body, (p): p is ClassExpression => true);
    const targetProperty = allProperties.find(prop =>
        'name' in prop && prop.name && prop.name.toLowerCase() === propertyName.toLowerCase()
    ) as ClassExpression | undefined

    if (targetProperty) {
        const suffix = getPropertyAccessorSuffix(targetProperty);
        if (suffix) {
            const accessor = safeAccess ? '?' : '';
            return `${systemPath}${accessor}${suffix}`;
        }
    }

    return systemPath;
}

export function getSystemPath(reference: Property | undefined, subProperties: string[] = [], generatingProperty: Property | ParentAccess | Access | undefined = undefined, safeAccess=true, forAssignment=false): string {
    // Not all references are to the baseline - resources and attributes have sub-paths
    if (reference == undefined) {
        return "";
    }

    if (isInitiativeProperty(reference)) {
        return "initiative";
    }

    // If the property is "name", that is at the base of the object, not system
    if (reference.name.toLowerCase() === "name") {
        return reference.name.toLowerCase();
    }

    let basePath = "system.";

    // If we are accessing a sub-property of a resource or attribute, we need to use the appropriate sub-path
    if (subProperties.length > 0) {
        let systemPath = `${basePath}${reference.name.toLowerCase()}`;

        // For dice fields with number/die subproperties, we access them directly on the dice object
        // No need to add .value for these specific subproperties

        if (subProperties.length > 0) {
            if (isDocumentChoiceExp(reference) ||
                isParentAccess(generatingProperty) || isTargetAccess(generatingProperty)) {
                if (safeAccess) {
                    systemPath = `${systemPath}?.system`;
                } else {
                    systemPath = `${systemPath}.system`;
                }
            }
        }

        // Process all sub-properties except the last one
        for (let i = 0; i < subProperties.length - 1; i++) {
            const subProperty = subProperties[i];
            if (safeAccess) {
                systemPath = `${systemPath}?.${subProperty.toLowerCase()}`;
            }
            else {
                systemPath = `${systemPath}.${subProperty.toLowerCase()}`;
            }
        }

        // Handle the final sub-property - need to determine if it should have .value/.mod appended
        if (subProperties.length > 0) {
            const finalProperty = subProperties[subProperties.length - 1];
            const finalPropertyLower = finalProperty.toLowerCase();

            if (safeAccess) {
                systemPath = `${systemPath}?.${finalPropertyLower}`;
            } else {
                systemPath = `${systemPath}.${finalPropertyLower}`;
            }

            // For document choice accesses, we need special handling
            if (isDocumentChoiceExp(reference)) {
                const referencedDocument = reference.document.ref;
                if (referencedDocument) {
                    // For string choice fields, check if we're accessing a metadata property
                    if (isStringChoiceField(reference)) {
                        // Metadata properties are accessed directly (e.g., system.training.bonus)
                        // Choice value itself would be accessed as system.training.value
                        // Since we have subproperties, this must be a metadata access - don't append .value
                    } else {
                        // For non-choice fields, use normal property accessor logic
                        systemPath = appendPropertyAccessor(systemPath, referencedDocument, finalProperty, safeAccess);
                    }
                }
            }
            // For parent/target accesses, use document-based property type detection
            else if (isParentAccess(generatingProperty) || isTargetAccess(generatingProperty)) {
                const referencedDocument = isParentAccess(generatingProperty)
                    ? getParentDocument(generatingProperty)
                    : getTargetDocument(generatingProperty);

                if (referencedDocument) {
                    systemPath = appendPropertyAccessor(systemPath, referencedDocument, finalProperty, safeAccess);
                }
            }
        }

        return systemPath;
    }

    // Attributes expose `.value` (the editable base score) and `.mod` (the derived modifier).
    // Reads default to `.mod`; assignments must target `.value` or they write to the derived
    // field and are lost on the next prepareDerivedData.
    const suffix = (forAssignment && isAttributeExp(reference)) ? '.value' : getPropertyAccessorSuffix(reference);
    return `${basePath}${reference.name.toLowerCase()}${suffix}`;
}

export function getAllOfType<T extends (ClassExpression | Layout)>(body: (ClassExpression | Layout | Document)[], comparisonFunc: (element: T) => boolean, samePageOnly: boolean = false) : T[] {
    if (!body) return [];

    let result: T[] = [];
    const matchingResults = body.filter(x => comparisonFunc(x as T)).map(x => x as T);
    result.push(...matchingResults);

    if (!samePageOnly) {
        for (let page of body.filter(x => isPage(x)).map(x => x as Page)) {
            if (page.body) {
                result.push(...getAllOfType(page.body, comparisonFunc, samePageOnly));
            }
        }
    }

    for (let layout of body.filter(x => isLayout(x) && !isPage(x)).map(x => x as Layout)) {
        if (layout.body) {
            result.push(...getAllOfType(layout.body, comparisonFunc, samePageOnly));
        }
    }

    for (let document of body.filter(x => isDocument(x)).map(x => x as Document)) {
        if (document.body) {
            result.push(...getAllOfType(document.body, comparisonFunc, samePageOnly));
        }
    }

    return result;
}

export function globalGetAllOfType<T extends (ClassExpression | Layout)>(entry: Entry, comparisonFunc: (element: T) => boolean) : T[] {
    let result: T[] = [];
    for (let document of entry.documents) {
        result.push(...getAllOfType(document.body, comparisonFunc, false));
    }
    return result;
}

export function getParentDocument(parentAccess: ParentAccess): Document | undefined {
    const ifStatement = AstUtils.getContainerOfType(parentAccess.$container, (n: AstNode): n is IfStatement => {
        const isIf = isIfStatement(n);
        if (!isIf) return false;
        return isParentTypeCheckExpression((n as IfStatement).expression);
    })!;
    const parentTypeCheck = ifStatement.expression as ParentTypeCheckExpression;
    if (parentTypeCheck == undefined) {
        console.error("Parent type check not found");
        return undefined
    }
    return parentTypeCheck.document.ref;
}

export function getTargetDocument(targetAccess: TargetAccess): Document | undefined {
    const ifStatement = AstUtils.getContainerOfType(targetAccess.$container, (n: AstNode): n is IfStatement => {
        const isIf = isIfStatement(n);
        if (!isIf) return false;
        return isTargetTypeCheckExpression((n as IfStatement).expression);
    })!;
    const targetTypeCheck = ifStatement.expression as TargetTypeCheckExpression;
    if (targetTypeCheck == undefined) {
        console.error("Target type check not found");
        return undefined
    }
    return targetTypeCheck.document.ref;
}

export function getDocument(property: Property): Document | undefined {
    const document = AstUtils.getContainerOfType(property.$container, isDocument);
    return document;
}

// Constructs that compile to asynchronous / side-effecting code: rolls, chat, document writes
// (self/parent/target assignments — including ++/--/+=), prompts, audio, macros, combat/user ops.
// A function containing any of these cannot run during synchronous data prep, so it can't be used
// in a calculated `value:` (or other derived) context. Note: these are GUARD functions, not $type
// string checks — Assignment/ParentAssignment/TargetAssignment are grammar UNIONS whose concrete
// nodes are e.g. IncrementDecrementAssignment, so only the reflection-based guards match them.
// Local variable reassignment (isVariableAssignment) is intentionally excluded — it's pure.
const IMPURE_NODE_GUARDS: ((node: AstNode) => boolean)[] = [
    isRoll, isDamageRoll, isChatCard, isUpdate, isPrompt, isWait,
    isPlayAudio, isMacroExecute, isAssignment, isParentAssignment,
    isTargetAssignment, isCombat, isUser, isParentFunctionCall,
];

/**
 * True if a function can be safely invoked from a derived/calculated context (data prep): its body
 * is synchronous and side-effect free, transitively (functions it calls must also be derived-safe).
 */
export function functionIsDerivedSafe(func: FunctionDefinition, visited: Set<FunctionDefinition> = new Set()): boolean {
    if (visited.has(func)) return true; // cycle guard
    visited.add(func);
    for (const node of AstUtils.streamAllContents(func.method)) {
        if (IMPURE_NODE_GUARDS.some(guard => guard(node))) return false;
        if (isFunctionCall(node)) {
            const callee = node.method?.ref;
            if (callee && !functionIsDerivedSafe(callee, visited)) return false;
        }
    }
    return true;
}
