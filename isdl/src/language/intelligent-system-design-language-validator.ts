import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { IntelligentSystemDesignLanguageAstType, Actor, Property, Item } from './generated/ast.js';
import type { IntelligentSystemDesignLanguageServices } from './intelligent-system-design-language-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: IntelligentSystemDesignLanguageServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.IntelligentSystemDesignLanguageValidator;
    const checks: ValidationChecks<IntelligentSystemDesignLanguageAstType> = {
        Actor: validator.validateActor,
        Item: validator.validateItem,
        Property: validator.validateProperty,
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class IntelligentSystemDesignLanguageValidator {
    validateActor(actor: Actor, accept: ValidationAcceptor): void {
        const discoveredPropertyNames = new Set();

        function validateUniqueName(node: any, name: string): void {
            if (discoveredPropertyNames.has(name)) {
                accept('error', `Actor has non-unique property name '${name}'.`, { node: node, property: 'name' });
            }
            discoveredPropertyNames.add(name);
        }

        if (!actor.body) accept('error', 'Actor requires at least one property.', { node: actor, property: 'body' });

        actor.body.forEach(x => {
            if (x.$type == "NumberExp" || x.$type == "StringExp") {
                validateUniqueName(x, x.name);
            }
            else if (x.$type == "Section") {
                x.body.forEach(y => {
                    if (y.$type == "NumberExp" || y.$type == "StringExp") {
                        validateUniqueName(y, y.name);
                    }
                });
            }
        })
    }

    validateProperty(property: Property, accept: ValidationAcceptor): void {
        if (property.name) {
            const firstChar = property.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Property names should start with a capital.', { node: property, property: 'name' });
            }
        }
    }

    validateItem(item: Item, accept: ValidationAcceptor): void {
        const discoveredPropertyNames = new Set();

        function validateUniqueName(node: any, name: string): void {
            if (discoveredPropertyNames.has(name)) {
                accept('error', `Item has non-unique property name '${name}'.`, { node: node, property: 'name' });
            }
            discoveredPropertyNames.add(name);
        }

        // If the item has a body, validate the names of the properties
        if (!item.body) accept('error', 'Item requires at least one property.', { node: item, property: 'body' });
        item.body.forEach(x => {
            if (x.$type == "NumberExp" || x.$type == "StringExp") {
                validateUniqueName(x, x.name);
            }
            else if (x.$type == "Section") {
                x.body.forEach(y => {
                    if (y.$type == "NumberExp" || y.$type == "StringExp") {
                        validateUniqueName(y, y.name);
                    }
                });
            }
        })
    }
}
