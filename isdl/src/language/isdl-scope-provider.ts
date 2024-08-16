import { AstNodeDescriptionProvider, AstUtils, DefaultScopeProvider, LangiumCoreServices, MapScope, ReferenceInfo, Scope } from "langium";
import { isAccess, isAssignment, isDocument, isPage, isProperty, isSection, Page, Property, Section } from "./generated/ast.js";

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
        
        return super.getScope(context);
    }

    private getAccessScope(context: ReferenceInfo): Scope {
        const model = AstUtils.getContainerOfType(context.container, isDocument)!;

        const properties = model.body.filter(x => isProperty(x)) as Property[];
        const sections = model.body.filter(x => isSection(x)) as Section[];
        const pages = model.body.filter(x => isPage(x)) as Page[];

        for (const page of pages) {
            const pageProperties = page.body.filter(x => isProperty(x)) as Property[];
            properties.push(...pageProperties);

            const pageSections = page.body.filter(x => isSection(x)) as Section[];
            sections.push(...pageSections);
        }

        for (const section of sections) {
            const sectionProperties = section.body.filter(x => isProperty(x)) as Property[];
            properties.push(...sectionProperties);
        }
  
        const descriptions = properties.map(a => this.astNodeDescriptionProvider.createDescription(a, a.name));
        return new MapScope(descriptions);
    }
}
