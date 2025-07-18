import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import {
    Action,
    ClassExpression,
    ColorParam,
    Document,
    IconParam,
    isAction,
    isActor, isBooleanExp,
    isColorParam,
    isDateExp,
    isDateTimeExp, isDiceField, isDieField, isDocument, isDocumentChoiceExp,
    isHookHandler,
    isHtmlExp,
    isIconParam,
    isInitiativeProperty, isLayout, isMeasuredTemplateField,
    isPaperDollElement,
    isParentPropertyRefExp,
    isProperty,
    isResourceExp, isStringChoiceField,
    isStringExp,
    isStringParamChoices, isTableFieldsParam,
    isTimeExp,
    isTrackerExp, Layout,
    StandardFieldParams,
    StringParamChoices, TableField, TableFieldsParam
} from "../../../language/generated/ast.js";
import {getAllOfType, getSystemPath} from '../utils.js';
import {AstUtils, Reference} from 'langium';

export function generateVuetifyDatatableComponent(id: string, document: Document, pageName: string, table: TableField, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "datatables");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${pageName}${table.name}VuetifyDatatable.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const iconParam = table.params.find(p => isIconParam(p)) as IconParam | undefined;

    let fieldsParam = table.params.find(x => isTableFieldsParam(x)) as TableFieldsParam | undefined;

    function generateDataTableHeader(refDoc: Reference<Document> | undefined, property: ClassExpression | Layout): CompositeGeneratorNode | undefined {
        if ( isLayout(property) ) {
            return expandToNode`
                ${joinToNode(property.body, p => generateDataTableHeader(refDoc, p), { appendNewLineIfNotEmpty: true })}
            `;
        }
        if ( isHtmlExp(property) || isInitiativeProperty(property) || isPaperDollElement(property) || isHookHandler(property) ) return undefined;

        if ( isProperty(property) ) {
            const isHidden = property.modifier == "hidden";
            if (isHidden) return undefined;

            if (fieldsParam && fieldsParam.fields.length > 0 && !fieldsParam.fields.some(x => x === property.name)) {
                return undefined;
            }

            let systemPath = getSystemPath(property, [], undefined, false);
            let sortable = true;

            if (isResourceExp(property) || isTrackerExp(property) || isDiceField(property) || isMeasuredTemplateField(property)) {
                sortable = false;
            }

            if (isResourceExp(property) || isTrackerExp(property)) {
                systemPath = systemPath.replace(/\.(value|max)$/, '');
            }

            let localizeName = `${refDoc?.ref?.name}.${property.name}`;

            if (isStringExp(property) && property.params.some(p => isStringParamChoices(p))) {
                localizeName += ".label";
            }

            if (isDocumentChoiceExp(property) || isStringChoiceField(property)) {
                localizeName += ".label";
            }

            return expandToNode`
                { title: game.i18n.localize("${localizeName}"), key: '${systemPath}', sortable: ${sortable} },
            `;
        }
        return undefined;
    }

    function generateSlotTemplate(refDoc: Reference<Document> | undefined, property: ClassExpression | Layout): CompositeGeneratorNode | undefined {
        if ( isLayout(property) ) {
            return expandToNode`
                ${joinToNode(property.body, p => generateSlotTemplate(refDoc, p), { appendNewLineIfNotEmpty: true })}
            `;
        }
        if ( isHtmlExp(property) || isInitiativeProperty(property) || isPaperDollElement(property) || isHookHandler(property) ) return undefined;

        if ( isProperty(property) ) {
            const isHidden = property.modifier == "hidden";
            if (isHidden) return undefined;

            if (fieldsParam && fieldsParam.fields.length > 0 && !fieldsParam.fields.some(x => x === property.name)) {
                return undefined;
            }

            let systemPath = getSystemPath(property, [], undefined, false);
            const slotName = systemPath;

            if (isBooleanExp(property)) {
                return expandToNode`
                    <template v-slot:item.${slotName}="{ item }">
                        <v-chip
                            :color="getNestedValue(item, '${systemPath}') ? props.primaryColor : props.secondaryColor"
                            size="x-small"
                            variant="elevated"
                            class="text-caption"
                        >
                            <v-icon v-if="getNestedValue(item, '${systemPath}')">fa-solid fa-check</v-icon>
                            <v-icon v-else>fa-solid fa-times</v-icon>
                        </v-chip>
                    </template>
                `;
            }

            if (isStringExp(property)) {
                let choices = property.params.find(x => isStringParamChoices(x)) as StringParamChoices;
                if (choices != undefined && choices.choices.length > 0 ) {
                    return expandToNode`
                        <template v-slot:item.${slotName}="{ item }">
                            <v-chip size="x-small" variant="elevated" class="text-caption">
                                {{ getNestedValue(item, '${systemPath}') }}
                            </v-chip>
                        </template>
                    `;
                }
            }

            if (isStringChoiceField(property)) {
                systemPath = systemPath.replace(/\.(value)$/, '');
                const parentDocument = AstUtils.getContainerOfType(property, isDocument);
                return expandToNode`
                    <template v-slot:item.${slotName}="{ item }">
                        <v-chip size="x-small" variant="elevated" class="text-caption" label :color="getNestedValue(item, '${systemPath}.color')" :prepend-icon="getNestedValue(item, '${systemPath}.icon')" :data-tooltip="getExtendedChoiceTooltip(item, '${systemPath}')">
                            {{ game.i18n.localize('${parentDocument?.name}.${property.name}.' + getNestedValue(item, '${systemPath}.value')) }}
                        </v-chip>
                    </template>
                `;
            }

            if (isParentPropertyRefExp(property)) {
                return expandToNode`
                    <template v-slot:item.${slotName}="{ item }">
                        <span class="text-caption">{{ humanize(getNestedValue(item, '${systemPath}')) }}</span>
                    </template>
                `;
            }

            if (isResourceExp(property) || isTrackerExp(property)) {
                systemPath = systemPath.replace(/\.(value|max)$/, '');
                return expandToNode`
                    <template v-slot:item.${slotName.replace(".value", "")}="{ item }">
                        <v-chip 
                            :color="getResourceColor(getNestedValue(item, '${systemPath}'))"
                            size="x-small"
                            variant="elevated"
                            class="text-caption"
                        >
                            {{ getNestedValue(item, '${systemPath}.value') }}/{{ getNestedValue(item, '${systemPath}.max') }}
                        </v-chip>
                    </template>
                `;
            }

            if (isDieField(property)) {
                return expandToNode`
                    <template v-slot:item.${slotName}="{ item }">
                        <v-chip 
                            color="primary"
                            size="x-small"
                            variant="elevated"
                            prepend-icon="fa-solid fa-dice"
                            class="text-caption"
                        >
                            {{ getNestedValue(item, '${systemPath}') }}
                        </v-chip>
                    </template>
                `;
            }

            if (isDiceField(property)) {
                return expandToNode`
                    <template v-slot:item.${slotName}="{ item }">
                        <v-chip 
                            color="primary"
                            size="x-small"
                            variant="elevated"
                            prepend-icon="fa-solid fa-dice"
                            class="text-caption"
                        >
                            {{ getNestedValue(item, '${systemPath}').number }}{{ getNestedValue(item, '${systemPath}').die }}
                        </v-chip>
                    </template>
                `;
            }

            if (isMeasuredTemplateField(property)) {
                return expandToNode`
                    <template v-slot:item.${slotName}="{ item }">
                        <v-chip 
                            color="secondary"
                            size="x-small"
                            variant="elevated"
                            prepend-icon="fa-solid fa-ruler-combined"
                            class="text-caption"
                            label
                        >
                            {{ getNestedValue(item, '${systemPath}.summary') }}
                        </v-chip>
                    </template>
                `;
            }

            if (isTimeExp(property) || isDateExp(property) || isDateTimeExp(property)) {
                return expandToNode`
                    <template v-slot:item.${slotName}="{ item }">
                        <span class="text-caption">{{ formatDate(getNestedValue(item, '${systemPath}')) }}</span>
                    </template>
                `;
            }
        }
        return undefined;
    }

    let tableDocBody = table.document.ref?.body ?? [];
    const actions = getAllOfType<Action>(tableDocBody, isAction, false);

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

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

        const data = computed(() => {
            const systemPath = props.systemPath ?? inject('systemPath');
            const systemData = foundry.utils.getProperty(props.context, systemPath) || [];
            return systemData;
        });

        const headers = [
            { 
                title: game.i18n.localize("Image"), 
                key: 'img', 
                sortable: false,
                width: '30px'
            },
            { 
                title: game.i18n.localize("Name"), 
                key: 'name', 
                sortable: true,
                width: '200px'
            },
            ${joinToNode(table.document.ref!.body, p => generateDataTableHeader(table.document, p), { appendNewLineIfNotEmpty: true })}
            { 
                title: game.i18n.localize("Actions"), 
                key: 'actions', 
                sortable: false,
                width: '200px',
                align: 'center'
            }
        ];

        const humanize = (str) => {
            if (!str) return "";
            let humanized = str.replace(/_/g, " ");
            humanized = humanized.replace("system.", "").replaceAll(".", " ");
            humanized = humanized.charAt(0).toUpperCase() + humanized.slice(1);
            return humanized;
        };

        const getNestedValue = (obj, path) => {
            const data = foundry.utils.getProperty(obj, path);
            //console.log("getNestedValue", { obj, path, data });
            return data;
        };

        const getResourceColor = (resource) => {
            if (!resource || !resource.max) return 'grey';
            const percentage = (resource.value / resource.max) * 100;
            if (percentage > 75) return 'green';
            if (percentage > 50) return 'orange';
            if (percentage > 25) return 'red';
            return 'red-darken-2';
        };

        const formatDate = (dateValue) => {
            if (!dateValue) return "";
            return new Date(dateValue).toLocaleDateString();
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

        const addNewItem = async () => {
            loading.value = true;
            try {
                const type = '${table.document.ref?.name.toLowerCase()}';
                const items = await Item.createDocuments([{
                    type: type, 
                    name: "New " + type
                }], {parent: document});
                
                if (items && items[0]) {
                    items[0].sheet.render(true);
                }
            } catch (error) {
                console.error("Error creating item:", error);
                ui.notifications.error("Failed to create new item");
            } finally {
                loading.value = false;
            }
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
        
        const getExtendedChoiceTooltip = (item, systemPath) => {
            // The choice item might have additional system properties other than the core value, color, and icon.
            // We want to build a tooltip of these additional values
            const tooltipParts = [];
            const coreKeys = ['value', 'color', 'icon'];
            const base = getNestedValue(item, systemPath);
            // Iterate over item.system to find additional properties
            for (const key of Object.keys(base)) {
                if (!coreKeys.includes(key)) {
                    const value = base[key];
                    if (value !== undefined) {
                        tooltipParts.push(\`\${key}: \${value}\`);
                    }
                }
            }
            return tooltipParts.join('<br>');
        };

        // Bind drag drop after component mount
        setTimeout(() => bindDragDrop(), 100);
    </script>

    <template>
        <v-card flat style="background: none;">
            <v-card-title class="d-flex align-center pe-1" style="height: 40px; background: none;">
                <v-icon icon="fa-solid ${iconParam ? iconParam.value : 'fa-table'}" size="small" />
                &nbsp; {{ game.i18n.localize("${document.name}.${table.name}") }}
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
                        style="margin: 0;"
                ></v-text-field>
                <v-btn
                    :color="primaryColor || 'primary'"
                    prepend-icon="fa-solid fa-plus"
                    rounded="0"
                    size="small"
                    :loading="loading"
                    @click="addNewItem"
                    style="max-width: 80px; height: 38px;"
                >
                    {{ game.i18n.localize("Add") }}
                </v-btn>
            </v-card-title>
            <v-divider></v-divider>
            
            <v-data-table
                v-model:search="search"
                :headers="headers"
                :items="data"
                :search="search"
                hover
                density="compact"
                hide-default-footer
                style="background: none;"
            >
                <!-- Image slot -->
                <template v-slot:item.img="{ item }">
                    <v-avatar size="40" rounded="0">
                        <v-img :src="item.img" :alt="item.name" cover></v-img>
                    </v-avatar>
                </template>

                <!-- Name slot with description tooltip -->
                <template v-slot:item.name="{ item }">
                    <div class="d-flex align-center">
                        <div>
                            <div class="font-weight-medium">{{ item.name }}</div>
                            <div class="text-caption text-medium-emphasis" v-if="item.system?.description">
                                {{ item.system.description.substring(0, 50) }}{{ item.system.description.length > 50 ? '...' : '' }}
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Custom field slots -->
                ${joinToNode(table.document.ref!.body, p => generateSlotTemplate(table.document, p), { appendNewLineIfNotEmpty: true })}

                <!-- Actions slot -->
                <template v-slot:item.actions="{ item }">
                    <div class="d-flex align-center justify-center ga-1">
                        ${joinToNode(actions, generateActionButton, { appendNewLineIfNotEmpty: true })}
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
                </template>

                <!-- No data slot -->
                <template v-slot:no-data>
                    <div class="text-center pa-4">
                        <v-icon size="48" color="grey-lighten-1">fa-solid fa-inbox</v-icon>
                        <div class="text-h6 mt-2">No items found</div>
                        <div class="text-body-2 text-medium-emphasis">
                            Add your first {{ game.i18n.localize("${table.document.ref?.name}").toLowerCase() }} to get started
                        </div>
                    </div>
                </template>
            </v-data-table>
        </v-card>
    </template>

    <style scoped>
    .v-data-table {
        background: transparent;
    }
    </style>
    `;
    fs.writeFileSync(generatedFilePath, toString(fileNode));

    function generateActionButton(action: Action): CompositeGeneratorNode {
        const standardParams = action.params as StandardFieldParams[];
        const icon = (standardParams.find(x => isIconParam(x)) as IconParam)?.value ?? "fa-solid fa-bolt";
        const color = (standardParams.find(x => isColorParam(x)) as ColorParam)?.value ?? "primary";
        const parentDocument = AstUtils.getContainerOfType(action, isDocument);

        return expandToNode`
            <v-tooltip :text="game.i18n.localize('${parentDocument?.name}.${action.name}')">
                <template v-slot:activator="{ props }">
                    <v-btn
                        v-bind="props"
                        icon="${icon}"
                        size="x-small"
                        variant="text"
                        color="${color}"
                        @click="customItemAction(item, '${action.name.toLowerCase()}')"
                    ></v-btn>
                </template>
            </v-tooltip>
        `;
    }
}
