import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { Document, isActor, isPage, Page } from "../../../language/generated/ast.js";
import { getAllOfType } from '../utils.js';

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
        import { ref } from "vue";
        const drawer = ref(false);
        const props = defineProps(['context']);
    </script>
    `;
}

function generateVueComponentTemplate(id: string, document: Document): CompositeGeneratorNode {
    const allPages = getAllOfType<Page>(document.body, isPage);
    return expandToNode`
    <template>
        <v-app>
            <!-- App Bar -->
            <v-app-bar color="primary" density="comfortable">
                <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
                <h2 class="ml-4"><v-text-field name="name" v-model="context.actor.name" density="compact" variant="solo"></v-text-field></h2>
            </v-app-bar>

            <!-- Navigation Drawer -->
            <v-navigation-drawer v-model="drawer" temporary>
                <v-img :src="context.actor.img"></v-img>
                <v-list>
                    <v-list-item title="Character"></v-list-item>
                    ${joinToNode(allPages, page => generateNavListItem(page), { appendNewLineIfNotEmpty: true})}
                </v-list>
            </v-navigation-drawer>

            <!-- Main Content -->
            <v-main class="d-flex">
                <v-container class="bg-surface-variant">
                    <v-row no-gutters>
                        <v-col
                            v-for="n in 4"
                            :key="n"
                            cols="12"
                            sm="3"
                        >
                            <v-sheet class="ma-2 pa-2">
                            One of four columns
                            </v-sheet>
                        </v-col>
                    </v-row>
                </v-container>
            </v-main>
        </v-app>
    </template>
    `;

    function generateNavListItem(page: Page): CompositeGeneratorNode {
        return expandToNode`
        <v-list-item title="${page.name}"></v-list-item>
        `;
    }
}
