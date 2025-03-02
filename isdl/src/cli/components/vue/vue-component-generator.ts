import * as path from 'node:path';
import * as fs from 'node:fs';
import { CompositeGeneratorNode, expandToNode, toString } from 'langium/generate';
import { Document, isActor } from "../../../language/generated/ast.js";

export function generateDocumentVueComponent(id: string, document: Document, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type);
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}App.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        ${generateVueComponentScript(id, document)}
        ${generateVueComponentTemplate(id, document)}
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateVueComponentScript(id: string, document: Document): CompositeGeneratorNode {
    return expandToNode`
    <script setup>

    </script>
    `;
}

function generateVueComponentTemplate(id: string, document: Document): CompositeGeneratorNode {
    return expandToNode`
    <template>
        <div>
            <h1>${document.name}</h1>
        </div>
    </template>
    `;
}
