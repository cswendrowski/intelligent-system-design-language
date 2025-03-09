import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { Action, ClassExpression, Document, DocumentArrayExp, Entry, IconParam, isAccess, isAction, isActor, isAttributeExp, isAttributeParamMod, isBooleanExp, isDateExp, isDateTimeExp, isDocumentArrayExp, isHtmlExp, isIconParam, isNumberExp, isNumberParamMin, isNumberParamValue, isPage, isProperty, isResourceExp, isSection, isSingleDocumentExp, isStatusProperty, isStringExp, isStringParamChoices, isTimeExp, NumberParamMin, NumberParamValue, Page, Section, StringParamChoices } from "../../../language/generated/ast.js";
import { getAllOfType, getSystemPath } from '../utils.js';
import { generateDatatableComponent } from './vue-datatable-component-generator.js';
import { generateActionComponent } from './vue-action-component-generator.js';

export function generateDocumentVueComponent(entry: Entry, id: string, document: Document, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type);
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}App.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        ${generateVueComponentScript(entry, id, document, destination)}
        ${generateVueComponentTemplate(id, document)}
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateVueComponentScript(entry: Entry, id: string, document: Document, destination: string): CompositeGeneratorNode {
    const tabs = getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, true);
    const pages = getAllOfType<Page>(document.body, isPage);
    const actions = getAllOfType<Action>(document.body, isAction);

    function getPageFirstTab(page: Page): string {
        const firstTab = page.body.find(x => isDocumentArrayExp(x)) as DocumentArrayExp | undefined;
        const tab = firstTab?.name.toLowerCase() ?? 'description';

        return `'${page.name.toLowerCase()}': '${tab}'`;
    }

    function importDataTable(pageName: string, tab: DocumentArrayExp): CompositeGeneratorNode {
        generateDatatableComponent(document, pageName, tab, destination);
        return expandToNode`
        import ${document.name}${pageName}${tab.name}Datatable from './components/${document.name.toLowerCase()}${pageName}${tab.name}Datatable.vue';
        `;
    }

    function importPageOfDataTable(page: Page): CompositeGeneratorNode {
        const tabs = getAllOfType<DocumentArrayExp>(page.body, isDocumentArrayExp, true);
        return expandToNode`
        ${joinToNode(tabs, tab => importDataTable(page.name.toLowerCase(), tab), { appendNewLineIfNotEmpty: true })}
        `;
    }

    function importActionComponent(action: Action): CompositeGeneratorNode {
        generateActionComponent(entry, id, document, action, destination);
        const componentName = `${document.name.toLowerCase()}${action.name}Action`;
        return expandToNode`
        import ${componentName} from './components/${componentName}.vue';
        `;
    }

    return expandToNode`
    <script setup>
        import { ref, watch } from "vue";
        ${joinToNode(tabs, tab => importDataTable("character", tab), { appendNewLineIfNotEmpty: true })}
        ${joinToNode(pages, importPageOfDataTable, { appendNewLineIfNotEmpty: true })}
        ${joinToNode(actions, importActionComponent, { appendNewLineIfNotEmpty: true })}

        const drawer = ref(false);

        const page = ref('character');
        const tab = ref('description');
        const pageDefaultTabs = {
            'character': 'description',
            ${joinToNode(pages, getPageFirstTab, { separator: ',', appendNewLineIfNotEmpty: true })}
        };

        // When the page changes, reset the tab to the first tab on that page
        watch(page, () => {
            tab.value = pageDefaultTabs[page.value.toLowerCase()];
        });

        const props = defineProps(['context']);
    </script>
    <style>
    </style>
    `;
}

