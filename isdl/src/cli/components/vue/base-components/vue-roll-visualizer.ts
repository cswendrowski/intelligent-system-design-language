import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateRollVisualizerComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `roll-visualizer.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, watch } from "vue";

        const props = defineProps({});

        const resultText = ref("Not Evaluated");
        const roll = ref("2d20 + d6 + 5");

        let estimated = true;

        const iterations = ref(1000);
        const labels = ref([]);
        const values = ref([]);
        const min = ref(0);
        const max = ref(0);

        const countAndSplitNumbers = (arr) => {
            // Count occurrences
            const countMap = arr.reduce((acc, num) => {
                acc[num] = (acc[num] || 0) + 1;
                return acc;
            }, {});

            // Sort and split into two arrays
            const sortedEntries = Object.entries(countMap).sort(([a], [b]) => a - b);
            const labels = sortedEntries.map(([num]) => Number(num));
            const values = sortedEntries.map(([, count]) => count);

            return { labels, values };
        }

        watch(roll, async () => {

            if (!Roll.validate(roll.value)) {
                return;
            }

            // Whenever the roll changes, we need to re-calculate the value. First we do a quick simulation, then we do a more accurate one and reload the results
            let result = await Roll.simulate(roll.value, 1000);
            let counted = countAndSplitNumbers(result);
            iterations.value = 1000;

            // If there are more than 20 labels, only show every other label
            if (counted.labels.length > 20) {
                counted.labels = counted.labels.filter((_, i) => i % 2 === 0);
                counted.values = counted.values.filter((_, i) => i % 2 === 0);
            }

            labels.value = counted.labels;
            values.value = counted.values;
            min.value = Math.min(...counted.labels);
            max.value = Math.max(...counted.labels);

            setTimeout(async () => {
                Roll.simulate(roll.value, 10000).then(result2 => {
                    let counted2 = countAndSplitNumbers(result2);
                    iterations.value = 10000;

                    // If there are more than 20 labels, only show every other label
                    if (counted2.labels.length > 20) {
                        counted2.labels = counted.labels.filter((_, i) => i % 2 === 0);
                        counted2.values = counted.values.filter((_, i) => i % 2 === 0);
                    }

                    labels.value = counted2.labels;
                    values.value = counted2.values;
                });
            }, 0);
        });


    </script>

    <template>
        <v-card class="mt-8 mx-auto overflow-visible" style="min-width: 600px;">
            <v-sheet
            class="v-sheet--offset mx-auto"
            color="cyan"
            elevation="12"
            max-width="calc(100% - 32px)"
            rounded="lg"
            >
                <v-sparkline
                    :labels="labels"
                    :model-value="values"
                    color="white"
                    line-width="2"
                    padding="16"
                    smooth="8"
                    label-size="6"
                ></v-sparkline>
            </v-sheet>

            <v-card-text class="pt-0">
                <div class="text-h6 font-weight-light mb-2">
                <v-text-field v-model="roll"></v-text-field>    
                </div>
                <div class="subheading font-weight-light text-grey" v-if="values.length > 0">
                    Min: {{min}} Max: {{max}}
                </div>
                <v-divider class="my-2"></v-divider>
                <span class="text-caption text-grey font-weight-light">
                    Approximate results based on {{iterations}} simulations
                </span>
            </v-card-text>
        </v-card>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}