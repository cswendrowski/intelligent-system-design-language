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
        async function _openDesignMode(doc, btn) {
            // TODO: mount Vue design mode overlay (step 2)
            ui.notifications?.info("Design Mode coming soon!");
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
