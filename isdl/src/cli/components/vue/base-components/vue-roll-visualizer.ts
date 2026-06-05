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
    <script>
        // Module-scoped cache (shared across all roll-visualizer instances for the page
        // session, and surviving sheet re-renders/re-opens). Keyed by the RESOLVED formula
        // (after @refs are substituted), so the same dice math -- especially the expensive
        // simulation path -- is only computed once. Cleared on page reload.
        const __rollVisualizerCache = new Map();
    </script>
    <script setup>
        import { ref, watch, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            icon: String,
            color: String,
            hideLabel: Boolean,
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

        // Derive the display payload (average, min, max, chart series) from a PMF.
        const summarize = (dist, approximate) => {
            const entries = [...dist.entries()].sort((a, b) => a[0] - b[0]);
            let average = 0, min = Infinity, max = -Infinity;
            for (const [v, p] of entries) {
                average += v * p;
                if (v < min) min = v;
                if (v > max) max = v;
            }
            const outcomeValues = entries.map(([v]) => v);
            const values = entries.map(([, p]) => +(p * 100).toFixed(2));
            // Thin the x-axis labels so they don't cluster/overlap: pick a "nice" step
            // (1, 2, 5, 10, ...) targeting ~8 labels, and only label outcomes that land on
            // a multiple of it -- so the axis reads in round numbers (5, 10, 15, 20 ...).
            const lo = outcomeValues.length ? outcomeValues[0] : 0;
            const hi = outcomeValues.length ? outcomeValues[outcomeValues.length - 1] : 0;
            const span = Math.max(1, hi - lo);
            const rawStep = span / 8;
            const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
            const norm = rawStep / pow;
            const niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
            const step = Math.max(1, Math.round(niceStep));
            return {
                average: +average.toFixed(2),
                min: entries.length ? min : 0,
                max: entries.length ? max : 0,
                labels: outcomeValues,
                values,
                step,
                approximate,
                hasData: entries.length > 0
            };
        };

        // ----- Reactive computation --------------------------------------------------

        const result = ref({ average: 0, min: 0, max: 0, labels: [], values: [], step: 1, approximate: false, hasData: false });
        const iterations = ref(0);
        let runToken = 0;

        // Monte Carlo fallback. Roll.simulate builds a full Roll per sample (~0.2ms each),
        // so a large batch blocks the main thread for seconds and freezes the sheet on
        // render. Instead, sample a modest target in small chunks and yield to the event
        // loop between each, refining the curve in place. The sheet stays responsive and
        // the chart fills in progressively.
        const SIM_TARGET = 2000;
        const SIM_CHUNK = 200;
        const runSimulation = async (formula, token, cacheKey) => {
            const counts = new Map();
            let done = 0;
            while (done < SIM_TARGET) {
                if (token !== runToken) return; // a newer run superseded us
                const n = Math.min(SIM_CHUNK, SIM_TARGET - done);
                const batch = await Roll.simulate(formula, n);
                if (token !== runToken) return;
                for (const v of batch) counts.set(v, (counts.get(v) || 0) + 1);
                done += n;
                const dist = new Map();
                for (const [v, c] of counts) dist.set(v, c / done);
                result.value = summarize(dist, true);
                iterations.value = done;
                // Yield so the browser can paint and handle input between chunks.
                await new Promise(r => setTimeout(r, 0));
            }
            // Cache the completed estimate so this formula isn't re-simulated later.
            __rollVisualizerCache.set(cacheKey, result.value);
        };

        const recompute = () => {
            const token = ++runToken;
            const raw = (props.formula || "").trim();
            if (!raw) {
                result.value = { average: 0, min: 0, max: 0, labels: [], values: [], step: 1, approximate: false, hasData: false };
                return;
            }
            let roll;
            try {
                roll = new Roll(raw, props.rollData || {});
            }
            catch (e) {
                result.value = { average: 0, min: 0, max: 0, labels: [], values: [], step: 1, approximate: false, hasData: false };
                return;
            }
            // Cache hit on the resolved formula -> reuse the result, no recompute.
            const cacheKey = roll.formula;
            const cached = __rollVisualizerCache.get(cacheKey);
            if (cached) {
                result.value = cached;
                iterations.value = cached.approximate ? SIM_TARGET : 0;
                return;
            }
            // After construction Foundry has substituted @refs into the terms.
            const terms = roll.terms || [];
            if (canConvolve(terms)) {
                iterations.value = 0;
                const summary = summarize(convolveTerms(terms), false);
                __rollVisualizerCache.set(cacheKey, summary);
                result.value = summary;
            }
            else {
                // Simulate against the resolved formula (no @refs remain in roll.formula).
                runSimulation(roll.formula, token, cacheKey);
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
                <span v-if="!props.hideLabel" class="isdl-roll-visualizer__label" v-html="getLabel"></span>
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
                :label-size="10"
                auto-draw
                preserveAspectRatio="none"
            >
                <!-- Render a label only on "nice" round outcomes; blank elsewhere so the
                     axis doesn't cluster and never falls back to showing the raw value. -->
                <template #label="item">
                    {{ Number(item.value) % result.step === 0 ? item.value : "" }}
                </template>
            </v-sparkline>
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
