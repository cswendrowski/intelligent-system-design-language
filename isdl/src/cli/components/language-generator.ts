import type {
    ChoiceStringValue,
    ClassExpression,
    Document,
    Entry,
    LabelParam,
    StandardFieldParams, StringChoice,
    StringParamChoices,
} from '../../language/generated/ast.js';
import {
    isSection,
    isStringExp,
    isAction,
    isProperty,
    isPage,
    isStringParamChoices,
    isActor,
    isItem,
    isHookHandler,
    isLabelParam, Layout, isLayout, isChoiceStringValue, isStringExtendedChoice, isStringChoiceField,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {toMachineIdentifier} from "./utils.js";

export function generateLanguageJson(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, `lang`);
    const generatedFilePath = path.join(generatedFileDir, `en.json`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function humanize(string: string) {
        // Turn TitleCase into Title Case
        return string
            .replace(/([a-z])([A-Z])/g, '$1 $2')  // Handle lowercase followed by uppercase
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // Handle multiple uppercase followed by lowercase
            .replace(/([a-zA-Z])(\d)/g, '$1 $2');  // Handle letter followed by digit
    }

    function generateDocument(document: Document): CompositeGeneratorNode | undefined {
        return expandToNode`
            "${document.name.toLowerCase()}": "${humanize(document.name)}",
            "${document.name}": {
                "${document.name}": "${humanize(document.name)}" ${document.body.length > 0 ? ',' : ''}
                ${joinToNode(document.body, generateProperty, { appendNewLineIfNotEmpty: true, separator: ',' })}
            }
        `;
    }

    function generateProperty(property: ClassExpression | Layout): CompositeGeneratorNode | undefined {

        if (isSection(property) && property.body.length > 0) {
            return expandToNode`
                "${property.name}": "${humanize(property.name)}",
                ${joinToNode(property.body, property => generateProperty(property), { appendNewLineIfNotEmpty: true, separator: ',' })}
            `;
        }

        if (isPage(property)) {
            return expandToNode`
                "${property.name}": "${humanize(property.name)}",
                ${joinToNode(property.body, property => generateProperty(property), { appendNewLineIfNotEmpty: true, separator: ',' })}
            `;
        }

        if (isLayout(property)) {
            return joinToNode(property.body, property => generateProperty(property), { appendNewLineIfNotEmpty: true, separator: ',' });
        }

        if (isProperty(property)) {
            const standardParams = property.params as StandardFieldParams[];
            const labelParam = standardParams.find(x => isLabelParam(x)) as LabelParam | undefined;
            const label = labelParam ? labelParam.value : humanize(property.name);

            function choiceLocalize(choice: StringChoice): string {
                if (!isStringExtendedChoice(choice.value)) {
                    return humanize(choice.value);
                }
                let label = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
                if (label) {
                    return label.value;
                }
                let value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
                if (value) {
                    return humanize(value.value);
                }
                return "Unknown Choice";
            }

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

            // If the property is a string with choices, we need to expand it into a list of localized strings
            if (isStringExp(property)) {
                let choices = property.params.find(p => isStringParamChoices(p)) as StringParamChoices;

                if (choices != undefined && choices.choices.length > 0) {
                    return expandToNode`
                    "${property.name}": {
                        "label": "${label}",
                        ${joinToNode(choices.choices, choice => `"${choiceValue(choice)}": "${choiceLocalize(choice)}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
                    }
                `;
                }
            }

            if (isStringChoiceField(property)) {
                const labelParam = property.params.find(x => isLabelParam(x)) as LabelParam | undefined;
                const label = labelParam ? labelParam.value : humanize(property.name);
                let choiceParam = property.params.find(p => isStringParamChoices(p)) as StringParamChoices;

                return expandToNode`
                "${property.name}": {
                    "label": "${label}",
                    ${joinToNode(choiceParam.choices, choice => `"${choiceValue(choice)}": "${choiceLocalize(choice)}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
                }
            `;
            }

            return expandToNode`
                "${property.name}": "${label}"
            `;
        }



        if (isAction(property)) {
            const labelParam = property.params.find(x => isLabelParam(x)) as LabelParam | undefined;
            const label = labelParam ? labelParam.value : humanize(property.name);

            return expandToNode`
                "${property.name}": "${label}"
            `;
        }

        if (isHookHandler(property)) {
            return expandToNode`
                "${property.name}": "${humanize(property.name)}"
            `;
        }

        return
    }

    const actors = entry.documents.filter(d => isActor(d));
    const items = entry.documents.filter(d => isItem(d));

    const fileNode = expandToNode`
        {
            "NoSingleDocument": "No Linked Document",
            "EditModeWarning": "Active Effects are not applied while in Edit mode. Base values are displayed and used for all rolls, calculations and actions.",
            "SendToChat": "Send to Chat",
            "SETTINGS": {
                "RoundUpDamageApplicationName": "Round Up Damage",
                "RoundUpDamageApplicationHint": "When enabled, damage is rounded up to the nearest whole number. When disabled, damage is rounded down.",
                "AllowTargetDamageApplicationName": "Allow Target Damage Application",
                "AllowTargetDamageApplicationHint": "Whether or not to allow damage and healing on chat messages to be applied to targeted tokens in addition to selected tokens. Targeting does not require permissions, so this can allow players and GMs to apply damage to ANY token they can see."
            },
            "CONTEXT": {
                "ApplyChanges": "Apply",
                "ApplyDamage": "As Damage",
                "ApplyHealing": "As Healing",
                "ApplyTemp": "As Temporary"
            },
            "NOTIFICATIONS": {
                "NoTokenSelected": "No Token is currently selected",
                "NoTokenTargeted": "No Token is currently targeted"
            },
            "TYPES": {
                "Actor": {
                    "actor": "Actor",
                    ${joinToNode(actors, actor => expandToNode`"${actor.name.toLowerCase()}": "${humanize(actor.name)}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
                },
                "Item": {
                    "item": "Item",
                    ${joinToNode(items, item => expandToNode`"${item.name.toLowerCase()}": "${humanize(item.name)}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
                }
            },
            "EFFECTS": {
                "AddOnce": "Add Once",
                "TabEffects": "Effects"
            },
            ${joinToNode(entry.documents, document => generateDocument(document), { appendNewLineIfNotEmpty: true, separator: ',' })}
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
