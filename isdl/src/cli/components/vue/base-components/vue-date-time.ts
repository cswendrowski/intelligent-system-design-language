import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateDateTimeComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `date-time.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            type: String,
            systemPath: String,
            context: Object,
            disabled: Boolean
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
    </script>
    <template>
        <v-input v-model="value" class="isdl-datetime">
            <template #default>
                <v-field 
                    class="v-field--active"
                    density="compact"
                    variant="outlined"
                    :disabled="disabled"
                    :label="game.i18n.localize(label)"
                >
                    <input :type="type" :name="systemPath" v-model="value" :disabled="disabled" />
                </v-field>
            </template>
        </v-input>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}