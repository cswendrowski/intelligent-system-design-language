import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateResourceComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `resource.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            disabled: Boolean,
            primaryColor: String,
            secondaryColor: String
        });

        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".value"),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".value", newValue)
        });

        const max = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".max"),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".max", newValue)
        });

        const temp = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".temp"),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".temp", newValue)
        });

        const barMax = computed(() => {
            const totalValue = value.value + temp.value;
            if (totalValue > max.value) {
                return totalValue;
            }
            return max.value;
        });

        const expanded = ref(false);
    </script>

    <template>
        <v-card elevation="4" class="ml-1 mr-1 resource-card" variant="outlined">
            <v-card-title>
                {{ game.i18n.localize(label) }}
            </v-card-title>

            <v-card-actions>
                <v-progress-linear
                    :height="18"
                    :color="primaryColor"
                    bg-color="#92aed9"
                    rounded
                    :model-value="value"
                    min="0"
                    :max="barMax"
                    :buffer-value="value + temp"
                    buffer-opacity="1"
                    :buffer-color="secondaryColor"
                    :data-tooltip="\`Value: \${value} / Temp: \${temp} / Max: \${max}\`"
                    style="font-weight: bold;"
                >
                    <template v-slot:default>
                        {{ value }} / {{ max }}
                    </template>
                </v-progress-linear>
                <v-spacer></v-spacer>
                <v-btn :icon="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" @click="expanded = !expanded" color="primary">
                </v-btn>
            </v-card-actions>

            <v-expand-transition>
                <div v-show="expanded">
                    <v-card-text>
                        <div class="d-flex flex-row">
                            <v-number-input
                                v-model="value"
                                :name="systemPath + '.value'"
                                label="Value"
                                controlVariant="stacked"
                                density="compact"
                                variant="outlined"
                                class="flex-grow-1"
                                style="min-width: 100px;"
                                hide-details="true"
                            />
                            <v-number-input
                                v-model="temp"
                                :name="systemPath + '.temp'"
                                label="Temp"
                                controlVariant="stacked"
                                density="compact"
                                variant="outlined"
                                class="flex-grow-1"
                                style="min-width: 100px;"
                                hide-details="true"
                            />
                            <v-number-input
                                v-model="max"
                                :name="systemPath + '.max'"
                                label="Max"
                                :disabled="disabled"
                                controlVariant="stacked"
                                density="compact"
                                variant="outlined"
                                class="flex-grow-1"
                                style="min-width: 100px;"
                                hide-details="true"
                            />
                        </div>
                    </v-card-text>
                </div>
            </v-expand-transition>
        </v-card>
    </template>

    <style>
        .resource-card {
            min-width: 300px;
        }
    </style>
    `;
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}