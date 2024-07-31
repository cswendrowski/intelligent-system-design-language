import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { FoundrySystemDesignLanguageAstType, Actor, Property } from './generated/ast.js';
import type { FoundrySystemDesignLanguageServices } from './foundry-system-design-language-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: FoundrySystemDesignLanguageServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.FoundrySystemDesignLanguageValidator;
    const checks: ValidationChecks<FoundrySystemDesignLanguageAstType> = {
        Actor: validator.validateActor,
        Property: validator.validateProperty,
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class FoundrySystemDesignLanguageValidator {
    validateActor(actor: Actor, accept: ValidationAcceptor): void {
        const discoveredPropertyNames = new Set();

        function validateUniqueName(node: any, name: string): void {
            if (discoveredPropertyNames.has(name)) {
                accept('error',  `Actor has non-unique property name '${name}'.`,  {node: node, property: 'name'});
            }
            discoveredPropertyNames.add(name);
        }

        actor.body.forEach(x => {
            if ( x.$type == "NumberExp" || x.$type == "StringExp" ) {
                validateUniqueName(x, x.name);
            }
            else if ( x.$type == "Section" ) {
                x.body.forEach(y => {
                    if ( y.$type == "NumberExp" || y.$type == "StringExp" ) {
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

}
