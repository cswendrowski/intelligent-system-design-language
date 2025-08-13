import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateProsemirrorComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `prosemirror.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed } from "vue";

        const props = defineProps({
            label: String,
            icon: String,
            field: Object,
            disabled: Boolean
        });
    </script>

    <template>
        <div class="isdl-html flexcol">
            <label style="font-weight: bold"><span v-if="icon" class="padding-right: 0.25rem;"><i :class="icon"></i> </span>{{ game.i18n.localize(label) }}</label>
            <div class="prose-mirror-wrapper" v-html="disabled ? field.enriched : field.element.outerHTML"></div>
        </div>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}