import {
    ClassExpression,
    Document,
    Entry,
    MethodBlock,
    ResourceExp,
    isStringExp,
    isStringParamValue,
    StringParamValue,
    InitiativeProperty,
    isInitiativeProperty,
    isAttributeParamMod,
    AttributeParamMod,
    isPipsExp,
    Property,
    NumberParamMax,
    NumberParamMin,
    NumberParamValue,
    HookHandler,
    isHookHandler,
    isTrackerExp,
    NumberParamInitial,
    WhereParam, Layout, isLayout, isMeasuredTemplateField, isTableField,
    isAccess, isDiceField, isMoneyField
} from '../../language/generated/ast.js';
import {
    isActor,
    isItem,
    isResourceExp,
    isAttributeExp,
    isMethodBlock,
    isDocumentArrayExp,
    isNumberExp,
    isNumberParamMax,
    isNumberParamValue,
    isNumberParamMin,
    isWhereParam,
    isDocument,
    isPage,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { translateBodyExpressionToJavascript, translateExpression } from './method-generator.js';
import { getAllOfType } from './utils.js';

export function generateExtendedDocumentClasses(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "documents");


    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateExtendedDocumentClass(type: string, entry: Entry) {

        function translateMethodOrValueOrStored(property: Property, param: NumberParamMin | NumberParamInitial | NumberParamValue | NumberParamMax | undefined): CompositeGeneratorNode {
            if (param == undefined) {
                return expandToNode`
                    return system.${property.name.toLowerCase()} ?? 0
                `
            }

            if (isMethodBlock(param.value)) {

                if (isNumberParamValue(param)) {
                    toBeReapplied.add("system." + property.name.toLowerCase());
                }

                return expandToNode`
                    ${translateExpression(entry, id, param.value, true, property)}
                `
            }

            return expandToNode`
                return ${param.value}
            `
        }

        const generatedFilePath = path.join(generatedFileDir, `${type.toLowerCase()}.mjs`);

        const toBeReapplied = new Set<string>();
        function generateDerivedAttribute(property: ClassExpression | Layout): CompositeGeneratorNode | undefined {

            if (isLayout(property)) {
                return joinToNode(property.body, property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true });
            }

            if (isStringExp(property)) {
                let stringValue = property.params.find(p => isStringParamValue(p)) as StringParamValue;
                if (stringValue != undefined) {
                    if (stringValue.value == "") return;
                    if (typeof stringValue.value == "string") {
                        return expandToNode`
                            // ${property.name} String Derived Data
                            this.system.${property.name.toLowerCase()} = "${stringValue.value}";
                        `.appendNewLineIfNotEmpty();
                    }
                    else {
                        return expandToNode`
                        // ${property.name} String Derived Data
                        const ${property.name.toLowerCase()}CurrentValueFunc = (system) => {
                            const context = {
                                object: this
                            };
                            ${translateExpression(entry, id, stringValue.value, true, property)}
                        };
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}CurrentValueFunc(this.system);
                        `.appendNewLineIfNotEmpty();
                    }
                }
            }

            if (isNumberExp(property)) {

                const valueParam = property.params.find(p => isNumberParamValue(p)) as NumberParamValue | undefined;
                const minParam = property.params.find(p => isNumberParamMin(p)) as NumberParamMin | undefined;
                const maxParam = property.params.find(p => isNumberParamMax(p)) as NumberParamMax | undefined;

                if (valueParam) {
                    return expandToNode`
                    // ${property.name} Number Calculated Data


                    ${minParam != undefined ? expandToNode`
                        const ${property.name.toLowerCase()}MinFunc = (system) => {
                            const context = {
                                object: this
                            };
                            ${translateMethodOrValueOrStored(property, minParam)}
                        };
                        const ${property.name.toLowerCase()}Min = ${property.name.toLowerCase()}MinFunc(this.system);
                        `.appendNewLine() : ""}
    
                    ${maxParam != undefined ? expandToNode`
                        const ${property.name.toLowerCase()}MaxFunc = (system) => {
                            const context = {
                                object: this
                            };
                            ${translateMethodOrValueOrStored(property, maxParam)}
                        };
                        const ${property.name.toLowerCase()}Max = ${property.name.toLowerCase()}MaxFunc(this.system);
                        `.appendNewLine() : ""}

                    // ${property.name} Number Derived Data
                    const ${property.name.toLowerCase()}CurrentValueFunc = (system) => {
                        const context = {
                                object: this
                        };
                        ${translateMethodOrValueOrStored(property, valueParam)}
                    };
                    Object.defineProperty(this.system, "${property.name.toLowerCase()}", {
                        get: () => {
                            let current = ${property.name.toLowerCase()}CurrentValueFunc(this.system);
                            ${minParam != undefined ? expandToNode`
                                if ( current < ${property.name.toLowerCase()}Min ) {
                                    current = ${property.name.toLowerCase()}Min;
                                }
                            `.appendNewLine() : ""}
                            ${maxParam != undefined ? expandToNode`
                                if ( current > ${property.name.toLowerCase()}Max ) {
                                    current = ${property.name.toLowerCase()}Max;
                                }
                            `.appendNewLine() : ""}
                            return current;
                        },
                        configurable: true
                    });

                    `.appendNewLineIfNotEmpty();
                }

                return expandToNode`
                    // ${property.name} Number Derived Data
                    const ${property.name.toLowerCase()}CurrentValueFunc = (system) => {
                        const context = {
                            object: this
                        };
                        ${translateMethodOrValueOrStored(property, valueParam)}
                    };
                    this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}CurrentValueFunc(this.system);

                    ${minParam != undefined ? expandToNode`
                    const ${property.name.toLowerCase()}MinFunc = (system) => {
                        const context = {
                            object: this
                        };
                        ${translateMethodOrValueOrStored(property, minParam)}
                    };
                    const ${property.name.toLowerCase()}Min = ${property.name.toLowerCase()}MinFunc(this.system);
                    if ( this.system.${property.name.toLowerCase()} < ${property.name.toLowerCase()}Min ) {
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}Min;
                    }
                    `.appendNewLine() : ""}

                    ${maxParam != undefined ? expandToNode`
                    const ${property.name.toLowerCase()}MaxFunc = (system) => {
                        const context = {
                            object: this
                        };
                        ${translateMethodOrValueOrStored(property, maxParam)}
                    };
                    const ${property.name.toLowerCase()}Max = ${property.name.toLowerCase()}MaxFunc(this.system);
                    if ( this.system.${property.name.toLowerCase()} > ${property.name.toLowerCase()}Max ) {
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}Max;
                    }
                    `.appendNewLine() : ""}
                `.appendNewLineIfNotEmpty();
            }

            if (isMoneyField(property)) {
                const valueParam = property.params.find(p => isNumberParamValue(p)) as NumberParamValue | undefined;

                if (valueParam) {
                    // Check if this money field has denominations
                    if (property.denominations && property.denominations.length > 0) {
                        // Cannot use value param with multi-denomination money
                        console.warn(`Money field ${property.name} has both denominations and value parameter. Value parameter will be ignored for multi-denomination money.`);
                        return;
                    }

                    return expandToNode`
                    // ${property.name} Money Calculated Data
                    const ${property.name.toLowerCase()}CurrentValueFunc = (system) => {
                        const context = {
                            object: this
                        };
                        ${translateMethodOrValueOrStored(property, valueParam)}
                    };
                    Object.defineProperty(this.system, "${property.name.toLowerCase()}", {
                        get: () => {
                            return ${property.name.toLowerCase()}CurrentValueFunc(this.system);
                        },
                        configurable: true
                    });

                    `.appendNewLineIfNotEmpty();
                }
            }

            if ( isAttributeExp(property) ) {
                console.log("Processing Derived Attribute: " + property.name);
                const modParam = property.params.find(p => isAttributeParamMod(p)) as AttributeParamMod | undefined;
                return expandToNode`

                    // ${property.name} Attribute Derived Data
                    const ${property.name.toLowerCase()}CurrentValue = this.system.${property.name.toLowerCase()}?.value ?? 0;
                    const ${property.name.toLowerCase()}CurrentMax = this.system.${property.name.toLowerCase()}?.max ?? 0;
                    const ${property.name.toLowerCase()}ModFunc = (system) => {
                        const context = {
                            object: this
                        };
                        ${modParam ? translateExpression(entry, id, modParam.method, true, property) : `return ${property.name.toLowerCase()}CurrentValue`}
                    };
                    this.system.${property.name.toLowerCase()} = {
                        value: ${property.name.toLowerCase()}CurrentValue,
                        max: ${property.name.toLowerCase()}CurrentMax,
                        mod: ${property.name.toLowerCase()}ModFunc(this.system)
                    };
                    if ( this.system.${property.name.toLowerCase()}.value > this.system.${property.name.toLowerCase()}.max ) {
                        this.system.${property.name.toLowerCase()}.value = this.system.${property.name.toLowerCase()}.max;
                    }
                `.appendNewLineIfNotEmpty();
            };

            function generateValueOrMethod(value: number | MethodBlock): CompositeGeneratorNode {
                if (isMethodBlock(value)) {
                    return expandToNode`
                        const context = {
                            object: this
                        };
                        ${translateExpression(entry, id, value, true, undefined)}
                    `;
                }
                return expandToNode`
                    return ${value};
                `;
            }


            if ( isTrackerExp(property) ) {
                console.log("Processing Derived Tracker: " + property.name);
                const maxParam = property.params.find(x => isNumberParamMax(x)) as NumberParamMax;
                const minParam = property.params.find(x => isNumberParamMin(x)) as NumberParamMin;
                const valueParam = property.params.find(x => isNumberParamValue(x)) as NumberParamValue;

                if (maxParam == undefined && minParam == undefined && valueParam == undefined) return;


                return expandToNode`
                    // ${property.name} Tracker Derived Data
                    const ${property.name.toLowerCase()}TempValue = this.system.${property.name.toLowerCase()}.temp ?? 0;
                    const ${property.name.toLowerCase()}CurrentMin = (system) => {
                        ${minParam == undefined ? expandToNode`return this.system.${property.name.toLowerCase()}?.min ?? 0;` : generateValueOrMethod(minParam.value)};
                    }
                    const ${property.name.toLowerCase()}CurrentValue = (system) => {
                        ${valueParam == undefined ? expandToNode`return this.system.${property.name.toLowerCase()}?.value ?? 0;` : generateValueOrMethod(valueParam.value)};
                    }
                    const ${property.name.toLowerCase()}CurrentMax = (system) => {
                        ${maxParam == undefined ? expandToNode`return this.system.${property.name.toLowerCase()}?.max ?? 0;` : generateValueOrMethod(maxParam.value)};
                    }
                    this.system.${property.name.toLowerCase()} = {
                        min: ${property.name.toLowerCase()}CurrentMin(this.system),
                        value: ${property.name.toLowerCase()}CurrentValue(this.system),
                        temp: ${property.name.toLowerCase()}TempValue,
                        max: ${property.name.toLowerCase()}CurrentMax(this.system),
                    };
                    if ( !editMode && this.system.${property.name.toLowerCase()}.value < this.system.${property.name.toLowerCase()}.min ) {
                        this.system.${property.name.toLowerCase()}.value = this.system.${property.name.toLowerCase()}.min;
                    }
                    else if ( !editMode && this.system.${property.name.toLowerCase()}.value > this.system.${property.name.toLowerCase()}.max ) {
                        this.system.${property.name.toLowerCase()}.value = this.system.${property.name.toLowerCase()}.max;
                    }
                `.appendNewLineIfNotEmpty();
            };

            if ( isResourceExp(property) ) {
                console.log("Processing Derived Resource: " + property.name);

                const maxParam = property.params.find(x => isNumberParamMax(x)) as NumberParamMax;
                const minParam = property.params.find(x => isNumberParamMin(x)) as NumberParamMin;
                const valueParam = property.params.find(x => isNumberParamValue(x)) as NumberParamValue;

                if (maxParam == undefined && minParam == undefined && valueParam == undefined) return;

                //toBeReapplied.add("system." + property.name.toLowerCase() + ".max");
                return expandToNode`
                    // ${property.name} Resource Derived Data
                    const ${property.name.toLowerCase()}TempValue = this.system.${property.name.toLowerCase()}.temp ?? 0;
                    const ${property.name.toLowerCase()}CurrentMin = (system) => {
                        ${minParam == undefined ? expandToNode`return this.system.${property.name.toLowerCase()}?.min ?? 0;` : generateValueOrMethod(minParam.value)};
                    }
                    const ${property.name.toLowerCase()}CurrentValue = (system) => {
                        ${valueParam == undefined ? expandToNode`return this.system.${property.name.toLowerCase()}?.value ?? 0;` : generateValueOrMethod(valueParam.value)};
                    }
                    const ${property.name.toLowerCase()}CurrentMax = (system) => {
                        ${maxParam == undefined ? expandToNode`return this.system.${property.name.toLowerCase()}?.max ?? 0;` : generateValueOrMethod(maxParam.value)};
                    }
                    this.system.${property.name.toLowerCase()} = {
                        value: ${property.name.toLowerCase()}CurrentValue(this.system),
                        temp: ${property.name.toLowerCase()}TempValue,
                        max: ${property.name.toLowerCase()}CurrentMax(this.system)
                    };
                    this.reapplyActiveEffectsForName("system.${property.name.toLowerCase()}.max");
                    if ( !editMode && this.system.${property.name.toLowerCase()}.value < ${property.name.toLowerCase()}CurrentMin(this.system) ) {
                        this.system.${property.name.toLowerCase()}.value = ${property.name.toLowerCase()}CurrentMin(this.system);
                    }
                    else if ( !editMode && this.system.${property.name.toLowerCase()}.value > this.system.${property.name.toLowerCase()}.max ) {
                        this.system.${property.name.toLowerCase()}.value = this.system.${property.name.toLowerCase()}.max;
                    }
                `.appendNewLineIfNotEmpty();
            }

            if (isPipsExp(property)) {
                const maxParam = property.params.find(x => isNumberParamMax(x)) as NumberParamMax;
                const minParam = property.params.find(x => isNumberParamMin(x)) as NumberParamMin;
                const valueParam = property.params.find(x => isNumberParamValue(x)) as NumberParamValue;

                if (maxParam == undefined && minParam == undefined && valueParam == undefined) return;

                return expandToNode`
                    ${valueParam != undefined ? expandToNode`
                    // ${property.name} Pips Derived Data
                    const ${property.name.toLowerCase()}CurrentValueFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, valueParam)}
                    };
                    this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}CurrentValueFunc(this.system);
                    `.appendNewLine() : ""}

                    ${minParam != undefined ? expandToNode`
                    const ${property.name.toLowerCase()}MinFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, minParam)}
                    };
                    const ${property.name.toLowerCase()}Min = ${property.name.toLowerCase()}MinFunc(this.system);
                    if ( this.system.${property.name.toLowerCase()} < ${property.name.toLowerCase()}Min ) {
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}Min;
                    }
                    `.appendNewLine() : ""}

                    ${maxParam != undefined ? expandToNode`
                    const ${property.name.toLowerCase()}MaxFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, maxParam)}
                    };
                    const ${property.name.toLowerCase()}Max = ${property.name.toLowerCase()}MaxFunc(this.system);
                    if ( this.system.${property.name.toLowerCase()} > ${property.name.toLowerCase()}Max ) {
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}Max;
                    }
                    `.appendNewLine() : ""}
                `.appendNewLineIfNotEmpty();
            }

            if ( isDocumentArrayExp(property) || isTableField(property) ) {
                console.log("Processing Derived Document Array: " + property.name);

                const whereParam = property.params.find(p => isWhereParam(p)) as WhereParam | undefined;
                if ( whereParam ) {
                    return expandToNode`
                    // ${property.name} Document Array Derived Data
                    this.system.${property.name.toLowerCase()} = this.items.filter((item) => {
                        if ( item.type !== "${property.document.ref?.name.toLowerCase()}") return false;
                        return ${translateExpression(entry, id, whereParam.value, true, property)};
                    });
                    `.appendNewLineIfNotEmpty();
                }
                return expandToNode`
                    // ${property.name} Document Array Derived Data
                    this.system.${property.name.toLowerCase()} = this.items.filter((item) => item.type == "${property.document.ref?.name.toLowerCase()}");
                `.appendNewLineIfNotEmpty();
            }

            if (isMeasuredTemplateField(property)) {
                return expandToNode`
                    // ${property.name} Measured Template Field Derived Data
                   
                    const ${property.name.toLowerCase()}Summary = () => {
                        let sum = \`\${this.system.${property.name.toLowerCase()}.direction}° \${this.system.${property.name.toLowerCase()}.type} (\${this.system.${property.name.toLowerCase()}.distance} squares)\`;
                        if (this.system.${property.name.toLowerCase()}.type === 'cone') sum += \` \${this.system.${property.name.toLowerCase()}.angle}° angle\`;
                        if (this.system.${property.name.toLowerCase()}.type === 'ray') sum += \` \${this.system.${property.name.toLowerCase()}.width} squares wide\`;
                        return sum;
                    }
                    this.system.${property.name.toLowerCase()}.summary = ${property.name.toLowerCase()}Summary();  
                `.appendNewLineIfNotEmpty();
            }

            if (isDiceField(property)) {
                return expandToNode`
                    // ${property.name} Dice Field Derived Data
                    
                    const ${property.name.toLowerCase()}Value = () => {
                        // Output a string of num + die
                        return this.system.${property.name.toLowerCase()}.number + this.system.${property.name.toLowerCase()}.die;
                    }
                    this.system.${property.name.toLowerCase()}.value = ${property.name.toLowerCase()}Value();
                `.appendNewLineIfNotEmpty();
            }

            // if (isParentPropertyRefExp(property)) {
            //     console.log("Processing Derived Parent Property: " + property.name);

            //     return expandToNode`
            //         // Parent ${property.name} Property Derived Data
            //         if ( !this.parent || this.system.${property.name.toLowerCase()}Ref == "" ) {
            //             this.system.${property.name.toLowerCase()} = 0;
            //         }
            //         else {
            //             this.system.${property.name.toLowerCase()} = foundry.utils.getProperty(this.parent, this.system.${property.name.toLowerCase()}Ref) ?? 0;
            //         }
            //     `.appendNewLineIfNotEmpty().appendNewLine();
            // }

            return
        }

        // Dependency analysis for computed properties
        interface PropertyDependency {
            property: ClassExpression | Layout;
            dependencies: Set<string>;
            isComputed: boolean;
        }

        function extractPropertyDependencies(methodBlock: MethodBlock): Set<string> {
            const dependencies = new Set<string>();

            function traverseExpression(node: any): void {
                if (!node) return;

                if (isAccess(node)) {
                    // For access expressions like self.PropertyName, check if it's referencing another property
                    if (node.property?.ref?.name) {
                        dependencies.add(node.property.ref.name.toLowerCase());
                    }
                }

                if (isAccess(node)) {
                    // Self-reference expressions don't create dependencies on specific properties
                    // since they're resolved at runtime based on user selection
                    return;
                }

                // Recursively traverse child nodes
                if (node.$children) {
                    for (const child of node.$children) {
                        traverseExpression(child);
                    }
                }

                // Handle common expression properties
                if (node.left) traverseExpression(node.left);
                if (node.right) traverseExpression(node.right);
                if (node.value) traverseExpression(node.value);
                if (node.expression) traverseExpression(node.expression);
                if (node.body && Array.isArray(node.body)) {
                    for (const expr of node.body) {
                        traverseExpression(expr);
                    }
                }
                // Handle binary expression operands (e1, e2)
                if (node.e1) traverseExpression(node.e1);
                if (node.e2) traverseExpression(node.e2);
            }

            traverseExpression(methodBlock);
            return dependencies;
        }

        function isPropertyComputed(property: ClassExpression | Layout): boolean {
            if (isLayout(property)) {
                return false; // Layouts don't have computed values themselves
            }

            // Check if any parameter contains a method block
            if (isNumberExp(property)) {
                const valueParam = property.params.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
                const minParam = property.params.find((p: any) => isNumberParamMin(p)) as NumberParamMin | undefined;
                const maxParam = property.params.find((p: any) => isNumberParamMax(p)) as NumberParamMax | undefined;

                return !!(valueParam && isMethodBlock(valueParam.value)) ||
                       !!(minParam && isMethodBlock(minParam.value)) ||
                       !!(maxParam && isMethodBlock(maxParam.value));
            }

            if (isStringExp(property)) {
                const stringValue = property.params.find((p: any) => isStringParamValue(p)) as StringParamValue | undefined;
                return !!(stringValue && isMethodBlock(stringValue.value));
            }

            if (isAttributeExp(property)) {
                const modParam = property.params.find((p: any) => isAttributeParamMod(p)) as AttributeParamMod | undefined;
                return !!(modParam && isMethodBlock(modParam.method));
            }

            if (isTrackerExp(property) || isResourceExp(property) || isPipsExp(property)) {
                const params = property.params as any[];
                const valueParam = params.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
                const minParam = params.find((p: any) => isNumberParamMin(p)) as NumberParamMin | undefined;
                const maxParam = params.find((p: any) => isNumberParamMax(p)) as NumberParamMax | undefined;

                return !!(valueParam && isMethodBlock(valueParam.value)) ||
                       !!(minParam && isMethodBlock(minParam.value)) ||
                       !!(maxParam && isMethodBlock(maxParam.value));
            }

            if (isMoneyField(property)) {
                const valueParam = property.params.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
                return !!(valueParam && isMethodBlock(valueParam.value));
            }

            return false;
        }

        function buildDependencyGraph(properties: (ClassExpression | Layout)[]): PropertyDependency[] {
            const dependencies: PropertyDependency[] = [];

            function processProperty(property: ClassExpression | Layout): PropertyDependency {
                if (isLayout(property)) {
                    // Recursively process layout children
                    const childDeps = new Set<string>();
                    for (const child of property.body) {
                        const childDep = processProperty(child);
                        childDep.dependencies.forEach(dep => childDeps.add(dep));
                    }
                    return {
                        property,
                        dependencies: childDeps,
                        isComputed: false
                    };
                }

                const deps = new Set<string>();
                const computed = isPropertyComputed(property);

                if (computed) {
                    // Extract dependencies from method blocks
                    if (isNumberExp(property)) {
                        const valueParam = property.params.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
                        const minParam = property.params.find((p: any) => isNumberParamMin(p)) as NumberParamMin | undefined;
                        const maxParam = property.params.find((p: any) => isNumberParamMax(p)) as NumberParamMax | undefined;

                        if (valueParam && isMethodBlock(valueParam.value)) {
                            extractPropertyDependencies(valueParam.value).forEach(dep => deps.add(dep));
                        }
                        if (minParam && isMethodBlock(minParam.value)) {
                            extractPropertyDependencies(minParam.value).forEach(dep => deps.add(dep));
                        }
                        if (maxParam && isMethodBlock(maxParam.value)) {
                            extractPropertyDependencies(maxParam.value).forEach(dep => deps.add(dep));
                        }
                    } else if (isStringExp(property)) {
                        const stringValue = property.params.find((p: any) => isStringParamValue(p)) as StringParamValue | undefined;
                        if (stringValue && isMethodBlock(stringValue.value)) {
                            extractPropertyDependencies(stringValue.value).forEach(dep => deps.add(dep));
                        }
                    } else if (isAttributeExp(property)) {
                        const modParam = property.params.find((p: any) => isAttributeParamMod(p)) as AttributeParamMod | undefined;
                        if (modParam && isMethodBlock(modParam.method)) {
                            extractPropertyDependencies(modParam.method).forEach(dep => deps.add(dep));
                        }
                    } else if (isTrackerExp(property) || isResourceExp(property) || isPipsExp(property)) {
                        const params = property.params as any[];
                        const valueParam = params.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;
                        const minParam = params.find((p: any) => isNumberParamMin(p)) as NumberParamMin | undefined;
                        const maxParam = params.find((p: any) => isNumberParamMax(p)) as NumberParamMax | undefined;

                        if (valueParam && isMethodBlock(valueParam.value)) {
                            extractPropertyDependencies(valueParam.value).forEach(dep => deps.add(dep));
                        }
                        if (minParam && isMethodBlock(minParam.value)) {
                            extractPropertyDependencies(minParam.value).forEach(dep => deps.add(dep));
                        }
                        if (maxParam && isMethodBlock(maxParam.value)) {
                            extractPropertyDependencies(maxParam.value).forEach(dep => deps.add(dep));
                        }
                    } else if (isMoneyField(property)) {
                        const valueParam = property.params.find((p: any) => isNumberParamValue(p)) as NumberParamValue | undefined;

                        if (valueParam && isMethodBlock(valueParam.value)) {
                            extractPropertyDependencies(valueParam.value).forEach(dep => deps.add(dep));
                        }
                    }

                    // Remove self-references (only for properties that have names)
                    if ('name' in property && property.name) {
                        deps.delete(property.name.toLowerCase());
                    }
                }

                return {
                    property,
                    dependencies: deps,
                    isComputed: computed
                };
            }

            for (const property of properties) {
                dependencies.push(processProperty(property));
            }

            return dependencies;
        }

        function topologicalSort(dependencies: PropertyDependency[]): { sorted: PropertyDependency[], cycles: string[][] } {
            const sorted: PropertyDependency[] = [];
            const visiting = new Set<string>();
            const visited = new Set<string>();
            const cycles: string[][] = [];

            function getPropertyName(property: ClassExpression | Layout): string {
                return ('name' in property && property.name) ? property.name.toLowerCase() : 'unknown';
            }

            function visit(depItem: PropertyDependency, path: string[] = []): void {
                const name = getPropertyName(depItem.property);

                if (visiting.has(name)) {
                    // Found a cycle
                    const cycleStart = path.indexOf(name);
                    if (cycleStart >= 0) {
                        cycles.push([...path.slice(cycleStart), name]);
                    }
                    return;
                }

                if (visited.has(name)) {
                    return;
                }

                visiting.add(name);
                path.push(name);

                // Visit dependencies first
                for (const depName of depItem.dependencies) {
                    const depItem = dependencies.find(d => getPropertyName(d.property) === depName);
                    if (depItem) {
                        visit(depItem, [...path]);
                    }
                }

                visiting.delete(name);
                visited.add(name);
                path.pop();
                sorted.push(depItem);
            }

            // Visit all non-computed properties first
            for (const depItem of dependencies) {
                if (!depItem.isComputed && !visited.has(getPropertyName(depItem.property))) {
                    visit(depItem);
                }
            }

            // Then visit computed properties
            for (const depItem of dependencies) {
                if (depItem.isComputed && !visited.has(getPropertyName(depItem.property))) {
                    visit(depItem);
                }
            }

            return { sorted, cycles };
        }

        function getTopLevelProperties(body: (ClassExpression | Layout | Document)[]): (ClassExpression | Layout)[] {
            const result: (ClassExpression | Layout)[] = [];

            for (const item of body) {
                if (isDocument(item)) {
                    // Recursively process document bodies
                    result.push(...getTopLevelProperties(item.body));
                } else if (isPage(item)) {
                    // For pages, add the page itself (it's a Layout)
                    result.push(item);
                } else if (isLayout(item) && !isPage(item)) {
                    // For sections and other layouts, add the layout itself
                    result.push(item);
                } else {
                    // For regular properties (ClassExpression), add them directly
                    result.push(item as ClassExpression | Layout);
                }
            }

            return result;
        }

        function generateDerivedData(document: Document): CompositeGeneratorNode | undefined {
            // Build dependency graph for top-level properties only (no duplicates from nested layouts)
            const allProperties = getTopLevelProperties(document.body);
            const dependencies = buildDependencyGraph(allProperties);
            const { sorted, cycles } = topologicalSort(dependencies);

            // Debug: Log dependency information (can be removed in production)
            // console.log(`Dependencies for ${document.name}:`, dependencies.map(d => ({
            //     name: ('name' in d.property && d.property.name) ? d.property.name : 'unknown',
            //     deps: Array.from(d.dependencies),
            //     computed: d.isComputed
            // })));

            // Log dependency cycles for debugging
            if (cycles.length > 0) {
                console.warn(`Dependency cycles detected in ${document.name}:`, cycles);
            }

            return expandToNode`
                async _prepare${document.name}DerivedData() {
                    const editMode = this.flags["${id}"]?.["edit-mode"] ?? true;

                    ${cycles.length > 0 ? expandToNode`
                        // WARNING: Dependency cycles detected: ${cycles.map(cycle => cycle.join(' -> ')).join(', ')}
                        // Properties will be processed in original order to prevent infinite loops.
                    `.appendNewLine() : ""}

                    ${joinToNode(sorted.map(dep => dep.property), property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true })}

                    ${isActor(document) ? expandToNode`
                        // Reapply Active Effects for calculated values
                        ${joinToNode(toBeReapplied, name => expandToNode`this.reapplyActiveEffectsForName("${name}");`, { appendNewLineIfNotEmpty: true})}
                    ` : ""}
                }
            `.appendNewLineIfNotEmpty().appendNewLine();
        }

        function generateActorPreUpdate(document: Document): CompositeGeneratorNode | undefined {
            const allResources = getAllOfType<ResourceExp>(document.body, isResourceExp);
            const healthResource = allResources.find(x => x.tag == "health") as ResourceExp | undefined;
            if (healthResource == undefined) return expandToNode`
            _handlePreUpdate${document.name}Delta(changes, deltas) {
                // No health resource defined
            }
            `.appendNewLine();

            return expandToNode`
            _handlePreUpdate${document.name}Delta(changes, deltas) {
                // Health resource updates
                if (changes.system.${healthResource.name.toLowerCase()} === undefined) return;

                // Store value and temp changes
                const valueChange = changes.system.${healthResource.name.toLowerCase()}.value;
                const tempChange = changes.system.${healthResource.name.toLowerCase()}.temp;

                // Calculate delta
                if (valueChange !== undefined) {
                    const delta = valueChange - this.system.${healthResource.name.toLowerCase()}.value;
                    if (delta !== 0) {
                        deltas.${healthResource.name.toLowerCase()} = delta;
                    }
                }

                // Calculate temp delta
                if (tempChange !== undefined) {
                    const tempDelta = tempChange - this.system.${healthResource.name.toLowerCase()}.temp;
                    if (tempDelta !== 0) {
                        deltas.${healthResource.name.toLowerCase()}Temp = tempDelta;
                    }
                }
            }
            `.appendNewLine();
        }

        function generateDeltas(documents: Document[]): CompositeGeneratorNode | undefined {

            if (type != "Actor") return;

            function generateHealthResourceAssignments(documents: Document[]) {
                function documentHealthResource(document: Document): CompositeGeneratorNode | undefined {
                    const healthResource = getAllOfType<ResourceExp>(document.body, isResourceExp).find(x => x.tag == "health") as ResourceExp | undefined;
                    if (healthResource == undefined) return;

                    return expandToNode`
                    case "${document.name.toLowerCase()}": {
                        // ${healthResource.name} health resource

                        if ( !data.prototypeToken.bar1.attribute ) data.prototypeToken.bar1.attribute = "${healthResource.name.toLowerCase()}";
                        if ( !data.prototypeToken.displayBars ) data.prototypeToken.displayBars = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
                    }
                    `.appendNewLineIfNotEmpty();
                }

                return expandToNode`
                    switch ( data.type ) {
                        ${joinToNode(documents.filter(x => isActor(x)), document => documentHealthResource(document), { appendNewLineIfNotEmpty: true })}
                    }
                `.appendNewLineIfNotEmpty();
            }

            return expandToNode`
            async _preUpdate(data, options, userId) {
                await super._preUpdate(data, options, userId);
                if (!options.diff || data === undefined) return;
                let changes = {};

                // Foundry v12 no longer has diffed data during _preUpdate, so we need to compute it ourselves.
                if (game.release.version >= 12) {
                    // Retrieve a copy of the existing actor data.
                    let newData = game.system.utils.flattenObject(data);
                    let oldData = game.system.utils.flattenObject(this);

                    // Limit data to just the new data.
                    const diffData = foundry.utils.diffObject(oldData, newData);
                    changes = foundry.utils.expandObject(diffData);
                }
                else {
                    changes = foundry.utils.duplicate(data);
                }

                // Handle name changes
                if (changes.name) {
                    let tokenData = {};

                    // Propagate name update to prototype token if same as actor
                    if (changes.name && this.name == this.prototypeToken.name) {
                        data.prototypeToken = {name: data.name};
                    }

                    // Update tokens.
                    let tokens = this.getActiveTokens();
                    tokens.forEach(token => {
                        let updateData = foundry.utils.duplicate(tokenData);

                        // Propagate name update to token if same as actor
                        if (data.name && this.name == token.name) {
                            updateData.name = data.name;
                        }
                        token.document.update(updateData);
                    });
                }
    
                if (changes.system === undefined) return; // Nothing more to do

                const deltas = {};

                ${joinToNode(documents.filter(x => isActor(x)), document => expandToNode`
                    if (this.type == "${document.name.toLowerCase()}") this._handlePreUpdate${document.name}Delta(changes, deltas);
                `, { appendNewLineIfNotEmpty: true })}

                options.fromPreUpdate = deltas;
            }

            /* -------------------------------------------- */

            ${joinToNode(documents.filter(x => isActor(x)), document => generateActorPreUpdate(document), { appendNewLineIfNotEmpty: true })}

            /* -------------------------------------------- */

            async _onUpdate(data, options, userId) {
                await super._onUpdate(data, options, userId);

                // Iterate over all objects in fromPreUpdate, showing scrolling text for each.
                if (options.fromPreUpdate) {
                    for (const [key, delta] of Object.entries(options.fromPreUpdate)) {
                        this._showScrollingText(delta, key);
                    }
                }

                // Add / remove status effects
                const calculatedStatusEffects = CONFIG.statusEffects.filter(effect => effect.calculated);
                for (const effect of calculatedStatusEffects) {
                    const key = effect.id;
                    const active = this.system[key] ?? false;
                    const existing = this.effects.find(e => e.statuses.has(key));

                    if ((active && existing) || (!active && !existing)) continue;

                    // If the effect is active the AE doesn't exist, add it
                    if (active && !existing) {
                        const cls = getDocumentClass("ActiveEffect");
                        const createData = foundry.utils.deepClone(effect);
                        createData.statuses = [key];
                        delete createData.id;
                        createData.name = game.i18n.localize(createData.name);
                        await cls.create(createData, {parent: this});
                        if (key == "dead") Hooks.callAll("death", this);
                    }

                    // If the effect is active the AE doesn't exist, add it
                    if (!active && existing) {
                        this.deleteEmbeddedDocuments("ActiveEffect", [existing.id]);
                    }
                }
            }

            /* -------------------------------------------- */

            async _onCreate(data, options, userId) {
                await super._onCreate(data, options, userId);

                console.log("onCreate", data, options, userId);

                ${generateHealthResourceAssignments(documents)}
            }

            /* -------------------------------------------- */

            _showScrollingText(delta, suffix="", overrideOptions={}) {
            // Show scrolling text of hp update
            const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
            if (delta != 0 && tokens.length > 0) {
                let color = delta < 0 ? 0xcc0000 : 0x00cc00;
                for ( let token of tokens ) {
                    let textOptions = {
                        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
                        direction: CONST.TEXT_ANCHOR_POINTS.TOP,
                        fontSize: 32,
                        fill: color,
                        stroke: 0x000000,
                        strokeThickness: 4,
                        duration: 3000
                    };
                    canvas.interface.createScrollingText(
                        token.center,
                        delta.signedString()+" "+suffix,
                        foundry.utils.mergeObject(textOptions, overrideOptions)
                    );
                    // Flash dynamic token rings.
                    if (token?.ring) {
                        const flashColor = delta < 0 ? Color.fromString('#ff0000') : Color.fromString('#00ff00');
                        token.ring.flashColor(flashColor, {
                            duration: 600,
                            easing: foundry.canvas.tokens.TokenRing.easeTwoPeaks,
                        });
                    }
                }
            }
        }
        `.appendNewLineIfNotEmpty();
        }

        function generateInitiativeFormula(document: Document): CompositeGeneratorNode | undefined {
            const initiativeAttribute = getAllOfType<InitiativeProperty>(document.body, isInitiativeProperty);
            if (initiativeAttribute.length == 0) {
                return expandToNode`
                case "${document.name.toLowerCase()}": return "0";
                `.appendNewLineIfNotEmpty();
            }

            let initiative = initiativeAttribute[0]?.value;
            if (initiative == undefined) {
                return expandToNode`
                case "${document.name.toLowerCase()}": return "0";
                `.appendNewLineIfNotEmpty();
            }
            console.log("Initiative Formula");
            return expandToNode`
            case "${document.name.toLowerCase()}": return "${translateExpression(entry, id, initiative, true, initiativeAttribute[0])}";
            `.appendNewLineIfNotEmpty();
        }

        function generateDocumentHooks(document: Document): CompositeGeneratorNode | undefined {
            const hooks = getAllOfType<HookHandler>(document.body, isHookHandler);

            function generateHook(hook: HookHandler): CompositeGeneratorNode | undefined {
                let name = hook.name;

                function generateBody() {
                    return expandToNode`
                        const ${entry.config.name}Roll = game.system.rollClass;
                        const ${entry.config.name}DamageRoll = game.system.damageRollClass;
                        const context = {
                            object: document,
                            target: game.user.getTargetOrNothing()
                        };
                        const system = document.system;
                        let update = {};
                        let embeddedUpdate = {};
                        let parentUpdate = {};
                        let parentEmbeddedUpdate = {};
                        let targetUpdate = {};
                        let targetEmbeddedUpdate = {};
                        let selfDeleted = false;

                        ${translateBodyExpressionToJavascript(entry, id, hook.body, false, hook)}

                        if (!selfDeleted && Object.keys(update).length > 0) {
                            await document.update(update);
                        }
                        if (!selfDeleted && Object.keys(embeddedUpdate).length > 0) {
                            for (let key of Object.keys(embeddedUpdate)) {
                                await document.updateEmbeddedDocuments("Item", embeddedUpdate[key]);
                            }
                        }
                        if (Object.keys(parentUpdate).length > 0) {
                            await document.parent.update(parentUpdate);
                        }
                        if (Object.keys(parentEmbeddedUpdate).length > 0) {
                            for (let key of Object.keys(parentEmbeddedUpdate)) {
                                await document.parent.updateEmbeddedDocuments("Item", parentEmbeddedUpdate[key]);
                            }
                        }
                        if (Object.keys(targetUpdate).length > 0) {
                            await context.target.update(targetUpdate);
                        }
                        if (Object.keys(targetEmbeddedUpdate).length > 0) {
                            for (let key of Object.keys(targetEmbeddedUpdate)) {
                                await context.target.updateEmbeddedDocuments("Item", targetEmbeddedUpdate[key]);
                            }
                        }
                    `;
                }

                switch (name) {
                    case "combatStart":
                        return expandToNode`
                            Hooks.on("combatStart", async (${hook.params.map(p => p.name).join(", ")}) => {
                                ${generateBody()}
                            });
                        `.appendNewLineIfNotEmpty();
                    case "combatEnd":
                        return expandToNode`
                            Hooks.on("deleteCombat", async (${hook.params.map(p => p.name).join(", ")}) => {
                                ${generateBody()}
                            });
                        `.appendNewLineIfNotEmpty();
                    case "roundStart":
                        return expandToNode`
                            Hooks.on("combatRound", async (combat, updateData, updateOptions) => {
                                const roundStart = async (${hook.params.map(p => p.name).join(", ")}) => {
                                    ${generateBody()}
                                }

                                if (updateData.turn == 0) {
                                    await roundStart(updateData.round);
                                }
                            });
                        `.appendNewLineIfNotEmpty();
                    case "roundEnd":
                        return expandToNode`
                            Hooks.on("combatRound", async (combat, updateData, updateOptions) => {
                                const roundEnd = async (${hook.params.map(p => p.name).join(", ")}) => {
                                    ${generateBody()}
                                }
                            
                                if (updateData.round > 0) {
                                    roundEnd(updateData.round - 1);
                                }
                            });
                        `.appendNewLineIfNotEmpty();
                    case "turnStart":
                        return expandToNode`
                            Hooks.on("combatTurnChange", async (combat, updateData, updateOptions) => {
                                const turnStart = async () => {
                                    ${generateBody()}
                                }
                                if (combat.combatant.actor.uuid == document.uuid) {
                                    await turnStart();
                                }
                            });
                        `.appendNewLineIfNotEmpty();
                    case "turnEnd":
                        return expandToNode`
                            Hooks.on("combatTurnChange", async (combat, updateData, updateOptions) => {
                                const turnEnd = async () => {
                                    ${generateBody()}
                                }
                                const previousCombatant = combat.combatants.get(combat.previous?.combatantId);
                                if (previousCombatant?.actor?.uuid == document.uuid) {
                                    await turnEnd();
                                }
                            });
                        `.appendNewLineIfNotEmpty();
                    case "turnIsNext":
                        return expandToNode`
                            Hooks.on("combatTurnChange", async (combat, updateData, updateOptions) => {
                                const turnIsNext = async () => {
                                    ${generateBody()}
                                };
                                if (combat.nextCombatant.actor.uuid == document.uuid) {
                                    await turnIsNext();
                                }
                            });
                        `.appendNewLineIfNotEmpty();
                    case "death":
                        return expandToNode`
                            Hooks.on("death", async (deadDocument) => {
                                const onDeath = async () => {
                                    ${generateBody()}
                                };
                                if ( deadDocument.uuid == document.uuid ) {
                                    await onDeath();
                                }
                            });
                        `.appendNewLineIfNotEmpty();
                    case "preApplyDamage":
                    case "preApplyHealing":
                    case "preApplyTemp":
                        return expandToNode`
                            if (game.system.documentHooks.has("${name}-" + this.uuid)) return;
                            const on${name} = async (document, context) => {
                                const preApply = async (${hook.params.map(p => p.name).join(", ")}) => {
                                    ${generateBody()}
                                    return ${hook.params.shift()?.name};
                                }
                                if (document.uuid == this.uuid) {
                                    context.amount = await preApply(context.amount, context.damageType, context.damageMetadata);
                                }
                            }
                            game.system.documentHooks.set("${name}-" + this.uuid, on${name});
                            Hooks.on("${name}", on${name});
                        `.appendNewLineIfNotEmpty();
                    case "appliedDamage":
                    case "appliedHealing":
                    case "appliedTemp":
                        return expandToNode`
                            if (game.system.documentHooks.has("${name}-" + this.uuid)) return;
                            const on${name} = async (document, context) => {
                                const applied = async (${hook.params.map(p => p.name).join(", ")}) => {
                                    ${generateBody()}
                                }
                                if (document.uuid == this.uuid) {
                                    await applied(context.amount, context.damageType, context.damageMetadata);
                                }
                            };
                            game.system.documentHooks.set("${name}-" + this.uuid, on${name});
                            Hooks.on("${name}", on${name});
                        `.appendNewLineIfNotEmpty();
                    default:
                        return expandToNode`
                        Hooks.on("${name}", async (${hook.params.map(p => p.name).join(", ")}) => { 
                            ${generateBody()}
                        });
                        `.appendNewLineIfNotEmpty();
                }
            }

            return expandToNode`
                _register${document.name}Hooks(document) {
                    ${joinToNode(hooks, generateHook, { appendNewLineIfNotEmpty: true })}
                }
            `.appendNewLineIfNotEmpty().appendNewLine();
        }

        const fileNode = expandToNode`
            export default class ${entry.config.name}${type} extends ${type} {
                /** @override */
                prepareDerivedData() {
                    switch ( this.type ) {
                        ${joinToNode(entry.documents.filter(d => type == "Actor" ? isActor(d) : isItem(d)), document => `case "${document.name.toLowerCase()}": return this._prepare${document.name}DerivedData();`, { appendNewLineIfNotEmpty: true })}
                    }
                }

                /* -------------------------------------------- */

                ${joinToNode(entry.documents.filter(d => type == "Actor" ? isActor(d) : isItem(d)), document => generateDerivedData(document), { appendNewLineIfNotEmpty: true })}
            
                /* -------------------------------------------- */

                ${generateDeltas(entry.documents)}

                /* -------------------------------------------- */

                reapplyActiveEffectsForName(name) {
                    if (this.documentName !== "Actor") return;
                    for (const effect of this.appliedEffects) {
                        for (const change of effect.changes) {
                            if (change.key == name) {
                                const changes = effect.apply(this, change);
                                Object.assign(this.overrides, changes);
                            }
                        }
                    }
                }

                /* -------------------------------------------- */

                /** @override */
                _initialize(options = {}) {
                    super._initialize(options);
                    
                    switch ( this.type ) {
                        ${joinToNode(entry.documents.filter(d => type == "Actor" ? isActor(d) : isItem(d)), document => `case "${document.name.toLowerCase()}": return this._register${document.name}Hooks(this);`, { appendNewLineIfNotEmpty: true })}
                    }
                }

                /* -------------------------------------------- */

                ${joinToNode(entry.documents.filter(d => type == "Actor" ? isActor(d) : isItem(d)), generateDocumentHooks, { appendNewLineIfNotEmpty: true })}

                /* -------------------------------------------- */

                // In order to support per-document type effects, we need to override the allApplicableEffects method to yield virtualized effects with only changes that match the document type
                /** @override */
                *allApplicableEffects() {
                    const systemFlags = this.flags["${id}"] ?? {};
                    const edit = systemFlags["edit-mode"] ?? true;

                    function getTypedEffect(type, edit, effect, source) {
                        const typedEffect = new ActiveEffect(foundry.utils.duplicate(effect), {parent: effect.parent});
                        typedEffect.changes = typedEffect.changes.filter(c => c.key.startsWith(type));
                        for ( const change of typedEffect.changes ) {
                            if (change.mode == 0) continue;
                            change.key = change.key.replace(type + ".", "");
                        }
                        if ( edit ) typedEffect.disabled = true;
                        if (!typedEffect.flags) typedEffect.flags = {};
                        if (!typedEffect.flags["${id}"]) typedEffect.flags["${id}"] = {};
                        typedEffect.flags["${id}"].source = source;
                        return typedEffect;
                    }

                    for ( const effect of this.effects ) {
                        yield getTypedEffect(this.type, edit, effect, game.i18n.localize("Self"));
                    }
                    ${type == "Actor" ? expandToNode`
                    for ( const item of this.items ) {
                        for ( const effect of item.effects ) {
                            if ( effect.transfer ) yield getTypedEffect(this.type, edit, effect, item.name);
                        }
                    }
                    `.appendNewLine() : ""}
                }


                /* -------------------------------------------- */

                _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
                    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);

                    for (const document of documents) {
                        if (document.documentName !== "ActiveEffect") continue;
                        
                        for (const change of document.changes) {
                            if (change.mode != 0) continue;
                            const customMode = foundry.utils.getProperty(document.flags["${id}"], change.key + "-custommode");
                            switch (customMode) {
                                case 1: // Add Once
                                    this._effectAddOnce(parent, document, change);
                                    break;
                                default:
                                    console.error("Unknown custom mode", customMode);
                                    break;
                            }
                        }
                    }
                }

                /* -------------------------------------------- */

                _effectAddOnce(parent, ae, change) {
                    console.dir("AddOnce", parent, ae, change);

                    const key = change.key.replace(parent.type + ".", "");
                    const currentValue = foundry.utils.getProperty(parent, key);

                    // Create an update for the parent
                    const update = {
                        [key]: currentValue + parseInt(change.value)
                    };
                    parent.update(update);

                    // Create a chat card
                    const chatData = {
                        user: game.user._id,
                        speaker: ChatMessage.getSpeaker({ actor: parent }),
                        content: \`<p>Added "\${ae.name}" once</p>\`
                    };
                    ChatMessage.create(chatData);
                }

                /* -------------------------------------------- */
                
                static async createDialog(data = {}, { parent = null, pack = null, types = null, ...options } = {}) {
                    types ??= game.documentTypes[this.documentName].filter(t => (t !== CONST.BASE_DOCUMENT_TYPE) && (CONFIG[this.documentName].typeCreatables[t] !== false));
                    if (!types.length) return null;

                    const collection = parent ? null : pack ? game.packs.get(pack) : game.collections.get(this.documentName);
                    const folders = collection?._formatFolderSelectOptions() ?? [];

                    const label = game.i18n.localize(this.metadata.label);
                    const title = game.i18n.format("DOCUMENT.Create", { type: label });
                    const name = data.name || game.i18n.format("DOCUMENT.New", { type: label });

                    let type = data.type || CONFIG[this.documentName]?.defaultType;
                    if (!types.includes(type)) type = types[0];

                    // If there's only one type, no need to prompt
                    if (types.length === 1) {
                        let createName = this.defaultName();
                        const createData = {
                            name: createName,
                            type
                        };
                        return this.create(createData, { parent, pack, renderSheet: true });
                    }
                    
                    const createResponse = await game.system.documentCreateDialog.prompt({
                        type,
                        types: types.reduce((arr, typer) => {
                            arr.push({
                                type: typer,
                                label: game.i18n.has(typer) ? game.i18n.localize(typer) : typer,
                                icon: this.getDefaultArtwork({ type: typer })?.img ?? "icons/svg/item-bag.svg",
                                description: CONFIG[this.documentName]?.typeDescriptions?.[typer] ?? "",
                                selected: type === typer
                            });
                            return arr;
                        }, []).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang)),
                        name,
                        title,
                        label,
                        folders,
                        folder: data.folder
                    });
                    
                    const createData = foundry.utils.mergeObject(data, createResponse, { inplace: false });
                    createData.type = createData.type || type;
                    createData.type = createData.type.toLowerCase();
                    if (!createData.folder) delete createData.folder;
                    if (!createData.name?.trim()) createData.name = this.defaultName();
                    return this.create(createData, { parent, pack, renderSheet: true });

                    const content = await renderTemplate("systems/${id}/system/templates/document-create.hbs", {
                        folders, name, type,
                        folder: data.folder,
                        hasFolders: folders.length > 0,
                        types: types.reduce((arr, typer) => {
                            arr.push({
                                type: typer,
                                label: game.i18n.has(typer) ? game.i18n.localize(typer) : typer,
                                icon: this.getDefaultArtwork({ type: typer })?.img ?? "icons/svg/item-bag.svg",
                                description: CONFIG[this.documentName]?.typeDescriptions?.[typer] ?? "",
                                selected: type === typer
                            });
                            return arr;
                        }, []).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
                    });
                    return Dialog.prompt({
                        title, content,
                        label: title,
                        render: html => {
                            const app = html.closest(".app");
                            const folder = app.querySelector("select");
                            if (folder) app.querySelector(".dialog-buttons").insertAdjacentElement("afterbegin", folder);
                            app.querySelectorAll(".window-header .header-button").forEach(btn => {
                                const label = btn.innerText;
                                const icon = btn.querySelector("i");
                                btn.innerHTML = icon.outerHTML;
                                btn.dataset.tooltip = label;
                                btn.setAttribute("aria-label", label);
                            });
                            app.querySelector(".document-name").select();
                        },
                        callback: html => {
                            const form = html.querySelector("form");
                            const fd = new FormDataExtended(form);
                            const createData = foundry.utils.mergeObject(data, fd.object, { inplace: false });
          
                        },
                        rejectClose: false,
                        options: { ...options, jQuery: false, width: 700, height: 'auto', classes: ["${id}", "create-document", "dialog"] }
                    });
                }

                /* -------------------------------------------- */

                static getDefaultArtwork(itemData = {}) {
                    const { type } = itemData;
                    const { img } = super.getDefaultArtwork(itemData);
                    return { img: CONFIG[this.documentName]?.typeArtworks?.[type] ?? img };
                }

                /* -------------------------------------------- */

                getRollData() {
                    const data = super.getRollData();
                    const rollData = foundry.utils.duplicate(data);
                    rollData.system = this.system;
                    return rollData;
                }

                /* -------------------------------------------- */

                /** @override */
                async modifyTokenAttribute(attribute, value, isDelta, isBar) {
                    const resource = foundry.utils.getProperty(this.system, attribute);

                    if (isDelta && value < 0) {
                        // Apply to temp first
                        resource.temp += value;

                        // If temp is negative, apply to value
                        if (resource.temp < 0) {
                            resource.value += resource.temp;
                            resource.temp = 0;
                        }
                        await this.update({ ["system." + attribute]: resource });
                        return;
                    }

                    return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
                }

                ${type == "Actor" ? expandToNode`
/* -------------------------------------------- */

getInitiativeFormula() {
    switch ( this.type ) {
        ${joinToNode(entry.documents.filter(d => isActor(d)), document => generateInitiativeFormula(document), { appendNewLineIfNotEmpty: true })}
    }
}
`.appendNewLine() : ""}
            }
            `.appendNewLineIfNotEmpty();
        fs.writeFileSync(generatedFilePath, toString(fileNode));
    }

    generateExtendedDocumentClass("Actor", entry);
    generateExtendedDocumentClass("Item", entry);
}
