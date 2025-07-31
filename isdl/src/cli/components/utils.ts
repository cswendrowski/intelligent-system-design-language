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
    isLayout, isStringChoiceField, isTargetAccess, isDocumentChoiceExp, Access, isDiceField,
} from "../../language/generated/ast.js"

export function toMachineIdentifier(s: string): string {
    return s.replace(/[^a-zA-Z0-9]/g, '');
}

function getPropertyAccessorSuffix(property: ClassExpression): string {
    if (isResourceExp(property) || isTrackerExp(property) || isStringChoiceField(property) || isDiceField(property)) {
        return '.value';
    } else if (isAttributeExp(property)) {
        return '.mod';
    }
    // For numbers and other types (string, boolean, etc.), no additional accessor needed
    return '';
}

function appendPropertyAccessor(systemPath: string, document: Document, propertyName: string, safeAccess: boolean = true): string {
    if (!document || !document.body) {
        return systemPath;
    }

    const allProperties = getAllOfType(document.body, (p): p is ClassExpression => true);
    const targetProperty = allProperties.find(prop =>
        'name' in prop && prop.name && prop.name.toLowerCase() === propertyName.toLowerCase()
    ) as ClassExpression | undefined

    if (targetProperty) {
        const suffix = getPropertyAccessorSuffix(targetProperty);
        if (suffix) {
            const accessor = safeAccess ? '?' : '';
            return `${systemPath}${accessor}${suffix}`;
        }
    }

    return systemPath;
}

export function getSystemPath(reference: Property | undefined, subProperties: string[] = [], generatingProperty: Property | ParentAccess | Access | undefined = undefined, safeAccess=true): string {
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

        // For dice fields with number/die subproperties, we access them directly on the dice object
        // No need to add .value for these specific subproperties

        if (subProperties.length > 0) {
            if (isDocumentChoiceExp(reference) ||
                isParentAccess(generatingProperty) || isTargetAccess(generatingProperty)) {
                if (safeAccess) {
                    systemPath = `${systemPath}?.system`;
                } else {
                    systemPath = `${systemPath}.system`;
                }
            }
        }

        // Process all sub-properties except the last one
        for (let i = 0; i < subProperties.length - 1; i++) {
            const subProperty = subProperties[i];
            if (safeAccess) {
                systemPath = `${systemPath}?.${subProperty.toLowerCase()}`;
            }
            else {
                systemPath = `${systemPath}.${subProperty.toLowerCase()}`;
            }
        }

        // Handle the final sub-property - need to determine if it should have .value/.mod appended
        if (subProperties.length > 0) {
            const finalProperty = subProperties[subProperties.length - 1];
            const finalPropertyLower = finalProperty.toLowerCase();

            if (safeAccess) {
                systemPath = `${systemPath}?.${finalPropertyLower}`;
            } else {
                systemPath = `${systemPath}.${finalPropertyLower}`;
            }

            // For document choice accesses, we need special handling
            if (isDocumentChoiceExp(reference)) {
                const referencedDocument = reference.document.ref;
                if (referencedDocument) {
                    // For string choice fields, check if we're accessing a metadata property
                    if (isStringChoiceField(reference)) {
                        // Metadata properties are accessed directly (e.g., system.training.bonus)
                        // Choice value itself would be accessed as system.training.value
                        // Since we have subproperties, this must be a metadata access - don't append .value
                    } else {
                        // For non-choice fields, use normal property accessor logic
                        systemPath = appendPropertyAccessor(systemPath, referencedDocument, finalProperty, safeAccess);
                    }
                } 
            }
            // For parent/target accesses, use document-based property type detection
            else if (isParentAccess(generatingProperty) || isTargetAccess(generatingProperty)) {
                const referencedDocument = isParentAccess(generatingProperty)
                    ? getParentDocument(generatingProperty)
                    : getTargetDocument(generatingProperty);

                if (referencedDocument) {
                    systemPath = appendPropertyAccessor(systemPath, referencedDocument, finalProperty, safeAccess);
                }
            }
        }

        return systemPath;
    }

    const suffix = getPropertyAccessorSuffix(reference);
    return `${basePath}${reference.name.toLowerCase()}${suffix}`;
}

export function getAllOfType<T extends (ClassExpression | Layout)>(body: (ClassExpression | Layout | Document)[], comparisonFunc: (element: T) => boolean, samePageOnly: boolean = false) : T[] {
    if (!body) return [];

    let result: T[] = [];
    const matchingResults = body.filter(x => comparisonFunc(x as T)).map(x => x as T);
    result.push(...matchingResults);

    if (!samePageOnly) {
        for (let page of body.filter(x => isPage(x)).map(x => x as Page)) {
            if (page.body) {
                result.push(...getAllOfType(page.body, comparisonFunc, samePageOnly));
            }
        }
    }

    for (let layout of body.filter(x => isLayout(x) && !isPage(x)).map(x => x as Layout)) {
        if (layout.body) {
            result.push(...getAllOfType(layout.body, comparisonFunc, samePageOnly));
        }
    }

    for (let document of body.filter(x => isDocument(x)).map(x => x as Document)) {
        if (document.body) {
            result.push(...getAllOfType(document.body, comparisonFunc, samePageOnly));
        }
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
