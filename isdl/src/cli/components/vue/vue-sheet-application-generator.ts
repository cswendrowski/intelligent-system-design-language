import * as path from 'node:path';
import * as fs from 'node:fs';
import {CompositeGeneratorNode, expandToNode, joinToNode, toString} from 'langium/generate';
import {
    Action,
    AttributeExp, AttributeRollParam,
    AttributeStyleParam,
    BackgroundParam, BooleanExp,
    BooleanParamValue, ChoiceCustomProperty, ChoiceStringValue,
    ClassExpression,
    ColorParam, DateExp, DateTimeExp, DiceField, DieChoicesParam, DieField,
    Document,
    DocumentArrayExp,
    DocumentChoiceExp,
    Entry, HtmlExp,
    IconParam,
    ImageParam,
    isAccess,
    isAction,
    isActor,
    isAttributeExp,
    isAttributeParamMod, isAttributeRollParam,
    isAttributeStyleParam,
    isBackgroundParam,
    isBooleanExp,
    isBooleanParamValue, isChoiceCustomProperty, isChoiceStringValue,
    isColorParam, isColumn,
    isDateExp,
    isDateTimeExp, isDiceField, isDiceFields, isDieChoicesParam,
    isDieField,
    isDocumentArrayExp,
    isDocumentChoiceExp,
    isEntry,
    isHtmlExp,
    isIconParam,
    isImageParam, isLabelParam, isMacroField, isMeasuredTemplateField,
    isMethodBlock,
    isNumberExp,
    isNumberParamMax,
    isNumberParamMin,
    isNumberParamValue,
    isPage,
    isPaperDollExp,
    isParentPropertyRefChoiceParam,
    isParentPropertyRefExp,
    isPipsExp,
    isProperty,
    isResourceExp, isRow,
    isSection,
    isSegmentsParameter,
    isSingleDocumentExp,
    isSizeParam,
    isStatusProperty, isStringChoiceField,
    isStringExp, isStringExtendedChoice,
    isStringParamChoices,
    isStringParamValue, isTableField,
    isTimeExp,
    isTrackerExp,
    isTrackerStyleParameter,
    isVisibilityParam, LabelParam, Layout,
    NumberExp,
    NumberFieldParams,
    NumberParamMax,
    NumberParamMin,
    NumberParamValue,
    Page,
    PaperDollExp,
    ParentPropertyRefChoiceParam,
    Property,
    ResourceExp,
    SegmentsParameter,
    SizeParam,
    StandardFieldParams, StringChoice, StringChoiceField, StringExp,
    StringParamChoices,
    StringParamValue, TableField, TimeExp, TrackerExp,
    TrackerStyleParameter,
    VisibilityParam
} from "../../../language/generated/ast.js";
import {getAllOfType, getDocument, getSystemPath, globalGetAllOfType, toMachineIdentifier} from '../utils.js';
import {generateDatatableComponent} from './vue-datatable-component-generator.js';
import {AstUtils} from 'langium';
import {generateActionComponent} from './vue-action-component-generator.js';
import {generateDocumentChoiceComponent} from './vue-document-choice-component-generator.js';
import {translateBodyExpressionToJavascript, translateExpression} from '../method-generator.js';
import {humanize} from "inflection";
import {generateVuetifyDatatableComponent} from "./vue-datatable2-component-generator.js";

