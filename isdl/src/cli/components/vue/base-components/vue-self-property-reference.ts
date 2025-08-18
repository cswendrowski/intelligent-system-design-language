import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateSelfPropertyReferenceComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `self-property-reference.vue`);

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
            disabled: Boolean,
            icon: String,
            color: String,
            propertyType: String,
            choices: Array
        });

        const document = inject("rawDocument");

        // Get the property path stored in this field
        const propertyPath = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath, newValue)
        });


        // Filter choices based on property type if provided
        const availableChoices = computed(() => {
            if (!props.choices || !props.propertyType) return [];
            
            // Filter properties based on type
            return props.choices.filter(choice => {
                // Here we would check if the choice matches the expected property type
                // For now, return all choices - this could be enhanced with type checking
                return true;
            });
        });


        const fieldColor = computed(() => {
            return props.color || 'primary';
        });
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-self-property-reference single-wide">
            <v-autocomplete
                v-model="propertyPath"
                :items="availableChoices"
                :name="props.systemPath"
                :disabled="disabled"
                :color="fieldColor"
                variant="outlined"
                density="compact"
                clearable
            >
                <template #label>
                    <span class="field-label">
                        <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                        {{ game.i18n.localize(props.label) }}
                    </span>
                </template>
            </v-autocomplete>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}