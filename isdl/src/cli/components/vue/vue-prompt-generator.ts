import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import {
    AttributeExp,
    ClassExpression,
    Document,
    Entry,
    isAction,
    isActor,
    isAttributeExp,
    isBooleanExp,
    isDateExp,
    isDateTimeExp,
    isDocumentChoiceExp,
    isDocumentChoicesExp,
    isHookHandler,
    isNumberExp,
    isNumberParamValue,
    isParentPropertyRefChoiceParam,
    isParentPropertyRefExp,
    isProperty,
    isResourceExp,
    isSingleDocumentExp,
    isStringChoiceField,
    isStringExp,
    isStringExtendedChoice,
    isStringParamChoices,
    isStringParamValue,
    isChoiceStringValue,
    isLabelParam,
    isTimeExp,
    isVariableExpression,
    ChoiceStringValue,
    LabelParam,
    NumberExp,
    NumberParamValue,
    ParentPropertyRefChoiceParam,
    Prompt,
    Property,
    ResourceExp,
    StringChoice,
    StringParamChoices,
    StringParamValue,
    isStringChoicesField,
    isDamageTypeChoiceField,
    isDieField,
    isDiceField,
    isDieChoicesParam,
    isDieNoneParam,
    isSelfPropertyRefExp,
    DieChoicesParam,
    DieNoneParam
} from "../../../language/generated/ast.js";
import { getDocument, globalGetAllOfType, toMachineIdentifier } from '../utils.js';
import { AstUtils } from 'langium';


export function generatePromptApp(name: string, entry: Entry, id: string, document: Document, prompt: Prompt, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "prompts");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${name}Prompt.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, inject, computed } from "vue";

        const props = defineProps({
            context: Object,
            primaryColor: String,
            secondaryColor: String,
        });

        const editMode = true;
    </script>
    <template>
        <v-app>
            <v-main class="d-flex">
                <v-container class="topography" fluid style="padding: 1rem; height: 100%;">
                    ${joinToNode(prompt.body, element => generateElement(element), { appendNewLineIfNotEmpty: true })}
                    <v-row class="flexrow">
                        <v-btn @click="context.promptSubmit && context.promptSubmit()" color="primary" class="ma-1 action-btn">Submit</v-btn>
                        <v-btn @click="context.promptCancel && context.promptCancel()" color="error" class="ma-1 action-btn">Cancel</v-btn>
                    </v-row>
                </v-container>                
            </v-main>
        </v-app>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));


