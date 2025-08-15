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

export default function generateDamageBonusesComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `damage-bonuses.vue`);

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

        // Get all damage bonuses from the actor's system
        const damageBonuses = computed(() => {  
            const system = document.system;
            const bonusInfo = {};
            
            // Scan all system properties for bonus damage fields
            for (const [key, value] of Object.entries(system)) {
                const bonusMatch = key.match(/^(.+)bonusdamage$/);
                
                if (bonusMatch) {
                    const damageType = bonusMatch[1];
                    const damageTypeObj = damageTypeConfig[damageType] || {};
                    
                    bonusInfo[damageType] = {
                        type: damageType,
                        label: damageTypeObj.label || damageType,
                        icon: damageTypeObj.icon || 'fa-solid fa-circle-info',
                        color: damageTypeObj.color || '#666666',
                        bonus: Number(value) || 0
                    };
                }
            }
            
            // Convert to array and sort by damage type name
            return Object.values(bonusInfo).sort((a, b) => a.type.localeCompare(b.type));
        });

        // Helper function to capitalize damage type names
        const capitalize = (str) => {
            return str.charAt(0).toUpperCase() + str.slice(1);
        };

        // Helper function to format bonus values
        const formatBonus = (value) => {
            const numValue = Number(value) || 0;
            return numValue > 0 ? \`+\${numValue}\` : \`\${numValue}\`;
        };
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-damage-bonuses pt-2 single-wide">
            <v-card class="damage-bonuses-card" variant="outlined">
                <v-card-title class="damage-bonuses-header">
                    <v-icon v-if="icon" class="me-2">{{ icon }}</v-icon>
                    <span>{{ game.i18n.localize(label) }}</span>
                </v-card-title>
                
                <v-card-text>
                    <div v-if="damageBonuses.length === 0" class="text-center text-disabled">
                        No damage bonuses found
                    </div>
                    
                    <v-table v-else density="compact" class="damage-bonuses-table">
                        <thead>
                            <tr>
                                <th class="text-left">Type</th>
                                <th class="text-center">Bonus</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="damage in damageBonuses" :key="damage.type" class="damage-type-row">
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
                                        :color="Number(damage.bonus) > 0 ? 'green' : Number(damage.bonus) < 0 ? 'red' : 'grey'"
                                        variant="outlined"
                                    >
                                        {{ formatBonus(damage.bonus) }}
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
    .damage-bonuses-field {
        margin: 8px 0;
    }

    .damage-bonuses-card {
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .damage-bonuses-header {
        background: rgba(var(--v-theme-success), 0.1);
        padding: 12px 16px;
        font-weight: 600;
        border-bottom: 1px solid rgba(var(--v-theme-success), 0.2);
    }

    .damage-bonuses-table {
        background: transparent;
    }

    .damage-type-row:hover {
        background-color: rgba(var(--v-theme-success), 0.05);
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