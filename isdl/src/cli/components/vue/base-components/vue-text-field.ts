import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateTextFieldComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `text-field.vue`);

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