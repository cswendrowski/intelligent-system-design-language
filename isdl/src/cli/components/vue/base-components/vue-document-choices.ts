import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Document, DocumentChoicesExp, Entry, GlobalParam, IconParam, isActor, isGlobalParam, isIconParam, isWhereParam, WhereParam } from "../../../../language/generated/ast.js";
import { translateExpression } from '../../method-generator.js';
import { getSystemPath } from '../../utils.js';


export function generateDocumentChoicesComponent(entry: Entry, id: string, document: Document, documentChoices: DocumentChoicesExp, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", "vue", type, document.name.toLowerCase(), "components", "document-choices");
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${documentChoices.name}DocumentChoices.vue`);

    const iconParam = documentChoices.params.find(isIconParam) as IconParam | undefined;
    const globalParam = documentChoices.params.find(isGlobalParam) as GlobalParam | undefined;
    const globalAllowed = globalParam?.value ?? false;

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const unlocked = documentChoices.modifier === 'unlocked';

    console.log("Generating document choices component", documentChoices.name);

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

        // Raw value holds the actual UUIDs stored in the document
        const rawValue = ref(foundry.utils.getProperty(document, '${getSystemPath(documentChoices)}') || []);
        console.log("Raw Value:", rawValue);
        
        // Computed value maps UUIDs to choice objects for v-model
        const value = computed({
            get() {
                return rawValue.value.map(item => {
                    let context = {
                        id: item.uuid,
                        name: item.name,
                        image: item.img,
                        summary: truncate(item.system?.description || '', 50),
                        description: item.system?.description || ''
                    };

                    if (item.parent) {
                        context.source = "Self";
                        context.color = props.primaryColor;
                        context.icon = 'fa-solid fa-user';
                    }
                    else if (item.compendium) {
                        context.source = \`\${item.compendium.metadata.packageName} - \${item.compendium.title}\`;
                        context.color = props.secondaryColor;
                        context.icon = 'fa-solid fa-suitcase';
                    }
                    else {
                        context.source = "World";
                        context.color = props.secondaryColor;
                        context.icon = 'fa-solid fa-globe';
                    }

                    return context;
                }).filter(Boolean);
            },
            set(newValue) {
                console.log("Updating Document choices to:", newValue);
                rawValue.value = newValue;
                document.update({ '${getSystemPath(documentChoices)}': newValue });
            }
        });

        const choices = computed(() => {
            let system = props.context.system;
            let allChoices = Array.from(document.items);

            ${globalAllowed ? 
            `
            let gameItems = game.items.filter(item => item.type === '${documentChoices.document.ref?.name.toLowerCase()}');
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
                if (item.type !== '${documentChoices.document.ref?.name.toLowerCase()}') return false;
                return ${translateExpression(entry, id, (documentChoices.params.filter((x: any) => isWhereParam(x))[0] as WhereParam)?.value) ?? true}
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
        <v-autocomplete 
            clearable 
            dense
            multiple
            chips
            v-model="value" 
            :items="choices" 
            item-title="name" 
            item-value="id" 
            density="compact"
            variant="outlined"
            class="double-wide"
        >
            <template #label>
                <span v-html="getLabel('${document.name}.${documentChoices.name}', ${iconParam ? `'${iconParam.value}'` : undefined})" />
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
            <template v-slot:chip="{ props: chipProps, item }">
                <v-chip
                    label
                    v-bind="chipProps"
                    :text="item.title"
                >
                    <template v-slot:prepend v-if="item.raw?.image">
                        <v-avatar rounded="0" size="small" :image="item.raw.image"  style="padding-right: 2px;"></v-avatar>
                    </template>
                </v-chip>
            </template>
        </v-autocomplete>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
