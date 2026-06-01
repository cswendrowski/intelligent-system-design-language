import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';

export default function generateRollVisualizerComponent(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `roll-visualizer.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, watch, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            icon: String,
            color: String,
            systemPath: String,
            context: Object,
            // The Foundry roll formula (may contain @refs), compiled from the field's value: expression.
            formula: { type: String, default: "" },
            // Data object resolving the @refs, bound from the live (reactive) document/prompt data.
            rollData: { type: Object, default: () => ({}) }
        });

        // ----- Distribution engine ---------------------------------------------------
        // For purely additive dice formulas (dice + constants, +/- only, no dice
        // modifiers) we compute the EXACT probability distribution by convolution.
        // Anything more exotic (keep-highest/lowest, exploding, rerolls, multiplied
        // dice, fate dice, pools, functions) falls back to Monte Carlo simulation.

        // A distribution is a Map<outcomeValue, probability>.
        const dieDist = (faces) => {
            const m = new Map();
            for (let f = 1; f <= faces; f++) m.set(f, 1 / faces);
            return m;
        };
        const convolve = (a, b) => {
            const out = new Map();
            for (const [va, pa] of a) {
                for (const [vb, pb] of b) {
                    const v = va + vb;
                    out.set(v, (out.get(v) || 0) + pa * pb);
                }
            }
            return out;
        };
        const negate = (a) => {
            const m = new Map();
            for (const [v, p] of a) m.set(-v, p);
            return m;
        };
        const shift = (a, k) => {
            const m = new Map();
            for (const [v, p] of a) m.set(v + k, p);
            return m;
        };

        // Classify a Foundry roll term. Foundry does not minify these class names in
        // either v12 or v13, so constructor.name is a reliable signal.
        const classify = (term) => {
            const n = term?.constructor?.name;
            if (n === "Die") return "die";
            if (n === "NumericTerm") return "num";
            if (n === "OperatorTerm") return "op";
            return "other";
        };

        // Decide whether a parsed roll can be solved exactly. Guard the convolution
        // against pathological sizes (huge dice pools) by falling back to simulation.
        const MAX_BUCKETS = 5000;
        const canConvolve = (terms) => {
            let minTotal = 0, maxTotal = 0;
            for (const term of terms) {
                const kind = classify(term);
                if (kind === "op") {
                    if (term.operator !== "+" && term.operator !== "-") return false;
                    continue;
                }
                if (kind === "die") {
                    if (Array.isArray(term.modifiers) && term.modifiers.length > 0) return false;
                    const number = Number(term.number);
                    const faces = Number(term.faces);
                    if (!Number.isInteger(number) || !Number.isInteger(faces) || faces < 1 || number < 0) return false;
                    minTotal += number;
                    maxTotal += number * faces;
                    continue;
                }
                if (kind === "num") {
                    if (!Number.isFinite(Number(term.number))) return false;
                    continue;
                }
                return false; // unknown term type
            }
            return (maxTotal - minTotal) <= MAX_BUCKETS;
        };

        // Build the exact PMF for an additive term list.
        const convolveTerms = (terms) => {
            let acc = new Map([[0, 1]]);
            let sign = 1;
            for (const term of terms) {
                const kind = classify(term);
                if (kind === "op") {
                    sign = term.operator === "-" ? -1 : 1;
                    continue;
                }
                if (kind === "die") {
                    let dist = new Map([[0, 1]]);
                    for (let i = 0; i < Number(term.number); i++) dist = convolve(dist, dieDist(Number(term.faces)));
                    if (sign < 0) dist = negate(dist);
                    acc = convolve(acc, dist);
                }
                else if (kind === "num") {
                    acc = shift(acc, sign * Number(term.number));
                }
                sign = 1;
            }
            return acc;
        };

        // Reduce a sample array (simulation fallback) to a PMF.
        const samplesToDist = (samples) => {
            const counts = new Map();
            for (const s of samples) counts.set(s, (counts.get(s) || 0) + 1);
            const dist = new Map();
            for (const [v, c] of counts) dist.set(v, c / samples.length);
            return dist;
        };

        // Derive the display payload (average, min, max, chart series) from a PMF.
        const summarize = (dist, approximate) => {
            const entries = [...dist.entries()].sort((a, b) => a[0] - b[0]);
            let average = 0, min = Infinity, max = -Infinity;
            for (const [v, p] of entries) {
                average += v * p;
                if (v < min) min = v;
                if (v > max) max = v;
            }
            let labels = entries.map(([v]) => v);
            let values = entries.map(([, p]) => +(p * 100).toFixed(2));
            // Keep the sparkline legible: thin labels (not data) when there are many buckets.
            const labelStride = Math.ceil(labels.length / 20);
            const displayLabels = labelStride > 1 ? labels.map((l, i) => (i % labelStride === 0 ? l : "")) : labels;
            return {
                average: +average.toFixed(2),
                min: entries.length ? min : 0,
                max: entries.length ? max : 0,
                labels: displayLabels,
                values,
                approximate,
                hasData: entries.length > 0
            };
        };

        // ----- Reactive computation --------------------------------------------------

        const result = ref({ average: 0, min: 0, max: 0, labels: [], values: [], approximate: false, hasData: false });
        const iterations = ref(0);
        let runToken = 0;

        const runSimulation = async (formula, token) => {
            // Accumulate batches into one running sample set instead of discarding the
            // first pass, and re-render after each batch so the curve sharpens in place.
            const batches = [2000, 8000, 20000];
            let samples = [];
            for (const batch of batches) {
                if (token !== runToken) return; // a newer run superseded us
                const next = await Roll.simulate(formula, batch);
                samples = samples.concat(next);
                if (token !== runToken) return;
                iterations.value = samples.length;
                result.value = summarize(samplesToDist(samples), true);
            }
        };

        const recompute = () => {
            const token = ++runToken;
            const raw = (props.formula || "").trim();
            if (!raw) {
                result.value = { average: 0, min: 0, max: 0, labels: [], values: [], approximate: false, hasData: false };
                return;
            }
            let roll;
            try {
                roll = new Roll(raw, props.rollData || {});
            }
            catch (e) {
                result.value = { average: 0, min: 0, max: 0, labels: [], values: [], approximate: false, hasData: false };
                return;
            }
            // After construction Foundry has substituted @refs into the terms.
            const terms = roll.terms || [];
            if (canConvolve(terms)) {
                iterations.value = 0;
                result.value = summarize(convolveTerms(terms), false);
            }
            else {
                // Simulate against the resolved formula (no @refs remain in roll.formula).
                runSimulation(roll.formula, token);
            }
        };

        // Debounce so rapid field edits don't kick off redundant simulations.
        let debounceHandle = null;
        watch(
            () => [props.formula, JSON.stringify(props.rollData || {})],
            () => {
                if (debounceHandle) clearTimeout(debounceHandle);
                debounceHandle = setTimeout(recompute, 200);
            },
            { immediate: true }
        );

        const getLabel = computed(() => {
            const localized = game.i18n.localize(props.label);
            if (props.icon) return \`<i class="fa-solid \${props.icon}"></i> \${localized}\`;
            return localized;
        });
        const accentColor = computed(() => props.color || "#92aed9");
        const averageText = computed(() => (result.value.approximate ? "≈ " : "") + result.value.average);
    </script>

    <template>
        <v-card class="isdl-roll-visualizer" :name="systemPath" variant="tonal" density="compact">
            <div class="isdl-roll-visualizer__header">
                <span class="isdl-roll-visualizer__label" v-html="getLabel"></span>
                <span class="isdl-roll-visualizer__avg" :style="{ color: accentColor }">{{ averageText }}</span>
            </div>
            <v-sparkline
                v-if="result.hasData"
                :labels="result.labels"
                :model-value="result.values"
                :color="accentColor"
                line-width="2"
                padding="8"
                smooth="6"
                :label-size="5"
                auto-draw
                preserveAspectRatio="none"
            ></v-sparkline>
            <div v-else class="isdl-roll-visualizer__empty text-caption">
                {{ game.i18n.localize("ROLLVISUALIZER.NoFormula") }}
            </div>
            <div class="isdl-roll-visualizer__footer text-caption">
                <span v-if="result.hasData">
                    {{ game.i18n.localize("ROLLVISUALIZER.Min") }}: {{ result.min }}
                    &middot;
                    {{ game.i18n.localize("ROLLVISUALIZER.Max") }}: {{ result.max }}
                    &middot;
                    {{ game.i18n.localize("ROLLVISUALIZER.Average") }}: {{ averageText }}
                </span>
                <span v-if="result.approximate && iterations > 0" class="isdl-roll-visualizer__approx">
                    ({{ iterations }} {{ game.i18n.localize("ROLLVISUALIZER.Simulations") }})
                </span>
            </div>
        </v-card>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
