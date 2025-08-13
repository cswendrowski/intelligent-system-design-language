import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateAttributeComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `attribute.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed } from "vue";

        const props = defineProps({
            label: String,
            icon: String,
            hasMod: Boolean,
            mod: Number,
            systemPath: String,
            context: Object,
            min: Number,
            disabled: Boolean,
            primaryColor: String,
            secondaryColor: String,
            editMode: Boolean,
            attributeStyle: String, // plain or box
            roll: Function,
            hasRoll: Boolean
        });

        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath, newValue)
        });

        const getStyle = computed(() => {
            const p = props.primaryColor || "#92aed9";

            // Get either black or white text color based on the primary color brightness
            const brightness = (parseInt(p.slice(1, 3), 16) * 299 + parseInt(p.slice(3, 5), 16) * 587 + parseInt(p.slice(5, 7), 16) * 114) / 1000;
            let textColor = "#ffffff"; // Default to white text
            if (brightness > 128) {
                textColor = "#000000"; // Use black text for brighter colors
            }

            return {
                backgroundColor: p,
                color: textColor,
                borderColor: p
            };
        });

        const getLabel = computed(() => {
            const localized = game.i18n.localize(props.label);
            if (props.icon) {
                return \`<i class="fa-solid \${props.icon}"></i> \${localized}\`;
            }
            return localized;
        });
        
        const isHovering = ref(false);

        const handleRoll = () => {
          if (props.roll) {
            props.roll();
          }
        };
    </script>

    <template>
        <div class="dice-container"
            @mouseenter="isHovering = true"
            @mouseleave="isHovering = false"
        >
            <div v-if="attributeStyle == 'plain'">
            <v-number-input v-if="attributeStyle == 'plain' && editMode" v-model="value" :name="systemPath" :min="props.min" :disabled="disabled" type="number" variant="outlined" density="compact" :hide-details="true" data-tooltip="Value">
            <template #label>
                <span v-html="getLabel" />
            </template>
            </v-number-input>
            <v-number-input v-if="attributeStyle == 'plain' && !editMode" :model-value="mod" :name="systemPath"  :disabled="true" type="number" controlVariant="hidden" variant="outlined" density="compact" :hide-details="true" data-tooltip="Mod">
                <template #label>
                    <span v-html="getLabel" />
                </template>   
            </v-number-input>
            <!-- Overlay with dice icon - appears on hover when roll function is available -->
                <div
                  v-if="hasRoll && isHovering && !editMode"
                  class="dice-overlay plain"
                  @click="handleRoll"
                >
                  <v-btn
                    icon
                    size="x-small"
                    :color="primaryColor"
                    class="dice-roll-btn"
                    variant="elevated"
                    elevation="4"
                  >
                    <v-icon size="small">fa-solid fa-dice</v-icon>
                  </v-btn>
                </div>
            </div>
            <v-container 
                :class="['isdl-property', 'attributeExp', { 'no-mod': !hasMod }]" 
                v-if="attributeStyle == 'box'"

                >
                <v-label :style="getStyle"><v-icon v-if="icon" size="x-small" :icon="icon" style="padding-right: 0.5rem;"></v-icon>{{ game.i18n.localize(label) }}</v-label>
                <div class="mod" v-if="hasMod">{{ mod }}</div>
                <v-number-input v-model="value" inset :min="props.min" :disabled="disabled" :name="systemPath" :controlVariant="disabled ? 'hidden' : 'split'" :step="1" type="number" variant="outlined" density="compact" :hide-details="true" :tile="true"></v-number-input>
                <!-- Overlay with dice icon - appears on hover when roll function is available -->
                <div
                  v-if="hasRoll && isHovering && !editMode"
                  class="dice-overlay"
                  @click="handleRoll"
                >
                  <v-btn
                    icon
                    :color="primaryColor"
                    class="dice-roll-btn"
                    variant="elevated"
                    elevation="4"
                  >
                    <v-icon>fa-solid fa-dice</v-icon>
                  </v-btn>
                </div>
            </v-container>
        </div>
    </template>
    `;

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}