function generateElement(element: ClassExpression): CompositeGeneratorNode {
    if (isProperty(element)) {
        if (isHookHandler(element)) return expandToNode``;
        if (element.modifier == "hidden") return expandToNode``;

        if (element.name == "RollVisualizer") {
            return expandToNode`
            <i-roll-visualizer :context="context"></i-roll-visualizer>
            `;
        }
        let disabled = element.modifier == "readonly" || element.modifier == "locked"; // TODO: Edit mode
        if (element.modifier == "unlocked") disabled = false;

        const variable = AstUtils.getContainerOfType(prompt.$container, isVariableExpression);
        const action = AstUtils.getContainerOfType(prompt.$container, isAction);

        const label = `${document.name}.${element.name}`;
        const labelFragment = `:label="game.i18n.localize('${label}')"`;
        const systemPath = `system.${action?.name.toLowerCase()}${variable?.name.toLowerCase()}.${element.name.toLowerCase()}`;

        if (isParentPropertyRefExp(element)) {
            let allChoices: Property[] = [];
            const choicesParam = element.params.find(p => isParentPropertyRefChoiceParam(p)) as ParentPropertyRefChoiceParam | undefined;
            switch (element.propertyType) {
                case "attribute": allChoices = globalGetAllOfType<AttributeExp>(entry, isAttributeExp); break;
                case "resource": allChoices = globalGetAllOfType<ResourceExp>(entry, isResourceExp); break;
                case "number": allChoices = globalGetAllOfType<NumberExp>(entry, isNumberExp); break;
                default: console.error("Unsupported parent property type: " + element.propertyType); break;
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
            <v-select name="${systemPath}" v-model="context.${systemPath}" :items="[${choices}]" item-title="label" item-value="value" ${labelFragment} :disabled="!editMode || ${disabled}" variant="outlined" density="compact"></v-select>
            `;
        }

        if (isStringExp(element)) {
            const valueParam = element.params.find(p => isStringParamValue(p)) as StringParamValue | undefined;

            if (valueParam !== undefined) {
                return expandToNode`
                <v-text-field name="${systemPath}" v-model="context.${systemPath}" ${labelFragment} :disabled="true" variant="outlined" density="compact" append-inner-icon="fa-solid fa-function" :data-tooltip="context.${systemPath}"></v-text-field>
                `;
            }
            return expandToNode`
                <i-text-field label="${label}" systemPath="${systemPath}" :context="context" :editMode="editMode" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-text-field>
            `;
        }

        if (isStringChoiceField(element) || isStringChoicesField(element) || isDamageTypeChoiceField(element)) {
            const isMulti = isStringChoicesField(element);
            const fieldParams = (element as any).params as any[];
            // choice<string>/choice<damageType> use StringParamChoices; choices<string> uses StringChoicesParamChoices.
            const singleChoices = (fieldParams.find(p => isStringParamChoices(p)) as StringParamChoices | undefined)?.choices;
            const multiChoices = (fieldParams.find((p: any) => p.$type === 'StringChoicesParamChoices') as any)?.choices as StringChoice[] | undefined;
            const choices = singleChoices ?? multiChoices;
            if (!choices || choices.length === 0) return expandToNode``;

            function choiceValue(choice: StringChoice): string {
                if (!isStringExtendedChoice(choice.value)) return toMachineIdentifier(choice.value);
                const value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                if (value) return toMachineIdentifier(value.value);
                const choiceLabel = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
                if (choiceLabel) return toMachineIdentifier(choiceLabel.value);
                return "unknown";
            }

            // Display text: original string for plain choices, the label/value for extended ones.
            function choiceDisplay(choice: StringChoice): string {
                if (!isStringExtendedChoice(choice.value)) return choice.value;
                const choiceLabel = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
                if (choiceLabel) return choiceLabel.value;
                const value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                if (value) return value.value;
                return choiceValue(choice);
            }

            // A plain select that stores the chosen value (string, or array for multi) so the action
            // gets first.Field === "value" directly -- not a rich {value,icon,color} object.
            const items = choices.map(c => `{ title: '${choiceDisplay(c).replace(/'/g, "\\'")}', value: '${choiceValue(c)}' }`).join(", ");
            return expandToNode`
            <v-select name="${systemPath}" v-model="context.${systemPath}" :items="[${items}]" item-title="title" item-value="value" ${isMulti ? 'multiple chips' : ''} ${labelFragment} :disabled="!editMode || ${disabled}" variant="outlined" density="compact"></v-select>
            `;
        }

        if (isDocumentChoiceExp(element) || isDocumentChoicesExp(element)) {
            // Pick a document (or documents) of the referenced type. Stores UUID(s) in the
            // prompt's context path; the sheet DocumentChoice component is document-coupled and
            // can't be reused here, so we list candidates with a plain select bound to context.
            const refDoc = element.document.ref;
            const collection = (refDoc && isActor(refDoc)) ? 'game.actors' : 'game.items';
            const docType = refDoc?.name.toLowerCase() ?? '';
            const multiple = isDocumentChoicesExp(element);
            return expandToNode`
            <v-select name="${systemPath}" v-model="context.${systemPath}" :items="${collection}.filter(d => d.type === '${docType}').map(d => ({ title: d.name, value: d.uuid }))" item-title="title" item-value="value" ${multiple ? 'multiple chips' : ''} ${labelFragment} :disabled="!editMode || ${disabled}" variant="outlined" density="compact"></v-select>
            `;
        }

        if (isBooleanExp(element)) {
            return expandToNode`
            <v-checkbox v-model="context.${systemPath}" name="${systemPath}" ${labelFragment} :disabled="!editMode || ${disabled}" :color="primaryColor"></v-checkbox>
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
                :disabled="!editMode || ${disabled}"
            >
            ${valueParam == undefined ? `
            <template #append-inner>
                <i-calculator v-if="editMode" :context="context" :systemPath="'${systemPath}'" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-calculator>
            </template>
            ` : ``}
            </v-number-input>
            `;
        }

        // attribute/resource/tracker/money are persistent stateful widgets, not one-shot inputs --
        // they're intentionally unsupported in prompts (use number / choice instead).

        if (isDieField(element) || isDiceField(element)) {
            const choicesParam = element.params.find(x => isDieChoicesParam(x)) as DieChoicesParam | undefined;
            const choices = choicesParam ? `[${choicesParam.choices.join(", ")}]` : "[ 'd4', 'd6', 'd8', 'd10', 'd12', 'd20' ]";
            if (isDieField(element)) {
                const noneParam = element.params.find(x => isDieNoneParam(x)) as DieNoneParam | undefined;
                const noneAttr = noneParam?.value ? `:none="true"` : '';
                return expandToNode`
                <i-die label="${label}" systemPath="${systemPath}" :context="context" :editMode="editMode" :disabled="!editMode || ${disabled}" :choices="${choices}" ${noneAttr} :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-die>
                `;
            }
            return expandToNode`
            <i-dice label="${label}" systemPath="${systemPath}" :context="context" :editMode="editMode" :disabled="!editMode || ${disabled}" :choices="${choices}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-dice>
            `;
        }

        if (isSingleDocumentExp(element)) {
            return expandToNode`
            <i-document-link label="${label}" systemPath="${systemPath}" documentName="${element.document.ref?.name.toLowerCase()}" :context="context" :disabled="!editMode || ${disabled}" :secondaryColor="secondaryColor"></i-document-link>
            `;
        }

        if (isSelfPropertyRefExp(element)) {
            const choicesParam = element.params.find(p => isParentPropertyRefChoiceParam(p)) as ParentPropertyRefChoiceParam | undefined;
            let allChoices: Property[] = [];
            switch (element.propertyType) {
                case "attribute": allChoices = globalGetAllOfType<AttributeExp>(entry, isAttributeExp); break;
                case "resource": allChoices = globalGetAllOfType<ResourceExp>(entry, isResourceExp); break;
                case "number": allChoices = globalGetAllOfType<NumberExp>(entry, isNumberExp); break;
            }
            let refChoices = allChoices.map(x => {
                const parentDocument = getDocument(x);
                if (choicesParam && choicesParam.choices.length > 0) {
                    if (!choicesParam.choices.find(y => {
                        const documentNameMatches = y.document.ref?.name.toLowerCase() == parentDocument?.name.toLowerCase();
                        if (y.property != undefined) {
                            return documentNameMatches && y.property.ref?.name.toLowerCase() == x.name.toLowerCase();
                        }
                        return documentNameMatches;
                    })) return undefined;
                }
                return { path: `system.${x.name.toLowerCase()}`, parent: parentDocument?.name, name: x.name };
            }).filter(x => x != undefined);
            const choices = refChoices.map(c => `{ label: '${c?.parent} - ${c?.name}', value: '${c?.path}' }`).join(", ");
            return expandToNode`
            <v-select name="${systemPath}" v-model="context.${systemPath}" :items="[${choices}]" item-title="label" item-value="value" ${labelFragment} :disabled="!editMode || ${disabled}" variant="outlined" density="compact"></v-select>
            `;
        }

        if (isDateExp(element) || isTimeExp(element) || isDateTimeExp(element)) {
            const dtType = isDateExp(element) ? 'date' : (isTimeExp(element) ? 'time' : 'datetime-local');
            return expandToNode`
            <v-text-field type="${dtType}" name="${systemPath}" v-model="context.${systemPath}" ${labelFragment} :disabled="!editMode || ${disabled}" variant="outlined" density="compact"></v-text-field>
            `;
        }

        // html / paperdoll are not one-shot inputs and are intentionally unsupported in prompts.

        return expandToNode`
        <v-alert text="Unsupported prompt field ${element.name}" type="warning" density="compact" class="ga-2 ma-1" variant="outlined"></v-alert>
        `;
    }

    return expandToNode`
    <v-alert text="Unknown Element" type="warning" density="compact" class="ga-2 ma-1" variant="outlined"></v-alert>
    `;
    }
}
