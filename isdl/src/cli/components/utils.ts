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
    TargetAccess,
    TargetTypeCheckExpression,
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
    isLayout,
} from "../../language/generated/ast.js"

export function toMachineIdentifier(s: string): string {
    return s.replace(/[^a-zA-Z0-9]/g, '');
}

export function getSystemPath(reference: Property | undefined, subProperties: string[] = [], generatingProperty: Property | ParentAccess | undefined = undefined, safeAccess=true): string {
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

    // if (isDocumentArrayExp(reference)) {
    //     return "context.object.items.filter(x => x.name === 'system').map(x => x.value)[0]";
    // }

    let basePath = "system.";

    // If we are accessing a sub-property of a resource or attribute, we need to use the appropriate sub-path
    if (subProperties.length > 0) {
        let systemPath = `${basePath}${reference.name.toLowerCase()}`;

        for (const subProperty of subProperties) {
            if (isParentAccess(generatingProperty)) {
                systemPath = `${systemPath}?.system`;
            }
            if (safeAccess) {
                systemPath = `${systemPath}?.${subProperty.toLowerCase()}`;
            }
            else {
                systemPath = `${systemPath}.${subProperty.toLowerCase()}`;
            }
        }
        return systemPath;
    }

    if (isResourceExp(reference) || isTrackerExp(reference)) {
        return `${basePath}${reference.name.toLowerCase()}.value`;
    }
    if (isAttributeExp(reference)) {
        return `${basePath}${reference.name.toLowerCase()}.mod`;
    }
    return `${basePath}${reference.name.toLowerCase()}`;
}

export function getAllOfType<T extends (ClassExpression | Layout)>(body: (ClassExpression | Layout | Document)[], comparisonFunc: (element: T) => boolean, samePageOnly: boolean = false) : T[] {
    let result: T[] = [];
    const matchingResults = body.filter(x => comparisonFunc(x as T)).map(x => x as T);
    result.push(...matchingResults);

    if (!samePageOnly) {
        for (let page of body.filter(x => isPage(x)).map(x => x as Page)) {
            result.push(...getAllOfType(page.body, comparisonFunc, samePageOnly));
        }
    }

    for (let layout of body.filter(x => isLayout(x) && !isPage(x)).map(x => x as Layout)) {
        result.push(...getAllOfType(layout.body, comparisonFunc, samePageOnly));
    }

    for (let document of body.filter(x => isDocument(x)).map(x => x as Document)) {
        result.push(...getAllOfType(document.body, comparisonFunc, samePageOnly));
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
