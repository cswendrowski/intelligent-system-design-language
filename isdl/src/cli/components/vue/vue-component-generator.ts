import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { ClassExpression, Document, DocumentArrayExp, IconParam, isAccess, isAction, isActor, isAttributeExp, isAttributeParamMod, isDocumentArrayExp, isIconParam, isNumberExp, isNumberParamMin, isPage, isProperty, isSection, isStringExp, isStringParamChoices, NumberParamMin, Page, Section, StringParamChoices } from "../../../language/generated/ast.js";
import { getAllOfType, getSystemPath } from '../utils.js';
import { humanize } from 'inflection';

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
    const tabs = getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, true);
    return expandToNode`
    <script setup>
        import { ref } from "vue";
        const drawer = ref(false);
        const tab = ref('${tabs.length > 1 ? tabs[0].name.toLowerCase() : 'description'}');
        const props = defineProps(['context']);
    </script>
    `;
}

function generateVueComponentTemplate(id: string, document: Document): CompositeGeneratorNode {
    const allPages = getAllOfType<Page>(document.body, isPage);
    const tabs = getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, true);
    return expandToNode`
    <template>
        <v-app>
            <!-- App Bar -->
            <v-app-bar color="primary" density="comfortable">
                <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
                <v-text-field name="name" v-model="context.actor.name" variant="outlined" class="pt-6"></v-text-field>
            </v-app-bar>

            <!-- Navigation Drawer -->
            <v-navigation-drawer v-model="drawer" temporary>
                <v-img :src="context.actor.img"></v-img>
                <v-list>
                    <v-list-item title="Character" prepend-icon="mdi-crown-circle-outline"></v-list-item>
                    ${joinToNode(allPages, page => generateNavListItem(page), { appendNewLineIfNotEmpty: true})}
                </v-list>
            </v-navigation-drawer>

            <!-- Main Content -->
            <v-main class="d-flex">
                <v-container class="bg-surface-variant" fluid>
                    <v-row>
                        ${joinToNode(document.body, element => generateElement(element), { appendNewLineIfNotEmpty: true })}
                    </v-row>
                    <v-divider class="mt-4 mb-2"></v-divider>
                    <v-tabs v-model="tab" grow always-center>
                            ${joinToNode(tabs, tab => expandToNode`
                            <v-tab value="${tab.name.toLowerCase()}">${humanize(tab.name)}</v-tab>
                            `, { appendNewLineIfNotEmpty: true })}
                    </v-tabs>
                    <v-tabs-window v-model="tab">
                        ${joinToNode(tabs, tab => expandToNode`
                        <v-tabs-window-item value="${tab.name.toLowerCase()}">
                            <h2>${humanize(tab.name)}</h2>
                        </v-tabs-window-item>
                        `, { appendNewLineIfNotEmpty: true })}
                    </v-tabs-window>
                </v-container>
            </v-main>
        </v-app>
    </template>
    `;

    function generateNavListItem(page: Page): CompositeGeneratorNode {
        const pageIconParam = page.params.find(p => isIconParam(p)) as IconParam | undefined;
        if (pageIconParam !== undefined) {
            return expandToNode`
            <v-list-item title="${page.name}" prepend-icon="${pageIconParam.value}"></v-list-item>
            `;
        }
        return expandToNode`
        <v-list-item title="${page.name}"></v-list-item>
        `;
    }

    function generateElement(element: Page | ClassExpression | Section): CompositeGeneratorNode {

        if (isSection(element)) {
            return expandToNode`
            <v-col cols="3" class="pl-1 pr-1">
                <v-card
                    elevation="16"
                >
                <v-card-title>${element.name}</v-card-title>

                <v-card-text>
                    ${joinToNode(element.body, element => generateElement(element), { appendNewLineIfNotEmpty: true })}
                </v-card-text>
                </v-card>
            </v-col>
            `;
        }

        if (isPage(element)) {
            // Do nothing for now
            return expandToNode``;
        }

        // We don't render these elements as part of this function
        if (isAccess(element) || isDocumentArrayExp(element)) {
            return expandToNode``;
        }

        if (isAction(element)) {
            return expandToNode`
            <v-btn color="primary" class="ma-1">{{game.i18n.localize('${document.name}.${element.name}')}}</v-btn>
            `;
        }

        if (isProperty(element)) {
            if (element.modifier == "hidden") return expandToNode``;

            let disabled = element.modifier == "readonly" || element.modifier == "locked"; // TODO: Edit mode
            if (element.modifier == "unlocked") disabled = false;

            const label = `${document.name}.${element.name}`;
            const labelFragment = `:label="game.i18n.localize('${label}')"`;
            const systemPath = getSystemPath(element, [], undefined, false);

            if (isStringExp(element)) {
                const choicesParam = element.params.find(p => isStringParamChoices(p)) as StringParamChoices | undefined;

                if (choicesParam !== undefined) {
                    // Map the choices to a string array
                    const choices = choicesParam.choices.map(c => `'${c}'`).join(", ");
                    return expandToNode`
                    <v-select clearable v-model="context.${systemPath}" :items="[${choices}]" ${labelFragment}></v-select>
                    `;
                }
                return expandToNode`
                    <v-text-field clearable v-model="context.${systemPath}" ${labelFragment}></v-text-field>
                `;
            }

            if (isNumberExp(element)) {
                return expandToNode`
                    <v-number-input controlVariant="stacked" v-model="context.${systemPath}" ${labelFragment}></v-number-input>
                `;
            }

            if (isAttributeExp(element)) {
                const minParam = element.params.find(x => isNumberParamMin(x)) as NumberParamMin;
                const min = minParam?.value ?? 0;
                const hasMod = element.params.find(x => isAttributeParamMod(x)) != undefined;

                const modSystemPath = getSystemPath(element, ["mod"], undefined, false);

                return expandToNode`
                    <i-attribute label="${label}" :hasMod="${hasMod}" :mod="context.${modSystemPath}" systemPath="${systemPath}" :context="context" :min="${min}" :disabled="${disabled}"></i-attribute>
                `;
            }
        }

        return expandToNode`
        <v-alert text="Unknown Element" type="warning" density="compact" class="ga-2 ma-1" variant="outlined"></v-alert>
        `;
    }
}
