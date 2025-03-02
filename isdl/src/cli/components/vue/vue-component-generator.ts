import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, toString } from 'langium/generate';
import { Document, isActor } from "../../../language/generated/ast.js";

export function generateDocumentVueComponent(id: string, document: Document, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type);
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}App.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        ${generateVueComponentScript(id, document)}
        ${generateVueComponentTemplate(id, document)}
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateVueComponentScript(id: string, document: Document): CompositeGeneratorNode {
    return expandToNode`
    <script setup>
        import { ref } from 'vue';
        const dialog = ref(false);
        const items = ref([
            { name: "Longsword", type: "Weapon", rarity: "Common" },
            { name: "Health Potion", type: "Consumable", rarity: "Uncommon" },
            { name: "Dragon Scale Armor", type: "Armor", rarity: "Rare" }
        ]);
    </script>
    `;
}

function generateVueComponentTemplate(id: string, document: Document): CompositeGeneratorNode {
    return expandToNode`
    <template>
        <div>
            <h1>${document.name}</h1>
            <div class="d-flex flex-column align-center pa-5">
                <VCard class="pa-4" width="400">
                <VCardTitle class="text-h5">Vuetify Test Card</VCardTitle>
                <VCardText>
                    <p>This card is styled with Vuetify.</p>
                    <VBtn color="primary" @click="dialog = true">
                    <VIcon left>mdi-information</VIcon> Open Dialog
                    </VBtn>
                </VCardText>
                </VCard>

                <VTable class="mt-4" density="compact">
                <thead>
                    <tr>
                    <th class="text-left">Name</th>
                    <th class="text-left">Type</th>
                    <th class="text-left">Rarity</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="item in items" :key="item.name">
                    <td>{{ item.name }}</td>
                    <td>{{ item.type }}</td>
                    <td>{{ item.rarity }}</td>
                    </tr>
                </tbody>
                </VTable>

                <VDialog v-model="dialog" width="400">
                <VCard>
                    <VCardTitle class="text-h5">Vuetify Dialog</VCardTitle>
                    <VCardText>This confirms Vuetify is fully working!</VCardText>
                    <div class="pa-4">
                    <VBtn color="error" @click="dialog = false">Close</VBtn>
                    </div>
                </VCard>
                </VDialog>
            </div>
        </div>
    </template>

    <style>
    .d-flex {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }
    </style>
    `;
}
