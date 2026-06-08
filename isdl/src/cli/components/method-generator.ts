import {
    ReturnExpression,
    Assignment,
    BinaryExpression,
    Group,
    VariableExpression,
    Literal,
    Ref,
    NegExpression,
    Expression,
    Access,
    MethodBlockExpression,
    MethodBlock,
    IfStatement,
    ComparisonExpression,
    ChatBlockExpression,
    Roll,
    ParentAssignment,
    Entry,
    ElseIf,
    VariableAssignment,
    WhenExpressions,
    Parameter,
    Prompt,
    ClassExpression,
    VariableAccess,
    MathExpression,
    InitiativeProperty,
    ParentAccess,
    TargetParam,
    LabelParam,
    LocationParam,
    WidthParam,
    HeightParam,
    NumberRange,
    TargetAccess,
    TargetAssignment, PlayAudioFile, PlayAudioVolume, Each, TimeLimitParam, DieChoicesParam, RollParam, isRollParam,
    isTypeParam, TypeParam, Document, Property,
} from '../../language/generated/ast.js';
import {
    FleetingAccess,
    isReturnExpression,
    isAssignment,
    isBinaryExpression,
    isGroup,
    isVariableExpression,
    isLiteral,
    isRef,
    isNegExpression,
    isAccess,
    isMethodBlock,
    isIfStatement,
    isJS,
    isChatCard,
    isFleetingAccess,
    isHtmlExp,
    isRoll,
    isDamageRoll,
    isParentAccess,
    isParentAssignment,
    isVariableAssignment,
    isWhenExpressions,
    isShorthandComparisonExpression,
    isItemAccess,
    isExpression,
    isResourceExp,
    isBooleanExp,
    isSelfMethod,
    isAttributeExp,
    isArrayExpression,
    isEach,
    isParameter,
    isPrompt,
    isLabelParam,
    isTargetParam,
    IntelligentSystemDesignLanguageTerminals,
    isMathExpression,
    isMathEmptyExpression,
    isMathSingleExpression,
    isMathParamExpression,
    isInitiativeProperty,
    isStatusProperty,
    isUpdate,
    isUpdateParent,
    isUpdateSelf,
    isParentTypeCheckExpression,
    isParentPropertyRefExp,
    isSelfPropertyRefExp,
    isLogExpression,
    isTrackerExp,
    isVisibilityValue,
    isFunctionCall,
    isAction,
    isDocument,
    isIncrementDecrementAssignment,
    isQuickModifyAssignment,
    isVariableIncrementDecrementAssignment,
    isVariableQuickModifyAssignment,
    isParentIncrementDecrementAssignment,
    isParentQuickModifyAssignment,
    isLocationParam,
    isWidthParam,
    isHeightParam,
    isNumberRange,
    isTargetTypeCheckExpression,
    isTargetAccess,
    isTargetIncrementDecrementAssignment,
    isTargetQuickModifyAssignment,
    isTargetAssignment,
    isWait,
    isPlayAudio,
    isPlayAudioFile,
    isPlayAudioVolume,
    isDieField,
    isTimeLimitParam,
    isCombatMethods,
    isCombatProperty,
    isUserProperty,
    isSystemSettingAccess,
    isSystemSettingAssignment,
    SystemSettingAccess,
    SystemSettingAssignment,
    isMacroExecute,
    isMeasuredTemplateField,
    isStringChoiceField,
    isDamageTypeChoiceField,
    isDiceField,
    isDieChoicesParam,
    isDocumentChoicesExp,
    isDocumentChoiceExp,
    isTableField,
    isInventoryField,
    isProperty,
    RollVisualizerField, isRollVisualizerValueParam, RollVisualizerValueParam,
    isPromptInputAccess,
    isRollResultAccess,
    isCritParam, isFumbleParam, isSuccessParam, isFailureParam,
    isParentFunctionCall,
    isTernaryExp,
    TernaryExp,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { getParentDocument, getPromptContainer, getPromptRegistryKey, getPromptVariable, getSystemPath, getTargetDocument, toMachineIdentifier } from './utils.js';
import { AstUtils } from 'langium';

// Module-scoped copy used by the lifted translateDiceParts/translateDiceData.
// (translateExpression keeps its own identical nested humanize for its other call sites.)
function humanize(string: string | undefined) {
    if (string == undefined) {
        return "";
    }
    // Turn TitleCase into Title Case
    // Ensure first letter of the string is capitalized
    string = string.charAt(0).toUpperCase() + string.slice(1);
    return string.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Build the subproperty key for a fleeting access (e.g. `opts.Boons` -> "Boons" / "boons").
// Prompt results are resolved with lowercased field-name keys (the datamodel stores prompt
// fields lowercased), so subproperty access on a prompt-backed fleeting must lowercase to
// match -- otherwise `opts.Boons` reads `undefined`. Other fleetings (rolls, etc.) expose
// real JS properties whose case must be preserved (e.g. `amount.total`), so the gate matters.
function fleetingSubProperty(expression: FleetingAccess): string | undefined {
    if (expression.subProperty == undefined) return undefined;
    return isPrompt(expression.variable.ref?.value) ? expression.subProperty.toLowerCase() : expression.subProperty;
}

        export function translateDiceParts(expression: Expression, noLabels: boolean = false): CompositeGeneratorNode | undefined {

            console.log("Translating Dice Part: ", expression.$type);

            if (isLiteral(expression)) {
                if (typeof expression.val == "string") {
                    return expandToNode`
                        "${expression.val}"
                    `;
                }
                return expandToNode`
                    "${expression.val}"
                `;
            }
            if (isRef(expression)) {

                // If string or number, return the value
                if (typeof expression.val == "string" || typeof expression.val == "number") {
                    return expandToNode`
                        "${expression.val}"
                    `;
                }
                if (expression.val.ref == undefined) {
                    return;
                }
                if (expression.subProperties != undefined  && expression.subProperties.length > 0) {
                    const subLabel = noLabels ? "" : `[${humanize(expression.subProperties[0])}]`;
                    return expandToNode`
                        "@${expression.val.ref?.name}${expression.subProperties[0].toLowerCase()}${subLabel}"
                    `;
                }

                console.log("Ref:", `${expression.val.$refText}`);
                if (IntelligentSystemDesignLanguageTerminals.DICE.test(`${expression.val}`)) {
                    return expandToNode`
                        "${expression.val}"
                    `;
                }

                const refLabel = noLabels ? "" : `[${humanize(expression.val.ref?.name ?? expression.val.$refText)}]`;
                return expandToNode`
                    "@${expression.val.ref?.name?.toLowerCase() ?? expression.val.$refText}${refLabel}"
                `;
            }
            if (isParentAccess(expression)) {
                let path = expression.property?.ref?.name ?? ""
                let label = humanize(expression.property?.ref?.name ?? "");
                const document = getParentDocument(expression as ParentAccess);
                if ( document != undefined ) {
                    path = `${document.name.toLowerCase()}${path}`;
                    label = `${humanize(document.name)} ${label}`;
                }
                // else if ( expression.propertyLookup != undefined ) {
                //     path = `${path}${expression.propertyLookup.ref?.name.toLowerCase()}`;
                //     label = `${label} \${context.object.system.${expression.propertyLookup.ref?.name.toLowerCase()}\}`;
                // }
                else {
                    path = `${path}${expression.property?.ref?.name.toLowerCase()}`;
                    label = `${label} ${humanize(expression.property?.ref?.name ?? "")}`;
                }
                for (const subProperty of expression.subProperties ?? []) {
                    path = `${path}${subProperty}`;
                    label = `${label} ${humanize(subProperty)}`;
                }
                label = label.trim();
                const parentLabelSuffix = noLabels ? "" : `[${label}]`;
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}${parentLabelSuffix}\`
                `;
            }
            if (isTargetAccess(expression)) {
                let path = expression.property?.ref?.name ?? ""
                let label = humanize(expression.property?.ref?.name ?? "");
                const document = getTargetDocument(expression as TargetAccess);
                if ( document != undefined ) {
                    path = `${document.name.toLowerCase()}${path}`;
                    label = `${humanize(document.name)} ${label}`;
                }
                // else if ( expression.propertyLookup != undefined ) {
                //     path = `${path}${expression.propertyLookup.ref?.name.toLowerCase()}`;
                //     label = `${label} \${context.object.system.${expression.propertyLookup.ref?.name.toLowerCase()}\}`;
                // }
                else {
                    path = `${path}${expression.property?.ref?.name.toLowerCase()}`;
                    label = `${label} ${humanize(expression.property?.ref?.name ?? "")}`;
                }
                for (const subProperty of expression.subProperties ?? []) {
                    path = `${path}${subProperty}`;
                    label = `${label} ${humanize(subProperty)}`;
                }
                label = label.trim();
                const targetLabelSuffix = noLabels ? "" : `[${label}]`;
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}${targetLabelSuffix}\`
                `;
            }
            if (isPromptInputAccess(expression)) {
                // `input.X` inside a prompt -> @<field> ref token (resolved at runtime from
                // the live reactive prompt data, see translateDiceData).
                let key = expression.property?.ref?.name?.toLowerCase() ?? "";
                for (const subProperty of expression.subProperties ?? []) {
                    key = `${key}.${subProperty}`;
                }
                return expandToNode`
                    \`@${key.replaceAll(".", "").toLowerCase()}\`
                `;
            }
            if (isAccess(expression)) {
                let path = expression.property?.ref?.name?.toLowerCase() ?? expression.propertyLookup?.ref?.name?.toLowerCase() ?? "";
                let label = humanize(expression.property?.ref?.name ?? expression.propertyLookup?.ref?.name ?? "");

                // if (isDieField(expression.property?.ref)) {
                //     return expandToNode`
                //         \'@${path.replaceAll(".", "")}\'
                //     `;
                // }

                // Special handling for document choices - expand into individual terms
                if (expression.property && isDocumentChoicesExp(expression.property.ref) && expression.subProperties && expression.subProperties.length > 0) {
                    const choicesFieldName = expression.property.ref.name.toLowerCase();
                    const subPropertyName = expression.subProperties[0].toLowerCase();
                    const subPropertyLabel = humanize(expression.subProperties[0]);

                    // Generate dynamic expansion for each document in the choices array
                    return expandToNode`
                        context.object.system.${choicesFieldName}.map((doc, index) => {
                            if (!doc || !doc.system) return '';
                            return '@' + doc.uuid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + '${subPropertyName}[' + doc.name + ' ${subPropertyLabel}]';
                        }).filter(Boolean).join(' + ')
                    `;
                }

                if (isParentPropertyRefExp(expression.property?.ref)) {
                    label = `${label} - \${context.object.system.${expression.property?.ref?.name.toLowerCase()}.replace("system.", "").replaceAll(".", " ").titleCase()\}`;
                }
                else if (isSelfPropertyRefExp(expression.property?.ref)) {
                    label = `${label} - \${context.object.system.${expression.property?.ref?.name.toLowerCase()}.replace("system.", "").replaceAll(".", " ").titleCase()\}`;
                }
                else {
                    for (const subProperty of expression.subProperties ?? []) {
                        path = `${path}.${subProperty}`;
                        label = `${label} ${humanize(subProperty)}`;
                    }
                }
                console.log("Access:", path, label);
                const accessLabelSuffix = noLabels ? "" : `[${label}]`;
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}${accessLabelSuffix}\`
                `;
            }
            if (isFleetingAccess(expression)) {

                // If this is a roll expression, just output it directly
                if (isRoll(expression.variable.ref?.value)) {
                    return expandToNode`
                        ${expression.variable.ref?.name}
                    `;
                }

                let path = expression.variable.ref?.name ?? "";
                let label = humanize(expression.variable.ref?.name ?? "");
                if (expression.subProperty != undefined) {
                    path = `${path}.${fleetingSubProperty(expression)}`;
                    label = `${label} ${humanize(expression.subProperty)}`;
                }
                const fleetingLabelSuffix = noLabels ? "" : `[${label}]`;
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}${fleetingLabelSuffix}\`
                `;
            }
            if (isBinaryExpression(expression)) {
                return expandToNode`
                    ${translateDiceParts(expression.e1, noLabels)} + "${expression.op}" + ${translateDiceParts(expression.e2, noLabels)}
                `;
            }

            if (isGroup(expression)) {
                return expandToNode`
                    "(" + ${translateDiceParts(expression.ge, noLabels)} + ")"
                `;
            }

            return;
        }

        function translateDisplayFormula(expression: Expression): string | undefined {
            if (isLiteral(expression)) {
                return `${expression.val}`;
            }
            if (isGroup(expression)) {
                const inner = translateDisplayFormula(expression.ge);
                return inner != null ? `(${inner})` : undefined;
            }
            if (isBinaryExpression(expression)) {
                const left = translateDisplayFormula(expression.e1);
                const right = translateDisplayFormula(expression.e2);
                return left != null && right != null ? `${left} ${expression.op} ${right}` : undefined;
            }
            if (isAccess(expression)) {
                if (isParentPropertyRefExp(expression.property?.ref) || isSelfPropertyRefExp(expression.property?.ref)) {
                    return undefined;
                }
                let label = humanize(expression.property?.ref?.name ?? expression.propertyLookup?.ref?.name ?? "");
                for (const sub of expression.subProperties ?? []) {
                    label += ` ${humanize(sub)}`;
                }
                return label.trim();
            }
            if (isParentAccess(expression)) {
                return humanize(expression.property?.ref?.name ?? "");
            }
            if (isTargetAccess(expression)) {
                return humanize(expression.property?.ref?.name ?? "");
            }
            if (isFleetingAccess(expression)) {
                return humanize(expression.variable.ref?.name ?? "");
            }
            return undefined;
        }

        export function translateDiceData(expression: Expression | VariableAccess, entry: Entry, id: string, preDerived: boolean, generatingProperty: ClassExpression | undefined): CompositeGeneratorNode | undefined {
            console.log("Translating Dice Data: ", expression.$type);
            if (isParentAccess(expression)) {
                let path = "context.object.parent.system";
                let label = expression.property?.ref?.name ?? "";

                console.log("Parent Access:", expression.property?.ref?.name);

                const document = getParentDocument(expression as ParentAccess);
                if ( document != undefined ) {
                    path = `${path}.${expression.property?.ref?.name?.toLowerCase()}`;
                    label = `${humanize(document.name)}.${label}`;
                }
                else {
                    path = `${path}.${expression.property?.ref?.name?.toLowerCase()}`;
                    label = `${label}.${expression.property}`;
                }
                for (const subProperty of expression.subProperties ?? []) {
                    path = `${path}.${subProperty}`;
                    label = `${label}.${subProperty}`;
                }

                return expandToNode`
                    "${label.replaceAll(".", "").toLowerCase()}": ${path}
                `;
            }
            if (isTargetAccess(expression)) {
                let path = "context.target.system";
                let label = expression.property?.ref?.name ?? "";

                console.log("Target Access:", expression.property?.ref?.name);

                const document = getTargetDocument(expression as TargetAccess);
                if ( document != undefined ) {
                    path = `${path}.${expression.property?.ref?.name?.toLowerCase()}`;
                    label = `${humanize(document.name)}.${label}`;
                }
                else {
                    path = `${path}.${expression.property?.ref?.name?.toLowerCase()}`;
                    label = `${label}.${expression.property}`;
                }
                for (const subProperty of expression.subProperties ?? []) {
                    path = `${path}.${subProperty}`;
                    label = `${label}.${subProperty}`;
                }

                return expandToNode`
                    "${label.replaceAll(".", "").toLowerCase()}": ${path}
                `;
            }
            if (isPromptInputAccess(expression)) {
                // Resolve `input.X` to the LIVE reactive prompt path the input writes to:
                // context.system.<action><variable>.<field>. Editing the input recomputes
                // any binding that reads this (the rollVisualizer's :rollData).
                const prompt = AstUtils.getContainerOfType(expression, isPrompt);
                const variable = AstUtils.getContainerOfType(prompt?.$container, isVariableExpression);
                const container = prompt ? getPromptContainer(prompt) : undefined;
                const promptPath = `${container?.name.toLowerCase() ?? ""}${variable?.name.toLowerCase() ?? ""}`;
                const ref = expression.property?.ref;
                const fieldName = ref?.name?.toLowerCase() ?? "";
                const base = `context.system.${promptPath}.${fieldName}`;
                const hasSub = (expression.subProperties?.length ?? 0) > 0;

                // A dice prompt input is stored as {die, number} (its `.value` formula is derived
                // data, which a prompt doesn't compute). Build the "<number><die>" formula string
                // so it drops into the roll as e.g. "2d6"; reading both keeps it reactive.
                if (isDiceField(ref) && !hasSub) {
                    return expandToNode`
                        "${fieldName}": \`\${${base}.number}\${${base}.die}\`
                    `;
                }
                // A die prompt input is stored as the die string itself (e.g. "d8").
                if (isDieField(ref) && !hasSub) {
                    return expandToNode`
                        "${fieldName}": ${base}
                    `;
                }

                let key = fieldName;
                let dataPath = base;
                for (const subProperty of expression.subProperties ?? []) {
                    key = `${key}.${subProperty}`;
                    dataPath = `${dataPath}.${subProperty.toLowerCase()}`;
                }
                return expandToNode`
                    "${key.replaceAll(".", "").toLowerCase()}": ${dataPath} ?? 0
                `;
            }
            if (isAccess(expression)) {
                let path = "context.object.system";
                let label = "";

                console.log("Access:", expression.property?.ref?.name, expression.propertyLookup?.ref?.name);

                if (expression.propertyLookup != undefined) {
                    path = `${path}[context.object.${getSystemPath(expression.propertyLookup.ref)}.toLowerCase()]`;
                    label = `${expression.propertyLookup.ref?.name}`;
                }
                else if (isParentPropertyRefExp(expression.property?.ref)) {
                    path = `${path}.${expression.property?.ref?.name.toLowerCase()}`;
                    label = `${expression.property?.ref?.name}`;
                    let subProperty = "";

                    if (expression.property?.ref.propertyType == "resource" || expression.property?.ref.propertyType == "tracker" || expression.property?.ref.propertyType == "choice"
                        && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "value")) {
                        subProperty = "?.value";
                    }
                    if (expression.property?.ref.propertyType == "attribute" && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "mod")) {
                        subProperty = "?.mod";
                    }

                    console.log(label, path);
                    return expandToNode`
                        "${label.replaceAll(".", "").replaceAll(" ", "").toLowerCase()}": foundry.utils.getProperty(context.object.parent, ${path}.toLowerCase())${subProperty}
                    `;
                }
                else if (isSelfPropertyRefExp(expression.property?.ref)) {
                    // For self property references, we dynamically resolve the property path
                    let selfPropertyPath = `context.object.system.${expression.property?.ref?.name.toLowerCase()}`;
                    let subProperty = "";
                    label = `${expression.property?.ref?.name}`;

                    if (expression.property?.ref.propertyType == "resource" || expression.property?.ref.propertyType == "tracker" || expression.property?.ref.propertyType == "choice"
                        && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "value")) {
                        subProperty = "?.value";
                    }
                    if (expression.property?.ref.propertyType == "attribute" && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "mod")) {
                        subProperty = "?.mod";
                    }

                    console.log(label, selfPropertyPath);
                    return expandToNode`
                        "${label.replaceAll(".", "").replaceAll(" ", "").toLowerCase()}": foundry.utils.getProperty(context.object, "system." + ${selfPropertyPath}.toLowerCase())${subProperty}
                    `;
                }
                else {
                    // Special handling for document choices - expand into individual data entries
                    if (expression.property && isDocumentChoicesExp(expression.property.ref) && expression.subProperties && expression.subProperties.length > 0) {
                        const choicesFieldName = expression.property.ref.name.toLowerCase();
                        const subPropertyName = expression.subProperties[0].toLowerCase();

                        // Generate data for each document in the choices array
                        return expandToNode`
                            ...Object.fromEntries(context.object.system.${choicesFieldName}.map((doc, index) => {
                                if (!doc || !doc.system) return null;
                                
                                // Determine the accessor based on property type
                                let accessor = '.${subPropertyName}';
                                ${isResourceExp(expression.property?.ref) || isTrackerExp(expression.property?.ref) ? `
                                if (doc.system.${subPropertyName} && typeof doc.system.${subPropertyName} === 'object' && 'value' in doc.system.${subPropertyName}) {
                                    accessor = '.${subPropertyName}.value';
                                }` : ''}
                                ${isAttributeExp(expression.property?.ref) ? `
                                if (doc.system.${subPropertyName} && typeof doc.system.${subPropertyName} === 'object' && 'mod' in doc.system.${subPropertyName}) {
                                    accessor = '.${subPropertyName}.mod';
                                }` : ''}
                                
                                const key = doc.uuid.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + '${subPropertyName}';
                                const value = foundry.utils.getProperty(doc, 'system' + accessor) ?? 0;
                                return [key, value];
                            }).filter(Boolean))
                        `;
                    }

                    path = `${path}.${expression.property?.ref?.name.toLowerCase()}`;
                    label = `${expression.property?.ref?.name}`;

                    if ((isResourceExp(expression.property?.ref) || isTrackerExp(expression.property?.ref) || isStringChoiceField(expression.property?.ref))
                        && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] == "value")) {
                        path = `${path}.value`;
                    }
                    if (isDiceField(expression.property?.ref) && (expression.subProperties == undefined || expression.subProperties.length == 0)) {
                        // For dice fields without subproperties, use the dice value
                        path = `${path}.value`;
                    }
                    if (isDieField(expression.property?.ref)) {
                        // For die fields, the value is just the die size (e.g., "d6"), we want to use the field name as label
                        // Don't change the path, just ensure the label is the field name
                    }
                    if (isAttributeExp(expression.property?.ref) && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "mod")) {
                        path = `${path}.mod`;
                    }
                }

                for (const subProperty of expression.subProperties ?? []) {
                    path = `${path}.${subProperty}`;
                    label = `${label} ${humanize(subProperty)}`;
                }
                console.log(label, path);
                return expandToNode`
                    "${label.replaceAll(".", "").replaceAll(" ", "").toLowerCase()}": ${path} ?? 0
                `;
            }
            if (isFleetingAccess(expression)) {

                console.log("Fleeting Access:", expression.variable.ref?.name);

                // If this is a roll expression, just skip it
                if (isRoll(expression.variable.ref?.value)) {
                    return;
                }

                let path = expression.variable.ref?.name;
                // The roll-data key must match the formula's `@`-reference, which collapses the
                // dotted path and lowercases it (see translateDiceParts: `@answer.bonus` -> `@answerbonus`).
                let label = expression.variable.ref?.name?.toLowerCase() ?? "";
                if (expression.subProperty != undefined) {
                    path = `${path}.${fleetingSubProperty(expression)}`;
                    label = `${label}${expression.subProperty.toLowerCase()}`;
                }
                if (expression.arrayAccess != undefined) {
                    console.log("Array Access:", expression.arrayAccess.$type);
                    let accessExp = translateExpression(entry, id, expression.arrayAccess, preDerived, generatingProperty);
                    path = `${path}[${accessExp?.contents?.toString()}]`;
                }
                console.log(label, path);
                return expandToNode`
                    "${label}": ${path} ?? 0
                `;
            }

            // if (isVariableAccess(expression)) {
            //     console.log("Variable Access:", expression.name);

            //     if (isParameter(expression)) {
            //         console.log("Parameter:", expression.name);
            //         return expandToNode`
            //             "${expression.name}": ${expression.name}
            //         `;
            //     }

            //     if (isVariableExpression(expression)) {
            //         console.log("Variable Expression:", expression.name);
            //         if (isExpression(expression.value)) {
            //             console.log("Expression:", expression.name);
            //             return translateDiceData(expression.value);
            //         }
            //         if (isPrompt(expression.value)) {
            //             console.log("Prompt:", expression.name);
            //             return expandToNode`
            //                 "${expression.name}": ${expression.name}
            //             `;
            //         }
            //     }

            //     throw new Error("Variable Access not implemented");
            // }

            if (isRef(expression)) {

                console.log("Ref:", expression.val.ref?.name);

                // If string or number, return the value
                if (typeof expression.val == "string" || typeof expression.val == "number") {
                    console.log(expression.val);
                    return expandToNode`
                        "${expression.val}": ${expression.val}
                    `;
                }
                if (expression.val.ref == undefined) {
                    return;
                }
                if (expression.subProperties != undefined && expression.subProperties.length > 0) {
                    return expandToNode`
                        "${expression.val.ref?.name.toLowerCase()}${expression.subProperties[0].toLowerCase()}": ${expression.val.ref?.name}.${expression.subProperties[0].toLowerCase()} ?? 0
                    `;
                }
                console.log(expression.val.ref?.name, expression.val.ref?.$type);
                return expandToNode`
                    "${expression.val.ref?.name?.toLowerCase() ?? expression.val.$refText}": ${expression.val.ref?.name ?? expression.val.$refText} ?? 0
                `;
            }

            if (isBinaryExpression(expression)) {
                const expressions = [expression.e1, expression.e2];
                return expandToNode`
                    ${joinToNode(expressions, e => translateDiceData(e, entry, id, preDerived, generatingProperty), {separator: ", "})}
                `;
            }

            if (isGroup(expression)) {
                return expandToNode`
                    ${translateDiceData(expression.ge, entry, id, preDerived, generatingProperty)}
                `;
            }

            return undefined;
        }

