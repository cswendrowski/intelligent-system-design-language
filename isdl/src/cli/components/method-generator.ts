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
    Property,
    ElseIf,
    VariableAssignment,
    WhenExpressions,
    Parameter,
    Prompt,
    ClassExpression,
    VariableAccess,
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
    isIncrementAssignment,
    isDecrementAssignment,
    isIncrementValAssignment,
    isDecrementValAssignment,
    isAccess,
    isMethodBlock,
    isIfStatement,
    isJS,
    isChatCard,
    isFleetingAccess,
    isHtmlExp,
    isRoll,
    isParentAccess,
    isParentIncrementAssignment,
    isParentDecrementAssignment,
    isParentDecrementValAssignment,
    isParentIncrementValAssignment,
    isParentAssignment,
    isVariableAssignment,
    isVariableIncrementValAssignment,
    isVariableDecrementValAssignment,
    isVariableIncrementAssignment,
    isVariableDecrementAssignment,
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
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode } from 'langium/generate';
import { getSystemPath, toMachineIdentifier } from './utils.js';

export function translateExpression(entry: Entry, id: string, expression: string | MethodBlock | WhenExpressions | MethodBlockExpression | Expression | Assignment | VariableExpression | ReturnExpression | ComparisonExpression | Roll | number | Parameter | Prompt, preDerived: boolean = false, generatingProperty: Property | undefined = undefined): CompositeGeneratorNode | undefined {

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

        if (isResourceExp(expression.property?.ref) && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] == "temp")) {
            // We need to check for temp first when decrementing
            const tempPath = `system.${expression.property?.ref?.name.toLowerCase()}.temp`;
            if (isDecrementAssignment(expression)) {
                return expandToNode`
                    if ( this.object.${tempPath} > 0 ) {
                        update["${tempPath}"] = this.object.${tempPath} - 1;
                    }
                    else {
                        update["${systemPath}"] = this.object.${systemPath} - 1;
                    }
                `;
            }

            if (isDecrementValAssignment(expression)) {
                return expandToNode`
                    if ( this.object.${tempPath} > 0 ) {
                        update["${tempPath}"] = this.object.${tempPath} - ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};

                        if ( update["${tempPath}"] < 0 ) {
                            // Apply the remainder to the system property
                            update["${systemPath}"] = this.object.${systemPath} + update["${tempPath}"];
                            update["${tempPath}"] = 0;
                        }
                    }
                    else {
                        update["${systemPath}"] = this.object.${systemPath} - ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
                    }
                `;
            }
        }

        if (isIncrementAssignment(expression)) {
            return expandToNode`
                update["${systemPath}"] = this.object.${systemPath} + 1;
            `;
        }
        if (isDecrementAssignment(expression)) {
            return expandToNode`
                update["${systemPath}"] = this.object.${systemPath} - 1;
            `;
        }
        if (isIncrementValAssignment(expression)) {
            return expandToNode`
                update["${systemPath}"] = this.object.${systemPath} + ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }
        if (isDecrementValAssignment(expression)) {
            return expandToNode`
                update["${systemPath}"] = this.object.${systemPath} - ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }
        return expandToNode`
            update["${systemPath}"] = ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
        `;
    }

    function translateVariableAssignment(expression: VariableAssignment): CompositeGeneratorNode | undefined {

        if (isVariableIncrementAssignment(expression)) {
            return expandToNode`
                ${expression.variable.ref?.name}++;
            `;
        }
        if (isVariableDecrementAssignment(expression)) {
            return expandToNode`
                ${expression.variable.ref?.name}--;
            `;
        }
        if (isVariableIncrementValAssignment(expression)) {
            return expandToNode`
                ${expression.variable.ref?.name} += ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }
        if (isVariableDecrementValAssignment(expression)) {
            return expandToNode`
                ${expression.variable.ref?.name} -= ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }
        return expandToNode`
            ${expression.variable.ref?.name} = ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
        `;
    }

    function translateParentAssignmentExpression(expression: ParentAssignment): CompositeGeneratorNode | undefined {
        //console.log("Translating Assignment Expression: " + expression.property.ref?.name);

        // TODO: Not all references are to a system property - some will be to fleeting variables

        let systemPath = `system.${expression.property?.toLowerCase()}`;
        if (expression.subProperty != undefined) {
            systemPath = `${systemPath}.${expression.subProperty}`;
        }

        if (isParentIncrementAssignment(expression)) {
            return expandToNode`
                parentUpdate["${systemPath}"] = this.object.parent.${systemPath} + 1;
            `;
        }
        if (isParentDecrementAssignment(expression)) {
            return expandToNode`
                parentUpdate["${systemPath}"] = this.object.parent.${systemPath} - 1;
            `;
        }
        if (isParentIncrementValAssignment(expression)) {
            return expandToNode`
                parentUpdate["${systemPath}"] = this.object.parent.${systemPath} + ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }
        if (isParentDecrementValAssignment(expression)) {
            return expandToNode`
                parentUpdate["${systemPath}"] = this.object.parent.${systemPath} - ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
            `;
        }
        return expandToNode`
            parentUpdate["${systemPath}"] = ${translateExpression(entry, id, expression.exp, preDerived, generatingProperty)};
        `;
    }

    function translateBinaryExpression(expression: BinaryExpression): CompositeGeneratorNode | undefined {
        return expandToNode`
            ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} ${expression.op} ${translateExpression(entry, id, expression.e2, preDerived, generatingProperty)}
        `;
    }

    function translateLiteralExpression(expression: Literal): CompositeGeneratorNode | undefined {
        console.log("Translating Literal Expression: " + expression.val);
        if (typeof expression.val == "string") {
            if (expression.val == "nothing") {
                return expandToNode`
                    null
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
        let accessPath = expression.val.ref?.name;
        if (expression.subProperty != undefined) {
            accessPath = `${accessPath}.system.${expression.subProperty.toLowerCase()}`;
        }
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

    function translateAccessExpression(expression: Access, generatingProperty: Property | undefined = undefined): CompositeGeneratorNode | undefined {
        if (expression.property?.ref == undefined) {
            return;
        }
        console.log("Translating Access Expression: " + expression.property.ref?.name);

        // Determine if the property reference is the same as the object we are working with
        if ( generatingProperty && expression.property?.ref == generatingProperty) {
            console.log("Generating Property Access: ", expression.property.ref?.name);
            return expandToNode`
                system.${expression.property.ref?.name.toLowerCase()}
            `;
        }

        let systemPath = getSystemPath(expression.property?.ref, expression.subProperties, expression.propertyLookup?.ref);

        console.log("System Path: ", systemPath);
        return expandToNode`
            ${systemPath}
        `;
    }

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
        // If the term is "equals" or "==", we need to translate it to "===" in JavaScript
        let term = expression.term?.toString() ?? "";
        if (term == "equals" || term == "==") {
            term = "===";
        }

        // TODO: has, excludes, exists, startsWith, endsWith, isEmpty, isNotEmpty

        if (isShorthandComparisonExpression(expression)) {
            if (term == "exists") {
                return expandToNode`
                    ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} != undefined
                `;
            }
            return expandToNode`
                ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} ${term}
            `;
        }

        console.log("Translating Comparison Expression: ", expression.e1.$type, term, expression.e2.$type);

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
    if (isAccess(expression)) {
        return translateAccessExpression(expression as Access, generatingProperty);
    }
    if (isParentAccess(expression)) {
        let path = "this.object.parent";
        if ( expression.propertyLookup != undefined ) {
            path = `${path}.system[this.object.system.${expression.propertyLookup.ref?.name.toLowerCase()}.toLowerCase()]`;
        }
        else {
            path = `${path}.${expression.property?.toLowerCase()}`;
        }
        if (expression.subProperty != undefined) {
            path = `${path}.${expression.subProperty}`;
        }
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
                return expandToNode`
                    { isRoll: false, label: "${humanize(expression.property?.ref?.name ?? "")}", value: this.object.${systemPath}, wide: ${wide}, hasValue: this.object.${systemPath} != "" },
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
                    this.object.${systemPath}
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

        return expandToNode`
            // Create the chat message
            const ${expression.name}Description = this.object.description ?? this.object.system.description;
            const ${expression.name}Content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", { 
                cssClass: "${id} ${toMachineIdentifier(expression.name)}",
                document: this.object,
                description: ${expression.name}Description,
                hasDescription: ${expression.name}Description!= "",
                parts: [
                    ${joinToNode(expression.body.chatExp.filter(x => x.type != "tag"), (expression) => translateChatBodyExpression(expression), { appendNewLineIfNotEmpty: true })}
                ],
                tags: [
                    ${joinToNode(expression.body.chatExp.filter(x => x.type == "tag"), (expression) => translateChatBodyExpression(expression), { appendNewLineIfNotEmpty: true })}
                ]
            });
            const ${expression.name}ChatFlavor = (system) => {
                return ${flavorTag != undefined ? translateChatBodyExpressionForFlavor(flavorTag) : `""`}
            }
            await ChatMessage.create({
                user: game.user._id,
                speaker: ChatMessage.getSpeaker(),
                content: ${expression.name}Content,
                flavor: ${expression.name}ChatFlavor(this.object.system),
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
                if (expression.subProperty != undefined) {
                    return expandToNode`
                        "@${expression.val.ref?.name}${expression.subProperty.toLowerCase()}[${humanize(expression.subProperty)}]"
                    `;
                }
                return expandToNode`
                    "@${expression.val.ref?.name.toLowerCase()}[${humanize(expression.val.ref?.name)}]"
                `;
            }
            if (isParentAccess(expression)) {
                let path = expression.property ?? ""
                let label = humanize(expression.property ?? "");
                if ( expression.propertyLookup != undefined ) {
                    path = `${path}${expression.propertyLookup.ref?.name.toLowerCase()}`;
                    label = `${label} \${this.object.system.${expression.propertyLookup.ref?.name.toLowerCase()}\}`;
                }
                else {
                    path = `${path}${expression.property?.toLowerCase()}`;
                    label = `${label} ${humanize(expression.property ?? "")}`;
                }
                if (expression.subProperty != undefined) {
                    path = `${path}${expression.subProperty}`;
                    label = `${label} ${humanize(expression.subProperty)}`;
                }
                label = label.trim();
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}[${label}]\`
                `;
            }
            if (isAccess(expression)) {
                let path = expression.property?.ref?.name?.toLowerCase() ?? expression.propertyLookup?.ref?.name?.toLowerCase() ?? "";
                let label = humanize(expression.property?.ref?.name ?? expression.propertyLookup?.ref?.name ?? "");
                for (const subProperty of expression.subProperties ?? []) {
                    path = `${path}.${subProperty}`;
                    label = `${label} ${humanize(subProperty)}`;
                }
                console.log("Acesss:", path, label);
                return expandToNode`
                    \`@${path.replaceAll(".", "").toLowerCase()}[${label}]\`
                `;
            }
            if (isFleetingAccess(expression)) {
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
                let path = "this.object.parent.system";
                let label = expression.property ?? "";

                console.log("Parent Access:", expression.property, expression.propertyLookup?.ref?.name);

                if ( expression.propertyLookup != undefined ) {
                    path = `${path}[this.object.system.${expression.propertyLookup.ref?.name.toLowerCase()}.toLowerCase()]`;
                    label = `${label}.${expression.propertyLookup.ref?.name}`;
                }
                else {
                    path = `${path}.${expression.property?.toLowerCase()}`;
                    label = `${label}.${expression.property}`;
                }
                if (expression.subProperty != undefined) {
                    path = `${path}.${expression.subProperty?.toLowerCase()}`;
                    label = `${label}.${expression.subProperty}`;
                }

                console.log(label, path);

                return expandToNode`
                    "${label.replaceAll(".", "").toLowerCase()}": ${path}
                `;
            }
            if (isAccess(expression)) {
                let path = "this.object.system";
                let label = "";

                console.log("Access:", expression.property?.ref?.name, expression.propertyLookup?.ref?.name);

                if (expression.propertyLookup != undefined) {
                    path = `${path}[this.object.system.${expression.propertyLookup.ref?.name.toLowerCase()}.toLowerCase()]`;
                    label = `${label}.${expression.propertyLookup.ref?.name}`;
                }
                else {
                    path = `${path}.${expression.property?.ref?.name.toLowerCase()}`;
                    label = `${label}.${expression.property?.ref?.name}`;

                    if (isResourceExp(expression.property?.ref) && (expression.subProperties == undefined || expression.subProperties.length == 0 || expression.subProperties[0] !== "value")) {
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
                    "${label.replaceAll(".", "").replaceAll(" ", "").toLowerCase()}": ${path}
                `;
            }
            if (isFleetingAccess(expression)) {

                console.log("Fleeting Access:", expression.variable.ref?.name);

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
                    "${label}": ${path}
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
                if (expression.subProperty != undefined) {
                    return expandToNode`
                        "${expression.val.ref?.name}${expression.subProperty.toLowerCase()}": ${expression.val.ref?.name}.${expression.subProperty.toLowerCase()}
                    `;
                }
                console.log(expression.val.ref?.name, expression.val.ref?.$type);
                return expandToNode`
                    "${expression.val.ref?.name}": ${expression.val.ref?.name}
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
                    await this.object.delete();
                    selfDeleted = true;
                `;
            }
            case "update()": {
                return expandToNode`
                    if (Object.keys(update).length > 0) {
                        await this.object.update(update);
                        system = this.object.system;
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
        return expandToNode`
            for (const ${translateExpression(entry, id, expression.var, preDerived, generatingProperty)} of ${translateExpression(entry, id, expression.collection, preDerived, generatingProperty)}) {
                ${translateBodyExpressionToJavascript(entry, id, expression.method.body, preDerived, generatingProperty)}
            }
        `;
    }

    if (isPrompt(expression)) {
        const labelParam = expression.params.find(x => isLabelParam(x));
        const title = labelParam?.value ?? "Prompt";

        const targetParam = expression.params.find(x => isTargetParam(x));
        const target = targetParam?.value ?? "self";

        // const iconParam = expression.params.find(x => isIconParam(x));
        // const icon = iconParam?.value ?? "fa-solid fa-comment-dots";

        function translateDialogBody(expression: ClassExpression): CompositeGeneratorNode | undefined {

            if (isNumberExp(expression)) {
                return expandToNode`
                    <div class="form-group">
                        <label>${humanize(expression.name)}</label>
                        <input type="number" name="${expression.name.toLowerCase()}" />
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
                if (expression.choices != undefined && expression.choices.length > 0) {
                    return expandToNode`
                        <div class="form-group">
                            <label>${humanize(expression.name)}</label>
                            <select name="${expression.name.toLowerCase()}">
                                ${joinToNode(expression.choices, (choice) => expandToNode`
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
                        title: "${title}",
                        content: \`<form>${joinToNode(expression.body, translateDialogBody)}</form>\`,
                    }, {recipients: [firstGm.id]});
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
                        classes: ["${id}", "dialog"]
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
                }, {recipients: [targetedUser]});
            });
        `;
        }

        return expandToNode`
            await Dialog.prompt({
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
                    return data;
                },
                options: {
                    classes: ["${id}", "dialog"]
                }
            });
        `;
    }


    //console.log(expression.$type);
    throw new Error("Unknown expression type encountered while translating to JavaScript ");
}

export function translateBodyExpressionToJavascript(entry: Entry, id: string, body: MethodBlockExpression[], preDerived: boolean = false, generatingProperty: Property | undefined = undefined): CompositeGeneratorNode | undefined {

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
