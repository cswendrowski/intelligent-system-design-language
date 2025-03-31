import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { Action, ClassExpression, ColorParam, Document, DocumentArrayExp, IconParam, isAction, isActor, isColorParam, isDateExp, isDateTimeExp, isHtmlExp, isIconParam, isInitiativeProperty, isNumberExp, isPage, isPaperDollElement, isParentPropertyRefExp, isProperty, isSection, isStringExp, isStringParamChoices, isTimeExp, Page, Section, StringParamChoices } from "../../../language/generated/ast.js";
import { getAllOfType, getSystemPath } from '../utils.js';
import { Reference } from 'langium';

export function generateDatatableComponent(id: string, document: Document, pageName: string, table: DocumentArrayExp, destination: string) {
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

            if (isParentPropertyRefExp(property)) {
                return expandToNode`
                    { data: '${systemPath}', title: game.i18n.localize("${refDoc?.ref?.name}.${property.name}"), render: (data, type, row) => {
                            return humanize(data);
                        }
                    },
                `;
            }

            return expandToNode`
                { data: '${systemPath}', title: game.i18n.localize("${refDoc?.ref?.name}.${property.name}"), type: '${type}' },
            `;
        }
        return undefined;
    }

    let tableDocBody = table.document.ref?.body ?? [];
    const actions = getAllOfType<Action>(tableDocBody, isAction, false);

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";
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
        const document = inject('rawDocument');

        const data = computed(() => {
            return foundry.utils.getProperty(props.context, props.systemPath);
        });

        const humanize = (str) => {
            let humanized = str.replace(/_/g, " ");
            humanized = humanized.replace("system.", "").replaceAll(".", " ");
            humanized = humanized.charAt(0).toUpperCase() + humanized.slice(1);
            return humanized;
        };

        const editItem = (rowData) => {
            const item = document.items.get(rowData._id);
            item.sheet.render(true);
        };

        const sendItemToChat = async (rowData) => {
            const item = document.items.get(rowData._id);
            const chatDescription = item.description ?? item.system.description;
            const content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", { 
                cssClass: "${id}",
                document: item,
                hasItems: false,
                description: chatDescription,
                hasDescription: chatDescription != ""
            });
            ChatMessage.create({
                content: content,
                speaker: ChatMessage.getSpeaker(),
                style: CONST.CHAT_MESSAGE_STYLES.IC
            });
        };

        const deleteItem = async (rowData) => {
            const item = document.items.get(rowData._id);
            const shouldDelete = await Dialog.confirm({
                title: "Delete Confirmation",
                content: \`<p>Are you sure you would like to delete the "\${item.name}" Item?</p>\`,
                defaultYes: false
            });
            if ( shouldDelete ) item.delete();
        };

        const customItemAction = async (rowData, event) => {
            const item = document.items.get(rowData._id);
            item.sheet._onAction(event);
        };

        function bindDragDrop() {
            document.sheet.dragDrop.forEach((d) => d.bind(document.sheet.element));
        };

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
                responsivePriority: 1,
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
            initComplete: (settings, json) => {
                bindDragDrop();
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
                                Item.createDocuments([{type: type, name: "New " + type}], {parent: document}).then(item => {
                                    item[0].sheet.render(true);
                                });
                            }
                        },
                        'colvis'
                    ]
                }
            }
        };
    </script>

    <template>
        <DataTable class="display compact" :data="data" :columns="columns" :options="options" @draw="bindDragDrop">
            <template #image="props">
                <img :src="props.cellData" width=40 height=40 />
            </template>
            <template #actions="props">
                <div class="flexrow">
                    ${joinToNode(actions, generateActionRow, { appendNewLineIfNotEmpty: true })}
                    <a class="row-action" data-action="edit" @click="editItem(props.rowData)" :data-tooltip="game.i18n.localize('Edit')"><i class="fas fa-edit"></i></a>
                    <a class="row-action" data-action="sendToChat" @click="sendItemToChat(props.rowData)" :data-tooltip="game.i18n.localize('SendToChat')"><i class="fas fa-message"></i></a>
                    <a class="row-action" data-action="delete" @click="deleteItem(props.rowData)" :data-tooltip="game.i18n.localize('Delete')"><i class="fas fa-delete-left"></i></a>
                </div>
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

    function generateActionRow(action: Action): CompositeGeneratorNode {
        const icon = (action.conditions.find(x => isIconParam(x)) as IconParam)?.value ?? "fa-solid fa-bolt";
        const color = (action.conditions.find(x => isColorParam(x)) as ColorParam)?.value ?? "#000000";
        return expandToNode`
            <a class="row-action" data-action="${action.name.toLowerCase()}" @click="customItemAction(props.rowData, $event)" :data-tooltip="game.i18n.localize('${action.name}')"><i class="fas ${icon}" style="color: ${color};"></i></a>
        `;
    }
}
