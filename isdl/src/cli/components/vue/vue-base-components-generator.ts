import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';

export function generateBaseVueComponents(destination: string) {

    generateAttributeComponent(destination);
    generateResourceComponent(destination);
    generateDocumentLinkComponent(destination);
    generateProsemirrorComponent(destination);
    generateRollVisualizerComponent(destination);

}

function generateAttributeComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `attribute.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed } from "vue";

        const props = defineProps({
            label: String,
            hasMod: Boolean,
            mod: Number,
            systemPath: String,
            context: Object,
            min: Number,
            disabled: Boolean
        });

        const isEditing = ref(false);

        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath, newValue)
        });
        
        const chipContent = computed(() => {
            if (props.hasMod) {
                return props.mod;
            }
            return value.value;
        });
    </script>

    <template>
        <v-container class="d-flex align-center ga-2 pa-2 isdl-property">
            <!-- Label -->
            <span class="font-weight-bold">{{ game.i18n.localize(label) }}</span>

            <!-- Modifier / Value Chip (Hidden when editing) -->
            <v-chip v-if="!isEditing" class="mod" color="secondary" data-tooltip="Value">
                {{ value }}
            </v-chip>

            <v-chip v-if="hasMod" class="mod" color="primary" data-tooltip="Mod">
                {{ mod }}
            </v-chip>

            <!-- Edit Button (Toggles between edit and save) -->
            <v-btn icon size="small" @click="isEditing = !isEditing" color="secondary">
                <v-icon>{{ isEditing ? 'fa-solid fa-check' : 'fa-solid fa-pencil' }}</v-icon>
            </v-btn>
        </v-container>

        <!-- Inline Number Input (Only visible when editing) -->
        <v-number-input
            v-if="isEditing"
            v-model="value"
            name="systemPath"
            controlVariant="stacked"
            :step="1"
            :min="min"
            :disabled="disabled"
            type="number"
            variant="outlined"
            class="inline-input"
            :name="systemPath"
        />
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateResourceComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `resource.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            disabled: Boolean
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
        <v-card elevation="16" class="ma-2 resource-card" variant="outlined">
            <v-card-title>
                {{ game.i18n.localize(label) }}
            </v-card-title>

            <v-card-actions>
             <v-progress-linear
                    :height="12"
                    color="primary"
                    bg-color="#92aed9"
                    rounded
                    :model-value="value"
                    min="0"
                    :max="barMax"
                    :buffer-value="value + temp"
                    buffer-opacity="1"
                    buffer-color="secondary"
                    :data-tooltip="\`Value: \${value} / Temp: \${temp} / Max: \${max}\`"
                >
                </v-progress-linear>
                <v-spacer></v-spacer>
                <v-btn :icon="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" @click="expanded = !expanded" color="primary">
                </v-btn>
            </v-card-actions>

            <v-expand-transition>
                <div v-show="expanded">
                    <v-divider></v-divider>
                    <v-card-text>
                        <v-number-input v-model="value" :name="systemPath + '.value'" label="Value" :max="max" :disabled="disabled" controlVariant="stacked" density="compact" />
                        <v-number-input v-model="temp" :name="systemPath + '.temp'" label="Temp" :disabled="disabled" controlVariant="stacked" density="compact" />
                        <v-number-input v-model="max" :name="systemPath + '.max'" label="Max" :disabled="disabled" controlVariant="stacked" density="compact" />
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

function generateDocumentLinkComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `document-link.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            disabled: Boolean
        });

        const value = computed(() => {
            return foundry.utils.getProperty(props.context, props.systemPath);
        });

        const image = computed(() => {
            return value.value ? value.value.img : null;
        });

        const hasLink = computed(() => {
            return !!value.value;
        });

        const document = inject("rawDocument");

        const open = () => {
            const item = document.items.get(value.value._id);
            item.sheet.render(true);
        };

        const remove = async () => {
            const update = {};
            value.value = null;
            update[props.systemPath] = null;
            await document.update(update);
        };
    </script>

    <template>
        <v-container class="d-flex align-center ga-2 pa-2 isdl-single-document">
            <!-- Label -->
            <span class="font-weight-bold">{{ game.i18n.localize(label) }}</span>

            <div v-if="hasLink" class="d-flex" style="flex: 2; padding-right: 2rem;">
                <!-- Image -->
                <v-img v-if="image" :src="image" class="avatar" width="36" height="36" style="background-color: lightgray" >
                    <template #error>
                        <v-img src="/icons/vtt-512.png" class="avatar" width="36" height="36"></v-img>
                    </template>
                </v-img>

                <!-- Document Link -->
                <v-btn color="secondary">
                    {{ value.name }}

                    <v-menu activator="parent">
                        <v-list>
                            <v-list-item key="open" value="Open" @click="open">
                                <v-list-item-title><v-icon icon="fa-solid fa-up-right-from-square"></v-icon> Open</v-list-item-title>
                            </v-list-item>
                            <v-list-item key="remove" value="Remove" @click="remove">
                                <v-list-item-title><v-icon icon="fa-solid fa-delete-right"></v-icon> Remove</v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </v-btn>
            </div>
            <p v-else class="single-document-none">{{ game.i18n.localize('NoSingleDocument') }}</p>
        </v-container>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateProsemirrorComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `prosemirror.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed } from "vue";

        const props = defineProps({
            label: String,
            field: Object,
            disabled: Boolean
        });
    </script>

    <template>
        <label>{{ label }}</label>
        <div class="prose-mirror-wrapper" v-html="disabled ? field.enriched : field.element.outerHTML"></div>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateRollVisualizerComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `roll-visualizer.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, watch } from "vue";

        const props = defineProps({});

        const resultText = ref("Not Evaluated");
        const roll = ref("2d20 + d6 + 5");

        let estimated = true;

        const iterations = ref(1000);
        const labels = ref([]);
        const values = ref([]);
        const min = ref(0);
        const max = ref(0);

        const countAndSplitNumbers = (arr) => {
            // Count occurrences
            const countMap = arr.reduce((acc, num) => {
                acc[num] = (acc[num] || 0) + 1;
                return acc;
            }, {});

            // Sort and split into two arrays
            const sortedEntries = Object.entries(countMap).sort(([a], [b]) => a - b);
            const labels = sortedEntries.map(([num]) => Number(num));
            const values = sortedEntries.map(([, count]) => count);

            return { labels, values };
        }

        watch(roll, async () => {

            if (!Roll.validate(roll.value)) {
                return;
            }

            // Whenever the roll changes, we need to re-calculate the value. First we do a quick simulation, then we do a more accurate one and reload the results
            let result = await Roll.simulate(roll.value, 1000);
            let counted = countAndSplitNumbers(result);
            iterations.value = 1000;

            // If there are more than 20 labels, only show every other label
            if (counted.labels.length > 20) {
                counted.labels = counted.labels.filter((_, i) => i % 2 === 0);
                counted.values = counted.values.filter((_, i) => i % 2 === 0);
            }

            labels.value = counted.labels;
            values.value = counted.values;
            min.value = Math.min(...counted.labels);
            max.value = Math.max(...counted.labels);

            setTimeout(async () => {
                Roll.simulate(roll.value, 10000).then(result2 => {
                    let counted2 = countAndSplitNumbers(result2);
                    iterations.value = 10000;

                    // If there are more than 20 labels, only show every other label
                    if (counted2.labels.length > 20) {
                        counted2.labels = counted.labels.filter((_, i) => i % 2 === 0);
                        counted2.values = counted.values.filter((_, i) => i % 2 === 0);
                    }

                    labels.value = counted2.labels;
                    values.value = counted2.values;
                });
            }, 0);
        });


    </script>

    <template>
        <v-card class="mt-8 mx-auto overflow-visible" style="min-width: 600px;">
            <v-sheet
            class="v-sheet--offset mx-auto"
            color="cyan"
            elevation="12"
            max-width="calc(100% - 32px)"
            rounded="lg"
            >
                <v-sparkline
                    :labels="labels"
                    :model-value="values"
                    color="white"
                    line-width="2"
                    padding="16"
                    smooth="8"
                    label-size="6"
                ></v-sparkline>
            </v-sheet>

            <v-card-text class="pt-0">
                <div class="text-h6 font-weight-light mb-2">
                <v-text-field v-model="roll"></v-text-field>    
                </div>
                <div class="subheading font-weight-light text-grey" v-if="values.length > 0">
                    Min: {{min}} Max: {{max}}
                </div>
                <v-divider class="my-2"></v-divider>
                <span class="text-caption text-grey font-weight-light">
                    Approximate results based on {{iterations}} simulations
                </span>
            </v-card-text>
        </v-card>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
