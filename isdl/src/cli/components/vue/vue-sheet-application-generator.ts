import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { Action, AttributeExp, BackgroundParam, ClassExpression, Document, DocumentArrayExp, DocumentChoiceExp, Entry, IconParam, ImageParam, isAccess, isAction, isActor, isAttributeExp, isAttributeParamMod, isBackgroundParam, isBooleanExp, isDateExp, isDateTimeExp, isDocumentArrayExp, isDocumentChoiceExp, isEntry, isHtmlExp, isIconParam, isImageParam, isNumberExp, isNumberParamMin, isNumberParamValue, isPage, isPaperDollExp, isParentPropertyRefExp, isProperty, isResourceExp, isSection, isSingleDocumentExp, isSizeParam, isStatusProperty, isStringExp, isStringParamChoices, isStringParamValue, isTimeExp, NumberExp, NumberParamMin, NumberParamValue, Page, PaperDollExp, Property, ResourceExp, Section, SizeParam, StringParamChoices, StringParamValue } from "../../../language/generated/ast.js";
import { getAllOfType, getDocument, getSystemPath, globalGetAllOfType, toMachineIdentifier } from '../utils.js';
import { generateDatatableComponent } from './vue-datatable-component-generator.js';
import { AstUtils } from 'langium';
import { generateActionComponent } from './vue-action-component-generator.js';
import { generateDocumentChoiceComponent } from './vue-document-choice-component-generator.js';

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
    const paperDoll = getAllOfType<PaperDollExp>(document.body, isPaperDollExp);
    const documentChoices = getAllOfType<DocumentChoiceExp>(document.body, isDocumentChoiceExp);

    function getPageFirstTab(page: Page): string {
        const firstTab = page.body.find(x => isDocumentArrayExp(x)) as DocumentArrayExp | undefined;
        const tab = firstTab?.name.toLowerCase() ?? 'description';

        return `'${page.name.toLowerCase()}': '${tab}'`;
    }

    function getPageBackground(page: Page): string {
        const background = (page.params?.find(x => isBackgroundParam(x)) as BackgroundParam)?.background ?? 'topography';
        return `'${page.name.toLowerCase()}': '${background}'`;
    }

    function importDataTable(pageName: string, tab: DocumentArrayExp): CompositeGeneratorNode {
        generateDatatableComponent(id, document, pageName, tab, destination);
        return expandToNode`
        import ${document.name}${pageName}${tab.name}Datatable from './components/datatables/${document.name.toLowerCase()}${pageName}${tab.name}Datatable.vue';
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
        import ${componentName} from './components/actions/${componentName}.vue';
        `;
    }

    function importDocumentChoiceComponent(documentChoice: DocumentChoiceExp): CompositeGeneratorNode {
        generateDocumentChoiceComponent(entry, id, document, documentChoice, destination);
        const componentName = `${document.name.toLowerCase()}${documentChoice.name}DocumentChoice`;
        return expandToNode`
        import ${componentName} from './components/document-choices/${componentName}.vue';
        `;
    }

    function paperDollSlots(element: PaperDollExp): CompositeGeneratorNode {

        let slots = [];
        for (const property of element.elements) {
            slots.push({
                name: property.name,
                systemPath: `system.${element.name.toLowerCase()}.${property.name.toLowerCase()}`,
                type: property.document.ref?.name.toLowerCase(),
                left: property.left ?? "0px",
                top: property.top ?? "0px",
            });
        }

        return expandToNode`
        const ${element.name.toLowerCase()}Slots = [
            ${joinToNode(slots, slot => expandToNode`
            {
                name: '${slot.name}',
                systemPath: '${slot.systemPath}',
                type: '${slot.type}',
                left: '${slot.left}',
                top: '${slot.top}'
            }`, { separator: ',', appendNewLineIfNotEmpty: true })}
        ];
        `;
    }

    return expandToNode`
    <script setup>
        import { ref, watch, inject, computed } from "vue";
        ${joinToNode(tabs, tab => importDataTable("character", tab), { appendNewLineIfNotEmpty: true })}
        ${joinToNode(pages, importPageOfDataTable, { appendNewLineIfNotEmpty: true })}
        ${joinToNode(actions, importActionComponent, { appendNewLineIfNotEmpty: true })}
        ${joinToNode(documentChoices, importDocumentChoiceComponent, { appendNewLineIfNotEmpty: true })}
        import DataTable from 'datatables.net-vue3';
        import DataTablesCore from 'datatables.net-dt';
        import 'datatables.net-responsive-dt';
        import 'datatables.net-colreorder-dt';
        import 'datatables.net-rowreorder-dt';
        import 'datatables.net-buttons-dt';
        import ColVis from "datatables.net-buttons/js/buttons.colVis";

        DataTable.use(DataTablesCore);
        DataTable.use(ColVis);

        const document = inject('rawDocument');
        const props = defineProps(['context']);

        // Colors
        var storedColors = game.settings.get('${id}', 'documentColorThemes');
        const primaryColor = ref(storedColors[document.uuid]?.primary ?? '#1867c0');
        const secondaryColor = ref(storedColors[document.uuid]?.secondary ?? '#4faca9');

        const setupColors = () => {
            const colors = {
                primary: primaryColor.value,
                secondary: secondaryColor.value
            };
            game.settings.set('${id}', 'documentColorThemes', { ...storedColors, [document.uuid]: colors });
        };
        const resetColors = () => {
            primaryColor.value = '#1867c0';
            secondaryColor.value = '#4faca9';
            setupColors();
        };

        watch(primaryColor, () => {
            setupColors();
        });
        watch(secondaryColor, () => {
            setupColors();
        });

        // Pages and Tabs

        const lastStates = game.settings.get('${id}', 'documentLastState');
        const lastState = lastStates[document.uuid] ?? {
            page: 'character',
            tab: 'description'
        };

        const drawer = ref(false);
        const page = ref(lastState.page);
        const tab = ref(lastState.tab);
        const pageDefaultTabs = {
            'character': 'description',
            ${joinToNode(pages, getPageFirstTab, { separator: ',', appendNewLineIfNotEmpty: true })}
        };

        const updateLastState = () => {
            const lastStates = game.settings.get('${id}', 'documentLastState');
            lastStates[document.uuid] = { page: page.value, tab: tab.value };
            game.settings.set('${id}', 'documentLastState', lastStates);
        };

        // When the page changes, reset the tab to the first tab on that page
        watch(page, () => {
            tab.value = pageDefaultTabs[page.value.toLowerCase()];
            document.sheet.dragDrop.forEach((d) => d.bind(document.sheet.element));
            // Dismiss the drawer when the page changes
            drawer.value = false;
            updateLastState();
        });

        watch(tab, () => {
            document.sheet.dragDrop.forEach((d) => d.bind(document.sheet.element));
            updateLastState();
        });

        const pageBackgrounds = {
            'character': 'topography',
            ${joinToNode(pages, getPageBackground, { separator: ',', appendNewLineIfNotEmpty: true })}
        };

        const pageBackground = computed(() => {
            if (editMode.value) {
                return 'edit-mode';
            }
            return pageBackgrounds[page.value];
        });

        // Edit Mode
        const editMode = ref(document.getFlag('${id}', 'edit-mode') ?? true);
        const hovered = ref(false);

        const toggleEditMode = () => {
            editMode.value = !editMode.value;
            document.setFlag('${id}', 'edit-mode', editMode.value);
        };

        // Effects
        const effects = ref([]);

        function updateEffects() {
            effects.value = Array.from(document.allApplicableEffects());
        }

        updateEffects();

        Hooks.on("createActiveEffect", updateEffects);
        Hooks.on("updateActiveEffect", updateEffects);
        Hooks.on("deleteActiveEffect", updateEffects);

        const getEffect = (id) => {
            let ae = document.effects.get(id);
            if (ae) return ae;
            ae = document.items.find(i => i.effects.has(id)).effects.get(id);
            if (!ae) {
                console.error("Could not find effect with id: " + id);
                return;
            }
            return ae;
        }

        const editEffect = (rowData) => {
            const effect = getEffect(rowData._id);
            effect.sheet.render(true);
        };

        const toggleEffect = (rowData) => {
            const effect = getEffect(rowData._id);
            effect.disabled = !effect.disabled;
            rowData.disabled = effect.disabled;
            document.updateEmbeddedDocuments("ActiveEffect", [effect]);
        };

        const sendEffectToChat = async (rowData) => {
            const effect = getEffect(rowData._id);
            const chatDescription = effect.description ?? effect.system.description;
            const content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", { 
                cssClass: "${id}",
                document: effect,
                hasEffects: false,
                description: chatDescription,
                hasDescription: chatDescription != ""
            });
            ChatMessage.create({
                content: content,
                speaker: ChatMessage.getSpeaker(),
                style: CONST.CHAT_MESSAGE_STYLES.IC
            });
        };

        const deleteEffect = async (rowData) => {
            const effect = getEffect(rowData._id);
            const shouldDelete = await Dialog.confirm({
                title: "Delete Confirmation",
                content: \`<p>Are you sure you would like to delete the "\${effect.name}" Active Effect?</p>\`,
                defaultYes: false
            });
            if ( shouldDelete ) {
                effect.delete();
                updateEffects();
            }
        };

        const effectsColumns = [
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
            {
                data: 'origin',
                title: game.i18n.localize("Source"),
            },
            { 
                data: null,
                title: game.i18n.localize("Actions"),
                render: '#actions',
                orderable: false,
                width: '200px'
            }
        ];

        const effectsOptions = {
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
                                ActiveEffect.createDocuments([{label: "New Effect"}], {parent: document}).then(effect => {
                                    effect[0].sheet.render(true);
                                });
                            }
                        },
                        'colvis'
                    ]
                }
            }
        };

        // Paper Doll Slots
        ${joinToNode(paperDoll, paperDollSlots, { appendNewLineIfNotEmpty: true })}
    </script>
    <style>
    </style>
    `;
}

