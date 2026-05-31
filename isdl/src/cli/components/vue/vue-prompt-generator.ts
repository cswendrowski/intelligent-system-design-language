import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import {
    AttributeExp,
    ClassExpression,
    Document,
    Entry,
    ImageParam,
    isAction,
    isActor,
    isAttributeExp,
    isAttributeParamMod,
    isBooleanExp,
    isDateExp,
    isDateTimeExp,
    isDocumentChoiceExp,
    isHookHandler,
    isHtmlExp,
    isImageParam,
    isNumberExp,
    isNumberParamMin,
    isNumberParamValue,
    isPaperDollExp,
    isParentPropertyRefChoiceParam,
    isParentPropertyRefExp,
    isProperty,
    isResourceExp,
    isSingleDocumentExp,
    isSizeParam,
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
    NumberParamMin,
    NumberParamValue,
    ParentPropertyRefChoiceParam,
    Prompt,
    Property,
    ResourceExp,
    SizeParam,
    StringChoice,
    StringParamChoices,
    StringParamValue,
    isStringChoicesField,
    isDamageTypeChoiceField,
    isIconParam,
    isColorParam,
    isChoiceCustomProperty,
    isDieField,
    isDiceField,
    isDieChoicesParam,
    isDieNoneParam,
    isMoneyField,
    isTrackerExp,
    isSelfPropertyRefExp,
    ChoiceCustomProperty,
    ColorParam,
    DieChoicesParam,
    DieNoneParam,
    IconParam
} from "../../../language/generated/ast.js";
import { getDocument, globalGetAllOfType, toMachineIdentifier } from '../utils.js';
import { humanize } from 'inflection';
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
            const elementName = (element as any).name as string;
            const fieldParams = (element as any).params as any[];
            // choice<string>/choice<damageType> use StringParamChoices; choices<string> uses StringChoicesParamChoices.
            const singleChoices = (fieldParams.find(p => isStringParamChoices(p)) as StringParamChoices | undefined)?.choices;
            const multiChoices = (fieldParams.find((p: any) => p.$type === 'StringChoicesParamChoices') as any)?.choices as StringChoice[] | undefined;
            const choices = singleChoices ?? multiChoices;
            if (!choices || choices.length === 0) return expandToNode``;

            const fieldIcon = (fieldParams.find(p => isIconParam(p)) as IconParam | undefined)?.value ?? '';

            function choiceValue(choice: StringChoice): string {
                if (!isStringExtendedChoice(choice.value)) return toMachineIdentifier(choice.value);
                const value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                if (value) return toMachineIdentifier(value.value);
                const choiceLabel = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
                if (choiceLabel) return toMachineIdentifier(choiceLabel.value);
                return "unknown";
            }

            function choiceData(choice: StringChoice): string {
                const v = choiceValue(choice);
                const labelExpr = `game.i18n.localize('${document.name}.${elementName}.${v}')`;
                if (!isStringExtendedChoice(choice.value)) {
                    return `{ label: ${labelExpr}, value: '${v}', icon: '', color: '' }`;
                }
                const icon = choice.value.properties.find(isIconParam) as IconParam | undefined;
                const color = choice.value.properties.find(isColorParam) as ColorParam | undefined;
                const customProps = choice.value.properties.filter(isChoiceCustomProperty) as ChoiceCustomProperty[];
                const customKeys = customProps.length > 0
                    ? `, customKeys: [${customProps.map(c => `{ key: '${c.key}', label: '${humanize(c.key)}', value: ${typeof c.value === 'string' ? `'${c.value}'` : c.value} }`).join(',')}]`
                    : '';
                return `{ label: ${labelExpr}, value: '${v}', icon: '${icon?.value ?? ''}', color: '${color?.value ?? ''}'${customKeys} }`;
            }

            const items = choices.map(choiceData).join(", ");
            const componentName = isMulti ? 'i-string-choices' : 'i-string-choice';
            const maxParam = fieldParams.find((p: any) => p.$type === 'StringChoicesParamMax') as any;
            const maxAttr = (isMulti && maxParam) ? `:maxSelections="${maxParam.value}"` : '';

            return expandToNode`
            <${componentName} :context="context" label="${label}" icon="${fieldIcon}" systemPath="${systemPath}" :items="[${items}]" :isExtended="true" ${maxAttr} :editMode="editMode" :disabled="!editMode || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></${componentName}>
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
            <i-prosemirror ${labelFragment} :field="context.editors['${systemPath}']" :disabled="!editMode"></i-prosemirror>
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

        if (isAttributeExp(element)) {
            const minParam = element.params.find(x => isNumberParamMin(x)) as NumberParamMin;
            const min = minParam?.value ?? 0;
            const hasMod = element.params.find(x => isAttributeParamMod(x)) != undefined;

            return expandToNode`
                <i-attribute label="${label}" :hasMod="${hasMod}" :mod="context.${systemPath}.mod" systemPath="${systemPath}.value" :context="context" :min="${min}" :disabled="!editMode || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-attribute>
            `;
        }

        if (isResourceExp(element)) {
            return expandToNode`
            <i-resource label="${label}" systemPath="${systemPath}" :context="context" :disabled="!editMode || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-resource>
            `;
        }

        if (isTrackerExp(element)) {
            return expandToNode`
            <i-tracker label="${label}" systemPath="${systemPath}" :context="context" :editMode="editMode" :disabled="!editMode || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-tracker>
            `;
        }

        if (isMoneyField(element)) {
            return expandToNode`
            <i-money label="${label}" systemPath="${systemPath}" :context="context" :editMode="editMode" :disabled="!editMode || ${disabled}" :primaryColor="primaryColor" :secondaryColor="secondaryColor"></i-money>
            `;
        }

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

        if (isPaperDollExp(element)) {
            let sizeParam = element.params.find(x => isSizeParam(x)) as SizeParam;
            let size = sizeParam?.value ?? "40px";

            let imageParam = element.params.find(x => isImageParam(x)) as ImageParam;
            let image = imageParam?.value ?? `systems/${id}/img/paperdoll_default.png`;

            return expandToNode`
            <i-paperdoll label="${label}" systemPath="system.${element.name.toLowerCase()}" :context="context" :disabled="!editMode || ${disabled}" image="${image}" size="${size}" :slots="${element.name.toLowerCase()}Slots"></i-paperdoll>
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
