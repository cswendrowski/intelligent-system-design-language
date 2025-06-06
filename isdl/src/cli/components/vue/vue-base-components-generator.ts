import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';

export function generateBaseVueComponents(destination: string) {

    generateAttributeComponent(destination);
    generateResourceComponent(destination);
    generateDocumentLinkComponent(destination);
    generateProsemirrorComponent(destination);
    generateRollVisualizerComponent(destination);
    generatePaperdollComponent(destination);
    generateCalculator(destination);
    generateDocumentChoiceComponent(destination);
    generateTextFieldComponent(destination);
    generateDateTimeComponent(destination);
    generateTrackerComponent(destination);
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
            disabled: Boolean,
            primaryColor: String,
            secondaryColor: String
        });

        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath, newValue)
        });
    </script>

    <template>
        <v-container :class="['isdl-property', 'attributeExp', { 'no-mod': !hasMod }]">
            <v-label>{{ game.i18n.localize(label) }}</v-label>
            <div class="mod" v-if="hasMod">{{ mod }}</div>
            <v-number-input v-model="value" inset :min="props.min" :disabled="disabled" :name="systemPath" :controlVariant="disabled ? 'hidden' : 'split'" :step="1" type="number" variant="outlined" density="compact" hide-details="true"></v-number-input>
        </v-container>
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
            disabled: Boolean,
            documentName: String,
            secondaryColor: String
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
            const item = fromUuidSync(value.value.uuid);
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
        <v-card class="isdl-single-document single-document" :data-type="documentName" :data-name="systemPath">
            <v-img v-if="image" :src="image" class="align-end" cover style="background-color: lightgray" >
                <template v-slot:error>
                    <v-img src="/icons/vtt-512.png" class="align-end" cover></v-img>
                </template>
            </v-img>
            <v-img v-else src="/icons/containers/boxes/crates-wooden-stacked.webp" class="align-end" cover></v-img>
            <v-card-title>{{ game.i18n.localize(label) }}</v-card-title>
            <v-card-subtitle v-if="hasLink">{{ value.name }}</v-card-subtitle>
            <v-card-text v-else>{{ game.i18n.localize('NoSingleDocument') }}</v-card-text>
            <v-card-actions v-if="hasLink">
                <v-btn :color="secondaryColor" @click="open" icon="fa-solid fa-up-right-from-square" size="small">
                </v-btn>
                <v-spacer></v-spacer>
                <v-btn :color="secondaryColor" @click="remove" icon="fa-solid fa-delete-left" size="small">
                </v-btn>
            </v-card-actions>
        </v-card>
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
            icon: String,
            field: Object,
            disabled: Boolean
        });
    </script>

    <template>
        <div class="isdl-html flexcol">
            <label style="font-weight: bold"><span v-if="icon"><i :class="icon"></i> </span>{{ game.i18n.localize(label) }}</label>
            <div class="prose-mirror-wrapper" v-html="disabled ? field.enriched : field.element.outerHTML"></div>
        </div>
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

function generatePaperdollComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `paperdoll.vue`);

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
            disabled: Boolean,
            slots: Array,
            image: String,
            size: String
        });

        const value = computed(() => {
            return foundry.utils.getProperty(props.context, props.systemPath);
        });

        const slotValue = (systemPath) => {
            return foundry.utils.getProperty(props.context, systemPath);
        };

        const openSlot = (slot) => {
            const item = slotValue(slot.systemPath);
            if (item) {
                const fromUuid = fromUuidSync(item.uuid);
                fromUuid.sheet.render(true);
            }
        };
    </script>

    <template>
        <v-card class="isdl-paperdoll">
            <v-card-title>{{ game.i18n.localize(label) }}</v-card-title>
            <v-card-text>
                <div class="paper-doll-container" :data-name="systemPath" :style="{ backgroundImage: 'url(' + image + ')' }">
                    <div class="paper-doll-slot" v-for="slot in slots" :key="slot.name" :data-name="slot.systemPath" @click="openSlot(slot)" :data-tooltip="slot.name" :data-type="slot.type" :style="{ left: slot.left, top: slot.top, width: size, height: size }">
                        <img :src="slotValue(slot.systemPath)?.img" :data-tooltip="slotValue(slot.systemPath)?.name" />
                    </div>
                </div>
            </v-card-text>
        </v-card>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateCalculator(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `calculator.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            systemPath: String,
            context: Object,
            primaryColor: String,
            secondaryColor: String
        });

        const document = inject("rawDocument");

        const open = ref(false);
        const value = ref(0);
        const mode = ref("add");
        const btn = ref(null);

        const toggleCalculator = () => {
            open.value = !open.value;
        };

        const swapMode = (modeName) => {
            mode.value = modeName;
            console.log("Swapping mode to", modeName);
        };

        const isActive = (modeName) => {
            return mode.value === modeName ? "active" : "";
        };

        const submit = () => {
            const update = {};
            const currentValue = foundry.utils.getProperty(document, props.systemPath);
            let updateValue = value.value;
            if (mode.value === "add") {
                updateValue = currentValue + value.value;
            } else if (mode.value === "subtract") {
                updateValue = currentValue - value.value;
            } else if (mode.value === "multiply") {
                updateValue = currentValue * value.value;
            } else if (mode.value === "divide") {
                updateValue = currentValue / value.value;
            }
            if (isNaN(updateValue)) {
                console.error("Invalid value", updateValue);
                updateValue = 0;
            }
            update[props.systemPath] = updateValue;
            document.update(update);
            open.value = false;
        };
    </script>

    <template>
        <div>
            <v-icon icon="fa-solid fa-calculator" @click="toggleCalculator">  
            </v-icon>
            <v-dialog v-model="open" max-width="340">
                <template v-slot:default="{ open }">
                <v-card title="Calculator">
                    <v-card-text>
                        <v-number-input
                            v-model="value"
                            label="Value" 
                            controlVariant="stacked"
                            density="compact"
                            variant="outlined"
                        ></v-number-input>
                        <v-btn-toggle v-model="mode" class="flexrow" mandatory divided>
                            <v-btn value="add" data-tooltip="Add" :color="primaryColor">
                                <v-icon icon="fa-solid fa-plus"></v-icon>
                            </v-btn>
                            <v-btn value="subtract" data-tooltip="Subtract" :color="primaryColor">
                                <v-icon icon="fa-solid fa-minus"></v-icon>
                            </v-btn>
                            <v-btn value="multiply" data-tooltip="Multiply" :color="primaryColor">
                                <v-icon icon="fa-solid fa-times"></v-icon>
                            </v-btn>
                            <v-btn value="divide" data-tooltip="Divide" :color="primaryColor">
                                <v-icon icon="fa-solid fa-divide"></v-icon>
                            </v-btn>
                        </v-btn-toggle>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn text="Submit" @click="submit" prepend-icon="fa-solid fa-check" :color="primaryColor"></v-btn>
                        <v-btn text="Cancel" @click="toggleCalculator" prepend-icon="fa-solid fa-xmark" :color="secondaryColor"></v-btn>
                    </v-card-actions>
                </v-card>
                </template>
            </v-dialog>
        </div>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateDocumentChoiceComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `document-choice.vue`);

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
            disabled: Boolean,
            multiple: Boolean,
            documentName: String
        });

        const value = computed(() => {
            return foundry.utils.getProperty(props.context, props.systemPath);
        });

        const choices

        const hasLink = computed(() => {
            return !!value.value;
        });

        const document = inject("rawDocument");

        const open = () => {
            const item = fromUuidSync(value.value.uuid);
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
        </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateTextFieldComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `text-field.vue`);

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
            disabled: Boolean,
            editMode: Boolean,
            icon: String,
            color: String
        });

        const value = ref(foundry.utils.getProperty(props.context, props.systemPath));
        const document = inject("rawDocument");

        const debouncedPersist = foundry.utils.debounce((newValue) => {
            const update = {};
            value.value = newValue;
            update[props.systemPath] = newValue;
            document.update(update);
        }, 150);

        const update = (newValue) => {
            value.value = newValue;
            debouncedPersist(newValue);
        };

        const getLabel = computed(() => {
            const localized = game.i18n.localize(props.label);
            if (props.icon) {
                return \`<i class="fa-solid \${props.icon}"></i> \${localized}\`;
            }
            return localized;
        });
    </script>
    <template>
        <v-text-field
            v-model="value"
            :disabled="disabled"
            :dense="true"
            density="compact"
            variant="outlined"
            @update:modelValue="update"
            :data-tooltip="value"
            :color="color"
        >
            <template #label>
                <span v-html="getLabel" />
            </template>    
        </v-text-field>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateDateTimeComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `date-time.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            type: String,
            systemPath: String,
            context: Object,
            disabled: Boolean
        });

        const value = ref(foundry.utils.getProperty(props.context, props.systemPath));
        const document = inject("rawDocument");

        const debouncedPersist = foundry.utils.debounce((newValue) => {
            const update = {};
            value.value = newValue;
            update[props.systemPath] = newValue;
            document.update(update);
        }, 150);

        const update = (newValue) => {
            value.value = newValue;
            debouncedPersist(newValue);
        };
    </script>
    <template>
        <v-input v-model="value" class="isdl-datetime">
            <template #default>
                <v-field 
                    class="v-field--active"
                    density="compact"
                    variant="outlined"
                    :disabled="disabled"
                    :label="game.i18n.localize(label)"
                >
                    <input :type="type" :name="systemPath" v-model="value" :disabled="disabled" />
                </v-field>
            </template>
        </v-input>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateTrackerComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `tracker.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject, watchEffect } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            visibility: String,
            editMode: Boolean,
            primaryColor: String,
            secondaryColor: String,
            tertiaryColor: String,
            trackerStyle: String,
            icon: String,
            disableMin: Boolean,
            disableValue: Boolean,
            disableMax: Boolean,
            segments: Number
        });

        const document = inject("rawDocument");
        const visibility = ref('default');

        watchEffect(async () => {
            visibility.value = await props.visibility;
        })

        const isHidden = computed(() => {
            if (visibility.value === "hidden") {
                return true;
            }
            if (visibility.value === "gmOnly") {
                return !game.user.isGM;
            }
            if (visibility.value === "secret") {
                const isGm = game.user.isGM;
                const isOwner = document.getUserLevel(game.user) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
                return !isGm && !isOwner;
            }
            if (visibility.value === "edit") {
                return !props.editMode;
            }

            // Default to visible
            return false;
        });

        const isDisabled = (type) => {
            const disabledStates = ["readonly", "locked"];
            if (disabledStates.includes(visibility.value)) {
                return true;
            }
            if (visibility.value === "gmEdit") {
                const isGm = game.user.isGM;
                const isEditMode = props.editMode;
                return !isGm && !isEditMode;
            }

            if (visibility.value === "unlocked") {
                return false;
            }
            
            // Default to enabled while in editMode
            if (type == "value") return false;
            return !props.editMode;
        };

        const min = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".min"),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".min", newValue)
        });

        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".value"),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".value", newValue)
        });

        const temp = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".temp"),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".temp", newValue)
        });

        const max = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".max"),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".max", newValue)
        });

        const barMax = computed(() => {
            const totalValue = value.value + temp.value;
            if (totalValue > max.value) {
                return totalValue;
            }
            return max.value;
        });

        const circleValue = computed(() => {
            // We need to calculate the percentage of the value in relation to the min to max range
            const percentage = (value.value - min.value) / (max.value - min.value);
            return Math.round(percentage * 100);
        });

        const refill = () => value.value = max.value;
        const empty = () => value.value = 0;

        const filledIcon = computed(() => {
            if (!props.icon) return "fa-solid fa-star";
            return "fa-solid " + props.icon;
        });
        const emptyIcon = computed(() => {
            if (!props.icon) return "fa-regular fa-star";
            return "fa-regular " + props.icon;
        });

        const expanded = ref(false);

        const expandIcon = computed(() => {
            return expanded.value ? "fa-solid fa-caret-up" : "fa-solid fa-caret-down";
        });

        const displayText = computed(() => {
            return value.value + " / " + max.value;
        });

        const add = () => {
            if (props.disableValue || isDisabled('value')) return;
            if (value.value < max.value) {
                value.value++;
            }
        }

        const remove = () => {
            if (props.disableValue || isDisabled('value')) return;
            if (value.value > min.value) {
                value.value--;
            }
        }

        const getSegmentFill = (segmentIndex) => {
            const filled = value.value;
            const tempFilled = filled + (temp?.value ?? 0);
            const segmentStart = (segmentIndex - 1) * props.segments;
            const segmentEnd = segmentIndex * props.segments;

            const primaryFill = Math.min(Math.max(filled - segmentStart, 0), props.segments);
            const tempFill = Math.min(Math.max(tempFilled - segmentStart, 0), props.segments);

            const primaryPct = (primaryFill / props.segments) * 100;
            const tempPct = (tempFill / props.segments) * 100;

            const fill = \`linear-gradient(
                to right,
                \${props.primaryColor} 0%,
                \${props.primaryColor} \${primaryPct}%,
                \${props.tertiaryColor} \${primaryPct}%,
                \${props.tertiaryColor} \${tempPct}%,
                transparent \${tempPct}%
            )\`;

            const segmentLines = \`repeating-linear-gradient(
                to right,
                \${props.secondaryColor} 0,
                \${props.secondaryColor} 1px,
                transparent 1px,
                transparent calc(100% / \${props.segments})
            )\`;

            return \`\${segmentLines}, \${fill}\`;
        };

        const size = 100;
        const radius = size / 2 - 2;

        function describeSlice(index, total, r, center) {
            const anglePer = (2 * Math.PI) / total;
            const startAngle = anglePer * index - Math.PI / 2;
            const endAngle = startAngle + anglePer;

            const x1 = center + r * Math.cos(startAngle);
            const y1 = center + r * Math.sin(startAngle);
            const x2 = center + r * Math.cos(endAngle);
            const y2 = center + r * Math.sin(endAngle);

            const largeArcFlag = anglePer > Math.PI ? 1 : 0;

            return \`
                M \${center} \${center}
                L \${x1} \${y1}
                A \${r} \${r} 0 \${largeArcFlag} 1 \${x2} \${y2}
                Z
            \`;
        }

        const getLabel = computed(() => {
            const localized = game.i18n.localize(props.label);
            if (props.icon) {
                return \`<i class="fa-solid \${props.icon}"></i> \${localized}\`;
            }
            return localized;
        });
    </script>

    <template>
        <v-input v-model="value" :class="[trackerStyle, 'isdl-tracker']" v-if="!isHidden">
            <template #default>
                <v-field 
                    class="v-field--active"
                    density="compact"
                    variant="outlined"
                    :disabled="disabled"
                >
                    <template #label>
                        <span v-html="getLabel" />
                    </template>
                      <template #append-inner>
                        <v-icon
                            :icon="expandIcon"
                            @click.stop="expanded = !expanded"
                            class="v-select__menu-icon"
                        />
                    </template>
                    <div class="tracker-content flexcol">
                        <div class="d-flex tracker-inner-content">
                            <v-progress-linear
                                v-if="trackerStyle == 'bar'"
                                :height="18"
                                :color="primaryColor"
                                bg-color="#92aed9"
                                rounded
                                :model-value="value"
                                min="0"
                                :max="barMax"
                                :buffer-value="value + temp"
                                buffer-opacity="1"
                                :buffer-color="tertiaryColor"
                            >
                                <template v-slot:default>
                                    {{ displayText }}
                                </template>
                            </v-progress-linear>

                            <v-progress-circular 
                                v-if="trackerStyle == 'dial'"
                                :model-value="circleValue" 
                                :rotate="360" 
                                :size="100" 
                                :width="15" 
                                :color="primaryColor">
                                <template v-slot:default> {{ displayText }} </template>
                            </v-progress-circular>

                            <div v-if="trackerStyle == 'icons'" class="d-flex flex-row" @click.stop="add" @contextmenu.prevent.stop="remove" style="overflow-x: scroll;">
                                <v-icon v-for="i in value" :key="i" :icon="filledIcon" :color="primaryColor" style="margin-right: 0.25rem; width: 25px;" :data-tooltip="displayText" />
                                <v-icon v-for="i in temp" :key="i + value" :icon="filledIcon" :color="tertiaryColor" style="margin-right: 0.25rem; width: 25px;" :data-tooltip="displayText" />
                                <v-icon v-for="i in max - value" :key="i + temp + value" :icon="emptyIcon" :color="secondaryColor" style="margin-right: 0.25rem; width: 25px;" :data-tooltip="displayText" />
                            </div>

                            <div v-if="trackerStyle == 'slashes'" class="d-flex flex-row" @click.stop="add" @contextmenu.prevent.stop="remove" style="overflow-x: scroll; padding-left: 0.5rem; padding-right: 0.5rem;">
                                <div
                                    v-for="i in max"
                                    :data-tooltip="displayText"
                                    :key="i"
                                    :style="{
                                        flex: 1,
                                        minWidth: '5px',
                                        flexShrink: 0,
                                        height: '30px',
                                        backgroundColor: i <= value ? primaryColor : (i <= value + temp ? tertiaryColor : 'transparent'),
                                        border: i <= value ? 'none' : '2px solid ' + secondaryColor,
                                        transform: 'skewX(-20deg)',
                                        borderRadius: '2px',
                                        marginRight: '0.25rem'
                                    }"
                                />
                            </div>

                            <div v-if="trackerStyle == 'segmented'" class="d-flex flex-row" @click.stop="add" @contextmenu.prevent.stop="remove">
                                <div
                                    v-for="i in Math.ceil(max / segments)"
                                    :key="i"
                                    :data-tooltip="displayText"
                                    :style="{
                                        flex: 1,
                                        minWidth: '15px',
                                        flexShrink: 0,
                                        height: '30px',
                                        border: '2px solid ' + secondaryColor,
                                        borderRadius: '2px',
                                        marginRight: '0.25rem',
                                        background: getSegmentFill(i)
                                    }"
                                />
                            </div>

                            <svg
                                v-if="trackerStyle === 'clock'"
                                :width="size"
                                :height="size"
                                :viewBox="\`0 0 \${size} \${size}\`"
                                @click.stop="add"
                                @contextmenu.prevent.stop="remove"
                                :data-tooltip="displayText"
                                style="width: auto;"
                                >
                                <g v-for="i in max" :key="i">
                                    <path
                                        :d="describeSlice(i - 1, max, radius, size / 2)"
                                        :fill="i <= value ? primaryColor : (i <= value + temp ? tertiaryColor: 'transparent')"
                                        :stroke="secondaryColor"
                                        stroke-width="2"
                                    />
                                </g>
                            </svg>
                        </div>
                        <v-expand-transition>
                            <div v-show="expanded" style="margin-top: 1rem;">
                                <div class="d-flex flex-row">
                                    <v-number-input
                                        v-model="value"
                                        :name="systemPath + '.value'"
                                        label="Value"
                                        controlVariant="stacked"
                                        density="compact"
                                        variant="outlined"
                                        class="flex-grow-1 slim-number"
                                        style="min-width: 70px;"
                                        hide-details="true"
                                        tile="true"
                                        :disabled="isDisabled('value') || disableValue"
                                    />
                                    <v-number-input
                                        v-model="temp"
                                        :name="systemPath + '.temp'"
                                        label="Temp"
                                        controlVariant="stacked"
                                        density="compact"
                                        variant="outlined"
                                        class="flex-grow-1"
                                        style="min-width: 70px; margin-right: 0.5rem;"
                                        hide-details="true"
                                        tile="true"
                                        :disabled="isDisabled('value') || disableValue"
                                    />
                                    <v-btn size="small" icon="fa-solid fa-battery-empty" @click="empty" :disabled="isDisabled || disableValue" data-tooltip="Empty" :color="secondaryColor" />
                                </div>
                                <div class="d-flex flex-row" style="margin-top: 1rem;">
                                    <v-number-input
                                        v-model="min"
                                        :name="systemPath + '.min'"
                                        label="Min"
                                        controlVariant="stacked"
                                        density="compact"
                                        variant="outlined"
                                        class="flex-grow-1 slim-number"
                                        style="min-width: 70px;"
                                        hide-details="true"
                                        tile="true"
                                        :disabled="isDisabled('min') || disableMin"
                                    />
                                    <v-number-input
                                        v-model="max"
                                        :name="systemPath + '.max'"
                                        label="Max"
                                        controlVariant="stacked"
                                        density="compact"
                                        variant="outlined"
                                        class="flex-grow-1"
                                        style="min-width: 70px; margin-right: 0.5rem;"
                                        hide-details="true"
                                        tile="true"
                                        :disabled="isDisabled('max') || disableMax"
                                    />
                                    <v-btn size="small" icon="fa-solid fa-battery-full" @click="refill" :disabled="isDisabled('value') || disableValue" data-tooltip="Refill" :color="secondaryColor" />
                                </div>
                            </div>
                        </v-expand-transition>
                    </div>
                </v-field>
            </template>
        </v-input>
    </template>
    `;
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
