import type {
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
    StringParamChoices,
    InitiativeProperty,
    ParentAccess,
    TargetParam,
    LabelParam,
    LocationParam,
    WidthParam,
    HeightParam,
    NumberRange,
    TargetAccess,
    TargetAssignment, PlayAudioFile, PlayAudioVolume, Each, TimeLimitParam,
} from '../../language/generated/ast.js';
import {
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
    isNumberExp,
    isStringExp,
    isTargetParam,
    IntelligentSystemDesignLanguageTerminals,
    isMathExpression,
    isMathEmptyExpression,
    isMathSingleExpression,
    isMathParamExpression,
    isStringParamChoices,
    isInitiativeProperty,
    isStatusProperty,
    isUpdate,
    isUpdateParent,
    isUpdateSelf,
    isParentTypeCheckExpression,
    isParentPropertyRefExp,
    isLogExpression,
    isTrackerExp,
    isVisibilityValue,
    isFunctionCall,
    isAction,
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
    isCombatProperty, isUserProperty, isMacroExecute, isMeasuredTemplateField
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode } from 'langium/generate';
import { getParentDocument, getSystemPath, getTargetDocument, toMachineIdentifier } from './utils.js';
import { AstUtils } from 'langium';

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

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);

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

        // TODO: Not all references are to a system property - some will be to fleeting variables

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);

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
        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, undefined);

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

        for (const subProperty of expression.subProperties ?? []) {
            if (subProperty.toLowerCase() == "name") {
                accessPath = `${expression.val.ref?.name}.name`;
            }
            else {
                accessPath = `${accessPath}.${subProperty.toLowerCase()}`;
            }
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
            if (isAttributeExp(generatingProperty) || isResourceExp(generatingProperty)) {
                return expandToNode`
                    system.${expression.property.ref?.name.toLowerCase()}.value
                `;
            }
            return expandToNode`
                system.${expression.property.ref?.name.toLowerCase()}
            `;
        }

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);

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

        // TODO: has, excludes, exists, startsWith, endsWith, isEmpty, isNotEmpty

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
            return expandToNode`
                ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} ${term}
            `;
        }

        console.log("Comparison Expression: ", expression.e1.$type, term, expression.e2.$type);

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
            ${path}
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
        let path = `item.system.${expression.property?.toLowerCase()}`;
        if (expression.subProperty != undefined) {
            path = `${path}.${expression.subProperty}`;
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
    if (isFleetingAccess(expression)) {
        let accessPath = expression.variable.ref?.name;
        if (expression.subProperty != undefined) {
            accessPath = `${accessPath}.${expression.subProperty}`;
        }
        if (expression.arrayAccess != undefined) {
            accessPath = `${accessPath}[${translateExpression(entry, id, expression.arrayAccess, preDerived, generatingProperty)}]`;
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
                const wide = isHtmlExp(expression.property?.ref) ? true : false;

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

                return expandToNode`
                    { isRoll: false, label: "${humanize(expression.property?.ref?.name ?? "")}", value: context.object.${systemPath}, wide: ${wide}, hasValue: context.object.${systemPath} != "" },
                `;
            }
            if ( isFleetingAccess(expression) ) {
                let accessPath = expression.variable.ref?.name;
                if (expression.subProperty != undefined) {
                    accessPath = `${accessPath}.${expression.subProperty}`;
                }

                let roll = false;
                let wide = false;
                //console.log(expression.variable.ref?.value);
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
                    accessPath = `${accessPath}.${expression.subProperty}`;
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
                type: ${expression.name}Context.parts.find(x => x.isRoll) ? null : CONST.CHAT_MESSAGE_STYLES.IC,
                rolls: Array.from(${expression.name}Context.parts.filter(x => x.isRoll).map(x => x.value)),
            });
        `;
    }
    if (isRoll(expression)) {
        console.log("Translating Roll Expression");

        function translateDiceParts(expression: Expression): CompositeGeneratorNode | undefined {

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
                    return expandToNode`
                        "@${expression.val.ref?.name}${expression.subProperties[0].toLowerCase()}[${humanize(expression.subProperties[0])}]"
                    `;
                }

                console.log("Ref:", `${expression.val.$refText}`);
                if (IntelligentSystemDesignLanguageTerminals.DICE.test(`${expression.val}`)) {
                    return expandToNode`
                        "${expression.val}"
                    `;
                }

                return expandToNode`
                    "@${expression.val.ref?.name?.toLowerCase() ?? expression.val.$refText}[${humanize(expression.val.ref?.name ?? expression.val.$refText)}]"
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
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}[${label}]\`
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
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}[${label}]\`
                `;
            }
            if (isAccess(expression)) {
                let path = expression.property?.ref?.name?.toLowerCase() ?? expression.propertyLookup?.ref?.name?.toLowerCase() ?? "";
                let label = humanize(expression.property?.ref?.name ?? expression.propertyLookup?.ref?.name ?? "");

                if (isDieField(expression.property?.ref)) {
                    return expandToNode`
                        \'@${path.replaceAll(".", "")}\'
                    `;
                }

                if (isParentPropertyRefExp(expression.property?.ref)) {
                    label = `${label} - \${context.object.system.${expression.property?.ref?.name.toLowerCase()}.replace("system.", "").replaceAll(".", " ").titleCase()\}`;
                }
                else {
                    for (const subProperty of expression.subProperties ?? []) {
                        path = `${path}.${subProperty}`;
                        label = `${label} ${humanize(subProperty)}`;
                    }
                }
                console.log("Access:", path, label);
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}[${label}]\`
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
                    path = `${path}.${expression.subProperty}`;
                    label = `${label} ${humanize(expression.subProperty)}`;
                }
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}[${label}]\`
                `;
            }
            if (isBinaryExpression(expression)) {
                return expandToNode`
                    ${translateDiceParts(expression.e1)} + "${expression.op}" + ${translateDiceParts(expression.e2)}
                `;
            }

            if (isGroup(expression)) {
                return expandToNode`
                    "(" + ${translateDiceParts(expression.ge)} + ")"
                `;
            }

            return;
        }

        function translateDiceData(expression: Expression | VariableAccess): CompositeGeneratorNode | undefined {
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
            if (isAccess(expression)) {
                let path = "context.object.system";
                let label = "";

                console.log("Access:", expression.property?.ref?.name, expression.propertyLookup?.ref?.name);

                if (expression.propertyLookup != undefined) {
                    path = `${path}[context.object.system.${expression.propertyLookup.ref?.name.toLowerCase()}.toLowerCase()]`;
                    label = `${label}.${expression.propertyLookup.ref?.name}`;
                }
                else if (isParentPropertyRefExp(expression.property?.ref)) {
                    path = `${path}.${expression.property?.ref?.name.toLowerCase()}`;
                    label = `${label}.${expression.property?.ref?.name}`;

                    if (expression.property?.ref.propertyType == 'resource' &&
                        (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "value")) {
                        path = `${path} + ".value"`;
                    }
                    if (expression.property?.ref.propertyType == 'attribute' &&
                        (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "mod")) {
                        path = `${path} + ".mod"`;
                    }

                    console.log(label, path);
                    return expandToNode`
                        "${label.replaceAll(".", "").replaceAll(" ", "").toLowerCase()}": foundry.utils.getProperty(context.object.parent, ${path})
                    `;
                }
                else {
                    path = `${path}.${expression.property?.ref?.name.toLowerCase()}`;
                    label = `${label}.${expression.property?.ref?.name}`;

                    if ((isResourceExp(expression.property?.ref) || isTrackerExp(expression.property?.ref)) && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "value")) {
                        path = `${path}.value`;
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
                if (expression.subProperty != undefined) {
                    path = `${path}.${expression.subProperty}`;
                }
                if (expression.arrayAccess != undefined) {
                    console.log("Array Access:", expression.arrayAccess.$type);
                    let accessExp = translateExpression(entry, id, expression.arrayAccess, preDerived, generatingProperty);
                    path = `${path}[${accessExp?.contents?.toString()}]`;
                }
                const label = expression.variable.ref?.name.toLowerCase() ?? "";
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
                    ${joinToNode(expressions, e => translateDiceData(e), {separator: ", "})}
                `;
            }

            if (isGroup(expression)) {
                return expandToNode`
                    ${translateDiceData(expression.ge)}
                `;
            }

            return undefined;
        }


        return expandToNode`
            await new ${entry.config.name}Roll(${joinToNode(expression.parts, e => translateDiceParts(e), {separator: " + "})}, {${joinToNode(expression.parts, e => translateDiceData(e), {separator: ", "})}}).roll()
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

        const locationParam = expression.params.find(x => isLocationParam(x)) as LocationParam | undefined;
        const widthParam = expression.params.find(x => isWidthParam(x)) as WidthParam | undefined;
        const heightParam = expression.params.find(x => isHeightParam(x)) as HeightParam | undefined;
        const timeLimitParam = expression.params.find(x => isTimeLimitParam(x)) as TimeLimitParam | undefined;
        // const iconParam = expression.params.find(x => isIconParam(x));
        // const icon = iconParam?.value ?? "fa-solid fa-comment-dots";

        function translateDialogBody(expression: ClassExpression): CompositeGeneratorNode | undefined {

            if (isNumberExp(expression)) {
                return expandToNode`
                    <div class="form-group">
                        <label>${humanize(expression.name)}</label>
                        <input type="number" name="${expression.name.toLowerCase()}" value="0" />
                    </div>
                `;
            }

            if (isBooleanExp(expression)) {
                return expandToNode`
                    <div class="form-group">
                        <label>${humanize(expression.name)}</label>
                        <input type="checkbox" name="${expression.name.toLowerCase()}" />
                    </div>
                `;
            }

            if (isStringExp(expression)) {
                let choices = expression.params.find(x => isStringParamChoices(x)) as StringParamChoices;
                if (choices != undefined && choices.choices.length > 0) {
                    return expandToNode`
                        <div class="form-group">
                            <label>${humanize(expression.name)}</label>
                            <select name="${expression.name.toLowerCase()}">
                                ${joinToNode(choices.choices, (choice) => expandToNode`
                                    <option value="${choice}">${choice}</option>
                                `)}
                            </select>
                        </div>
                    `;
                }
                return expandToNode`
                    <div class="form-group">
                        <label>${humanize(expression.name)}</label>
                        <input type="text" name="${expression.name.toLowerCase()}" />
                    </div>
                `;
            }

            return undefined;
        }

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
                        content: \`<form>${joinToNode(expression.body, translateDialogBody)}</form>\`,
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
                        content: \`<form>${joinToNode(expression.body, translateDialogBody)}</form>\`,
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
                    content: \`<form>${joinToNode(expression.body, translateDialogBody)}</form>\`,
                    ${widthParam ? expandToNode`width: ${widthParam.value},` : ""}
                    ${heightParam ? expandToNode`height: ${heightParam.value},` : ""}
                    ${locationParam ? expandToNode`left: ${translateExpression(entry, id, locationParam.x, false, generatingProperty)},
                    top: ${translateExpression(entry, id, locationParam.y, false, generatingProperty)},` : ""}
                    ${timeLimitParam ? expandToNode`timeLimit: ${durationExpression},` : ""}
                }, {recipients: [targetedUser]});
            });
        `;
        }

        return expandToNode`
            await new Promise(async (resolve, reject) => {
                let uuid = foundry.utils.randomID();
                ${timeLimitParam ? expandToNode`
                    setTimeout(() => {
                        console.warn("Prompt timed out:", uuid);
                        // Find the window from ui.windows with the uuid
                        const dialog = Object.values(ui.windows).find(w => w.options.classes.includes("dialog") && w.options.classes.includes("prompt") && w.options.classes.includes(uuid));
                        if (dialog) {
                            dialog.close();
                        }
                        resolve({});
                    }, ${durationExpression});
                }
                ` : ""}

                Dialog.prompt({
                    title: "${title}",
                    content: \`<form>${joinToNode(expression.body, translateDialogBody)}</form>\`,
                    callback: (html, event) => {
                        // Grab the form data
                        const formData = new FormDataExtended(html[0].querySelector("form"));
                        const data = { system: {} };
                        for (const [key, value] of formData.entries()) {
                            // Translate values to more helpful ones, such as booleans and numbers
                            if (value === "true") {
                                data[key] = true;
                                data.system[key] = true;
                            }
                            else if (value === "false") {
                                data[key] = false;
                                data.system[key] = false;
                            }
                            else if (!isNaN(value)) {
                                data[key] = parseInt(value);
                                data.system[key] = parseInt(value);
                            }
                            else {
                                data[key] = value;
                                data.system[key] = value;
                            }
                        }
                        resolve(data);
                        return data;
                    },
                    options: {
                        classes: ["${id}", "dialog", "prompt", uuid],
                        ${widthParam ? `width: ${widthParam.value},` : ""}
                        ${heightParam ? `height: ${heightParam.value},` : ""}
                        ${locationParam ? expandToNode`left: ${translateExpression(entry, id, locationParam.x, false, generatingProperty)},
                        top: ${translateExpression(entry, id, locationParam.y, false, generatingProperty)},` : ""}
                    }
                });
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

        let path = "";
        if (isUpdateSelf(expression)) {
            path = `${expression.property?.ref?.name.toLowerCase()}`;
        }
        // TODO: Parent lookup
        for (const subProperty of expression.subProperties ?? []) {
            path = `${path}.${subProperty}`;
        }

        if (isUpdateParent(expression)) {
            // TODO: I think this is wrong
            return expandToNode`
                parentUpdate["${path}"] = foundry.utils.getProperty(context.object.parent, "system.${path}");
            `;
        }
        else if (isUpdateSelf(expression)) {
            return expandToNode`
                update["system.${path}"] = system.${path});
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

        let accessPath = "this";

        if (isTrackerExp(generatingProperty)) {
            accessPath = "document.sheet";
        }

        return expandToNode`
            await ${accessPath}.function_${expression.method}(context, update, embeddedUpdate, parentUpdate, parentEmbeddedUpdate, targetUpdate, targetEmbeddedUpdate, ${args})
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
