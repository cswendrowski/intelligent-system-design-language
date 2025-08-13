import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generatePaperdollComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `paperdoll.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            disabled: Boolean,
            slots: Array,
            image: String,
            size: String
        });

        const value = computed(() => {
            return foundry.utils.getProperty(props.context, props.systemPath);
        });

        const slotValue = (systemPath) => {
            return foundry.utils.getProperty(props.context, systemPath);
        };

        const openSlot = (slot) => {
            const item = slotValue(slot.systemPath);
            if (item) {
                const fromUuid = fromUuidSync(item.uuid);
                fromUuid.sheet.render(true);
            }
        };
    </script>

    <template>
        <v-card class="isdl-paperdoll">
            <v-card-title>{{ game.i18n.localize(label) }}</v-card-title>
            <v-card-text>
                <div class="paper-doll-container" :data-name="systemPath" :style="{ backgroundImage: 'url(' + image + ')' }">
                    <div class="paper-doll-slot" v-for="slot in slots" :key="slot.name" :data-name="slot.systemPath" @click="openSlot(slot)" :data-tooltip="slot.name" :data-type="slot.type" :style="{ left: slot.left, top: slot.top, width: size, height: size }">
                        <img :src="slotValue(slot.systemPath)?.img" :data-tooltip="slotValue(slot.systemPath)?.name" />
                    </div>
                </div>
            </v-card-text>
        </v-card>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}