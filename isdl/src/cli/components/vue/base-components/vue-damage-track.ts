import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateDamageTrackComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `damage-track.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { computed, inject } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            editMode: Boolean,
            hideLabel: Boolean,
            primaryColor: String,
            secondaryColor: String,
            types: Array,
            max: Number,
        });

        const document = inject("rawDocument");

        // types ordered from least to most severe (first type is least severe)
        // empty is always the "unfilled" state
        const typeColors = ['#888888', '#4fc3f7', '#ef5350', '#7b1fa2', '#ff9800', '#43a047'];

        const getColor = (index) => {
            if (index === 0) return props.secondaryColor ?? '#555';
            return typeColors[index] ?? typeColors[typeColors.length - 1];
        };

        // Build ordered list of boxes: [most-severe ... least-severe ... empty]
        // We render: all aggravated boxes, then lethal, then bashing, then empty
        const boxes = computed(() => {
            const result = [];
            const types = props.types ?? [];
            // Fill from most severe (last type) to least severe (first type), then empty
            for (let t = types.length - 1; t >= 0; t--) {
                const count = getVal(types[t]);
                for (let i = 0; i < count; i++) {
                    result.push({ type: types[t], typeIndex: t + 1 });
                }
            }
            const emptyCount = getVal('empty');
            for (let i = 0; i < emptyCount; i++) {
                result.push({ type: 'empty', typeIndex: 0 });
            }
            return result;
        });

        const getVal = (type) => {
            const v = foundry.utils.getProperty(props.context, props.systemPath + '.' + type);
            return Math.max(0, Math.floor(v ?? 0));
        };

        const setVal = (type, value) => {
            foundry.utils.setProperty(props.context, props.systemPath + '.' + type, value);
        };

        // Left-click: fill an empty box with least-severe type
        const addDamage = (box, index) => {
            if (!props.editMode) return;
            const types = props.types ?? [];
            if (types.length === 0) return;
            if (box.type === 'empty') {
                const leastSevere = types[0];
                setVal(leastSevere, getVal(leastSevere) + 1);
                setVal('empty', getVal('empty') - 1);
            } else {
                // Upgrade: cycle to next more severe type if available
                const typeIndex = types.indexOf(box.type);
                if (typeIndex < types.length - 1) {
                    const nextType = types[typeIndex + 1];
                    setVal(box.type, getVal(box.type) - 1);
                    setVal(nextType, getVal(nextType) + 1);
                }
            }
        };

        // Right-click: heal most-severe filled box → empty
        const healDamage = (box, index) => {
            if (!props.editMode) return;
            if (box.type === 'empty') return;
            setVal(box.type, getVal(box.type) - 1);
            setVal('empty', getVal('empty') + 1);
        };

        const getLabel = computed(() => game.i18n.localize(props.label));

        const boxSymbol = (type) => {
            const types = props.types ?? [];
            const idx = types.indexOf(type);
            if (type === 'empty') return '';
            if (idx === types.length - 1) return 'X';
            if (idx === types.length - 2) return '/';
            return '\\\\';
        };
    </script>

    <template>
        <div class="isdl-damage-track">
            <div v-if="!props.hideLabel" class="damage-track-label">{{ getLabel }}</div>
            <div class="damage-track-boxes">
                <div
                    v-for="(box, i) in boxes"
                    :key="i"
                    class="damage-box"
                    :class="{ 'damage-box--filled': box.type !== 'empty', 'damage-box--empty': box.type === 'empty' }"
                    :style="{
                        borderColor: getColor(box.typeIndex),
                        backgroundColor: box.type !== 'empty' ? getColor(box.typeIndex) : 'transparent',
                    }"
                    :data-tooltip="box.type !== 'empty' ? box.type : 'empty'"
                    @click.stop="addDamage(box, i)"
                    @contextmenu.prevent.stop="healDamage(box, i)"
                >
                    <span class="damage-symbol">{{ boxSymbol(box.type) }}</span>
                </div>
            </div>
            <div class="damage-track-legend" v-if="types && types.length">
                <span v-for="(t, i) in types" :key="t" class="damage-legend-item">
                    <span :style="{ color: getColor(i + 1) }">{{ boxSymbol(t) }}</span> {{ t }}
                </span>
            </div>
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
