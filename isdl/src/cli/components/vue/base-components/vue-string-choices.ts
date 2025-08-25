import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateStringChoicesComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `string-choices.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            icon: String,
            color: String,
            disabled: Boolean,
            items: {
                type: Array,
                default: () => []
            },
            isExtended: {
                type: Boolean,
                default: false
            },
            maxSelections: Number,
            primaryColor: String,
            secondaryColor: String
        });

        const document = inject("rawDocument");

        // Get the array of selected values
        const selectedValues = computed({
            get: () => {
                const values = foundry.utils.getProperty(props.context, props.systemPath);
                if (!Array.isArray(values)) return [];
                
                if (props.isExtended) {
                    // For extended choices, extract the 'value' property from each object
                    return values.map(item => typeof item === 'object' && item.value ? item.value : item);
                } else {
                    // For simple choices, use the array as-is
                    return values;
                }
            },
            set: (newValues) => {
                if (!Array.isArray(newValues)) {
                    foundry.utils.setProperty(props.context, props.systemPath, []);
                    return;
                }
                
                if (props.isExtended) {
                    // For extended choices, create objects with value, icon, color from items
                    const selectedObjects = newValues.map(value => {
                        const item = props.items.find(i => i.value === value);
                        if (item) {
                            const obj = { value: item.value, icon: item.icon || "", color: item.color || "#ffffff" };
                            // Add any custom properties
                            if (item.customKeys) {
                                item.customKeys.forEach(custom => {
                                    obj[custom.key.toLowerCase()] = custom.value;
                                });
                            }
                            return obj;
                        }
                        return { value, icon: "", color: "#ffffff" };
                    });
                    foundry.utils.setProperty(props.context, props.systemPath, selectedObjects);
                } else {
                    // For simple choices, store the array of strings directly
                    foundry.utils.setProperty(props.context, props.systemPath, newValues);
                }
            }
        });

        const fieldColor = computed(() => {
            return props.color || 'primary';
        });

        const localizedLabel = computed(() => {
            return game.i18n.localize(props.label);
        });

        const maxReached = computed(() => {
            return props.maxSelections && selectedValues.value.length >= props.maxSelections;
        });

        const getTooltip = (item) => {
            // The choice item might have additional system properties other than the core value, color, and icon.
            // We want to build a tooltip of these additional values
            const tooltipParts = [];
            if (item.customKeys && item.customKeys.length > 0) {
                for (const custom of item.customKeys) {
                    const value = custom.value;
                    if (value !== undefined) {
                        tooltipParts.push(\`\${custom.label}: \${value}\`);
                    }
                }
            }
            return tooltipParts.join('<br>');
        };
        
        const getLabel = (label, icon) => {
            const localized = game.i18n.localize(label);
            if (icon) {
                return \`<i class="\${icon}"></i> \${localized}\`;
            }
            return localized;
        };
    </script>

    <template>
        <div class="isdl-string-choices double-wide">
            <!-- Simple choices field - uses v-select with multiple -->
            <v-select 
                v-if="!props.isExtended"
                v-model="selectedValues"
                :name="props.systemPath"
                :items="props.items"
                item-title="label"
                item-value="value"
                :disabled="disabled"
                :color="fieldColor"
                variant="outlined"
                density="compact"
                multiple
                chips
                clearable
            >
                <template #label>
                    <span class="field-label">
                        <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                        {{ localizedLabel }}
                    </span>
                </template>
            </v-select>

            <!-- Extended choices field - uses v-select with custom templates, same style as choice<string> -->
            <v-select 
                v-else
                v-model="selectedValues"
                :name="props.systemPath"
                :items="props.items"
                item-title="label"
                item-value="value"
                :disabled="disabled"
                :color="fieldColor"
                variant="outlined"
                density="compact"
                multiple
                chips
                clearable
            >
                <template #label>
                    <span v-html="getLabel(props.label, props.icon)" />
                </template>

                <template v-slot:item="{ props: itemProps, item }">
                    <v-list-item 
                        v-bind="itemProps" 
                        :value="item.raw.value" 
                        title=""
                        :disabled="maxReached && !selectedValues.includes(item.raw.value)"
                    >
                        <v-list-item-title>
                            <v-chip 
                                label 
                                :color="item.raw.color" 
                                variant="elevated" 
                                class="text-caption" 
                                size="small" 
                                :data-tooltip="getTooltip(item.raw)"
                            >
                                <span v-html="getLabel(item.raw.label, item.raw.icon)"></span>
                            </v-chip>
                        </v-list-item-title>
                    </v-list-item>
                </template>

                <template v-slot:chip="{ props: chipProps, item }">
                    <v-chip 
                        v-bind="chipProps"
                        label 
                        :color="item.raw.color" 
                        variant="elevated" 
                        class="text-caption" 
                        size="small" 
                        :data-tooltip="getTooltip(item.raw)"
                    >
                        <span v-html="getLabel(item.raw.label, item.raw.icon)"></span>
                    </v-chip>
                </template>
            </v-select>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}