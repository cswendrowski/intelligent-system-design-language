import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';

export function generateBaseVueComponents(destination: string) {

    generateAttributeComponent(destination);
    generateResourceComponent(destination);
    generateDocumentLinkComponent(destination);
    generateProsemirrorComponent(destination);

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
        <v-container class="d-flex align-center ga-2 pa-2">
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
                <v-icon>{{ isEditing ? 'mdi-check' : 'mdi-pencil' }}</v-icon>
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
        <v-card elevation="16" class="ma-2">
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
                <v-btn :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" @click="expanded = !expanded" color="primary">
                </v-btn>
            </v-card-actions>

            <v-expand-transition>
                <div v-show="expanded">
                    <v-divider></v-divider>
                    <v-card-text>
                        <v-number-input v-model="value" label="Value" :max="max" :disabled="disabled" controlVariant="stacked" density="compact" />
                        <v-number-input v-model="temp" label="Temp" :disabled="disabled" controlVariant="stacked" density="compact" />
                        <v-number-input v-model="max" label="Max" :disabled="disabled" controlVariant="stacked" density="compact" />
                    </v-card-text>
                </div>
            </v-expand-transition>
        </v-card>
    </template>
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
        import { ref, computed } from "vue";

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
    </script>

    <template>
        <v-container class="d-flex align-center ga-2 pa-2">
            <!-- Label -->
            <span class="font-weight-bold">{{ game.i18n.localize(label) }}</span>

            <div v-if="hasLink" class="d-flex">
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
                            <v-list-item key="open" value="Open">
                                <v-list-item-title><v-icon icon="mdi-open-in-app"></v-icon> Open</v-list-item-title>
                            </v-list-item>
                            <v-list-item key="remove" value="Remove">
                                <v-list-item-title><v-icon icon="mdi-selection-remove"></v-icon> Remove</v-list-item-title>
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
            field: Object,
            disabled: Boolean
        });
    </script>

    <template>
        <div class="prose-mirror-wrapper" v-html="disabled ? field.enriched : field.element.outerHTML"></div>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