export function generateDocumentVueComponent(entry: Entry, id: string, document: Document, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase());
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}App.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
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
    const actions = getAllOfType<Action>(document.body, isAction, false);
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

    //let tables = getAllOfType<TableField>(document.body, isTableField, true);
    let allTables = getAllOfType<TableField>(document.body, isTableField, false);

    function importDataTable2(table: TableField): CompositeGeneratorNode {
        const page = AstUtils.getContainerOfType<Page>(table, isPage);
        const pageName = page ? page.name : document.name;
        generateVuetifyDatatableComponent(id, document, pageName, table, destination);
        return expandToNode`
        import ${document.name}${pageName}${table.name}VuetifyDatatable from './components/datatables/${document.name.toLowerCase()}${pageName}${table.name}VuetifyDatatable.vue';
        `;
    }

    function importPageOfDataTable(page: Page): CompositeGeneratorNode {
        const tabs = getAllOfType<DocumentArrayExp>(page.body, isDocumentArrayExp, true);
        return expandToNode`
        ${joinToNode(tabs, tab => importDataTable(page.name.toLowerCase(), tab), {appendNewLineIfNotEmpty: true})}
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
            }`, {separator: ',', appendNewLineIfNotEmpty: true})}
        ];
        `;
    }

    const properties = getAllOfType<Property>(document.body, isProperty, false);

    function generateVisibilityState(element: Property | Action): CompositeGeneratorNode {
        if (element.modifier != undefined) {
            return expandToNode`
            '${element.name.toLowerCase()}': async () => {
                return '${element.modifier}';
            }
            `;
        }

        if (isProperty(element) || isAction(element)) {
            const standardParams = element.params as StandardFieldParams[];

            if (isStringExp(element)) {
                const stringValueParam = element.params.find(isStringParamValue) as StringParamValue | undefined;
                if (stringValueParam) {
                    return expandToNode`
                    '${element.name.toLowerCase()}': async (editMode) => {
                        return 'locked';
                    }
                    `;
                }
            }
            if (isBooleanExp(element)) {
                const booleanValueParam = element.params.find(isBooleanParamValue) as BooleanParamValue | undefined;
                if (booleanValueParam) {
                    return expandToNode`
                    '${element.name.toLowerCase()}': async (editMode) => {
                        return 'locked';
                    }
                    `;
                }
            }
            if (isNumberExp(element) || isAttributeExp(element) || isResourceExp(element) || isTrackerExp(element)) {
                const numberParams = element.params as NumberFieldParams[];
                const numberValueParam = numberParams.find(isNumberParamValue) as NumberParamValue | undefined;
                if (numberValueParam) {
                    return expandToNode`
                    '${element.name.toLowerCase()}': async (editMode) => {
                        return 'locked';
                    }
                    `;
                }
            }

            const visibilityParam = standardParams.find(function (p: any) {
                return isVisibilityParam(p);
            }) as VisibilityParam | undefined;
            if (visibilityParam) {

                if (isMethodBlock(visibilityParam.visibility)) {
                    // If the visibility is a method block, we need to return a function that returns the visibility
                    return expandToNode`
                    '${element.name.toLowerCase()}': async (editMode) => {
                        let update = {};
                        let embeddedUpdate = {};
                        let parentUpdate = {};
                        let parentEmbeddedUpdate = {};
                        let targetUpdate = {};
                        let targetEmbeddedUpdate = {};
                        let selfDeleted = false;
                        let rerender = false;
                        const context = {
                            object: document,
                            target: game.user.getTargetOrNothing()
                        };
                        // If this is an item, attach the parent
                        if (document.documentName === "Item" && document.parent) {
                            context.actor = document.parent;
                        }
                        else {
                            context.actor = document;
                        }
                        const visibility = async (system) => {
                            ${translateBodyExpressionToJavascript(entry, id, visibilityParam.visibility.body, false, element)}
                        };
                        const returnedVisibility = await visibility(props.context.system);
                        if (!selfDeleted && Object.keys(update).length > 0) {
                            await document.update(update);
                            rerender = true;
                        }
                        if (!selfDeleted && Object.keys(embeddedUpdate).length > 0) {
                            for (let key of Object.keys(embeddedUpdate)) {
                                await document.updateEmbeddedDocuments("Item", embeddedUpdate[key]);
                            }
                            rerender = true;
                        }
                        if (Object.keys(parentUpdate).length > 0) {
                            await document.parent.update(parentUpdate);
                            rerender = true;
                        }
                        if (Object.keys(parentEmbeddedUpdate).length > 0) {
                            for (let key of Object.keys(parentEmbeddedUpdate)) {
                                await document.parent.updateEmbeddedDocuments("Item", parentEmbeddedUpdate[key]);
                            }
                        }
                        if (Object.keys(targetUpdate).length > 0) {
                            await context.target.update(targetUpdate);
                        }
                        if (Object.keys(targetEmbeddedUpdate).length > 0) {
                            for (let key of Object.keys(targetEmbeddedUpdate)) {
                                await context.target.updateEmbeddedDocuments("Item", targetEmbeddedUpdate[key]);
                            }
                        }
                        if (rerender) {
                            document.sheet.render();
                        }
                        return returnedVisibility ?? "default";
                    }
                    `;
                }

                return expandToNode`
                '${element.name.toLowerCase()}': async (editMode) => {
                    return '${visibilityParam.visibility}';
                }
                `;
            }
        }

        return expandToNode`
        '${element.name.toLowerCase()}': async (editMode) => {
            return 'default';
        }
        `;
    }

    const attributes = getAllOfType<AttributeExp>(document.body, isAttributeExp, false);

    function generateAttributeRollMethod(attribute: AttributeExp): CompositeGeneratorNode {
        const rollParam = attribute.params.find(isAttributeRollParam) as AttributeRollParam | undefined;
        if (rollParam) {
            return expandToNode`
            const on${toMachineIdentifier(attribute.name)}AttributeRoll = async () => {
                const context = {
                    object: document
                };
                const roll = ${translateExpression(entry, id, rollParam.roll, false, attribute)};
                // Create the chat message
                const ${attribute.name}Description = context.object.description ?? context.object.system.description;
                const ${attribute.name}Context = { 
                    cssClass: "${id} ${toMachineIdentifier(attribute.name)}",
                    document: context.object,
                    description: ${attribute.name}Description,
                    hasDescription: ${attribute.name}Description!= "",
                    parts: [
                        {
                            label: "${humanize(attribute.name)} Attribute Roll",
                            value: roll,
                            isRoll: true,
                            wide: true, 
                            tooltip: await roll.getTooltip()
                        }
                    ],
                    tags: []
                };
                const ${attribute.name}Content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", ${attribute.name}Context);
                await ChatMessage.create({
                    user: game.user._id,
                    speaker: ChatMessage.getSpeaker(),
                    content: ${attribute.name}Content,
                    flavor: "",
                    type: ${attribute.name}Context.parts.find(x => x.isRoll) ? null : CONST.CHAT_MESSAGE_STYLES.IC,
                    rolls: Array.from(${attribute.name}Context.parts.filter(x => x.isRoll).map(x => x.value)),
                });
            };
            `;
        }
        return expandToNode``;
    }

    return expandToNode`
    <script setup>
        import { ref, watch, inject, computed, watchEffect } from "vue";
        ${joinToNode(tabs, tab => importDataTable(document.name, tab), {appendNewLineIfNotEmpty: true})}
        ${joinToNode(allTables, table => importDataTable2(table), {appendNewLineIfNotEmpty: true})}
        ${joinToNode(pages, importPageOfDataTable, {appendNewLineIfNotEmpty: true})}
        ${joinToNode(actions, importActionComponent, {appendNewLineIfNotEmpty: true})}
        ${joinToNode(documentChoices, importDocumentChoiceComponent, {appendNewLineIfNotEmpty: true})}
        import ${entry.config.name}Roll from "../../../../rolls/roll.mjs";
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
        let storedColors = game.settings.get('${id}', 'documentColorThemes');
        const primaryColor = ref(storedColors[document.uuid]?.primary ?? '#1565c0');
        const secondaryColor = ref(storedColors[document.uuid]?.secondary ?? '#4db6ac');
        const tertiaryColor = ref(storedColors[document.uuid]?.tertiary ?? '#ffb74d');

        const setupColors = () => {
            const colors = {
                primary: primaryColor.value,
                secondary: secondaryColor.value,
                tertiary: tertiaryColor.value
            };
            game.settings.set('${id}', 'documentColorThemes', { ...storedColors, [document.uuid]: colors });
        };
        const resetColors = () => {
            primaryColor.value = '#1565c0';
            secondaryColor.value = '#4db6ac';
            teritaryColor.value = '#ffb74d';
            setupColors();
        };

        watch(primaryColor, () => {
            setupColors();
        });
        watch(secondaryColor, () => {
            setupColors();
        });
        watch(tertiaryColor, () => {
            setupColors();
        });

        // Pages and Tabs
        const lastStates = game.settings.get('${id}', 'documentLastState');
        const lastState = lastStates[document.uuid] ?? {
            page: '${document.name.toLowerCase()}',
            tab: 'description'
        };

        const drawer = ref(false);
        const page = ref(lastState.page);
        const tab = ref(lastState.tab);
        const pageDefaultTabs = {
            '${document.name.toLowerCase()}': 'description',
            ${joinToNode(pages, getPageFirstTab, {separator: ',', appendNewLineIfNotEmpty: true})}
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
            '${document.name.toLowerCase()}': 'topography',
            ${joinToNode(pages, getPageBackground, {separator: ',', appendNewLineIfNotEmpty: true})}
        };

        const pageBackground = computed(() => {
            if (editMode.value) {
                return 'edit-mode';
            }
            if (props.context.system.dead) {
                return 'dead';
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

        function spawnDatatableWindow(e, pageName, tabName) {
            if (event.button === 1) {
                event.preventDefault();
                event.stopPropagation();
                const tableName = \`${isActor(document) ? 'actor' : 'item'}${document.name}\${pageName}\${tabName}\`;
                const systemName = "system." + tabName.toLowerCase();
                const sheet = new game.system.datatableApp(document, tableName, systemName, tabName);
                sheet.render(true);
            }
        }

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
                width: '200px',
                render: function (data, type, context) {
                    if (type === 'display') {
                        return \`<span data-tooltip="\${context.description}">\${data}</span>\`;
                    }
                    return data;
                }
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
                console.dir(data, data.uuid);
                row.setAttribute("data-id", data._id);
                row.setAttribute("data-uuid", data.uuid);
                row.setAttribute("data-type", 'ActiveEffect');
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
        ${joinToNode(paperDoll, paperDollSlots, {appendNewLineIfNotEmpty: true})}

        // Visibility states
        const visibilityStatesMethods = {
            ${joinToNode(properties, generateVisibilityState, {separator: ',', appendNewLineIfNotEmpty: true})},
            ${joinToNode(actions, generateVisibilityState, {separator: ',', appendNewLineIfNotEmpty: true})}
        };
        const visibilityStates = {
            ${joinToNode(properties, element => expandToNode`
                '${element.name.toLowerCase()}': ref('default')
            `, {separator: ',', appendNewLineIfNotEmpty: true})},
            ${joinToNode(actions, element => expandToNode`
                '${element.name.toLowerCase()}': ref('default')
            `, {separator: ',', appendNewLineIfNotEmpty: true})}
        };
        const updateVisibilityStates = async () => {
            ${joinToNode(properties, element => expandToNode`visibilityStates['${element.name.toLowerCase()}'].value = await visibilityStatesMethods['${element.name.toLowerCase()}'](editMode.value);`, {
        separator: '\n',
        appendNewLineIfNotEmpty: true
    })}
            ${joinToNode(actions, element => expandToNode`visibilityStates['${element.name.toLowerCase()}'].value = await visibilityStatesMethods['${element.name.toLowerCase()}'](editMode.value);`, {
        separator: '\n',
        appendNewLineIfNotEmpty: true
    })}
        };
        watchEffect(async () => {
            await updateVisibilityStates();
        });
        const currentCombatant = ref(game.combat?.combatant);
        Hooks.on("combatTurnChange", () => {
            currentCombatant.value = game.combat?.combatant;
        });
        watch(currentCombatant, async () => {
            await updateVisibilityStates();
        });
        const isHidden = (type) => {
            const visibility = visibilityStates[type].value;
            if (visibility === "hidden") {
                return true;
            }
            if (visibility === "gmOnly") {
                return !game.user.isGM;
            }
            if (visibility === "secret") {
                const isGm = game.user.isGM;
                const isOwner = document.getUserLevel(game.user) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
                return !isGm && !isOwner;
            }
            if (visibility === "edit") {
                return !editMode.value;
            }

            // Default to visible
            return false;
        };

        const isDisabled = (type) => {
            const visibility = visibilityStates[type].value;
            const disabledStates = ["readonly", "locked"];
            if (disabledStates.includes(visibility)) {
                return true;
            }
            if (visibility === "gmEdit") {
                const isGm = game.user.isGM;
                const isEditMode = editMode.value;
                return !isGm && !isEditMode;
            }

            if (visibility === "unlocked") {
                return false;
            }
            
            // Default to enabled while in editMode
            return !editMode.value;
        };

        const getLabel = (label, icon) => {
            const localized = game.i18n.localize(label);
            if (icon) {
                return \`<i class="\${icon}"></i> \${localized}\`;
            }
            return localized;
        };
        
        // Attribute roll methods
        ${joinToNode(attributes, generateAttributeRollMethod, {appendNewLineIfNotEmpty: true})}
    </script>
    <style>
    </style>
    `;
}

function generateVueComponentTemplate(id: string, document: Document): CompositeGeneratorNode {
    const pages = getAllOfType<Page>(document.body, isPage);
    const firstPageTabs = document.body.filter(isDocumentArrayExp);
    const firstPageTables = document.body.filter(isTableField); // We explicitly only want top-level tables
    return expandToNode`
    <template>
        <v-app>
            <!-- App Bar -->
            <v-app-bar :color="editMode ? 'amber-accent-3' : primaryColor" density="comfortable">
                <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
                <v-app-bar-title v-if="!editMode">{{ context.document.name }}</v-app-bar-title>
                <v-text-field name="name" v-model="context.document.name" variant="outlined" class="document-name" v-if="editMode" density="compact"></v-text-field>
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
                    <v-tab value="${document.name.toLowerCase()}" prepend-icon="fa-solid fa-circle-user">${document.name}</v-tab>
                    ${joinToNode(pages, generateNavListItem, {appendNewLineIfNotEmpty: true})}
                </v-tabs>
                <template v-slot:append>
                    <div class="pa-2">
                        <v-btn block @click="setupColors" :color="secondaryColor" prepend-icon="fa-solid fa-palette">
                        Setup Colors

                        <v-dialog activator="parent" max-width="1000">
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
                                    <v-spacer></v-spacer>
                                    <div class="d-flex flex-column">
                                        <v-label>Tertiary Color</v-label>
                                        <v-color-picker hide-inputs hide-sliders hide-canvas show-swatches v-model="tertiaryColor" swatches-max-height="500px"></v-color-picker>
                                    </div>
                                </div>
                                <h3>Preview</h3>
                                <div class="d-flex flex-row"style="overflow-x: scroll; padding-left: 0.5rem; padding-right: 0.5rem;">
                                    <div
                                        v-for="i in 10"
                                        :key="i"
                                        :style="{
                                            flex: 1,
                                            minWidth: '5px',
                                            flexShrink: 0,
                                            height: '30px',
                                            backgroundColor: i <= 4 ? primaryColor : (i <= 6 ? tertiaryColor : 'transparent'),
                                            border: i <= value ? 'none' : '2px solid ' + secondaryColor,
                                            transform: 'skewX(-20deg)',
                                            borderRadius: '2px'
                                        }"
                                    />
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
                        <v-tabs-window-item value="${document.name.toLowerCase()}" data-tab="${document.name.toLowerCase()}">
                            <v-row dense>
                                ${joinToNode(document.body, element => generateElement(element, true), {appendNewLineIfNotEmpty: true})}
                            </v-row>
                            <v-divider class="mt-4 mb-2"></v-divider>
                            <v-tabs v-model="tab" grow always-center>
                                    <v-tab value="description" prepend-icon="fa-solid fa-book">Description</v-tab>
                                    ${joinToNode(firstPageTabs, generateTab, {appendNewLineIfNotEmpty: true})}
                                    ${joinToNode(firstPageTables, table => generateTab(table), {appendNewLineIfNotEmpty: true})}
                                    <v-tab value="effects" prepend-icon="fa-solid fa-sparkles" @mousedown="spawnDatatableWindow($event, '${document.name}', 'effects')">Effects</v-tab>
                            </v-tabs>
                            <v-tabs-window v-model="tab" class="tabs-window">
                                <v-tabs-window-item value="description" data-tab="description" class="tabs-container">
                                    <i-prosemirror :field="context.editors['system.description']" :disabled="!editMode"></i-prosemirror>
                                </v-tabs-window-item>
                                ${joinToNode(firstPageTabs, tab => generateDataTable(document.name, tab))}
                                ${joinToNode(firstPageTables, table => generateVuetifyDatatable(document.name, table), {appendNewLineIfNotEmpty: true})}
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
                    ${joinToNode(pages, generatePageBody, {appendNewLineIfNotEmpty: true})}
                    </v-tabs-window>
                </v-container>
            </v-main>
        </v-app>
    </template>
    `;

    function generateTab(tab: DocumentArrayExp | TableField): CompositeGeneratorNode {
        const iconParam = tab.params.find(p => isIconParam(p)) as IconParam | undefined;
        const icon = iconParam?.value ?? "fa-solid fa-table";
        const page = AstUtils.getContainerOfType(tab, isPage) as Page;
        const pageName = page ? page.name : document.name;
        return expandToNode`
            <v-tab value="${tab.name.toLowerCase()}" prepend-icon="${icon}" @mousedown="spawnDatatableWindow($event, '${pageName}', '${tab.name}')">{{ game.i18n.localize('${tab.name}') }}</v-tab>
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
        const tabs = page.body.filter(isDocumentArrayExp); // We explictly only want top-level tabs
        const tables = page.body.filter(isTableField); // We explictly only want top-level tables
        return expandToNode`
        <v-tabs-window-item value="${page.name.toLowerCase()}" data-tab="${page.name.toLowerCase()}">
            <v-row dense>
                ${joinToNode(page.body, element => generateElement(element, true), {appendNewLineIfNotEmpty: true})}
            </v-row>
            <v-divider class="mt-4 mb-2"></v-divider>
            <v-tabs v-model="tab" grow always-center>
                ${joinToNode(tabs, generateTab, {appendNewLineIfNotEmpty: true})}
                ${joinToNode(tables, generateTab, {appendNewLineIfNotEmpty: true})}
            </v-tabs>
            <v-tabs-window v-model="tab" class="tabs-window">
                ${joinToNode(tabs, tab => generateDataTable(page.name.toLowerCase(), tab))}
                ${joinToNode(tables, table => generateVuetifyDatatable(page.name, table), {appendNewLineIfNotEmpty: true})}
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

    function generateVuetifyDatatable(pageName: string, element: TableField): CompositeGeneratorNode {
        const systemPath = getSystemPath(element, [], undefined, false);
        let componentName = `${document.name}${pageName}${element.name}VuetifyDatatable`;
        return expandToNode`
        <v-tabs-window-item value="${element.name.toLowerCase()}" data-tab="${element.name.toLowerCase()}" data-type="table" class="tabs-container">
            <${componentName} systemPath="${systemPath}" :context="context" :primaryColor="primaryColor" :secondaryColor="secondaryColor" :teritaryColor="teritaryColor"></${componentName}>
        </v-tabs-window-item>
        `.appendNewLine();
    }

    function generateElement(element: Page | ClassExpression | Layout, isTopLevel = false): CompositeGeneratorNode {

        if (isSection(element)) {
            return expandToNode`
            <v-col class="pl-1 pr-1 section">
                <v-card variant="outlined" elevation="4">
                    <v-card-title>{{ game.i18n.localize('${document.name}.${element.name}') }}</v-card-title>

                    <v-card-text>
                        <v-row dense>
                            ${joinToNode(element.body, element => generateElement(element), {appendNewLineIfNotEmpty: true})}
                        </v-row>
                   </v-card-text>
                </v-card>
            </v-col>
            `;
        }

        if (isRow(element)) {
            return expandToNode`
            <v-row dense>
                ${joinToNode(element.body, element => generateElement(element), {appendNewLineIfNotEmpty: true})}
            </v-row>
            `;
        }

        if (isColumn(element)) {
            return expandToNode`
            <v-col>
                ${joinToNode(element.body, element => generateElement(element), {appendNewLineIfNotEmpty: true})}
            </v-col>
            `;
        }

        // We don't render these elements as part of this function
        if (isPage(element) || isAccess(element) || isStatusProperty(element) || isPipsExp(element)) {
            return expandToNode``;
        }

        if (isAction(element)) {
            const componentName = `${document.name.toLowerCase()}${element.name}Action`;

            const colorParam = element.params.find(x => isColorParam(x)) as ColorParam | undefined;
            const primaryColor = colorParam ? `'${colorParam.value}'` : "primaryColor";

            return expandToNode`
            <${componentName} 
                :context="context" 
                :color="${primaryColor}"
                :editMode="editMode" 
                :visibility="visibilityStates['${element.name.toLowerCase()}'].value">
            </${componentName}>
            `;
        }

        if (!isProperty(element)) return expandToNode``;

        if (isProperty(element)) {
            if (element.modifier == "hidden") return expandToNode``;

            if (element.name == "RollVisualizer") {
                return expandToNode`
                <i-roll-visualizer :context="context"></i-roll-visualizer>
                `;
            }

            const standardParams = element.params as StandardFieldParams[];
            const iconParam = standardParams.find(p => isIconParam(p)) as IconParam | undefined;

            const colorParam = standardParams.find(p => isColorParam(p)) as ColorParam | undefined;

            const label = `${document.name}.${element.name}`;
            const labelFragment = `
                <template #label>
                    <span v-html="getLabel('${label}', ${iconParam ? `'${iconParam.value}'` : undefined})" />
                </template>`;
            const standardParamsFragment = colorParam ? `:disabled="isDisabled('${element.name.toLowerCase()}')" v-if="!isHidden('${element.name.toLowerCase()}')" color="${colorParam.value}"` : `:disabled="isDisabled('${element.name.toLowerCase()}')" v-if="!isHidden('${element.name.toLowerCase()}')"`;
            const systemPath = getSystemPath(element, [], undefined, false);

            const entry = AstUtils.getContainerOfType(element, isEntry) as Entry;

            if (isParentPropertyRefExp(element)) {
                const choicesParam = element.params.find(p => isParentPropertyRefChoiceParam(p)) as ParentPropertyRefChoiceParam | undefined;
                let allChoices: Property[] = [];
                switch (element.propertyType) {
                    case "attribute":
                        allChoices = globalGetAllOfType<AttributeExp>(entry, isAttributeExp);
                        break;
                    case "resource":
                        allChoices = globalGetAllOfType<ResourceExp>(entry, isResourceExp);
                        break;
                    case "number":
                        allChoices = globalGetAllOfType<NumberExp>(entry, isNumberExp);
                        break;
                    case "boolean":
                        allChoices = globalGetAllOfType<BooleanExp>(entry, isBooleanExp);
                        break;
                    case "date":
                        allChoices = globalGetAllOfType<DateExp>(entry, isDateExp);
                        break;
                    case "time":
                        allChoices = globalGetAllOfType<TimeExp>(entry, isTimeExp);
                        break;
                    case "datetime":
                        allChoices = globalGetAllOfType<DateTimeExp>(entry, isDateTimeExp);
                        break;
                    case "die":
                        allChoices = globalGetAllOfType<DieField>(entry, isDieField);
                        break;
                    case "dice":
                        allChoices = globalGetAllOfType<DiceField>(entry, isDiceField);
                        break;
                    case "string":
                        allChoices = globalGetAllOfType<StringExp>(entry, isStringExp);
                        break;
                    case "tracker":
                        allChoices = globalGetAllOfType<TrackerExp>(entry, isTrackerExp);
                        break;
                    case "choice":
                        allChoices = globalGetAllOfType<DocumentChoiceExp>(entry, isDocumentChoiceExp);
                        break;
                    case "paperdoll":
                        allChoices = globalGetAllOfType<PaperDollExp>(entry, isPaperDollExp);
                        break;
                    case "html":
                        allChoices = globalGetAllOfType<HtmlExp>(entry, isHtmlExp);
                        break;
                    //default: console.error("Unsupported parent property type: " + element.propertyType); break;
                }
                let refChoices = allChoices.map(x => {
                    let parentDocument = getDocument(x);

                    if (choicesParam && choicesParam.choices.length > 0) {
                        if (!choicesParam.choices.find(y => {
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
                <v-select 
                    name="${systemPath}" 
                    v-model="context.${systemPath}" 
                    :items="[${choices}]" 
                    item-title="label" 
                    item-value="value" 
                    ${standardParamsFragment} 
                    variant="outlined" 
                    class="double-wide"
                    density="compact">
                        <template #label>
                            <span v-html="getLabel('${label}', ${iconParam ? `'${iconParam.value}'` : undefined})" />
                        </template>
                </v-select>
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
                        ${standardParamsFragment}
                        variant="outlined" 
                        density="compact"
                        append-inner-icon="fa-solid fa-function" 
                        :data-tooltip="context.${systemPath}">
                        ${labelFragment}
                    </v-text-field>
                    `;
                }

                if (choicesParam !== undefined) {

                    function choiceValue(choice: StringChoice): string {
                        if (!isStringExtendedChoice(choice.value)) {
                            return toMachineIdentifier(choice.value);
                        }
                        let value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                        if (value) {
                            return toMachineIdentifier(value.value);
                        }
                        let label = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
                        if (label) {
                            return toMachineIdentifier(label.value);
                        }
                        return "unknown";
                    }

                    // Map the choices to a string array
                    const choices = choicesParam.choices.map(c => `{ label: game.i18n.localize('${document.name}.${element.name}.${choiceValue(c)}'), value: '${choiceValue(c)}' }`).join(", ");
                    return expandToNode`
                    <v-select 
                        name="${systemPath}" 
                        v-model="context.${systemPath}" 
                        :items="[${choices}]" 
                        item-title="label" 
                        item-value="value" 
                        ${standardParamsFragment}
                        variant="outlined" 
                        density="compact">
                        <template #label>
                            <span v-html="getLabel('${label}.label', ${iconParam ? `'${iconParam.value}'` : undefined})" />
                        </template>
                    </v-select>
                    `;
                }
                return expandToNode`
                    <i-text-field 
                        label="${label}"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        ${standardParamsFragment}
                        :context="context"
                        :editMode="editMode" 
                        :primaryColor="primaryColor" 
                        :secondaryColor="secondaryColor">
                    </i-text-field>
                `;
            }

            if (isStringChoiceField(element)) {
                const choicesParam = element.params.find(p => isStringParamChoices(p)) as StringParamChoices | undefined;
                if (!choicesParam) {
                    console.warn(`StringChoiceField ${element.name} does not have a choices parameter.`);
                    return expandToNode``;
                }
                if (choicesParam?.choices?.length === 0) return expandToNode``;

                function choiceValue(choice: StringChoice): string {
                    if (!isStringExtendedChoice(choice.value)) {
                        return toMachineIdentifier(choice.value);
                    }
                    let value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                    if (value) {
                        return toMachineIdentifier(value.value);
                    }
                    let label = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
                    if (label) {
                        return toMachineIdentifier(label.value);
                    }
                    return "unknown";
                }

                function choiceData(choice: StringChoice): CompositeGeneratorNode {
                    let choiceField = element as StringChoiceField;
                    if (!isStringExtendedChoice(choice.value)) {
                        return expandToNode`{ label: game.i18n.localize('${document.name}.${choiceField.name}.${choiceValue(choice)}'), value: '${choiceValue(choice)}', icon: '', color: '' }`;
                    }
                    let icon = choice.value.properties.find(isIconParam) as IconParam | undefined;
                    let color = choice.value.properties.find(isColorParam) as ColorParam | undefined;

                    if (isStringExtendedChoice(choice.value)) {
                        let customProperties = choice.value.properties.filter(isChoiceCustomProperty) as ChoiceCustomProperty[];

                        if (customProperties.length > 0) {
                            return expandToNode`{ label: game.i18n.localize('${document.name}.${choiceField.name}.${choiceValue(choice)}'), value: '${choiceValue(choice)}', icon: '${icon?.value ?? ""}', color: '${color?.value ?? ""}', customKeys: [${joinToNode(customProperties, custom => `{ key: '${custom.key}', label: '${humanize(custom.key)}', value: ${custom.value} }`, {separator: ','})}] }`;
                        }
                    }

                    return expandToNode`{ label: game.i18n.localize('${document.name}.${choiceField.name}.${choiceValue(choice)}'), value: '${choiceValue(choice)}', icon: '${icon?.value ?? ""}', color: '${color?.value ?? ""}' }`;
                }

                return expandToNode`
                    <i-extended-choice
                        label="${label}.label"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        :context="context"
                        :items="[${joinToNode(choicesParam.choices, choiceData, {separator: ',', appendNewLineIfNotEmpty: true})}]"
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor"
                        ${standardParamsFragment}
                    ></i-extended-choice>
                    `;

            }

            if (isDocumentChoiceExp(element)) {
                const componentName = `${document.name.toLowerCase()}${element.name}DocumentChoice`;
                return expandToNode`
                    <${componentName}
                        label="${label}"
                        icon="${iconParam?.value}"
                        :context="context"
                        :editMode="editMode"
                        ${standardParamsFragment}
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor">
                    </${componentName}>
                `;
            }

            if (isMacroField(element)) {
                return expandToNode`
                    <i-macro
                        label="${label}"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        ${standardParamsFragment}
                        :context="context"
                        :editMode="editMode"
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor">
                    </i-macro>
                `;
            }

            if (isHtmlExp(element)) {
                return expandToNode`
                <i-prosemirror
                    label="${label}"
                    icon="${iconParam?.value}"
                    :field="context.editors['${systemPath}']"
                    ${standardParamsFragment}>
                </i-prosemirror>
                `;
            }

            if (isMeasuredTemplateField(element)) {
                return expandToNode`
                <i-measured-template
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${systemPath}"
                    :primaryColor="primaryColor"
                    :secondaryColor="secondaryColor"
                    ${standardParamsFragment}>
                </i-measured-template>
                `;
            }

            if (isBooleanExp(element)) {
                return expandToNode`
                <v-checkbox
                    v-model="context.${systemPath}"
                    name="${systemPath}"
                    ${standardParamsFragment}
                    :color="primaryColor">
                    ${labelFragment}
                </v-checkbox>
                `;
            }

            if (isNumberExp(element)) {
                // If this is a calculated value, we don't want to allow editing
                const valueParam = element.params.find(x => isNumberParamValue(x)) as NumberParamValue;

                return expandToNode`
                <v-number-input
                    controlVariant="stacked"
                    density="compact"
                    variant="outlined"
                    ${valueParam != undefined ? ` append-inner-icon="fa-solid fa-function" control-variant="hidden" class="calculated-number" :model-value="context.${systemPath}"` : `v-model="context.${systemPath}"`}
                    name="${systemPath}"
                    ${standardParamsFragment}
                >
                ${labelFragment}
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
                const styleParam = element.params.find(x => isAttributeStyleParam(x)) as AttributeStyleParam | undefined;
                const style = styleParam?.style ?? "box";

                const rollParam = element.params.find(x => isAttributeRollParam(x)) as AttributeRollParam | undefined;

                return expandToNode`
                    <i-attribute 
                        label="${label}"
                        icon="${iconParam?.value}"
                        attributeStyle="${style}"
                        :editMode="editMode"
                        :hasMod="${hasMod}" 
                        :mod="context.${modSystemPath}"
                        systemPath="${valueSystemPath}" 
                        :context="context" 
                        :min="${min}" 
                        ${standardParamsFragment}
                        :primaryColor="primaryColor" 
                        :secondaryColor="secondaryColor"
                        :roll="${rollParam ? expandToNode`on${element.name}AttributeRoll` : expandToNode`undefined`}"
                        :hasRoll="${rollParam != undefined}"
                        >
                    </i-attribute>
                `;
            }

            // if () {
            //     return expandToNode`
            //     <i-resource
            //         label="${label}"
            //         icon="${iconParam?.value}"
            //         systemPath="system.${element.name.toLowerCase()}"
            //         :context="context"
            //         ${standardParamsFragment}
            //         :primaryColor="primaryColor"
            //         :secondaryColor="secondaryColor">
            //     </i-resource>
            //     `;
            // }

            if (isTrackerExp(element) || isResourceExp(element)) {
                const styleParam = element.params.find(x => isTrackerStyleParameter(x)) as TrackerStyleParameter;
                const style = styleParam?.style ?? "bar";

                const iconParam = element.params.find(x => isIconParam(x)) as IconParam | undefined;
                const icon = iconParam?.value ?? undefined;

                const minParam = element.params.find(x => isNumberParamMin(x)) as NumberParamMin;
                const disableMin = minParam?.value != undefined;
                let hideMin = false;

                const valueParam = element.params.find(x => isNumberParamValue(x)) as NumberParamValue;
                const disableValue = valueParam?.value != undefined;

                const maxParam = element.params.find(x => isNumberParamMax(x)) as NumberParamMax;
                const disableMax = maxParam?.value != undefined;

                const colorParam = element.params.find(x => isColorParam(x)) as ColorParam | undefined;
                const primaryColor = colorParam ? `'${colorParam.value}'` : "primaryColor";

                const segmentParm = element.params.find(x => isSegmentsParameter(x)) as SegmentsParameter | undefined;
                const segments = segmentParm?.segments ?? 1;

                let isHealth = false;
                let isWounds = false;
                if (isResourceExp(element)) {
                    hideMin = true;
                    isHealth = element.tag == "health";
                    isWounds = element.tag == "wounds";
                }

                return expandToNode`
                <i-tracker 
                    label="${label}"
                    systemPath="system.${element.name.toLowerCase()}" :context="context" 
                    :visibility="visibilityStates['${element.name.toLowerCase()}'].value"
                    :editMode="editMode"
                    :primaryColor="${primaryColor}" :secondaryColor="secondaryColor" :tertiaryColor="tertiaryColor"
                    trackerStyle="${style}"
                    icon="${icon}" 
                    :hideMin="${hideMin}"
                    :disableMin="${disableMin}"
                    :disableValue="${disableValue}"
                    :disableMax="${disableMax}"
                    :segments="${segments}"
                    :isHealth="${isHealth}"
                    :isWounds="${isWounds}"
                    ></i-tracker>
                `;
            }

            if (isSingleDocumentExp(element)) {
                return expandToNode`
                <i-document-link 
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="system.${element.name.toLowerCase()}" 
                    documentName="${element.document.ref?.name.toLowerCase()}" 
                    :context="context" 
                    ${standardParamsFragment} 
                    :secondaryColor="secondaryColor">
                </i-document-link>
                `;
            }

            if (isDateExp(element)) {
                return expandToNode`
                <i-datetime 
                    type="date" 
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="system.${element.name.toLowerCase()}" 
                    :context="context" 
                    ${standardParamsFragment}
                    :primaryColor="primaryColor" :secondaryColor="secondaryColor">
                </i-datetime>
                `;
            }

            if (isTimeExp(element)) {
                return expandToNode`
                <i-datetime 
                    type="time" 
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="system.${element.name.toLowerCase()}" 
                    :context="context" 
                    ${standardParamsFragment}
                    :primaryColor="primaryColor" :secondaryColor="secondaryColor">
                </i-datetime>
                `;
            }

            if (isDateTimeExp(element)) {
                return expandToNode`
                <i-datetime 
                    type="datetime-local" 
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="system.${element.name.toLowerCase()}" 
                    :context="context" 
                    ${standardParamsFragment}
                    :primaryColor="primaryColor" :secondaryColor="secondaryColor">
                </i-datetime>
                `;
            }

            if (isPaperDollExp(element)) {
                let sizeParam = element.params.find(x => isSizeParam(x)) as SizeParam;
                let size = sizeParam?.value ?? "40px";

                let imageParam = element.params.find(x => isImageParam(x)) as ImageParam;
                let image = imageParam?.value ?? `systems/${id}/img/paperdoll_default.png`;

                return expandToNode`
                <i-paperdoll 
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="system.${element.name.toLowerCase()}" 
                    :context="context" 
                    ${standardParamsFragment}
                    image="${image}" 
                    size="${size}" 
                    :slots="${element.name.toLowerCase()}Slots">
                </i-paperdoll>
                `;
            }

            if (isDiceFields(element)) {
                let choicesParam = element.params.find(x => isDieChoicesParam(x)) as DieChoicesParam | undefined;
                let choices = choicesParam ? `[${choicesParam.choices.join(", ")}]` : "[ 'd4', 'd6', 'd8', 'd10', 'd12', 'd20' ]";

                if (isDieField(element)) {
                    // render as a simple dropdown
                    return expandToNode`
                    <v-select 
                        name="${systemPath}" 
                        v-model="context.${systemPath}" 
                        :items="${choices}" 
                        ${standardParamsFragment} 
                        variant="outlined" 
                        density="compact">
                        <template #label>
                            <span v-html="getLabel('${label}', ${iconParam ? `'${iconParam.value}'` : undefined})" />
                        </template>
                        <template #prepend-inner>
                            <i :class="'fa-solid fa-dice-' + context.${systemPath}"></i>
                        </template>
                    </v-select>
                    `;
                }

                if (isDiceField(element)) {
                    // A custom input with both a number input and a dropdown for the die type
                    return expandToNode`
                        <v-input 
                            name="${systemPath}"
                            v-model="context.${systemPath}"
                            class="isdl-dice-field"
                            v-if="!isHidden('${element.name.toLowerCase()}')"
                            >
                            <template #label>
                                <span v-html="getLabel('${label}', ${iconParam ? `'${iconParam.value}'` : undefined})" />
                            </template>
                            <div class="d-flex">
                                <v-number-input
                                    v-model="context.${systemPath}" 
                                    :min="0" 
                                    :step="1" 
                                    variant="outlined" 
                                    density="compact"
                                    :disabled="isDisabled('${element.name.toLowerCase()}')"
                                    class="flex-grow-1"
                                    
                                    style="max-width: 100px;"
                                    name="${systemPath}.number"
                                >
                                
                                </v-number-input>
                                <v-select 
                                    v-model="context.${systemPath}" 
                                    :items="${choices}" 
                                    item-value="value" 
                                    item-title="label"
                                    :disabled="isDisabled('${element.name.toLowerCase()}')"
                                    variant="outlined"
                                    density="compact">
                                </v-select>
                            </div>
                        </v-input>
                    `;
                }
            }

            if (isTableField(element)) {
                if (isTopLevel) return expandToNode``;
                const page = AstUtils.getContainerOfType(element, isPage) as Page;
                const pageName = page?.name ?? document.name;
                const systemPath = getSystemPath(element, [], undefined, false);
                let componentName = `${document.name}${pageName}${element.name}VuetifyDatatable`;
                return expandToNode`
                    <${componentName} systemPath="${systemPath}" :context="context" :primaryColor="primaryColor" :secondaryColor="secondaryColor" :teritaryColor="teritaryColor"></${componentName}>
                `.appendNewLine();
            }

            if (isDocumentArrayExp(element)) {
                if (isTopLevel) return expandToNode``;
                const page = AstUtils.getContainerOfType(element, isPage) as Page;
                const pageName = page?.name ?? document.name;
                const systemPath = getSystemPath(element, [], undefined, false);
                return expandToNode`
                    <${document.name}${pageName}${element.name}Datatable systemPath="${systemPath}" :context="context"></${document.name}${pageName}${element.name}Datatable>
                `.appendNewLine();
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
