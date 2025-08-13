import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateMacroChoiceComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `macro-field.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, inject, computed } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            visibility: String,
            editMode: Boolean,
            primaryColor: String,
            secondaryColor: String,
            icon: String
        });

        const document = inject('rawDocument');

        const value = ref(foundry.utils.getProperty(document, props.systemPath));
        const onChange = (value) =>  {
            let update = {};
            update[props.systemPath] = value;
            document.update(update);
            const updated = fromUuidSync(value);
            if (updated) selectedImage.value = updated.img;
        };

        const selectedImage = ref(value.value?.img);

        const isHidden = computed(() => {
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
            if (props.visibility === "play") {
                return props.editMode;
            }

            // Default to visible
            return false;
        });

        const isDisabled = () => {
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
            
            // Default to enabled while in editMode
            return !props.editMode;
        };

        const choices = computed(() => {
            let system = props.context.system;
            let allChoices = game.macros.contents;

            if (allChoices.length === 0) return [{
                id: null,
                name: 'No choices available'
            }];

            return allChoices.map(choice => {
                let context = {
                    id: choice.uuid,
                    name: choice.name,
                    image: choice.img,
                    source: choice.author.name
                };

                return context;
            });
        });

        const getLabel = computed(() => {
            const localized = game.i18n.localize(props.label);
            if (props.icon) {
                return \`<i class="fa-solid \${props.icon}"></i> \${localized}\`;
            }
            return localized;
        });
    </script>
    <template>
        <v-autocomplete clearable dense 
            v-model="value" 
            @update:modelValue="onChange"
            :items="choices" 
            item-title="name" 
            item-value="id" 
            density="compact"
            variant="outlined"
            :disabled="disabled"
            class="double-wide"
        >
            <template #label>
                <span v-html="getLabel" />
            </template>
            <template v-slot:prepend-inner v-if="value">
                <v-avatar rounded="0" :image="selectedImage" size="30" style="background-color: lightgray"></v-avatar>
            </template>
            <template v-slot:item="{ props, item }">
                <v-list-item
                    v-bind="props"
                    :data-tooltip="item.raw.description"
                >
                    <template v-slot:title>
                        <div class="flexrow">
                            <p style="flex: 1">{{ item.raw.name }}</p>
                            <v-spacer />
                            <v-chip size="small" label :color="secondaryColor" style="align-self: center; white-space: nowrap; flex: 0; line-height: 26px; display: inline-table;"><v-icon :icon="item.raw.icon" start></v-icon> {{ item.raw.source }}</v-chip>
                        </div>
                    </template>
                    <template v-if="item.raw.image" v-slot:prepend>
                        <v-avatar rounded="0" :image="item.raw.image" style="background-color: lightgray">
                        </v-avatar>
                    </template>
                </v-list-item>
            </template>
        </v-autocomplete>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}