export function translateExpression(entry: Entry, id: string, expression: string | MethodBlock | WhenExpressions | MethodBlockExpression | Expression | Assignment | VariableExpression | ReturnExpression | ComparisonExpression | Roll | number | Parameter | Prompt | InitiativeProperty | NumberRange, preDerived: boolean = false, generatingProperty: ClassExpression | undefined = undefined): CompositeGeneratorNode | undefined {

    function humanize(string: string | undefined) {
        if (string == undefined) {
            return "";
        }
        // Turn TitleCase into Title Case
        // Ensure first letter of the string is capitalized
        string = string.charAt(0).toUpperCase() + string.slice(1);
        return string.replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    //console.log(preDerived, generatingProperty);
    function translateMethodExpression(expression: VariableExpression): CompositeGeneratorNode | undefined {
        //console.log("Translating Method Expression: " + expression.name);
        return expandToNode`
            ${expression.type == "fleeting" ? "let" : "const"} ${expression.name} = ${translateExpression(entry, id, expression.value, preDerived, generatingProperty)};
        `;
    }

    function translateReturnExpression(expression: ReturnExpression): CompositeGeneratorNode | undefined {
        //console.log("Translating Return Expression: " + expression.value);
        return expandToNode`
            return ${translateExpression(entry, id, expression.value, preDerived, generatingProperty)};
        `;
    }

    function translateAssignmentExpression(expression: Assignment): CompositeGeneratorNode | undefined {
        //console.log("Translating Assignment Expression: " + expression.property.ref?.name);

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref, false, true);

        // Special case: For dice .die subproperty increment/decrement, use die choice navigation instead of numeric increment
        if (isDiceField(expression.property?.ref) && expression.subProperties && expression.subProperties.length > 0 &&
            expression.subProperties[0].toLowerCase() === "die" && isIncrementDecrementAssignment(expression)) {
            const fieldName = expression.property?.ref?.name.toLowerCase();
            const modifier = expression.term == "++" ? "+ 1" : "- 1";
            const readPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);

            return expandToNode`
                const ${fieldName}DieChoices = ["d4","d6","d8","d10","d12","d20"];
                const ${fieldName}CurrentDieIndex = ${fieldName}DieChoices.indexOf(context.object.${readPath});
                if (${fieldName}CurrentDieIndex === -1) {
                    console.error("Invalid die size: " + context.object.${readPath});
                    update["${systemPath}"] = 'd4';
                    return;
                }
                let ${fieldName}NewDieIndex = ${fieldName}CurrentDieIndex;
                ${fieldName}NewDieIndex = Math.max(0, Math.min(${fieldName}DieChoices.length - 1, ${fieldName}CurrentDieIndex ${modifier}));
                update["${systemPath}"] = ${fieldName}DieChoices[${fieldName}NewDieIndex];
            `;
        }

        if ((isResourceExp(expression.property?.ref) || isTrackerExp(expression.property?.ref)) && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] == "temp")) {
            // We need to check for temp first when decrementing
            const tempPath = `system.${expression.property?.ref?.name.toLowerCase()}.temp`;
            if (isIncrementDecrementAssignment(expression) && expression.term == "--") {
                return expandToNode`
                    if ( context.object.${tempPath} > 0 ) {
                        update["${tempPath}"] = context.object.${tempPath} - 1;
                    }
                    else {
                        update["${systemPath}"] = context.object.${systemPath} - 1;
                    }
                `;
            }

            if (isQuickModifyAssignment(expression) && expression.term == "-=") {
                return expandToNode`
                    if ( context.object.${tempPath} > 0 ) {
                        update["${tempPath}"] = context.object.${tempPath} - ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};

                        if ( update["${tempPath}"] < 0 ) {
                            // Apply the remainder to the system property
                            update["${systemPath}"] = context.object.${systemPath} + update["${tempPath}"];
                            update["${tempPath}"] = 0;
                        }
                    }
                    else {
                        update["${systemPath}"] = context.object.${systemPath} - ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
                    }
                `;
            }
        }

        if (isDieField(expression.property?.ref)) {
            // Die sizes are stored as strings such as "d6", "d8", etc. but when increments / decrements are applied, we want to treat them as numbers. d6++ should become d8, and so on based on the `choices`
            const dieChoicesParam = expression.property?.ref.params.find(isDieChoicesParam) as DieChoicesParam | undefined;
            const dieChoices = dieChoicesParam?.choices ?? ["d4", "d6", "d8", "d10", "d12", "d20"];
            const propertyName = expression.property?.ref.name?.toLowerCase() ?? "die";

            function generateModification() {
                if (isIncrementDecrementAssignment(expression)) {
                    const modifier = expression.term == "++" ? "+" : "-";
                    return expandToNode`
                        ${propertyName}NewDieIndex = Math.max(0, Math.min(${propertyName}DieChoices.length - 1, ${propertyName}CurrentDieIndex ${modifier} 1));
                    `;
                }
                if (isQuickModifyAssignment(expression)) {
                    let modifier = "+";
                    switch (expression.term) {
                        case "+=": modifier = "+"; break;
                        case "-=": modifier = "-"; break;
                        case "*=": modifier = "*"; break;
                        case "/=": modifier = "/"; break;
                        default: modifier = "+"; break;
                    }
                    return expandToNode`
                        ${propertyName}NewDieIndex = Math.max(0, Math.min(${propertyName}DieChoices.length - 1, ${propertyName}CurrentDieIndex ${modifier} ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)}));
                    `;
                }
                return expandToNode`
                    ${propertyName}NewDieIndex = Math.max(0, Math.min(${propertyName}DieChoices.length - 1, ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)}));
                `;
            }

            return expandToNode`
                const ${propertyName}DieChoices = ${JSON.stringify(dieChoices)};
                const ${propertyName}CurrentDieIndex = ${propertyName}DieChoices.indexOf(context.object.${systemPath});
                if (${propertyName}CurrentDieIndex === -1) {
                    console.error("Invalid die size: " + context.object.${systemPath});
                    update["${systemPath}"] = '${dieChoices[0]}';
                    return;
                }
                let ${propertyName}NewDieIndex = ${propertyName}CurrentDieIndex;
                ${generateModification()}
                update["${systemPath}"] = ${propertyName}DieChoices[${propertyName}NewDieIndex];
            `;
        }

        // Special case for dice fields with .die subproperty - use die choice navigation
        if (isDiceField(expression.property?.ref) && expression.subProperties && expression.subProperties.length > 0 &&
            expression.subProperties[0].toLowerCase() === "die" && isIncrementDecrementAssignment(expression)) {
            const fieldName = expression.property?.ref?.name.toLowerCase();
            const modifier = expression.term == "++" ? "+ 1" : "- 1";
            const readPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);

            return expandToNode`
                const ${fieldName}DieChoices = ["d4","d6","d8","d10","d12","d20"];
                const ${fieldName}CurrentDieIndex = ${fieldName}DieChoices.indexOf(context.object.${readPath});
                if (${fieldName}CurrentDieIndex === -1) {
                    console.error("Invalid die size: " + context.object.${readPath});
                    update["${systemPath}"] = 'd4';
                    return;
                }
                let ${fieldName}NewDieIndex = ${fieldName}CurrentDieIndex;
                ${fieldName}NewDieIndex = Math.max(0, Math.min(${fieldName}DieChoices.length - 1, ${fieldName}CurrentDieIndex ${modifier}));
                update["${systemPath}"] = ${fieldName}DieChoices[${fieldName}NewDieIndex];
            `;
        }

        if (isIncrementDecrementAssignment(expression)) {
            const modifier = expression.term == "++" ? "+" : "-";
            return expandToNode`
                update["${systemPath}"] = context.object.${systemPath} ${modifier} 1;
            `;
        }
        if (isQuickModifyAssignment(expression)) {
            let modifier = "+";
            switch (expression.term) {
                case "+=": modifier = "+"; break;
                case "-=": modifier = "-"; break;
                case "*=": modifier = "*"; break;
                case "/=": modifier = "/"; break;
                default: modifier = "+"; break;
            }
            return expandToNode`
                update["${systemPath}"] = context.object.${systemPath} ${modifier} ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }

        return expandToNode`
            update["${systemPath}"] = ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
        `;
    }

    function translateVariableAssignment(expression: VariableAssignment): CompositeGeneratorNode | undefined {

        let name = expression.variable.ref?.name;
        for (const subProperty of expression.subProperties ?? []) {
            name = `${name}.${subProperty}`;
        }

        // ++ or --
        if (isVariableIncrementDecrementAssignment(expression)) {
            return expandToNode`
                ${name}${expression.term};
            `;
        }

        // +=, -=, *=, /=
        if (isVariableQuickModifyAssignment(expression)) {
            return expandToNode`
                ${name} ${expression.term} ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }

        return expandToNode`
            ${name} = ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
        `;
    }

    function translateParentAssignmentExpression(expression: ParentAssignment): CompositeGeneratorNode | undefined {
        //console.log("Translating Assignment Expression: " + expression.property.ref?.name);

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref, false, true);

        if (isParentIncrementDecrementAssignment(expression)) {
            const modifier = expression.term == "++" ? "+" : "-";
            return expandToNode`
                parentUpdate["${systemPath}"] = context.object.parent.${systemPath} ${modifier} 1;
            `;
        }
        if (isParentQuickModifyAssignment(expression)) {
            let modifier = "+";
            switch (expression.term) {
                case "+=": modifier = "+"; break;
                case "-=": modifier = "-"; break;
                case "*=": modifier = "*"; break;
                case "/=": modifier = "/"; break;
                default: modifier = "+"; break;
            }
            return expandToNode`
                parentUpdate["${systemPath}"] = context.object.parent.${systemPath} ${modifier} ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }

        return expandToNode`
            parentUpdate["${systemPath}"] = ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
        `;
    }

    function translateTargetAssignmentExpression(expression: TargetAssignment): CompositeGeneratorNode | undefined {
        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, undefined, false, true);

        if (isTargetIncrementDecrementAssignment(expression)) {
            const modifier = expression.term == "++" ? "+" : "-";
            return expandToNode`
                targetUpdate["${systemPath}"] = context.target.${systemPath} ${modifier} 1;
            `;
        }

        if (isTargetQuickModifyAssignment(expression)) {
            let modifier = "+";
            switch (expression.term) {
                case "+=": modifier = "+"; break;
                case "-=": modifier = "-"; break;
                case "*=": modifier = "*"; break;
                case "/=": modifier = "/"; break;
                default: modifier = "+"; break;
            }
            return expandToNode`
                targetUpdate["${systemPath}"] = context.target.${systemPath} ${modifier} ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }
        return expandToNode`
            targetUpdate["${systemPath}"] = ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
        `;
    }

    function translateBinaryExpression(expression: BinaryExpression): CompositeGeneratorNode | undefined {
        console.log("Translating Binary Expression: ", expression.e1.$type, expression.op, expression.e2.$type);
        let a = translateExpression(entry, id, expression.e1, preDerived, generatingProperty);
        let b = translateExpression(entry, id, expression.e2, preDerived, generatingProperty);

        let op = `${expression.op}`;

        // If the term is "equals" or "==", we need to translate it to "===" in JavaScript
        if (op == "equals" || op == "==") {
            op = "===";
        }

        // !equals
        if (op == "!equals" || op == "!=") {
            op = "!==";
        }

        // Or
        if (op == "or") {
            op = "||";
        }

        // And
        if (op == "and") {
            op = "&&";
        }

        return expandToNode`${a} ${op} ${b}`;
    }

    function translateLiteralExpression(expression: Literal): CompositeGeneratorNode | undefined {
        console.log("Translating Literal Expression: " + expression.val);
        if (typeof expression.val == "string") {
            if (expression.val == "nothing") {
                return expandToNode`
                    null
                `;
            }
            else if (expression.val == "true" || expression.val == "false") {
                return expandToNode`
                    ${expression.val}
                `;
            }
            if (isInitiativeProperty(generatingProperty)) {
                return expandToNode`
                    ${expression.val}
                `;
            }
            return expandToNode`
             "${expression.val}"
            `;
        }
        return expandToNode`
            ${expression.val}
        `;
    }

    function translateReferenceExpression(expression: Ref): CompositeGeneratorNode | undefined {
        let accessPath = expression.val.ref?.name ?? expression.val.$refText;
        if (!accessPath) {
            console.log(expression);
            throw new Error("Reference expression has no reference");
        }
        console.log("Translating Reference Expression: " + accessPath);

        // Check if we are in an each loop
        const eachExp = AstUtils.getContainerOfType(expression.$container, isEach);
        if (eachExp != undefined) {
            if (isAccess(eachExp.collection) || isParentAccess(eachExp.collection) || isTargetAccess(eachExp.collection)) {
                accessPath = `${accessPath}.system`;
            }
        }

        const refTargetIsRoll = isVariableExpression(expression.val.ref) && isRoll(expression.val.ref.value);
        for (const subProperty of expression.subProperties ?? []) {
            const lowerSub = subProperty.toLowerCase();
            if (lowerSub == "name") {
                accessPath = `${expression.val.ref?.name}.name`;
            }
            else if (refTargetIsRoll && lowerSub == "dice") {
                // Foundry's Roll#dice returns DiceTerms; the face-value array lives on diceFaces.
                accessPath = `${accessPath}.diceFaces`;
            }
            else {
                accessPath = `${accessPath}.${lowerSub}`;
            }
        }

        // A bare reference to a roll variable (e.g. `fleeting r = roll(d20 + 1)`
        // used as `r >= 20` or `r + 5`) should use the roll's numeric total, not
        // the Roll object. In expression contexts the reference parses as a Ref
        // (Ref precedes FleetingAccess in PrimitiveExpression), so this is the
        // path that needs it. Skip when the user already accessed a subproperty
        // (r.total, r.dice) or when the ref is a Parameter rather than a variable.
        // Chat-card rendering keeps the Roll object via a separate path.
        const refTarget = expression.val.ref;
        if ((expression.subProperties?.length ?? 0) === 0
            && isVariableExpression(refTarget)
            && (isRoll(refTarget.value) || isDamageRoll(refTarget.value))) {
            accessPath = `${accessPath}.total`;
        }

        console.log("Access Path: ", accessPath);
        return expandToNode`
            ${accessPath}
        `;
    }

    function translateGroupedExpression(expression: Group): CompositeGeneratorNode | undefined {
        //console.log("Translating Grouped Expression: " + expression.ge);
        return expandToNode`
            (${translateExpression(entry, id, expression.ge, preDerived, generatingProperty)})
        `;
    }

    function translateNegatedExpression(expression: NegExpression): CompositeGeneratorNode | undefined {
        //console.log("Translating Negated Expression: " + expression.ne);

        // If this is a boolean, we need to negate it differently
        if (isAccess(expression.ne) && isBooleanExp(expression.ne.property?.ref)) {
            return expandToNode`
                !${translateExpression(entry, id, expression.ne, preDerived, generatingProperty)}
            `;
        }

        return expandToNode`
            -(${translateExpression(entry, id, expression.ne, preDerived, generatingProperty)})
        `;
    }

    function translateAccessExpression(expression: Access, generatingProperty: ClassExpression | undefined = undefined): CompositeGeneratorNode | undefined {

        // If we are accessing special values, we need to handle them differently
        if ( expression.access != undefined ) {
            let accessName = expression.access.toString();

            switch (accessName) {
                case "DocumentType": accessName = "type"; break;
                case "EditMode":
                    return expandToNode`context.object.getFlag('${id}', 'editMode') ?? true`;
                default: accessName = accessName.toLowerCase(); break;
            }

            console.log("Access Name: ", accessName);
            return expandToNode`
                context.object.${accessName}
            `;
        }

        if (expression.property?.ref == undefined) {
            return;
        }
        console.log("Translating Access Expression: " + expression.property.ref?.name);

        // Determine if the property reference is the same as the object we are working with
        if ( generatingProperty && expression.property?.ref == generatingProperty) {
            console.log("Generating self referencing Property Access: ", expression.property.ref?.name);
            if (isInitiativeProperty(generatingProperty)) {
                return expandToNode`
                    @system.${expression.property.ref?.name.toLowerCase()}
                `;
            }

            // Special case: For attribute self-references, use .value instead of .mod to avoid recursion
            if (isAttributeExp(generatingProperty)) {
                const systemPath = `system.${expression.property.ref?.name.toLowerCase()}.value`;
                return expandToNode`
                    ${systemPath}
                `;
            }

            const systemPath = getSystemPath(expression.property?.ref, expression.subProperties, generatingProperty);
            return expandToNode`
                ${systemPath}
            `;
        }


        // Parent/Self property references store a *path* to another property (e.g. a chosen parent
        // attribute). Reading one as a value must dereference it to the referenced property's value,
        // not return the raw stored path. context.object is in scope in every value context
        // (derived data sets it to `this`, actions/chat use the document).
        if (isParentPropertyRefExp(expression.property?.ref) || isSelfPropertyRefExp(expression.property?.ref)) {
            const refName = expression.property!.ref!.name.toLowerCase();
            const propertyType = (expression.property!.ref as any).propertyType;
            const subs = expression.subProperties ?? [];
            let accessor = "";
            if (subs.length > 0) {
                accessor = subs.map(s => `?.${s.toLowerCase()}`).join("");
            } else if (propertyType === "attribute") {
                accessor = "?.mod";
            } else if (propertyType === "resource" || propertyType === "tracker" || propertyType === "choice") {
                accessor = "?.value";
            }

            if (isParentPropertyRefExp(expression.property?.ref)) {
                // Parent refs store a full path (e.g. "system.fight") resolved against the parent.
                return expandToNode`
                    foundry.utils.getProperty(context.object.parent, context.object.system.${refName}.toLowerCase())${accessor}
                `;
            }
            // Self refs store a property name resolved against this document under system.
            return expandToNode`
                foundry.utils.getProperty(context.object, "system." + context.object.system.${refName}.toLowerCase())${accessor}
            `;
        }

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression);

        if (isStatusProperty(generatingProperty)) {
            console.log("This is a status property, swapping to self-access");
            systemPath = systemPath.replace("system.", "this.");
        }

        console.log("System Path: ", systemPath);
        if (isInitiativeProperty(generatingProperty)) {
            return expandToNode`
                @${systemPath}
            `;
        }

        if (isAction(generatingProperty)) {
            return expandToNode`
                context.object.${systemPath}
            `;
        }

        // If accessing a property on a document choice, wrap with ?? 0 to handle missing documents
        const needsNullCoalescing = isDocumentChoiceExp(expression.property?.ref) && expression.subProperties && expression.subProperties.length > 0;

        if (needsNullCoalescing) {
            return expandToNode`
                (${systemPath} ?? 0)
            `;
        }

        return expandToNode`
            ${systemPath}
        `;
    }

    // function translateResourceAccessExpression(expression: ResourceAccess): CompositeGeneratorNode | undefined {
    //     console.log("Translating Resource Access Expression: " + expression.property?.ref?.name);

    //     let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);

    //     if (isStatusProperty(generatingProperty)) {
    //         console.log("This is a status property, swapping to self-access");
    //         systemPath = systemPath.replace("system.", "this.");
    //     }

    //     console.log("System Path: ", systemPath);

    //     return expandToNode`
    //         ${systemPath}
    //     `;
    // }

    function translateIfStatement(expression: IfStatement): CompositeGeneratorNode | undefined {
        //console.log("Translating If Statement: ");

        function translateElseIfStatement(elif: ElseIf): CompositeGeneratorNode {
            return expandToNode`
                else if (${translateExpression(entry, id, elif.expression, preDerived, generatingProperty)}) {
                    ${translateBodyExpressionToJavascript(entry, id, elif.method.body, preDerived, generatingProperty)}
                }
            `;
        }

        return expandToNode`
            if (${translateExpression(entry, id, expression.expression, preDerived, generatingProperty)}) {
                ${translateBodyExpressionToJavascript(entry, id, expression.method.body, preDerived, generatingProperty)}
            }
            ${joinToNode(expression.elseIfs, translateElseIfStatement, { appendNewLineIfNotEmpty: true })}
            ${expression.elseMethod != undefined ? expandToNode`
                else {
                    ${translateBodyExpressionToJavascript(entry, id, expression.elseMethod?.body, preDerived, generatingProperty)}
                }
            `.appendNewLineIfNotEmpty() : ""}
        `;
    }

    function translateComparisonExpression(expression: WhenExpressions): CompositeGeneratorNode | undefined {

        console.log("Translating Comparison Expression: ");

        if (isParentTypeCheckExpression(expression)) {
            return expandToNode`
                context.object.parent && context.object.parent.type == "${expression.document.ref?.name?.toLowerCase()}"
            `;
        }

        if (isTargetTypeCheckExpression(expression)) {
            return expandToNode`
                context.target && context.target.type == "${expression.document.ref?.name?.toLowerCase()}"
            `;
        }

        // If the term is "equals" or "==", we need to translate it to "===" in JavaScript
        let term = expression.term?.toString() ?? "";
        if (term == "equals" || term == "==") {
            term = "===";
        }

        if (isShorthandComparisonExpression(expression)) {
            console.log("Shorthand Comparison Expression: ", term);
            if (term == "exists") {
                return expandToNode`
                    ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} != undefined
                `;
            }
            else if (term == "!exists") {
                return expandToNode`
                    ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} == undefined
                `;
            }
            else if (term == "isEmpty") {
                return expandToNode`
                    (${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)})?.length === 0
                `;
            }
            else if (term == "isNotEmpty") {
                return expandToNode`
                    (${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)})?.length > 0
                `;
            }
            return expandToNode`
                ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} ${term}
            `;
        }

        console.log("Comparison Expression: ", expression.e1.$type, term, expression.e2.$type);

        if (term == "has") {
            return expandToNode`
                (${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)})?.includes(${translateExpression(entry, id, expression.e2, preDerived, generatingProperty)})
            `;
        }
        if (term == "excludes") {
            return expandToNode`
                !(${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)})?.includes(${translateExpression(entry, id, expression.e2, preDerived, generatingProperty)})
            `;
        }
        if (term == "startsWith") {
            return expandToNode`
                (${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)})?.startsWith(${translateExpression(entry, id, expression.e2, preDerived, generatingProperty)})
            `;
        }
        if (term == "endsWith") {
            return expandToNode`
                (${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)})?.endsWith(${translateExpression(entry, id, expression.e2, preDerived, generatingProperty)})
            `;
        }

        return expandToNode`
            ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} ${term} ${translateExpression(entry, id, expression.e2, preDerived, generatingProperty)}
        `;
    }

    if (expression == undefined) {
        return;
    }

    if (typeof expression == "string" && expression == "nothing") {
        return expandToNode`
            null
        `;
    }
    if (typeof expression == "string") {
        return expandToNode`
            "${expression}"
        `;
    }

    if (typeof expression == "number") {
        return expandToNode`
            ${expression}
        `;
    }

    if (isMethodBlock(expression)) {
        //console.log("Translating Method Block: ");
        return translateBodyExpressionToJavascript(entry, id, expression.body, preDerived, generatingProperty);
    }
    if (isVariableExpression(expression)) {
        return translateMethodExpression(expression as VariableExpression);
    }
    if (isReturnExpression(expression)) {
        return translateReturnExpression(expression as ReturnExpression);
    }
    if (isAssignment(expression)) {
        return translateAssignmentExpression(expression as Assignment);
    }
    if (isVariableAssignment(expression)) {
        return translateVariableAssignment(expression as VariableAssignment);
    }
    if (isParentAssignment(expression)) {
        return translateParentAssignmentExpression(expression as ParentAssignment);
    }
    if (isTargetAssignment(expression)) {
        return translateTargetAssignmentExpression(expression as TargetAssignment);
    }
    if (isTernaryExp(expression)) {
        const cond = translateExpression(entry, id, (expression as TernaryExp).condition, preDerived, generatingProperty);
        const then = translateExpression(entry, id, (expression as TernaryExp).thenExp, preDerived, generatingProperty);
        const else_ = translateExpression(entry, id, (expression as TernaryExp).elseExp, preDerived, generatingProperty);
        return expandToNode`(${cond} ? ${then} : ${else_})`;
    }
    if (isBinaryExpression(expression)) {
        return translateBinaryExpression(expression as BinaryExpression);
    }
    if (isLiteral(expression)) {
        return translateLiteralExpression(expression as Literal);
    }
    if (isRef(expression)) {
        return translateReferenceExpression(expression as Ref);
    }
    if (isGroup(expression)) {
        return translateGroupedExpression(expression as Group);
    }
    if (isNegExpression(expression)) {
        return translateNegatedExpression(expression as NegExpression);
    }
    // if (isResourceAccess(expression)) {
    //     return translateResourceAccessExpression(expression as ResourceAccess);
    // }
    if (isAccess(expression)) {
        return translateAccessExpression(expression as Access, generatingProperty);
    }

    if (isParentAccess(expression)) {
        let path = "context.object.parent";

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression, true);
        path = `${path}?.${systemPath}`;

        console.log("Translating Parent Access Expression: ", path);

        return expandToNode`
            ${path} ?? 0
        `;
    }
    if (isTargetAccess(expression)) {
        let path = "context.target";

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, undefined, true);
        path = `${path}?.${systemPath}`;

        console.log("Translating Target Access Expression: ", path);

        return expandToNode`
            ${path}
        `;
    }
    if (isItemAccess(expression)) {
        const itemPropName = expression.property?.toLowerCase();
        let path = `item.system.${itemPropName}`;
        if (expression.subProperty != undefined) {
            path = `${path}.${expression.subProperty}`;
        }
        else {
            // `item.X` inside a where: clause iterates over the container's referenced document.
            // Choice fields are stored as {value,...} objects, so resolve the field and compare by
            // its .value rather than the whole object (e.g. `where: item.Type equals "Armor"`).
            const whereContainer =
                AstUtils.getContainerOfType(expression, isTableField) ??
                AstUtils.getContainerOfType(expression, isDocumentChoiceExp) ??
                AstUtils.getContainerOfType(expression, isDocumentChoicesExp) ??
                AstUtils.getContainerOfType(expression, isInventoryField);
            const refDoc = ((whereContainer as any)?.documents?.[0]?.ref ?? (whereContainer as any)?.document?.ref) as Document | undefined;
            if (refDoc) {
                const prop = AstUtils.streamAllContents(refDoc).find(
                    n => isProperty(n) && (n as Property).name.toLowerCase() === itemPropName
                ) as Property | undefined;
                if (prop && (isStringChoiceField(prop) || isDamageTypeChoiceField(prop))) {
                    path = `${path}.value`;
                }
            }
        }
        return expandToNode`
            ${path}
        `;
    }
    if (isIfStatement(expression)) {
        return translateIfStatement(expression as IfStatement);
    }
    if (isWhenExpressions(expression)) {
        return translateComparisonExpression(expression as WhenExpressions);
    }
    if (isRollResultAccess(expression)) {
        const target = expression.variable.ref?.name;
        const jsMethod = expression.method === "count" ? "countDice"
            : expression.method === "contains" ? "containsDie"
            : expression.method;
        const arg = expression.arg;
        const argJs = arg.param != undefined
            ? expandToNode`(${arg.param.name}) => ${translateExpression(entry, id, arg.body!, preDerived, generatingProperty)}`
            : translateExpression(entry, id, arg.value!, preDerived, generatingProperty);
        return expandToNode`${target}.${jsMethod}(${argJs})`;
    }
    if (isFleetingAccess(expression)) {
        let accessPath = expression.variable.ref?.name;
        if (expression.subProperty != undefined) {
            // Foundry's Roll#dice returns DiceTerms; remap r.dice to the face-value getter.
            const isRollDice = (isRoll(expression.variable.ref?.value) || isDamageRoll(expression.variable.ref?.value))
                && expression.subProperty.toLowerCase() === "dice";
            accessPath = `${accessPath}.${isRollDice ? "diceFaces" : fleetingSubProperty(expression)}`;
        }
        else if (expression.arrayAccess != undefined) {
            const indexStr = toString(translateExpression(entry, id, expression.arrayAccess, preDerived, generatingProperty))?.trim() ?? '';
            accessPath = `${accessPath}[${indexStr}]`;
        }
        else if (isRoll(expression.variable.ref?.value) || isDamageRoll(expression.variable.ref?.value)) {
            // A bare reference to a roll variable used in a general expression
            // (comparison, arithmetic, assignment, return, function arg) should
            // use the roll's numeric total rather than the Roll object itself.
            // Chat-card rendering uses a separate path that keeps the Roll object
            // for dice display, so this does not affect "chat { roll1 }".
            accessPath = `${accessPath}.total`;
        }

        return expandToNode`
            ${accessPath}
        `;
    }
    if (isParameter(expression)) {
        return expandToNode`
            ${expression.name}
        `;
    }
    if (isJS(expression)) {
        // Remove the last "}" from the JS expression
        return expandToNode`
            ${expression.js.replace("@js{", "").slice(0, -1)}
        `;
    }
    if (isChatCard(expression)) {

        function translateChatBodyExpression(expression: ChatBlockExpression) {

            if (expression.type == "flavor") {
                return undefined;
            }

            if (isAccess(expression)) {
                let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);
                const wide = (isHtmlExp(expression.property?.ref) || expression.type == "wide") ? true : false;

                if (expression.access != undefined) {
                    switch (expression.access) {
                        case "Effects":
                            return undefined; // Renders in a different way
                        case "DocumentType":
                            return expandToNode`
                                { isRoll: false, label: "Type", value: context.object.type, wide: ${wide}, hasValue: context.object.type != "" },
                            `;
                        case "EditMode":
                            return expandToNode`
                                { isRoll: false, label: "Edit Mode", value: context.object.getFlag('${id}', 'editMode') ?? true, wide: ${wide}, hasValue: context.object.getFlag('${id}', 'editMode') != undefined },
                            `;
                        // Properties on the document
                        default:
                            return expandToNode`
                                { isRoll: false, label: "${expression.access.toString()}", value: context.object.${expression.access.toString().toLowerCase()}, wide: ${wide}, hasValue: context.object.${expression.access.toString().toLowerCase()} != "" },
                            `;
                    }
                }

                if (isMeasuredTemplateField(expression.property?.ref)) {
                    return expandToNode`
                        { isRoll: false, isMeasuredTemplate: true, label: "${humanize(expression.property?.ref?.name ?? "")}", value: context.object.${systemPath}?.summary, wide: true, hasValue: context.object.${systemPath} != undefined, object: context.object.${systemPath} },
                    `;
                }

                if (isParentPropertyRefExp(expression.property?.ref)) {
                    return expandToNode`
                        { isRoll: false, label: "${humanize(expression.property?.ref?.name ?? "")}", value: context.object.${systemPath}.replace("system", "").replaceAll(".", "").titleCase(), wide: ${wide}, hasValue: context.object.${systemPath} != "" },
                    `;
                }

                if (isSelfPropertyRefExp(expression.property?.ref)) {
                    return expandToNode`
                        { isRoll: false, label: "${humanize(expression.property?.ref?.name ?? "")}", value: foundry.utils.getProperty(context.object, context.object.${systemPath}).replace("system", "").replaceAll(".", "").titleCase(), wide: ${wide}, hasValue: context.object.${systemPath} != "" },
                    `;
                }

                return expandToNode`
                    { isRoll: false, label: "${humanize(expression.property?.ref?.name ?? "")}", value: context.object.${systemPath}, wide: ${wide}, hasValue: context.object.${systemPath} != "" },
                `;
            }
            if ( isFleetingAccess(expression) ) {
                let accessPath = expression.variable.ref?.name;
                if (expression.subProperty != undefined) {
                    accessPath = `${accessPath}.${fleetingSubProperty(expression)}`;
                }

                let roll = false;
                let wide = expression.type == "wide" ? true : false;
                //console.log(expression.variable.ref?.value);

                // Check if this is a damage roll first (before regular roll check)
                if (isDamageRoll(expression.variable.ref?.value)) {
                    roll = true;
                    wide = true;
                    return expandToNode`
                        { 
                            isRoll: ${roll}, 
                            isDamageRoll: true,
                            label: "${humanize(expression.variable.ref?.name ?? "")}", 
                            value: ${accessPath}, 
                            wide: ${wide}, 
                            tooltip: await ${accessPath}.getTooltip(),
                            damageType: ${accessPath}.options.type.value,
                            damageIcon: ${accessPath}.options.type.icon,
                            damageColor: ${accessPath}.options.type.color,
                            damageMetadata: ${accessPath}.options.type
                        },
                    `;
                }

                if (isRoll(expression.variable.ref?.value)) {
                    roll = true
                    wide = true;

                    return expandToNode`
                        { isRoll: ${roll}, label: "${humanize(expression.variable.ref?.name ?? "")}", value: ${accessPath}, wide: ${wide}, tooltip: await ${accessPath}.getTooltip() },
                    `;
                }

                return expandToNode`
                    { isRoll: ${roll}, label: "${humanize(expression.variable.ref?.name ?? "")}", value: ${accessPath}, wide: ${wide}, hasValue: ${accessPath} != "" },
                `;
            }
            if ( isParentAccess(expression) ) {
                let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, undefined, true);
                const wide = expression.type == "wide" ? true : false;
                return expandToNode`
                    { isRoll: false, label: "${humanize(expression.property?.ref?.name ?? "")}", value: context.object.parent?.${systemPath}, wide: ${wide}, hasValue: context.object.parent?.${systemPath} != "" },
                `;
            }
            if ( isTargetAccess(expression) ) {
                let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, undefined, true);
                const wide = expression.type == "wide" ? true : false;
                return expandToNode`
                    { isRoll: false, label: "${humanize(expression.property?.ref?.name ?? "")}", value: context.target?.${systemPath}, wide: ${wide}, hasValue: context.target?.${systemPath} != "" },
                `;
            }
            if ( isExpression(expression) ) {
                return expandToNode`
                    { isParagraph: true, value: ${translateExpression(entry, id, expression, preDerived, generatingProperty)} },
                `;
            }
            return;
        }

        function translateChatBodyExpressionForFlavor(expression: ChatBlockExpression) {

            if (isAccess(expression)) {
                let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);
                return expandToNode`
                    context.object.${systemPath}
                `;
            }
            if ( isFleetingAccess(expression) ) {
                let accessPath = expression.variable.ref?.name;
                if (expression.subProperty != undefined) {
                    accessPath = `${accessPath}.${fleetingSubProperty(expression)}`;
                }
                return expandToNode`
                    ${accessPath}
                `;
            }
            if ( isExpression(expression) ) {
                return expandToNode`
                    ${translateExpression(entry, id, expression, preDerived, generatingProperty)}
                `;
            }
            return;
        }

        const flavorTag = expression.body.chatExp.find(x => x.type == "flavor");
        const shouldShowEffects = expression.body.chatExp.some(x => isAccess(x) && x.access === "Effects");

        return expandToNode`
            // Create the chat message
            const ${expression.name}Description = context.object.description ?? context.object.system.description;
            const ${expression.name}Context = { 
                cssClass: "${id} ${toMachineIdentifier(expression.name)}",
                document: context.object,
                description: ${expression.name}Description,
                hasDescription: ${expression.name}Description!= "",
                hasEffects: ${shouldShowEffects},
                parts: [
                    ${joinToNode(expression.body.chatExp.filter(x => x.type != "tag"), (expression) => translateChatBodyExpression(expression), { appendNewLineIfNotEmpty: true })}
                ],
                tags: [
                    ${joinToNode(expression.body.chatExp.filter(x => x.type == "tag"), (expression) => translateChatBodyExpression(expression), { appendNewLineIfNotEmpty: true })}
                ]
            };
            const ${expression.name}Content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", ${expression.name}Context);
            const ${expression.name}ChatFlavor = (system) => {
                return ${flavorTag != undefined ? translateChatBodyExpressionForFlavor(flavorTag) : `""`}
            }
            await ChatMessage.create({
                user: game.user._id,
                speaker: ChatMessage.getSpeaker(),
                content: ${expression.name}Content,
                flavor: ${expression.name}ChatFlavor(context.object.system),
                ...(${expression.name}Context.parts.find(x => x.isRoll) ? {} : { style: CONST.CHAT_MESSAGE_STYLES.IC }),
                rolls: Array.from(${expression.name}Context.parts.filter(x => x.isRoll).map(x => x.value)),
            });
        `;
    }
    if (isRoll(expression) || isDamageRoll(expression)) {
        console.log("Translating Roll Expression");



        if (isDamageRoll(expression)) {
            const rollParam = expression.params.find(isRollParam) as RollParam;
            const rollExpression = rollParam.value as Roll;
            const typeParam = expression.params.find(isTypeParam) as TypeParam;
            let damageTypeDataAccess = '';

            if (isAccess(typeParam.value)) {
                damageTypeDataAccess = `context.object.system.${typeParam.value?.property?.ref?.name.toLowerCase()}`;
            } else if (isParentAccess(typeParam.value)) {
                // Handle parent.SomeDamageType
                const parentPath = typeParam.value.property?.ref?.name?.toLowerCase() ?? '';
                damageTypeDataAccess = `context.object.parent?.system.${parentPath}`;
            }
            return expandToNode`
                await new ${entry.config.name}DamageRoll(
                    ${joinToNode(rollExpression.parts, e => translateDiceParts(e), {separator: " + "})},
                     {${joinToNode(rollExpression.parts, e => translateDiceData(e, entry, id, preDerived, generatingProperty), {separator: ", "})},
                     actor: context.actor},
                     { type: ${damageTypeDataAccess} }
                ).roll()
            `;
        }

        const rollParts = expression.parts;
        const displayFormulaParts = rollParts.map(e => translateDisplayFormula(e));
        const displayFormula = displayFormulaParts.every(p => p != null)
            ? displayFormulaParts.join("")
            : undefined;

        // Build the detection-config options (crit/fumble/success/failure) passed as the
        // Roll constructor's 3rd arg, so getters can read them off this.options after .roll().
        const critParam = expression.params.find(isCritParam);
        const fumbleParam = expression.params.find(isFumbleParam);
        const successParam = expression.params.find(isSuccessParam);
        const failureParam = expression.params.find(isFailureParam);
        const optionEntries: CompositeGeneratorNode[] = [];
        const thresholdEntry = (key: string, p: { op?: string, value: Expression }) =>
            expandToNode`${key}: { op: "${p.op ?? '=='}", value: ${translateExpression(entry, id, p.value, preDerived, generatingProperty)} }`;
        if (critParam) optionEntries.push(thresholdEntry("crit", critParam));
        if (fumbleParam) optionEntries.push(thresholdEntry("fumble", fumbleParam));
        if (successParam) optionEntries.push(thresholdEntry("success", successParam));
        if (failureParam) optionEntries.push(thresholdEntry("failure", failureParam));
        const rollOptions = optionEntries.length > 0
            ? expandToNode`, { ${joinToNode(optionEntries, e => e, { separator: ", " })} }`
            : undefined;

        return expandToNode`
            Object.assign(await new ${entry.config.name}Roll(${joinToNode(rollParts, (e, idx) => {
                const nextPart = rollParts[idx + 1];
                const nextIsDice = nextPart != null && isLiteral(nextPart) && typeof nextPart.val === 'string' && IntelligentSystemDesignLanguageTerminals.DICE.test(nextPart.val);
                return translateDiceParts(e, nextIsDice);
            }, {separator: " + "})}, {${joinToNode(rollParts, e => translateDiceData(e, entry, id, preDerived, generatingProperty), {separator: ", "})}}${rollOptions ?? ''}).roll(), ${displayFormula != null ? `{_displayFormula: "${displayFormula}"}` : '{}'})
        `;
    }

    if (isSelfMethod(expression)) {
        switch (expression.method) {
            case "delete()": {
                return expandToNode`
                    await document.delete();
                    selfDeleted = true;
                `;
            }
            case "update()": {
                return expandToNode`
                    if (selfDeleted) {
                        ui.notifications.error("Cannot update a deleted document");
                    }
                    else if (Object.keys(update).length > 0) {
                        await document.update(update);
                        context.object.system = document.system;
                    }
                    update = {};
                `.appendNewLine();
            }
            default: {
                throw new Error("Unknown method called on self");
            }
        }
    }

    if (isArrayExpression(expression)) {
        return expandToNode`
            [${joinToNode(expression.items, e => translateExpression(entry, id, e, preDerived, generatingProperty), {separator: ", "})}]
        `;
    }

    if (isEach(expression)) {
        //const expressionCollection = expression.collection;
        const eachExpression = expression as Each;
        const collection = translateExpression(entry, id, expression.collection, preDerived, generatingProperty);
        if (isNumberRange(expression.collection)) {
            return expandToNode`
            for (const ${translateExpression(entry, id, expression.var, preDerived, generatingProperty)} of ${collection} ?? []) {
                ${translateBodyExpressionToJavascript(entry, id, expression.method.body, preDerived, generatingProperty)}
            }
            `;
        }
        let updateExpression: CompositeGeneratorNode | undefined;

        // If the body expression had a variable assignment against the collection, we need to update the collection
        if (expression.method.body.some(x => {
                return isVariableAssignment(x) && x.variable.ref == eachExpression.var;
            })) {
            if (isParentAccess(expression.collection)) {
                updateExpression = expandToNode`
            parentEmbeddedUpdate["${getSystemPath(expression.collection.property?.ref, [], undefined, false)}"] = ${collection};
            `;
            } else if (isTargetAccess(expression.collection)) {
                updateExpression = expandToNode`
            targetEmbeddedUpdate["${getSystemPath(expression.collection.property?.ref, [], undefined, false)}"] = ${collection};
            `;
            } else {
                updateExpression = expandToNode`
            embeddedUpdate["${collection}"] = ${collection};
            `;
            }
        }

        return expandToNode`
            for (const ${translateExpression(entry, id, expression.var, preDerived, generatingProperty)} of ${collection} ?? []) {
            ${translateBodyExpressionToJavascript(entry, id, expression.method.body, preDerived, generatingProperty)}
            }
            ${updateExpression}
        `;
    }

    if (isPrompt(expression)) {
        const labelParam = expression.params.find(x => isLabelParam(x)) as LabelParam | undefined;
        const title = labelParam?.value ?? "Prompt";

        const targetParam = expression.params.find(x => isTargetParam(x)) as TargetParam | undefined;
        const target = targetParam?.value ?? "self";

        // Registry key for the generated Vue prompt app (game.system.prompts.<doc><container><variable>).
        // The container is the enclosing `action` OR `function` -- prompts work inside either.
        const promptContainer = getPromptContainer(expression);
        const promptDocument = AstUtils.getContainerOfType(expression, isDocument);
        const promptVariable = getPromptVariable(expression);
        const promptKey = (promptDocument && promptContainer)
            ? getPromptRegistryKey(promptDocument, promptContainer, promptVariable)
            : '';

        const locationParam = expression.params.find(x => isLocationParam(x)) as LocationParam | undefined;
        const widthParam = expression.params.find(x => isWidthParam(x)) as WidthParam | undefined;
        const heightParam = expression.params.find(x => isHeightParam(x)) as HeightParam | undefined;
        const timeLimitParam = expression.params.find(x => isTimeLimitParam(x)) as TimeLimitParam | undefined;
        // const iconParam = expression.params.find(x => isIconParam(x));
        // const icon = iconParam?.value ?? "fa-solid fa-comment-dots";

        let durationExpression: CompositeGeneratorNode | undefined;

        if (timeLimitParam != undefined) {
            let durationMod = "";
            const duration = translateExpression(entry, id, timeLimitParam.value, preDerived, generatingProperty);
            let units = timeLimitParam.unit ?? "ms";
            if (units === "seconds") {
                durationMod = ` * 1000`;
            }
            else if (units === "minutes") {
                durationMod = ` * 60 * 1000`;
            }
            durationExpression = expandToNode`
                ${duration}${durationMod}
            `;
        }

        if (target == "gm") {
            return expandToNode`
                await new Promise((resolve, reject) => {

                    const firstGm = game.users.find(u => u.isGM && u.active);
                    const uuid = foundry.utils.randomID();

                    // Setup a listener that will wait for this response
                    game.socket.on("system.${id}", (data) => {
                        if (data.type != "promptResponse" || data.uuid != uuid) return;

                        // Resolve the promise with the data
                        resolve(data.data);
                    });

                    game.socket.emit("system.${id}", {
                        uuid: uuid,
                        type: "prompt",
                        userId: game.user.id,
                        ${widthParam ? `width: ${widthParam.value},` : ""}
                        ${heightParam ? `height: ${heightParam.value},` : ""}
                        ${locationParam ? expandToNode`left: ${translateExpression(entry, id, locationParam.x, false, generatingProperty)},
                        top: ${translateExpression(entry, id, locationParam.y, false, generatingProperty)},` : ""}
                        ${timeLimitParam ? expandToNode`timeLimit: ${durationExpression},` : ""}
                        title: "${title}",
                        promptKey: "${promptKey}",
                        documentUuid: context.object.uuid,
                    }, {recipients: [firstGm.id]});
                });
            `;
        }

        if (target == "target") {
            return expandToNode`
                await new Promise((resolve, reject) => {
                    // Try to find a non-GM owner
                    let owner = game.users.find(u => u.active && !u.isGM && u.id != game.user.id && context.target.testUserPermission(u, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
                    
                    // If no owner is found, use the first active user
                    if (!owner) {
                        owner = game.users.find(u => u.active && u.id != game.user.id && context.target.testUserPermission(u, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
                    }
                    
                    // If still no owner is found, default to the current user
                    if (!owner) {
                        owner = game.user.id;
                    }
                    let ownerId = owner.id;
                    const uuid = foundry.utils.randomID();

                    // Setup a listener that will wait for this response
                    game.socket.on("system.${id}", (data) => {
                        if (data.type != "promptResponse" || data.uuid != uuid) return;

                        // Resolve the promise with the data
                        resolve(data.data);
                    });

                    game.socket.emit("system.${id}", {
                        uuid: uuid,
                        type: "prompt",
                        userId: game.user.id,
                        ${widthParam ? `width: ${widthParam.value},` : ""}
                        ${heightParam ? `height: ${heightParam.value},` : ""}
                        ${locationParam ? expandToNode`left: ${translateExpression(entry, id, locationParam.x, false, generatingProperty)},
                        top: ${translateExpression(entry, id, locationParam.y, false, generatingProperty)},` : ""}
                        ${timeLimitParam ? expandToNode`timeLimit: ${durationExpression},` : ""}
                        title: "${title}",
                        promptKey: "${promptKey}",
                        documentUuid: context.object.uuid,
                    }, {recipients: [ownerId]});
                });
            `;
        }

        if (target == "user") {
            return expandToNode`
            await new Promise(async (resolve, reject) => {

                const allActiveUsers = game.users.filter(u => u.active && u.id != game.user.id);
                const targetedUser = await Dialog.prompt({
                    title: "Select User",
                    content: \`<form>
                        <div class="form-group">
                            <label>\${game.i18n.localize("User")}</label>
                            <select name="user">
                                \${allActiveUsers.map(u => \`<option value="\${u.id}">\${u.name}</option>\`).join("")}
                            </select>
                        </div>
                    </form>\`,
                    callback: (html, event) => {
                        const formData = new FormDataExtended(html[0].querySelector("form"));
                        return formData.get("user");
                    },
                    options: {
                        classes: ["${id}", "dialog"],
                    }
                });
                const uuid = foundry.utils.randomID();

                // Setup a listener that will wait for this response
                game.socket.on("system.${id}", (data) => {
                    if (data.type != "promptResponse" || data.uuid != uuid) return;

                    // Resolve the promise with the data
                    resolve(data.data);
                });

                game.socket.emit("system.${id}", {
                    uuid: uuid,
                    type: "prompt",
                    userId: game.user.id,
                    title: "${title}",
                    promptKey: "${promptKey}",
                    documentUuid: context.object.uuid,
                    ${widthParam ? expandToNode`width: ${widthParam.value},` : ""}
                    ${heightParam ? expandToNode`height: ${heightParam.value},` : ""}
                    ${locationParam ? expandToNode`left: ${translateExpression(entry, id, locationParam.x, false, generatingProperty)},
                    top: ${translateExpression(entry, id, locationParam.y, false, generatingProperty)},` : ""}
                    ${timeLimitParam ? expandToNode`timeLimit: ${durationExpression},` : ""}
                }, {recipients: [targetedUser]});
            });
        `;
        }

        // Self-target: open the generated Vue prompt app (game.system.prompts.<doc><action>).
        // The app resolves this promise with the user's input (or {} on cancel/close).
        return expandToNode`
            await new Promise(async (resolve, reject) => {
                const promptApp = new game.system.prompts.${promptKey}(context.object, { promptResolve: resolve });
                promptApp.render(true);
            });
        `;
    }

    if (isMathExpression(expression)) {
        expression = expression as MathExpression;

        console.log("Translating Math Expression: ", expression.operation);

        if (isMathEmptyExpression(expression)) {
            return expandToNode`
                Math.${expression.operation}()
            `;
        }
        if (isMathSingleExpression(expression)) {
            return expandToNode`
                Math.${expression.operation}(${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)})
            `;
        }
        if (isMathParamExpression(expression)) {
            return expandToNode`
                Math.${expression.operation}(${joinToNode(expression.params, x => translateExpression(entry, id, x, preDerived, generatingProperty), {separator: ", "})})
            `;
        }
        throw new Error("Unknown Math Expression type encountered while translating to JavaScript ");
    }

    if (isLogExpression(expression)) {
        console.log("Translating Log Expression: ");
        return expandToNode`
            console.log(${joinToNode(expression.params, x => translateExpression(entry, id, x, preDerived, generatingProperty), {separator: ", "})})
        `;
    }

    if (isUpdate(expression)) {
        console.log("Translating Update Expression:");

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref, false);

        if (isUpdateParent(expression)) {
            return expandToNode`
                parentUpdate["${systemPath}"] = foundry.utils.getProperty(context.object.parent, "system.${systemPath}");
            `;
        }
        else if (isUpdateSelf(expression)) {
            return expandToNode`
                update["system.${systemPath}"] = system.${systemPath};
            `;
        }
    }

    if (isVisibilityValue(expression)) {
        console.log("Translating Visibility Value Expression: ", expression.visibility);

        return expandToNode`
            "${expression.visibility}"
        `;
    }

    if (isFunctionCall(expression)) {
        console.log("Translating Function Call Expression: ");

        // If this is a function call, we need to translate it to a JavaScript function call
        const args = joinToNode(expression.params, (arg) => {
            console.log("Translating Function Call Argument: ", arg.$type, generatingProperty?.$type);
            return translateExpression(entry, id, arg, preDerived, generatingProperty)
        }, { separator: ", " });

        // In a derived/calculated context (data prep), functions are emitted as local synchronous
        // closures in the _prepare<Doc>DerivedData scope (see derived-data-generator). They take the
        // in-scope `system` and no update/await — derived values run synchronously and must be pure.
        if (preDerived) {
            return expandToNode`
                function_${expression.method.ref?.name}(system${expression.params.length ? ", " : ""}${args})
            `;
        }

        let accessPath = "this";

        if (isTrackerExp(generatingProperty)) {
            accessPath = "document.sheet";
        }

        return expandToNode`
            await ${accessPath}.function_${expression.method.ref?.name}(context, update, embeddedUpdate, parentUpdate, parentEmbeddedUpdate, targetUpdate, targetEmbeddedUpdate, ${args})
        `;
    }

    if (isParentFunctionCall(expression)) {
        console.log("Translating Parent Function Call Expression: ", expression.method);

        // parent.FunctionName(args) — call a function defined on the parent actor from within an item.
        // Resolves to the parent document's sheet function_ method at runtime.
        // Uses the pre-threaded parentUpdate / parentEmbeddedUpdate objects as the update context.
        // The caller's normal action flush already handles flushing parentUpdate/parentEmbeddedUpdate.
        const args = joinToNode(expression.params, (arg) => {
            return translateExpression(entry, id, arg, preDerived, generatingProperty)
        }, { separator: ", " });

        return expandToNode`
            await context.object.parent?.sheet?.function_${expression.method}(
                { object: context.object.parent },
                parentUpdate,
                parentEmbeddedUpdate,
                {}, {}, {}, {}${expression.params.length ? ", " : ""}${args})
        `;
    }

    if (isNumberRange(expression)) {
        const from = translateExpression(entry, id, expression.start, preDerived, generatingProperty);
        const to = translateExpression(entry, id, expression.end, preDerived, generatingProperty);

        console.log("Translating Number Range Expression: ", from, to);

        // Make a JS array of numbers from from to to
        return expandToNode`
            Array.from({length: ${to} - ${from} + 1}, (_, i) => ${from} + i)
        `;
    }

    if (isWait(expression)) {
        console.log("Translating Wait Expression: ", expression.duration);

        const duration = translateExpression(entry, id, expression.duration, preDerived, generatingProperty);

        const units = expression.unit;
        let durationMod = "";
        if (units === "seconds") {
            durationMod = ` * 1000`;
        }
        else if (units === "minutes") {
            durationMod = ` * 60 * 1000`;
        }

        return expandToNode`
            await new Promise(resolve => setTimeout(resolve, ${duration}${durationMod})); // Wait for ${expression.duration} ${units}
        `;
    }

    if (isPlayAudio(expression)) {
        const fileParam = expression.params.find(x => isPlayAudioFile(x)) as PlayAudioFile | undefined;
        if (!fileParam) return undefined;

        const volumeParam = expression.params.find(x => isPlayAudioVolume(x)) as PlayAudioVolume | undefined;
        const volume = volumeParam?.value ?? 0.5;

        return expandToNode`
            await game.system.utils.playSfx(${translateExpression(entry, id, fileParam.value, false, generatingProperty)}, ${translateExpression(entry, id, volume, false, generatingProperty)});
        `;
    }

    if (isCombatMethods(expression)) {
        const method = expression.method;

        return expandToNode`
            if (!game.combat) {
                return;
            }
            if (game.combat.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
                ${method == "nextTurn" ? expandToNode`game.combat.nextTurn();` : ""}
                ${method == "end" ? expandToNode`game.combat.endCombat();` : ""}
            }
            else {
                await new Promise((resolve, reject) => {
                    const firstGm = game.users.find(u => u.isGM && u.active);
                    if (!firstGm) {
                        ui.notifications.error("No active GM found to handle combat method request");
                        return;
                    }
                    const uuid = foundry.utils.randomID();

                    // Setup a listener that will wait for this response
                    game.socket.on("system.${id}", (data) => {
                        if (data.type != "combatResponse" || data.uuid != uuid) return;

                        resolve();
                    });

                    game.socket.emit("system.${id}", {
                        uuid: uuid,
                        type: "combat",
                        userId: game.user.id,
                        method: "${method}",
                    }, {recipients: [firstGm.id]});
                });
            }
        `;
    }

    if (isCombatProperty(expression)) {
        const property = expression.property;

        if (property == "isMyTurn") {
            return expandToNode`game.combat && game.combat.combatant?.actor?.uuid == context.actor?.uuid`;
        }
        else if (property == "isNotMyTurn") {
            return expandToNode`game.combat && game.combat.combatant?.actor?.uuid != context.actor?.uuid`;
        }
    }

    if (isUserProperty(expression)) {
        const property = expression.property;

        if (property == "isGM") {
            return expandToNode`game.user.isGM`;
        }
        if (property == "name") {
            return expandToNode`game.user.name`;
        }
    }

    if (isSystemSettingAccess(expression)) {
        const setting = (expression as SystemSettingAccess).setting.ref;
        return expandToNode`game.settings.get('${id}', '${setting?.name.toLowerCase()}')`;
    }

    if (isSystemSettingAssignment(expression)) {
        const assignment = expression as SystemSettingAssignment;
        const setting = assignment.setting.ref;
        const value = translateExpression(entry, id, assignment.exp, preDerived, generatingProperty);
        return expandToNode`await game.settings.set('${id}', '${setting?.name.toLowerCase()}', ${value})`;
    }

    if (isMacroExecute(expression)) {
        const systemPath = getSystemPath(expression.macro.ref, [], undefined, false);

        return expandToNode`
            await context.object.${systemPath}?.execute();
        `;
    }

    console.log(expression.$type);
    throw new Error("Unknown expression type encountered while translating to JavaScript ");
}

