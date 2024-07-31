import type {
    ClassExpression,
    Document,
    Entry,
    Section,
} from '../../language/generated/ast.js';
import {
    isSection,
    isStringExp,
    isAction,
    isProperty,
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
        return string.replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    function generateDocument(document: Document): CompositeGeneratorNode | undefined {
        return expandToNode`
            "${document.name.toLowerCase()}": "${humanize(document.name)}",
            "${document.name}": {
                "${document.name}": "${humanize(document.name)}" ${document.body.length > 0 ? ',' : ''}
                ${joinToNode(document.body, property => generateProperty(property), { appendNewLineIfNotEmpty: true, separator: ','})}  
            }
        `;
    }

    function generateProperty(property: ClassExpression | Section): CompositeGeneratorNode | undefined {

        if (isSection(property)) {
            return expandToNode`
                "${property.name}": "${humanize(property.name)}",
                ${joinToNode(property.body, property => generateProperty(property), { appendNewLineIfNotEmpty: true, separator: ',' })}
            `;
        }

        if (isProperty(property)) {

            // If the property is a string with choices, we need to expand it into a list of localized strings
            if (isStringExp(property) && property.choices != undefined && property.choices.length > 0) {
                return expandToNode`
                    "${property.name}": {
                        "label": "${humanize(property.name)}",
                        ${joinToNode(property.choices, choice => `"${choice}": "${choice}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
                    }
                `;
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
            ${joinToNode(entry.documents, document => generateDocument(document), { appendNewLineIfNotEmpty: true, separator: ','})}
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
