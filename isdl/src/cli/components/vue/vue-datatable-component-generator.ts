import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { ClassExpression, Document, DocumentArrayExp, isActor, isDateExp, isDateTimeExp, isHtmlExp, isInitiativeProperty, isNumberExp, isPage, isPaperDollElement, isProperty, isSection, isStringExp, isStringParamChoices, isTimeExp, Page, Section, StringParamChoices } from "../../../language/generated/ast.js";
import { getSystemPath } from '../utils.js';
import { Reference } from 'langium';

export function generateDatatableComponent(document: Document, pageName: string, table: DocumentArrayExp, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, "components");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${pageName}${table.name}Datatable.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateDataTableColumn(refDoc: Reference<Document> | undefined, property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {
        if ( isSection(property) || isPage(property) ) {
            return expandToNode`
                ${joinToNode(property.body, p => generateDataTableColumn(refDoc, p), { appendNewLineIfNotEmpty: true })}
            `;
        }
        if ( isHtmlExp(property) || isInitiativeProperty(property) || isPaperDollElement(property) ) return undefined;

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

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed } from "vue";
        import DataTable from 'datatables.net-vue3';
        import DataTablesCore from 'datatables.net-dt';
        import 'datatables.net-responsive-dt';
        import 'datatables.net-colreorder-dt';
        import 'datatables.net-rowreorder-dt';
        import 'datatables.net-buttons-dt';
        import ColVis from "datatables.net-buttons/js/buttons.colVis";

        DataTable.use(DataTablesCore);
        DataTable.use(ColVis);

        const props = defineProps({
            systemPath: String,
            context: Object
        });

        const data = computed(() => {
            return foundry.utils.getProperty(props.context, props.systemPath);
        });

        const columns = [
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

        const options = {
            paging: false,
            stateSave: true,
            responsive: true,
            colReorder: false,
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
    </script>

    <template>
        <DataTable class="display compact" :data="data" :columns="columns" :options="options">
            <template #image="props">
                <img :src="props.cellData" width=40 height=40></img>
            </template>
            <template #actions="props">
                <div>Actions!</div>
            </template>
        </DataTable>
    </template>

    <style>
        @import 'datatables.net-dt';
        @import 'datatables.net-responsive-dt';
        @import 'datatables.net-rowreorder-dt';
        @import 'datatables.net-colreorder-dt';
        @import 'datatables.net-buttons-dt';
    </style>
    `;
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
