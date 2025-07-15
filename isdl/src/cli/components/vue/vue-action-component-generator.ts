import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Action, Document, Entry, IconParam, isActor, isIconParam, isPrompt, isVariableExpression, Prompt, VariableExpression } from "../../../language/generated/ast.js";
import { generatePromptApp } from './vue-prompt-generator.js';
import { generatePromptSheetClass } from './vue-prompt-sheet-class-generator.js';

export function generateActionComponent(entry: Entry, id: string, document: Document, action: Action, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "actions");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${action.name}Action.vue`);
    const iconParam = action.params.find(x => isIconParam(x)) as IconParam | undefined;

    const variables = action.method.body.filter(x => isVariableExpression(x)) as VariableExpression[];
    const prompts = variables.filter(x => isPrompt(x.value)).map(x => x.value) as Prompt[];
    for ( const prompt of prompts ) {
        generatePromptSheetClass(action.name, entry, id, document, prompt, destination);
        generatePromptApp(action.name, entry, id, document, prompt, destination);
    }

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <script setup>
        import { inject, computed } from "vue";

        const props = defineProps({
            context: Object,
            color: String,
            editMode: Boolean,
            visibility: String
        });

        const document = inject('rawDocument');

        const onClick = async (e) => {
            document.sheet._on${action.name}Action(e, props.context);
        };

        const disabled = computed(() => {
            console.log("Action ${action.name} disabled computed triggered", props.visibility, props.editMode);
            const disabledStates = ["readonly", "locked"];
            if (disabledStates.includes(props.visibility)) {
                return true;
            }
            if (props.visibility === "gmEdit") {
                const isGm = game.user.isGM;
                const isEditMode = props.editMode;
                return !isGm && !isEditMode;
            }

            if (props.visibility === "unlocked") {
                return false;
            }
            
            // Default to disabled while in editMode
            return props.editMode;
        });

        const hidden = computed(() => {
            console.log("Action ${action.name} hidden computed triggered", props.visibility, props.editMode);
            if (props.visibility === "hidden") {
                return true;
            }
            if (props.visibility === "gmOnly") {
                return !game.user.isGM;
            }
            if (props.visibility === "secret") {
                const isGm = game.user.isGM;
                const isOwner = document.getUserLevel(game.user) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
                return !isGm && !isOwner;
            }
            if (props.visibility === "edit") {
                return !props.editMode;
            }

            // Default to visible
            return false;
        });
    </script>
    <template>
        <v-btn :color="color" class="action-btn" @click="onClick" v-if="!hidden" :disabled="disabled" ${iconParam ? `prepend-icon="${iconParam.value}"` : ''} :data-tooltip="game.i18n.localize('${document.name}.${action.name}')">{{game.i18n.localize('${document.name}.${action.name}')}}</v-btn>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
