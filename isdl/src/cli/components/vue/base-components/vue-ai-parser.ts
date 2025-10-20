import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateAIParserComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, "ai-text-parser.vue");

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
    import { ref, computed, inject } from "vue";

    const props = defineProps({
        label: String,
        targetType: String,
        context: Object,
        disabled: Boolean,
        editMode: Boolean,
        onItemsCreated: Function,
        primaryColor: String,
        secondaryColor: String
    });

    const document = inject("rawDocument");
    const showDialog = ref(false);
    const textInput = ref('');
    const parsedItems = ref([]);
    const selectedItems = ref(new Set());
    const isProcessing = ref(false);
    const parseMode = ref(props.targetType || 'all');

    // Available item types from schema
    const itemTypes = computed(() => {
        if (!game.system?.aiTextParser) return [];
        
        // Ensure the parser is initialized
        game.system.aiTextParser._initialize?.();
        
        if (!game.system.aiTextParser.schema) return [];
        return Object.keys(game.system.aiTextParser.schema);
    });

    // Parse text with AI
    const parseText = async () => {
        if (!textInput.value.trim()) {
            ui.notifications.warn("Please enter text to parse");
            return;
        }

        isProcessing.value = true;
        
        try {
            const targetType = parseMode.value === 'all' ? null : parseMode.value;
            const result = await game.system.aiTextParser.parseText(textInput.value.trim(), targetType);
            
            parsedItems.value = result.items || [];
            selectedItems.value = new Set();
            
            // Auto-select all items by default
            parsedItems.value.forEach((_, index) => selectedItems.value.add(index));

            // Show warnings if any
            if (result.warnings && result.warnings.length > 0) {
                ui.notifications.warn(\`Parsing completed with warnings: \${result.warnings.join(', ')}\`);
            }

            if (parsedItems.value.length === 0) {
                ui.notifications.info("No items found in the provided text");
            } else {
                ui.notifications.info(\`Found \${parsedItems.value.length} potential item(s) (confidence: \${Math.round(result.confidence * 100)}%)\`);
            }

        } catch (error) {
            console.error('Parsing error:', error);
            ui.notifications.error("Failed to parse text. Check console for details.");
        } finally {
            isProcessing.value = false;
        }
    };

    // Create selected items
    const createItems = async () => {
        const selectedItemData = parsedItems.value.filter((_, index) => 
            selectedItems.value.has(index)
        );

        if (selectedItemData.length === 0) {
            ui.notifications.warn("No items selected for creation");
            return;
        }

        try {
            const createdItems = await game.system.aiTextParser.createItemsFromParsed(selectedItemData, {
                parent: document
            });
            
            if (createdItems.length > 0) {
                // Clear the results after successful creation
                clearResults();
                ui.notifications.info(\`Successfully created \${createdItems.length} item(s)\`);
                
                // Notify parent component if callback provided
                if (props.onItemsCreated) {
                    props.onItemsCreated(createdItems);
                }
            }
        } catch (error) {
            console.error('Item creation error:', error);
            ui.notifications.error("Failed to create items. Check console for details.");
        }
    };

    // Select/deselect all items
    const selectAll = () => {
        selectedItems.value = new Set();
        parsedItems.value.forEach((_, index) => selectedItems.value.add(index));
    };

    const selectNone = () => {
        selectedItems.value = new Set();
    };

    // Toggle individual item selection
    const toggleItemSelection = (index) => {
        if (selectedItems.value.has(index)) {
            selectedItems.value.delete(index);
        } else {
            selectedItems.value.add(index);
        }
    };

    // Remove item from results
    const removeItem = (index) => {
        parsedItems.value.splice(index, 1);
        selectedItems.value.delete(index);
        
        // Reindex selected items
        const newSelected = new Set();
        selectedItems.value.forEach(i => {
            if (i < index) newSelected.add(i);
            else if (i > index) newSelected.add(i - 1);
        });
        selectedItems.value = newSelected;
    };

    // Clear all results
    const clearResults = () => {
        parsedItems.value = [];
        selectedItems.value = new Set();
        textInput.value = '';
    };

    // Format confidence as percentage
    const formatConfidence = (confidence) => {
        return Math.round(confidence * 100);
    };

    // Get confidence color
    const getConfidenceColor = (confidence) => {
        const percentage = confidence * 100;
        if (percentage >= 80) return 'success';
        if (percentage >= 60) return 'warning';
        return 'error';
    };

    // Truncate text for display
    const truncate = (text, maxLength = 100) => {
        if (!text) return '';
        if (text.length > maxLength) {
            return text.substring(0, maxLength) + '...';
        }
        return text;
    };

    // Open the AI parser dialog
    const openDialog = () => {
        showDialog.value = true;
    };

    // Expose the openDialog method for external use
    defineExpose({
        openDialog
    });
    </script>

    <template>
        <!-- AI Parser Button -->
        <v-btn
            icon="fa-solid fa-robot"
            size="small"
            variant="text"
            @click="openDialog"
            :disabled="disabled"
            style="margin-right: 8px;"
        >
            <v-icon>fa-solid fa-robot</v-icon>
            <v-tooltip activator="parent" location="top">AI Text Parser</v-tooltip>
        </v-btn>

        <!-- AI Parser Dialog -->
        <v-dialog v-model="showDialog" max-width="800px" persistent>
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="me-2">fa-solid fa-robot</v-icon>
                    AI Text Parser
                    <v-spacer></v-spacer>
                    <v-btn
                        icon="fa-solid fa-times"
                        size="small"
                        variant="text"
                        @click="showDialog = false"
                    ></v-btn>
                </v-card-title>
                
                <v-divider></v-divider>
                
                <v-card-text class="pa-4">
                    <!-- Input Section -->
                    <div class="mb-4">
                        <v-textarea
                            v-model="textInput"
                            label="Text to Parse"
                            placeholder="Paste or type the text containing item descriptions here..."
                            rows="6"
                            variant="outlined"
                            :disabled="isProcessing"
                            clearable
                        ></v-textarea>
                        
                        <div class="d-flex align-center mt-2">
                            <v-select
                                v-model="parseMode"
                                :items="[{title: 'All Types', value: 'all'}, ...itemTypes.map(t => ({title: t, value: t}))]"
                                label="Focus on Item Type"
                                variant="outlined"
                                density="compact"
                                style="max-width: 200px; margin-right: 16px;"
                                :disabled="isProcessing"
                            ></v-select>
                            
                            <v-btn
                                :color="primaryColor || 'primary'"
                                prepend-icon="fa-solid fa-magic"
                                :loading="isProcessing"
                                @click="parseText"
                            >
                                {{ isProcessing ? 'Processing...' : 'Parse Text' }}
                            </v-btn>
                        </div>
                    </div>

                    <!-- Results Section -->
                    <div v-if="parsedItems.length > 0" class="mt-4">
                        <div class="d-flex align-center mb-3">
                            <h3 class="text-h6">
                                <v-icon class="me-1">fa-solid fa-list</v-icon>
                                Parsed Items ({{ parsedItems.length }})
                            </h3>
                            <v-spacer></v-spacer>
                            <div class="d-flex ga-2">
                                <v-btn
                                    size="small"
                                    variant="outlined"
                                    prepend-icon="fa-solid fa-check-square"
                                    @click="selectAll"
                                >
                                    Select All
                                </v-btn>
                                <v-btn
                                    size="small"
                                    variant="outlined"
                                    prepend-icon="fa-regular fa-square"
                                    @click="selectNone"
                                >
                                    Select None
                                </v-btn>
                                <v-btn
                                    size="small"
                                    variant="outlined"
                                    prepend-icon="fa-solid fa-trash"
                                    color="error"
                                    @click="clearResults"
                                >
                                    Clear
                                </v-btn>
                            </div>
                        </div>

                        <!-- Items List -->
                        <div class="items-container" style="max-height: 300px; overflow-y: auto;">
                            <v-card
                                v-for="(item, index) in parsedItems"
                                :key="index"
                                :variant="selectedItems.has(index) ? 'elevated' : 'outlined'"
                                :color="selectedItems.has(index) ? (primaryColor || 'primary') : undefined"
                                class="mb-2"
                            >
                                <v-card-text class="pa-3">
                                    <div class="d-flex align-center">
                                        <v-checkbox-btn
                                            :model-value="selectedItems.has(index)"
                                            @update:model-value="toggleItemSelection(index)"
                                            class="me-3"
                                        ></v-checkbox-btn>
                                        
                                        <div class="flex-grow-1">
                                            <div class="d-flex align-center mb-1">
                                                <span class="font-weight-bold text-body-1">{{ item.name }}</span>
                                                <v-chip
                                                    :color="primaryColor || 'primary'"
                                                    size="x-small"
                                                    class="ml-2"
                                                >
                                                    {{ item.type }}
                                                </v-chip>
                                                <v-spacer></v-spacer>
                                                <v-chip
                                                    :color="getConfidenceColor(item.confidence)"
                                                    size="x-small"
                                                    variant="elevated"
                                                >
                                                    {{ formatConfidence(item.confidence) }}%
                                                </v-chip>
                                            </div>
                                            
                                            <!-- Field Preview -->
                                            <div v-if="Object.keys(item.fields).length > 0" class="mt-2">
                                                <div class="text-caption text-medium-emphasis mb-1">Fields:</div>
                                                <div class="d-flex flex-wrap ga-1">
                                                    <v-chip
                                                        v-for="(value, fieldName) in item.fields"
                                                        :key="fieldName"
                                                        size="x-small"
                                                        variant="tonal"
                                                        :title="\`\${fieldName}: \${value}\`"
                                                    >
                                                        <strong>{{ fieldName }}:</strong> {{ truncate(String(value), 30) }}
                                                    </v-chip>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <v-btn
                                            icon="fa-solid fa-times"
                                            size="x-small"
                                            variant="text"
                                            color="error"
                                            @click="removeItem(index)"
                                        ></v-btn>
                                    </div>
                                </v-card-text>
                            </v-card>
                        </div>

                        <!-- Create Items Section -->
                        <div class="text-center mt-4">
                            <v-btn
                                :color="secondaryColor || 'success'"
                                prepend-icon="fa-solid fa-plus-circle"
                                size="large"
                                @click="createItems"
                                :disabled="selectedItems.size === 0"
                            >
                                Create Selected Items ({{ selectedItems.size }})
                            </v-btn>
                        </div>
                    </div>
                </v-card-text>
            </v-card>
        </v-dialog>
    </template>

    <style scoped>
    .items-container {
        border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
        border-radius: 4px;
        padding: 8px;
    }

    .items-container::-webkit-scrollbar {
        width: 8px;
    }

    .items-container::-webkit-scrollbar-track {
        background: rgba(var(--v-theme-surface-variant), 0.1);
        border-radius: 4px;
    }

    .items-container::-webkit-scrollbar-thumb {
        background: rgba(var(--v-theme-on-surface), 0.3);
        border-radius: 4px;
    }

    .items-container::-webkit-scrollbar-thumb:hover {
        background: rgba(var(--v-theme-on-surface), 0.5);
    }
    </style>
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}