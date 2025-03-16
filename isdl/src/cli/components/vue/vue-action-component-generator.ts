import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Action, DisabledCondition, Document, Entry, HiddenCondition, isActor, isDisabledCondition, isHiddenCondition } from "../../../language/generated/ast.js";
import { translateBodyExpressionToJavascript, translateExpression } from '../method-generator.js';


export function generateActionComponent(entry: Entry, id: string, document: Document, action: Action, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, "components");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${action.name}Action.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, inject, computed } from "vue";

        const props = defineProps({
            context: Object
        });

        const document = inject('rawDocument');

        const onClick = async () => {
            console.log("Clicked ${action.name}");
            let system = props.context.system;
            const ${entry.config.name}Roll = game.system.rollClass;
            const context = props.context;
            context.object.system = props.context.system;
            let update = {};
            let embeddedUpdate = {};
            let parentUpdate = {};
            let selfDeleted = false;
            ${translateBodyExpressionToJavascript(entry, id, action.method.body, false, undefined, true)}
            if (!selfDeleted && Object.keys(update).length > 0) {
                await document.update(update);
            }
            if (!selfDeleted && Object.keys(embeddedUpdate).length > 0) {
                for (let key of Object.keys(embeddedUpdate)) {
                    await document.updateEmbeddedDocuments("Item", embeddedUpdate[key]);
                }
            }
            if (Object.keys(parentUpdate).length > 0) {
                await document.parent.update(parentUpdate);
            }
        };

        const disabled = computed(() => {
            let system = props.context.system;
            return ${translateExpression(entry, id, (action.conditions.filter(x => isDisabledCondition(x))[0] as DisabledCondition)?.when) ?? false}
        });

        const hidden = computed(() => {
            let system = props.context.system;
            return ${translateExpression(entry, id, (action.conditions.filter(x => isHiddenCondition(x))[0] as HiddenCondition)?.when) ?? false}
        });
    </script>
    <template>
        <v-btn color="primary" class="ma-1 action-btn" @click="onClick" v-if="!hidden" :disabled="disabled">{{game.i18n.localize('${document.name}.${action.name}')}}</v-btn>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
