import type {
    ClassExpression,
    Document,
    Entry,
    Page,
    Section,
    StringParamChoices,
} from '../../language/generated/ast.js';
import {
    isSection,
    isStringExp,
    isAction,
    isProperty,
    isPage,
    isStringParamChoices,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
                ${joinToNode(document.body, property => generateProperty(property), { appendNewLineIfNotEmpty: true, separator: ',' })}  
            }
        `;
    }

    function generateProperty(property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {

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

        if (isProperty(property)) {

            // If the property is a string with choices, we need to expand it into a list of localized strings
            if (isStringExp(property)) {
                let choices = property.params.find(p => isStringParamChoices(p)) as StringParamChoices;
                if (choices != undefined && choices.choices.length > 0) {
                    return expandToNode`
                    "${property.name}": {
                        "label": "${humanize(property.name)}",
                        ${joinToNode(choices.choices, choice => `"${choice}": "${choice}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
                    }
                `;
                }
            }

            return expandToNode`
                "${property.name}": "${humanize(property.name)}"
            `;
        }

        if (isAction(property)) {
            return expandToNode`
                "${property.name}": "${humanize(property.name)}"
            `;
        }

        return
    }

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
            ${joinToNode(entry.documents, document => generateDocument(document), { appendNewLineIfNotEmpty: true, separator: ',' })}
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