function generateVueComponentTemplate(id: string, document: Document): CompositeGeneratorNode {
    const pages = getAllOfType<Page>(document.body, isPage);
    const firstPageTabs = getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, true);
    return expandToNode`
    <template>
        <v-app>
            <!-- App Bar -->
            <v-app-bar color="primary" density="comfortable">
                <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
                <v-text-field name="name" v-model="context.document.name" variant="outlined" class="pt-6"></v-text-field>
            </v-app-bar>

            <!-- Navigation Drawer -->
            <v-navigation-drawer v-model="drawer" temporary>
                <v-img :src="context.document.img" style="background-color: lightgray" >
                    <template #error>
                        <v-img src="/systems/${id}/missing-character.png"></v-img>
                    </template>
                </v-img>
                <v-tabs v-model="page" direction="vertical">
                    <v-tab value="character" prepend-icon="mdi-crown-circle-outline">Character</v-tab>
                    ${joinToNode(pages, generateNavListItem, { appendNewLineIfNotEmpty: true })}
                </v-tabs>
            </v-navigation-drawer>

            <!-- Main Content -->
            <v-main class="d-flex">
                <v-container class="bg-surface-variant" fluid>
                    <v-tabs-window v-model="page">
                        <v-tabs-window-item value="character" data-tab="character">
                            <v-row>
                                ${joinToNode(document.body, element => generateElement(element), { appendNewLineIfNotEmpty: true })}
                            </v-row>
                            <v-divider class="mt-4 mb-2"></v-divider>
                            <v-tabs v-model="tab" grow always-center>
                                    <v-tab value="description">Description</v-tab>
                                    ${joinToNode(firstPageTabs, tab => expandToNode`
                                    <v-tab value="${tab.name.toLowerCase()}">{{ game.i18n.localize('${tab.name}') }}</v-tab>
                                    `, { appendNewLineIfNotEmpty: true })}
                            </v-tabs>
                            <v-tabs-window v-model="tab">
                                <v-tabs-window-item value="description" data-tab="description">
                                    <i-prosemirror :field="context.editors['system.description']" :disabled="false"></i-prosemirror>
                                </v-tabs-window-item>
                                ${joinToNode(firstPageTabs, tab => generateDataTable("character", tab))}
                            </v-tabs-window>
                        </v-tabs-window-item>
                    ${joinToNode(pages, generatePageBody, { appendNewLineIfNotEmpty: true })}
                    </v-tabs-window>
                </v-container>
            </v-main>
        </v-app>
    </template>
    `;

    function generateNavListItem(page: Page): CompositeGeneratorNode {
        const pageIconParam = page.params.find(p => isIconParam(p)) as IconParam | undefined;
        const icon = pageIconParam?.value ?? "mdi-book-open-page-variant";
        return expandToNode`
            <v-tab value="${page.name.toLowerCase()}" prepend-icon="${icon}">{{ game.i18n.localize('${page.name}') }}</v-tab>
        `;
    }

    function generatePageBody(page: Page): CompositeGeneratorNode {
        const tabs = getAllOfType<DocumentArrayExp>(page.body, isDocumentArrayExp, true);
        return expandToNode`
        <v-tabs-window-item value="${page.name.toLowerCase()}" data-tab="${page.name.toLowerCase()}">
            <v-row>
                ${joinToNode(page.body, element => generateElement(element), { appendNewLineIfNotEmpty: true })}
            </v-row>
            <v-divider class="mt-4 mb-2"></v-divider>
            <v-tabs v-model="tab" grow always-center>
                    ${joinToNode(tabs, tab => expandToNode`
                    <v-tab value="${tab.name.toLowerCase()}">{{ game.i18n.localize('${tab.name}') }}</v-tab>
                    `, { appendNewLineIfNotEmpty: true })}
            </v-tabs>
            <v-tabs-window v-model="tab">
                ${joinToNode(tabs, tab => generateDataTable(page.name.toLowerCase(), tab))}
            </v-tabs-window>
        </v-tabs-window-item>
        `;
    }

    function generateDataTable(pageName: string, element: DocumentArrayExp): CompositeGeneratorNode {
        const systemPath = getSystemPath(element, [], undefined, false);

        return expandToNode`
        <v-tabs-window-item value="${element.name.toLowerCase()}" data-tab="${element.name.toLowerCase()}" data-type="${element.document.ref?.name.toLowerCase()}">
            <${document.name}${pageName}${element.name}Datatable systemPath="${systemPath}" :context="context"></${document.name}${pageName}${element.name}Datatable>
        </v-tabs-window-item>
        `.appendNewLine();
    }

    function generateElement(element: Page | ClassExpression | Section): CompositeGeneratorNode {

        if (isSection(element)) {
            return expandToNode`
            <v-col class="pl-1 pr-1">
                <v-card
                    elevation="8"
                >
                <v-card-title>{{ game.i18n.localize('${document.name}.${element.name}') }}</v-card-title>

                <v-card-text>
                    ${joinToNode(element.body, element => generateElement(element), { appendNewLineIfNotEmpty: true })}
                </v-card-text>
                </v-card>
            </v-col>
            `;
        }

        // We don't render these elements as part of this function
        if (isPage(element) || isAccess(element) || isDocumentArrayExp(element) || isStatusProperty(element)) {
            return expandToNode``;
        }

        if (isAction(element)) {
            const componentName = `${document.name.toLowerCase()}${element.name}Action`;
            return expandToNode`
            <${componentName} :context="context"></${componentName}>
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
                    <v-select clearable name="${systemPath}" v-model="context.${systemPath}" :items="[${choices}]" :label="game.i18n.localize('${label}.label')" :disabled="${disabled}"></v-select>
                    `;
                }
                return expandToNode`
                    <v-text-field clearable  name="${systemPath}" v-model="context.${systemPath}" ${labelFragment} :disabled="${disabled}"></v-text-field>
                `;
            }

            if (isHtmlExp(element)) {
                return expandToNode`
                <i-prosemirror ${labelFragment} :field="context.editors['${systemPath}']" :disabled="false"></i-prosemirror>
                `;
            }

            if (isBooleanExp(element)) {
                return expandToNode`
                <v-checkbox v-model="context.${systemPath}" name="${systemPath}" ${labelFragment} :disabled="${disabled}" color="primary"></v-checkbox>
                `;
            }

            if (isNumberExp(element)) {
                // If this is a calculated value, we don't want to allow editing
                const valueParam = element.params.find(x => isNumberParamValue(x)) as NumberParamValue;
                if (valueParam != undefined) {
                    disabled = true;
                }
                return expandToNode`
                    <v-number-input controlVariant="stacked" density="compact" v-model="context.${systemPath}" name="${systemPath}" ${labelFragment} :disabled="${disabled}"></v-number-input>
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

            if (isResourceExp(element)) {
                return expandToNode`
                <i-resource label="${label}" systemPath="system.${element.name.toLowerCase()}" :context="context" :disabled="${disabled}"></i-resource>
                `;
            }

            if (isSingleDocumentExp(element)) {
                return expandToNode`
                <i-document-link label="${label}" systemPath="system.${element.name.toLowerCase()}" :context="context" :disabled="${disabled}"></i-document-link>
                `;
            }

            if (isDateExp(element) || isTimeExp(element) || isDateTimeExp(element)) {
                return expandToNode`
                <p>${label} - TODO</p>
                `;
            }
            
            return expandToNode`
            <v-alert text="Unknown Property ${element.name}" type="warning" density="compact" class="ga-2 ma-1" variant="outlined"></v-alert>
            `;
        }

        return expandToNode`
        <v-alert text="Unknown Element" type="warning" density="compact" class="ga-2 ma-1" variant="outlined"></v-alert>
        `;
    }
}
