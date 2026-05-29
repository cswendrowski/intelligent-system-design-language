import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateDieComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `die.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject, watch } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            visibility: String,
            disabled: Boolean,
            icon: String,
            color: String,
            none: {
                type: Boolean,
                default: false
            },
            choices: {
                type: Array,
                default: () => ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
            }
        });

        const document = inject("rawDocument");

        const selectColor = computed(() => {
            return props.color || 'primary';
        });

        const allChoices = computed(() => {
            return props.none ? ['none', ...props.choices] : props.choices;
        });

        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath, newValue)
        });

        watch(value, (newVal) => {
            if (document) document.update({ [props.systemPath]: newVal });
        });

        const dieIcon = computed(() => {
            const currentValue = value.value;
            if (!currentValue || currentValue === 'none') return 'fa-solid fa-ban';
            if (currentValue.startsWith('d')) {
                return \`fa-solid fa-dice-\${currentValue}\`;
            }
            return 'fa-solid fa-dice';
        });
    </script>

    <template>
        <v-select
            v-model="value"
            :name="props.systemPath"
            :items="allChoices"
            :disabled="disabled"
            :color="selectColor"
            density="compact"
            variant="outlined"
            class="isdl-die single-wide"
        >
            <template #label>
                <span class="field-label">
                    <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                    {{ game.i18n.localize(props.label) }}
                </span>
            </template>
            <template #prepend-inner>
                <v-icon :icon="dieIcon" size="small"></v-icon>
            </template>
        </v-select>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}