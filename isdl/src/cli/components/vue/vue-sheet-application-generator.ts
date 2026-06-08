import * as path from 'node:path';
import * as fs from 'node:fs';
import {CompositeGeneratorNode, expandToNode, joinToNode, toString} from 'langium/generate';
import {
    Action,
    AttributeExp, AttributeRollParam,
    AttributeStyleParam,
    BackgroundParam, BooleanExp,
    ChoiceCustomProperty, ChoiceStringValue,
    ClassExpression,
    ColorParam, DateExp, DateTimeExp, DiceField, DieChoicesParam, DieField, DieNoneParam,
    Document,
    DocumentChoiceExp,
    DocumentChoicesExp,
    Entry, HtmlExp,
    IconParam,
    ImageParam,
    isAccess,
    isAction,
    isActor,
    isConfigFlag,
    isTheme,
    isThemeFieldParam,
    ThemeFieldParam,
    isThemePrimaryParam,
    isThemeSecondaryParam,
    isThemeTertiaryParam,
    isAttributeExp,
    isAttributeParamMod, isAttributeRollParam, isAttributeFunctionParam,
    isAttributeStyleParam,
    isBackgroundParam,
    isBooleanExp,
    isBooleanParamValue, isChoiceCustomProperty, isChoiceStringValue,
    isColorParam, isColumn,
    isDateExp,
    isDateTimeExp, isDiceField, isDiceFields, isDieChoicesParam, isDieNoneParam,
    isDieField,
    isDocumentChoiceExp,
    isDocumentChoicesExp,
    isEntry,
    isHtmlExp,
    isIconParam,
    isImageParam, isLabelParam, isMacroField, isMeasuredTemplateField, isDamageBonusesField, isDamageResistancesField, isPinnedField, isMoneyField, isDamageTrackExp, isDamageTrackTypesParam, DamageTrackTypesParam, isRollVisualizerField,
    ImageField, isImageField, isImagePrimaryParam,
    isHideLabelParam,
    isCollapsibleParam, CollapsibleParam,
    isCollapsedParam, CollapsedParam,
    isEmptyColorParam, EmptyColorParam,
    isThemeElevationParam, ThemeElevationParam,
    isMethodBlock,
    isNumberExp,
    isNumberParamMax,
    isNumberParamMin,
    isNumberParamValue,
    isNumberParamCalculator,
    isPage,
    isPaperDollExp,
    isParentPropertyRefChoiceParam,
    isParentPropertyRefExp,
    isSelfPropertyRefExp,
    isProperty,
    isResourceExp, isRow,
    isSection, Section,
    isSegmentsParameter,
    isSingleDocumentExp,
    isSizeParam,
    isStatusProperty, isStringChoiceField, isDamageTypeChoiceField, isStringChoicesField,
    isStringExp, isStringExtendedChoice,
    isStringParamChoices,
    isStringParamValue, isTableField, PinnedField,
    isTimeExp,
    isTrackerExp,
    isTrackerStyleParameter,
    isVisibilityParam, LabelParam, Layout,
    InventoryField, isInventoryField, isInventorySlotsParam, isInventoryRowsParam, isInventoryColumnsParam,
    isInventorySlotSizeParam, isInventoryQuantityParam, isInventoryMoneyParam,
    isInventorySumParam, isInventorySumMaxParam, isInventorySortParam,
    isInventoryEmptySlotsParam, isInventorySummaryParam, isWhereParam, isGlobalParam,
    NumberExp,
    NumberFieldParams,
    NumberParamMax,
    NumberParamMin,
    NumberParamValue,
    NumberParamCalculator,
    Page,
    PaperDollExp,
    ParentPropertyRefChoiceParam,
    Property,
    ResourceExp,
    SegmentsParameter,
    SizeParam,
    StandardFieldParams, StringChoice, StringChoiceField, DamageTypeChoiceField, StringChoicesField, StringExp,
    StringParamChoices, StringChoicesParamChoices,
    StringParamValue, TableField, TimeExp, TrackerExp,
    TrackerStyleParameter,
    VisibilityParam, VisibilityValue, Expression
} from "../../../language/generated/ast.js";
import {getAllOfType, getDocument, getSystemPath, globalGetAllOfType, toMachineIdentifier} from '../utils.js';
import {AstUtils} from 'langium';
import {generateActionComponent, generateDocumentPromptApps} from './vue-action-component-generator.js';
import {generatePinnedVuetifyDatatableComponent} from './vue-pinned-datatable-component-generator.js';
// import {generateDocumentChoiceComponent} from './vue-document-choice-component-generator.js';
import {generateDocumentChoicesComponent} from './base-components/vue-document-choices.js';
import {translateBodyExpressionToJavascript, translateExpression, compileVisualizerFormula} from '../method-generator.js';
import {themeWidthToInlineStyle, themeHeightToInlineStyle, themePaintToInlineStyle, themeSizingToInlineStyle} from '../css-generator.js';
import {humanize} from "inflection";
import {generateVuetifyDatatableComponent} from "./vue-datatable2-component-generator.js";
import {generateDocumentChoiceComponent} from "./base-components/vue-document-choice.js";

// --- Theme-derived color defaults -------------------------------------------
// The per-document primary/secondary/tertiary color pickers default to the
// system theme (`config { theme { primary/secondary/tertiary } }`) when set,
// otherwise to the built-in palette. `userColors = false` in config hides the
// picker entirely (art-directed systems whose look is fixed by the theme).
const DEFAULT_PRIMARY = '#1565c0';
const DEFAULT_SECONDARY = '#4db6ac';
const DEFAULT_TERTIARY = '#ffb74d';

function getThemeColorDefaults(entry: Entry): { primary: string; secondary: string; tertiary: string } {
    const theme = entry.config.body.find(isTheme);
    let primary = DEFAULT_PRIMARY, secondary = DEFAULT_SECONDARY, tertiary = DEFAULT_TERTIARY;
    if (theme) {
        for (const param of theme.params) {
            if (isThemePrimaryParam(param)) primary = param.value;
            else if (isThemeSecondaryParam(param)) secondary = param.value;
            else if (isThemeTertiaryParam(param)) tertiary = param.value;
        }
    }
    return { primary, secondary, tertiary };
}

// `userColors = false` disables the per-document color pickers. Default is true.
function getUserColorsEnabled(entry: Entry): boolean {
    const flag = entry.config.body.find(x => isConfigFlag(x) && x.type === 'userColors');
    return flag ? (flag as any).value : true;
}

// Returns the elevation integer from the global `theme { elevation: N }` block, or 4 if unset.
const DEFAULT_ELEVATION = 4;
function getGlobalThemeElevation(entry: Entry): number {
    const theme = entry.config.body.find(isTheme);
    if (theme) {
        const ep = theme.params.find(isThemeElevationParam) as ThemeElevationParam | undefined;
        if (ep != null) return ep.value;
    }
    return DEFAULT_ELEVATION;
}

