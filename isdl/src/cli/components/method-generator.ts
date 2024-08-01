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
    isComparisonExpression,
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
    isParentAssignment
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode } from 'langium/generate';
import { getSystemPath, toMachineIdentifier } from './utils.js';

export function translateExpression(entry: Entry, id: string, expression: MethodBlock | MethodBlockExpression | Expression | Assignment | VariableExpression | ReturnExpression | ComparisonExpression | Roll | number, preDerived: boolean = false, generatingProperty: Property | undefined = undefined): CompositeGeneratorNode | undefined {

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

        // TODO: Not all references are to a system property - some will be to fleeting variables

        let systemPath = getSystemPath(expression.property.ref);
        if (expression.subProperty != undefined) {
            systemPath = `${systemPath}.${expression.subProperty}`;
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
        return expandToNode`
            ${expression.val}
        `;
    }

    function translateReferenceExpression(expression: Ref): CompositeGeneratorNode | undefined {
        return expandToNode`
            ${expression.val.ref?.name}
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
        return expandToNode`
            -(${translateExpression(entry, id, expression.ne, preDerived, generatingProperty)})
        `;
    }

    function translateAccessExpression(expression: Access, generatingProperty: Property | undefined = undefined): CompositeGeneratorNode | undefined {
        console.log("Translating Access Expression: " + expression.property.ref?.name);

        // Determine if the property reference is the same as the object we are working with
        if ( generatingProperty && expression.property.ref == generatingProperty) {
            return expandToNode`
                system.${expression.property.ref?.name.toLowerCase()}
            `;
        }

        let systemPath = getSystemPath(expression.property.ref);
        if (expression.subProperty != undefined) {
            systemPath = `${systemPath}.${expression.subProperty}`;
        }

        return expandToNode`
            ${systemPath}
        `;
    }

    function translateIfStatement(expression: IfStatement): CompositeGeneratorNode | undefined {
        //console.log("Translating If Statement: ");
        return expandToNode`
            if (${translateExpression(entry, id, expression.expression, preDerived, generatingProperty)}) {
                ${translateBodyExpressionToJavascript(entry, id, expression.method.body, preDerived, generatingProperty)}
            }
        `;
    }

    function translateComparisonExpression(expression: ComparisonExpression): CompositeGeneratorNode | undefined {
        //console.log("Translating Comparison Expression: ");
        // If the term is "equals" or "==", we need to translate it to "===" in JavaScript
        let term = expression.term.toString();
        if (term == "equals" || term == "==") {
            term = "===";
        }

        // TODO: has, excludes, exists, startsWith, endsWith, isEmpty, isNotEmpty

        return expandToNode`
            ${translateExpression(entry, id, expression.e1, preDerived, generatingProperty)} ${term} ${translateExpression(entry, id, expression.e2, preDerived, generatingProperty)}
        `;
    }

    if (expression == undefined) {
        return;
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
    if (isIfStatement(expression)) {
        return translateIfStatement(expression as IfStatement);
    }
    if (isComparisonExpression(expression)) {
        return translateComparisonExpression(expression as ComparisonExpression);
    }
    if (isJS(expression)) {
        // Remove the last "}" from the JS expression
        return expandToNode`
            ${expression.js.replace("@js{", "").slice(0, -1)}
        `;
    }
    if (isChatCard(expression)) {

        function translateChatBodyExpression(expression: ChatBlockExpression) {


            if (isAccess(expression)) {
                let systemPath = getSystemPath(expression.property.ref);
                if (expression.subProperty != undefined) {
                    systemPath = `${systemPath}.${expression.subProperty}`;
                }
                const wide = isHtmlExp(expression.property.ref) ? true : false;
                return expandToNode`
                    { isRoll: false, label: "${humanize(expression.property.ref?.name ?? "")}", value: this.object.${systemPath}, wide: ${wide}, hasValue: this.object.${systemPath} != "" },
                `;
            }
            if ( isFleetingAccess(expression) ) {
                let accessPath = expression.variable.ref?.name;
                if (expression.subProperty != undefined) {
                    accessPath = `${accessPath}.${expression.subProperty}`;
                }

                let roll = false;
                let wide = false;
                if (isRoll(expression.variable.ref?.value)) {
                    roll = true
                    wide = true;
                }

                return expandToNode`
                    { isRoll: ${roll}, label: "${humanize(expression.variable.ref?.name ?? "")}", value: ${accessPath}, wide: ${wide}, tooltip: await ${accessPath}.getTooltip() },
                `;
            }
            return;
        }

        return expandToNode`
            // Create the chat message
            const ${expression.name}Content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", { 
                cssClass: "${id} ${toMachineIdentifier(expression.name)}",
                document: this.object,
                description: this.object.description ?? this.object.system.description,
                parts: [
                    ${joinToNode(expression.body.chatExp.filter(x => x.type != "tag"), (expression) => translateChatBodyExpression(expression), { appendNewLineIfNotEmpty: true })}
                ],
                tags: [
                    ${joinToNode(expression.body.chatExp.filter(x => x.type == "tag"), (expression) => translateChatBodyExpression(expression), { appendNewLineIfNotEmpty: true })}
                ]
            });
            await ChatMessage.create({
                user: game.user._id,
                speaker: ChatMessage.getSpeaker(),
                content: ${expression.name}Content,
                flavor: \`\${this.object.parent.name} \${game.i18n.localize("used")} \${this.object.name}\`
            });
        `;
    }
    if (isRoll(expression)) {

        function translateDiceParts(expression: Expression): CompositeGeneratorNode | undefined {
            if (isLiteral(expression)) {
                return expandToNode`
                    "${expression.val}"
                `;
            }
            if (isRef(expression)) {
                return expandToNode`
                    ${expression.val}
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
                    \`@${path}[${label}]\`
                `;
            }
            if (isBinaryExpression(expression)) {
                return expandToNode`
                    ${translateDiceParts(expression.e1)} + "${expression.op}" + ${translateDiceParts(expression.e2)}
                `;
            }
            return;
        }

        function translateDiceData(expression: Expression): CompositeGeneratorNode | undefined {
            if (isParentAccess(expression)) {
                let path = "this.object.parent.system";
                let label = expression.property ?? "";
                if ( expression.propertyLookup != undefined ) {
                    path = `${path}[this.object.system.${expression.propertyLookup.ref?.name.toLowerCase()}.toLowerCase()]`;
                    label = `${label}.${expression.propertyLookup.ref?.name}`;
                }
                else {
                    path = `${path}.${expression.property?.toLowerCase()}`;
                    label = `${label}.${expression.property}`;
                }
                if (expression.subProperty != undefined) {
                    path = `${path}.${expression.subProperty}`;
                    label = `${label}.${expression.subProperty}`;
                }
                return expandToNode`
                    "${label.replaceAll(".", "").toLowerCase()}": ${path}
                `;
            }

            if (isBinaryExpression(expression)) {
                const expressions = [expression.e1, expression.e2];
                return expandToNode`
                    ${joinToNode(expressions, e => translateDiceData(e), {separator: ", "})}
                `;
            }

            return undefined;
        }
        

        return expandToNode`
            await new ${entry.config.name}Roll(${joinToNode(expression.parts, e => translateDiceParts(e), {separator: " + "})}, {${joinToNode(expression.parts, e => translateDiceData(e), {separator: ", "})}}).roll()
        `;
    }

    console.log(expression.$type);
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
