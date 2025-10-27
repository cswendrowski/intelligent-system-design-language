import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateMoneyComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `money.vue`);

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
            visibility: String,
            editMode: Boolean,
            icon: String,
            color: String,
            disabled: Boolean,
            hasValueParam: Boolean,
            primaryColor: String,
            secondaryColor: String,
            format: {
                type: String,
                default: "auto"
            },
            precision: {
                type: Number,
                default: 1
            },
            display: {
                type: String,
                default: "breakdown"
            },
            denominations: {
                type: Array,
                default: () => []
            }
        });

        const document = inject("rawDocument");

        const isHidden = computed(() => {
            if (props.visibility === "hidden") {
                return true;
            }
            if (props.visibility === "gm" && !game.user.isGM) {
                return true;
            }
            return false;
        });

        const isDisabled = computed(() => {
            return props.disabled ||
                   props.hasValueParam ||
                   props.visibility === "locked" ||
                   props.visibility === "readonly" ||
                   (props.visibility === "gmOnly" && !game.user.isGM);
        });

        const fieldColor = computed(() => {
            return props.color || 'primary';
        });

        const showDenominationPanel = ref(false);
        const showConversionDialog = ref(false);
        const conversionSource = ref(null);
        const conversionTarget = ref(null);
        const conversionAmount = ref(0);

        // For single currency, value is just a number
        // For multi-denomination, value is an object: { gold: 1, silver: 25, bronze: 32 }
        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath),
            set: (newValue) => {
                // Ensure we always store a valid number for single currency, default to 0 for invalid values
                if (!hasDenominations.value) {
                    const validValue = (typeof newValue === 'number' && isFinite(newValue)) ? newValue : 0;
                    foundry.utils.setProperty(props.context, props.systemPath, validValue);
                } else {
                    foundry.utils.setProperty(props.context, props.systemPath, newValue);
                }
            }
        });

        const hasDenominations = computed(() => {
            return props.denominations && props.denominations.length > 0;
        });

        // Format a number with k/M/B suffixes
        const formatNumber = (num) => {
            if (props.format === "full") {
                return num.toLocaleString();
            }

            const absNum = Math.abs(num);

            if (props.format === "compact" || (props.format === "auto" && absNum >= 1000)) {
                const sign = num < 0 ? '-' : '';
                if (absNum >= 1000000000) {
                    return sign + (absNum / 1000000000).toFixed(props.precision) + 'B';
                }
                if (absNum >= 1000000) {
                    return sign + (absNum / 1000000).toFixed(props.precision) + 'M';
                }
                if (absNum >= 1000) {
                    return sign + (absNum / 1000).toFixed(props.precision) + 'k';
                }
            }

            return num.toLocaleString();
        };

        // Get total value in base denomination
        const totalValue = computed(() => {
            if (!hasDenominations.value) {
                return value.value || 0;
            }

            let total = 0;
            if (value.value && typeof value.value === 'object') {
                props.denominations.forEach(denom => {
                    const denomName = denom.name.toLowerCase();
                    const denomValue = value.value[denomName] || 0;
                    total += denomValue * (denom.value || 1);
                });
            }
            return total;
        });

        // Format display for multi-denomination
        const formattedDenominationDisplay = computed(() => {
            if (!hasDenominations.value || !value.value) return "0";

            const primary = props.denominations[0];
            const primaryName = primary.name.toLowerCase();

            if (props.display === "primary") {
                const primaryValue = value.value[primaryName] || 0;
                return \`\${primaryValue}\${primary.name.charAt(0).toLowerCase()}\`;
            }

            if (props.display === "consolidated") {
                const totalInPrimary = totalValue.value / (primary.value || 1);
                return \`\${totalInPrimary.toFixed(2)}\${primary.name.charAt(0).toLowerCase()}\`;
            }

            // breakdown
            const parts = [];
            props.denominations.forEach(denom => {
                const denomName = denom.name.toLowerCase();
                const denomValue = value.value[denomName] || 0;
                if (denomValue > 0) {
                    parts.push(\`\${denomValue}\${denom.name.charAt(0).toLowerCase()}\`);
                }
            });
            return parts.length > 0 ? parts.join(' ') : '0';
        });

        const exactAmountTooltip = computed(() => {
            if (!hasDenominations.value) {
                return (value.value || 0).toLocaleString();
            }
            return formattedDenominationDisplay.value;
        });

        // Formatted display for single currency (used in non-edit mode)
        const formattedSingleDisplay = computed(() => {
            if (hasDenominations.value) return '';
            return formatNumber(value.value || 0);
        });

        // Single currency edit
        const onSingleCurrencyChange = (newValue) => {
            value.value = newValue;
        };

        // Multi-denomination edit
        const onDenominationChange = (denomName, newValue) => {
            const current = value.value || {};
            // Ensure we always store a valid number, default to 0 for invalid values
            const validValue = (typeof newValue === 'number' && isFinite(newValue)) ? newValue : 0;
            const updated = { ...current, [denomName]: validValue };
            value.value = updated;
        };

        // Open conversion dialog for a specific denomination
        const openConversionDialog = (sourceDenom) => {
            conversionSource.value = sourceDenom;
            // Default to first different denomination
            const otherDenoms = props.denominations.filter(d => d.name !== sourceDenom.name);
            conversionTarget.value = otherDenoms[0] || props.denominations[0];
            conversionAmount.value = 0;
            showConversionDialog.value = true;
        };

        // Preview the conversion result
        const conversionPreview = computed(() => {
            if (!conversionSource.value || !conversionTarget.value) {
                return { valid: false, result: 0, sourceValue: 0, targetValue: 0 };
            }

            const sourceName = conversionSource.value.name.toLowerCase();
            const targetName = conversionTarget.value.name.toLowerCase();
            const sourceAvailable = value.value?.[sourceName] || 0;
            const targetAvailable = value.value?.[targetName] || 0;

            // If no amount specified, just show available amounts
            if (!conversionAmount.value || conversionAmount.value === 0) {
                return { valid: false, result: 0, sourceValue: sourceAvailable, targetValue: targetAvailable };
            }

            // Check if we have enough
            if (conversionAmount.value > sourceAvailable) {
                return { valid: false, result: 0, sourceValue: sourceAvailable, targetValue: targetAvailable, insufficient: true };
            }

            // Calculate conversion
            const sourceValueInBase = conversionAmount.value * conversionSource.value.value;
            const targetResult = Math.floor(sourceValueInBase / conversionTarget.value.value);

            return {
                valid: targetResult > 0,
                result: targetResult,
                sourceValue: sourceAvailable,
                targetValue: targetAvailable,
                insufficient: false
            };
        });

        // Execute the conversion
        const executeConversion = () => {
            const preview = conversionPreview.value;
            if (!preview.valid) return;

            const sourceName = conversionSource.value.name.toLowerCase();
            const targetName = conversionTarget.value.name.toLowerCase();

            const current = value.value || {};
            const updated = { ...current };

            updated[sourceName] = (updated[sourceName] || 0) - conversionAmount.value;
            updated[targetName] = (updated[targetName] || 0) + preview.result;

            value.value = updated;
            showConversionDialog.value = false;
        };
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-money single-wide">
            <!-- Single Currency Money (Edit Mode) -->
            <v-number-input
                v-if="!hasDenominations && props.editMode"
                v-model="value"
                :name="props.systemPath"
                :disabled="isDisabled"
                :color="fieldColor"
                controlVariant="stacked"
                density="compact"
                variant="outlined"
            >
                <template #label>
                    <span class="field-label">
                        <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                        {{ game.i18n.localize(props.label) }}
                    </span>
                </template>
                <template #append-inner>
                    <i-calculator
                        :context="props.context"
                        :systemPath="props.systemPath"
                        :primaryColor="props.primaryColor"
                        :secondaryColor="props.secondaryColor">
                    </i-calculator>
                </template>
            </v-number-input>

            <!-- Single Currency Money (Display Mode) -->
            <v-text-field
                v-else-if="!hasDenominations && !props.editMode"
                :model-value="formattedSingleDisplay"
                readonly
                :color="fieldColor"
                density="compact"
                variant="outlined"
                :data-tooltip="exactAmountTooltip"
            >
                <template #label>
                    <v-tooltip :text="exactAmountTooltip">
                        <template v-slot:activator="{ props: tooltipProps }">
                            <span class="field-label" v-bind="tooltipProps">
                                <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                                {{ game.i18n.localize(props.label) }}
                            </span>
                        </template>
                    </v-tooltip>
                </template>
            </v-text-field>

            <!-- Multi-Denomination Money -->
            <v-input v-else class="isdl-money-denominations">
                <template #default>
                    <v-field
                        class="v-field--active"
                        density="compact"
                        variant="outlined"
                    >
                        <template #label>
                            <span class="field-label">
                                <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                                {{ game.i18n.localize(props.label) }}
                            </span>
                        </template>
                        <template #append-inner>
                            <v-icon
                                :icon="showDenominationPanel ? 'fa-solid fa-caret-up' : 'fa-solid fa-caret-down'"
                                @click.stop="showDenominationPanel = !showDenominationPanel"
                                class="v-select__menu-icon"
                            />
                        </template>
                        <div class="money-content flexcol">
                            <div class="d-flex money-inner-content">
                                <span v-html="formattedDenominationDisplay" />
                            </div>
                            <v-expand-transition>
                                <div v-show="showDenominationPanel" class="money-expanded-content" style="margin-top: 1rem;">
                                    <div v-for="denom in denominations" :key="denom.name" class="denomination-row">
                                        <v-number-input
                                            :model-value="value[denom.name.toLowerCase()] || 0"
                                            @update:model-value="(newVal) => onDenominationChange(denom.name.toLowerCase(), newVal)"
                                            :name="\`\${props.systemPath}.\${denom.name.toLowerCase()}\`"
                                            :disabled="isDisabled"
                                            :color="denom.color || fieldColor"
                                            :controlVariant="isDisabled ? 'hidden' : 'stacked'"
                                            density="compact"
                                            variant="outlined"
                                            hide-details
                                            class="mb-2"
                                        >
                                            <template #label>
                                                <span class="field-label">
                                                    <v-icon v-if="denom.icon" :icon="denom.icon" :color="denom.color" size="small" class="me-1"></v-icon>
                                                    {{ denom.name }}
                                                </span>
                                            </template>
                                            <template #append-inner>
                                                <i-calculator
                                                    v-if="props.editMode && !isDisabled"
                                                    :context="props.context"
                                                    :systemPath="\`\${props.systemPath}.\${denom.name.toLowerCase()}\`"
                                                    :primaryColor="props.primaryColor"
                                                    :secondaryColor="props.secondaryColor">
                                                </i-calculator>
                                                <v-btn
                                                    v-if="!isDisabled"
                                                    icon="fa-solid fa-right-left"
                                                    size="x-small"
                                                    variant="text"
                                                    @click.stop="openConversionDialog(denom)"
                                                    style="opacity: 0.7;"
                                                >
                                                </v-btn>
                                            </template>
                                        </v-number-input>
                                    </div>
                                </div>
                            </v-expand-transition>
                        </div>
                    </v-field>
                </template>
            </v-input>

            <!-- Conversion Dialog -->
            <v-dialog v-model="showConversionDialog" max-width="500">
                <v-card>
                    <v-card-title>
                        <span class="text-h6">Convert {{ conversionSource?.name }}</span>
                    </v-card-title>
                    <v-card-text>
                        <div class="d-flex flex-column gap-3">
                            <v-number-input
                                v-model="conversionAmount"
                                label="Amount to convert"
                                :hint="\`Available: \${conversionPreview.sourceValue}\`"
                                persistent-hint
                                density="compact"
                                variant="outlined"
                                controlVariant="stacked"
                                :min="0"
                                :max="conversionPreview.sourceValue"
                            />

                            <v-select
                                v-model="conversionTarget"
                                :items="denominations.filter(d => d.name !== conversionSource?.name)"
                                item-title="name"
                                label="Convert to"
                                return-object
                                density="compact"
                                variant="outlined"
                            >
                                <template v-slot:item="{ item, props: itemProps }">
                                    <v-list-item v-bind="itemProps">
                                        <template v-slot:prepend>
                                            <v-icon v-if="item.raw.icon" :icon="item.raw.icon" :color="item.raw.color"></v-icon>
                                        </template>
                                    </v-list-item>
                                </template>
                            </v-select>

                            <v-alert v-if="conversionPreview.insufficient" type="error" density="compact">
                                Insufficient funds
                            </v-alert>

                            <v-alert v-else-if="conversionPreview.valid" type="info" density="compact">
                                <div class="text-body-2">
                                    <strong>Preview:</strong><br/>
                                    {{ conversionSource?.name }}: {{ conversionPreview.sourceValue }} → {{ conversionPreview.sourceValue - conversionAmount }}<br/>
                                    {{ conversionTarget?.name }}: {{ conversionPreview.targetValue }} → {{ conversionPreview.targetValue + conversionPreview.result }}
                                </div>
                            </v-alert>
                        </div>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn
                            variant="text"
                            @click="showConversionDialog = false"
                        >
                            Cancel
                        </v-btn>
                        <v-btn
                            :color="props.primaryColor || 'primary'"
                            variant="elevated"
                            @click="executeConversion"
                            :disabled="!conversionPreview.valid"
                        >
                            Convert
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