export function generateDocumentVueComponent(entry: Entry, id: string, document: Document, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase());
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}App.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    // Generate prompt apps for every action AND function prompt in this document,
    // unconditionally per document (covers documents with function-prompts but no actions).
    generateDocumentPromptApps(entry, id, document, destination);

    const fileNode = expandToNode`
    ${generateVueComponentScript(entry, id, document, destination)}
    ${generateVueComponentTemplate(entry, id, document)}
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateCollapsibleSectionsSetup(document: Document): string {
    const allSections = getAllOfType<Section>(document.body as any, isSection);
    const collapsibleSections = allSections.filter(s => (s.params ?? []).some(p => isCollapsibleParam(p) && (p as CollapsibleParam).value));
    if (collapsibleSections.length === 0) return '';

    const defaultCollapsedEntries = collapsibleSections
        .filter(s => (s.params ?? []).some(p => isCollapsedParam(p) && (p as CollapsedParam).value))
        .map(s => `'${s.name.toLowerCase()}': true`)
        .join(', ');
    const defaultsObj = `{ ${defaultCollapsedEntries} }`;

    return `
        // Collapsible sections — state persisted per-document in localStorage.
        const _collapsibleDefaults = ${defaultsObj};
        const collapsedSections = ref((() => {
            try {
                const s = JSON.parse(localStorage.getItem(\`isdl-sections-\${document.uuid}\`) ?? 'null');
                return s !== null ? s : { ..._collapsibleDefaults };
            } catch { return { ..._collapsibleDefaults }; }
        })());
        const toggleSection = (name) => {
            collapsedSections.value[name] = !collapsedSections.value[name];
            localStorage.setItem(\`isdl-sections-\${document.uuid}\`, JSON.stringify(collapsedSections.value));
        };
    `;
}

function generateVueComponentScript(entry: Entry, id: string, document: Document, destination: string): CompositeGeneratorNode {
    const pages = getAllOfType<Page>(document.body, isPage);
    const actions = getAllOfType<Action>(document.body, isAction, false);
    const paperDoll = getAllOfType<PaperDollExp>(document.body, isPaperDollExp);
    const documentChoices = getAllOfType<DocumentChoiceExp>(document.body, isDocumentChoiceExp);
    const documentChoicesPlural = getAllOfType<DocumentChoicesExp>(document.body, isDocumentChoicesExp);
    const firstPagePinned = document.body.filter(isPinnedField);

    function getPageBackground(page: Page): string {
        const background = (page.params?.find(x => isBackgroundParam(x)) as BackgroundParam)?.background ?? 'topography';
        return `'${page.name.toLowerCase()}': '${background}'`;
    }

    //let tables = getAllOfType<TableField>(document.body, isTableField, true);
    let allTables = getAllOfType<TableField>(document.body, isTableField, false);

    function importDataTable2(table: TableField): CompositeGeneratorNode {
        const page = AstUtils.getContainerOfType<Page>(table, isPage);
        const pageName = page ? page.name : document.name;
        generateVuetifyDatatableComponent(entry, id, document, pageName, table, destination);
        return expandToNode`
        import ${document.name}${pageName}${table.name}VuetifyDatatable from './components/datatables/${document.name.toLowerCase()}${pageName}${table.name}VuetifyDatatable.vue';
        `;
    }

    function importEffectsDataTable(): CompositeGeneratorNode {
        generateEffectsVuetifyDatatableComponent(id, document, destination);
        return expandToNode`
        import ${document.name}EffectsVuetifyDatatable from './components/datatables/${document.name.toLowerCase()}EffectsVuetifyDatatable.vue';
        `;
    }

    function importPinnedDataTable(pinnedField: PinnedField): CompositeGeneratorNode {
        generatePinnedVuetifyDatatableComponent(id, document, pinnedField, destination, entry);
        const page = AstUtils.getContainerOfType<Page>(pinnedField, isPage);
        const pageName = page ? page.name : document.name;
        return expandToNode`
        import ${document.name}${pageName}${pinnedField.name}VuetifyDatatable from './components/datatables/${document.name.toLowerCase()}${pageName}${pinnedField.name}VuetifyDatatable.vue';
        `;
    }


    function generateEffectsVuetifyDatatableComponent(id: string, document: Document, destination: string): void {
        const type = isActor(document) ? 'actor' : 'item';
        const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "datatables");
        const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}EffectsVuetifyDatatable.vue`);

        if (!fs.existsSync(generatedFileDir)) {
            fs.mkdirSync(generatedFileDir, { recursive: true });
        }

        const fileNode = expandToNode`
        <script setup>
            import { ref, computed, inject, onMounted } from "vue";

            const props = defineProps({
                context: Object,
                primaryColor: String,
                secondaryColor: String,
                tertiaryColor: String
            });
            
            const document = inject('rawDocument');
            const search = ref('');
            const loading = ref(false);
            
            const data = ref([]);

            function updateEffects() {
                data.value = Array.from(document.allApplicableEffects());
            }
    
            updateEffects();
    
            Hooks.on("createActiveEffect", updateEffects);
            Hooks.on("updateActiveEffect", updateEffects);
            Hooks.on("deleteActiveEffect", updateEffects);
            
            const headers = [
                { 
                    title: game.i18n.localize("Image"), 
                    key: 'img', 
                    sortable: false,
                    width: '50px',
                    maxWidth: '50px'
                },
                { 
                    title: game.i18n.localize("Name"), 
                    key: 'name', 
                    sortable: true,
                    minWidth: '120px'
                },
                { 
                    title: game.i18n.localize("Source"), 
                    key: 'source', 
                    sortable: true,
                    minWidth: '120px'
                },
                { 
                    title: game.i18n.localize("Duration"), 
                    key: 'duration', 
                    sortable: true,
                    minWidth: '100px'
                },
                { 
                    title: game.i18n.localize("Actions"), 
                    key: 'actions', 
                    sortable: false,
                    width: '150px',
                    align: 'center'
                }
            ];

            const editItem = (item) => {
                const foundryItem = document.effects.get(item._id);
                foundryItem.sheet.render(true);
            };

            const toggleEffect = async (item) => {
                const update = {
                    _id: item._id,
                    disabled: !item.disabled
                };
                item.disabled = !item.disabled;
                document.updateEmbeddedDocuments("ActiveEffect", [update]);
            };

            const deleteEffect = async (item) => {
                const shouldDelete = await Dialog.confirm({
                    title: "Delete Confirmation",
                    content: \`<p>Are you sure you would like to delete the "\${item.name}" Effect?</p>\`,
                    defaultYes: false
                });
                if (shouldDelete) {
                    await document.deleteEmbeddedDocuments("ActiveEffect", [item.id]);
                    // Don't call updateEffects() here as the Hooks will handle it
                };
            };

            const addNewEffect = async () => {
                loading.value = true;
                try {
                    const effects = await ActiveEffect.createDocuments([{
                        name: "New Effect",
                        icon: "icons/svg/aura.svg"
                    }], {parent: document});
                    
                    if (effects && effects[0]) {
                        effects[0].sheet.render(true);
                        updateEffects();
                    }
                } catch (error) {
                    console.error("Error creating effect:", error);
                    ui.notifications.error("Failed to create new effect");
                } finally {
                    loading.value = false;
                }
            };
            
            const formatDuration = (effect) => {
                if (!effect.duration) return "Permanent";
                if (effect.duration.type === "none") return "Permanent";
                if (effect.duration.type === "turns") {
                    return \`\${effect.duration.remaining} turns\`;
                }
                if (effect.duration.type === "seconds") {
                    return \`\${effect.duration.remaining} seconds\`;
                }
                return "Temporary";
            };
        </script>

        <template>
            <v-card flat class="isdl-datatable">
                <v-card-title class="d-flex align-center pe-1" style="height: 40px;">
                    <v-icon icon="fa-solid fa-sparkles" size="small" />
                    &nbsp; {{ game.i18n.localize("Effects") }}
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
                    <v-btn
                        :color="primaryColor || 'primary'"
                        prepend-icon="fa-solid fa-plus"
                        rounded="0"
                        size="small"
                        :loading="loading"
                        @click="addNewEffect"
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
                    class="custom-datatable"
                >
                    <!-- Image slot -->
                    <template v-slot:item.img="{ item }">
                        <v-avatar size="40" rounded="0">
                            <v-img :src="item.img ?? item.icon" :alt="item.name" cover></v-img>
                        </v-avatar>
                    </template>

                    <!-- Name slot -->
                    <template v-slot:item.name="{ item }">
                        <div class="d-flex align-center">
                            <div class="font-weight-medium text-truncate" style="min-width: 120px; max-width: 200px;">{{ item.name }}</div>
                        </div>
                    </template>

                    <!-- Source slot -->
                    <template v-slot:item.source="{ item }">
                        <v-chip
                            label
                            size="x-small"
                            variant="elevated"
                            class="text-caption text-truncate" 
                            style="max-width: 150px;"
                             :data-tooltip="item.flags?.['${id}']?.source || 'Unknown'">
                            {{ item.flags?.['${id}']?.source || 'Unknown' }}
                        </v-chip>
                    </template>

                    <!-- Duration slot -->
                    <template v-slot:item.duration="{ item }">
                        <v-chip 
                            label
                            size="x-small"
                            variant="elevated"
                            class="text-caption"
                            :color="item.duration?.type === 'none' ? 'primary' : 'secondary'"
                        >
                            {{ formatDuration(item) }}
                        </v-chip>
                    </template>

                    <!-- Actions slot -->
                    <template v-slot:item.actions="{ item }">
                        <div class="d-flex align-center justify-center ga-1">
                            <v-tooltip :text="item.disabled ? 'Enable' : 'Disable'">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        :icon="item.disabled ? 'fa-solid fa-pause' : 'fa-solid fa-play'"
                                        size="x-small"
                                        variant="text"
                                        :color="item.disabled ? 'warning' : 'success'"
                                        @click="toggleEffect(item)"
                                    ></v-btn>
                                </template>
                            </v-tooltip>
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
                            <v-tooltip text="Delete">
                                <template v-slot:activator="{ props }">
                                    <v-btn
                                        v-bind="props"
                                        icon="fa-solid fa-trash"
                                        size="x-small"
                                        variant="text"
                                        color="error"
                                        @click="deleteEffect(item)"
                                    ></v-btn>
                                </template>
                            </v-tooltip>
                        </div>
                    </template>

                    <!-- No data slot -->
                    <template v-slot:no-data>
                        <div class="text-center pa-4">
                            <v-icon size="48" color="grey-lighten-1">fa-solid fa-magic</v-icon>
                            <div class="text-h6 mt-2">No effects found</div>
                            <div class="text-body-2 text-medium-emphasis">
                                Add your first effect to get started
                            </div>
                        </div>
                    </template>
                </v-data-table>
            </v-card>
        </template>
        `;

        fs.writeFileSync(generatedFilePath, toString(fileNode));
    }

    function importPageOfPinnedDataTable(page: Page): CompositeGeneratorNode {
        const pinned = getAllOfType<PinnedField>(page.body, isPinnedField, true);
        return expandToNode`
        ${joinToNode(pinned, pinnedField => importPinnedDataTable(pinnedField), {appendNewLineIfNotEmpty: true})}
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

    function importDocumentChoicesComponent(documentChoices: DocumentChoicesExp): CompositeGeneratorNode {
        generateDocumentChoicesComponent(entry, id, document, documentChoices, destination);
        const componentName = `${document.name.toLowerCase()}${documentChoices.name}DocumentChoices`;
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

    function isComputedField(element: Property | Action): boolean {
        if (isStringExp(element)) {
            return element.params.find(isStringParamValue) !== undefined;
        }
        if (isBooleanExp(element)) {
            return element.params.find(isBooleanParamValue) !== undefined;
        }
        if (isNumberExp(element) || isAttributeExp(element) || isResourceExp(element) || isTrackerExp(element) || isMoneyField(element)) {
            const numberParams = element.params as NumberFieldParams[];
            return numberParams.find(isNumberParamValue) !== undefined;
        }
        return false;
    }

    function generateVisibilityState(element: Property | Action): CompositeGeneratorNode {
        if (isProperty(element) || isAction(element)) {
            const standardParams = element.params as StandardFieldParams[];

            const visibilityParam = standardParams.find(function (p: any) {
                return isVisibilityParam(p);
            }) as VisibilityParam | undefined;

            // If there's only a modifier and no visibility param, return the modifier
            if (element.modifier != undefined && !visibilityParam) {
                return expandToNode`
                '${element.name.toLowerCase()}': computed(() => {
                    return '${element.modifier}';
                })
                `;
            }
            if (visibilityParam) {

                if (isMethodBlock(visibilityParam.visibility)) {
                    // If the visibility is a method block, we need to return a function that returns the visibility
                    return expandToNode`
                    '${element.name.toLowerCase()}': computed(() => {
                        let editMode = editModeRef.value;
                        let combatant = currentCombatant.value; // This will kick the recalc when changed
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
                        const visibility = (system) => {
                            ${translateBodyExpressionToJavascript(entry, id, visibilityParam.visibility.body, false, element)}
                        };
                        const returnedVisibility = visibility(props.context.system);
                        console.log("Returned visibility for ${element.name}: " + returnedVisibility);

                        return returnedVisibility ?? "${element.modifier ?? 'default'}";
                    })
                    `;
                }

                // VisibilityValue is an AST node; emit its literal value (e.g. "gmOnly"),
                // not the stringified node ("[object Object]").
                return expandToNode`
                '${element.name.toLowerCase()}': computed(() => {
                    return '${(visibilityParam.visibility as VisibilityValue).visibility}';
                })
                `;
            }
        }

        return expandToNode`
        '${element.name.toLowerCase()}': computed(() => {
            return 'default';
        })
        `;
    }

    const attributes = getAllOfType<AttributeExp>(document.body, isAttributeExp, false);

    function generateAttributeRollMethod(attribute: AttributeExp): CompositeGeneratorNode {
        const rollParam = attribute.params.find(isAttributeRollParam) as AttributeRollParam | undefined;
        if (rollParam) {
            // A block-style `roll: { ... }` is a method body that can call user functions
            // (self.Foo(...)) and mutate the document (self.X += 1). Those need `this`, the action-style
            // flush objects, and a flush/render tail — none of which exist in this <script setup> scope
            // (`this` is undefined, `update` is never declared). So, like `function:`, the block runs as a
            // real sheet method (_on<Attr>AttributeRoll, generated in vue-sheet-class-generator); here we
            // only emit a delegating arrow. An expression-style `roll: roll(...)` (the else branch below)
            // produces a single Roll value we wrap in a chat card and is unaffected.
            if (isMethodBlock(rollParam.roll)) {
                return expandToNode`
                const on${attribute.name}AttributeRoll = async (event) => {
                    await document.sheet._on${attribute.name}AttributeRoll(event);
                };
                `;
            }
            return expandToNode`
            const on${toMachineIdentifier(attribute.name)}AttributeRoll = async () => {
                const context = {
                    object: document
                };
                let system = context.object.system;
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
                    ...(${attribute.name}Context.parts.find(x => x.isRoll) ? {} : { style: CONST.CHAT_MESSAGE_STYLES.IC }),
                    rolls: Array.from(${attribute.name}Context.parts.filter(x => x.isRoll).map(x => x.value)),
                });
            };
            `;
        }
        return expandToNode``;
    }

    // Attributes with a `function:` param delegate their click to a sheet method that runs the
    // referenced function with action-style update/flush semantics (see vue-sheet-class-generator).
    function generateAttributeFunctionMethod(attribute: AttributeExp): CompositeGeneratorNode {
        const functionParam = attribute.params.find(isAttributeFunctionParam);
        if (functionParam) {
            return expandToNode`
            const on${attribute.name}AttributeFunction = async (event) => {
                await document.sheet._on${attribute.name}AttributeFunction(event);
            };
            `;
        }
        return expandToNode``;
    }

    const themeColors = getThemeColorDefaults(entry);
    const userColorsEnabled = getUserColorsEnabled(entry);

    return expandToNode`
    <script setup>
        import { ref, watch, inject, computed, watchEffect } from "vue";
        ${joinToNode(allTables, table => importDataTable2(table), {appendNewLineIfNotEmpty: true})}
        ${joinToNode(pages, importPageOfPinnedDataTable, {appendNewLineIfNotEmpty: true})}
        ${joinToNode(actions, importActionComponent, {appendNewLineIfNotEmpty: true})}
        ${joinToNode(documentChoices, importDocumentChoiceComponent, {appendNewLineIfNotEmpty: true})}
        ${joinToNode(documentChoicesPlural, importDocumentChoicesComponent, {appendNewLineIfNotEmpty: true})}
        ${importEffectsDataTable()}
        ${joinToNode(firstPagePinned, (pinned: PinnedField) => importPinnedDataTable(pinned), {appendNewLineIfNotEmpty: true})}
        import ${entry.config.name}Roll from "../../../../rolls/roll.mjs";

        const document = inject('rawDocument');
        const props = defineProps(['context']);

        // Colors
        // Defaults come from the system theme (theme primary/secondary/tertiary tokens);
        // when the theme doesn't set them they fall back to the built-in palette. These feed
        // the Vuetify :color props on fields. userColorsEnabled mirrors the userColors config.
        const userColorsEnabled = ${userColorsEnabled};
        const defaultPrimaryColor = '${themeColors.primary}';
        const defaultSecondaryColor = '${themeColors.secondary}';
        const defaultTertiaryColor = '${themeColors.tertiary}';

        let storedColors = game.settings.get('${id}', 'documentColorThemes');
        const documentColors = userColorsEnabled ? (storedColors[document.uuid] ?? {}) : {};
        const primaryColor = ref(documentColors.primary ?? defaultPrimaryColor);
        const secondaryColor = ref(documentColors.secondary ?? defaultSecondaryColor);
        const tertiaryColor = ref(documentColors.tertiary ?? defaultTertiaryColor);

        // Track which colors the user has explicitly chosen. Only an explicit choice is
        // emitted as a CSS variable (below) so it can override the theme default; the ref
        // defaults must NOT leak to --isdl-* or an unthemed sheet would gain a colored edge.
        const primarySet = ref(documentColors.primary != null);
        const secondarySet = ref(documentColors.secondary != null);
        const tertiarySet = ref(documentColors.tertiary != null);

        // User-chosen colors override the theme's --isdl-primary/secondary/tertiary for this
        // document. Bound inline on <v-app>, which sits inside .${id}.vue-application, so it wins
        // over the theme.css defaults for every descendant field. Keys are omitted unless chosen.
        const userColorVars = computed(() => {
            const vars = {};
            if (primarySet.value) vars['--isdl-primary'] = primaryColor.value;
            if (secondarySet.value) vars['--isdl-secondary'] = secondaryColor.value;
            if (tertiarySet.value) vars['--isdl-tertiary'] = tertiaryColor.value;
            return vars;
        });

        const setupColors = () => {
            const colors = {
                primary: primaryColor.value,
                secondary: secondaryColor.value,
                tertiary: tertiaryColor.value
            };
            game.settings.set('${id}', 'documentColorThemes', { ...storedColors, [document.uuid]: colors });
        };
        const resetColors = () => {
            primaryColor.value = defaultPrimaryColor;
            secondaryColor.value = defaultSecondaryColor;
            tertiaryColor.value = defaultTertiaryColor;
            primarySet.value = false;
            secondarySet.value = false;
            tertiarySet.value = false;
            let updated = { ...storedColors };
            delete updated[document.uuid];
            storedColors = updated;
            game.settings.set('${id}', 'documentColorThemes', updated);
        };

        watch(primaryColor, () => {
            primarySet.value = true;
            setupColors();
        });
        watch(secondaryColor, () => {
            secondarySet.value = true;
            setupColors();
        });
        watch(tertiaryColor, () => {
            tertiarySet.value = true;
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
            '${document.name.toLowerCase()}': 'description'
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
            try {
                if (document.sheet?.element) {
                    document.sheet.dragDrop.forEach((d) => d.bind(document.sheet.element));
                }
            }
            catch {}
            updateLastState();
        });

        const pageBackgrounds = {
            '${document.name.toLowerCase()}': 'topography',
            ${joinToNode(pages, getPageBackground, {separator: ',', appendNewLineIfNotEmpty: true})}
        };

        const pageBackground = computed(() => {
            if (editModeRef.value) {
                return 'edit-mode';
            }
            if (props.context.system.dead) {
                return 'dead';
            }
            return pageBackgrounds[page.value];
        });

        // Edit Mode
        const editModeRef = ref(document.getFlag('${id}', 'edit-mode') ?? true);
        const hovered = ref(false);

        const toggleEditMode = () => {
            editModeRef.value = !editModeRef.value;
            document.setFlag('${id}', 'edit-mode', editModeRef.value);
        };

        ${generateCollapsibleSectionsSetup(document)}

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
        
        // Combat
        const currentCombatant = ref(game.combat?.combatant);
        Hooks.on("combatTurnChange", () => {
            currentCombatant.value = game.combat?.combatant;
        });

        // Paper Doll Slots
        ${joinToNode(paperDoll, paperDollSlots, {appendNewLineIfNotEmpty: true})}

        // Visibility states
        const visibilityStates = {
            ${joinToNode(properties, generateVisibilityState, {separator: ',', appendNewLineIfNotEmpty: true})},
            ${joinToNode(actions, generateVisibilityState, {separator: ',', appendNewLineIfNotEmpty: true})}
        };

        // Computed fields mapping
        const computedFields = {
            ${joinToNode(properties, prop => expandToNode`'${prop.name.toLowerCase()}': ${isComputedField(prop)}`, {separator: ',', appendNewLineIfNotEmpty: true})},
            ${joinToNode(actions, action => expandToNode`'${action.name.toLowerCase()}': ${isComputedField(action)}`, {separator: ',', appendNewLineIfNotEmpty: true})}
        };


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
                return !editModeRef.value;
            }
            if (visibility === "play") {
                return editModeRef.value;
            }

            // Default to visible
            return false;
        };

        const isDisabled = (type) => {
            // Computed fields are always disabled
            if (computedFields[type]) {
                //console.log(type + " is computed and disabled");
                return true;
            }
            
            const visibility = visibilityStates[type].value;
            const disabledStates = ["readonly", "locked"];
            if (disabledStates.includes(visibility)) {
                //console.log(type + " is readonly / locked and disabled");
                return true;
            }
            if (visibility === "gmEdit") {
                const isGm = game.user.isGM;
                const isEditMode = editModeRef.value;
                return !isGm && !isEditMode;
            }

            if (visibility === "unlocked") {
                //console.log(type + " is unlocked and enabled");
                return false;
            }
            
            // Default to enabled while in editMode
            return !editModeRef.value;
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
        ${joinToNode(attributes, generateAttributeFunctionMethod, {appendNewLineIfNotEmpty: true})}
    </script>
    <style>
    </style>
    `;
}

function generateVueComponentTemplate(entry: Entry, id: string, document: Document): CompositeGeneratorNode {
    const pages = getAllOfType<Page>(document.body, isPage);
    const firstPageTables = document.body.filter(isTableField); // We explicitly only want top-level tables
    const firstPagePinned = document.body.filter(isPinnedField); // We explicitly only want top-level pinned fields
    const firstPageInventories = document.body.filter(isInventoryField); // We explicitly only want top-level inventories
    const userColorsEnabled = getUserColorsEnabled(entry);
    // If the author placed a primary image field (one bound to the native `img`), the portrait is
    // rendered inline in their layout -- suppress the default drawer portrait to avoid two of them.
    const hasPrimaryImage = getAllOfType<ImageField>(document.body, isImageField)
        .some(f => f.params.some(p => isImagePrimaryParam(p) && p.value));
    return expandToNode`
    <template>
        <v-app :style="userColorVars">
            <!-- App Bar -->
            <v-app-bar :color="editModeRef ? 'amber-accent-3' : primaryColor" density="comfortable">
                <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
                <v-app-bar-title v-if="!editModeRef">{{ context.document.name }}</v-app-bar-title>
                <v-text-field name="name" v-model="context.document.name" variant="outlined" class="document-name" v-if="editModeRef" density="compact"></v-text-field>
                <v-alert :text="game.i18n.localize('EditModeWarning')" type="warning" density="compact" class="ga-2 ma-1" color="amber-accent-3" v-if="editModeRef"></v-alert>
                <template v-slot:append>
                    <v-btn
                        :icon="hovered ? (editModeRef ? 'fa-solid fa-dice-d20' : 'fa-solid fa-pen-to-square') : (editModeRef ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-dice-d20')"
                        @click="toggleEditMode"
                        @mouseover="hovered = true"
                        @mouseleave="hovered = false"
                        :data-tooltip="editModeRef ? 'Swap to Play mode' : 'Swap to Edit mode'"
                    ></v-btn>
                </template>
            </v-app-bar>

            <!-- Navigation Drawer -->
            <v-navigation-drawer v-model="drawer" temporary style="background-color: #dddddd">
                ${hasPrimaryImage ? '' : expandToNode`<v-img :src="context.document.img" style="background-color: lightgray" data-edit='img' data-action='onEditImage'>
                    <template #error>
                        <v-img src="/systems/${id}/img/missing-character.png" data-edit='img' data-action='onEditImage'></v-img>
                    </template>
                </v-img>`}
                <v-tabs v-model="page" direction="vertical">
                    <v-tab value="${document.name.toLowerCase()}" prepend-icon="fa-solid fa-circle-user">${document.name}</v-tab>
                    ${joinToNode(pages, generateNavListItem, {appendNewLineIfNotEmpty: true})}
                </v-tabs>
                <template v-slot:append>
                    <div class="pa-2" ${userColorsEnabled ? '' : 'v-if="false"'}>
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
                <v-container :key="editModeRef" :class="pageBackground" fluid>
                    <v-tabs-window v-model="page">
                        <v-tabs-window-item value="${document.name.toLowerCase()}" data-tab="${document.name.toLowerCase()}">
                            <v-row dense>
                                ${joinToNode(document.body, element => generateElement(element, true), {appendNewLineIfNotEmpty: true})}
                            </v-row>
                            <v-divider class="mt-4 mb-2"></v-divider>
                            <v-tabs v-model="tab" grow always-center>
                                    <v-tab value="description" prepend-icon="fa-solid fa-book">Description</v-tab>
                                    ${joinToNode(firstPageTables, table => generateSubTab(table), {appendNewLineIfNotEmpty: true})}
                                    ${joinToNode(firstPagePinned, (pinned: PinnedField) => generatePinnedTab(pinned), {appendNewLineIfNotEmpty: true})}
                                    ${joinToNode(firstPageInventories, inventory => generateSubTab(inventory), {appendNewLineIfNotEmpty: true})}
                                    <v-tab value="effects" prepend-icon="fa-solid fa-sparkles" @mousedown="spawnDatatableWindow($event, '${document.name}', 'effects')">Effects</v-tab>
                            </v-tabs>
                            <v-tabs-window v-model="tab" class="tabs-window">
                                <v-tabs-window-item value="description" data-tab="description" class="tabs-container">
                                    <i-prosemirror :field="context.editors['system.description']" :disabled="!editModeRef"></i-prosemirror>
                                </v-tabs-window-item>
                                ${joinToNode(firstPageTables, table => generateVuetifyDatatable(document.name, table), {appendNewLineIfNotEmpty: true})}
                                ${joinToNode(firstPagePinned, (pinned: PinnedField) => generatePinnedTabWindow(pinned), {appendNewLineIfNotEmpty: true})}
                                ${joinToNode(firstPageInventories, inventory => generateInventoryTabWindow(document.name, inventory), {appendNewLineIfNotEmpty: true})}
                                <v-tabs-window-item value="effects" data-tab="effects" class="tabs-container">
                                    <${document.name}EffectsVuetifyDatatable 
                                        :context="context"
                                        :primaryColor="primaryColor"
                                        :secondaryColor="secondaryColor"
                                        :tertiaryColor="tertiaryColor"
                                    />
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

    function generateSubTab(tab: TableField | InventoryField): CompositeGeneratorNode {
        const params = tab.params as StandardFieldParams[];
        const iconParam = params.find((p: any) => isIconParam(p)) as IconParam | undefined;
        const icon = iconParam?.value ?? "fa-solid fa-table";
        const page = AstUtils.getContainerOfType(tab, isPage) as Page;
        const pageName = page ? page.name : document.name;

        // Check for label parameter
        const labelParam = params.find((p: any) => isLabelParam(p)) as LabelParam | undefined;
        const label = labelParam?.value ?? `${document.name}.${tab.name}`;

        return expandToNode`
            <v-tab v-if="!isHidden('${tab.name.toLowerCase()}')" value="${tab.name.toLowerCase()}" prepend-icon="${icon}" @mousedown="spawnDatatableWindow($event, '${pageName}', '${tab.name}')">{{ game.i18n.localize('${label}') }}</v-tab>
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
        const tables = page.body.filter(isTableField); // We explictly only want top-level tables
        const pinned = page.body.filter(isPinnedField); // We explictly only want top-level pinned fields
        const inventories = page.body.filter(isInventoryField); // We explictly only want top-level inventories
        return expandToNode`
        <v-tabs-window-item value="${page.name.toLowerCase()}" data-tab="${page.name.toLowerCase()}">
            <v-row dense>
                ${joinToNode(page.body, element => generateElement(element, true), {appendNewLineIfNotEmpty: true})}
            </v-row>
            <v-divider class="mt-4 mb-2"></v-divider>
            <v-tabs v-model="tab" grow always-center>
                ${joinToNode(tables, table => generateSubTab(table), {appendNewLineIfNotEmpty: true})}
                ${joinToNode(pinned, pinnedField => generatePinnedTab(pinnedField), {appendNewLineIfNotEmpty: true})}
                ${joinToNode(inventories, inventory => generateSubTab(inventory), {appendNewLineIfNotEmpty: true})}
            </v-tabs>
            <v-tabs-window v-model="tab" class="tabs-window">
                ${joinToNode(tables, table => generateVuetifyDatatable(page.name, table), {appendNewLineIfNotEmpty: true})}
                ${joinToNode(pinned, pinnedField => generatePinnedTabWindow(pinnedField), {appendNewLineIfNotEmpty: true})}
                ${joinToNode(inventories, inventory => generateInventoryTabWindow(page.name, inventory), {appendNewLineIfNotEmpty: true})}
            </v-tabs-window>
        </v-tabs-window-item>
        `;
    }

    function generateVuetifyDatatable(pageName: string, element: TableField): CompositeGeneratorNode {
        const systemPath = getSystemPath(element, [], undefined, false);
        let componentName = `${document.name}${pageName}${element.name}VuetifyDatatable`;
        return expandToNode`
        <v-tabs-window-item v-if="!isHidden('${element.name.toLowerCase()}')" value="${element.name.toLowerCase()}" data-tab="${element.name.toLowerCase()}" data-type="table" class="tabs-container">
            <${componentName} systemPath="${systemPath}" :context="context" :primaryColor="primaryColor" :secondaryColor="secondaryColor" :tertiaryColor="tertiaryColor"></${componentName}>
        </v-tabs-window-item>
        `.appendNewLine();
    }

    function generateInventoryTabWindow(pageName: string, element: InventoryField): CompositeGeneratorNode {
        const systemPath = getSystemPath(element, [], undefined, false);
        const iconParam = element.params.find(p => isIconParam(p)) as IconParam | undefined;
        const labelParam = element.params.find(p => isLabelParam(p)) as LabelParam | undefined;
        const slotsParam = element.params.find(isInventorySlotsParam);
        const rowsParam = element.params.find(isInventoryRowsParam);
        const slotSizeParam = element.params.find(isInventorySlotSizeParam);
        const quantityParam = element.params.find(isInventoryQuantityParam);
        const moneyParam = element.params.find(isInventoryMoneyParam);
        const sumParam = element.params.find(isInventorySumParam);
        const sumMaxParam = element.params.find(isInventorySumMaxParam);
        const sortParam = element.params.find(isInventorySortParam);
        const whereParam = element.params.find(isWhereParam);
        const globalParam = element.params.find(isGlobalParam);
        const emptySlotsParam = element.params.find(isInventoryEmptySlotsParam);
        const summaryParam = element.params.find(isInventorySummaryParam);

        const label = labelParam ? labelParam.value : `${document.name}.${element.name}`;
        const hideLabel = element.params.some((p: any) => isHideLabelParam(p) && p.value);
        const icon = iconParam?.value;
        const slots = slotsParam?.value ?? 20;
        const rows = rowsParam?.value;
        const slotSize = slotSizeParam ? parseInt(slotSizeParam.value.replace('px', '')) : 60;
        const documentType = element.documents[0]?.ref?.name.toLowerCase();
        const quantityField = quantityParam?.field.ref?.name.toLowerCase();
        const moneyField = moneyParam?.field.ref?.name.toLowerCase();
        const moneyFieldLabel = moneyField ? `${document.name}.${moneyParam?.field?.ref?.name}` : undefined;
        const moneyFieldIcon = moneyField ? moneyParam?.field?.ref?.params.find(isIconParam)?.value : undefined;
        const sortProperty = sortParam?.property.ref?.name;
        const sortOrder = sortParam?.order ?? 'asc';
        const globalAllowed = globalParam?.value ?? false;
        const emptySlots = emptySlotsParam?.value ?? 'show';
        const summary = summaryParam?.value ?? 'full';

        // Handle sum properties (can be single or array)
        let sumProperties: string[] = [];
        if (sumParam) {
            if (sumParam.properties.property) {
                sumProperties = [sumParam.properties.property.ref?.name || ''];
            } else if (sumParam.properties.properties) {
                sumProperties = sumParam.properties.properties
                    .map(p => p.ref?.name || '')
                    .filter(n => n !== '');
            }
        }

        // Handle sumMax (can be int, expression, or array of ints/expressions)
        let sumMax: string | undefined = undefined;
        if (sumMaxParam) {
            if (sumMaxParam.value !== undefined) {
                // It's a single INT
                sumMax = String(sumMaxParam.value);
            } else if (sumMaxParam.expression) {
                // It's a single expression (like self.CarryCapacity), translate it
                const sumMaxNode = translateExpression(entry, id, sumMaxParam.expression);
                if (sumMaxNode) {
                    // Prefix with context. so it evaluates correctly in Vue template
                    sumMax = `context.${toString(sumMaxNode)}`;
                }
            } else if (sumMaxParam.values?.values) {
                // It's an array of ints/expressions
                const maxValues = sumMaxParam.values.values.map((val: any) => {
                    if (typeof val === 'number') {
                        return String(val);
                    } else {
                        // It's an expression, translate it
                        const valNode = translateExpression(entry, id, val);
                        if (valNode) {
                            return `context.${toString(valNode)}`;
                        }
                        return '0';
                    }
                });
                sumMax = `[${maxValues.join(', ')}]`;
            }
        }

        // Handle where expression
        let whereExpression: string | undefined = undefined;
        if (whereParam) {
            const whereNode = translateExpression(entry, id, whereParam.value);
            whereExpression = whereNode ? toString(whereNode) : undefined;
        }

        return expandToNode`
        <v-tabs-window-item v-if="!isHidden('${element.name.toLowerCase()}')" value="${element.name.toLowerCase()}" data-tab="${element.name.toLowerCase()}" data-type="inventory" class="tabs-container">
            <i-inventory
                label="${label}"
                systemPath="${systemPath}"
                :context="context"
                :editMode="editModeRef"
                ${hideLabel ? `:hideLabel="true"` : ''}
                ${icon ? `icon="${icon}"` : ''}
                ${slots ? `:maxSlots="${slots}"` : ''}
                ${rows ? `:rows="${rows}"` : ''}
                :slotSize="${slotSize}"
                documentType="${documentType}"
                ${whereExpression ? `whereExpression="${whereExpression}"` : ''}
                ${globalAllowed ? ':globalAllowed="true"' : ''}
                ${quantityField ? `quantityField="${quantityField}"` : ''}
                ${moneyField ? `moneyField="${moneyField}"` : ''}
                ${moneyFieldLabel ? `moneyFieldLabel="${moneyFieldLabel}"` : ''}
                ${moneyFieldIcon ? `moneyFieldIcon="${moneyFieldIcon}"` : ''}
                ${sumProperties.length > 0 ? `:sumProperties='${JSON.stringify(sumProperties)}'` : ''}
                ${sumMax ? `:sumMax="${sumMax}"` : ''}
                ${sortProperty ? `sortProperty="${sortProperty}"` : ''}
                sortOrder="${sortOrder}"
                emptySlots="${emptySlots}"
                summary="${summary}"
                :primaryColor="primaryColor"
                :secondaryColor="secondaryColor"
                :tertiaryColor="tertiaryColor"
            />
        </v-tabs-window-item>
        `.appendNewLine();
    }

    function generatePinnedTab(element: PinnedField): CompositeGeneratorNode {
        const iconParam = element.params.find(p => isIconParam(p)) as IconParam | undefined;
        const labelParam = element.params.find(p => isLabelParam(p)) as LabelParam | undefined;
        const icon = iconParam?.value ?? "fa-solid fa-thumbtack";
        const label = labelParam?.value ?? `${document.name}.${element.name}`;

        return expandToNode`
        <v-tab v-if="!isHidden('${element.name.toLowerCase()}')" value="${element.name.toLowerCase()}" prepend-icon="${icon}" @mousedown="spawnDatatableWindow($event, '${document.name}', '${element.name}')">{{ game.i18n.localize("${label}") }}</v-tab>
        `.appendNewLine();
    }

    function generatePinnedTabWindow(element: PinnedField): CompositeGeneratorNode {
        const page = AstUtils.getContainerOfType(element, isPage);
        const pageName = page ? page.name : document.name;
        let componentName = `${document.name}${pageName}${element.name}VuetifyDatatable`;
        return expandToNode`
        <v-tabs-window-item v-if="!isHidden('${element.name.toLowerCase()}')" value="${element.name.toLowerCase()}" data-tab="${element.name.toLowerCase()}" data-type="pinned" class="tabs-container">
            <${componentName} 
                :context="context"
                :primaryColor="primaryColor"
                :secondaryColor="secondaryColor"
                :tertiaryColor="tertiaryColor"
            />
        </v-tabs-window-item>
        `.appendNewLine();
    }

    function generateElement(element: Page | ClassExpression | Layout, isTopLevel = false): CompositeGeneratorNode {

        // A layout container's `theme: { ... }` compiles to an inline `style="..."` of ACTUAL
        // CSS (not `--isdl-*` vars, which would inherit and leak sizing into nested children).
        // The themed style is split by who owns the geometry: WIDTH governs the flex item that
        // lays out in the row (the OUTER v-col/v-row), so it must ride that element -- putting it
        // on the inner card lets the column keep its full width and the card just floats inside.
        // HEIGHT + PAINT (border/bg/text) belong on the visible v-card surface (or the bare
        // row/column when there is no card). See css-generator's theme*ToInlineStyle helpers.
        const themeParam = (element as any).params?.find(isThemeFieldParam) as ThemeFieldParam | undefined;

        if (isSection(element)) {
            const colStyle = themeWidthToInlineStyle(themeParam);
            const colAttr = colStyle.length > 0 ? ` style="${colStyle}"` : '';
            const cardStyle = [themeHeightToInlineStyle(themeParam), themePaintToInlineStyle(themeParam)]
                .filter(s => s.length > 0).join('; ');
            const cardAttr = cardStyle.length > 0 ? ` style="${cardStyle}"` : '';
            const sectionParams = (element as any).params ?? [];
            // `hideLabel: true` on a section drops its title bar entirely (compact, unlabeled panel).
            const hideTitle = sectionParams.some((p: any) => isHideLabelParam(p) && p.value);
            // Elevation: per-section theme override, falling back to global theme elevation (default 4).
            const sectionElevationParam = themeParam?.params?.find(isThemeElevationParam) as ThemeElevationParam | undefined;
            const elevation = sectionElevationParam?.value ?? getGlobalThemeElevation(entry);
            // Collapsible: `collapsible: true` wraps body in a toggled expand-transition.
            const isCollapsible = sectionParams.some((p: any) => isCollapsibleParam(p) && p.value);
            const sectionName = element.name.toLowerCase();
            const localizeKey = `${document.name}.${element.name}`;

            if (isCollapsible) {
                const titleBar = hideTitle
                    ? ''
                    : `<v-card-title class="isdl-section-title" @click.stop="toggleSection('${sectionName}')" style="cursor:pointer;display:flex;align-items:center;">{{ game.i18n.localize('${localizeKey}') }}<v-icon class="ml-auto" :icon="collapsedSections['${sectionName}'] ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up'"></v-icon></v-card-title>`;
                return expandToNode`
                <v-col class="section isdl-section isdl-section-${sectionName}"${colAttr}>
                    <v-card variant="outlined" elevation="${elevation}"${cardAttr}>
                        ${titleBar}
                        <v-expand-transition>
                            <v-card-text v-show="!collapsedSections['${sectionName}']">
                                <v-row dense>
                                    ${joinToNode(element.body, element => generateElement(element), {appendNewLineIfNotEmpty: true})}
                                </v-row>
                            </v-card-text>
                        </v-expand-transition>
                    </v-card>
                </v-col>
                `;
            }

            const titleNode = hideTitle ? '' : `<v-card-title>{{ game.i18n.localize('${localizeKey}') }}</v-card-title>`;
            return expandToNode`
            <v-col class="section isdl-section isdl-section-${sectionName}"${colAttr}>
                <v-card variant="outlined" elevation="${elevation}"${cardAttr}>
                    ${titleNode}

                    <v-card-text>
                        <v-row dense>
                            ${joinToNode(element.body, element => generateElement(element), {appendNewLineIfNotEmpty: true})}
                        </v-row>
                   </v-card-text>
                </v-card>
            </v-col>
            `;
        }

        // Bare row/column have no inner card, so sizing AND border ride the element itself.
        // (background/text are section-only and rejected by the validator, so paint here only ever
        // yields a border.) themePaintToInlineStyle was previously omitted here -- dropping borders
        // authored on a row/column.
        const containerStyle = [themeSizingToInlineStyle(themeParam), themePaintToInlineStyle(themeParam)]
            .filter(s => s.length > 0).join('; ');
        const styleAttr = containerStyle.length > 0 ? ` style="${containerStyle}"` : '';

        if (isRow(element)) {
            return expandToNode`
            <v-col cols="12"${styleAttr}>
                <v-row dense class="isdl-row">
                    ${joinToNode(element.body, element => generateElement(element), {appendNewLineIfNotEmpty: true})}
                </v-row>
            </v-col>
            `;
        }

        if (isColumn(element)) {
            return expandToNode`
            <v-col class="isdl-column"${styleAttr}>
                ${joinToNode(element.body, element => generateElement(element), {appendNewLineIfNotEmpty: true})}
            </v-col>
            `;
        }

        // We don't render these elements as part of this function
        if (isPage(element) || isAccess(element) || isStatusProperty(element)) {
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
                :editMode="editModeRef"
                :visibility="visibilityStates['${element.name.toLowerCase()}'].value">
            </${componentName}>
            `;
        }

        if (!isProperty(element)) return expandToNode``;

        if (isProperty(element)) {
            if (element.modifier == "hidden") return expandToNode``;

            const standardParams = element.params as StandardFieldParams[];
            const iconParam = standardParams.find(p => isIconParam(p)) as IconParam | undefined;

            const colorParam = standardParams.find(p => isColorParam(p)) as ColorParam | undefined;

            const label = `${document.name}.${element.name}`;
            // `hideLabel: true` suppresses the field's label text. Passed to every field component
            // via the shared fragment; each component guards its label render on !hideLabel.
            const hideLabel = standardParams.some(p => isHideLabelParam(p) && p.value);
            const baseFragment = `:disabled="isDisabled('${element.name.toLowerCase()}')" v-if="!isHidden('${element.name.toLowerCase()}')"`;
            const standardParamsFragment = `${baseFragment}${colorParam ? ` color="${colorParam.value}"` : ''}${hideLabel ? ' :hideLabel="true"' : ''}`;
            const systemPath = getSystemPath(element, [], undefined, false);

            const entry = AstUtils.getContainerOfType(element, isEntry) as Entry;

            // Single choke point for the theme marker: render the field by type, then stamp the
            // universal `isdl-field` (+ per-field `isdl-field-<name>`) class onto its <i-...> root.
            // Every field branch returns an <i-...> root, so this reaches ALL field types -- no
            // per-branch allowlist to drift out of sync as new field types are added.
            const fieldComponent = (() => {

            if (isRollVisualizerField(element)) {
                const { formula, data } = compileVisualizerFormula(entry, id, element);
                return expandToNode`
                <i-roll-visualizer
                    :context="context"
                    label="${label}"
                    ${iconParam ? `icon="${iconParam.value}"` : ``}
                    ${colorParam ? `color="${colorParam.value}"` : ``}
                    ${hideLabel ? `:hideLabel="true"` : ``}
                    systemPath="${systemPath}"
                    :formula='${formula}'
                    :rollData='${data}'
                    v-if="!isHidden('${element.name.toLowerCase()}')">
                </i-roll-visualizer>
                `;
            }

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
                <i-parent-property-reference
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${systemPath}"
                    :refChoices="[${choices}]"
                    ${standardParamsFragment}>
                </i-parent-property-reference>
                `;
            }

            if (isSelfPropertyRefExp(element)) {
                const choicesParam = element.params.find(p => p.$type === 'SelfPropertyRefChoiceParam');
                let allChoices: Property[] = [];

                // Get the current document
                const currentDocument = getDocument(element);
                if (!currentDocument) {
                    return expandToNode`
                    <div class="error">Self property reference error: Cannot find current document</div>
                    `;
                }

                switch (element.propertyType) {
                    case "attribute":
                        allChoices = getAllOfType<AttributeExp>(currentDocument.body, isAttributeExp);
                        break;
                    case "resource":
                        allChoices = getAllOfType<ResourceExp>(currentDocument.body, isResourceExp);
                        break;
                    case "number":
                        allChoices = getAllOfType<NumberExp>(currentDocument.body, isNumberExp);
                        break;
                    case "boolean":
                        allChoices = getAllOfType<BooleanExp>(currentDocument.body, isBooleanExp);
                        break;
                    case "date":
                        allChoices = getAllOfType<DateExp>(currentDocument.body, isDateExp);
                        break;
                    case "time":
                        allChoices = getAllOfType<TimeExp>(currentDocument.body, isTimeExp);
                        break;
                    case "datetime":
                        allChoices = getAllOfType<DateTimeExp>(currentDocument.body, isDateTimeExp);
                        break;
                    case "die":
                        allChoices = getAllOfType<DieField>(currentDocument.body, isDieField);
                        break;
                    case "dice":
                        allChoices = getAllOfType<DiceField>(currentDocument.body, isDiceField);
                        break;
                    case "string":
                        allChoices = getAllOfType<StringExp>(currentDocument.body, isStringExp);
                        break;
                    case "tracker":
                        allChoices = getAllOfType<TrackerExp>(currentDocument.body, isTrackerExp);
                        break;
                    case "choice":
                        allChoices = getAllOfType<DocumentChoiceExp>(currentDocument.body, isDocumentChoiceExp);
                        break;
                    case "paperdoll":
                        allChoices = getAllOfType<PaperDollExp>(currentDocument.body, isPaperDollExp);
                        break;
                    case "html":
                        allChoices = getAllOfType<HtmlExp>(currentDocument.body, isHtmlExp);
                        break;
                }

                let refChoices = allChoices.filter(x => x !== element).map(x => {
                    return {
                        path: `system.${x.name.toLowerCase()}`,
                        name: x.name
                    };
                });

                // Filter based on choices parameter if provided
                if (choicesParam && (choicesParam as any).choices?.length > 0) {
                    const allowedProperties = (choicesParam as any).choices.map((c: any) => c.property.ref?.name.toLowerCase());
                    refChoices = refChoices.filter(x => allowedProperties.includes(x.name.toLowerCase()));
                }

                const choices = refChoices.map(c => `{ title: '${c.name}', value: '${c.path}' }`).join(", ");
                return expandToNode`
                <i-self-property-reference
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${systemPath}"
                    propertyType="${element.propertyType}"
                    :choices="[${choices}]"
                    ${standardParamsFragment}>
                </i-self-property-reference>
                `;
            }

            if (isStringExp(element)) {
                const valueParam = element.params.find(p => isStringParamValue(p)) as StringParamValue | undefined;

                if (valueParam !== undefined) {
                    return expandToNode`
                    <i-string
                        :context="context"
                        label="${label}"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        ${standardParamsFragment}>
                    </i-string>
                    `;
                }

                return expandToNode`
                    <i-text-field
                        label="${label}"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        ${standardParamsFragment}
                        :context="context"
                        :editMode="editModeRef"
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
                    <i-string-choice
                        :context="context"
                        label="${label}.label"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        :items="[${joinToNode(choicesParam.choices, choiceData, {separator: ',', appendNewLineIfNotEmpty: true})}]"
                        :isExtended="true"
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor"
                        ${standardParamsFragment}>
                    </i-string-choice>
                    `;

            }

            if (isDamageTypeChoiceField(element)) {
                const choicesParam = element.params.find(p => isStringParamChoices(p)) as StringParamChoices | undefined;
                if (!choicesParam) {
                    console.warn(`DamageTypeChoiceField ${element.name} does not have a choices parameter.`);
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
                    let choiceField = element as DamageTypeChoiceField;
                    if (!isStringExtendedChoice(choice.value)) {
                        return expandToNode`{ label: game.i18n.localize('${document.name}.${choiceField.name}.${choiceValue(choice)}'), value: '${choiceValue(choice)}', icon: '', color: '' }`;
                    }
                    let icon = choice.value.properties.find(isIconParam) as IconParam | undefined;
                    let color = choice.value.properties.find(isColorParam) as ColorParam | undefined;

                    function asStringOrVal(value: string | boolean | number | Expression): string {
                        // If string, return as "value", else just value
                        if (typeof value === 'string') return `'${value}'`;
                        return `${value}`;
                    }

                    if (isStringExtendedChoice(choice.value)) {
                        let customProperties = choice.value.properties.filter(isChoiceCustomProperty) as ChoiceCustomProperty[];

                        if (customProperties.length > 0) {
                            return expandToNode`{ label: game.i18n.localize('${document.name}.${choiceField.name}.${choiceValue(choice)}'), value: '${choiceValue(choice)}', icon: '${icon?.value ?? ""}', color: '${color?.value ?? ""}', customKeys: [${joinToNode(customProperties, custom => `{ key: '${custom.key}', label: '${humanize(custom.key)}', value: ${asStringOrVal(custom.value)} }`, {separator: ','})}] }`;
                        }
                    }

                    return expandToNode`{ label: game.i18n.localize('${document.name}.${choiceField.name}.${choiceValue(choice)}'), value: '${choiceValue(choice)}', icon: '${icon?.value ?? ""}', color: '${color?.value ?? ""}' }`;
                }

                return expandToNode`
                    <i-string-choice
                        :context="context"
                        label="${label}.label"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        :items="[${joinToNode(choicesParam.choices, choiceData, {separator: ',', appendNewLineIfNotEmpty: true})}]"
                        :isExtended="true"
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor"
                        ${standardParamsFragment}>
                    </i-string-choice>
                    `;

            }

            if (isStringChoicesField(element)) {
                const choicesParam = element.params.find(p => p.$type === 'StringChoicesParamChoices') as StringChoicesParamChoices | undefined;
                if (!choicesParam) {
                    console.warn(`StringChoicesField ${element.name} does not have a choices parameter.`);
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
                    let choiceField = element as StringChoicesField;
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

                // Get maxSelections parameter
                const maxParam = element.params.find(p => p.$type === 'StringChoicesParamMax') as any;
                const maxSelections = maxParam ? maxParam.value : undefined;

                return expandToNode`
                    <i-string-choices
                        :context="context"
                        label="${label}.label"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        :items="[${joinToNode(choicesParam.choices, choiceData, {separator: ',', appendNewLineIfNotEmpty: true})}]"
                        :isExtended="true"
                        ${maxSelections ? `:maxSelections="${maxSelections}"` : ''}
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor"
                        ${standardParamsFragment}>
                    </i-string-choices>
                    `;
            }

            if (isDocumentChoiceExp(element)) {
                const componentName = `${document.name.toLowerCase()}${element.name}DocumentChoice`;
                return expandToNode`
                    <${componentName}
                        label="${label}"
                        icon="${iconParam?.value}"
                        :context="context"
                        :editMode="editModeRef"
                        ${standardParamsFragment}
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor">
                    </${componentName}>
                `;
            }

            if (isDocumentChoicesExp(element)) {
                const componentName = `${document.name.toLowerCase()}${element.name}DocumentChoices`;
                return expandToNode`
                    <${componentName}
                        label="${label}"
                        icon="${iconParam?.value}"
                        :context="context"
                        :editMode="editModeRef"
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
                        :editMode="editModeRef"
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

            if (isImageField(element)) {
                // A `primary: true` image binds to the document's native `img` (the movable
                // portrait); otherwise it stores at its own system path. The edit path is
                // document-relative ("img" vs "system.<name>") so the sheet's onEditImage handler
                // reads/writes the right property.
                const isPrimary = element.params.some(p => isImagePrimaryParam(p) && p.value);
                const imagePath = isPrimary ? 'img' : systemPath;
                return expandToNode`
                <i-image
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${imagePath}"
                    :primary="${isPrimary}"
                    ${standardParamsFragment}>
                </i-image>
                `;
            }

            if (isDamageBonusesField(element)) {
                return expandToNode`
                <i-bonuses
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${systemPath}"
                    ${standardParamsFragment}>
                </i-bonuses>
                `;
            }

            if (isDamageResistancesField(element)) {
                return expandToNode`
                <i-resistances
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${systemPath}"
                    ${standardParamsFragment}>
                </i-resistances>
                `;
            }

            if (isPinnedField(element)) {
                if (isTopLevel) return expandToNode``;
                const page = AstUtils.getContainerOfType(element, isPage) as Page;
                const pageName = page?.name ?? document.name;
                const systemPath = getSystemPath(element, [], undefined, false);
                let componentName = `${document.name}${pageName}${element.name}VuetifyDatatable`;
                // Wrap in a drop zone so drag-drop works for pinned tables inside a
                // row/column (same reason as regular tables above).
                return expandToNode`
                <div class="datatable-drop-zone" v-if="!isHidden('${element.name.toLowerCase()}')">
                    <${componentName}
                        :context="context"
                        label="${label}"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        :primaryColor="primaryColor" :secondaryColor="secondaryColor" :tertiaryColor="tertiaryColor">
                    </${componentName}>
                </div>
                `;
            }

            if (isBooleanExp(element)) {
                return expandToNode`
                <i-boolean
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${systemPath}"
                    ${standardParamsFragment}>
                </i-boolean>
                `;
            }

            if (isNumberExp(element)) {
                const valueParam = element.params.find(x => isNumberParamValue(x)) as NumberParamValue;
                const minParam = element.params.find(x => isNumberParamMin(x)) as NumberParamMin | undefined;
                const maxParam = element.params.find(x => isNumberParamMax(x)) as NumberParamMax | undefined;
                const calculatorParam = element.params.find(x => isNumberParamCalculator(x)) as NumberParamCalculator | undefined;

                // Determine if min/max are literal numbers (not MethodBlocks). Literal bounds are
                // bound onto the widget so it clamps input at entry, matching the schema's clamp.
                let minValue = undefined;
                if (minParam && typeof minParam.value === 'number') {
                    minValue = minParam.value;
                }
                let maxValue = undefined;
                if (maxParam && typeof maxParam.value === 'number') {
                    maxValue = maxParam.value;
                }

                return expandToNode`
                <i-number
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${systemPath}"
                    :hasValueParam="${valueParam != undefined}"
                    :editMode="editModeRef"
                    :primaryColor="primaryColor"
                    :secondaryColor="secondaryColor"
                    ${minValue !== undefined ? `:min="${minValue}"` : ''}
                    ${maxValue !== undefined ? `:max="${maxValue}"` : ''}
                    ${calculatorParam !== undefined ? `:calculator="${calculatorParam.value}"` : ''}
                    ${standardParamsFragment}>
                </i-number>
                `;
            }

            if (isMoneyField(element)) {
                const formatParam = element.params.find(p => p.$type === 'MoneyFormatParam') as any;
                const precisionParam = element.params.find(p => p.$type === 'MoneyPrecisionParam') as any;
                const displayParam = element.params.find(p => p.$type === 'MoneyDisplayParam') as any;
                const valueParam = element.params.find(x => isNumberParamValue(x)) as NumberParamValue | undefined;

                const format = formatParam?.value || 'auto';
                const precision = precisionParam?.value || 1;
                const display = displayParam?.value || 'breakdown';

                // Generate denominations array from AST
                let denominationsArray = '[]';
                if (element.denominations && element.denominations.length > 0) {
                    const denominations = element.denominations.map(denom => {
                        const valueParam = denom.params.find((p: any) => p.$type === 'MoneyDenominationValueParam') as any;
                        const denomIconParam = denom.params.find((p: any) => p.$type === 'IconParam') as any;
                        const denomColorParam = denom.params.find((p: any) => p.$type === 'ColorParam') as any;

                        return `{ name: '${denom.name}', value: ${valueParam?.value || 1}, icon: '${denomIconParam?.value || ''}', color: '${denomColorParam?.value || ''}' }`;
                    }).join(', ');
                    denominationsArray = `[${denominations}]`;
                }

                return expandToNode`
                <i-money
                    :context="context"
                    label="${label}"
                    icon="${iconParam?.value}"
                    systemPath="${systemPath}"
                    format="${format}"
                    :precision="${precision}"
                    display="${display}"
                    :denominations="${denominationsArray}"
                    :hasValueParam="${valueParam != undefined}"
                    :editMode="editModeRef"
                    :primaryColor="primaryColor"
                    :secondaryColor="secondaryColor"
                    ${standardParamsFragment}>
                </i-money>
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
                const functionParam = element.params.find(x => isAttributeFunctionParam(x));
                // Both `roll:` and `function:` drive the attribute's click overlay. Validation forbids
                // setting both, so at most one of these is defined.
                const clickHandler = rollParam
                    ? expandToNode`on${element.name}AttributeRoll`
                    : (functionParam ? expandToNode`on${element.name}AttributeFunction` : expandToNode`undefined`);
                // roll: keeps the die icon; function: shows the attribute's own icon (or a generic
                // action bolt) so the overlay reflects what the click actually triggers.
                const clickIcon = functionParam ? (iconParam?.value ?? "fa-solid fa-bolt") : "fa-solid fa-dice";

                return expandToNode`
                    <i-attribute
                        label="${label}"
                        icon="${iconParam?.value}"
                        attributeStyle="${style}"
                        :editMode="editModeRef"
                        :hasMod="${hasMod}"
                        :mod="context.${modSystemPath}"
                        systemPath="${valueSystemPath}"
                        :context="context"
                        :min="${min}"
                        ${standardParamsFragment}
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor"
                        :roll="${clickHandler}"
                        :hasRoll="${rollParam != undefined || functionParam != undefined}"
                        clickIcon="${clickIcon}"
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

            if (isDamageTrackExp(element)) {
                const typesParam = element.params.find(x => isDamageTrackTypesParam(x)) as DamageTrackTypesParam | undefined;
                const types = typesParam?.types ?? [];
                const maxParam = element.params.find(x => isNumberParamMax(x)) as NumberParamMax;
                const max = maxParam?.value ?? 5;
                const colorParam = element.params.find(x => isColorParam(x)) as ColorParam | undefined;
                const primaryColor = colorParam ? `'${colorParam.value}'` : "primaryColor";
                return expandToNode`
                <i-damage-track
                    label="${label}"
                    ${hideLabel ? `:hideLabel="true"` : ''}
                    systemPath="system.${element.name.toLowerCase()}"
                    :context="context"
                    :editMode="editModeRef"
                    :primaryColor="${primaryColor}"
                    :secondaryColor="secondaryColor"
                    :types="[${types.map(t => `'${t}'`).join(', ')}]"
                    :max="${max}"
                ></i-damage-track>
                `;
            }

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

                const emptyColorParam = element.params.find(x => isEmptyColorParam(x)) as EmptyColorParam | undefined;
                const emptyColor = emptyColorParam?.value;

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
                    ${hideLabel ? `:hideLabel="true"` : ''}
                    systemPath="system.${element.name.toLowerCase()}" :context="context"
                    :visibility="visibilityStates['${element.name.toLowerCase()}'].value"
                    :editMode="editModeRef"
                    :primaryColor="${primaryColor}" :secondaryColor="secondaryColor" :tertiaryColor="tertiaryColor"
                    ${emptyColor != null ? `emptyColor="${emptyColor}"` : ''}
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
                let noneParam = element.params.find(x => isDieNoneParam(x)) as DieNoneParam | undefined;
                let noneAttr = noneParam?.value ? `:none="true"` : '';

                if (isDieField(element)) {
                    return expandToNode`
                    <i-die
                        :context="context"
                        label="${label}"
                        icon="${iconParam?.value}"
                        systemPath="${systemPath}"
                        :choices="${choices}"
                        ${noneAttr}
                        ${standardParamsFragment}>
                    </i-die>
                    `;
                }

                if (isDiceField(element)) {
                    return expandToNode`
                        <i-dice
                            label="${label}"
                            icon="${iconParam?.value}"
                            systemPath="system.${element.name.toLowerCase()}"
                            :context="context"
                            :editMode="editModeRef"
                            :disabled="isDisabled('${element.name.toLowerCase()}')"
                            v-if="!isHidden('${element.name.toLowerCase()}')"
                            :choices="${choices}"
                            :primaryColor="primaryColor"
                            :secondaryColor="secondaryColor"
                        />
                    `;
                }
            }

            if (isTableField(element)) {
                if (isTopLevel) return expandToNode``;
                const page = AstUtils.getContainerOfType(element, isPage) as Page;
                const pageName = page?.name ?? document.name;
                const systemPath = getSystemPath(element, [], undefined, false);
                let componentName = `${document.name}${pageName}${element.name}VuetifyDatatable`;
                // Wrap in a drop zone so drag-drop works for tables inside a row/column.
                // Tables rendered as their own tab are wrapped in .tabs-container (the
                // sheet's drop target); layout-rendered tables aren't, so without this
                // wrapper they have no drop target. The wrapper only exists in the layout
                // case (never nested inside a .tabs-container), so no double drop binding.
                return expandToNode`
                    <v-col class="pa-1 datatable-drop-zone" cols="12" v-if="!isHidden('${element.name.toLowerCase()}')">
                        <${componentName} systemPath="${systemPath}" :context="context" :primaryColor="primaryColor" :secondaryColor="secondaryColor" :tertiaryColor="tertiaryColor"></${componentName}>
                    </v-col>
                `.appendNewLine();
            }

            if (isInventoryField(element)) {
                if (isTopLevel) return expandToNode``;
                const systemPath = getSystemPath(element, [], undefined, false);
                const iconParam = element.params.find(p => isIconParam(p)) as IconParam | undefined;
                const labelParam = element.params.find(p => isLabelParam(p)) as LabelParam | undefined;
                const slotsParam = element.params.find(isInventorySlotsParam);
                const rowsParam = element.params.find(isInventoryRowsParam);
                const columnsParam = element.params.find(isInventoryColumnsParam);
                const slotSizeParam = element.params.find(isInventorySlotSizeParam);
                const quantityParam = element.params.find(isInventoryQuantityParam);
                const moneyParam = element.params.find(isInventoryMoneyParam);
                const sumParam = element.params.find(isInventorySumParam);
                const sumMaxParam = element.params.find(isInventorySumMaxParam);
                const sortParam = element.params.find(isInventorySortParam);
                const whereParam = element.params.find(isWhereParam);
                const globalParam = element.params.find(isGlobalParam);
                const emptySlotsParam = element.params.find(isInventoryEmptySlotsParam);
                const summaryParam = element.params.find(isInventorySummaryParam);

                const label = labelParam ? labelParam.value : `${document.name}.${element.name}`;
                const icon = iconParam?.value;
                const slots = slotsParam?.value ?? 20;
                const rows = rowsParam?.value;
                const columns = columnsParam?.value;
                const slotSize = slotSizeParam ? parseInt(slotSizeParam.value.replace('px', '')) : 60;
                const documentType = element.documents[0]?.ref?.name.toLowerCase();
                const quantityField = quantityParam?.field.ref?.name.toLowerCase();
                const moneyField = moneyParam?.field.ref?.name.toLowerCase();
                const moneyFieldLabel = moneyField ? `${document.name}.${moneyParam?.field?.ref?.name}` : undefined;
                const moneyFieldIcon = moneyField ? moneyParam?.field?.ref?.params.find(isIconParam)?.value : undefined;
                const sortProperty = sortParam?.property.ref?.name;
                const sortOrder = sortParam?.order ?? 'asc';
                const globalAllowed = globalParam?.value ?? false;
                const emptySlots = emptySlotsParam?.value ?? 'show';
                const summary = summaryParam?.value ?? 'full';

                // Handle sum properties (can be single or array)
                let sumProperties: string[] = [];
                if (sumParam) {
                    if (sumParam.properties.property) {
                        sumProperties = [sumParam.properties.property.ref?.name || ''];
                    } else if (sumParam.properties.properties) {
                        sumProperties = sumParam.properties.properties
                            .map(p => p.ref?.name || '')
                            .filter(n => n !== '');
                    }
                }

                // Handle sumMax (can be int, expression, or array of ints/expressions)
                let sumMax: string | undefined = undefined;
                if (sumMaxParam) {
                    if (sumMaxParam.value !== undefined) {
                        // It's a single INT
                        sumMax = String(sumMaxParam.value);
                    } else if (sumMaxParam.expression) {
                        // It's a single expression (like self.CarryCapacity), translate it
                        const sumMaxNode = translateExpression(entry, id, sumMaxParam.expression);
                        if (sumMaxNode) {
                            // Prefix with context. so it evaluates correctly in Vue template
                            sumMax = `context.${toString(sumMaxNode)}`;
                        }
                    } else if (sumMaxParam.values?.values) {
                        // It's an array of ints/expressions
                        const maxValues = sumMaxParam.values.values.map((val: any) => {
                            if (typeof val === 'number') {
                                return String(val);
                            } else {
                                // It's an expression, translate it
                                const valNode = translateExpression(entry, id, val);
                                if (valNode) {
                                    return `context.${toString(valNode)}`;
                                }
                                return '0';
                            }
                        });
                        sumMax = `[${maxValues.join(', ')}]`;
                    }
                }

                // Handle where expression
                let whereExpression: string | undefined = undefined;
                if (whereParam) {
                    const whereNode = translateExpression(entry, id, whereParam.value);
                    whereExpression = whereNode ? toString(whereNode) : undefined;
                }

                return expandToNode`
                    <i-inventory
                        v-if="!isHidden('${element.name.toLowerCase()}')"
                        label="${label}"
                        systemPath="${systemPath}"
                        :context="context"
                        :editMode="editModeRef"
                        ${hideLabel ? `:hideLabel="true"` : ''}
                        ${icon ? `icon="${icon}"` : ''}
                        ${slots ? `:maxSlots="${slots}"` : ''}
                        ${rows ? `:rows="${rows}"` : ''}
                        ${columns ? `:columns="${columns}"` : ''}
                        :slotSize="${slotSize}"
                        documentType="${documentType}"
                        ${whereExpression ? `whereExpression="${whereExpression}"` : ''}
                        ${globalAllowed ? ':globalAllowed="true"' : ''}
                        ${quantityField ? `quantityField="${quantityField}"` : ''}
                        ${moneyField ? `moneyField="${moneyField}"` : ''}
                        ${moneyFieldLabel ? `moneyFieldLabel="${moneyFieldLabel}"` : ''}
                        ${moneyFieldIcon ? `moneyFieldIcon="${moneyFieldIcon}"` : ''}
                        ${sumProperties.length > 0 ? `:sumProperties='${JSON.stringify(sumProperties)}'` : ''}
                        ${sumMax ? `:sumMax="${sumMax}"` : ''}
                        ${sortProperty ? `sortProperty="${sortProperty}"` : ''}
                        sortOrder="${sortOrder}"
                        emptySlots="${emptySlots}"
                        summary="${summary}"
                        :primaryColor="primaryColor"
                        :secondaryColor="secondaryColor"
                        :tertiaryColor="tertiaryColor"
                    />
                `.appendNewLine();
            }

            return expandToNode`
            <v-alert text="Unknown Property ${(element as any).name}" type="warning" density="compact" class="ga-2 ma-1" variant="outlined"></v-alert>
            `;

            })();
            return injectFieldMarker(fieldComponent, element);
        }

        return expandToNode`
        <v-alert text="Unknown Element" type="warning" density="compact" class="ga-2 ma-1" variant="outlined"></v-alert>
        `;
    }

    // Stamp the universal field marker onto a rendered field's <i-...> component root (the
    // element that also carries the type + single/double-wide classes via attribute fallthrough).
    // `.isdl-field` is the one selector theme-token consumption targets; `.isdl-field-<name>` is
    // the per-field hook + the target a per-field theme override is emitted against.
    function injectFieldMarker(node: CompositeGeneratorNode, element: Property): CompositeGeneratorNode {
        const html = toString(node);
        const marker = `isdl-field isdl-field-${element.name.toLowerCase()}`;
        // Stamp the marker onto the FIRST element tag of the rendered field, whatever its name --
        // <i-number>, a datatable <div class="datatable-drop-zone">, a <DocumentChoice> component,
        // etc. Insert right after the tag NAME so attribute values (which can contain '>') are never
        // parsed. If that tag already leads with a `class` attribute, merge into it (no double class).
        const tag = html.match(/<([A-Za-z][\w.-]*)/);
        if (tag?.index === undefined) return node;
        const insertAt = tag.index + tag[0].length;
        const rest = html.slice(insertAt);
        const injected = /^\s+class="/.test(rest)
            ? html.slice(0, insertAt) + rest.replace(/^(\s+class=")/, `$1${marker} `)
            : html.slice(0, insertAt) + ` class="${marker}"` + rest;
        return expandToNode`${injected}`;
    }
}
