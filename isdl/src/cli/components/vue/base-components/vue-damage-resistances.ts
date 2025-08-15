import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {globalGetAllOfType} from "../../utils.js";
import {
    DamageTypeChoiceField,
    Entry, isChoiceStringValue, isColorParam,
    isDamageTypeChoiceField, isIconParam, isLabelParam, isStringExtendedChoice,
    isStringParamChoices, StringParamChoices
} from "../../../../language/generated/ast.js";

export default function generateDamageResistancesComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `damage-resistances.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    // Extract damage types from AST
    function extractDamageTypes(): string {
        if (!entry) return '{}';

        const damageTypeFields = globalGetAllOfType<DamageTypeChoiceField>(entry, isDamageTypeChoiceField);
        const damageTypeMap: { [key: string]: any } = {};

        for (const field of damageTypeFields) {
            const choicesParam = field.params.find(isStringParamChoices) as StringParamChoices | undefined;
            if (!choicesParam) continue;

            for (const choice of choicesParam.choices) {
                let damageTypeKey = '';
                let damageTypeInfo: any = { icon: 'fa-solid fa-circle-info', color: '#666666', label: '' };

                if (isStringExtendedChoice(choice.value)) {
                    // Extended choice with properties
                    const valueProperty = choice.value.properties.find(isChoiceStringValue);
                    if (valueProperty) {
                        damageTypeKey = valueProperty.value.replace(/"/g, '').toLowerCase();
                    }

                    const labelProperty = choice.value.properties.find(isLabelParam);
                    if (labelProperty) {
                        damageTypeInfo.label = labelProperty.value.replace(/"/g, '');
                    }

                    const iconProperty = choice.value.properties.find(isIconParam);
                    if (iconProperty) {
                        damageTypeInfo.icon = iconProperty.value.replace(/"/g, '');
                    }

                    const colorProperty = choice.value.properties.find(isColorParam);
                    if (colorProperty) {
                        damageTypeInfo.color = colorProperty.value;
                    }
                } else {
                    // Simple string choice
                    damageTypeKey = choice.value.replace(/"/g, '').toLowerCase();
                    damageTypeInfo.label = choice.value.replace(/"/g, '');
                }

                if (damageTypeKey) {
                    damageTypeMap[damageTypeKey] = damageTypeInfo;
                }
            }
        }

        return JSON.stringify(damageTypeMap, null, 8);
    }

    const damageTypesObject = extractDamageTypes();

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject, watchEffect } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            visibility: String,
            editMode: Boolean,
            icon: String
        });

        const document = inject("rawDocument");

        // Static damage type configuration extracted from AST
        const damageTypeConfig = ${damageTypesObject};

        const isHidden = computed(() => {
            if (props.visibility === "hidden") {
                return true;
            }
            if (props.visibility === "gm" && !game.user.isGM) {
                return true;
            }
            return false;
        });

        // Get all damage resistances from the actor's system
        const damageResistances = computed(() => {      
            const system = document.system;
            const resistanceInfo = {};
            
            // Scan all system properties for resistance damage fields
            for (const [key, value] of Object.entries(system)) {
                const flatResistMatch = key.match(/^(.+)damageresistanceflat$/);
                const percentResistMatch = key.match(/^(.+)damageresistancepercent$/);
                
                let damageType = null;
                let effectType = null;
                
                if (flatResistMatch) {
                    damageType = flatResistMatch[1];
                    effectType = 'flatResistance';
                } else if (percentResistMatch) {
                    damageType = percentResistMatch[1];
                    effectType = 'percentResistance';
                }
                
                if (damageType && effectType) {
                    if (!resistanceInfo[damageType]) {
                        const damageTypeObj = damageTypeConfig[damageType] || {};
                        
                        resistanceInfo[damageType] = {
                            type: damageType,
                            label: damageTypeObj.label || damageType,
                            icon: damageTypeObj.icon || 'fa-solid fa-circle-info',
                            color: damageTypeObj.color || '#666666',
                            flatResistance: 0,
                            percentResistance: 0
                        };
                    }
                    
                    if (effectType === 'flatResistance') {
                        resistanceInfo[damageType].flatResistance = Number(value) || 0;
                    } else if (effectType === 'percentResistance') {
                        resistanceInfo[damageType].percentResistance = Number(value) || 0;
                    }
                }
            }
            
            // Convert to array and sort by damage type name
            return Object.values(resistanceInfo).sort((a, b) => a.type.localeCompare(b.type));
        });

        // Helper function to capitalize damage type names
        const capitalize = (str) => {
            return str.charAt(0).toUpperCase() + str.slice(1);
        };

        // Helper function to format resistance values
        const formatValue = (value, suffix = '') => {
            const numValue = Number(value) || 0;
            return \`\${numValue}\${suffix}\`;
        };
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-damage-resistances pt-2 double-wide">
            <v-card class="damage-resistances-card" variant="outlined">
                <v-card-title class="damage-resistances-header">
                    <v-icon v-if="icon" class="me-2">{{ icon }}</v-icon>
                    <span>{{ game.i18n.localize(label) }}</span>
                </v-card-title>
                
                <v-card-text>
                    <div v-if="damageResistances.length === 0" class="text-center text-disabled">
                        No damage resistances found
                    </div>
                    
                    <v-table v-else density="compact" class="damage-resistances-table">
                        <thead>
                            <tr>
                                <th class="text-left">Type</th>
                                <th class="text-center">Flat Resistance</th>
                                <th class="text-center">% Resistance</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="damage in damageResistances" :key="damage.type" class="damage-type-row">
                                <td class="damage-type-name">
                                    <div class="damage-type-header">
                                        <v-icon 
                                            :color="damage.color"
                                            size="small"
                                            class="me-2"
                                        >
                                            {{ damage.icon }}
                                        </v-icon>
                                        <span class="text-subtitle-2" :style="{ color: damage.color }">
                                            {{ damage.label || capitalize(damage.type) }}
                                        </span>
                                    </div>
                                </td>
                                <td class="text-center">
                                    <v-chip 
                                        size="small" 
                                        :color="Number(damage.flatResistance) > 0 ? 'blue' : 'grey'"
                                        variant="outlined"
                                    >
                                        {{ formatValue(damage.flatResistance) }}
                                    </v-chip>
                                </td>
                                <td class="text-center">
                                    <v-chip 
                                        size="small" 
                                        :color="Number(damage.percentResistance) > 0 ? 'blue' : 'grey'"
                                        variant="outlined"
                                    >
                                        {{ formatValue(damage.percentResistance, '%') }}
                                    </v-chip>
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-card-text>
            </v-card>
        </div>
    </template>

    <style scoped>
    .damage-resistances-field {
        margin: 8px 0;
    }

    .damage-resistances-card {
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .damage-resistances-header {
        background: rgba(var(--v-theme-info), 0.1);
        padding: 12px 16px;
        font-weight: 600;
        border-bottom: 1px solid rgba(var(--v-theme-info), 0.2);
    }

    .damage-resistances-table {
        background: transparent;
    }

    .damage-type-row:hover {
        background-color: rgba(var(--v-theme-info), 0.05);
    }

    .damage-type-name {
        font-weight: 500;
        min-width: 120px;
    }

    .damage-type-header {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .v-table th {
        font-weight: 600;
        color: rgba(var(--v-theme-on-surface), 0.8);
        font-size: 0.875rem;
    }

    .v-table td {
        padding: 8px 12px;
        border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
    }

    .v-chip {
        min-width: 60px;
        justify-content: center;
    }
    </style>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}