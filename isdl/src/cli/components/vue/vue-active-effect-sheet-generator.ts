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
        import { ref, inject } from 'vue';
        
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
                        <v-tab value="duration" prepend-icon="fa-solid fa-clock">Duration</v-tab>
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
                                        v-model="context.document.disabled"
                                        name="disabled"
                                        :color="primaryColor"
                                        label="Enabled">
                                    </v-switch>
                                    <i-prosemirror
                                        label="Description"
                                        icon="fa-solid fa-file-lines"
                                        :field="context.editors['description']"
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
        const fields = getAllOfType<Property>(document.body, isProperty, false);
        return expandToNode`
            <v-tabs-window-item value="${document.name}" data-tab="${document.name}">
                 <v-col cols="12">
                    ${joinToNode(fields, (property) => generateField(document, property), { appendNewLineIfNotEmpty: true })}
                </v-col>
            </v-tabs-window-item>
        `;
    }

    function generateField(document: Document, property: Property): CompositeGeneratorNode | undefined {
        if ( isInitiativeProperty(property) || isStatusProperty(property) || isHookHandler(property) || !isProperty(property) || isTableField(property) || isDocumentArrayExp(property) || isDocumentFields(property) || isHtmlExp(property)) return;
        if ( property.modifier == "locked" ) return;

        if (isNumberExp(property)) {
            return expandToNode`
                <v-card class="mb-4">
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.${property.name}"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.${property.name}.value"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                         <v-label>Resource Current</v-label>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.${property.name}.value"
                                label="Current Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                        </v-row>
                        <v-label class="">Resource Max</v-label>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.${property.name}.max"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.stringModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.${property.name}"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.booleanModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-switch
                                name="${document.name.toLowerCase()}.${property.name}"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.choiceModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-label class="">Tracker Value</v-label>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.${property.name}.value"
                                label="Current Value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                        </v-row>
                        <v-label class="">Tracker Max</v-label>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-max-mode"
                                label="Mode"
                                :items="context.numberModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.${property.name}.max"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.dateModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.${property.name}"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.timeModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.${property.name}"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.dateTimeModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.${property.name}"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.dieModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.diceModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-number-input
                                name="${document.name.toLowerCase()}.${property.name}.number"
                                label="Number of Dice"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-number-input>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}.type"
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
                    <v-card-title>${property.name}</v-card-title>
                    <v-card-text>
                        <v-row>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}-mode"
                                label="Mode"
                                :items="context.templateModes"
                                item-title="label"
                                item-value="value"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-select>
                            <v-text-field
                                name="${document.name.toLowerCase()}.${property.name}.distance"
                                label="Distance"
                                :color="primaryColor"
                                variant="outlined"
                                density="compact">
                            </v-text-field>
                            <v-select
                                name="${document.name.toLowerCase()}.${property.name}.type"
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
