import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, joinToNode, toString} from 'langium/generate';
import {
    Action,
    ColorParam,
    Document, Entry,
    IconParam,
    isAction,
    isActor,
    isColorParam, isDocument,
    isIconParam,
    isLabelParam,
    isPage,
    LabelParam,
    Page,
    PinnedField
} from "../../../language/generated/ast.js";
import {getAllOfType} from '../utils.js';
import {AstUtils} from 'langium';

export function generatePinnedVuetifyDatatableComponent(id: string, document: Document, pinnedField: PinnedField, destination: string, entry: Entry): void {
    const type = isActor(document) ? 'actor' : 'item';
    const page = AstUtils.getContainerOfType<Page>(pinnedField, isPage);
    const pageName = page ? page.name : document.name;
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "datatables");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${pageName}${pinnedField.name}VuetifyDatatable.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const iconParam = pinnedField.params.find(p => isIconParam(p)) as IconParam | undefined;
    const labelParam = pinnedField.params.find(p => isLabelParam(p)) as LabelParam | undefined;
    const icon = iconParam?.value ?? "fa-solid fa-thumbtack";
    const label = labelParam?.value ?? `${document.name}.${pinnedField.name}`;

    // Create a mapping of document types to their actions
    const documentActionsMap = new Map<string, Action[]>();
    if (entry) {
        // Get all documents (actors and items) from the entry
        const allDocuments = entry.documents;

        for (const doc of allDocuments) {
            if (doc.body && doc.name) {
                const actions = getAllOfType<Action>(doc.body, isAction, false);
                if (actions.length > 0) {
                    documentActionsMap.set(doc.name.toLowerCase(), actions);
                }
            }
        }
    }

    // Helper function to get action label
    function getActionLabel(action: Action): string {
        const parentDocument = AstUtils.getContainerOfType(action, isDocument);
        return `${parentDocument?.name}.${action.name}`;
    }

    const fileNode = expandToNode`
<script setup>
    import { ref, computed, inject, onMounted, watch } from "vue";

    const props = defineProps({
        systemPath: String,
        context: Object,
        primaryColor: String,
        secondaryColor: String,
        tertiaryColor: String
    });
    
    const document = inject('rawDocument');
    const search = ref('');
    const loading = ref(false);

    // Function to get actions for a specific document type
    const getActionsForType = (itemType) => {
        const actionsMap = {
            ${joinToNode(Array.from(documentActionsMap.entries()), ([docType, actions]) => 
                expandToNode`'${docType}': [${joinToNode(actions, action => 
                    expandToNode`{ 
                        name: '${action.name.toLowerCase()}', 
                        icon: '${(action.params.find(p => isIconParam(p)) as IconParam)?.value ?? "fa-solid fa-bolt"}',
                        color: '${(action.params.find(p => isColorParam(p)) as ColorParam)?.value ?? "primary"}',
                        label: '${getActionLabel(action)}'
                    }`, { separator: ', ' }
                )}]`, 
                { separator: ',\n            ' }
            )}
        };
        return actionsMap[itemType.toLowerCase()] || [];
    };

    // Get all pinned items from the actor's items collection
    const data = computed(() => {
        if (!document || !document.items) return [];
        
        return Array.from(document.items.values())
            .filter(item => item.system?.pinned === true)
            .sort((a, b) => a.name.localeCompare(b.name));
    });

    const humanize = (str) => {
        if (!str) return "";
        let humanized = str.replace(/_/g, " ");
        humanized = humanized.replace("system.", "").replaceAll(".", " ");
        humanized = humanized.charAt(0).toUpperCase() + humanized.slice(1);
        return humanized;
    };

    const editItem = (item) => {
        const foundryItem = document.items.get(item._id);
        foundryItem.sheet.render(true);
    };

    const sendItemToChat = async (item) => {
        const foundryItem = document.items.get(item._id);
        const chatDescription = foundryItem.description ?? foundryItem.system.description;
        const content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", { 
            cssClass: "${id}",
            document: foundryItem,
            hasEffects: foundryItem.effects?.size > 0,
            description: chatDescription,
            hasDescription: chatDescription != ""
        });
        ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker(),
            style: CONST.CHAT_MESSAGE_STYLES.IC
        });
    };

    const deleteItem = async (item) => {
        const foundryItem = document.items.get(item._id);
        const shouldDelete = await Dialog.confirm({
            title: "Delete Confirmation",
            content: \`<p>Are you sure you would like to delete the "\${foundryItem.name}" Item?</p>\`,
            defaultYes: false
        });
        if (shouldDelete) foundryItem.delete();
    };

    const customItemAction = async (item, actionName) => {
        const foundryItem = document.items.get(item._id);
        const event = { currentTarget: { dataset: { action: actionName } } };
        foundryItem.sheet._onAction(event);
    };

    const togglePin = async (item) => {
        const foundryItem = document.items.get(item._id);
        await foundryItem.update({"system.pinned": !foundryItem.system.pinned});
    };

    const bindDragDrop = () => {
        try {
            if (document.sheet.element) {
                document.sheet.dragDrop.forEach((d) => d.bind(document.sheet.element));
            }
        } catch (e) {
            console.error(e);
        }
    };
    
    // Bind drag drop after component mount
    setTimeout(() => bindDragDrop(), 100);
</script>

<template>
    <v-card flat class="isdl-datatable pt-2">
        <v-card-title class="d-flex align-center pe-1" style="height: 40px;">
            <v-icon icon="${icon}" size="small" />
            &nbsp; {{ game.i18n.localize("${label}") }}
            <v-spacer></v-spacer>
            <v-text-field
                    v-model="search"
                    density="compact"
                    label="Search"
                    prepend-inner-icon="fa-solid fa-magnify"
                    variant="outlined"
                    flat
                    hide-details
                    single-line
                    clearable
                    style="margin: 0; margin-right: 8px;"
            ></v-text-field>
        </v-card-title>
        <v-divider></v-divider>
        
        <v-data-table
            v-model:search="search"
            :items="data"
            :search="search"
            hover
            density="compact"
            hide-default-footer
            items-per-page=-1
            style="background: none;"
            class="custom-datatable"
            :sort-by="[{ key: 'system.pinned', order: 'desc' }, { key: 'name', order: 'asc' }]"
        >
            <template #headers>
                <tr>
                    <th class="text-left font-weight-medium" style="width: 40px;"></th>
                    <th class="text-left font-weight-medium" style="width: 50px;">{{ game.i18n.localize("Image") }}</th>
                    <th class="text-left font-weight-medium">{{ game.i18n.localize("Name") }}</th>
                    <th class="text-center font-weight-medium" style="width: 100px;">{{ game.i18n.localize("Type") }}</th>
                    <th class="text-center font-weight-medium" style="width: 150px;">{{ game.i18n.localize("Actions") }}</th>
                </tr>
            </template>

            <!-- Pin toggle slot -->
            <template v-slot:item="{ item }">
                <tr :data-item-id="item._id" :data-document-id="document._id" :data-uuid="item.uuid">
                    <td class="text-center" style="width: 40px;">
                        <v-btn
                            icon
                            size="small"
                            variant="text"
                            @click="togglePin(item)"
                            :data-tooltip="'Unpin'"
                        >
                            <v-icon 
                                icon="fa-solid fa-thumbtack"
                                :color="primaryColor || '#ffd700'"
                                size="small"
                            ></v-icon>
                        </v-btn>
                    </td>

                    <!-- Image slot -->
                    <td style="width: 50px;">
                        <v-avatar size="32" rounded="0">
                            <v-img :src="item.img" :alt="item.name" cover></v-img>
                        </v-avatar>
                    </td>

                    <!-- Name slot -->
                    <td>
                        <div class="d-flex align-center" :data-tooltip="item.system.description">
                            <div class="font-weight-medium">{{ item.name }}</div>
                        </div>
                    </td>

                    <!-- Type slot -->
                    <td class="text-center" style="width: 100px;">
                        <v-chip 
                            size="small" 
                            variant="outlined" 
                            class="text-caption"
                            color="primary"
                        >
                            {{ item.type }}
                        </v-chip>
                    </td>

                    <!-- Actions slot -->
                    <td class="text-center" style="width: 150px;">
                        <div class="d-flex align-center justify-center ga-1">
                            <template v-for="action in getActionsForType(item.type)" :key="action.name">
                                <v-tooltip :text="game.i18n.localize(action.label)">
                                    <template v-slot:activator="{ props }">
                                        <v-btn
                                            v-bind="props"
                                            :icon="action.icon"
                                            size="x-small"
                                            variant="text"
                                            :color="action.color"
                                            @click="customItemAction(item, action.name)"
                                        ></v-btn>
                                    </template>
                                </v-tooltip>
                            </template>
                            <v-tooltip text="Edit">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon="fa-solid fa-edit"
                                        size="x-small"
                                        variant="text"
                                        @click="editItem(item)"
                                    ></v-btn>
                                </template>
                            </v-tooltip>
                            <v-tooltip text="Send to Chat">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon="fa-solid fa-message"
                                        size="x-small"
                                        variant="text"
                                        @click="sendItemToChat(item)"
                                    ></v-btn>
                                </template>
                            </v-tooltip>
                            <v-tooltip text="Delete">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon="fa-solid fa-trash"
                                        size="x-small"
                                        variant="text"
                                        color="error"
                                        @click="deleteItem(item)"
                                    ></v-btn>
                                </template>
                            </v-tooltip>
                        </div>
                    </td>
                </tr>
            </template>

            <!-- No data slot -->
            <template v-slot:no-data>
                <div class="text-center pa-4">
                    <v-icon size="48" color="grey-lighten-1">fa-solid fa-thumbtack</v-icon>
                    <div class="text-h6 mt-2">No pinned items</div>
                    <div class="text-body-2 text-medium-emphasis">
                        Pin items from your inventory to see them here
                    </div>
                </div>
            </template>
        </v-data-table>
    </v-card>
</template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}