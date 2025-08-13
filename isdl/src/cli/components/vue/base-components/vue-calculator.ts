import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateCalculator(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `calculator.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            systemPath: String,
            context: Object,
            primaryColor: String,
            secondaryColor: String
        });

        const document = inject("rawDocument");

        const open = ref(false);
        const value = ref(0);
        const mode = ref("add");
        const btn = ref(null);

        const toggleCalculator = () => {
            open.value = !open.value;
        };

        const swapMode = (modeName) => {
            mode.value = modeName;
            console.log("Swapping mode to", modeName);
        };

        const isActive = (modeName) => {
            return mode.value === modeName ? "active" : "";
        };

        const submit = () => {
            const update = {};
            const currentValue = foundry.utils.getProperty(document, props.systemPath);
            let updateValue = value.value;
            if (mode.value === "add") {
                updateValue = currentValue + value.value;
            } else if (mode.value === "subtract") {
                updateValue = currentValue - value.value;
            } else if (mode.value === "multiply") {
                updateValue = currentValue * value.value;
            } else if (mode.value === "divide") {
                updateValue = currentValue / value.value;
            }
            if (isNaN(updateValue)) {
                console.error("Invalid value", updateValue);
                updateValue = 0;
            }
            update[props.systemPath] = updateValue;
            document.update(update);
            open.value = false;
        };
    </script>

    <template>
        <div>
            <v-icon icon="fa-solid fa-calculator" @click="toggleCalculator">  
            </v-icon>
            <v-dialog v-model="open" max-width="340">
                <template v-slot:default="{ open }">
                <v-card title="Calculator">
                    <v-card-text>
                        <v-number-input
                            v-model="value"
                            label="Value" 
                            controlVariant="stacked"
                            density="compact"
                            variant="outlined"
                        ></v-number-input>
                        <v-btn-toggle v-model="mode" class="flexrow" mandatory divided>
                            <v-btn value="add" data-tooltip="Add" :color="primaryColor">
                                <v-icon icon="fa-solid fa-plus"></v-icon>
                            </v-btn>
                            <v-btn value="subtract" data-tooltip="Subtract" :color="primaryColor">
                                <v-icon icon="fa-solid fa-minus"></v-icon>
                            </v-btn>
                            <v-btn value="multiply" data-tooltip="Multiply" :color="primaryColor">
                                <v-icon icon="fa-solid fa-times"></v-icon>
                            </v-btn>
                            <v-btn value="divide" data-tooltip="Divide" :color="primaryColor">
                                <v-icon icon="fa-solid fa-divide"></v-icon>
                            </v-btn>
                        </v-btn-toggle>
                    </v-card-text>
                    <v-card-actions class="flexrow">
                        <v-btn text="Submit" @click="submit" prepend-icon="fa-solid fa-check" :color="primaryColor"></v-btn>
                        <v-btn text="Cancel" @click="toggleCalculator" prepend-icon="fa-solid fa-xmark" :color="secondaryColor"></v-btn>
                    </v-card-actions>
                </v-card>
                </template>
            </v-dialog>
        </div>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}