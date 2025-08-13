import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateDamageApplicationComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `damage-application.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject, watch } from "vue";

        const props = defineProps({
            rollData: {
                type: Object,
                required: true,
                default: () => ({
                    value: 0,
                    isDamageRoll: false,
                    damageType: null,
                    damageColor: null,
                    damageIcon: null,
                    metadata: {}
                })
            },
            visible: {
                type: Boolean,
                default: false
            }
        });

        const emit = defineEmits(['close', 'apply']);

        // Internal state
        const selectedTargetType = ref('selected');
        const selectedMultiplier = ref(1);
        const showDialog = ref(false);

        // Available multipliers
        const multipliers = [
            { value: 0.25, label: '¼x' },
            { value: 0.5, label: '½x' },
            { value: 1, label: '1x' },
            { value: 1.5, label: '1.5x' },
            { value: 2, label: '2x' },
            { value: 3, label: '3x' },
            { value: 4, label: '4x' }
        ];

        // Target type options
        const targetTypes = [
            { value: 'targeted', label: 'Targeted', icon: 'fa-solid fa-bullseye' },
            { value: 'selected', label: 'Selected', icon: 'fa-solid fa-expand' }
        ];

        // Watch for visibility changes
        watch(() => props.visible, (newValue) => {
            showDialog.value = newValue;
        });

        // Computed values
        const finalDamage = computed(() => {
            return Math.floor(props.rollData.value * selectedMultiplier.value);
        });

        const targets = computed(() => {
            const targetType = selectedTargetType.value;
            const targetList = targetType === 'targeted'
                ? [...game.user.targets]
                : (canvas?.tokens?.controlled ?? []);
            
            return targetList;
        });

        const hasTargets = computed(() => targets.value.length > 0);

        const damageTypeDisplay = computed(() => {
            if (!props.rollData.isDamageRoll || !props.rollData.damageType) {
                return null;
            }
            
            return {
                type: props.rollData.damageType,
                color: props.rollData.damageColor || '#ffffff',
                icon: props.rollData.damageIcon
            };
        });

        // Methods
        const closeDialog = () => {
            showDialog.value = false;
            emit('close');
        };

        const applyDamage = (type = 'damage') => {
            if (!hasTargets.value) {
                ui.notifications.warn(game.i18n.localize(\`NOTIFICATIONS.\${selectedTargetType.value === 'targeted' ? 'NoTokenTargeted' : 'NoTokenSelected'}\`));
                return;
            }

            const context = {
                amount: type === 'healing' ? -finalDamage.value : finalDamage.value,
                multiplier: selectedMultiplier.value,
                targetType: selectedTargetType.value,
                damageType: props.rollData.isDamageRoll ? props.rollData.damageType : null,
                damageMetadata: props.rollData.isDamageRoll ? props.rollData.metadata : {},
                color: props.rollData.isDamageRoll ? props.rollData.damageColor : null,
                icon: props.rollData.isDamageRoll ? props.rollData.damageIcon : null,
                isDamageRoll: props.rollData.isDamageRoll
            };

            emit('apply', {
                type,
                targets: targets.value,
                context
            });

            closeDialog();
        };

        // Expose data for the Application sheet
        const getApplicationData = () => {
            return {
                targets: targets.value,
                context: {
                    amount: finalDamage.value,
                    multiplier: selectedMultiplier.value,
                    targetType: selectedTargetType.value
                }
            };
        };

        // Expose the method to the parent component
        const rawSheet = inject("rawSheet", null);
        if (rawSheet && typeof rawSheet === 'object') {
            rawSheet.getApplicationData = getApplicationData;
        }

        const applyHealing = () => applyDamage('healing');
        const applyTemp = () => applyDamage('temp');

        const selectTargetType = (type) => {
            selectedTargetType.value = type;
            game.settings.set(game.system.id, 'userTargetDamageApplicationType', type);
        };

        const selectMultiplier = (multiplier) => {
            selectedMultiplier.value = multiplier;
        };

        // Initialize from settings
        const initializeSettings = () => {
            const allowTargeting = game.settings.get(game.system.id, 'allowTargetDamageApplication');
            let targetType = game.settings.get(game.system.id, 'userTargetDamageApplicationType');
            
            if (!allowTargeting && targetType !== 'selected') {
                targetType = 'selected';
                game.settings.set(game.system.id, 'userTargetDamageApplicationType', 'selected');
            }
            
            selectedTargetType.value = targetType;
        };

        // Initialize on mount
        initializeSettings();
    </script>

    <template>
        <v-dialog 
            v-model="showDialog" 
            max-width="500" 
            persistent
            @click:outside="closeDialog"
        >
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2">mdi-sword-cross</v-icon>
                    Apply Damage
                    <v-spacer></v-spacer>
                    <v-btn 
                        icon="mdi-close" 
                        variant="text" 
                        size="small"
                        @click="closeDialog"
                    ></v-btn>
                </v-card-title>

                <v-card-text>
                    <!-- Damage Info -->
                    <div class="damage-info mb-4">
                        <div class="d-flex align-center mb-2">
                            <span class="text-h6 mr-2">{{ props.rollData.value }}</span>
                            <span v-if="damageTypeDisplay" class="damage-type-badge">
                                <v-icon 
                                    v-if="damageTypeDisplay.icon" 
                                    :icon="damageTypeDisplay.icon"
                                    :color="damageTypeDisplay.color"
                                    size="small"
                                    class="mr-1"
                                ></v-icon>
                                <span :style="{ color: damageTypeDisplay.color }">
                                    {{ damageTypeDisplay.type }}
                                </span>
                            </span>
                        </div>
                        
                        <!-- Damage metadata -->
                        <div v-if="props.rollData.isDamageRoll && Object.keys(props.rollData.metadata).length > 0" 
                             class="damage-metadata">
                            <v-chip 
                                v-for="(value, key) in props.rollData.metadata" 
                                :key="key"
                                size="small"
                                variant="outlined"
                                class="mr-1 mb-1"
                            >
                                {{ key }}: {{ value }}
                            </v-chip>
                        </div>
                    </div>

                    <!-- Target Selection -->
                    <div class="target-selection mb-4">
                        <h4 class="mb-2">Target Type</h4>
                        <v-btn-toggle 
                            v-model="selectedTargetType" 
                            mandatory
                            variant="outlined"
                            divided
                        >
                            <v-btn 
                                v-for="targetType in targetTypes"
                                :key="targetType.value"
                                :value="targetType.value"
                                @click="selectTargetType(targetType.value)"
                            >
                                <v-icon :icon="targetType.icon" class="mr-1"></v-icon>
                                {{ targetType.label }}
                            </v-btn>
                        </v-btn-toggle>
                        
                        <div class="mt-2">
                            <v-alert 
                                v-if="!hasTargets"
                                type="warning"
                                density="compact"
                                class="mb-2"
                            >
                                No tokens {{ selectedTargetType === 'targeted' ? 'targeted' : 'selected' }}
                            </v-alert>
                            <v-chip 
                                v-else
                                color="success"
                                size="small"
                            >
                                {{ targets.length }} target{{ targets.length !== 1 ? 's' : '' }}
                            </v-chip>
                        </div>
                    </div>

                    <!-- Multiplier Selection -->
                    <div class="multiplier-selection mb-4">
                        <h4 class="mb-2">Damage Multiplier</h4>
                        <v-btn-toggle 
                            v-model="selectedMultiplier" 
                            mandatory
                            variant="outlined"
                            divided
                        >
                            <v-btn 
                                v-for="multiplier in multipliers"
                                :key="multiplier.value"
                                :value="multiplier.value"
                                @click="selectMultiplier(multiplier.value)"
                                size="small"
                            >
                                {{ multiplier.label }}
                            </v-btn>
                        </v-btn-toggle>
                    </div>

                    <!-- Final Damage Display -->
                    <div class="final-damage mb-4">
                        <v-card variant="outlined">
                            <v-card-text class="text-center">
                                <div class="text-h5">
                                    Final Damage: {{ finalDamage }}
                                </div>
                                <div v-if="selectedMultiplier !== 1" class="text-caption">
                                    ({{ props.rollData.value }} × {{ selectedMultiplier }})
                                </div>
                            </v-card-text>
                        </v-card>
                    </div>
                </v-card-text>

                <v-card-actions>
                    <v-btn 
                        color="error"
                        variant="elevated"
                        prepend-icon="mdi-sword"
                        :disabled="!hasTargets"
                        @click="applyDamage('damage')"
                    >
                        Apply Damage
                    </v-btn>
                    
                    <v-btn 
                        color="success"
                        variant="elevated"
                        prepend-icon="mdi-medical-bag"
                        :disabled="!hasTargets"
                        @click="applyHealing"
                    >
                        Apply Healing
                    </v-btn>
                    
                    <v-btn 
                        color="info"
                        variant="elevated"
                        prepend-icon="mdi-heart"
                        :disabled="!hasTargets"
                        @click="applyTemp"
                    >
                        Temp HP
                    </v-btn>
                    
                    <v-spacer></v-spacer>
                    
                    <v-btn 
                        variant="text"
                        @click="closeDialog"
                    >
                        Cancel
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </template>

    <style scoped>
    .damage-type-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 12px;
        background-color: rgba(0, 0, 0, 0.1);
        font-size: 0.875rem;
    }
    
    .damage-metadata {
        margin-top: 8px;
    }
    
    .target-selection, .multiplier-selection {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 4px;
        padding: 12px;
    }
    
    .final-damage {
        margin-top: 16px;
    }
    </style>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}