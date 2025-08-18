import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateStringChoiceComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `string-choice.vue`);

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
            items: {
                type: Array,
                default: () => []
            },
            isExtended: {
                type: Boolean,
                default: false
            },
            primaryColor: String,
            secondaryColor: String
        });

        const document = inject("rawDocument");

        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath, newValue)
        });

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
                   props.visibility === "locked" || 
                   props.visibility === "readonly" || 
                   (props.visibility === "gmOnly" && !game.user.isGM);
        });

        const fieldColor = computed(() => {
            return props.color || 'primary';
        });

        const localizedLabel = computed(() => {
            return game.i18n.localize(props.label);
        });
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-string-choice single-wide">
            <!-- Simple choice field - uses v-select -->
            <v-select 
                v-if="!props.isExtended"
                v-model="value"
                :name="props.systemPath"
                :items="props.items"
                item-title="label"
                item-value="value"
                :disabled="isDisabled"
                :color="fieldColor"
                variant="outlined"
                density="compact"
            >
                <template #label>
                    <span class="field-label">
                        <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                        {{ localizedLabel }}
                    </span>
                </template>
            </v-select>

            <!-- Extended choice field - uses i-extended-choice -->
            <i-extended-choice
                v-else
                :label="props.label"
                :icon="props.icon"
                :systemPath="props.systemPath"
                :context="props.context"
                :items="props.items"
                :primaryColor="props.primaryColor"
                :secondaryColor="props.secondaryColor"
                :visibility="props.visibility"
                :disabled="props.disabled"
                :color="props.color">
            </i-extended-choice>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}