import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { ClassExpression, Document, DocumentArrayExp, IconParam, isAccess, isAction, isActor, isAttributeExp, isAttributeParamMod, isDateExp, isDateTimeExp, isDocumentArrayExp, isHtmlExp, isIconParam, isInitiativeProperty, isNumberExp, isNumberParamMin, isPage, isProperty, isSection, isStringExp, isStringParamChoices, isTimeExp, NumberParamMin, Page, Section, StringParamChoices } from "../../../language/generated/ast.js";
import { getAllOfType, getSystemPath } from '../utils.js';
import { humanize } from 'inflection';
import { Reference } from 'langium';

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

    function generateDataTableSetup(table: DocumentArrayExp): CompositeGeneratorNode {

        function generateDataTableColumn(refDoc: Reference<Document> | undefined, property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {
            if ( isSection(property) || isPage(property) ) {
                return expandToNode`
                    ${joinToNode(property.body, p => generateDataTableColumn(refDoc, p), { appendNewLineIfNotEmpty: true })}
                `;
            }
            if ( isHtmlExp(property) || isInitiativeProperty(property) ) return undefined;

            if ( isProperty(property) ) {
                const isHidden = property.modifier == "hidden";
                if (isHidden) return undefined;

                const systemPath = getSystemPath(property, [], undefined, false);
                let type = "string";

                if (isNumberExp(property)) type = "num";
                else if (isTimeExp(property) || isDateExp(property) || isDateTimeExp(property)) type = "time";

                if (isStringExp(property)) {
                    let choices = property.params.find(x => isStringParamChoices(x)) as StringParamChoices;
                    if (choices != undefined && choices.choices.length > 0 ) {
                        return expandToNode`
                            { data: '${systemPath}', title: game.i18n.localize("${refDoc?.ref?.name}.${property.name}.label") },
                        `;
                    }
                }
                return expandToNode`
                    { data: '${systemPath}', title: game.i18n.localize("${refDoc?.ref?.name}.${property.name}"), type: '${type}' },
                `;
            }
            return undefined;
        }

        return expandToNode`
        const ${table.name.toLowerCase()}Columns = [
            { 
                data: 'img', 
                title: game.i18n.localize("Image"),
                render: '#image',
                responsivePriority: 1,
                orderable: false,
            },
            { 
                data: 'name',
                title: game.i18n.localize("Name"),
                responsivePriority: 1,
                width: '200px'
            },
            ${joinToNode(table.document.ref!.body, p => generateDataTableColumn(table.document, p), { appendNewLineIfNotEmpty: true })}
            { 
                data: null,
                title: game.i18n.localize("Actions"),
                render: '#actions',
                orderable: false,
                width: '200px'
            }
        ];

        const ${table.name.toLowerCase()}Options = {
            paging: false,
            stateSave: true,
            responsive: true,
            colReorder: true,
            scrollY: '250px',
            order: [[1, 'asc']],
            createdRow: (row, data) => {
                row.setAttribute("data-id", data._id);
                row.setAttribute("data-uuid", data.uuid);
                row.setAttribute("data-type", data.type);
            },
            layout: {
                topStart: {
                    buttons: [
                        {
                            text: '<i class="fas fa-plus"></i> Add',
                            action: (e, dt, node, config) => {
                                // Find the parent tab so we know what type of Item to create
                                const tab = e.currentTarget.closest(".v-window-item");
                                const type = tab.dataset.type;
                                if ( type == "ActiveEffect" ) {
                                    ActiveEffect.createDocuments([{label: "New Effect"}], {parent: this.object}).then(effect => {
                                        effect[0].sheet.render(true);
                                    });
                                }
                                else {
                                    Item.createDocuments([{type: type, name: "New " + type}], {parent: props.context.document}).then(item => {
                                        item[0].sheet.render(true);
                                    });
                                }
                            }
                        },
                        'colvis'
                    ]
                }
            }
        };
        `;
    }

    return expandToNode`
    <script setup>
        import { ref } from "vue";
        import DataTable from 'datatables.net-vue3';
        import DataTablesCore from 'datatables.net-dt';
        import 'datatables.net-responsive-dt';
        import 'datatables.net-colreorder-dt';
        import 'datatables.net-rowreorder-dt';
        import 'datatables.net-buttons-dt';

        DataTable.use(DataTablesCore);

        const drawer = ref(false);
        const tab = ref('${tabs.length > 1 ? tabs[0].name.toLowerCase() : 'description'}');
        const props = defineProps(['context']);

        ${joinToNode(tabs, generateDataTableSetup)}
    </script>
    <style>
        @import 'datatables.net-dt';
        @import 'datatables.net-responsive-dt';
        @import 'datatables.net-rowreorder-dt';
        @import 'datatables.net-colreorder-dt';
        @import 'datatables.net-buttons-dt';
    </style>
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
                        ${joinToNode(tabs, generateDataTable)}
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

    function generateDataTable(element: DocumentArrayExp): CompositeGeneratorNode {

        const systemPath = getSystemPath(element, [], undefined, false);

        return expandToNode`
        <v-tabs-window-item value="${element.name.toLowerCase()}" data-tab="${element.name.toLowerCase()}" data-type="${element.document.ref?.name.toLowerCase()}">
            <DataTable class="display" :data="context.${systemPath}" :columns="${element.name.toLowerCase()}Columns" :options="${element.name.toLowerCase()}Options">
                <template #image="props">
                    <img :src="props.cellData" width=40 height=40></img>
                </template>
                <template #actions="props">
                    <div>Actions!</div>
                </template>
            </DataTable>
        </v-tabs-window-item>
        `.appendNewLine();
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
                    <v-number-input controlVariant="stacked" density="compact" v-model="context.${systemPath}" ${labelFragment}></v-number-input>
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
