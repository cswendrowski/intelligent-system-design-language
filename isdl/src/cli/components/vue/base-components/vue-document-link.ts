import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateDocumentLinkComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `document-link.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            disabled: Boolean,
            documentName: String,
            secondaryColor: String
        });

        const value = computed(() => {
            return foundry.utils.getProperty(props.context, props.systemPath);
        });

        const image = computed(() => {
            return value.value ? value.value.img : null;
        });

        const hasLink = computed(() => {
            return !!value.value;
        });

        const document = inject("rawDocument");

        const open = () => {
            const item = fromUuidSync(value.value.uuid);
            item.sheet.render(true);
        };

        const remove = async () => {
            const update = {};
            value.value = null;
            update[props.systemPath] = null;
            await document.update(update);
        };
    </script>

    <template>
        <v-card class="isdl-single-document single-document" :data-type="documentName" :data-name="systemPath">
            <v-img v-if="image" :src="image" class="align-end" cover style="background-color: lightgray" >
                <template v-slot:error>
                    <v-img src="/icons/vtt-512.png" class="align-end" cover></v-img>
                </template>
            </v-img>
            <v-img v-else src="/icons/containers/boxes/crates-wooden-stacked.webp" class="align-end" cover></v-img>
            <v-card-title>{{ game.i18n.localize(label) }}</v-card-title>
            <v-card-subtitle v-if="hasLink">{{ value.name }}</v-card-subtitle>
            <v-card-text v-else>{{ game.i18n.localize('NoSingleDocument') }}</v-card-text>
            <v-card-actions v-if="hasLink">
                <v-btn :color="secondaryColor" @click="open" icon="fa-solid fa-up-right-from-square" size="small">
                </v-btn>
                <v-spacer></v-spacer>
                <v-btn :color="secondaryColor" @click="remove" icon="fa-solid fa-delete-left" size="small">
                </v-btn>
            </v-card-actions>
        </v-card>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}