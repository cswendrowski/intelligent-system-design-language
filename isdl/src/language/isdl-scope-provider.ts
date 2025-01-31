import { AstNodeDescriptionProvider, AstUtils, DefaultScopeProvider, LangiumCoreServices, MapScope, ReferenceInfo, Scope } from "langium";
import { isAccess, isAssignment, isDocument, isProperty, isStatusProperty, Property, StatusProperty } from "./generated/ast.js";
import { getAllOfType } from "../cli/components/utils.js";

export class IsdlScopeProvider extends DefaultScopeProvider {

    private astNodeDescriptionProvider: AstNodeDescriptionProvider;
    constructor(services: LangiumCoreServices) {
        super(services);

        this.astNodeDescriptionProvider = services.workspace.AstNodeDescriptionProvider;
    }
    
    override getScope(context: ReferenceInfo): Scope {

        if (isAccess(context.container) || isAssignment(context.container)) {
            return this.getAccessScope(context);
        }

        // if (isFleetingAccess(context.container) || isRef(context.container)) {
        //     return this.getAccessScope(context);
        // }
        
        return super.getScope(context);
    }

    private getAccessScope(context: ReferenceInfo): Scope {
        const model = AstUtils.getContainerOfType(context.container, isDocument)!;

        //console.log("Scope for document: " + model.name);

        const properties = getAllOfType<Property>(model.body, isProperty, false);
        const statuses = getAllOfType<StatusProperty>(model.body, isStatusProperty, false);

        // for (const property of properties) {
        //     console.log(property.name);
        // }

        const descriptions = properties.map(a => this.astNodeDescriptionProvider.createDescription(a, a.name));
        descriptions.push(...statuses.map(a => this.astNodeDescriptionProvider.createDescription(a, a.name)));

        // If we are in a method block belonging to an Each expression, add the variable of the each expression to the scope
        // const eachExp = AstUtils.getContainerOfType(context.container, isEach);
        // if (eachExp != undefined) {
        //     const eachVariable = eachExp.var;
        //     if (eachVariable != undefined) {
        //         descriptions.push(this.astNodeDescriptionProvider.createDescription(eachVariable, eachVariable.name));
        //     }
        // }
  
        return new MapScope(descriptions);
    }
}
