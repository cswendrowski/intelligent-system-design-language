import { expandToNode, toString } from 'langium/generate';
import { Entry } from '../../language/generated/ast.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function generateDamageRoll(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "rolls");
    const generatedFilePath = path.join(generatedFileDir, `damage-roll.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        import ${entry.config.name}Roll from "./roll.mjs";

        /**
         * Extended Roll class for damage with type metadata
         */
        export default class ${entry.config.name}DamageRoll extends ${entry.config.name}Roll {
            
            constructor(formula, data = {}, options = {}) {
                // Add AE Damage Type Bonus if damage type is specified and actor exists
                if (options.type?.value && data.actor) {
                    const damageTypeKey = options.type.value.toLowerCase().replace(/\\s+/g, '');
                    const bonusField = \`\${damageTypeKey}bonusdamage\`;
                    const aeBonus = data.actor.system[bonusField];
                    
                    if (aeBonus && aeBonus !== 0) {
                        // Add the AE bonus as a separate term to the formula
                        formula = \`\${formula} + \${aeBonus}[AE \${options.type.value} Damage Bonus]\`;
                    }
                }
                
                super(formula, data, options);
                
                // Store damage type metadata
                this._damageType = options.type?.value || null;
                this._damageTypeData = options.type || {};
                this.#createCustomPropertyAccessors();
            }

            /* -------------------------------------------- */

            /**
             * The damage type of this roll
             * @type {string}
             */
            get type() {
                return this._damageType;
            }

            /**
             * The icon associated with this damage type
             * @type {string}
             */
            get icon() {
                return this._damageTypeData.icon || '';
            }

            /**
             * The color associated with this damage type
             * @type {string}
             */
            get color() {
                return this._damageTypeData.color || '#ffffff';
            }

            /**
             * Get a custom metadata property for this damage type
             * @param {string} key - The property key
             * @returns {*} The property value
             */
            getMetadata(key) {
                return this._damageTypeData[key];
            }

            /**
             * Get all custom metadata for this damage type
             * @returns {object} All metadata properties
             */
            get metadata() {
                return this._damageTypeData;
            }

            /**
             * Access custom properties directly on the roll
             * Enables usage like: damageRoll.physical, damageRoll.magical, etc.
             */
            #createCustomPropertyAccessors() {
                if (this._damageTypeData) {
                    for (const [key, value] of Object.entries(this._damageTypeData)) {
                        if (!this.hasOwnProperty(key) && !this.constructor.prototype.hasOwnProperty(key)) {
                            Object.defineProperty(this, key, {
                                get: () => value,
                                enumerable: true,
                                configurable: true
                            });
                        }
                    }
                }
            }

            /* -------------------------------------------- */

            /** @override */
            async getTooltip() {
                let tooltip = await super.getTooltip();
                
                // Add damage type information to tooltip
                if (this.type) {
                    // Add data attribute for styling
                    tooltip = tooltip.replace('<div class="dice-tooltip"', 
                        \`<div class="dice-tooltip damage-tooltip" data-damage-type="\${this.type}"\`);
                }
                
                // Build damage metadata section if we have metadata
                if (this._damageTypeData && Object.keys(this._damageTypeData).length > 0) {
                    let metadataHtml = '<div class="damage-metadata" style="display: flex; gap: 0.5em; align-items: center;">';
                    
                    // Add damage type with icon and color if available
                    if (this.type) {
                        metadataHtml += \`<span class="damage-property" data-property="type">Type: <span style="color: \${this.color};">\${this.type}</span></span>\`;
                    }
                    
                    // Add custom metadata properties (excluding standard ones)
                    const excludedKeys = ['value', 'icon', 'color', 'label'];
                    const customProperties = Object.entries(this._damageTypeData)
                        .filter(([key]) => !excludedKeys.includes(key));
                    
                    for (const [key, value] of customProperties) {
                        if (value !== null && value !== undefined && value !== '') {
                            metadataHtml += \`<span class="damage-property" data-property="\${key}">\${key}: \${value}</span>\`;
                        }
                    }
                    
                    metadataHtml += '</div>';
                    
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = tooltip;
                    
                    // Choose the last .dice-tooltip (or use querySelector to pick a specific one)
                    const tips = wrapper.querySelectorAll('.dice-tooltip');
                    if (tips.length > 0) {
                      const tip = tips[tips.length - 1];
                      tip.insertAdjacentHTML('beforeend', metadataHtml);
                      tooltip = wrapper.innerHTML;
                    } else {
                      // fallback: append at end if no container found
                      tooltip += metadataHtml;
                    }
                }
                
                return tooltip;
            }

            /* -------------------------------------------- */

            /**
             * Create a DamageRoll from a damage() function call
             * @param {string} formula - The dice formula
             * @param {string} damageType - The damage type value 
             * @param {object} damageTypeData - The metadata associated with the damage type
             * @param {object} data - Roll data context
             * @param {object} options - Additional roll options
             * @returns {${entry.config.name}DamageRoll}
             */
            static create(baseRoll, options = {}) {
                const roll = new this(baseRoll._formula, baseRoll.data, options);
                roll.#createCustomPropertyAccessors();
                return roll;
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}