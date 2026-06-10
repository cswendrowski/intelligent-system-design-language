import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Entry } from '../../language/generated/ast.js';
import {
    isConfigExpression, isSection, isAction, isFunctionDefinition, isHookHandler,
    isStatusProperty, isPinnedField, isActor, isItem,
    isAttributeExp, isResourceExp, isTrackerExp, isNumberExp, isStringExp,
    isBooleanExp, isHtmlExp, isDamageTrackExp, isTableField, isInventoryField,
    isDamageBonusesField, isDamageResistancesField, isImageField, isPaperDollExp,
    isRollVisualizerField, isDateExp, isDateTimeExp, isTimeExp, isDiceField, isDieField,
    isDocumentChoiceExp, isDocumentChoicesExp, isSingleDocumentExp,
    isStringChoiceField, isStringChoicesField, isMoneyField, isMeasuredTemplateField,
    isMacroField, isDamageTypeChoiceField,
} from '../../language/generated/ast.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface FieldMeta {
    name: string;
    label: string;
    typeClass: string;
    width: number;
}

interface DocFieldMeta {
    name: string;
    fields: FieldMeta[];
}

interface DocCategory {
    actors: Record<string, DocFieldMeta>;
    items: Record<string, DocFieldMeta>;
}

export interface FieldPlacement {
    field: string;
    row: number;
    col: number;
    width: number;
    hideLabel?: boolean;
    color?: string;
    icon?: string;
}

