import type {
    Property,
} from '../../language/generated/ast.js';
import {
    isResourceExp,
    isAttributeExp,
} from "../../language/generated/ast.js"

export function toMachineIdentifier(s: string): string {
    return s.replace(/[^a-zA-Z0-9]/g, '');
}

export function getSystemPath(reference: Property | undefined): string {
    // Not all references are to the baseline - resources and attributes have sub-paths
    if (reference == undefined) {
        return "";
    }
    if (isResourceExp(reference)) {
        return `system.${reference.name.toLowerCase()}.value`;
    }
    if (isAttributeExp(reference)) {
        return `system.${reference.name.toLowerCase()}.mod`;
    }
    return `system.${reference.name.toLowerCase()}`;
}
