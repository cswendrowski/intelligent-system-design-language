import type {
    Entry,
    StringParamChoices,
    StatusProperty
} from '../../language/generated/ast.js';
import {
    isDamageTypeChoiceField,
    isKeywords,
    isSummaryParam,
    isLabelParam,
    isStringParamChoices,
    isColorParam,
    isIconParam,
    isStatusProperty,
    isDocumentSvgParam,
    isStatusParamWhen,
    // isStringExtendedChoice,
    // isChoiceStringValue,
    LabelParam
} from "../../language/generated/ast.js"
import { getAllOfType } from './utils.js';

interface KeywordData {
    name: string;
    description: string;
    color: string;
    icon: string;
    type: 'damage-type' | 'custom';
    label?: string;
}

interface StatusEffectData {
    id: string;
    name: string;
    img: string;
    isDeath?: boolean;
    condition?: string;
}

// Collect all keywords from config and damage types
export function collectAllKeywords(entry: Entry): Map<string, KeywordData> {
    const keywords = new Map();

    // First collect damage types as keywords
    for (const document of entry.documents) {
        const damageTypeFields = getAllOfType(document.body, isDamageTypeChoiceField);

        for (const field of damageTypeFields) {
            const damageField = field as any;
            const choicesParam = damageField.params?.find((p: any) => isStringParamChoices(p)) as StringParamChoices | undefined;
            if (choicesParam && choicesParam.choices) {
                for (const choice of choicesParam.choices) {
                    if (typeof choice.value === 'string') {
                        keywords.set(choice.value.toLowerCase(), {
                            name: choice.value,
                            description: ``,
                            color: '#666666',
                            icon: 'fa-solid fa-burst',
                            type: 'damage-type'
                        });
                    } else if (choice.value && typeof choice.value === 'object') {
                        const extendedChoice = choice.value as any;
                        let keywordName = '';
                        let keywordData: KeywordData = {
                            name: '',
                            description: ``,
                            color: '#666666',
                            icon: 'fa-solid fa-burst',
                            type: 'damage-type'
                        };

                        // The StringExtendedChoice has properties array where the actual value is stored
                        if (extendedChoice.properties && Array.isArray(extendedChoice.properties)) {
                            for (const prop of extendedChoice.properties) {
                                // Handle ChoiceStringValue (has "value:" prefix in grammar)
                                if (prop.$type === 'ChoiceStringValue' && prop.value) {
                                    keywordName = prop.value;
                                }
                                // Handle ColorParam
                                else if (prop.$type === 'ColorParam' && prop.value) {
                                    keywordData.color = prop.value;
                                }
                                // Handle IconParam
                                else if (prop.$type === 'IconParam' && prop.value) {
                                    keywordData.icon = prop.value;
                                }
                                // Handle LabelParam
                                else if (prop.$type === 'LabelParam' && prop.value) {
                                    keywordData.label = prop.value;
                                }
                                // Handle SummaryParam
                                else if (prop.$type === 'SummaryParam' && prop.value) {
                                    keywordData.description = prop.value.replace(/['"]/g, '');
                                }
                            }
                        }

                        if (keywordName) {
                            keywordData.name = keywordName;
                            keywords.set(keywordName.toLowerCase(), keywordData);
                        }
                    }
                }
            }
        }
    }

    // Then collect manual keywords from config
    if (entry.config && entry.config.body) {
        const keywordSections = entry.config.body.filter(isKeywords);
        for (const keywordSection of keywordSections) {
            for (const keyword of keywordSection.body) {
                const keywordData: KeywordData = {
                    name: keyword.name,
                    description: '',
                    color: '#666666',
                    icon: 'fa-solid fa-tag',
                    type: 'custom'
                };

                // Extract parameters
                if (keyword.params) {
                    for (const param of keyword.params) {
                        if (isSummaryParam(param)) {
                            keywordData.description = param.value.replace(/['"]/g, '');
                        } else if (isLabelParam(param)) {
                            keywordData.label = (param as LabelParam).value.replace(/['"]/g, '');
                        } else if (isColorParam(param)) {
                            keywordData.color = param.value;
                        } else if (isIconParam(param)) {
                            keywordData.icon = param.value.replace(/['"]/g, '');
                        }
                    }
                }

                keywords.set(keyword.name.toLowerCase(), keywordData);
            }
        }
    }

    return keywords;
}

// Collect all status effects from documents
export function collectAllStatusEffects(entry: Entry): Map<string, StatusEffectData> {
    const statusEffects = new Map();

    // Collect status effects from all documents
    for (const document of entry.documents) {
        const statusProperties = getAllOfType(document.body, isStatusProperty) as StatusProperty[];

        for (const status of statusProperties) {
            const statusData: StatusEffectData = {
                id: status.name.toLowerCase().replace(/\s+/g, '-'),
                name: status.name,
                img: 'icons/svg/aura.svg', // default icon
                isDeath: status.tag === 'death'
            };

            // Extract parameters if present
            if (status.params) {
                for (const param of status.params) {
                    if (isDocumentSvgParam(param) && param.value) {
                        statusData.img = param.value.replace(/['"]/g, '');
                    }
                    else if (isStatusParamWhen(param) && param.when) {
                        // Convert the condition AST to a human readable string
                        statusData.condition = convertConditionToString(param.when);
                    }
                }
            }

            statusEffects.set(statusData.id, statusData);
        }
    }

    return statusEffects;
}

// Helper function to convert AST condition to human readable string
function convertConditionToString(condition: any): string {
    if (!condition) return '';

    // Handle different types of expressions
    if (condition.$type === 'ComparisonExpression') {
        const left = convertExpressionToString(condition.left);
        const operator = condition.operator;
        const right = convertExpressionToString(condition.right);

        // Convert operators to more human readable forms
        const operatorMap: Record<string, string> = {
            '<=': 'is less than or equal to',
            '>=': 'is greater than or equal to',
            '<': 'is less than',
            '>': 'is greater than',
            '==': 'equals',
            '!=': 'does not equal'
        };

        const humanOperator = operatorMap[operator] || operator;
        return `${left} ${humanOperator} ${right}`;
    }

    if (condition.$type === 'ShorthandComparisonExpression') {
        // ShorthandComparisonExpression often contains a nested BinaryExpression in e1
        if (condition.e1 && condition.e1.$type === 'BinaryExpression') {
            const left = extractSimplePropertyName(condition.e1.e1);
            const operator = condition.e1.op;
            const right = extractSimpleValue(condition.e1.e2);

            // Convert operators to more human readable forms
            const operatorMap: Record<string, string> = {
                '<=': 'is less than or equal to',
                '>=': 'is greater than or equal to',
                '<': 'is less than',
                '>': 'is greater than',
                '==': 'equals',
                '!=': 'does not equal'
            };

            const humanOperator = operatorMap[operator] || operator;
            return `${left} ${humanOperator} ${right}`;
        }

        // Handle other ShorthandComparisonExpression cases
        if (condition.term) {
            const expr = convertExpressionToString(condition.e1);
            return condition.term === 'exists' ? `${expr} exists` : `${expr} does not exist`;
        }
    }

    // Handle other expression types as needed
    return convertExpressionToString(condition);
}

// Helper functions for simple property and value extraction
function extractSimplePropertyName(expr: any): string {
    if (!expr) return '';

    // For Access expressions, look for property names
    if (expr.$type === 'Access') {
        // Handle direct property references like self.HP -> HP
        return expr.property.$refText;
    }

    return expr.property.$refText;
}

function extractSimpleValue(expr: any): string {
    if (!expr) return '';

    // For Literal expressions, return the value
    if (expr.$type === 'Literal') {
        return String(expr.val);
    }

    return String(expr.val || expr.name || '');
}

// Helper function to convert expressions to human readable strings
function convertExpressionToString(expr: any): string {
    if (!expr) return '';

    switch (expr.$type) {
        case 'SelfPropertyRefExp':
            return `${expr.ref}`;
        case 'Access':
            // Handle simple property access like self.HP or HP directly
            if (expr.member) {
                return expr.member;
            }

            const base = convertExpressionToString(expr.receiver);
            const member = expr.member;
            // Convert self.property to just the property name for readability
            if (base === 'self') {
                return member;
            }
            return base ? `${base}.${member}` : member;
        case 'VariableExpression':
            return expr.name || '';
        case 'Literal':
            return String(expr.value);
        case 'NumberRange':
            return `${expr.min}-${expr.max}`;
        default:
            // For any unhandled types, try to return a reasonable string representation
            if (expr.member) return String(expr.member);
            if (expr.name) return String(expr.name);
            if (expr.ref) return String(expr.ref);
            if (expr.value !== undefined) return String(expr.value);
            return '';
    }
}

// Export interfaces for use by other generators
export type { KeywordData, StatusEffectData };