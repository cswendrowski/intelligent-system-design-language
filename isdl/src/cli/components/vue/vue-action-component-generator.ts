import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Action, Document, Entry, isActor } from "../../../language/generated/ast.js";
import { translateBodyExpressionToJavascript } from '../method-generator.js';


export function generateActionComponent(entry: Entry, id: string, document: Document, action: Action, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, "components");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${action.name}Action.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref } from "vue";

        const props = defineProps({
            context: Object
        });

        const onClick = async () => {
            console.log("Clicked ${action.name}");
            const system = props.context.system;
            const ${id}Roll = game.system.rollClass;
            const context = props.context;
            let update = {};
            ${translateBodyExpressionToJavascript(entry, id, action.method.body, false, undefined, true)}
            const document = await fromUuid(context.document.uuid);
            document.update(update);
        };
    </script>
    <template>
        <v-btn color="primary" class="ma-1" @click="onClick">{{game.i18n.localize('${document.name}.${action.name}')}}</v-btn>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
