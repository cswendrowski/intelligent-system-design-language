import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateExtendedChoiceComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `extended-choice-field.vue`);

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
            disabled: Boolean,
            primaryColor: String,
            secondaryColor: String,
            icon: String,
            items: Array,
        });
        
        const document = inject('rawDocument');

        const value = ref(foundry.utils.getProperty(document, props.systemPath));
        const onChange = (value) =>  {
            let update = {};
            // Find the full item based on the value
            const item = props.items.find(item => item.value === value);
            // We need to translate the item into a proper update
            let updateData = {};
            updateData.value = item.value;
            updateData.icon = item.icon;
            updateData.color = item.color;
            
            // For each of the customKeys, we need to add them to the update
            if (item.customKeys && item.customKeys.length > 0) {
                for (const custom of item.customKeys) {
                    updateData[custom.key.toLowerCase()] = custom.value;
                }
            }
            
            update[props.systemPath.replace(".value", "")] = updateData;
            document.update(update);
        };
        
        const getTooltip = (item) => {
            // The choice item might have additional system properties other than the core value, color, and icon.
            // We want to build a tooltip of these additional values
            const tooltipParts = [];
            if (item.customKeys && item.customKeys.length > 0) {
                for (const custom of item.customKeys) {
                    const value = custom.value;
                    if (value !== undefined) {
                        tooltipParts.push(\`\${custom.label}: \${value}\`);
                    }
                }
            }
            return tooltipParts.join('<br>');
        };
        
        const getLabel = (label, icon) => {
            const localized = game.i18n.localize(label);
            if (icon) {
                return \`<i class="\${icon}"></i> \${localized}\`;
            }
            return localized;
        };
        
    </script>
    <template>
        <v-select 
            :name="systemPath" 
            v-model="value" 
            :items="items" 
            item-title="label" 
            :disabled="disabled"
            variant="outlined"
            @update:modelValue="onChange"
            density="compact">
            <template #label>
                <span v-html="getLabel(label, icon)" />
            </template>
            <template v-slot:item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :value="item.raw.value" title="">
                <v-list-item-title>
                    <v-chip label :color="item.raw.color" variant="elevated" class="text-caption" size="small" :data-tooltip="getTooltip(item.raw)"><span v-html="getLabel(item.raw.label, item.raw.icon)" ></span></v-chip>
                </v-list-item-title>
              </v-list-item>
            </template>
            <template v-slot:selection="{ item, index }">
                <v-chip label :color="item.raw.color" variant="elevated" class="text-caption" size="small" :data-tooltip="getTooltip(item.raw)"><span v-html="getLabel(item.raw.label, item.raw.icon)" ></span></v-chip>
            </template>
        </v-select>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}