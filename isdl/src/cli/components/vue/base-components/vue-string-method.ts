import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateStringMethodComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `string-method.vue`);

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
            methodValue: String
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
            return props.visibility === "locked" || 
                   props.visibility === "readonly" || 
                   (props.visibility === "gmOnly" && !game.user.isGM);
        });

        const fieldColor = computed(() => {
            return props.color || 'primary';
        });

        const tooltipText = computed(() => {
            return props.context[props.systemPath] || props.methodValue || '';
        });
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-string-method single-wide">
            <v-text-field 
                :model-value="props.context[props.systemPath]"
                @update:model-value="props.context[props.systemPath] = $event"
                :name="props.systemPath"
                :disabled="isDisabled"
                :color="fieldColor"
                variant="outlined"
                density="compact"
                append-inner-icon="fa-solid fa-function"
                :data-tooltip="tooltipText"
            >
                <template #label>
                    <span class="field-label">
                        <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                        {{ game.i18n.localize(props.label) }}
                    </span>
                </template>
            </v-text-field>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}