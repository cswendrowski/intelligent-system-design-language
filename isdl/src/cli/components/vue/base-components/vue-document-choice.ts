import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import {
    Document,
    DocumentChoiceExp, Entry, GlobalParam, IconParam, isActor, isGlobalParam, isIconParam, isWhereParam, WhereParam
} from "../../../../language/generated/ast.js";
import { translateExpression } from '../../method-generator.js';
import { getSystemPath } from '../../utils.js';

export function generateDocumentChoiceComponent(entry: Entry, id: string, document: Document, documentChoice: DocumentChoiceExp, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "document-choices");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${documentChoice.name}DocumentChoice.vue`);

    const iconParam = documentChoice.params.find(isIconParam) as IconParam | undefined;
    const globalParam = documentChoice.params.find(isGlobalParam) as GlobalParam | undefined;
    const globalAllowed = globalParam?.value ?? false;

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const unlocked = documentChoice.modifier === 'unlocked';

    console.log("Generating document choice component", documentChoice.name);

    const fileNode = expandToNode`
    <script setup>
        import { ref, inject, computed } from "vue";

        const props = defineProps({
            context: Object,
            editMode: Boolean,
            primaryColor: String,
            secondaryColor: String
        });

        const document = inject('rawDocument');
        const unlocked = ${unlocked};

        const value = ref(foundry.utils.getProperty(document, '${getSystemPath(documentChoice)}'));
        const onChange = (value) => {
            document.update({ '${getSystemPath(documentChoice)}': value });
            const updated = fromUuidSync(value);
            if (updated) selectedImage.value = updated.img;
        };

        const selectedImage = ref(value.value?.img);

        const disabled = computed(() => {
            let item = value.value?.length > 0 ? value.value[0] : value.value;
            let system = props.context.system;
            return ${false} || (!props.editMode && !unlocked);
        });

        const hidden = computed(() => {
            let item = value.value?.length > 0 ? value.value[0] : value.value;
            let system = props.context.system;
            return ${false}
        });

        const choices = computed(() => {
            let system = props.context.system;
            let allChoices = Array.from(document.items);

            ${globalAllowed ?
        `
            let gameItems = game.items.filter(item => item.type === '${documentChoice.document.ref?.name.toLowerCase()}');
            allChoices = allChoices.concat(gameItems);

            let itemPacks = game.packs.filter(pack => pack.documentName === 'Item');
            for (let pack of itemPacks) {
                const packItems = pack.index.contents;
                packItems.forEach(item => {
                    item.compendium = pack;
                });
                allChoices = allChoices.concat(packItems);
            }
            ` : ''}

            allChoices = allChoices.filter(item => {
                if (item.type !== '${documentChoice.document.ref?.name.toLowerCase()}') return false;
                return ${translateExpression(entry, id, (documentChoice.params.filter(x => isWhereParam(x))[0] as WhereParam)?.value) ?? true}
            });

            if (allChoices.length === 0) return [{
                id: null,
                name: 'No choices available'
            }];

            return allChoices.map(choice => {
                let context = {
                    id: choice.uuid,
                    name: choice.name,
                    image: choice.img,
                    summary: truncate(choice.system.description, 50),
                    description: choice.system.description
                };

                if (choice.parent) {
                    context.source = "Self";
                    context.color = props.primaryColor;
                    context.icon = 'fa-solid fa-user';
                }
                else if (choice.compendium) {
                    context.source = \`\${choice.compendium.metadata.packageName} - \${choice.compendium.title}\`;
                    context.color = props.secondaryColor;
                    context.icon = 'fa-solid fa-suitcase';
                }
                else {
                    context.source = "World";
                    context.color = props.secondaryColor;
                    context.icon = 'fa-solid fa-globe';
                }

                return context;
            });
        });

        const truncate = (text, maxLength) => {
            if (text.length > maxLength) {
                return text.substring(0, maxLength) + '...';
            }
            return text;
        }

        const getLabel = (label, icon) => {
            const localized = game.i18n.localize(label);
            if (icon) {
                return \`<i class="\${icon}"></i> \${localized}\`;
            }
            return localized;
        }
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
                <span v-html="getLabel('${document.name}.${documentChoice.name}', ${iconParam ? `'${iconParam.value}'` : undefined})" />
            </template>
            <template v-slot:prepend-inner v-if="value">
                <v-avatar rounded="0" :image="selectedImage" size="30"</v-avatar>
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
                            <v-chip size="small" label :color="item.raw.color" style="align-self: center; white-space: nowrap; flex: 0; line-height: 26px; display: inline-table;"><v-icon :icon="item.raw.icon" start></v-icon> {{ item.raw.source }}</v-chip>
                        </div>
                    </template>
                    <template v-if="item.raw.image" v-slot:prepend>
                        <v-avatar rounded="0" :image="item.raw.image">
                        </v-avatar>
                    </template>
                    <template v-slot:subtitle>
                        <div v-html="item.raw.summary"></div>
                    </template>
                </v-list-item>
            </template>
        </v-autocomplete>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
