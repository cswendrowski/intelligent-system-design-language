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
    isChatCard,
    isColorParam, isDamageTypeChoiceField,
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
    isTableFieldsParam,
    isTableImageParam,
    isTableImageActionParam,
    isTableSortableParam,
    isTableSearchableParam,
    isTablePinnableParam,
    TableImageActionParam,
    TableSortableParam, TableSearchableParam, TablePinnableParam,
    isTimeExp,
    isTrackerExp, Layout, Property,
    isVisibilityParam, isMethodBlock, isWhereParam,
    Entry,
    StandardFieldParams,
    TableField, TableFieldsParam, TableImageParam,
    VisibilityParam, VisibilityValue, WhereParam
} from "../../../language/generated/ast.js";
import {getAllOfType, getSystemPath} from '../utils.js';
import {translateExpression} from '../method-generator.js';
import {AstUtils, Reference} from 'langium';

export function generateVuetifyDatatableComponent(entry: Entry, id: string, document: Document, pageName: string, table: TableField, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "datatables");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${pageName}${table.name}VuetifyDatatable.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const iconParam = table.params.find(p => isIconParam(p)) as IconParam | undefined;

    // Image column is configurable; defaults to visible unless `image: false` is set in the table definition.
    const imageParam = table.params.find(p => isTableImageParam(p)) as TableImageParam | undefined;
    const imageDefaultVisible = imageParam ? imageParam.value : true;

    // `imageAction:` makes the row's image clickable, running the named action on that item.
    // Kept scoped to the image cell so it never collides with the row's other controls.
    const imageActionParam = table.params.find(p => isTableImageActionParam(p)) as TableImageActionParam | undefined;
    const imageActionName = imageActionParam?.action.ref?.name.toLowerCase();
    // Reveal the action's own icon (mirroring the attribute roll overlay) on image hover.
    const imageActionIcon = (imageActionParam?.action.ref?.params.find(p => isIconParam(p)) as IconParam | undefined)?.value ?? "fa-solid fa-bolt";
    const imageActionColor = (imageActionParam?.action.ref?.params.find(p => isColorParam(p)) as ColorParam | undefined)?.value ?? "primary";

    // `readonly` (or `locked`) controls EDITING only: it hides the Add button and the Actions
    // column (edit/duplicate/delete/send-to-chat). It does NOT affect sort, search, the pin
    // column, or the column-config gear/dialog -- those are view preferences governed by the
    // independent `sortable:`/`searchable:`/`pinnable:` params (default true / current behavior).
    const isReadonly = table.modifier === 'readonly' || table.modifier === 'locked';

    // View-preference params, independent of `readonly` and of each other. Absent = enabled.
    // BOOLEAN is a real boolean (grammar), so `?? true` preserves an explicit `false`.
    const isSortable = (table.params.find(p => isTableSortableParam(p)) as TableSortableParam | undefined)?.value ?? true;
    const isSearchable = (table.params.find(p => isTableSearchableParam(p)) as TableSearchableParam | undefined)?.value ?? true;
    const isPinnable = (table.params.find(p => isTablePinnableParam(p)) as TablePinnableParam | undefined)?.value ?? true;

    // Resolve the static visibility of a column from its `visibility:` param (preferred) or its modifier.
    // Method-block visibility can't be resolved at build time, so we fall back to the modifier / default.
    function getStaticColumnVisibility(property: Property): string {
        const visParam = (property.params as StandardFieldParams[] | undefined)?.find(p => isVisibilityParam(p)) as VisibilityParam | undefined;
        if (visParam && !isMethodBlock(visParam.visibility)) {
            return (visParam.visibility as VisibilityValue).visibility;
        }
        return property.modifier ?? 'default';
    }

    let fieldsParam = table.params.find(x => isTableFieldsParam(x)) as TableFieldsParam | undefined;
    let defaultVisibleFields = [] as string[];
    if (fieldsParam) {
        defaultVisibleFields = fieldsParam.fields;
    }
    else if (table.documents[0]?.ref?.body) {
        defaultVisibleFields = getAllOfType<Property>(table.documents[0].ref.body, isProperty, false)
            .map(p => p.name.toLowerCase()) ?? [];
    }

    function generateDataTableHeader(refDoc: Reference<Document> | undefined, property: ClassExpression | Layout): CompositeGeneratorNode | undefined {
        if ( isLayout(property) ) {
            return expandToNode`
                ${joinToNode(property.body, p => generateDataTableHeader(refDoc, p), { appendNewLineIfNotEmpty: true })}
            `;
        }
        if ( isHtmlExp(property) || isInitiativeProperty(property) || isPaperDollElement(property) || isHookHandler(property) ) return undefined;

        if ( isProperty(property) ) {
            const visibility = getStaticColumnVisibility(property);
            // Statically-hidden columns are excluded entirely (no leak, no slot).
            if (visibility === "hidden") return undefined;

            let systemPath = getSystemPath(property, [], undefined, false);
            let sortable = isSortable;

            if (isResourceExp(property) || isTrackerExp(property) || isDiceField(property) || isMeasuredTemplateField(property)) {
                sortable = false;
            }

            if (isResourceExp(property) || isTrackerExp(property)) {
                systemPath = systemPath.replace(/\.(value|max)$/, '');
            }

            let localizeName = `${refDoc?.ref?.name}.${property.name}`;
            let minWidth = '100px'; // Default minimum width

            // Set appropriate minimum widths based on field type
            if (isStringExp(property)) {
                minWidth = '140px'; // Text fields need more space for content
                return expandToNode`
                    { title: game.i18n.localize("${localizeName}"), key: '${systemPath}', sortable: ${sortable}, minWidth: '${minWidth}', visibility: '${visibility}' },
                `;
            }

            if (isDocumentChoiceExp(property) || isStringChoiceField(property) || isDamageTypeChoiceField(property)) {
                localizeName += ".label";
                minWidth = '120px'; // Document choices need extra space
            }

            if (isResourceExp(property) || isTrackerExp(property)) {
                minWidth = '90px'; // Resource/tracker columns are compact
            }

            if (isDieField(property) || isDiceField(property)) {
                minWidth = '80px'; // Dice fields are compact
            }

            if (isBooleanExp(property)) {
                minWidth = '80px'; // Boolean chips are compact
            }

            if (isTimeExp(property) || isDateExp(property) || isDateTimeExp(property)) {
                minWidth = '120px'; // Date fields need space for formatting
            }

            if (isMeasuredTemplateField(property)) {
                minWidth = '130px'; // Template fields have longer text
            }

            return expandToNode`
                { title: game.i18n.localize("${localizeName}"), key: '${systemPath}', sortable: ${sortable}, minWidth: '${minWidth}', type: '${property.$type}', visibility: '${visibility}' },
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
            // Match the header generator: statically-hidden columns have no header and no slot.
            // gmOnly/secret columns keep their slot (GMs/owners may still see the column).
            if (getStaticColumnVisibility(property) === "hidden") return undefined;

            let systemPath = getSystemPath(property, [], undefined, false);
            const slotName = systemPath;

            if (isBooleanExp(property)) {
                return expandToNode`
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName}="{ item }">
                        <v-chip
                            :color="getNestedValue(item, '${systemPath}') ? props.primaryColor : props.secondaryColor"
                            size="x-small"
                            variant="elevated"
                            class="text-caption"
                            label
                        >
                            <v-icon v-if="getNestedValue(item, '${systemPath}')">fa-solid fa-check</v-icon>
                            <v-icon v-else>fa-solid fa-times</v-icon>
                        </v-chip>
                    </template>
                `;
            }

            if (isStringExp(property)) {
                return expandToNode`
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName}="{ item }">
                        <div class="text-caption text-truncate" :data-tooltip="getNestedValue(item, '${systemPath}')" style="max-width: 300px;">
                            {{ getNestedValue(item, '${systemPath}') }}
                        </div>
                    </template>
                `;
            }

            if (isStringChoiceField(property)) {
                systemPath = systemPath.replace(/\.(value)$/, '');
                const parentDocument = AstUtils.getContainerOfType(property, isDocument);
                return expandToNode`
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName}="{ item }">
                        <v-chip label size="x-small" variant="elevated" class="text-caption" :color="getNestedValue(item, '${systemPath}.color')" :prepend-icon="getNestedValue(item, '${systemPath}.icon')" :data-tooltip="getExtendedChoiceTooltip(item, '${systemPath}')">
                            {{ game.i18n.localize('${parentDocument?.name}.${property.name}.' + getNestedValue(item, '${systemPath}.value')) }}
                        </v-chip>
                    </template>
                `;
            }

            if (isParentPropertyRefExp(property)) {
                return expandToNode`
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName}="{ item }">
                        <span class="text-caption">{{ humanize(getNestedValue(item, '${systemPath}')) }}</span>
                    </template>
                `;
            }

            if (isResourceExp(property) || isTrackerExp(property)) {
                systemPath = systemPath.replace(/\.(value|max)$/, '');
                return expandToNode`
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName.replace(".value", "")}="{ item }">
                        <v-chip 
                            label
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
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName}="{ item }">
                        <v-chip 
                            label
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
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName}="{ item }">
                        <v-chip 
                            label
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
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName}="{ item }">
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
                    <template v-if="isColumnVisible('${systemPath}')" v-slot:item.${slotName}="{ item }">
                        <span class="text-caption">{{ formatDate(getNestedValue(item, '${systemPath}')) }}</span>
                    </template>
                `;
            }
        }
        return undefined;
    }

    // Optional `where:` filter -- translates to a JS predicate over each item (the iteration
    // variable is `item`, matching ItemAccess's `item.system.<field>` translation). Choice fields
    // are stored as {value,...} objects, but `where: item.SomeChoice equals "X"` works for
    // `choice<string>` and `choice<damageType>`: method-generator auto-resolves those to `.value`.
    // Document choices (`choice<Doc>`) are NOT auto-resolved, so compare those by their explicit path.
    const whereParam = table.params.find(x => isWhereParam(x)) as WhereParam | undefined;
    const whereClause = whereParam ? translateExpression(entry, id, whereParam.value) : undefined;

    const typeFilterExpr = table.documents.length > 1
        ? `['${table.documents.map(d => d.ref?.name.toLowerCase()).join("', '")}'].includes(i.type)`
        : `i.type === '${table.documents[0]?.ref?.name.toLowerCase() ?? ''}'`;

    let tableDocBody = table.documents[0]?.ref?.body ?? [];
    const actions = getAllOfType<Action>(tableDocBody, isAction, false);

    // Split actions into primary and secondary
    const primaryActions = actions.filter(action => !action.isSecondary);
    const secondaryActions = actions.filter(action => action.isSecondary);

    // Check if any PRIMARY actions have chat cards (exclude secondary actions)
    const hasActionWithChat = primaryActions.some(action =>
        action.method.body.some(expr => isChatCard(expr))
    );

    // Multi-type: collect per-document-type action metadata for runtime dispatch
    const multiTypeActionsData = table.documents.length > 1
        ? table.documents.map(docRef => {
            const docName = docRef.ref?.name.toLowerCase() ?? '';
            const docActions = getAllOfType<Action>(docRef.ref?.body ?? [], isAction, false);
            return {
                typeName: docName,
                actions: docActions.map(action => {
                    const standardParams = action.params as StandardFieldParams[];
                    const icon = (standardParams.find(x => isIconParam(x)) as IconParam)?.value ?? "fa-solid fa-bolt";
                    const color = (standardParams.find(x => isColorParam(x)) as ColorParam)?.value ?? "primary";
                    const parentDocument = AstUtils.getContainerOfType(action, isDocument);
                    return {
                        name: action.name.toLowerCase(),
                        icon,
                        color,
                        label: `${parentDocument?.name}.${action.name}`,
                        isSecondary: action.isSecondary ?? false
                    };
                })
            };
        })
        : [];
    const hasActionWithChatAny = table.documents.length > 1
        ? table.documents.some(docRef =>
            getAllOfType<Action>(docRef.ref?.body ?? [], isAction, false)
                .filter(a => !a.isSecondary)
                .some(action => action.method.body.some(isChatCard))
          )
        : hasActionWithChat;

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject, onMounted, onUnmounted, watch, nextTick } from "vue";

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
        const showColumnDialog = ref(false);

        const columnVisibility = ref({});
        const columnOrder = ref([]);

        const data = computed(() => {
            // Table fields represent embedded items. Map over context.object.items (plain objects
            // from toObject()) to keep the reactive dependency and avoid Vue's reactive proxy
            // traversing Foundry's EmbeddedCollection. toObject() omits derived/computed values
            // (their getters are non-enumerable), so we transiently read the live item and overlay
            // each schema field's resolved value -- the live item is never stored in reactive state.
            const allItems = props.context?.object?.items ?? [];
            return allItems.filter(i => ${typeFilterExpr}).map(plain => {
                const live = document.items.get(plain._id);
                if (live) {
                    const fields = live.system.schema?.fields ?? live.system.constructor?.schema?.fields ?? {};
                    for (const key of Object.keys(fields)) {
                        plain.system[key] = foundry.utils.deepClone(live.system[key]);
                    }
                }
                return plain;
            })${whereClause ? expandToNode`.filter(item => {
                return ${whereClause};
            })` : ''};
        });

        // Create a map of item _id to item for drag operations
        const itemMap = computed(() => {
            const map = new Map();
            data.value.forEach(item => {
                map.set(item._id, item);
            });
            return map;
        });

        // Expose itemMap globally for drag handlers to access
        if (!window.isdlItemMaps) window.isdlItemMaps = new Map();
        window.isdlItemMaps.set(document._id, itemMap);
        
        const customHeaders = [
            // Image and Name are configurable columns like any other. Image is ordered first by default.
            { title: game.i18n.localize("Image"), key: 'img', sortable: false, width: '50px', maxWidth: '50px' },
            { title: game.i18n.localize("Name"), key: 'name', sortable: ${isSortable}, minWidth: '120px', locked: true },
            ${table.documents.length > 1 ? `{ title: game.i18n.localize("Type"), key: 'type', sortable: ${isSortable}, minWidth: '80px' },` : ''}
            ${table.documents.length > 1 && fieldsParam
                ? joinToNode(
                    fieldsParam.fields.map(fieldName => {
                        for (const docRef of table.documents) {
                            const found = getAllOfType<Property>(docRef.ref?.body ?? [], isProperty, false)
                                .find(p => p.name.toLowerCase() === fieldName.toLowerCase());
                            if (found) return { field: found, docRef };
                        }
                        return undefined;
                    }).filter((x): x is { field: Property; docRef: Reference<Document> } => x !== undefined),
                    ({ field, docRef }) => generateDataTableHeader(docRef, field),
                    { appendNewLineIfNotEmpty: true }
                  )
                : joinToNode((table.documents[0]?.ref?.body ?? []), p => generateDataTableHeader(table.documents[0], p), { appendNewLineIfNotEmpty: true })}
        ];

        const orderedHeaders = computed(() => {
            if (columnOrder.value.length === 0) {
                return customHeaders;
            }
            
            // Create a map for quick lookup
            const headerMap = new Map();
            customHeaders.forEach(header => {
                headerMap.set(header.key, header);
            });
            
            // Build ordered array based on columnOrder, then add any missing headers
            const ordered = [];
            columnOrder.value.forEach(key => {
                if (headerMap.has(key)) {
                    ordered.push(headerMap.get(key));
                    headerMap.delete(key);
                }
            });
            
            // Add any remaining headers that weren't in the order
            headerMap.forEach(header => {
                ordered.push(header);
            });
            
            return ordered;
        });

        // Per-viewer column gating from the referenced field's visibility.
        // 'hidden' columns are already dropped at build time; method-block visibility can't be
        // resolved here, so such columns fall through as visible.
        const passesVisibility = (header) => {
            const v = header?.visibility;
            if (v === 'gmOnly') return game.user.isGM;
            if (v === 'secret') {
                return game.user.isGM || document.getUserLevel(game.user) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
            }
            return true;
        };

        const visibleHeaders = computed(() => {
            const baseHeaders = [
                ${isPinnable ? expandToNode`{
                    title: "",
                    key: 'system.pinned',
                    sortable: false,
                    width: '40px',
                    maxWidth: '40px',
                    align: 'center'
                }` : ''}
            ];

            let customHeadersToShow = orderedHeaders.value.filter(header => header && isColumnVisible(header.key) && passesVisibility(header));

            const actionHeaders = [
                ${isReadonly ? '' : expandToNode`{
                    title: game.i18n.localize("Actions"),
                    key: 'actions',
                    sortable: false,
                    width: '150px',
                    align: 'center'
                }`}
            ];

            return [...baseHeaders, ...customHeadersToShow, ...actionHeaders];
        });
        
        // Column configuration
        const settingKey = 'documentTableColumns';
        
        const defaultVisibileColumns = [
            ${joinToNode(defaultVisibleFields, p => expandToNode`'system.${p.toLowerCase()}'`, { separator: ",", appendNewLineIfNotEmpty: true })}
        ];

        // Default visibility per column. Image defaults to the image table param (default true),
        // Name is always visible (locked), and the rest follow the table's fields defaults.
        const columnDefaultVisible = (key) => {
            if (key === 'img') return ${imageDefaultVisible};
            if (key === 'name') return true;
            ${table.documents.length > 1 ? `if (key === 'type') return true;` : ''}
            return defaultVisibileColumns.includes(key);
        };

        const buildDefaultVisibility = (tableSettings) => {
            const defaultVisibility = {};
            customHeaders.forEach(col => {
                defaultVisibility[col.key] = columnDefaultVisible(col.key);
                if (tableSettings && tableSettings.visibility && tableSettings.visibility[col.key] !== undefined) {
                    defaultVisibility[col.key] = tableSettings.visibility[col.key];
                }
            });
            // Name can never be hidden.
            defaultVisibility['name'] = true;
            return defaultVisibility;
        };

        const initializeColumnSettings = async () => {
            try {
                const savedSettings = game.settings.get("${id}", settingKey) || {};
                const documentTables = savedSettings[document._id] || {};
                const tableSettings = documentTables['${pageName}${table.name}'] || {};

                columnVisibility.value = buildDefaultVisibility(tableSettings);

                // Initialize order
                if (tableSettings.order && Array.isArray(tableSettings.order)) {
                    // Start from the saved order, then splice in any columns the save predates
                    // (e.g. img/name, or fields added to the document later) at their default index.
                    const order = [...tableSettings.order];
                    customHeaders.map(h => h.key).forEach((key, idx) => {
                        if (!order.includes(key)) {
                            order.splice(Math.min(idx, order.length), 0, key);
                        }
                    });
                    columnOrder.value = order;
                } else {
                    // Default order is the order they appear in customHeaders
                    columnOrder.value = customHeaders.map(h => h.key);
                }
            } catch (error) {
                console.warn("Failed to load column settings, using defaults:", error);
                // Use defaults if setting doesn't exist yet
                columnVisibility.value = buildDefaultVisibility(null);
                columnOrder.value = customHeaders.map(h => h.key);
            }
        };

        const saveColumnSettings = async () => {
            try {
                const savedSettings = game.settings.get("${id}", settingKey) || {};
                const documentTables = savedSettings[document._id] || {};
                savedSettings[document._id] = documentTables;
                
                const tableSettings = documentTables['${pageName}${table.name}'] || {};
                
                // Save visibility
                const visibilitySettings = {};
                customHeaders.forEach(col => {
                    visibilitySettings[col.key] = columnVisibility.value[col.key];
                });
                
                tableSettings.visibility = visibilitySettings;
                tableSettings.order = [...columnOrder.value];
                
                savedSettings[document._id]['${pageName}${table.name}'] = tableSettings;
                await game.settings.set("${id}", settingKey, savedSettings);
            } catch (error) {
                console.error("Failed to save column settings:", error);
                ui.notifications.error("Failed to save column settings");
            }
        };

        const isColumnVisible = (columnKey) => {
            return columnVisibility.value[columnKey] !== false;
        };

        const toggleColumn = async (columnKey) => {
            // Name is the row identity column and can't be hidden.
            if (columnKey === 'name') return;
            columnVisibility.value[columnKey] = !columnVisibility.value[columnKey];
            await saveColumnSettings();
        };

        const resetColumns = async () => {
            columnVisibility.value = buildDefaultVisibility(null);
            columnOrder.value = customHeaders.map(h => h.key);
            await saveColumnSettings();
        };

        const moveColumn = async (fromIndex, toIndex) => {
            const newOrder = [...columnOrder.value];
            const [movedItem] = newOrder.splice(fromIndex, 1);
            newOrder.splice(toIndex, 0, movedItem);
            columnOrder.value = newOrder;
            await saveColumnSettings();
        };

        const onColumnDragStart = (event, index) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', index.toString());
        };

        const onColumnDragOver = (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        };

        const onColumnDrop = async (event, toIndex) => {
            event.preventDefault();
            const fromIndex = parseInt(event.dataTransfer.getData('text/plain'));
            if (fromIndex !== toIndex) {
                await moveColumn(fromIndex, toIndex);
            }
        };

        onMounted(() => {
            initializeColumnSettings();
        });

        const humanize = (str) => {
            if (!str) return "";
            let humanized = str.replace(/_/g, " ");
            humanized = humanized.replace("system.", "").replaceAll(".", " ");
            humanized = humanized.charAt(0).toUpperCase() + humanized.slice(1);
            return humanized;
        };

        const getNestedValue = (obj, path) => {
            const data = foundry.utils.getProperty(obj, path);
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

        const duplicateItem = async (item) => {
            loading.value = true;
            try {
                const foundryItem = document.items.get(item._id);
                const itemData = foundryItem.toObject();
                itemData.name = "Copy of " + itemData.name;
                delete itemData._id;

                const duplicatedItems = await Item.createDocuments([itemData], {parent: document});
                if (duplicatedItems && duplicatedItems[0]) {
                    ui.notifications.info(\`Duplicated "\${foundryItem.name}"\`);
                }
            } catch (error) {
                console.error("Error duplicating item:", error);
                ui.notifications.error("Failed to duplicate item");
            } finally {
                loading.value = false;
            }
        };

        const customItemAction = async (item, actionName) => {
            const foundryItem = document.items.get(item._id);
            const event = { currentTarget: { dataset: { action: actionName } } };
            foundryItem.sheet._onAction(event);
        };

        ${table.documents.length > 1 ? expandToNode`
        const getActionsForType = (itemType) => {
            const actionsMap = {
                ${joinToNode(multiTypeActionsData, ({ typeName, actions }) => expandToNode`'${typeName}': [${joinToNode(actions, a => expandToNode`{ name: '${a.name}', icon: '${a.icon}', color: '${a.color}', label: '${a.label}', isSecondary: ${a.isSecondary} }`, { separator: ', ' })}],`, { appendNewLineIfNotEmpty: true })}
            };
            return actionsMap[itemType?.toLowerCase()] || [];
        };` : ''}

        const togglePin = async (item) => {
            const foundryItem = document.items.get(item._id);
            await foundryItem.update({"system.pinned": !foundryItem.system.pinned});
        };

        ${table.documents.length > 1
            ? joinToNode(table.documents, d => {
                const typeName = d.ref?.name.toLowerCase() ?? '';
                return expandToNode`
        const addNew_${typeName} = async () => {
            loading.value = true;
            try {
                const items = await Item.createDocuments([{
                    type: '${typeName}',
                    name: "New ${typeName}"
                }], {parent: document});
                if (items && items[0]) { items[0].sheet.render(true); }
            } catch (error) {
                console.error("Error creating item:", error);
                ui.notifications.error("Failed to create new item");
            } finally { loading.value = false; }
        };`;
            }, { appendNewLineIfNotEmpty: true })
            : expandToNode`
        const addNewItem = async () => {
            loading.value = true;
            try {
                const type = '${table.documents[0]?.ref?.name.toLowerCase()}';
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
        };`}
        
        const truncate = (text, maxLength) => {
            if (!text) return '';
            if (text.length > maxLength) {
                return text.substring(0, maxLength) + '...';
            }
            return text;
        }

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
            const tooltipParts = [];
            const coreKeys = ['value', 'color', 'icon'];
            const base = getNestedValue(item, systemPath);
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

        // Get item props for row attributes (for drag-drop)
        const getItemProps = (item) => {
            // Construct UUID for embedded items: parent.uuid + Item.itemId
            const itemUuid = item.uuid || \`\${document.uuid}.Item.\${item._id}\`;
            return {
                'data-item-id': item._id,
                'data-document-id': document._id,
                'data-uuid': itemUuid
            };
        };

        // Function to add data attributes to table rows
        const updateTableRowAttributes = () => {
            const tableEl = window.document.querySelector('.custom-datatable table');
            if (!tableEl) {
                console.warn('Table not found for attribute update');
                return;
            }

            const rows = tableEl.querySelectorAll('tbody tr');
            const items = data.value;

            rows.forEach((row, index) => {
                if (index < items.length) {
                    const item = items[index];
                    const itemUuid = item.uuid || \`\${document.uuid}.Item.\${item._id}\`;
                    row.setAttribute('data-item-id', item._id);
                    row.setAttribute('data-document-id', document._id);
                    row.setAttribute('data-uuid', itemUuid);
                }
            });
        };

        // Watch for data changes and update attributes
        watch(data, () => {
            nextTick(updateTableRowAttributes);
        }, { immediate: false });

        // Bind drag drop and update attributes after component mount
        onMounted(() => {
            setTimeout(() => {
                updateTableRowAttributes();
                bindDragDrop();
            }, 200);
        });

        // Clean up item map on unmount
        onUnmounted(() => {
            if (window.isdlItemMaps) {
                window.isdlItemMaps.delete(document._id);
            }
        });
    </script>

    <template>
        <v-card flat class="isdl-datatable">
            <v-card-title class="d-flex align-center pe-1" style="height: 40px;">
                <v-icon icon="fa-solid ${iconParam ? iconParam.value : 'fa-table'}" size="small" />
                &nbsp; {{ game.i18n.localize("${document.name}.${table.name}") }}
                <v-spacer></v-spacer>
                ${isSearchable ? expandToNode`<v-text-field
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
                ></v-text-field>` : ''}
                <v-btn
                    icon="fa-solid fa-columns"
                    size="small"
                    variant="text"
                    @click="showColumnDialog = true"
                    style="margin-right: 8px;"
                >
                    <v-icon>fa-solid fa-columns</v-icon>
                    <v-tooltip activator="parent" location="top">Configure Columns</v-tooltip>
                </v-btn>
                ${isReadonly ? '' : (
                    table.documents.length > 1
                        ? expandToNode`<v-menu>
                    <template v-slot:activator="{ props }">
                        <v-btn
                            v-bind="props"
                            :color="primaryColor || 'primary'"
                            prepend-icon="fa-solid fa-plus"
                            append-icon="fa-solid fa-caret-down"
                            rounded="0"
                            size="small"
                            :loading="loading"
                            style="height: 38px;"
                        >
                            {{ game.i18n.localize("Add") }}
                        </v-btn>
                    </template>
                    <v-list density="compact" class="pa-0">
                        ${joinToNode(table.documents, d => {
                            const typeName = d.ref?.name.toLowerCase() ?? '';
                            return expandToNode`<v-list-item @click="addNew_${typeName}" min-height="32">
                            <template v-slot:prepend><v-icon icon="fa-solid fa-plus" size="15"></v-icon></template>
                            <v-list-item-title>${d.ref?.name ?? ''}</v-list-item-title>
                        </v-list-item>`;
                        }, { appendNewLineIfNotEmpty: true })}
                    </v-list>
                </v-menu>`
                        : expandToNode`<v-btn
                    :color="primaryColor || 'primary'"
                    prepend-icon="fa-solid fa-plus"
                    rounded="0"
                    size="small"
                    :loading="loading"
                    @click="addNewItem"
                    style="max-width: 80px; height: 38px;"
                >
                    {{ game.i18n.localize("Add") }}
                </v-btn>`
                )}
            </v-card-title>
            <v-divider></v-divider>
            
            <v-data-table
                ${isSearchable ? expandToNode`v-model:search="search"` : ''}
                :headers="visibleHeaders"
                :items="data"
                ${isSearchable ? expandToNode`:search="search"` : ''}
                hover
                density="compact"
                hide-default-footer
                items-per-page=-1
                style="background: none;"
                class="custom-datatable"
                :sort-by="[{ key: 'system.pinned', order: 'desc' }, { key: 'name', order: 'asc' }]"
                :item-props="getItemProps"
            >
                <!-- Image slot -->
                <template v-slot:item.img="{ item }">
                    ${imageActionName
                        ? expandToNode`<div class="isdl-image-action" @click.stop="customItemAction(item, '${imageActionName}')" :data-tooltip="game.i18n.localize('${table.documents[0]?.ref?.name}.${imageActionParam!.action.ref!.name}')">
                        <v-avatar size="40" rounded="0">
                            <v-img :src="item.img" :alt="item.name" cover></v-img>
                        </v-avatar>
                        <div class="isdl-image-action-overlay">
                            <v-btn icon size="x-small" color="${imageActionColor}" variant="elevated" elevation="4" class="isdl-image-action-btn">
                                <v-icon size="small">${imageActionIcon}</v-icon>
                            </v-btn>
                        </div>
                    </div>`
                        : expandToNode`<v-avatar size="40" rounded="0">
                        <v-img :src="item.img" :alt="item.name" cover></v-img>
                    </v-avatar>`}
                </template>

                <!-- Name slot with description tooltip -->
                <template v-slot:item.name="{ item }">
                    <div class="d-flex align-center" :data-tooltip="item.system.description">
                        <div class="font-weight-medium text-truncate" style="min-width: 120px; max-width: 200px;">{{ item.name }}</div>
                    </div>
                </template>

                <!-- Pinned slot -->
                ${isPinnable ? expandToNode`<template v-slot:item.system.pinned="{ item }">
                    <div class="d-flex justify-center">
                        <v-btn
                            icon
                            size="small"
                            variant="text"
                            @click="togglePin(item)"
                            :data-tooltip="item.system.pinned ? 'Unpin' : 'Pin'"
                        >
                            <v-icon
                                :icon="item.system.pinned ? 'fa-solid fa-thumbtack' : 'fa-regular fa-thumbtack'"
                                :color="item.system.pinned ? primaryColor : 'grey'"
                                size="small"
                            ></v-icon>
                        </v-btn>
                    </div>
                </template>` : ''}

                <!-- Type chip slot for multi-type tables -->
                ${table.documents.length > 1 ? expandToNode`<template v-slot:item.type="{ item }">
                    <v-chip size="x-small" variant="outlined" color="primary" label class="text-caption">
                        {{ item.type }}
                    </v-chip>
                </template>` : ''}

                <!-- Custom field slots -->
                ${table.documents.length > 1 && fieldsParam
                    ? joinToNode(
                        fieldsParam.fields.map(fieldName => {
                            for (const docRef of table.documents) {
                                const found = getAllOfType<Property>(docRef.ref?.body ?? [], isProperty, false)
                                    .find(p => p.name.toLowerCase() === fieldName.toLowerCase());
                                if (found) return { field: found, docRef };
                            }
                            return undefined;
                        }).filter((x): x is { field: Property; docRef: Reference<Document> } => x !== undefined),
                        ({ field, docRef }) => generateSlotTemplate(docRef, field),
                        { appendNewLineIfNotEmpty: true }
                      )
                    : joinToNode((table.documents[0]?.ref?.body ?? []), p => generateSlotTemplate(table.documents[0], p), { appendNewLineIfNotEmpty: true })}

                <!-- Actions slot -->
                ${isReadonly ? '' : expandToNode`<template v-slot:item.actions="{ item }">
                    <div class="d-flex align-center justify-center ga-1">
                        ${table.documents.length > 1
                            ? expandToNode`<template v-for="action in getActionsForType(item.type).filter(a => !a.isSecondary)" :key="action.name">
                            <v-tooltip :text="game.i18n.localize(action.label)">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-bind="props" :icon="action.icon" size="x-small" variant="text" :color="action.color" @click="customItemAction(item, action.name)"></v-btn>
                                </template>
                            </v-tooltip>
                        </template>`
                            : joinToNode(primaryActions, generateActionButton, { appendNewLineIfNotEmpty: true })}
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
                        ${!hasActionWithChatAny ? expandToNode`
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
                        ` : ''}
                        <v-menu>
                            <template v-slot:activator="{ props }">
                                <v-btn
                                    v-bind="props"
                                    icon="fa-solid fa-ellipsis-vertical"
                                    size="x-small"
                                    variant="text"
                                ></v-btn>
                            </template>
                            <v-list density="compact" class="pa-0" min-width="120">
                                ${hasActionWithChatAny ? expandToNode`
                                <v-list-item
                                    @click="sendItemToChat(item)"
                                    title="Send to Chat"
                                    min-height="32"
                                >
                                    <template v-slot:prepend>
                                        <v-icon icon="fa-solid fa-message" size="15"></v-icon>
                                    </template>
                                </v-list-item>
                                ` : ''}
                                ${table.documents.length > 1
                                    ? expandToNode`<template v-for="action in getActionsForType(item.type).filter(a => a.isSecondary)" :key="action.name">
                                    <v-list-item @click="customItemAction(item, action.name)" :title="game.i18n.localize(action.label)" min-height="32">
                                        <template v-slot:prepend><v-icon :icon="action.icon" size="15"></v-icon></template>
                                    </v-list-item>
                                </template>`
                                    : joinToNode(secondaryActions, generateSecondaryActionMenuItem, { appendNewLineIfNotEmpty: true })}
                                <v-list-item
                                    @click="duplicateItem(item)"
                                    title="Duplicate"
                                    min-height="32"
                                >
                                    <template v-slot:prepend>
                                        <v-icon icon="fa-solid fa-copy" size="15"></v-icon>
                                    </template>
                                </v-list-item>
                                <v-list-item
                                    @click="deleteItem(item)"
                                    title="Delete"
                                    class="text-error"
                                    min-height="32"
                                >
                                    <template v-slot:prepend>
                                        <v-icon icon="fa-solid fa-trash" size="15"></v-icon>
                                    </template>
                                </v-list-item>
                            </v-list>
                        </v-menu>
                    </div>
                </template>`}

                <!-- No data slot -->
                <template v-slot:no-data>
                    <div class="text-center pa-4">
                        <v-icon size="48" color="grey-lighten-1">fa-solid fa-inbox</v-icon>
                        <div class="text-h6 mt-2">No items found</div>
                        <div class="text-body-2 text-medium-emphasis">
                            Add your first {{ game.i18n.localize("${table.documents.length > 1 ? "item" : (table.documents[0]?.ref?.name ?? "item")}").toLowerCase() }} to get started
                        </div>
                    </div>
                </template>
            </v-data-table>
        </v-card>

        <!-- Column Configuration Dialog (always available; a view preference, not editing) -->
        <v-dialog v-model="showColumnDialog" max-width="600px">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="me-2">fa-solid fa-columns</v-icon>
                    Configure Columns
                </v-card-title>
                <v-divider></v-divider>
                <v-card-text>
                    <div class="text-body-2 mb-4 text-medium-emphasis">
                        Drag to reorder columns, check/uncheck to show/hide columns
                    </div>
                    <v-list density="compact" class="column-config-list">
                        <div
                            v-for="(columnKey, index) in columnOrder"
                            :key="columnKey"
                            v-if="passesVisibility(customHeaders.find(h => h.key === columnKey))"
                            class="column-config-item"
                            draggable="true"
                            @dragstart="onColumnDragStart($event, index)"
                            @dragover="onColumnDragOver"
                            @drop="onColumnDrop($event, index)"
                        >
                            <v-list-item class="px-2">
                                <template v-slot:prepend>
                                    <v-icon 
                                        icon="fa-solid fa-grip-vertical" 
                                        class="drag-handle me-2" 
                                        size="small"
                                        style="cursor: grab;"
                                    ></v-icon>
                                    <v-checkbox-btn
                                        :model-value="columnKey === 'name' ? true : columnVisibility[columnKey]"
                                        :disabled="columnKey === 'name'"
                                        @update:model-value="toggleColumn(columnKey)"
                                        class="me-2"
                                    ></v-checkbox-btn>
                                </template>
                                <v-list-item-title>
                                    {{ customHeaders.find(h => h.key === columnKey)?.title || columnKey }}
                                </v-list-item-title>
                            </v-list-item>
                        </div>
                    </v-list>
                </v-card-text>
                <v-card-actions class="flexrow">
                    <v-btn
                        variant="elevated"
                        @click="showColumnDialog = false"
                        :color="primaryColor"
                    >
                        Close
                    </v-btn>
                    <v-btn
                        variant="elevated"
                        @click="resetColumns"
                        prepend-icon="fa-solid fa-undo"
                        :color="secondaryColor"
                    >
                        Reset to Default
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </template>
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

    function generateSecondaryActionMenuItem(action: Action): CompositeGeneratorNode {
        const standardParams = action.params as StandardFieldParams[];
        const icon = (standardParams.find(x => isIconParam(x)) as IconParam)?.value ?? "fa-solid fa-bolt";
        const parentDocument = AstUtils.getContainerOfType(action, isDocument);

        return expandToNode`
            <v-list-item
                @click="customItemAction(item, '${action.name.toLowerCase()}')"
                :title="game.i18n.localize('${parentDocument?.name}.${action.name}')"
                min-height="32"
            >
                <template v-slot:prepend>
                    <v-icon icon="${icon}" size="15"></v-icon>
                </template>
            </v-list-item>
        `;
    }
}
