import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Entry } from "../../../../language/generated/ast.js";

export default function generateInventoryComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `inventory.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject, onMounted, onUnmounted } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            editMode: Boolean,
            icon: String,
            color: String,
            disabled: Boolean,
            maxSlots: {
                type: Number,
                default: 20
            },
            columns: {
                type: Number,
                default: 5
            },
            rows: {
                type: Number,
                default: 3
            },
            slotSize: {
                type: Number,
                default: 60
            },
            documentType: String,
            whereExpression: String,
            globalAllowed: Boolean,
            quantityField: String,
            moneyField: String,
            moneyFieldLabel: String,
            moneyFieldIcon: String,
            sumProperties: Array,
            sumMax: Array,
            sortProperty: String,
            sortOrder: {
                type: String,
                default: 'asc'
            },
            emptySlots: {
                type: String,
                default: 'show'
            },
            summary: {
                type: String,
                default: 'full'
            },
            primaryColor: String,
            secondaryColor: String,
            teritaryColor: String
        });

        const document = inject('rawDocument');

        // Calculate grid configuration
        const gridConfig = computed(() => {
            const columns = props.columns || 5;
            const rows = props.rows || 3;

            // Calculate total slots from columns × rows
            let totalSlots = columns * rows;

            // Cap at maxSlots if specified
            if (props.maxSlots) {
                totalSlots = Math.min(totalSlots, props.maxSlots);
            }

            return { totalSlots, columns };
        });

        // Force update trigger for reactive updates
        const updateKey = ref(0);
        const forceUpdate = () => {
            updateKey.value++;
        };

        // Get filtered items
        const filteredItems = computed(() => {
            // Depend on updateKey to trigger re-evaluation
            const _ = updateKey.value;
            let items = Array.from(document.items || []);

            // Filter by document type
            items = items.filter(item => item.type === props.documentType);

            // Apply where expression if provided
            if (props.whereExpression) {
                try {
                    const filterFunc = new Function('item', 'system', \`return \${props.whereExpression}\`);
                    items = items.filter(item => filterFunc(item, props.context.system));
                } catch (e) {
                    console.error('Error filtering inventory items:', e);
                }
            }

            // Add global items if allowed
            if (props.globalAllowed) {
                const gameItems = game.items.filter(item => item.type === props.documentType);
                items = items.concat(gameItems);

                const itemPacks = game.packs.filter(pack => pack.documentName === 'Item');
                for (let pack of itemPacks) {
                    const packItems = pack.index.contents.filter(item => item.type === props.documentType);
                    packItems.forEach(item => {
                        item.compendium = pack;
                    });
                    items = items.concat(packItems);
                }
            }

            // Apply sorting if specified
            if (props.sortProperty) {
                items.sort((a, b) => {
                    const aProp = foundry.utils.getProperty(a, \`system.\${props.sortProperty.toLowerCase()}\`);
                    const bProp = foundry.utils.getProperty(b, \`system.\${props.sortProperty.toLowerCase()}\`);

                    let aVal = aProp;
                    let bVal = bProp;

                    // Handle nested values (like resource.value)
                    if (typeof aProp === 'object' && aProp?.value !== undefined) aVal = aProp.value;
                    if (typeof bProp === 'object' && bProp?.value !== undefined) bVal = bProp.value;

                    if (aVal < bVal) return props.sortOrder === 'asc' ? -1 : 1;
                    if (aVal > bVal) return props.sortOrder === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            return items;
        });

        // Generate slots for display
        const inventorySlots = computed(() => {
            const slots = [];
            const config = gridConfig.value;
            let firstEmptyFound = false;

            for (let i = 0; i < config.totalSlots; i++) {
                if (i < filteredItems.value.length) {
                    const item = filteredItems.value[i];
                    let quantity = null;

                    if (props.quantityField) {
                        const quantityValue = foundry.utils.getProperty(item, \`system.\${props.quantityField.toLowerCase()}\`);
                        quantity = typeof quantityValue === 'object' ? quantityValue.value : quantityValue;
                    }

                    slots.push({
                        item: item,
                        quantity: quantity,
                        empty: false,
                        isCreateSlot: false
                    });
                } else if (props.emptySlots === 'show') {
                    const isCreateSlot = !firstEmptyFound;
                    if (isCreateSlot) firstEmptyFound = true;

                    slots.push({
                        item: null,
                        quantity: null,
                        empty: true,
                        isCreateSlot: isCreateSlot
                    });
                }
            }

            return slots;
        });

        // Calculate aggregations
        const aggregations = computed(() => {
            if (!props.sumProperties || props.sumProperties.length === 0) {
                return [];
            }

            return props.sumProperties.map((propName, index) => {
                let total = 0;

                filteredItems.value.forEach(item => {
                    const propValue = foundry.utils.getProperty(item, \`system.\${propName.toLowerCase()}\`);

                    if (typeof propValue === 'number') {
                        total += propValue;
                    } else if (propValue?.value !== undefined) {
                        total += propValue.value;
                    }
                });

                const max = props.sumMax && props.sumMax[index] ? props.sumMax[index] : null;

                return {
                    name: propName,
                    label: game.i18n.localize(propName),
                    value: total,
                    formatted: total.toLocaleString(),
                    max: max,
                    percentage: max ? Math.min(100, (total / max) * 100) : null
                };
            });
        });

        // Get money value
        const moneyValue = computed(() => {
            // Depend on updateKey to trigger re-evaluation
            const _ = updateKey.value;
            if (!props.moneyField) return null;
            return foundry.utils.getProperty(document, \`system.\${props.moneyField.toLowerCase()}\`);
        });

        // Format money display
        const formattedMoney = computed(() => {
            if (!moneyValue.value) return '0';

            if (typeof moneyValue.value === 'number') {
                return moneyValue.value.toLocaleString();
            }

            // Multi-denomination money
            if (typeof moneyValue.value === 'object') {
                const parts = [];
                for (const [denom, amount] of Object.entries(moneyValue.value)) {
                    if (amount > 0) {
                        parts.push(\`\${amount}\${denom.charAt(0)}\`);
                    }
                }
                return parts.length > 0 ? parts.join(' ') : '0';
            }

            return '0';
        });

        // Get capacity color for a percentage
        const getCapacityColor = (percentage) => {
            if (!percentage) return 'success';
            if (percentage > 100) return 'error';
            if (percentage >= 90) return 'error';
            if (percentage >= 70) return 'warning';
            return 'success';
        };

        // Handle item click
        const onItemClick = (slot) => {
            if (slot.empty) {
                if (slot.isCreateSlot) {
                    onCreateItem();
                }
                return;
            }
            if (slot.item) {
                slot.item.sheet.render(true);
            }
        };

        // Handle create new item
        const onCreateItem = async () => {
            if (!props.documentType) return;

            const itemData = {
                name: game.i18n.localize(\`New \${props.documentType}\`),
                type: props.documentType
            };

            const created = await document.createEmbeddedDocuments('Item', [itemData]);
            if (created && created[0]) {
                created[0].sheet.render(true);
            }
        };

        // Handle delete item
        const onDeleteItem = async (event, slot) => {
            // Prevent the click from opening the item sheet
            event.stopPropagation();

            if (!slot.item) return;

            const confirmed = await Dialog.confirm({
                title: game.i18n.localize('Delete Item'),
                content: \`<p>\${game.i18n.format('Are you sure you want to delete {name}?', { name: slot.item.name })}</p>\`,
            });

            if (confirmed) {
                await slot.item.delete();
            }
        };

        // Handle drag start
        const onDragStart = (event, slot) => {
            if (!slot.item) return;

            const dragData = {
                type: 'Item',
                uuid: slot.item.uuid
            };

            event.dataTransfer.setData('text/plain', JSON.stringify(dragData));

            // Add dragging class for visual feedback
            event.target.classList.add('dragging');
        };

        // Handle drag end
        const onDragEnd = (event) => {
            // Remove dragging class
            event.target.classList.remove('dragging');
        };

        // Get item name for tooltip
        const getItemName = (slot) => {
            if (slot.empty || !slot.item) return '';
            return slot.item.name;
        };

        // Get item description for tooltip
        const getItemDescription = (slot) => {
            if (slot.empty || !slot.item) return '';

            // Get description - handle both value and direct description
            const description = slot.item.system?.description?.value || slot.item.system?.description;
            if (!description) return '';

            // Truncate if too long
            if (description.length > 200) {
                return description.substring(0, 200) + '...';
            }

            return description;
        };

        // Get summed property values for tooltip
        const getItemSumProperties = (slot) => {
            if (slot.empty || !slot.item || !props.sumProperties || props.sumProperties.length === 0) {
                return [];
            }

            return props.sumProperties.map(propName => {
                const propValue = foundry.utils.getProperty(slot.item, \`system.\${propName.toLowerCase()}\`);

                let value = 0;
                if (typeof propValue === 'number') {
                    value = propValue;
                } else if (propValue?.value !== undefined) {
                    value = propValue.value;
                }

                return {
                    name: propName,
                    label: game.i18n.localize(propName),
                    value: value,
                    formatted: value.toLocaleString()
                };
            }).filter(prop => prop.value > 0); // Only show properties with values
        };

        // Count items
        const itemCount = computed(() => {
            return filteredItems.value.length;
        });

        // Show summary based on mode
        const showCount = computed(() => props.summary !== 'minimal');
        const showAggregations = computed(() => props.summary === 'full');
        const showMoney = computed(() => props.summary === 'full' && props.moneyField);

        // Subscribe to item changes
        const onItemChange = (item, options, userId) => {
            // Check if this item belongs to our document
            if (item.parent?.uuid === document.uuid) {
                forceUpdate();
            }
        };

        onMounted(() => {
            Hooks.on('createItem', onItemChange);
            Hooks.on('updateItem', onItemChange);
            Hooks.on('deleteItem', onItemChange);
        });

        onUnmounted(() => {
            Hooks.off('createItem', onItemChange);
            Hooks.off('updateItem', onItemChange);
            Hooks.off('deleteItem', onItemChange);
        });
    </script>

    <template>
        <div class="isdl-inventory" :key="updateKey">
            <!-- Header -->
            <div class="inventory-header" v-if="showCount">
                <div class="header-content">
                    <v-icon v-if="icon" :icon="icon" size="small"></v-icon>
                    <span class="inventory-label">{{ game.i18n.localize(label) }}</span>
                </div>
                <span class="inventory-count">
                    {{ itemCount }}/{{ gridConfig.totalSlots }}
                </span>
            </div>

            <!-- Grid Container -->
            <div class="inventory-grid-container">
                <div
                    class="inventory-grid"
                    :style="{
                        gridTemplateColumns: \`repeat(\${gridConfig.columns}, \${slotSize}px)\`,
                    }"
                >
                    <v-tooltip
                        v-for="(slot, index) in inventorySlots"
                        :key="index"
                        :disabled="slot.empty && !slot.isCreateSlot"
                        location="top"
                        max-width="400"
                    >
                        <template v-slot:activator="{ props: tooltipProps }">
                            <div
                                v-bind="tooltipProps"
                                class="inventory-slot"
                                :class="{
                                    'empty': slot.empty,
                                    'filled': !slot.empty,
                                    'create-slot': slot.isCreateSlot
                                }"
                                :style="{
                                    width: \`\${slotSize}px\`,
                                    height: \`\${slotSize}px\`
                                }"
                                :draggable="!slot.empty && !!slot.item"
                                @click="onItemClick(slot)"
                                @dragstart="onDragStart($event, slot)"
                                @dragend="onDragEnd($event)"
                            >
                                <img
                                    v-if="!slot.empty && slot.item"
                                    :src="slot.item.img"
                                    :alt="slot.item.name"
                                    class="slot-image"
                                />
                                <v-icon
                                    v-if="slot.isCreateSlot"
                                    icon="fa-solid fa-plus"
                                    size="large"
                                    class="create-icon"
                                ></v-icon>
                                <div
                                    v-if="!slot.empty && slot.item"
                                    class="delete-button"
                                    @click="onDeleteItem($event, slot)"
                                    :data-tooltip="game.i18n.localize('Delete')"
                                >
                                    <v-icon icon="fa-solid fa-times" size="x-small"></v-icon>
                                </div>
                                <div
                                    v-if="!slot.empty && slot.quantity && slot.quantity > 1"
                                    class="quantity-badge"
                                >
                                    {{ slot.quantity }}
                                </div>
                            </div>
                        </template>
                        <template v-slot:default>
                            <div v-if="slot.isCreateSlot" class="inventory-tooltip">
                                <div class="tooltip-title">{{ game.i18n.localize('Create New Item') }}</div>
                            </div>
                            <div v-else class="inventory-tooltip">
                                <div class="tooltip-title">{{ getItemName(slot) }}</div>
                                <div v-if="getItemDescription(slot)" class="tooltip-description" v-html="getItemDescription(slot)"></div>
                                <div v-if="getItemSumProperties(slot).length > 0" class="tooltip-properties">
                                    <div v-for="prop in getItemSumProperties(slot)" :key="prop.name" class="tooltip-property">
                                        <span class="property-label">{{ prop.label }}:</span>
                                        <span class="property-value">{{ prop.formatted }}</span>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </v-tooltip>
                </div>
            </div>

            <!-- Footer -->
            <div class="inventory-footer" v-if="showAggregations || showMoney">
                <v-divider class="footer-divider"></v-divider>

                <!-- Money Display -->
                <div v-if="showMoney" class="inventory-stat money-display">
                    <div class="stat-header">
                        <v-icon v-if="moneyFieldIcon" :icon="moneyFieldIcon" size="small"></v-icon>
                        <span class="stat-label">{{ game.i18n.localize(moneyFieldLabel || 'Currency') }}</span>
                    </div>
                    <span class="stat-value">{{ formattedMoney }}</span>
                </div>

                <!-- Aggregations -->
                <div v-if="showAggregations" v-for="agg in aggregations" :key="agg.name" class="inventory-stat aggregation-display">
                    <div class="stat-header">
                        <v-icon icon="fa-solid fa-calculator" size="small"></v-icon>
                        <span class="stat-label">{{ agg.label }}</span>
                    </div>
                    <div class="stat-value-container">
                        <span class="stat-value">
                            {{ agg.formatted }}
                            <span v-if="agg.max" class="stat-max"> / {{ agg.max }}</span>
                        </span>
                        <!-- Progress bar for aggregations with max -->
                        <v-progress-linear
                            v-if="agg.max"
                            :model-value="agg.percentage"
                            :color="getCapacityColor(agg.percentage)"
                            height="6"
                            rounded
                            class="capacity-progress"
                        ></v-progress-linear>
                    </div>
                </div>
            </div>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