function generateVueComponentTemplate(id: string, document: Document): CompositeGeneratorNode {
    const pages = getAllOfType<Page>(document.body, isPage);
    const firstPageTabs = getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp, true);
    const type = isActor(document) ? 'actor' : 'item';
    return expandToNode`
    <template>
        <v-app>
            <!-- App Bar -->
            <v-app-bar :color="editMode ? 'amber-accent-3' : primaryColor" density="comfortable">
                <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
                <v-app-bar-title v-if="!editMode">{{ context.document.name }}</v-app-bar-title>
                <v-text-field name="name" v-model="context.document.name" variant="outlined" class="pt-6 document-name" v-if="editMode" density="compact"></v-text-field>
                <v-alert :text="game.i18n.localize('EditModeWarning')" type="warning" density="compact" class="ga-2 ma-1" color="amber-accent-3" v-if="editMode"></v-alert>
                <template v-slot:append>
                    <v-btn
                        :icon="hovered ? (editMode ? 'fa-solid fa-dice-d20' : 'fa-solid fa-pen-to-square') : (editMode ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-dice-d20')"
                        @click="toggleEditMode"
                        @mouseover="hovered = true"
                        @mouseleave="hovered = false"
                        :data-tooltip="editMode ? 'Swap to Play mode' : 'Swap to Edit mode'"
                    ></v-btn>
                </template>
            </v-app-bar>

            <!-- Navigation Drawer -->
            <v-navigation-drawer v-model="drawer" temporary style="background-color: #dddddd">
                <v-img :src="context.document.img" style="background-color: lightgray" data-edit='img' data-action='onEditImage'>
                    <template #error>
                        <v-img src="/systems/${id}/img/missing-character.png" data-edit='img' data-action='onEditImage'></v-img>
                    </template>
                </v-img>
                <v-tabs v-model="page" direction="vertical">
                    <v-tab value="character" prepend-icon="fa-solid fa-circle-user">${type == "actor" ? "Character" : "Item"}</v-tab>
                    ${joinToNode(pages, generateNavListItem, { appendNewLineIfNotEmpty: true })}
                </v-tabs>
                <template v-slot:append>
                    <div class="pa-2">
                        <v-btn block @click="setupColors" :color="secondaryColor">
                        Setup Colors

                        <v-dialog activator="parent" max-width="700">
                        <template v-slot:default="{ isActive }">
                        <v-card
                            title="Setup Colors"
                        >
                            <v-card-text>
                                <div class="d-flex flex-row">
                                    <div class="d-flex flex-column">
                                        <v-label>Primary Color</v-label>
                                        <v-color-picker hide-inputs hide-sliders hide-canvas show-swatches v-model="primaryColor" swatches-max-height="500px"></v-color-picker>
                                    </div>
                                    <v-spacer></v-spacer>
                                    <div class="d-flex flex-column">
                                        <v-label>Secondary Color</v-label>
                                        <v-color-picker hide-inputs hide-sliders hide-canvas show-swatches v-model="secondaryColor" swatches-max-height="500px"></v-color-picker>
                                    </div>
                                </div>
                            </v-card-text>
                            <v-card-actions>
                                <v-btn
                                    variant="tonal"
                                    prepend-icon="fa-solid fa-sync"
                                    text="Reset"
                                    :color="secondaryColor"
                                    @click="resetColors"
                                ></v-btn>
                            </v-card-actions>
                        </v-card>
                        </template>
                    </v-dialog>
                        </v-btn>
                    </div>
                </template>
            </v-navigation-drawer>

            <!-- Main Content -->
            <v-main class="d-flex">
                <v-container :key="editMode" :class="pageBackground" fluid>
                    <v-tabs-window v-model="page">
                        <v-tabs-window-item value="character" data-tab="character">
                            <v-row dense>
                                ${joinToNode(document.body, element => generateElement(element), { appendNewLineIfNotEmpty: true })}
                            </v-row>
                            <v-divider class="mt-4 mb-2"></v-divider>
                            <v-tabs v-model="tab" grow always-center>
                                    <v-tab value="description" prepend-icon="fa-solid fa-book">Description</v-tab>
                                    ${joinToNode(firstPageTabs, generateTab, { appendNewLineIfNotEmpty: true })}
                                    <v-tab value="effects" prepend-icon="fa-solid fa-sparkles">Effects</v-tab>
                            </v-tabs>
                            <v-tabs-window v-model="tab" class="tabs-window">
                                <v-tabs-window-item value="description" data-tab="description" class="tabs-container">
                                    <i-prosemirror :field="context.editors['system.description']" :disabled="!editMode"></i-prosemirror>
                                </v-tabs-window-item>
                                ${joinToNode(firstPageTabs, tab => generateDataTable("character", tab))}
                                <v-tabs-window-item value="effects" data-tab="effects" class="tabs-container">
                                    <DataTable class="display compact" :data="effects" :columns="effectsColumns" :options="effectsOptions">
                                        <template #image="props">
                                            <img :src="props.cellData" width=40 height=40></img>
                                        </template>
                                        <template #actions="props">
                                            <div class="flexrow">
                                                <a 
                                                    class="row-action" 
                                                    data-action="toggle" 
                                                    @click="toggleEffect(props.rowData)" 
                                                    :data-tooltip="game.i18n.localize(props.rowData.disabled ? 'Enable' : 'Disable')">
                                                    <i :class="props.rowData.disabled ? 'fas fa-toggle-off' : 'fas fa-toggle-on'"></i>
                                                </a>
                                                <a class="row-action" data-action="edit" @click="editEffect(props.rowData)" :data-tooltip="game.i18n.localize('Edit')"><i class="fas fa-edit"></i></a>
                                                <a class="row-action" data-action="sendToChat" @click="sendEffectToChat(props.rowData)" :data-tooltip="game.i18n.localize('SendToChat')"><i class="fas fa-message"></i></a>
                                                <a class="row-action" data-action="delete" @click="deleteEffect(props.rowData)" :data-tooltip="game.i18n.localize('Delete')"><i class="fas fa-delete-left"></i></a>
                                            </div>
                                        </template>
                                    </DataTable>
                                </v-tabs-window-item>
                            </v-tabs-window>
                        </v-tabs-window-item>
                    ${joinToNode(pages, generatePageBody, { appendNewLineIfNotEmpty: true })}
                    </v-tabs-window>
                </v-container>
            </v-main>
        </v-app>
    </template>
    `;

    function generateTab(tab: DocumentArrayExp): CompositeGeneratorNode {
        const iconParam = tab.params.find(p => isIconParam(p)) as IconParam | undefined;
        const icon = iconParam?.value ?? "fa-solid fa-table";
        return expandToNode`
            <v-tab value="${tab.name.toLowerCase()}" prepend-icon="${icon}">{{ game.i18n.localize('${tab.name}') }}</v-tab>
        `;
    }

    function generateNavListItem(page: Page): CompositeGeneratorNode {
        const pageIconParam = page.params?.find(p => isIconParam(p)) as IconParam | undefined;
        const icon = pageIconParam?.value ?? "fa-solid fa-page";
        return expandToNode`
            <v-tab value="${page.name.toLowerCase()}" prepend-icon="${icon}">{{ game.i18n.localize('${page.name}') }}</v-tab>
        `;
    }

    function generatePageBody(page: Page): CompositeGeneratorNode {
        const tabs = getAllOfType<DocumentArrayExp>(page.body, isDocumentArrayExp, true);
        return expandToNode`
        <v-tabs-window-item value="${page.name.toLowerCase()}" data-tab="${page.name.toLowerCase()}">
            <v-row dense>
                ${joinToNode(page.body, element => generateElement(element), { appendNewLineIfNotEmpty: true })}
            </v-row>
            <v-divider class="mt-4 mb-2"></v-divider>
            <v-tabs v-model="tab" grow always-center>
                ${joinToNode(tabs, generateTab, { appendNewLineIfNotEmpty: true })}
            </v-tabs>
            <v-tabs-window v-model="tab" class="tabs-window">
                ${joinToNode(tabs, tab => generateDataTable(page.name.toLowerCase(), tab))}
            </v-tabs-window>
        </v-tabs-window-item>
        `;
    }

    function generateDataTable(pageName: string, element: DocumentArrayExp): CompositeGeneratorNode {
        const systemPath = getSystemPath(element, [], undefined, false);

        return expandToNode`
        <v-tabs-window-item value="${element.name.toLowerCase()}" data-tab="${element.name.toLowerCase()}" data-type="${element.document.ref?.name.toLowerCase()}" class="tabs-container">
            <${document.name}${pageName}${element.name}Datatable systemPath="${systemPath}" :context="context"></${document.name}${pageName}${element.name}Datatable>
        </v-tabs-window-item>
        `.appendNewLine();
    }

    function generateElement(element: Page | ClassExpression | Section): CompositeGeneratorNode {

        if (isSection(element)) {
            return expandToNode`
            <v-col class="pl-1 pr-1">
                <v-card variant="outlined" elevation="4">
                    <v-card-title>{{ game.i18n.localize('${document.name}.${element.name}') }}</v-card-title>

                    <v-card-text class="flexrow">
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
            <${componentName} :context="context" :color="primaryColor" :editMode="editMode"></${componentName}>
            `;
        }

        if (isProperty(element)) {
            if (element.modifier == "hidden") return expandToNode``;
            
            if (element.name == "RollVisualizer") {
                return expandToNode`
                <i-roll-visualizer :context="context"></i-roll-visualizer>
                `;
            }
            let disabled = element.modifier == "readonly" || element.modifier == "locked";
            if (element.modifier == "unlocked") disabled = false;
            let unlocked = element.modifier == "unlocked";

            const label = `${document.name}.${element.name}`;
            const labelFragment = `:label="game.i18n.localize('${label}')"`;
            const systemPath = getSystemPath(element, [], undefined, false);

            const entry = AstUtils.getContainerOfType(element, isEntry) as Entry;

            if (isParentPropertyRefExp(element)) {
                let allChoices: Property[] = [];
                switch (element.propertyType) {
                    case "attribute": allChoices = globalGetAllOfType<AttributeExp>(entry, isAttributeExp); break;
                    case "resource": allChoices = globalGetAllOfType<ResourceExp>(entry, isResourceExp); break;
                    case "number": allChoices = globalGetAllOfType<NumberExp>(entry, isNumberExp); break;
                    default: console.error("Unsupported parent property type: " + element.propertyType); break;
                }
                let refChoices = allChoices.map(x => {
                    let parentDocument = getDocument(x);
        
                    if (element.choices.length > 0) {
                        if (!element.choices.find(y => {
                            const documentNameMatches = y.document.ref?.name.toLowerCase() == parentDocument?.name.toLowerCase();
        
                            if (y.property != undefined) {
                                const propertyNameMatches = y.property.ref?.name.toLowerCase() == x.name.toLowerCase();
                                return documentNameMatches && propertyNameMatches;
                            }
                            // Just check document name
                            return documentNameMatches;
                        })) {
                            return undefined;
                        }
                    }
        
                    return {
                        path: `system.${x.name.toLowerCase()}`,
                        parent: parentDocument?.name,
                        name: x.name
                    };
                });
                refChoices = refChoices.filter(x => x != undefined);
                const choices = refChoices.map(c => `{ label: '${c?.parent} - ${c?.name}', value: '${c?.path}' }`).join(", ");
                return expandToNode`
                <v-select name="${systemPath}" v-model="context.${systemPath}" :items="[${choices}]" item-title="label" item-value="value" ${labelFragment} :disabled="(!editMode && !${unlocked}) || ${disabled}" variant="outlined" density="compact"></v-select>
                `;
            }

            if (isStringExp(element)) {
                const choicesParam = element.params.find(p => isStringParamChoices(p)) as StringParamChoices | undefined;
                const valueParam = element.params.find(p => isStringParamValue(p)) as StringParamValue | undefined;

                if (valueParam !== undefined) {
                    return expandToNode`
                    <v-text-field 
                        name="${systemPath}"
                        v-model="context.${systemPath}" 
                        ${labelFragment} 
                        :disabled="true" 
                        variant="outlined" 
                        density="compact"
                        append-inner-icon="fa-solid fa-function" 
                        :data-tooltip="context.${systemPath}"></v-text-field>
                    `;
                }

                if (choicesParam !== undefined) {
                    // Map the choices to a string array
                    const choices = choicesParam.choices.map(c => `{ label: game.i18n.localize('${document.name}.${element.name}.${c}'), value: '${toMachineIdentifier(c)}' }`).join(", ");
                    return expandToNode`
                    <v-select 
                        name="${systemPath}" 
                        v-model="context.${systemPath}" 
                        :items="[${choices}]" 
                        item-title="label" 
                        item-value="value" 
                        :label="game.i18n.localize('${label}.label')"
                        :disabled="(!editMode && !${unlocked}) || ${disabled}"
                        variant="outlined" 
                        density="compact"></v-select>
                    `;
                }
                return expandToNode`
                    <i-text-field label="${label}" systemPath="${systemPath}" :context="context" :editMode="editMode" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-text-field>
                `;
            }

            if (isDocumentChoiceExp(element)) {
                const componentName = `${document.name.toLowerCase()}${element.name}DocumentChoice`;
                return expandToNode`
                    <${componentName} :context="context" :editMode="editMode" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></${componentName}>
                `;
            }

            if (isHtmlExp(element)) {
                return expandToNode`
                <i-prosemirror ${labelFragment} :field="context.editors['${systemPath}']" :disabled="(!editMode && !${unlocked})"></i-prosemirror>
                `;
            }

            if (isBooleanExp(element)) {
                return expandToNode`
                <v-checkbox v-model="context.${systemPath}" name="${systemPath}" ${labelFragment} :disabled="(!editMode && !${unlocked}) || ${disabled}" :color="primaryColor"></v-checkbox>
                `;
            }

            if (isNumberExp(element)) {
                // If this is a calculated value, we don't want to allow editing
                const valueParam = element.params.find(x => isNumberParamValue(x)) as NumberParamValue;

                if (valueParam != undefined) {
                    disabled = true;
                }

                return expandToNode`
                <v-number-input
                    controlVariant="stacked"
                    density="compact"
                    variant="outlined"
                    v-model="context.${systemPath}"
                    ${valueParam != undefined ? ` append-inner-icon="fa-solid fa-function" control-variant="hidden" class="calculated-number"` : ``}
                    name="${systemPath}"
                    ${labelFragment}
                    :disabled="(!editMode && !${unlocked}) || ${disabled}"
                >
                ${valueParam == undefined ? `
                <template #append-inner>
                    <i-calculator v-if="editMode" :context="context" :systemPath="'${systemPath}'" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-calculator>
                </template>
                ` : ``}
                </v-number-input>
                `;
            }

            if (isAttributeExp(element)) {
                const minParam = element.params.find(x => isNumberParamMin(x)) as NumberParamMin;
                const min = minParam?.value ?? 0;
                const hasMod = element.params.find(x => isAttributeParamMod(x)) != undefined;

                const modSystemPath = getSystemPath(element, ["mod"], undefined, false);
                const valueSystemPath = getSystemPath(element, ["value"], undefined, false);

                return expandToNode`
                    <i-attribute label="${label}" :hasMod="${hasMod}" :mod="context.${modSystemPath}" systemPath="${valueSystemPath}" :context="context" :min="${min}" :disabled="(!editMode && !${unlocked}) || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-attribute>
                `;
            }

            if (isResourceExp(element)) {
                return expandToNode`
                <i-resource label="${label}" systemPath="system.${element.name.toLowerCase()}" :context="context" :disabled="(!editMode && !${unlocked}) || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-resource>
                `;
            }

            if (isSingleDocumentExp(element)) {
                return expandToNode`
                <i-document-link label="${label}" systemPath="system.${element.name.toLowerCase()}" documentName="${element.document.ref?.name.toLowerCase()}" :context="context" :disabled="(!editMode && !${unlocked}) || ${disabled}" :secondaryColor="secondaryColor"></i-document-link>
                `;
            }

            if (isDateExp(element)) {
                return expandToNode`
                <i-datetime type="date" label="${label}" systemPath="system.${element.name.toLowerCase()}" :context="context" :disabled="(!editMode && !${unlocked}) || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-datetime>

                `;
            }

            if (isTimeExp(element)) {
                return expandToNode`
                <i-datetime type="time" label="${label}" systemPath="system.${element.name.toLowerCase()}" :context="context" :disabled="(!editMode && !${unlocked}) || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-datetime>
                `;
            }

            if (isDateTimeExp(element)) {
                return expandToNode`
                <i-datetime type="datetime-local" label="${label}" systemPath="system.${element.name.toLowerCase()}" :context="context" :disabled="(!editMode && !${unlocked}) || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-datetime>
                `;
            }

            if (isPaperDollExp(element)) {
                let sizeParam = element.params.find(x => isSizeParam(x)) as SizeParam;
                let size = sizeParam?.value ?? "40px";

                let imageParam = element.params.find(x => isImageParam(x)) as ImageParam;
                let image = imageParam?.value ?? `systems/${id}/img/paperdoll_default.png`;

                return expandToNode`
                <i-paperdoll label="${label}" systemPath="system.${element.name.toLowerCase()}" :context="context" :disabled="(!editMode && !${unlocked}) || ${disabled}" image="${image}" size="${size}" :slots="${element.name.toLowerCase()}Slots"></i-paperdoll>
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
