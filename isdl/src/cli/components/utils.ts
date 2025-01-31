import type {
    ClassExpression,
    Document,
    Page,
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

    let basePath = isInitiativeProperty(propertyLookup) ? "" : "system.";
    if (propertyLookup && !isInitiativeProperty(propertyLookup)) {
        basePath = `system[${propertyLookup.name.toLowerCase()}.toLowerCase()].`;
    }

    // If we are accessing a sub-property of a resource or attribute, we need to use the appropriate sub-path
    if (subProperties.length > 0) {
        let systemPath = `${basePath}${reference.name.toLowerCase()}`;
        for (const subProperty of subProperties) {
            if (safeAccess) {
                systemPath = `${systemPath}?.${subProperty}`;
            }
            else {
                systemPath = `${systemPath}.${subProperty}`;
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