export function translateBodyExpressionToJavascript(entry: Entry, id: string, body: MethodBlockExpression[], preDerived: boolean = false, generatingProperty: ClassExpression | undefined = undefined, isVue = false): CompositeGeneratorNode | undefined {

    //     /**
    //      * A method body consists of a list of Expressions that ultimately return a value.
    //      * We need to translate this into a function that will return the value of the last expression.
    //      *
    //      * Example:
    //      * {
    //      *       return (self.Strength - 10) / 2
    //      * }
    //      *
    //      * Translates to:
    //      * (self) => {
    //      *     return (self.system.strength - 10) / 2;
    //      * }
    //      *
    //      * There might be variables. Example:
    //      * {
    //      *     fleeting mod = (self.system.strength - 10) / 2;
    //      *     return mod;
    //      * }
    //      *
    //      * Translates to:
    //      * (self) => {
    //      *    let mod = (self.system.strength - 10) / 2;
    //      *    return mod;
    //      * }
    //      *
    //      * Variables might self-modify. Example:
    //      * {
    //      *     fleeting mod = self.system.strength - 10;
    //      *     mod = mod / 2;
    //      *     return mod;
    //      * }
    //      *
    //      * Translates to:
    //      * (self) => {
    //      *    let mod = self.system.strength - 10;
    //      *    mod = mod / 2;
    //      *    return mod;
    //      * }
    //      *
    //      * Expressions that need to be translated:
    //      * - MethodExpression: fleeting level = 1
    //      * - ReturnExpression: return level
    //      * - AssignmentExpression: level = level + 1 or level += 1 or level++
    //      * - BinaryExpression: level + 1
    //      * - LiteralExpression: 1
    //      * - ReferenceExpression: level
    //      * - GroupedExpression: (level + 1)
    //      * - NegatedExpression: -1
    //      */



    return joinToNode(body, (expression) => translateExpression(entry, id, expression, preDerived, generatingProperty), { appendNewLineIfNotEmpty: true });
}

