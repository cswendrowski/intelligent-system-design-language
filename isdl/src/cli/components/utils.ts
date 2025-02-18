import { AstNode, AstUtils } from 'langium';
import type {
    ClassExpression,
    Document,
    Entry,
    IfStatement,
    Page,
    ParentAccess,
    ParentTypeCheckExpression,
    Property,
    Section,
} from '../../language/generated/ast.js';
import {
    isResourceExp,
    isAttributeExp,
    isSection,
    isPage,
    isInitiativeProperty,
    isDocument,
    isIfStatement,
    isParentTypeCheckExpression,
} from "../../language/generated/ast.js"

export function toMachineIdentifier(s: string): string {
    return s.replace(/[^a-zA-Z0-9]/g, '');
}

export function getSystemPath(reference: Property | undefined, subProperties: string[] = [], propertyLookup: Property | undefined = undefined, safeAccess=true): string {
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

    let basePath = isInitiativeProperty(propertyLookup) ? "" : (safeAccess ? "system?." : "system.");
    if (propertyLookup && !isInitiativeProperty(propertyLookup)) {
        basePath = `system[${propertyLookup.name.toLowerCase()}.toLowerCase()].`;
    }

    // If we are accessing a sub-property of a resource or attribute, we need to use the appropriate sub-path
    if (subProperties.length > 0) {
        let systemPath = `${basePath}${reference.name.toLowerCase()}`;
        for (const subProperty of subProperties) {
            if (safeAccess) {
                systemPath = `${systemPath}?.${subProperty.toLowerCase()}`;
            }
            else {
                systemPath = `${systemPath}.${subProperty.toLowerCase()}`;
            }
        }
        return systemPath;
    }

    if (isResourceExp(reference)) {
        return `${basePath}${reference.name.toLowerCase()}.value`;
    }
    if (isAttributeExp(reference)) {
        return `${basePath}${reference.name.toLowerCase()}.mod`;
    }
    return `${basePath}${reference.name.toLowerCase()}`;
}

export function getAllOfType<T extends (ClassExpression | Page | Section)>(body: (ClassExpression | Page | Section | Document)[], comparisonFunc: (element: T) => boolean, samePageOnly: boolean = false) : T[] {
    let result: T[] = [];
    const actions = body.filter(x => comparisonFunc(x as T)).map(x => x as T);
    result.push(...actions);

    if (!samePageOnly) {
        for (let page of body.filter(x => isPage(x)).map(x => x as Page)) {
            result.push(...getAllOfType(page.body, comparisonFunc, samePageOnly));
        }
    }

    for (let section of body.filter(x => isSection(x)).map(x => x as Section)) {
        result.push(...getAllOfType(section.body, comparisonFunc, samePageOnly));
    }

    for (let document of body.filter(x => isDocument(x)).map(x => x as Document)) {
        result.push(...getAllOfType(document.body, comparisonFunc, samePageOnly));
    }
    
    return result;
}

export function globalGetAllOfType<T extends (ClassExpression | Page | Section)>(entry: Entry, comparisonFunc: (element: T) => boolean) : T[] {
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

export function getDocument(property: Property): Document | undefined {
    const document = AstUtils.getContainerOfType(property.$container, isDocument);
    return document;
}