export interface SystemLayout {
    version: number;
    actors: Record<string, FieldPlacement[]>;
    items: Record<string, FieldPlacement[]>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function humanizeFieldName(name: string): string {
    return name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        .replace(/^./, s => s.toUpperCase());
}

function getTypeLabel(el: unknown): string {
    if (isAttributeExp(el)) return 'attribute';
    if (isResourceExp(el)) return 'resource';
    if (isTrackerExp(el)) return 'tracker';
    if (isNumberExp(el)) return 'number';
    if (isStringExp(el)) return 'text';
    if (isBooleanExp(el)) return 'checkbox';
    if (isHtmlExp(el)) return 'html';
    if (isDamageTrackExp(el)) return 'damage-track';
    if (isTableField(el)) return 'table';
    if (isInventoryField(el)) return 'inventory';
    if (isSection(el)) return 'section';
    if (isAction(el)) return 'action';
    if (isFunctionDefinition(el)) return 'function';
    if (isHookHandler(el)) return 'hook';
    if (isStatusProperty(el)) return 'status';
    if (isPinnedField(el)) return 'pinned';
    if (isDamageBonusesField(el)) return 'bonuses';
    if (isDamageResistancesField(el)) return 'resistances';
    if (isImageField(el)) return 'image';
    if (isPaperDollExp(el)) return 'paperdoll';
    if (isRollVisualizerField(el)) return 'roll-viz';
    if (isDateExp(el)) return 'date';
    if (isDateTimeExp(el)) return 'datetime';
    if (isTimeExp(el)) return 'time';
    if (isDiceField(el)) return 'dice';
    if (isDieField(el)) return 'die';
    if (isDocumentChoiceExp(el)) return 'doc-choice';
    if (isDocumentChoicesExp(el)) return 'doc-choices';
    if (isSingleDocumentExp(el)) return 'document';
    if (isStringChoiceField(el)) return 'choice';
    if (isStringChoicesField(el)) return 'choices';
    if (isMoneyField(el)) return 'money';
    if (isMeasuredTemplateField(el)) return 'template';
    if (isMacroField(el)) return 'macro';
    if (isDamageTypeChoiceField(el)) return 'dmg-choice';
    return 'field';
}

function getDefaultWidth(typeClass: string): number {
    const FULL_WIDTH = new Set([
        'html', 'table', 'inventory', 'damage-track', 'roll-viz',
        'pinned', 'paperdoll', 'bonuses', 'resistances',
        'doc-choices', 'choices',
    ]);
    return FULL_WIDTH.has(typeClass) ? 12 : 6;
}

function extractDocMeta(entry: Entry): DocCategory {
    const actors: Record<string, DocFieldMeta> = {};
    const items: Record<string, DocFieldMeta> = {};

    function gatherFields(nodes: any[], seen: Set<string>): FieldMeta[] {
        const out: FieldMeta[] = [];
        for (const el of nodes) {
            if (isSection(el)) {
                out.push(...gatherFields((el as any).body ?? [], seen));
                continue;
            }
            if (el.name && !seen.has((el.name as string).toLowerCase())) {
                const typeClass = getTypeLabel(el);
                const skip = new Set(['field', 'function', 'hook', 'status']);
                if (!skip.has(typeClass)) {
                    const params: any[] = el.params ?? [];
                    const labelParam = params.find((p: any) => p.type === 'label' || p.$type === 'LabelParam') as any;
                    const label = labelParam?.value ?? humanizeFieldName(el.name as string);
                    const name = (el.name as string).toLowerCase();
                    seen.add(name);
                    out.push({ name, label, typeClass, width: getDefaultWidth(typeClass) });
                }
            }
        }
        return out;
    }

    for (const doc of entry.documents) {
        const seen = new Set<string>();
        const fields = gatherFields(doc.body as any[] ?? [], seen);
        const name = (doc.name as string);
        if (isActor(doc)) {
            actors[name.toLowerCase()] = { name, fields };
        } else if (isItem(doc)) {
            items[name.toLowerCase()] = { name, fields };
        }
    }

    return { actors, items };
}

// ── Public entry point ─────────────────────────────────────────────────────

export function generateDevModule(
    entry: Entry,
    id: string,
    devDest: string,
    layout: SystemLayout | null = null,
    layoutServerPort = 3721,
) {
    const scriptsDir = path.join(devDest, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
    }

    const title = (entry.config.body.find(x => isConfigExpression(x) && x.type === 'label') as any)?.value ?? id;
    const author = (entry.config.body.find(x => isConfigExpression(x) && x.type === 'author') as any)?.value ?? '';

    const docMeta = extractDocMeta(entry);
    const fieldMetaJson = JSON.stringify(docMeta, null, 4);
    const embeddedLayoutJson = layout ? JSON.stringify(layout) : 'null';

    generateModuleJson(id, title, author, devDest);
    generateDevTools(id, title, devDest, fieldMetaJson, embeddedLayoutJson, layoutServerPort);
}

function generateModuleJson(id: string, title: string, author: string, devDest: string) {
    const filePath = path.join(devDest, 'module.json');
    const fileNode = expandToNode`
        {
            "id": "${id}-dev",
            "title": "${title} — Dev Tools",
            "description": "Developer companion module for ${title}. Install locally; never distribute to players.",
            "version": "dev",
            "compatibility": {
                "minimum": 12,
                "verified": 14
            },
            "authors": [
                { "name": "${author}" }
            ],
            "esmodules": [
                "scripts/dev-tools.mjs"
            ],
            "relationships": {
                "systems": [
                    {
                        "id": "${id}",
                        "type": "system",
                        "reason": "Dev tools require the ${title} system to be active"
                    }
                ]
            }
        }
    `.appendNewLineIfNotEmpty();
    fs.writeFileSync(filePath, toString(fileNode));
}

function generateDevTools(
    id: string,
    title: string,
    devDest: string,
    fieldMetaJson: string,
    embeddedLayoutJson: string,
    layoutServerPort: number,
) {
    const filePath = path.join(devDest, 'scripts', 'dev-tools.mjs');
    const fileNode = expandToNode`
        // ${id}-dev — developer companion for ${title}
        // Regenerated on each build. Customise ${id}-custom.mjs instead.

        const MODULE_ID = "${id}-dev";
        const _LAYOUT_SERVER = "http://localhost:${layoutServerPort}";

        // ─── Embedded metadata (generated from ISDL AST) ───────────────────
        const FIELD_META = ${fieldMetaJson};
        const EMBEDDED_LAYOUT = ${embeddedLayoutJson};

        // ─── Vue DevTools ───────────────────────────────────────────────────
        if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
            window.__VUE_DEVTOOLS_GLOBAL_HOOK__.enabled = true;
        }

        // ─── Styles ─────────────────────────────────────────────────────────
        {
            const style = document.createElement("style");
            style.textContent = \`
                .isdl-dev-tooltip {
                    position: fixed;
                    background: #1a1a2e;
                    border: 1px solid #4a9eff;
                    border-radius: 4px;
                    padding: 6px 8px;
                    font-family: monospace;
                    font-size: 11px;
                    color: #e0e0e0;
                    box-shadow: 0 2px 8px rgba(0,0,0,.6);
                    pointer-events: auto;
                    min-width: 220px;
                    z-index: 10000;
                }
                .isdl-dev-section-header {
                    font-size: 10px;
                    font-weight: bold;
                    color: #c0d8f0;
                    border-bottom: 1px solid #2a3a5a;
                    padding-bottom: 3px;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .isdl-dev-section-hint {
                    font-weight: normal;
                    font-size: 9px;
                    color: #6a8aaa;
                    margin-left: auto;
                }
                .isdl-dev-label {
                    font-size: 9px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #6a8aaa;
                    margin-top: 5px;
                    margin-bottom: 1px;
                }
                .isdl-dev-label:first-child { margin-top: 0; }
                .isdl-dev-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 2px 0;
                }
                .isdl-dev-row i { color: #4a9eff; width: 14px; text-align: center; }
                .isdl-dev-row code { flex: 1; font-size: 10px; color: #a0cfff; word-break: break-all; }
                .isdl-dev-copy {
                    background: none;
                    border: 1px solid #4a9eff;
                    border-radius: 2px;
                    color: #4a9eff;
                    cursor: pointer;
                    padding: 1px 5px;
                    font-size: 10px;
                    line-height: 1.4;
                }
                .isdl-dev-copy:hover { background: #4a9eff; color: #1a1a2e; }
                .isdl-inspector { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
                .isdl-inspector-hint { font-size: 12px; color: #888; margin: 0; }
                .isdl-inspector-hint code { font-size: 11px; background: #eee; padding: 1px 3px; border-radius: 2px; }
                .isdl-inspector-copy-all { align-self: flex-end; cursor: pointer; }
                .isdl-inspector-pre {
                    max-height: 420px;
                    overflow: auto;
                    font-size: 11px;
                    font-family: monospace;
                    background: #1a1a2e;
                    color: #a0cfff;
                    padding: 10px;
                    border-radius: 4px;
                    margin: 0;
                    white-space: pre;
                    line-height: 1.5;
                }
                .isdl-dm-overlay {
                    position: absolute; inset: 0; background: #10141e; z-index: 50;
                    display: flex; flex-direction: column; overflow: hidden;
                    font-family: var(--font-primary, sans-serif);
                }
                .isdl-dm-toolbar {
                    display: flex; align-items: center; gap: 8px; padding: 5px 10px;
                    background: #0a0e18; border-bottom: 1px solid #2a4a8a;
                    flex-shrink: 0; font-size: 12px; font-weight: bold; color: #c0d8f0;
                }
                .isdl-dm-toolbar-title { flex: 1; }
                .isdl-dm-doc-badge {
                    font-size: 10px; background: #1a2a5a; color: #6a9aff;
                    padding: 1px 6px; border-radius: 2px; font-weight: normal;
                }
                .isdl-dm-toolbar button {
                    background: #1a2a4a; border: 1px solid #4a7aff; border-radius: 3px;
                    color: #a0c8ff; cursor: pointer; padding: 3px 10px; font-size: 11px;
                }
                .isdl-dm-toolbar button.save { background: #0e2a1a; border-color: #2aaa5a; color: #80d8a0; }
                .isdl-dm-toolbar button:hover { filter: brightness(1.3); }
                .isdl-dm-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
                .isdl-dm-body { display: flex; flex: 1; min-height: 0; }
                .isdl-dm-grid-wrap {
                    flex: 1; overflow-y: auto; padding: 8px;
                    display: flex; flex-direction: column; gap: 6px;
                }
                .isdl-dm-row {
                    display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px;
                    background: rgba(255,255,255,0.02); border-radius: 3px; padding: 4px; min-height: 32px;
                }
                .isdl-dm-cell {
                    border: 2px solid transparent; border-radius: 3px; cursor: pointer;
                    background: rgba(255,255,255,0.04); overflow: hidden; min-height: 34px;
                    transition: border-color 0.1s;
                }
                .isdl-dm-cell:hover { border-color: #3a6aaa; }
                .isdl-dm-cell.selected { border-color: #4a9eff; background: rgba(74,158,255,0.07); }
                .isdl-dm-cell.drag-over { border-color: #ffaa4a; background: rgba(255,170,74,0.07); }
                .isdl-dm-cell-header {
                    display: flex; align-items: center; gap: 3px; padding: 2px 4px;
                    background: rgba(0,0,0,0.3); font-size: 10px; color: #7a9ab8;
                }
                .isdl-dm-cell-header i { cursor: grab; color: #4a6a8a; font-size: 9px; }
                .isdl-dm-cell-header > span:first-of-type { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .isdl-dm-type-badge { background: #1a2a5a; color: #6a9aff; border-radius: 2px; padding: 0 3px; font-size: 9px; flex-shrink: 0; }
                .isdl-dm-width-badge { background: #1a2a2a; color: #4a9a8a; border-radius: 2px; padding: 0 3px; font-size: 9px; flex-shrink: 0; }
                .isdl-dm-cell-preview { padding: 2px; pointer-events: none; overflow: hidden; }
                .isdl-dm-placeholder {
                    padding: 4px; font-size: 10px; color: #4a6a8a; text-align: center;
                    border: 1px dashed #2a4a6a; border-radius: 2px; margin: 2px;
                }
                .isdl-dm-empty {
                    color: #4a6a8a; font-size: 12px; padding: 16px; text-align: center;
                    border: 1px dashed #2a4a6a; border-radius: 4px;
                }
                .isdl-dm-panel {
                    width: 210px; flex-shrink: 0; border-left: 1px solid #1a2a4a; padding: 10px;
                    overflow-y: auto; background: #0a0e18; display: flex; flex-direction: column; gap: 8px;
                }
                .isdl-dm-panel-title { font-weight: bold; color: #c0d8f0; font-size: 12px; }
                .isdl-dm-panel label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #7a9ab8; }
                .isdl-dm-panel .row-flex { flex-direction: row !important; align-items: center; gap: 6px; }
                .isdl-dm-panel input[type=range] { width: 100%; cursor: pointer; }
                .isdl-dm-panel input[type=color] { width: 36px; height: 22px; border: none; cursor: pointer; border-radius: 2px; }
                .isdl-dm-panel input[type=text] {
                    width: 100%; background: #1a2a4a; border: 1px solid #2a4a8a;
                    color: #a0c8ff; border-radius: 2px; padding: 2px 4px; font-size: 11px;
                }
                .isdl-dm-panel button {
                    background: #1a2a4a; border: 1px solid #2a4a8a; color: #a0c8ff;
                    cursor: pointer; padding: 2px 8px; border-radius: 2px; font-size: 11px;
                }
                .isdl-dm-remove-cell {
                    background: #2a1010 !important; border-color: #6a2a2a !important;
                    color: #f07070 !important; margin-top: 4px; padding: 5px !important;
                }
                .isdl-dm-remove-cell:hover { background: #3a1818 !important; }
                .isdl-dm-root.saving { opacity: 0.7; pointer-events: none; }
            \`;
            document.head.appendChild(style);
        }

        // ─── Tooltip helpers ────────────────────────────────────────────────
        let _devTip = null;

        function _makeRow(iconClass, label, value) {
            return \`
                <div class="isdl-dev-label">\${label}</div>
                <div class="isdl-dev-row">
                    <i class="\${iconClass}"></i>
                    <code>\${value}</code>
                    <button type="button" class="isdl-dev-copy" data-copy="\${value}" title="Copy">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            \`;
        }

        function _showDevTooltip(el, systemPath, typeSelector, nameSelector) {
            _hideDevTooltip();
            const tip = document.createElement("div");
            tip.className = "isdl-dev-tooltip";
            tip.innerHTML =
                \`<div class="isdl-dev-section-header">
                    <i class="fa-solid fa-database"></i> Data Path
                    <span class="isdl-dev-section-hint">for macros &amp; scripts</span>
                </div>\` +
                _makeRow("fa-solid fa-folder-open", "system path", systemPath) +
                \`<div class="isdl-dev-section-header" style="margin-top:8px">
                    <i class="fa-solid fa-paintbrush"></i> CSS Selectors
                    <span class="isdl-dev-section-hint">for custom.css</span>
                </div>\` +
                (typeSelector ? _makeRow("fa-solid fa-layer-group", "all fields of this type", typeSelector) : "") +
                (nameSelector ? _makeRow("fa-solid fa-crosshairs", "just this field", nameSelector) : "");
            tip.querySelectorAll(".isdl-dev-copy").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
                        const icon = btn.querySelector("i");
                        icon.className = "fa-solid fa-check";
                        setTimeout(() => icon.className = "fa-solid fa-copy", 1500);
                    });
                });
            });
            const rect = el.getBoundingClientRect();
            tip.style.top = (rect.bottom + 4) + "px";
            tip.style.left = rect.left + "px";
            document.body.appendChild(tip);
            _devTip = tip;
        }

        function _hideDevTooltip() {
            _devTip?.remove();
            _devTip = null;
        }

        function _buildCssSelectors(el) {
            const classes = [...el.classList];
            const nameClass = classes.find(c => /^isdl-field-[a-z]/.test(c));
            const typeClass = classes.find(c =>
                c.startsWith("isdl-") &&
                c !== "isdl-field" &&
                !c.startsWith("isdl-visibility-") &&
                !c.startsWith("isdl-field-")
            );
            return {
                typeSelector: typeClass ? \`.\${typeClass}\` : null,
                nameSelector: nameClass ? \`.\${nameClass}\` : null,
            };
        }

        // ─── System data inspector ──────────────────────────────────────────
        function _openInspector(doc) {
            const data = doc.system?.toObject?.() ?? doc.system ?? {};
            const json = JSON.stringify(data, null, 2);
            new Dialog({
                title: \`System Data — \${doc.name}\`,
                content: \`
                    <div class="isdl-inspector">
                        <p class="isdl-inspector-hint">
                            <i class="fa-solid fa-circle-info"></i>
                            Everything stored in <code>actor.system</code> for this document.
                        </p>
                        <button type="button" class="isdl-inspector-copy-all">
                            <i class="fa-solid fa-copy"></i> Copy all
                        </button>
                        <pre class="isdl-inspector-pre">\${json}</pre>
                    </div>
                \`,
                buttons: { close: { label: "Close" } },
                render: html => {
                    const root = html instanceof HTMLElement ? html : html?.[0];
                    root?.querySelector(".isdl-inspector-copy-all")?.addEventListener("click", () => {
                        navigator.clipboard.writeText(json).then(() => {
                            const btn = root.querySelector(".isdl-inspector-copy-all");
                            if (btn) {
                                btn.innerHTML = \`<i class="fa-solid fa-check"></i> Copied!\`;
                                setTimeout(() => { btn.innerHTML = \`<i class="fa-solid fa-copy"></i> Copy all\`; }, 1500);
                            }
                        });
                    });
                }
            }).render(true);
        }

        // ─── Design Mode ────────────────────────────────────────────────────
        let _dmApp = null;
        let _dmMountEl = null;
        let _dmAssets = null;

        async function _loadDmAssets() {
            if (_dmAssets) return _dmAssets;
            const [vueModule, vuetifyModule, compsModule] = await Promise.all([
                import("/systems/${id}/lib/vue.esm-browser.js"),
                import("/systems/${id}/lib/vuetify.esm.js"),
                import("/systems/${id}/system/sheets/vue/components/components.vue.es.mjs")
            ]);
            _dmAssets = { vue: vueModule, vuetify: vuetifyModule, comps: compsModule };
            return _dmAssets;
        }

        const _DM_TYPE_MAP = {
            "attribute": "i-attribute", "resource": "i-resource", "tracker": "i-tracker",
            "number": "i-number", "text": "i-text-field", "checkbox": "i-boolean",
            "html": "i-prosemirror", "damage-track": "i-damage-track", "inventory": "i-inventory",
            "bonuses": "i-bonuses", "resistances": "i-resistances", "image": "i-image",
            "paperdoll": "i-paperdoll", "roll-viz": "i-roll-visualizer",
            "date": "i-datetime", "datetime": "i-datetime", "time": "i-datetime",
            "dice": "i-dice", "die": "i-die", "doc-choice": "i-extended-choice",
            "choice": "i-string-choice", "choices": "i-string-choices",
            "money": "i-money", "template": "i-measured-template", "macro": "i-macro",
            "dmg-choice": "i-extended-choice",
        };

        function _dmBuildRows(docMeta, existingPlacements) {
            const fields = docMeta.fields;
            if (!existingPlacements || existingPlacements.length === 0) {
                const rows = [];
                let currentRow = [], currentWidth = 0;
                for (const f of fields) {
                    if (currentWidth + f.width > 12 && currentRow.length > 0) {
                        rows.push(currentRow); currentRow = []; currentWidth = 0;
                    }
                    currentRow.push({ field: f.name, label: f.label, typeClass: f.typeClass, width: f.width, hideLabel: false, color: "", icon: "" });
                    currentWidth += f.width;
                }
                if (currentRow.length > 0) rows.push(currentRow);
                return rows;
            }
            const fieldMap = Object.fromEntries(fields.map(f => [f.name, f]));
            const maxRow = existingPlacements.reduce((m, p) => Math.max(m, p.row), 0);
            const rows = [];
            for (let r = 0; r <= maxRow; r++) {
                const row = existingPlacements
                    .filter(p => p.row === r)
                    .sort((a, b) => a.col - b.col)
                    .map(p => {
                        const meta = fieldMap[p.field] ?? { name: p.field, label: p.field, typeClass: "field", width: p.width };
                        return { field: p.field, label: meta.label, typeClass: meta.typeClass, width: p.width, hideLabel: !!p.hideLabel, color: p.color ?? "", icon: p.icon ?? "" };
                    });
                if (row.length > 0) rows.push(row);
            }
            return rows;
        }

        function _dmRowsToPlacements(rows) {
            const out = [];
            for (let ri = 0; ri < rows.length; ri++) {
                let col = 0;
                for (const cell of rows[ri]) {
                    const p = { field: cell.field, row: ri, col, width: cell.width };
                    if (cell.hideLabel) p.hideLabel = true;
                    if (cell.color) p.color = cell.color;
                    if (cell.icon) p.icon = cell.icon;
                    out.push(p);
                    col += cell.width;
                }
            }
            return out;
        }

        async function _openDesignMode(doc, btn) {
            if (_dmApp) {
                _dmApp.unmount(); _dmApp = null;
                _dmMountEl?.remove(); _dmMountEl = null;
                btn.classList.remove("active");
                return;
            }
            btn.classList.add("active");

            let assets;
            try { assets = await _loadDmAssets(); }
            catch (err) {
                btn.classList.remove("active");
                console.error("[" + MODULE_ID + "] Failed to load assets:", err);
                ui.notifications?.error("Design Mode: failed to load assets — see console.");
                return;
            }

            const { createApp, ref, reactive, computed } = assets.vue;
            const Vuetify = assets.vuetify;
            const Comps = assets.comps;

            const sheetApp = Object.values(ui.windows).find(w =>
                (w.actor ?? w.document) === doc || (w.item ?? w.document) === doc
            );
            if (!sheetApp) { btn.classList.remove("active"); return ui.notifications?.warn("[isdl-dev] Sheet not found."); }
            const sheetEl = sheetApp.element instanceof HTMLElement ? sheetApp.element : sheetApp.element?.[0];
            const windowContent = sheetEl?.querySelector(".window-content") ?? sheetEl;
            if (!windowContent) { btn.classList.remove("active"); return; }

            const docType = doc.documentName === "Actor" ? "actors" : "items";
            const docKey = (doc.type ?? "").toLowerCase();
            const docMeta = FIELD_META[docType]?.[docKey];
            if (!docMeta) {
                btn.classList.remove("active");
                return ui.notifications?.warn(\`[isdl-dev] No FIELD_META for \${docType}/\${docKey}\`);
            }

            const existingPlacements = EMBEDDED_LAYOUT?.[docType]?.[docKey] ?? [];
            const initRows = _dmBuildRows(docMeta, existingPlacements);

            _dmMountEl = document.createElement("div");
            _dmMountEl.className = "isdl-dm-overlay";
            windowContent.style.position = "relative";
            windowContent.appendChild(_dmMountEl);

            const docContext = { object: doc, isEditable: false, isOwner: doc.isOwner ?? true };

            const dmComponent = {
                setup() {
                    const rows = reactive(initRows.map(r => r.map(c => Object.assign({}, c))));
                    const selected = ref(null);
                    const saving = ref(false);
                    const dragSrc = ref(null);
                    const dragOverCell = ref(null);

                    const selectedCell = computed(() =>
                        selected.value ? rows[selected.value.ri]?.[selected.value.ci] : null
                    );

                    function cellStyle(cell) { return { gridColumn: "span " + cell.width }; }
                    function getComp(tc) { return _DM_TYPE_MAP[tc] ?? null; }
                    function isSelected(ri, ci) { return selected.value?.ri === ri && selected.value?.ci === ci; }
                    function isDragOver(ri, ci) { return dragOverCell.value?.ri === ri && dragOverCell.value?.ci === ci; }
                    function clearSelection() { selected.value = null; }

                    function select(ri, ci, e) {
                        e.stopPropagation();
                        selected.value = isSelected(ri, ci) ? null : { ri, ci };
                    }

                    function onDragStart(e, ri, ci) {
                        dragSrc.value = { ri, ci };
                        e.dataTransfer.effectAllowed = "move";
                    }
                    function onDragOver(e, ri, ci) {
                        e.preventDefault();
                        dragOverCell.value = { ri, ci };
                    }
                    function onDragLeave() { dragOverCell.value = null; }
                    function onDrop(e, ri, ci) {
                        e.preventDefault();
                        dragOverCell.value = null;
                        const src = dragSrc.value;
                        dragSrc.value = null;
                        if (!src || (src.ri === ri && src.ci === ci)) return;
                        const [cell] = rows[src.ri].splice(src.ci, 1);
                        const srcWasEmpty = rows[src.ri].length === 0;
                        if (srcWasEmpty) rows.splice(src.ri, 1);
                        let dRi = ri, dCi = ci;
                        if (srcWasEmpty && src.ri < ri) dRi--;
                        if (src.ri === ri && src.ci < ci) dCi--;
                        dRi = Math.min(Math.max(0, dRi), rows.length);
                        if (dRi === rows.length) { rows.push([cell]); selected.value = null; return; }
                        const targetRow = rows[dRi];
                        targetRow.splice(Math.min(Math.max(0, dCi), targetRow.length), 0, cell);
                        selected.value = null;
                    }

                    function removeSelected() {
                        if (!selected.value) return;
                        const { ri, ci } = selected.value;
                        rows[ri].splice(ci, 1);
                        if (rows[ri].length === 0) rows.splice(ri, 1);
                        selected.value = null;
                    }

                    async function saveLayout() {
                        saving.value = true;
                        const placements = _dmRowsToPlacements(rows);
                        const layout = EMBEDDED_LAYOUT
                            ? JSON.parse(JSON.stringify(EMBEDDED_LAYOUT))
                            : { version: 1, actors: {}, items: {} };
                        if (!layout[docType]) layout[docType] = {};
                        layout[docType][docKey] = placements;
                        try {
                            const resp = await fetch(_LAYOUT_SERVER + "/layout", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: "${id}", layout })
                            });
                            const result = await resp.json();
                            if (result.ok) ui.notifications.info("Layout saved — regenerate system to apply.");
                            else ui.notifications.error("Save failed: " + (result.error ?? "unknown"));
                        } catch (err) {
                            ui.notifications.error("Layout server error: " + err.message);
                        } finally {
                            saving.value = false;
                        }
                    }

                    function close() {
                        if (_dmApp) { _dmApp.unmount(); _dmApp = null; }
                        _dmMountEl?.remove(); _dmMountEl = null;
                        btn.classList.remove("active");
                    }

                    return {
                        rows, selected, selectedCell, saving, docMeta, docType, docKey, docContext,
                        cellStyle, getComp, isSelected, isDragOver, clearSelection,
                        select, onDragStart, onDragOver, onDragLeave, onDrop,
                        removeSelected, saveLayout, close
                    };
                },
                template: \`
                    <div class="isdl-dm-root" :class="{saving: saving}" @click="clearSelection">
                        <div class="isdl-dm-toolbar">
                            <i class="fa-solid fa-pen-ruler"></i>
                            <span class="isdl-dm-toolbar-title">Design Mode — {{ docMeta.name }}</span>
                            <span class="isdl-dm-doc-badge">{{ docType }}/{{ docKey }}</span>
                            <button class="save" type="button" @click.stop="saveLayout" :disabled="saving">
                                <i class="fa-solid fa-floppy-disk"></i> {{ saving ? 'Saving...' : 'Save Layout' }}
                            </button>
                            <button type="button" @click.stop="close">
                                <i class="fa-solid fa-times"></i> Close
                            </button>
                        </div>
                        <div class="isdl-dm-body">
                            <div class="isdl-dm-grid-wrap" @click.stop>
                                <div v-if="rows.length === 0" class="isdl-dm-empty">No fields in layout.</div>
                                <div v-for="(row, ri) in rows" :key="ri" class="isdl-dm-row">
                                    <div
                                        v-for="(cell, ci) in row"
                                        :key="cell.field + '-' + ci"
                                        class="isdl-dm-cell"
                                        :class="{selected: isSelected(ri,ci), 'drag-over': isDragOver(ri,ci)}"
                                        :style="cellStyle(cell)"
                                        draggable="true"
                                        @dragstart="onDragStart($event,ri,ci)"
                                        @dragover="onDragOver($event,ri,ci)"
                                        @dragleave="onDragLeave"
                                        @drop="onDrop($event,ri,ci)"
                                        @click.stop="select(ri,ci,$event)"
                                    >
                                        <div class="isdl-dm-cell-header">
                                            <i class="fa-solid fa-grip-vertical"></i>
                                            <span>{{ cell.label }}</span>
                                            <span class="isdl-dm-type-badge">{{ cell.typeClass }}</span>
                                            <span class="isdl-dm-width-badge">{{ cell.width }}/12</span>
                                        </div>
                                        <div class="isdl-dm-cell-preview">
                                            <component
                                                v-if="getComp(cell.typeClass)"
                                                :is="getComp(cell.typeClass)"
                                                :label="cell.label"
                                                :systemPath="'system.' + cell.field"
                                                :context="docContext"
                                                :disabled="true"
                                                :color="cell.color || undefined"
                                                :icon="cell.icon || undefined"
                                            />
                                            <div v-else class="isdl-dm-placeholder">{{ cell.typeClass }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="isdl-dm-panel" v-if="selectedCell" @click.stop>
                                <div class="isdl-dm-panel-title">{{ selectedCell.label }}</div>
                                <span class="isdl-dm-type-badge" style="display:inline-block;margin-bottom:8px">{{ selectedCell.typeClass }}</span>
                                <label>
                                    Width {{ selectedCell.width }}/12
                                    <input type="range" min="1" max="12" :value="selectedCell.width" @input="selectedCell.width = +$event.target.value">
                                </label>
                                <label class="row-flex">
                                    <input type="checkbox" v-model="selectedCell.hideLabel"> Hide Label
                                </label>
                                <label>
                                    Color
                                    <div class="row-flex">
                                        <input type="color" :value="selectedCell.color || '#000000'" @input="selectedCell.color = $event.target.value">
                                        <button type="button" @click="selectedCell.color = ''">Clear</button>
                                    </div>
                                </label>
                                <label>
                                    Icon (FA class)
                                    <input type="text" :value="selectedCell.icon || ''" @input="selectedCell.icon = $event.target.value" placeholder="fas fa-star">
                                </label>
                                <button class="isdl-dm-remove-cell" type="button" @click="removeSelected">
                                    <i class="fa-solid fa-trash"></i> Remove from layout
                                </button>
                            </div>
                        </div>
                    </div>
                \`
            };

            const aliases = {
                collapse: "fas fa-chevron-up", complete: "fas fa-check", cancel: "fas fa-times-circle",
                close: "fas fa-times", delete: "fas fa-times-circle", clear: "fas fa-times-circle",
                success: "fas fa-check-circle", info: "fas fa-info-circle", warning: "fas fa-exclamation",
                error: "fas fa-exclamation-triangle", prev: "fas fa-chevron-left", next: "fas fa-chevron-right",
                checkboxOn: "fas fa-check-square", checkboxOff: "far fa-square",
                checkboxIndeterminate: "fas fa-minus-square", delimiter: "fas fa-circle",
                sortAsc: "fas fa-arrow-up", sortDesc: "fas fa-arrow-down", expand: "fas fa-chevron-down",
                menu: "fas fa-bars", subgroup: "fas fa-caret-down", dropdown: "fas fa-caret-down",
                radioOn: "far fa-dot-circle", radioOff: "far fa-circle", edit: "fas fa-edit",
                ratingEmpty: "far fa-star", ratingFull: "fas fa-star", ratingHalf: "fas fa-star-half",
                loading: "fas fa-sync", first: "fas fa-step-backward", last: "fas fa-step-forward",
                unfold: "fas fa-arrows-alt-v", file: "fas fa-paperclip", plus: "fas fa-plus",
                minus: "fas fa-minus", calendar: "fas fa-calendar",
                treeviewCollapse: "fas fa-caret-down", treeviewExpand: "fas fa-caret-right",
                eyeDropper: "fas fa-eye-dropper"
            };
            const fa = { component: Vuetify.components.VClassIcon };

            _dmApp = createApp(dmComponent);
            _dmApp.component("i-attribute", Comps.Attribute);
            _dmApp.component("i-resource", Comps.Resource);
            _dmApp.component("i-document-link", Comps.DocumentLink);
            _dmApp.component("i-prosemirror", Comps.ProseMirror);
            _dmApp.component("i-roll-visualizer", Comps.RollVisualizer);
            _dmApp.component("i-paperdoll", Comps.Paperdoll);
            _dmApp.component("i-calculator", Comps.Calculator);
            _dmApp.component("i-text-field", Comps.TextField);
            _dmApp.component("i-datetime", Comps.DateTime);
            _dmApp.component("i-tracker", Comps.Tracker);
            _dmApp.component("i-macro", Comps.MacroField);
            _dmApp.component("i-measured-template", Comps.MeasuredTemplateField);
            _dmApp.component("i-extended-choice", Comps.ExtendedChoiceField);
            _dmApp.component("i-dice", Comps.DiceField);
            _dmApp.component("i-bonuses", Comps.DamageBonuses);
            _dmApp.component("i-resistances", Comps.DamageResistances);
            _dmApp.component("i-boolean", Comps.BooleanField);
            _dmApp.component("i-die", Comps.DieField);
            _dmApp.component("i-string", Comps.StringMethodField);
            _dmApp.component("i-number", Comps.NumberField);
            _dmApp.component("i-string-choice", Comps.StringChoiceField);
            _dmApp.component("i-string-choices", Comps.StringChoicesField);
            _dmApp.component("i-money", Comps.MoneyField);
            _dmApp.component("i-inventory", Comps.Inventory);
            _dmApp.component("i-damage-track", Comps.DamageTrack);
            _dmApp.component("i-image", Comps.ImageField);

            const vuetify = Vuetify.createVuetify({
                icons: { defaultSet: "fa", aliases, sets: { fa } },
                components: { VNumberInput: Vuetify.components.VNumberInput }
            });
            _dmApp.use(vuetify);
            _dmApp.config.globalProperties.game = game;
            _dmApp.config.globalProperties.CONFIG = CONFIG;
            _dmApp.config.globalProperties.foundry = foundry;
            _dmApp.provide("rawDocument", doc);
            _dmApp.provide("rawSheet", null);
            _dmApp.mount(_dmMountEl);
        }

        // ─── Sheet overlay ──────────────────────────────────────────────────
        function _activateOverlays(doc, html) {
            const root = html instanceof HTMLElement ? html : html?.[0];
            if (!root) return;

            const header = root.querySelector(".window-header, .window-controls")
                ?? root.closest(".window-app, .application")?.querySelector(".window-header, .window-controls");

            // Inspector button
            if (header && !header.querySelector(".isdl-inspector-btn")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-inspector-btn header-control fa-solid fa-magnifying-glass";
                btn.setAttribute("aria-label", "Inspect System Data");
                btn.setAttribute("data-tooltip", "Inspect System Data");
                btn.addEventListener("click", e => { e.preventDefault(); _openInspector(doc); });
                header.prepend(btn);
            }

            // Design Mode button — enabled only when layout server is reachable
            if (header && !header.querySelector(".isdl-design-mode-btn")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-design-mode-btn header-control fa-solid fa-pen-ruler";
                btn.setAttribute("aria-label", "Design Mode");
                btn.setAttribute("data-tooltip", "Design Mode — checking for VS Code layout server…");
                btn.disabled = true;
                btn.style.opacity = "0.4";
                header.prepend(btn);

                fetch(_LAYOUT_SERVER + "/status", { method: "GET" })
                    .then(r => r.ok ? r.json() : Promise.reject())
                    .then(() => {
                        btn.disabled = false;
                        btn.style.opacity = "";
                        btn.setAttribute("data-tooltip", "Design Mode");
                        btn.addEventListener("click", e => {
                            e.preventDefault();
                            _openDesignMode(doc, btn).catch(err => {
                                console.error("[" + MODULE_ID + "] Design Mode error:", err);
                            });
                        });
                    })
                    .catch(() => {
                        btn.setAttribute("data-tooltip", "Design Mode — start VS Code with your .isdl file to enable");
                    });
            }

            // System path + CSS selectors on hover for every rendered ISDL field
            root.querySelectorAll("[class*='isdl-']").forEach(el => {
                const input = el.querySelector("input[name^='system.'], select[name^='system.'], textarea[name^='system.']");
                if (!input) return;
                const systemPath = input.getAttribute("name");
                const { typeSelector, nameSelector } = _buildCssSelectors(el);
                el.addEventListener("mouseenter", () => _showDevTooltip(el, systemPath, typeSelector, nameSelector));
                el.addEventListener("mouseleave", _hideDevTooltip);
            });
        }

        // ─── Hooks ──────────────────────────────────────────────────────────
        Hooks.once("init", () => {
            console.group(\`[\${MODULE_ID}] init\`);
            console.log("system:", game.system);
            console.groupEnd();
        });

        Hooks.once("ready", () => {
            console.group(\`[\${MODULE_ID}] ready\`);
            console.log("actors:", game.actors?.size ?? 0);
            console.log("items:", game.items?.size ?? 0);
            console.groupEnd();
        });

        for (const hook of ["renderActorSheet", "renderActorSheetV2"]) {
            Hooks.on(hook, (app, html) => {
                const doc = app.actor ?? app.document;
                _activateOverlays(doc, html instanceof HTMLElement ? html : html?.[0] ?? app.element);
                console.log(\`[\${MODULE_ID}] \${hook}\`, doc?.name, doc?.system);
            });
        }

        for (const hook of ["renderItemSheet", "renderItemSheetV2"]) {
            Hooks.on(hook, (app, html) => {
                const doc = app.item ?? app.document;
                _activateOverlays(doc, html instanceof HTMLElement ? html : html?.[0] ?? app.element);
                console.log(\`[\${MODULE_ID}] \${hook}\`, doc?.name, doc?.system);
            });
        }

        Hooks.on("preUpdateActor", (actor, changes) => {
            console.log(\`[\${MODULE_ID}] preUpdateActor\`, actor.name, changes);
        });

        Hooks.on("preUpdateItem", (item, changes) => {
            console.log(\`[\${MODULE_ID}] preUpdateItem\`, item.name, changes);
        });
    `.appendNewLineIfNotEmpty();
    fs.writeFileSync(filePath, toString(fileNode));
}