// Compile a rollVisualizer field's value: expression into a Foundry roll formula
// string (containing @refs) plus the data object that resolves those refs from the
// live, reactive document/prompt context. This mirrors the roll() codegen path but
// returns the two pieces separately, so the visualizer component can ANALYZE the
// formula (convolve / simulate) rather than evaluate it as a roll.
//
// Phase 1 supports Expression values (including an explicit roll(...) node). A
// MethodBlock value yields an empty formula -- there is nothing to visualize from a
// statically-unknown computed string -- and the component renders its empty state.
export function compileVisualizerFormula(entry: Entry, id: string, field: RollVisualizerField): { formula: CompositeGeneratorNode, data: CompositeGeneratorNode } {
    const valueParam = field.params.find(isRollVisualizerValueParam) as RollVisualizerValueParam | undefined;
    const value = valueParam?.value;

    if (!value || isMethodBlock(value)) {
        return { formula: expandToNode`""`, data: expandToNode`{}` };
    }

    const parts: Expression[] = isRoll(value) ? value.parts : [value as Expression];
    const formula = expandToNode`${joinToNode(parts, e => translateDiceParts(e, true), { separator: " + " })}`;
    const data = expandToNode`{${joinToNode(parts, e => translateDiceData(e, entry, id, false, undefined), { separator: ", " })}}`;
    return { formula, data };
}
