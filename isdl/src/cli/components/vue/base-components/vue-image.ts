import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateImageComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `image.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { computed } from "vue";

        const props = defineProps({
            label: String,
            // Document-relative path the image lives at: "img" for the primary (native portrait)
            // image, or "system.<name>" for a system-stored image field. Used for BOTH reading the
            // current src and as the data-edit target the sheet's onEditImage FilePicker writes to.
            systemPath: String,
            context: Object,
            icon: String,
            color: String,
            // Standard field editability: true in play mode unless the field is unlocked. When
            // disabled, the click-to-edit affordance is removed (no file picking).
            disabled: Boolean,
            visibility: String,
            // True when this field is bound to the document's native img (the movable portrait).
            primary: Boolean
        });

        // Read from context.object -- the toObject() snapshot the sheet rebuilds on every render
        // (mixin updateContext). context.document is a STABLE reference, so reading from it would
        // never react to an onEditImage update; context.object changes identity each render.
        const src = computed(() => foundry.utils.getProperty(props.context?.object, props.systemPath));

        // Foundry copies missing-character.png into every generated system's img dir; resolve the
        // path at runtime so the component needs no generate-time system id.
        const fallbackImg = computed(() => \`/systems/\${game.system.id}/img/missing-character.png\`);

        const isHidden = computed(() => {
            if (props.visibility === "hidden") {
                return true;
            }
            if (props.visibility === "gm" && !game.user.isGM) {
                return true;
            }
            return false;
        });

        // Click-to-edit is delegated to the sheet's onEditImage action (Foundry FilePicker). Only
        // wire it when the field is editable -- omitting data-action makes the image inert, matching
        // standard field behavior (disabled in play mode unless unlocked).
        const editAction = computed(() => props.disabled ? null : "onEditImage");
        const editPath = computed(() => props.disabled ? null : props.systemPath);
    </script>

    <template>
        <div v-if="!isHidden" class="isdl-image single-wide">
            <span v-if="props.label" class="field-label">
                <v-icon v-if="props.icon" :icon="props.icon" size="small" class="me-1"></v-icon>
                {{ game.i18n.localize(props.label) }}
            </span>
            <v-img
                :src="src || fallbackImg"
                :class="['isdl-image-frame', { 'isdl-image-editable': !props.disabled }]"
                cover
                :data-edit="editPath"
                :data-action="editAction"
            >
                <template #error>
                    <v-img :src="fallbackImg" cover :data-edit="editPath" :data-action="editAction"></v-img>
                </template>
            </v-img>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
