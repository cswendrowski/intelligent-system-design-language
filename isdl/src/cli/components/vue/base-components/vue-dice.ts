import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateDiceComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `dice.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            icon: String,
            systemPath: String,
            context: Object,
            editMode: Boolean,
            disabled: Boolean,
            choices: Array,
            primaryColor: String,
            secondaryColor: String
        });

        const document = inject("rawDocument");

        const getLabel = (label, icon) => {
            const localized = game.i18n.localize(label);
            if (icon) {
                return \`<i class="\${icon}"></i> \${localized}\`;
            }
            return localized;
        };

        const numberValue = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".number") ?? 1,
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".number", newValue)
        });

        const dieValue = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".die") ?? "d6",
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".die", newValue)
        });
    </script>

    <template>
        <v-input 
            class="isdl-dice-field"
            :disabled="disabled"
            hide-details
        >
            
            <template #default>
                <v-field
                    class="v-field--active"
                    variant="outlined"
                    density="compact"
                    :disabled="isDisabled"
                >
                    <template #label>
                        <span v-html="getLabel(label, icon)" />
                    </template>
                    <div class="flexrow align-center inner-content">
                        <v-number-input
                            :name="systemPath + '.number'"
                            v-model="numberValue" 
                            :min="0" 
                            :step="1" 
                            variant="plain" 
                            density="compact"
                            :disabled="disabled"
                            hide-details
                            class="dice-number-input inner-input"
                            style="flex: 1; min-width: 50px; text-align: center; margin-right: 0.5rem;"
                            control-variant="stacked"
                        />
                        
                        <v-select 
                            :name="systemPath + '.die'"
                            v-model="dieValue" 
                            :items="choices" 
                            item-value="value" 
                            item-title="label"
                            :disabled="disabled"
                            variant="plain"
                            density="compact"
                            hide-details
                            class="dice-type-select inner-input"
                            style="flex: 2; min-width: 100px;"
                        >
                            <template #prepend-inner>
                                <i :class="'fa-solid fa-dice-' + dieValue" style="padding-right: 6px;"></i>
                            </template>
                        </v-select>
                    </div>
                </v-field>
            </template>
        </v-input>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}