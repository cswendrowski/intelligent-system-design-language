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
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            visibility: String,
            disabled: Boolean,
            icon: String,
            color: String,
            choices: {
                type: Array,
                default: () => ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
            }
        });

        const document = inject("rawDocument");

        const selectColor = computed(() => {
            return props.color || 'primary';
        });

        const dieIcon = computed(() => {
            const currentValue = props.context[props.systemPath];
            if (currentValue && currentValue.startsWith('d')) {
                return \`fa-solid fa-dice-\${currentValue}\`;
            }
            return 'fa-solid fa-dice';
        });
    </script>

    <template>
        <v-select 
            :model-value="props.context[props.systemPath]"
            @update:model-value="props.context[props.systemPath] = $event"
            :name="props.systemPath"
            :items="props.choices"
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