import {Entry} from "../../../language/generated/ast.js";
import path from "node:path";
import fs from "node:fs";
import {expandToNode, toString} from "langium/generate";

export function generateDocumentCreationVueSheet(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue");
    const generatedFilePath = path.join(generatedFileDir, `document-create-app.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    ${generateVueComponentScript()}
    ${generateVueComponentTemplate()}
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));

    function generateVueComponentScript() {
        return expandToNode`
        <script setup>
        import { ref, inject, computed } from 'vue';
        
        const props = defineProps(['context']);
        
        // Colors
        const primaryColor = ref('#1565c0');
        const secondaryColor = ref('#4db6ac');
        const tertiaryColor = ref('#ffb74d');

        const hasFolders = props.context.folders.length > 0;
        const name = ref('');
        const folder = ref(props.context.folder);
        const type = ref(props.context.type);
        
        const selectedImage = ref(props.context.types.find(x => x.type == type.value)?.icon || 'icons/svg/mystery-man.svg');
        
        const onChange = (value) => {
            console.log("Type changed to:", value, props.context.types);
            selectedImage.value = props.context.types.find(x => x.type == type.value)?.icon || 'icons/svg/mystery-man.svg';
            console.log("Selected image updated to:", selectedImage.value);
        };
        
        const sheet = inject("rawSheet");
        
        const submit = () => {
            sheet.submit();
        };

        const cancel = () => {
            sheet.cancel();
        };
        
        const getLabel = (label, icon) => {
            const localized = game.i18n.localize(label);
            if (icon) {
                return \`<i class="\${icon}"></i> \${localized}\`;
            }
            return localized;
        };
        
        </script>
    `;
    }

    function generateVueComponentTemplate() {
        return expandToNode`
        <template>
            <v-app>
                <!-- Main Content -->
                <v-main class="d-flex">
                    <v-container class="topography" fluid>
                        <v-col>
                            <v-row>
                                <v-text-field
                                        v-model="name"
                                        name="name"
                                        label="Document Name"
                                        outlined
                                        :clearable="true"
                                        aria-autocomplete="none"
                                ></v-text-field>
                            </v-row>
                            
                            <v-row>
                                <v-autocomplete
                                        v-model="type"
                                        @update:modelValue="onChange"
                                        name="type"
                                        :items="props.context.types"
                                        label="Document Type"
                                        item-title="label"
                                        item-value="type"
                                        outlined
                                        required
                                >
                                    <template v-slot:prepend-inner>
                                        <v-avatar rounded="0" :image="selectedImage" size="30"</v-avatar>
                                    </template>
                                    <template v-slot:item="{ props, item }">
                                        <v-list-item
                                            v-bind="props"
                                            :data-tooltip="item.raw.description"
                                        >
                                            <template v-slot:title>
                                                <div class="flexrow">
                                                    <p style="flex: 1">{{ item.raw.label }}</p>
                                                </div>
                                            </template>
                                            <template v-if="item.raw.icon" v-slot:prepend>
                                                <v-avatar rounded="0" :image="item.raw.icon" style="background: lightgray;">
                                                </v-avatar>
                                            </template>
                                            <template v-slot:subtitle>
                                                <div v-html="item.raw.description"></div>
                                            </template>
                                        </v-list-item>
                                    </template>
                                </v-autocomplete>
                            </v-row>

                            <v-row v-if="hasFolders">
                                <v-select
                                        v-model="folder"
                                        :items="props.context.folders"
                                        name="folder"
                                        item-title="name"
                                        item-value="id"
                                        label="Select Folder"
                                        outlined
                                        :clearable="true"
                                ></v-select>
                            </v-row>

                            <v-row class="mt-4 flexrow">
                                <v-btn @click="submit" :color="primaryColor" class="ma-1 action-btn">Submit</v-btn>
                                <v-btn @click="cancel" :color="secondaryColor" class="ma-1 action-btn">Cancel</v-btn>
                            </v-row>
                        </v-col>
                    </v-container>
                </v-main>
            </v-app>
        </template>
        `.appendNewLineIfNotEmpty();
    }
}
