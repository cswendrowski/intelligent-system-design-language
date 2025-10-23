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
            primaryColor: String,
            secondaryColor: String,
            max: Number,
            calculator: {
                type: Boolean,
                default: undefined
            }
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

        const isCalculated = computed(() => {
            return props.hasValueParam;
        });

        const controlVariant = computed(() => {
            return isCalculated.value ? 'hidden' : 'stacked';
        });

        const classes = computed(() => {
            return isCalculated.value ? 'calculated-number' : '';
        });

        const showCalculator = computed(() => {
            // Check if calculator was explicitly passed as a prop
            const hasCalculatorProp = props.calculator !== undefined && props.calculator !== false;
            const calculatorExplicitlyFalse = props.calculator === false;

            // If calculator param is explicitly set to true, use it
            if (hasCalculatorProp) {
                return true;
            }

            // If calculator param is explicitly set to false, never show
            if (calculatorExplicitlyFalse) {
                return false;
            }

            // Don't show on calculated fields
            if (isCalculated.value) {
                return false;
            }

            // Show if max > 10
            if (props.max && props.max > 10) {
                return true;
            }

            // When max is undefined, show if current value >= 10 or <= -10
            if (props.max === undefined) {
                const currentValue = value.value;
                if (typeof currentValue === 'number' && (currentValue >= 10 || currentValue <= -10)) {
                    return true;
                }
            }

            return false;
        });
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-number single-wide">
            <v-number-input
                v-if="!isCalculated"
                v-model="value"
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
                <template #append-inner v-if="props.editMode && showCalculator">
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
                :model-value="value"
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