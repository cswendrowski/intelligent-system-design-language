import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Action, DisabledCondition, Document, Entry, HiddenCondition, IconParam, isActor, isDisabledCondition, isHiddenCondition, isIconParam, isPrompt, isVariableExpression, Prompt, VariableExpression } from "../../../language/generated/ast.js";
import { translateExpression } from '../method-generator.js';
import { generatePromptApp } from './vue-prompt-generator.js';
import { generatePromptSheetClass } from './vue-prompt-sheet-class-generator.js';

export function generateActionComponent(entry: Entry, id: string, document: Document, action: Action, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "actions");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${action.name}Action.vue`);
    const iconParam = action.conditions.find(x => isIconParam(x)) as IconParam;

    const variables = action.method.body.filter(x => isVariableExpression(x)) as VariableExpression[];
    const prompts = variables.filter(x => isPrompt(x.value)).map(x => x.value) as Prompt[];
    for ( const prompt of prompts ) {
        generatePromptSheetClass(action.name, entry, id, document, prompt, destination);
        generatePromptApp(action.name, entry, id, document, prompt, destination);
    }

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const unlocked = action.modifier === 'unlocked';

    const fileNode = expandToNode`
    <script setup>
        import { ref, inject, computed } from "vue";

        const props = defineProps({
            context: Object,
            color: String,
            editMode: Boolean
        });

        const document = inject('rawDocument');

        const onClick = async (e) => {
            document.sheet._on${action.name}Action(e, props.context);
        };

        const unlocked = ${unlocked};

        const disabled = computed(() => {
            let system = props.context.system;
            return ${translateExpression(entry, id, (action.conditions.filter(x => isDisabledCondition(x))[0] as DisabledCondition)?.when) ?? false} || (props.editMode && !unlocked);
        });

        const hidden = computed(() => {
            let system = props.context.system;
            return ${translateExpression(entry, id, (action.conditions.filter(x => isHiddenCondition(x))[0] as HiddenCondition)?.when) ?? false}
        });
    </script>
    <template>
        <v-btn :color="color" class="ma-1 action-btn" @click="onClick" v-if="!hidden" :disabled="disabled" ${iconParam ? `prepend-icon="${iconParam.value}"` : ''}>{{game.i18n.localize('${document.name}.${action.name}')}}</v-btn>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
