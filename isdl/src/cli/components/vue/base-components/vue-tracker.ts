import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateTrackerComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `tracker.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject, watchEffect } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            visibility: String,
            editMode: Boolean,
            primaryColor: String,
            secondaryColor: String,
            tertiaryColor: String,
            trackerStyle: String,
            icon: String,
            hideMin: Boolean,
            disableMin: Boolean,
            disableValue: Boolean,
            disableMax: Boolean,
            segments: Number,
            isHealth: Boolean,
            isWounds: Boolean
        });

        const document = inject("rawDocument");

        const isHidden = computed(() => {
            if (props.visibility === "hidden") {
                return true;
            }
            if (props.visibility === "gmOnly") {
                return !game.user.isGM;
            }
            if (props.visibility === "secret") {
                const isGm = game.user.isGM;
                const isOwner = document.getUserLevel(game.user) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
                return !isGm && !isOwner;
            }
            if (props.visibility === "edit") {
                return !props.editMode;
            }
            if (props.visibility === "play") {
                return props.editMode;
            }

            // Default to visible
            return false;
        });

        const isDisabled = (type) => {
            const disabledStates = ["readonly", "locked"];
            if (disabledStates.includes(props.visibility)) {
                return true;
            }
            if (props.visibility === "gmEdit") {
                const isGm = game.user.isGM;
                const isEditMode = props.editMode;
                return !isGm && !isEditMode;
            }

            if (props.visibility === "unlocked") {
                return false;
            }
            
            // Default to enabled while in editMode
            if (type == "value") return false;
            return !props.editMode;
        };

        const min = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".min") ?? 0,
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".min", newValue)
        });

        const value = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".value"),
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".value", newValue)
        });

        const temp = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".temp") ?? 0,
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".temp", newValue)
        });

        const max = computed({
            get: () => foundry.utils.getProperty(props.context, props.systemPath + ".max") ?? 10000,
            set: (newValue) => foundry.utils.setProperty(props.context, props.systemPath + ".max", newValue)
        });

        const barMax = computed(() => {
            const totalValue = value.value + (temp.value ?? 0);
            if (totalValue > max.value) {
                return totalValue;
            }
            return max.value;
        });

        const circleValue = computed(() => {
            // We need to calculate the percentage of the value in relation to the min to max range
            const percentage = (value.value - min.value) / (max.value - min.value);
            return Math.round(percentage * 100);
        });

        const refill = () => value.value = max.value;
        const empty = () => value.value = 0;

        const filledIcon = computed(() => {
            if (!props.icon) return "fa-solid fa-star";
            return "fa-solid " + props.icon;
        });
        const emptyIcon = computed(() => {
            if (!props.icon) return "fa-regular fa-star";
            return "fa-regular " + props.icon;
        });
        
        const mainColor = computed(() => {
            // If this is health, use a scale of red (0) to green (max). Wounds should be reverse. Otherwise, use primary.
           
            if (props.isHealth) {
                const pct = (value.value - (min.value ?? 0)) / ((max.value ?? 0) - (min.value ?? 0));
                // Use the number === 0 logic for health
                const red = Math.round(255 * (1 - (pct / 2)));
                const green = Math.round(255 * pct);
                const blue = 0;
                return \`rgb(\${red}, \${green}, \${blue})\`;
            }
            if (props.isWounds) {
                const pct = (value.value - (min.value ?? 0)) / ((max.value ?? 0) - (min.value ?? 0));
                // Use the else logic for wounds  
                const red = Math.round(255 * (0.5 * pct));
                const green = Math.round(255 * (0.7 * pct));
                const blue = Math.round(255 * (0.5 + (pct / 2)));
                return \`rgb(\${red}, \${green}, \${blue})\`;
            }
            return props.primaryColor;
        });

        const expanded = ref(false);

        const expandIcon = computed(() => {
            return expanded.value ? "fa-solid fa-caret-up" : "fa-solid fa-caret-down";
        });

        const displayText = computed(() => {
            if (temp.value > 0) {
                return value.value + " / " + max.value + " (+" + temp.value + ")";
            }
            return value.value + " / " + max.value;
        });

        const circularText = computed(() => {
            return value.value + " / " + max.value;
        });

        const add = () => {
            if (props.disableValue || isDisabled('value')) return;
            if (value.value < max.value) {
                value.value++;
            }
        }

        const remove = () => {
            if (props.disableValue || isDisabled('value')) return;
            if (value.value > min.value) {
                value.value--;
            }
        }

        const getSegmentFill = (segmentIndex) => {
            const filled = value.value;
            const tempFilled = filled + (temp?.value ?? 0);
            const segmentStart = (segmentIndex - 1) * props.segments;
            const segmentEnd = segmentIndex * props.segments;

            const primaryFill = Math.min(Math.max(filled - segmentStart, 0), props.segments);
            const tempFill = Math.min(Math.max(tempFilled - segmentStart, 0), props.segments);

            const primaryPct = (primaryFill / props.segments) * 100;
            const tempPct = (tempFill / props.segments) * 100;

            const fill = \`linear-gradient(
                to right,
                \${mainColor.value} 0%,
                \${mainColor.value} \${primaryPct}%,
                \${props.tertiaryColor} \${primaryPct}%,
                \${props.tertiaryColor} \${tempPct}%,
                transparent \${tempPct}%
            )\`;

            const segmentLines = \`repeating-linear-gradient(
                to right,
                \${props.secondaryColor} 0,
                \${props.secondaryColor} 1px,
                transparent 1px,
                transparent calc(100% / \${props.segments})
            )\`;

            return \`\${segmentLines}, \${fill}\`;
        };

        const size = 100;
        const radius = size / 2 - 2;

        function describeSlice(index, total, r, center) {
            const anglePer = (2 * Math.PI) / total;
            const startAngle = anglePer * index - Math.PI / 2;
            const endAngle = startAngle + anglePer;

            const x1 = center + r * Math.cos(startAngle);
            const y1 = center + r * Math.sin(startAngle);
            const x2 = center + r * Math.cos(endAngle);
            const y2 = center + r * Math.sin(endAngle);

            const largeArcFlag = anglePer > Math.PI ? 1 : 0;

            return \`
                M \${center} \${center}
                L \${x1} \${y1}
                A \${r} \${r} 0 \${largeArcFlag} 1 \${x2} \${y2}
                Z
            \`;
        }

        const getLabel = computed(() => {
            const localized = game.i18n.localize(props.label);
            if (props.icon) {
                return \`<i class="fa-solid \${props.icon}"></i> \${localized}\`;
            }
            return localized;
        });
    </script>

    <template>
        <v-input v-model="value" :class="[trackerStyle, 'isdl-tracker']" v-if="!isHidden">
            <template #default>
                <v-field 
                    class="v-field--active"
                    density="compact"
                    variant="outlined"
                >
                    <template #label>
                        <span v-html="getLabel" />
                    </template>
                      <template #append-inner>
                        <v-icon
                            :icon="expandIcon"
                            @click.stop="expanded = !expanded"
                            class="v-select__menu-icon"
                        />
                    </template>
                    <div class="tracker-content flexcol">
                        <div class="d-flex tracker-inner-content">
                            <v-progress-linear
                                v-if="trackerStyle == 'bar'"
                                :height="18"
                                :color="mainColor"
                                bg-color="#92aed9"
                                rounded
                                :model-value="value"
                                min="0"
                                :data-tooltip="displayText"
                                :max="barMax"
                                :buffer-value="value + temp"
                                buffer-opacity="1"
                                :buffer-color="tertiaryColor"
                            >
                                <template v-slot:default>
                                    {{ displayText }}
                                </template>
                            </v-progress-linear>

                            <v-progress-circular 
                                v-if="trackerStyle == 'dial'"
                                :model-value="circleValue" 
                                :rotate="360" 
                                :size="100" 
                                :width="15" 
                                :data-tooltip="displayText"
                                :color="mainColor">
                                
                                <template v-slot:default> {{ circularText }} </template>
                            </v-progress-circular>

                            <div v-if="trackerStyle == 'icons'" class="d-flex flex-row" @click.stop="add" @contextmenu.prevent.stop="remove" style="overflow-x: auto; overflow-y: hidden;">
                                <v-icon v-if="value > 0" v-for="i in value" :key="i" :icon="filledIcon" :color="mainColor" style="margin-right: 0.25rem; width: 25px;" :data-tooltip="displayText" />
                                <v-icon v-if="temp > 0" v-for="i in temp" :key="i + value" :icon="filledIcon" :color="tertiaryColor" style="margin-right: 0.25rem; width: 25px;" :data-tooltip="displayText" />
                                <v-icon v-if="max - value - temp > 0" v-for="i in max - value - temp" :key="i + temp + value" :icon="emptyIcon" :color="secondaryColor" style="margin-right: 0.25rem; width: 25px;" :data-tooltip="displayText" />
                            </div>

                            <div v-if="trackerStyle == 'slashes'" class="d-flex flex-row" @click.stop="add" @contextmenu.prevent.stop="remove" style="overflow-x: scroll; padding-left: 0.5rem; padding-right: 0.5rem;">
                                <div
                                    v-for="i in barMax"
                                    :data-tooltip="displayText"
                                    :key="i"
                                    :style="{
                                        flex: 1,
                                        minWidth: '5px',
                                        flexShrink: 0,
                                        height: '30px',
                                        backgroundColor: i <= value ? mainColor : (i <= value + temp ? tertiaryColor : 'transparent'),
                                        border: i <= value ? 'none' : '2px solid ' + secondaryColor,
                                        transform: 'skewX(-20deg)',
                                        borderRadius: '2px',
                                        marginRight: '0.25rem'
                                    }"
                                />
                            </div>

                            <div v-if="trackerStyle == 'segmented'" class="d-flex flex-row" @click.stop="add" @contextmenu.prevent.stop="remove">
                                <div
                                    v-for="i in Math.ceil(barMax / segments)"
                                    :key="i"
                                    :data-tooltip="displayText"
                                    :style="{
                                        flex: 1,
                                        minWidth: '15px',
                                        flexShrink: 0,
                                        height: '30px',
                                        border: '2px solid ' + secondaryColor,
                                        borderRadius: '2px',
                                        marginRight: '0.25rem',
                                        background: getSegmentFill(i)
                                    }"
                                />
                            </div>

                            <svg
                                v-if="trackerStyle === 'clock'"
                                :width="size"
                                :height="size"
                                :viewBox="\`0 0 \${size} \${size}\`"
                                @click.stop="add"
                                @contextmenu.prevent.stop="remove"
                                :data-tooltip="displayText"
                                style="width: auto;"
                                >
                                <g v-for="i in barMax" :key="i">
                                    <path
                                        :d="describeSlice(i - 1, barMax, radius, size / 2)"
                                        :fill="i <= value ? mainColor : (i <= value + temp ? tertiaryColor: 'transparent')"
                                        :stroke="secondaryColor"
                                        stroke-width="2"
                                    />
                                </g>
                            </svg>

                            <v-number-input v-if="trackerStyle == 'plain'" v-model="value" :name="systemPath" :min="min" :max="max" :disabled="disabled" type="number" variant="outlined" density="compact" hide-details="true"></v-number-input>
                        </div>
                        <v-expand-transition>
                            <div v-show="expanded" style="margin-top: 1rem;">
                                <div class="d-flex flex-row">
                                    <v-number-input
                                        v-model="value"
                                        :name="systemPath + '.value'"
                                        label="Value"
                                        controlVariant="stacked"
                                        density="compact"
                                        variant="outlined"
                                        class="flex-grow-1 slim-number"
                                        style="min-width: 70px;"
                                        :hide-details="true"
                                        :tile="true"
                                        :disabled="isDisabled('value') || disableValue"
                                    />
                                    <v-number-input
                                        v-model="temp"
                                        :name="systemPath + '.temp'"
                                        label="Temp"
                                        controlVariant="stacked"
                                        density="compact"
                                        variant="outlined"
                                        class="flex-grow-1"
                                        style="min-width: 70px; margin-right: 0.5rem;"
                                        :hide-details="true"
                                        :tile="true"
                                        :disabled="isDisabled('value') || disableValue"
                                    />
                                    <v-btn size="small" icon="fa-solid fa-battery-empty" @click="empty" :disabled="isDisabled('value') || disableValue" data-tooltip="Empty" :color="secondaryColor" />
                                </div>
                                <div class="d-flex flex-row" style="margin-top: 1rem;">
                                    <v-number-input
                                        v-model="min"
                                        :name="systemPath + '.min'"
                                        label="Min"
                                        controlVariant="stacked"
                                        density="compact"
                                        variant="outlined"
                                        class="flex-grow-1 slim-number"
                                        style="min-width: 70px;"
                                        :hide-details="true"
                                        :tile="true"
                                        :disabled="isDisabled('min') || disableMin"
                                        v-if="!hideMin"
                                    />
                                    <v-number-input
                                        v-model="max"
                                        :name="systemPath + '.max'"
                                        label="Max"
                                        controlVariant="stacked"
                                        density="compact"
                                        variant="outlined"
                                        class="flex-grow-1"
                                        style="min-width: 70px; margin-right: 0.5rem;"
                                        :hide-details="true"
                                        :tile="true"
                                        :disabled="isDisabled('max') || disableMax"
                                    />
                                    <v-btn size="small" icon="fa-solid fa-battery-full" @click="refill" :disabled="isDisabled('value') || disableValue" data-tooltip="Refill" :color="secondaryColor" />
                                </div>
                            </div>
                        </v-expand-transition>
                    </div>
                </v-field>
            </template>
        </v-input>
    </template>
    `;
    fs.writeFileSync(generatedFilePath, toString(fileNode));
}