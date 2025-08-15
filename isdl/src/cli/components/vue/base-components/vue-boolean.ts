import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateBooleanComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `boolean.vue`);

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
            disabled: Boolean
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

        const checkboxColor = computed(() => {
            return props.color || 'primary';
        });
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-boolean single-wide">
            <v-checkbox
                v-model="props.context[props.systemPath]"
                :name="props.systemPath"
                :disabled="isDisabled"
                :color="checkboxColor"
                density="compact"
                class="single-wide"
                variant="outlined"
            >
                <template #label>
                    <span class="field-label">
                        <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                        {{ game.i18n.localize(props.label) }}
                    </span>
                </template>
            </v-checkbox>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}