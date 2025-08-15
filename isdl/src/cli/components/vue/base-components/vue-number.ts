import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateNumberComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `number.vue`);

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
            hasValueParam: Boolean,
            methodValue: String,
            primaryColor: String,
            secondaryColor: String
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
            return props.disabled || 
                   props.visibility === "locked" || 
                   props.visibility === "readonly" || 
                   (props.visibility === "gmOnly" && !game.user.isGM);
        });

        const fieldColor = computed(() => {
            return props.color || 'primary';
        });

        const isCalculated = computed(() => {
            return props.hasValueParam;
        });

        const controlVariant = computed(() => {
            return isCalculated.value ? 'hidden' : 'stacked';
        });

        const classes = computed(() => {
            return isCalculated.value ? 'calculated-number' : '';
        });
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-number single-wide">
            <v-number-input
                v-if="!isCalculated"
                v-model="props.context[props.systemPath]"
                :name="props.systemPath"
                :disabled="isDisabled"
                :color="fieldColor"
                controlVariant="stacked"
                density="compact"
                variant="outlined"
            >
                <template #label>
                    <span class="field-label">
                        <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                        {{ game.i18n.localize(props.label) }}
                    </span>
                </template>
                <template #append-inner v-if="props.editMode">
                    <i-calculator 
                        :context="props.context" 
                        :systemPath="props.systemPath" 
                        :primaryColor="props.primaryColor" 
                        :secondaryColor="props.secondaryColor">
                    </i-calculator>
                </template>
            </v-number-input>

            <v-number-input
                v-else
                :model-value="props.context[props.systemPath]"
                :name="props.systemPath"
                :disabled="isDisabled"
                :color="fieldColor"
                controlVariant="hidden"
                density="compact"
                variant="outlined"
                append-inner-icon="fa-solid fa-function"
                class="calculated-number single-wide"
            >
                <template #label>
                    <span class="field-label">
                        <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                        {{ game.i18n.localize(props.label) }}
                    </span>
                </template>
            </v-number-input>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}