import {
    Document,
    Entry, isActor,
    isAttributeExp,
    isBooleanExp,
    isDateExp,
    isDateTimeExp,
    isDiceField,
    isDieField, isDocumentArrayExp, isDocumentFields,
    isHookHandler,
    isHtmlExp,
    isInitiativeProperty,
    isMeasuredTemplateField,
    isNumberExp,
    isProperty,
    isResourceExp,
    isStatusProperty,
    isStringChoiceField,
    isStringExp, isTableField,
    isTimeExp,
    isTrackerExp,
    Property
} from "../../../language/generated/ast.js";
import path from "node:path";
import fs from "node:fs";
import {CompositeGeneratorNode, expandToNode, joinToNode, toString} from "langium/generate";
import {getAllOfType} from "../utils.js";

export function generateActiveEffectVueSheet(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue");
    const generatedFilePath = path.join(generatedFileDir, `active-effect-app.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const documents = entry.documents.filter(isActor);

    const fileNode = expandToNode`
    ${generateVueComponentScript(entry, id, destination)}
    ${generateVueComponentTemplate(id)}
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));

    function generateVueComponentScript(entry: Entry, id: string, destination: string) {
        return expandToNode`
        <script setup>
        import { ref, inject, onMounted, computed } from 'vue';
        
        const document = inject('rawDocument');
        const props = defineProps(['context']);
        console.log("Vue AE context", props.context);
        
        // Colors
        const primaryColor = ref('#1565c0');
        const secondaryColor = ref('#4db6ac');
        const tertiaryColor = ref('#ffb74d');

        const drawer = ref(false);
        const page = ref('details');
        const tab = ref('description');
        
        // Available fields for each document type
        const availableFields = ref({});
        const selectedFields = ref({});
        
        // Create field name mapping for each document
        const createFieldMapping = () => {
            const mapping = {};
            ${joinToNode(documents, document => {
                const fields = getAllOfType<Property>(document.body, isProperty, false).filter(property =>
                    !isInitiativeProperty(property) &&
                    !isStatusProperty(property) &&
                    !isHookHandler(property) &&
                    !isTableField(property) &&
                    !isDocumentArrayExp(property) &&
                    !isDocumentFields(property) &&
                    !isHtmlExp(property) &&
                    property.modifier !== "locked"
                );
                
                return expandToNode`
                    mapping['${document.name}'] = {
                        ${joinToNode(fields, field => `'${field.name.toLowerCase()}': '${field.name}'`, { separator: ',\n                        ' })}
                    };
                `;
            }, { appendNewLineIfNotEmpty: true })}
            return mapping;
        };
        
        // Helper method to get change value from the changes array
        const getChangeValue = (key) => {
            const change = props.context?.document?.changes?.find(x => x.key === key);
            return change?.value || '';
        };
        
        // Helper method to get numeric change value from the changes array
        const getChangeNumberValue = (key) => {
            const change = props.context?.document?.changes?.find(x => x.key === key);
            if (!change?.value) return 0;
            const num = Number(change.value);
            return isNaN(num) ? 0 : num;
        };
        
        // Helper method to get change mode from the changes array
        const getChangeMode = (key) => {
            const change = props.context?.document?.changes?.find(x => x.key === key);
            return change?.mode || 0;
        };
        
        // Initialize selectedFields from existing changes
        const initializeSelectedFields = () => {
            if (!props.context?.document?.changes) return;
            
            const fieldMapping = createFieldMapping();
            
            for (const change of props.context.document.changes) {
                // Parse the key to extract document name and field name
                // Format: "hero.system.availableskilllevels" or "hero.system.resourcefield.value"
                const parts = change.key.split('.');
                if (parts.length >= 3) {
                    const documentName = parts[0];
                    const fieldNameLower = parts[2];
                    
                    // Convert document name to proper case (e.g., "hero" -> "Hero")
                    const docName = documentName.charAt(0).toUpperCase() + documentName.slice(1);
                    
                    // Look up the proper field name from our mapping
                    const properFieldName = fieldMapping[docName]?.[fieldNameLower];
                    
                    if (properFieldName) {
                        if (!selectedFields.value[docName]) {
                            selectedFields.value[docName] = [];
                        }
                        
                        if (!selectedFields.value[docName].includes(properFieldName)) {
                            selectedFields.value[docName].push(properFieldName);
                        }
                    }
                }
            }
        };
        
        // Generate a summary of current changes
        const changesSummary = computed(() => {
            if (!props.context?.document?.changes || props.context.document.changes.length === 0) {
                return 'No changes configured';
            }
            
            const changes = props.context.document.changes.filter(change => {
                // Skip zero values for numbers
                const numValue = Number(change.value);
                return !((!isNaN(numValue) && numValue === 0) || change.value === '' || change.value === null);
            });
            
            if (changes.length === 0) {
                return 'No changes configured';
            }
            
            // Group changes by document type
            const groupedChanges = {};
            changes.forEach(change => {
                const parts = change.key.split('.');
                if (parts.length >= 3) {
                    const documentName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1); // Capitalize
                    const fieldPath = parts.slice(2).join('.');
                    
                    if (!groupedChanges[documentName]) {
                        groupedChanges[documentName] = [];
                    }
                    
                    console.log(change.key, fieldPath, parts);
                    
                    // Convert field names to human readable
                    let step1 = fieldPath.replaceAll('.', ' ');
                    let step2 = step1.replace(/([a-z])([A-Z])/g, '$1 $2');
                    let step3 = step2.replace(/\b\w/g, l => l.toUpperCase());
                    console.log("Debug steps:", fieldPath, "->", step1, "->", step2, "->", step3);
                    
                    const humanFieldName = step3;
                    
                    // Format the mode symbol
                    const modeSymbol = change.mode === 1 ? ' × ' : 
                                     change.mode === 2 ? ' + ' :
                                     change.mode === 3 ? ' ↓ ' :
                                     change.mode === 4 ? ' ↑ ' :
                                     change.mode === 5 ? ' (Once) + ' : ' ';
                    
                    console.log("Human Field Name:", humanFieldName, "Mode Symbol:", modeSymbol);
                    groupedChanges[documentName].push(humanFieldName + modeSymbol + change.value);
                }
            });
            
            // Format as "Document: change1, change2"
            const documentSummaries = Object.entries(groupedChanges).map(([docName, changes]) => {
                return docName + ': ' + changes.join(', ');
            });
            
            return documentSummaries.join(' | ');
        });
        
        // Initialize on component mount
        onMounted(() => {
            initializeSelectedFields();
        });
        </script>
    `;
    }

    function generateVueComponentTemplate(id: string) {
        return expandToNode`
        <template>
            <v-app>
                <!-- App Bar -->
                <v-app-bar :color="primaryColor" density="comfortable">
                    <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
                    <v-text-field name="name" v-model="context.document.name" variant="outlined" class="document-name" density="compact"></v-text-field>
                </v-app-bar>
                
                <!-- Navigation Drawer -->
                <v-navigation-drawer v-model="drawer" temporary style="background-color: #dddddd">
                    <v-img :src="context.document.img" style="background-color: lightgray" data-edit='img' data-action='onEditImage'>
                        <template #error>
                            <v-img src="/systems/${id}/img/missing-character.png" data-edit='img' data-action='onEditImage'></v-img>
                        </template>
                    </v-img>
                    <v-tabs v-model="page" direction="vertical">
                        <v-tab value="details" prepend-icon="fa-solid fa-book">Details</v-tab>
<!--                        <v-tab value="duration" prepend-icon="fa-solid fa-clock">Duration</v-tab>-->
                        ${joinToNode(documents, generateNavListItem, { appendNewLineIfNotEmpty: true })}
                    </v-tabs>
                </v-navigation-drawer>
                
                <!-- Main Content -->
                <v-main class="d-flex">
                    <v-container class="topography" fluid>
                        <v-tabs-window v-model="page">
                            <v-tabs-window-item value="details" data-tab="details">
                                <v-col cols="12" style="padding: 0">
                                    <v-switch
                                        :model-value="!context.document.disabled"
                                        @update:model-value="context.document.disabled = !$event"
                                        name="enabled"
                                        :color="primaryColor"
                                        label="Enabled">
                                    </v-switch>
                                    <v-card class="mt-3 mb-3" variant="outlined">
                                        <v-card-title class="text-body-2">
                                            <v-icon icon="fa-solid fa-magic" class="mr-2"></v-icon>
                                            Current Changes
                                        </v-card-title>
                                        <v-card-text class="pt-2">
                                            <div class="text-body-2 text-medium-emphasis">
                                                {{ changesSummary }}
                                            </div>
                                        </v-card-text>
                                    </v-card>
                                    <i-prosemirror
                                        label="Description"
                                        icon="fa-solid fa-file-lines"
                                        :field="context.editors['description']"
                                        class="mt-2"
                                        >
                                    </i-prosemirror>
                                </v-col>
                            </v-tabs-window-item>
                            <v-tabs-window-item value="duration" data-tab="duration">
                                <v-col cols="12" style="padding: 0">
                                    <v-label>Duration Settings</v-label>
                                    <!-- Add duration content here -->
                                </v-col>
                            </v-tabs-window-item>
                            ${joinToNode(documents, generateDocumentPage, { appendNewLineIfNotEmpty: true })}
                        </v-tabs-window>
                    </v-container>
                </v-main>
            </v-app>
        </template>
        `;
    }

    function generateNavListItem(document: Document) {
        return expandToNode`
            <v-tab value="${document.name}" prepend-icon="fa-solid fa-pen-to-square">${document.name} Changes</v-tab>
        `;
    }

    function generateDocumentPage(document: Document) {
        const fields = getAllOfType<Property>(document.body, isProperty, false).filter(property =>
            !isInitiativeProperty(property) &&
            !isStatusProperty(property) &&
            !isHookHandler(property) &&
            !isTableField(property) &&
            !isDocumentArrayExp(property) &&
            !isDocumentFields(property) &&
            !isHtmlExp(property) &&
            property.modifier !== "locked"
        );

        return expandToNode`
            <v-tabs-window-item value="${document.name}" data-tab="${document.name}">
                 <v-col cols="12" style="padding: 0">
                    <v-card class="mb-4">
                        <v-card-title>Available Fields</v-card-title>
                        <v-card-text>
                            <v-autocomplete
                                label="Add Field to Change"
                                :items="[${joinToNode(fields, (property) => `{title: '${property.name}', value: '${property.name}'}`, { separator: ', ' })}]"
                                item-title="title"
                                item-value="value"
                                v-model="selectedFields['${document.name}']"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact"
                                multiple
                                chips
                                closable-chips>
                                <template #chip="{ props, item }">
                                    <v-chip v-bind="props" :text="item.title" closable></v-chip>
                                </template>
                            </v-autocomplete>
                        </v-card-text>
                    </v-card>
                    
                    <div v-for="fieldName in selectedFields['${document.name}'] || []" :key="fieldName">
                        ${joinToNode(fields, (property) => generateConditionalField(document, property), { appendNewLineIfNotEmpty: true })}
                    </div>
                </v-col>
            </v-tabs-window-item>
        `;
    }

    function generateConditionalField(document: Document, property: Property): CompositeGeneratorNode | undefined {
        return expandToNode`
            <div v-if="fieldName === '${property.name}'">
                ${generateField(document, property)}
            </div>
        `;
    }

    function generateRemoveButton(document: Document, property: Property) {
        return expandToNode`
            <v-btn 
                icon="fa-solid fa-xmark" 
                size="small" 
                variant="text" 
                @click="selectedFields['${document.name}'] = selectedFields['${document.name}'].filter(f => f !== '${property.name}')"
                style="float: right;">
            </v-btn>
        `;
    }

    function generateField(document: Document, property: Property): CompositeGeneratorNode | undefined {
        if ( isInitiativeProperty(property) || isStatusProperty(property) || isHookHandler(property) || !isProperty(property) || isTableField(property) || isDocumentArrayExp(property) || isDocumentFields(property) || isHtmlExp(property)) return;
        if ( property.modifier == "locked" ) return;

        if (isNumberExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                :model-value="getChangeMode('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}')"
                                label="Mode"
                                :color="primaryColor"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}"
                                :model-value="getChangeNumberValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}')"
                                label="Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isAttributeExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value-mode"
                                :model-value="getChangeMode('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value')"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value"
                                :model-value="getChangeNumberValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value')"
                                label="Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if(isResourceExp(property)) {
            // Resource has both a current and max that can be changed
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                         <v-label>Resource Current</v-label>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value-mode"
                                :model-value="getChangeMode('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value')"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value"
                                :model-value="getChangeNumberValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value')"
                                label="Current Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                        </v-row>
                        <v-label class="mt-2">Resource Max</v-label>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max-mode"
                                :model-value="getChangeMode('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max')"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max"
                                :model-value="getChangeNumberValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max')"
                                label="Max Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isStringExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                :model-value="getChangeMode('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}')"
                                label="Mode"
                                :items="context.stringModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}"
                                :model-value="getChangeValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}')"
                                label="Text Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-text-field>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isBooleanExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                :model-value="getChangeMode('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}')"
                                label="Mode"
                                :items="context.booleanModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-switch
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}"
                                :model-value="getChangeValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}')"
                                label="Boolean Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-switch>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isStringChoiceField(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                label="Mode"
                                :items="context.choiceModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}"
                                label="Choice Value"
                                :items="[]"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isTrackerExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-label class="">Tracker Value</v-label>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value"
                                :model-value="getChangeNumberValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.value')"
                                label="Current Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                        </v-row>
                        <v-label class="mt-2">Tracker Max</v-label>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max-mode"
                                :model-value="getChangeMode('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max')"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max"
                                :model-value="getChangeNumberValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.max')"
                                label="Max Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isDateExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                label="Mode"
                                :items="context.dateModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}"
                                label="Date Value"
                                type="date"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-text-field>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isTimeExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                label="Mode"
                                :items="context.timeModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}"
                                label="Time Value"
                                type="time"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-text-field>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isDateTimeExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                label="Mode"
                                :items="context.dateTimeModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}"
                                label="DateTime Value"
                                type="datetime-local"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-text-field>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isDieField(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                label="Mode"
                                :items="context.dieModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}"
                                label="Die Type"
                                :items="context.dieTypes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isDiceField(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                :model-value="getChangeMode('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}')"
                                label="Mode"
                                :items="context.diceModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.number"
                                :model-value="getChangeNumberValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.number')"
                                label="Number of Dice"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.die"
                                :model-value="getChangeValue('${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.die')"
                                label="Die Type"
                                :items="context.dieTypes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        if (isMeasuredTemplateField(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>
                        ${property.name}
                        ${generateRemoveButton(document, property)}
                    </v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}-mode"
                                label="Mode"
                                :items="context.templateModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.distance"
                                label="Distance"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-text-field>
                            <v-select
                                name="${document.name.toLowerCase()}.system.${property.name.toLowerCase()}.type"
                                label="Template Type"
                                :items="context.templateTypes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                        </v-row>
                    </v-card-text>
                </v-card>
            `;
        }

        return expandToNode`
            <v-alert text="Unknown Property ${property.name} (${property.$type})" type="warning" density="compact" class="ga-2 ma-1" variant="outlined"></v-alert>
        `;
    }
}
