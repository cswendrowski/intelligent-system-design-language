import { AstNode, AstNodeDescription, AstNodeDescriptionProvider, AstUtils, DefaultScopeProvider, LangiumCoreServices, MapScope, ReferenceInfo, Scope } from "langium";
import { Document, FunctionDefinition, IfStatement, isAccess, isAssignment, isDocument, isEntry, isFunctionDefinition, isHookHandler, isIfStatement, isParentAccess, isParentAssignment, isParentPropertyRefChoice, isParentTypeCheckExpression, isProperty, isRef, isStatusProperty, isTargetAccess, isTargetAssignment, isTargetTypeCheckExpression, isVariableAccess, isVariableAssignment, ParentPropertyRefChoice, ParentTypeCheckExpression, Property, StatusProperty, TargetTypeCheckExpression } from "./generated/ast.js";
import { getAllOfType } from "../cli/components/utils.js";

export class IsdlScopeProvider extends DefaultScopeProvider {

    private astNodeDescriptionProvider: AstNodeDescriptionProvider;
    constructor(services: LangiumCoreServices) {
        super(services);

        this.astNodeDescriptionProvider = services.workspace.AstNodeDescriptionProvider;
    }

    override getScope(context: ReferenceInfo): Scope {

        if (isAccess(context.container) ||
            isAssignment(context.container) ||
            isParentAccess(context.container) ||
            isParentPropertyRefChoice(context.container) ||
            isParentAssignment(context.container) ||
            isTargetAccess(context.container) ||
            isTargetAssignment(context.container)
        ) {

            return this.getPropertyAccessScope(context);
        }

        if (isVariableAccess(context.container) || isRef(context.container) || isVariableAssignment(context.container)) {
            return this.getVariableAccessScope(context);
        }

        // if (isFleetingAccess(context.container) || isRef(context.container)) {
        //     return this.getAccessScope(context);
        // }

        return super.getScope(context);
    }

    private getPropertyAccessScope(context: ReferenceInfo): Scope {

        // When resolving a parent access, we look for an if statement that contains the parent type check expression
        if (isParentAccess(context.container) || isParentAssignment(context.container)) {
            const ifStatement = AstUtils.getContainerOfType(context.container, (n: AstNode): n is IfStatement => {
                const isIf = isIfStatement(n);
                if (!isIf) return false;
                return isParentTypeCheckExpression((n as IfStatement).expression);
            })!;
            const parentTypeCheck = ifStatement?.expression as ParentTypeCheckExpression;
            if (parentTypeCheck == undefined) {
                console.error("Parent type check not found");
                return new MapScope([]);
            }
            const descriptions = this.getScopesForDocument(parentTypeCheck.document.ref);
            return new MapScope(descriptions);
        }

        // When resolving a parent ref choice, we have the type in the name
        if (isParentPropertyRefChoice(context.container)) {
            // Build scopes of all the entry documents
            let entry = AstUtils.getContainerOfType(context.container, isEntry)!;
            let documents = entry.documents;
            let descriptions: AstNodeDescription[] = [];
            for (let document of documents) {
                descriptions.push(this.astNodeDescriptionProvider.createDescription(document, document.name));
            }

            // Get property scopes for the given document
            const refChoice = context.container as ParentPropertyRefChoice;
            const docDescriptions = this.getScopesForDocument(refChoice.document.ref);
            descriptions.push(...docDescriptions);
            return new MapScope(descriptions);
        }

        // Targets work like parent accesses, but we look for the target type check expression
        if (isTargetAccess(context.container) || isTargetAssignment(context.container)) {
            const ifStatement = AstUtils.getContainerOfType(context.container, (n: AstNode): n is IfStatement => {
                const isIf = isIfStatement(n);
                if (!isIf) return false;
                return isTargetTypeCheckExpression((n as IfStatement).expression);
            })!;
            const targetTypeCheck = ifStatement?.expression as TargetTypeCheckExpression;
            if (targetTypeCheck == undefined) {
                console.error("Target type check not found");
                return new MapScope([]);
            }
            const descriptions = this.getScopesForDocument(targetTypeCheck.document.ref);
            return new MapScope(descriptions);
        }

        // For everything else, list the properties in the same document as the defined variable
        const document = AstUtils.getContainerOfType(context.container, isDocument)!;
        const descriptions = this.getScopesForDocument(document);

        // If we are in a method block belonging to an Each expression, add the variable of the each expression to the scope
        // const eachExp = AstUtils.getContainerOfType(context.container, isEach);
        // if (eachExp != undefined) {
        //     const eachVariable = eachExp.var;
        //     if (eachVariable != undefined) {
        //         console.log("Adding each variable to scope: " + eachVariable.name);
        //         descriptions.push(this.astNodeDescriptionProvider.createDescription(eachVariable, eachVariable.name));
        //     }
        // }

        return new MapScope(descriptions);
    }

    private getScopesForDocument(document: Document | undefined): AstNodeDescription[] {
        if (document == undefined) {
            return [];
        }
        const properties = getAllOfType<Property>(document.body, isProperty, false);
        const statuses = getAllOfType<StatusProperty>(document.body, isStatusProperty, false);
        const functionDefinitions = getAllOfType<FunctionDefinition>(document.body, isFunctionDefinition, false);

        const descriptions = properties.map(a => this.astNodeDescriptionProvider.createDescription(a, a.name));
        descriptions.push(...statuses.map(a => this.astNodeDescriptionProvider.createDescription(a, a.name)));
        descriptions.push(...functionDefinitions.map(a => this.astNodeDescriptionProvider.createDescription(a, a.name)));

        return descriptions;
    }

    private getVariableAccessScope(context: ReferenceInfo): Scope {

        let scope = super.getScope(context);
        const additionalDescriptions: AstNodeDescription[] = [];
        
        // If we are in a method block belonging to a hook, add the variables of the hook to the scope
        const hook = AstUtils.getContainerOfType(context.container, isHookHandler);

        if (hook != undefined) {
            additionalDescriptions.push(...hook.params.map(a => this.astNodeDescriptionProvider.createDescription(a, a.name)));
        }

        // If we are in a function block, add the variables of the function to the scope
        const functionDefinition = AstUtils.getContainerOfType(context.container, isFunctionDefinition);
        if (functionDefinition != undefined) {
            additionalDescriptions.push(...functionDefinition.params.map(a => this.astNodeDescriptionProvider.createDescription(a, a.param.name)));
        }

        additionalDescriptions.push(...scope.getAllElements().toArray());

        return new MapScope(additionalDescriptions);
    }
}
