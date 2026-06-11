import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Entry } from '../../language/generated/ast.js';
import { isConfigExpression } from '../../language/generated/ast.js';
import { SystemLayoutV2, serializeLayoutTree } from './layout-model.js';

// ── Public entry point ─────────────────────────────────────────────────────

export function generateDevModule(
    entry: Entry,
    id: string,
    devDest: string,
    layout: SystemLayoutV2 | null = null,
    layoutServerPort = 3721,
) {
    const scriptsDir = path.join(devDest, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
    }

    const title = (entry.config.body.find(x => isConfigExpression(x) && x.type === 'label') as any)?.value ?? id;
    const author = (entry.config.body.find(x => isConfigExpression(x) && x.type === 'author') as any)?.value ?? '';

    const layoutTreeJson = JSON.stringify(serializeLayoutTree(entry, layout), null, 4);
    const savedLayoutJson = layout ? JSON.stringify(layout) : 'null';

    generateModuleJson(id, title, author, devDest);
    generateDevTools(id, title, devDest, layoutTreeJson, savedLayoutJson, layoutServerPort);
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
    layoutTreeJson: string,
    savedLayoutJson: string,
    layoutServerPort: number,
) {
    const filePath = path.join(devDest, 'scripts', 'dev-tools.mjs');
    const fileNode = expandToNode`
        // ${id}-dev — developer companion for ${title}
        // Regenerated on each build. Customise ${id}-custom.mjs instead.

        const MODULE_ID = "${id}-dev";
        const _LAYOUT_SERVER = "http://localhost:${layoutServerPort}";

        // ─── Embedded layout metadata (generated from ISDL AST + saved layout) ──
        const LAYOUT_TREE = ${layoutTreeJson};
        const SAVED_LAYOUT = ${savedLayoutJson};

        // ─── Vue DevTools ────────────────────────────────────────────────────
        if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
            window.__VUE_DEVTOOLS_GLOBAL_HOOK__.enabled = true;
        }

        // ─── Styles ──────────────────────────────────────────────────────────
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
                /* ── Design Mode decoration styles ── */
                .isdl-dm-active .v-application { flex: 1 1 auto; min-width: 0; }
                .isdl-dm-active .isdl-section:hover { outline: 1px dashed #3a6aaa; outline-offset: 1px; }
                .isdl-dm-active .isdl-field:hover { outline: 1px dashed #3a6aaa; outline-offset: 1px; }
                .isdl-dm-active .isdl-static:hover { outline: 1px dashed #3a6aaa; outline-offset: 1px; }
                /* 4c: Section roots need pointer-events:auto so dragover can fire on their padding/title.
                   Children inherit none so the section outline stays, but the field root re-enables its children
                   via the .isdl-field rule below so field-targeting still works correctly. */
                .isdl-dm-active .isdl-section { pointer-events: auto !important; cursor: pointer; }
                .isdl-dm-active .isdl-section * { pointer-events: none !important; }
                .isdl-dm-active .isdl-field { pointer-events: auto !important; cursor: pointer; }
                .isdl-dm-active .isdl-field * { pointer-events: none !important; }
                .isdl-dm-active .isdl-static { pointer-events: auto !important; cursor: pointer; }
                .isdl-dm-active .isdl-static * { pointer-events: none !important; }
                .isdl-dm-active [class*='isdl-container-'] { pointer-events: auto !important; cursor: pointer; }
                .isdl-dm-selected { outline: 2px solid #4a9eff !important; outline-offset: 1px; }
                .isdl-dm-drop-before { box-shadow: -3px 0 0 0 #ffaa4a !important; }
                .isdl-dm-drop-after { box-shadow: 3px 0 0 0 #ffaa4a !important; }
                .isdl-dm-drop-into { outline: 2px solid #ffaa4a !important; outline-offset: 1px; }
                /* ── Design Mode sidebar panel ── */
                .isdl-dm-panel {
                    width: 240px;
                    flex-shrink: 0;
                    border-left: 1px solid #1a2a4a;
                    background: #0a0e18;
                    display: flex;
                    flex-direction: column;
                    color: #c0d8f0;
                    font-family: var(--font-primary, sans-serif);
                    font-size: 12px;
                    /* #2 sticky pin: panel stays at top of the viewport regardless of whether
                       .window-content or an inner element is the scroll container.
                       100% (not 100vh): vh can exceed the scrollport, making the panel itself the
                       tallest child — and a sticky element taller than its scrollport can't pin. */
                    position: sticky;
                    top: 0;
                    align-self: flex-start;
                    height: 100%;
                    max-height: 100%;
                    overflow-y: auto;
                    /* Item 1: the v-app-bar is position:fixed z-index:1006 inside the v-application
                       (whose form root has z-index:101). Panel must exceed 1006 to paint over it. */
                    z-index: 1010;
                }
                .isdl-dm-panel-header {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 10px;
                    background: #0a0e18;
                    border-bottom: 1px solid #2a4a8a;
                    flex-shrink: 0;
                    font-size: 12px;
                    font-weight: bold;
                }
                .isdl-dm-panel-header-title { flex: 1; }
                .isdl-dm-doc-badge {
                    font-size: 10px;
                    background: #1a2a5a;
                    color: #6a9aff;
                    padding: 1px 6px;
                    border-radius: 2px;
                    font-weight: normal;
                }
                .isdl-dm-panel-body { padding: 12px 10px 10px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
                .isdl-dm-panel-hint { color: #6a8aaa; font-size: 11px; line-height: 1.4; }
                .isdl-dm-panel-note { color: #8a9aaa; font-size: 10px; font-style: italic; margin-top: 2px; }
                .isdl-dm-field-name { font-family: monospace; font-size: 11px; color: #a0cfff; background: #0e1a2e; padding: 1px 4px; border-radius: 2px; }
                .isdl-dm-type-badge {
                    display: inline-block;
                    background: #1a2a5a;
                    color: #6a9aff;
                    border-radius: 2px;
                    padding: 0 5px;
                    font-size: 10px;
                }
                .isdl-dm-section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #6a8aaa; margin-bottom: 2px; margin-top: 6px; }
                .isdl-dm-section-label:first-child { margin-top: 0; }
                .isdl-dm-size-row { display: flex; gap: 4px; }
                .isdl-dm-size-btn {
                    flex: 1;
                    background: #1a2a4a;
                    border: 1px solid #2a4a8a;
                    color: #a0c8ff;
                    cursor: pointer;
                    padding: 3px 0;
                    border-radius: 2px;
                    font-size: 11px;
                    text-align: center;
                }
                .isdl-dm-size-btn.active { background: #1a3a6a; border-color: #4a9eff; color: #ffffff; }
                .isdl-dm-size-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .isdl-dm-checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #a0c8ff; cursor: pointer; }
                .isdl-dm-color-row { display: flex; align-items: center; gap: 6px; }
                .isdl-dm-color-row input[type=color] { width: 36px; height: 22px; border: none; cursor: pointer; border-radius: 2px; background: none; }
                .isdl-dm-panel-btn {
                    background: #1a2a4a;
                    border: 1px solid #2a4a8a;
                    color: #a0c8ff;
                    cursor: pointer;
                    padding: 3px 8px;
                    border-radius: 2px;
                    font-size: 11px;
                }
                .isdl-dm-panel-btn:hover { filter: brightness(1.3); }
                .isdl-dm-panel-btn.save { background: #0e2a1a; border-color: #2aaa5a; color: #80d8a0; padding: 5px 8px; }
                .isdl-dm-panel-btn.danger { background: #2a1010; border-color: #6a2a2a; color: #f07070; }
                .isdl-dm-panel-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }
                .isdl-dm-move-row { display: flex; gap: 4px; }
                .isdl-dm-move-row .isdl-dm-panel-btn { flex: 1; }
                .isdl-dm-icon-input {
                    width: 100%;
                    background: #1a2a4a;
                    border: 1px solid #2a4a8a;
                    color: #a0c8ff;
                    border-radius: 2px;
                    padding: 3px 5px;
                    font-size: 11px;
                    box-sizing: border-box;
                }
                .isdl-dm-text-input {
                    width: 100%;
                    background: #1a2a4a;
                    border: 1px solid #2a4a8a;
                    color: #a0c8ff;
                    border-radius: 2px;
                    padding: 3px 5px;
                    font-size: 11px;
                    box-sizing: border-box;
                }
                /* ── Status row ── */
                .isdl-dm-status-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    background: #060910;
                    border-top: 1px solid #1a2a4a;
                    border-bottom: 1px solid #1a2a4a;
                    font-size: 10px;
                    color: #6a8aaa;
                    flex-shrink: 0;
                }
                .isdl-dm-status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #888;
                    flex-shrink: 0;
                }
                .isdl-dm-status-dot.ok { background: #2aaa5a; }
                .isdl-dm-status-dot.err { background: #cc4444; }
                .isdl-dm-status-label { flex: 1; }
                .isdl-dm-status-synced { color: #4a6a8a; }
                .isdl-dm-export-btn {
                    background: none;
                    border: 1px solid #2a4a8a;
                    color: #6a9aff;
                    cursor: pointer;
                    padding: 1px 5px;
                    border-radius: 2px;
                    font-size: 10px;
                }
                .isdl-dm-export-btn:hover { background: #1a2a4a; }
                /* ── Insert group ── */
                .isdl-dm-insert-row { display: flex; gap: 4px; flex-wrap: wrap; }
                .isdl-dm-insert-btn {
                    flex: 1;
                    background: #0e1a2e;
                    border: 1px solid #2a4a8a;
                    color: #6a9aff;
                    cursor: pointer;
                    padding: 3px 4px;
                    border-radius: 2px;
                    font-size: 10px;
                    text-align: center;
                    white-space: nowrap;
                }
                .isdl-dm-insert-btn:hover { background: #1a2a4a; }
                /* ── Theme group ── */
                .isdl-dm-theme-row { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
                .isdl-dm-theme-row label { flex: 1; font-size: 10px; color: #8a9aaa; }
                .isdl-dm-theme-row input[type=color] { width: 30px; height: 20px; border: none; cursor: pointer; border-radius: 2px; background: none; flex-shrink: 0; }
                .isdl-dm-theme-row .isdl-dm-text-input { flex: 1; width: auto; }
                .isdl-dm-theme-clear { background: none; border: 1px solid #2a3a5a; color: #6a8aaa; cursor: pointer; padding: 0 4px; border-radius: 2px; font-size: 9px; flex-shrink: 0; }
                .isdl-dm-theme-clear:hover { background: #1a2a4a; color: #a0c8ff; }
                .isdl-dm-collapsible-header { display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; }
                .isdl-dm-collapsible-header .isdl-dm-section-label { flex: 1; margin: 0; }
                .isdl-dm-collapsible-header .isdl-dm-toggle-icon { font-size: 9px; color: #6a8aaa; }
                .isdl-dm-collapsible-body { display: flex; flex-direction: column; gap: 3px; padding: 4px 0 2px; }
                /* ── Hidden fields section ── */
                .isdl-dm-hidden-chips { display: flex; flex-wrap: wrap; gap: 4px; }
                .isdl-dm-hidden-chip {
                    display: flex; align-items: center; gap: 3px;
                    background: #2a1010; border: 1px solid #6a2a2a; color: #f07070;
                    border-radius: 10px; padding: 1px 6px 1px 8px; font-size: 10px; cursor: default;
                }
                .isdl-dm-hidden-chip-x {
                    background: none; border: none; color: #f07070; cursor: pointer;
                    font-size: 11px; padding: 0; line-height: 1;
                }
                .isdl-dm-hidden-chip-x:hover { color: #ff9090; }
                /* ── Synthetic container DOM hints ── */
                .isdl-dm-active [data-isdl-dm-synth-container]::after {
                    content: "Drop fields here";
                    display: flex; align-items: center; justify-content: center;
                    color: #4a6a8a; font-size: 10px; font-style: italic;
                    pointer-events: none;
                }
                .isdl-dm-active [data-isdl-dm-synth-container]:empty { outline: 1px dashed #2a4a8a; }
                /* ── Hidden field ghosting in DM ── */
                .isdl-dm-active .isdl-dm-hidden { opacity: 0.25; outline: 1px dashed #aa5555 !important; }
                /* ── Container hover/select in DM ── */
                .isdl-dm-active [class*='isdl-container-']:hover { outline: 1px dashed #3a5a8a; outline-offset: 2px; }
            \`;
            document.head.appendChild(style);
        }

        // ─── Tooltip helpers ─────────────────────────────────────────────────
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

        // ─── System data inspector ───────────────────────────────────────────
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

        // ─── Design Mode ─────────────────────────────────────────────────────
        // State singleton — null when design mode is closed.
        // { doc, sheetEl, windowContent, appRoot, docType, docKey, tree, selected, panelEl,
        //   previewStyleEl, listeners: [], dragging: null, btn }
        let _dm = null;

        // ── Model helpers ────────────────────────────────────────────────────

        function _dmCurrentPageKey() {
            const active = _dm.windowContent.querySelector(".v-tabs-window-item.v-window-item--active");
            if (active?.dataset?.tab) return active.dataset.tab;
            const keys = Object.keys(_dm.tree.pages);
            return keys[0] ?? null;
        }

        function _dmWalkNodes(nodes, visitor) {
            for (const n of nodes) {
                visitor(n);
                // Static nodes have no children; only containers recurse
                if (n.kind !== "field" && n.kind !== "static" && n.children) _dmWalkNodes(n.children, visitor);
            }
        }

        function _dmFindNode(pageKey, kind, key) {
            const page = _dm.tree.pages[pageKey];
            if (!page) return null;
            let result = null;
            function walk(nodes, parent) {
                for (let i = 0; i < nodes.length; i++) {
                    const n = nodes[i];
                    let matches = false;
                    if (kind === "field") {
                        matches = n.kind === "field" && n.name === key;
                    } else if (kind === "static") {
                        matches = n.kind === "static" && n.id === key;
                    } else {
                        // section/row/column
                        matches = (n.kind === "section" || n.kind === "row" || n.kind === "column") && n.id === key;
                    }
                    if (matches) {
                        result = { node: n, parent, index: i, parentChildren: nodes };
                        return true;
                    }
                    if (n.kind !== "field" && n.kind !== "static" && n.children && walk(n.children, n)) return true;
                }
                return false;
            }
            walk(page.children, null);
            return result;
        }

        function _dmFindAnywhere(kind, key) {
            for (const pageKey of Object.keys(_dm.tree.pages)) {
                const r = _dmFindNode(pageKey, kind, key);
                if (r) return { ...r, pageKey };
            }
            return null;
        }

        // ── DOM helpers ──────────────────────────────────────────────────────

        function _dmFieldRoot(name) {
            return _dm.windowContent.querySelector(\`.isdl-field-\${name}\`);
        }

        function _dmSectionRoot(id) {
            return _dm.windowContent.querySelector(\`.isdl-section-\${id}\`);
        }

        function _dmStaticRoot(id) {
            return _dm.windowContent.querySelector(\`.isdl-static-\${id}\`);
        }

        function _dmNodeRoot(node) {
            if (node.kind === "field") return _dmFieldRoot(node.name);
            if (node.kind === "static") return _dmStaticRoot(node.id) ?? _dmStaticRoot(node.id + "_synth");
            if (node.kind === "row" || node.kind === "column") return _dmContainerRoot(node.id);
            return _dmSectionRoot(node.id);
        }

        // ── Preview stylesheet ────────────────────────────────────────────────

        function _dmBuildPreviewCss() {
            let css = "";
            for (const [pageKey, page] of Object.entries(_dm.tree.pages)) {
                _dmWalkNodes(page.children, node => {
                    if (node.kind === "field" && node.size) {
                        const name = node.name;
                        if (node.size === "double") {
                            css += \`.isdl-dm-active .isdl-field-\${name} { flex: 2 1 0 !important; min-width: 300px !important; max-width: 600px !important; }\\n\`;
                        } else if (node.size === "full") {
                            css += \`.isdl-dm-active .isdl-field-\${name} { flex: 1 1 100% !important; min-width: 100% !important; max-width: none !important; }\\n\`;
                        } else if (node.size === "single") {
                            css += \`.isdl-dm-active .isdl-field-\${name} { flex: 1 1 0 !important; min-width: 150px !important; max-width: 600px !important; }\\n\`;
                        }
                    }
                    if (node.kind === "field" && node.hideLabel === true) {
                        // 3a: Broaden to cover all common label nodes across field types
                        const name = node.name;
                        css += \`.isdl-dm-active .isdl-field-\${name} .v-field-label,\`
                             + \` .isdl-dm-active .isdl-field-\${name} .v-label,\`
                             + \` .isdl-dm-active .isdl-field-\${name} legend,\`
                             + \` .isdl-dm-active .isdl-field-\${name} .v-card-title,\`
                             + \` .isdl-dm-active .isdl-field-\${name} .v-input__details,\`
                             + \` .isdl-dm-active .isdl-field-\${name} label { display: none !important; }\\n\`;
                    }
                    if (node.kind === "field" && node.color) {
                        // 3b: Best-effort live color preview tinting Vuetify hooks
                        const name = node.name;
                        const c = node.color;
                        css += \`.isdl-dm-active .isdl-field-\${name} .v-btn { color: \${c} !important; }\\n\`;
                        // Action components: the marker falls through to the v-btn ROOT itself,
                        // and elevated buttons render their color prop as background.
                        css += \`.isdl-dm-active .v-btn.isdl-field-\${name} { background-color: \${c} !important; }\\n\`;
                        css += \`.isdl-dm-active .isdl-field-\${name} .v-progress-linear__determinate { background-color: \${c} !important; }\\n\`;
                        css += \`.isdl-dm-active .isdl-field-\${name} .v-field__outline { color: \${c} !important; border-color: \${c} !important; }\\n\`;
                        css += \`.isdl-dm-active .isdl-field-\${name} .v-slider__thumb { color: \${c} !important; background-color: \${c} !important; }\\n\`;
                        css += \`.isdl-dm-active .isdl-field-\${name} input { caret-color: \${c} !important; }\\n\`;
                    }
                    // Item 2d: live preview for field theme overrides
                    if (node.kind === "field" && node.theme) {
                        const name = node.name;
                        const t = node.theme;
                        let rule = "";
                        if (t.background) rule += \`background: \${t.background} !important; \`;
                        if (t.text) rule += \`color: \${t.text} !important; \`;
                        if (t.border) {
                            if (t.border.width && t.border.color) rule += \`border: \${t.border.width} solid \${t.border.color} !important; \`;
                            else if (t.border.color) rule += \`border-color: \${t.border.color} !important; \`;
                            else if (t.border.width) rule += \`border-width: \${t.border.width} !important; border-style: solid !important; \`;
                            if (t.border.radius) rule += \`border-radius: \${t.border.radius} !important; \`;
                        }
                        if (t.width?.min) rule += \`min-width: \${t.width.min} !important; \`;
                        if (t.width?.max) rule += \`max-width: \${t.width.max} !important; \`;
                        if (t.height?.min) rule += \`min-height: \${t.height.min} !important; \`;
                        if (rule.trim()) css += \`.isdl-dm-active .isdl-field-\${name} { \${rule.trim()} }\\n\`;
                    }
                    if (node.kind === "section" && node.hideLabel === true) {
                        const id = node.id;
                        css += \`.isdl-dm-active .isdl-section-\${id} .v-card-title { display: none !important; }\\n\`;
                    }
                    // Static text styling: !important so it beats the synth elements' inline defaults
                    if (node.kind === "static" && (node.fontSize || node.color)) {
                        let rule = "";
                        if (node.fontSize) rule += \`font-size: \${node.fontSize} !important; \`;
                        if (node.color) rule += \`color: \${node.color} !important; \`;
                        css += \`.isdl-dm-active .isdl-static-\${node.id} h3, .isdl-dm-active .isdl-static-\${node.id} p { \${rule}}\\n\`;
                    }
                    // Item 2d: live preview for section theme overrides (targets .v-card, the painted surface)
                    if (node.kind === "section" && node.theme) {
                        const id = node.id;
                        const t = node.theme;
                        let rule = "";
                        if (t.background) rule += \`background: \${t.background} !important; \`;
                        if (t.text) rule += \`color: \${t.text} !important; \`;
                        if (t.border) {
                            if (t.border.width && t.border.color) rule += \`border: \${t.border.width} solid \${t.border.color} !important; \`;
                            else if (t.border.color) rule += \`border-color: \${t.border.color} !important; \`;
                            if (t.border.radius) rule += \`border-radius: \${t.border.radius} !important; \`;
                        }
                        if (rule.trim()) css += \`.isdl-dm-active .isdl-section-\${id} .v-card { \${rule.trim()} }\\n\`;
                    }
                    // Item 2d: row/column theme preview (use container class when available)
                    if ((node.kind === "row" || node.kind === "column") && node.theme) {
                        const id = node.id;
                        const t = node.theme;
                        let rule = "";
                        if (t.background) rule += \`background: \${t.background} !important; \`;
                        if (t.text) rule += \`color: \${t.text} !important; \`;
                        if (t.border) {
                            if (t.border.width && t.border.color) rule += \`border: \${t.border.width} solid \${t.border.color} !important; \`;
                            else if (t.border.color) rule += \`border-color: \${t.border.color} !important; \`;
                            if (t.border.radius) rule += \`border-radius: \${t.border.radius} !important; \`;
                        }
                        if (t.width?.min) rule += \`min-width: \${t.width.min} !important; \`;
                        if (t.width?.max) rule += \`max-width: \${t.width.max} !important; \`;
                        if (t.height?.min) rule += \`min-height: \${t.height.min} !important; \`;
                        if (rule.trim()) css += \`.isdl-dm-active .isdl-container-\${id} { \${rule.trim()} }\\n\`;
                    }
                });
            }
            return css;
        }

        function _dmApplyOrderToDOMChildren(nodes, containerEl) {
            let order = 0;
            for (const node of nodes) {
                // Item 3c: handle synthetic row/column containers — append to parent if not yet in DOM
                if ((node.kind === "row" || node.kind === "column") && node.synthetic) {
                    let el = _dmContainerRoot(node.id);
                    if (!el && node._synthEl) {
                        el = node._synthEl;
                        delete node._synthEl;
                        if (containerEl) containerEl.appendChild(el);
                    }
                    if (el) {
                        if (containerEl && el.parentElement !== containerEl) containerEl.appendChild(el);
                        el.style.order = String(order++);
                        el.setAttribute("data-isdl-dm", "1");
                        el.draggable = true;
                    } else {
                        order++;
                    }
                    continue;
                }
                // Synthesize DOM for static nodes that aren't in the generated markup yet
                if (node.kind === "static") {
                    let el = _dmStaticRoot(node.id);
                    if (!el && containerEl) {
                        // Not yet in DOM (inserted in DM, not yet regenerated) — synthesize it
                        el = document.createElement("div");
                        el.className = \`isdl-static isdl-static-\${node.id}\`;
                        el.dataset.isdlDmSynth = "1";
                        if (node.staticType === "hr") {
                            el.innerHTML = \`<hr style="border-color: #4a6a8a; margin: 4px 0;">\`;
                        } else if (node.staticType === "paragraph") {
                            el.innerHTML = \`<p class="isdl-static-paragraph" style="margin:4px 0;color:#c0d0e0;font-size:12px;">\${node.text ?? ""}</p>\`;
                        } else {
                            el.innerHTML = \`<h3 class="isdl-static-heading" style="margin:4px 0;color:#c0d0e0;font-size:13px;font-weight:bold;">\${node.text ?? "Heading"}</h3>\`;
                        }
                        containerEl.appendChild(el);
                    } else if (el && node.staticType !== "hr") {
                        // Update text of existing synth element in case it was edited
                        const textEl = el.querySelector(".isdl-static-heading, .isdl-static-paragraph");
                        if (textEl && textEl.dataset.isdlDmLive !== "1") {
                            textEl.textContent = node.text ?? "";
                        }
                    }
                    if (el) {
                        // Cross-container move: a static dragged into a different container must
                        // physically reparent — CSS order only sorts among siblings.
                        if (containerEl && el.parentElement !== containerEl) containerEl.appendChild(el);
                        el.style.order = String(order++);
                        el.setAttribute("data-isdl-dm", "1");
                        el.draggable = true;
                    } else {
                        order++;
                    }
                    continue;
                }
                const el = _dmNodeRoot(node);
                if (!el) {
                    order++;
                    continue;
                }
                // Cross-container move: when the model places this node under a container the
                // element doesn't live in (e.g. field dragged to another section), reparent it.
                // CSS order alone can't express that — it only sorts among existing siblings.
                if (containerEl && el.parentElement !== containerEl) containerEl.appendChild(el);
                el.style.order = String(order++);
                el.setAttribute("data-isdl-dm", "1");
                el.draggable = true;
            }
        }

        function _dmGetSectionRowEl(sectionId) {
            // 4b: Robust selector for section inner row — handles both collapsible and non-collapsible.
            // The generated markup is: .isdl-section-<id> .v-card-text .v-row (first match)
            return _dm.windowContent.querySelector(\`.isdl-section-\${sectionId} .v-card-text .v-row\`);
        }

        // Item 3c: resolve the DOM container element for a row/column node (both AST and synthetic).
        function _dmContainerRoot(nodeId) {
            return _dm.windowContent.querySelector(\`.isdl-container-\${CSS.escape(nodeId)}\`);
        }

        function _dmApplyPreview() {
            if (!_dm) return;

            // Remove previously synthesised static nodes so we can re-add them in correct order
            _dm.windowContent.querySelectorAll("[data-isdl-dm-synth]").forEach(el => el.remove());

            // Rebuild preview CSS
            _dm.previewStyleEl.textContent = _dmBuildPreviewCss();

            // Item 3c: synthesise DOM elements for synthetic row/column containers not yet in generated markup
            _dmWalkNodes(Object.values(_dm.tree.pages).flatMap(p => p.children), node => {
                if (!node.synthetic) return;
                if (node.kind !== "row" && node.kind !== "column") return;
                const existing = _dmContainerRoot(node.id);
                if (!existing) {
                    const el = document.createElement("div");
                    el.className = \`isdl-container-\${node.id}\`;
                    el.dataset.isdlDmSynth = "1";
                    el.dataset.isdlDmSynthContainer = "1";
                    const isRow = node.kind === "row";
                    el.style.cssText = \`display:flex;flex-wrap:wrap;gap:4px;min-height:36px;flex-basis:100%;\${isRow ? "" : "flex-direction:column;"}\`;
                    // Will be appended to parent container by the order pass below
                    // Store on node for the order pass to find
                    node._synthEl = el;
                }
            });

            // DOM pass: set CSS order + draggable on addressable nodes per page
            for (const [pageKey, page] of Object.entries(_dm.tree.pages)) {
                // Determine the page's top-level container element
                const pageTabEl = _dm.windowContent.querySelector(\`[data-tab="\${pageKey}"] > .v-row, [data-tab="\${pageKey}"] .v-row\`);
                // Top-level children — pass the v-row container for synth injection
                _dmApplyOrderToDOMChildren(page.children, pageTabEl);
                // Recurse into section/row/column containers
                _dmWalkNodes(page.children, node => {
                    if (node.kind !== "field" && node.kind !== "static" && node.children) {
                        let containerEl = null;
                        if (node.kind === "section") {
                            containerEl = _dmGetSectionRowEl(node.id);
                        } else if (node.kind === "row" || node.kind === "column") {
                            // Item 3c: use isdl-container-<id> class for all rows/columns
                            containerEl = _dmContainerRoot(node.id) ?? null;
                        }
                        _dmApplyOrderToDOMChildren(node.children, containerEl);
                    }
                });
            }

            // Item 4b: apply/remove isdl-dm-hidden class on field DOM elements
            _dmWalkNodes(Object.values(_dm.tree.pages).flatMap(p => p.children), node => {
                if (node.kind !== "field") return;
                const el = _dmFieldRoot(node.name);
                if (!el) return;
                if (node.hidden) {
                    el.classList.add("isdl-dm-hidden");
                    el.setAttribute("data-isdl-dm", "1");
                    el.draggable = true;
                } else {
                    el.classList.remove("isdl-dm-hidden");
                }
            });

            // 3c: Icon live preview — swap FA icon classes on the field's label area
            _dmWalkNodes(Object.values(_dm.tree.pages).flatMap(p => p.children), node => {
                if (node.kind !== "field") return;
                const el = _dmFieldRoot(node.name);
                if (!el) return;
                // Find an <i class="fa-..."> anywhere in the field root (labels, card-title, etc.)
                const iconEl = el.querySelector(\`i[class*="fa-"]\`);
                if (!iconEl) return;
                if (node.icon) {
                    if (!iconEl.dataset.isdlDmOrigIcon) {
                        iconEl.dataset.isdlDmOrigIcon = iconEl.className;
                    }
                    iconEl.className = node.icon;
                } else if (iconEl.dataset.isdlDmOrigIcon) {
                    iconEl.className = iconEl.dataset.isdlDmOrigIcon;
                    delete iconEl.dataset.isdlDmOrigIcon;
                }
            });

            // Re-apply selection outline
            _dm.windowContent.querySelectorAll(".isdl-dm-selected").forEach(el => el.classList.remove("isdl-dm-selected"));
            if (_dm.selected) {
                const el = _dmNodeRoot(_dm.selected.node);
                if (el) el.classList.add("isdl-dm-selected");
            }

            // Ensure panel is still attached
            if (_dm.panelEl && !_dm.panelEl.isConnected) {
                _dm.windowContent.appendChild(_dm.panelEl);
            }

            // Refresh panel body
            _dmRenderPanelBody();
        }

        // ── Sidebar panel ─────────────────────────────────────────────────────

        // ── Status row state (module-level, lives for DM session) ────────────────
        let _dmLastSyncTime = null;
        let _dmStatusInterval = null;

        function _dmFormatSyncTime() {
            if (!_dmLastSyncTime) return "—";
            const diff = Math.floor((Date.now() - _dmLastSyncTime) / 1000);
            if (diff < 10) return "just now";
            if (diff < 60) return \`\${diff}s ago\`;
            return \`\${Math.floor(diff / 60)}m ago\`;
        }

        function _dmUpdateStatusRow(panelEl, ok) {
            const dot = panelEl.querySelector(".isdl-dm-status-dot");
            const label = panelEl.querySelector(".isdl-dm-status-label");
            const synced = panelEl.querySelector(".isdl-dm-status-synced");
            if (dot) {
                dot.className = "isdl-dm-status-dot " + (ok === true ? "ok" : ok === false ? "err" : "");
            }
            if (label) label.textContent = ok === true ? "Connected" : ok === false ? "Offline" : "Checking…";
            if (synced) synced.textContent = _dmFormatSyncTime();
        }

        function _dmCheckStatus(panelEl) {
            fetch(_LAYOUT_SERVER + "/status", { method: "GET", signal: AbortSignal.timeout(3000) })
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(() => _dmUpdateStatusRow(panelEl, true))
                .catch(() => _dmUpdateStatusRow(panelEl, false));
        }

        function _dmBuildLayoutPayload() {
            if (!_dm) return null;
            const { docType, docKey, tree } = _dm;
            function stripNode(node) {
                if (node.kind === "field") {
                    const out = { kind: "field", name: node.name };
                    if (node.size) out.size = node.size;
                    if (node.hideLabel === true) out.hideLabel = true;
                    if (node.color) out.color = node.color;
                    if (node.icon) out.icon = node.icon;
                    if (node.hidden === true) out.hidden = true;
                    if (node.theme && Object.keys(node.theme).length > 0) out.theme = node.theme;
                    return out;
                }
                if (node.kind === "static") {
                    const out = { kind: "static", id: node.id, staticType: node.staticType };
                    if (node.text != null) out.text = node.text;
                    if (node.fontSize) out.fontSize = node.fontSize;
                    if (node.color) out.color = node.color;
                    return out;
                }
                const out = { kind: node.kind, id: node.id };
                if (node.hideLabel === true) out.hideLabel = true;
                if (node.synthetic === true) out.synthetic = true;
                if (node.theme && Object.keys(node.theme).length > 0) out.theme = node.theme;
                out.children = (node.children ?? []).map(stripNode);
                return out;
            }
            const pages = {};
            for (const [pk, page] of Object.entries(tree.pages)) {
                pages[pk] = { children: page.children.map(stripNode) };
            }
            const base = SAVED_LAYOUT ? structuredClone(SAVED_LAYOUT) : { version: 2, actors: {}, items: {} };
            if (!base[docType]) base[docType] = {};
            base[docType][docKey] = { pages };
            return base;
        }

        function _dmBuildPanel(docType, docKey) {
            const panel = document.createElement("div");
            panel.className = "isdl-dm-panel";

            // Header
            const header = document.createElement("div");
            header.className = "isdl-dm-panel-header";
            header.innerHTML = \`<i class="fa-solid fa-pen-ruler"></i><span class="isdl-dm-panel-header-title">Design Mode</span><span class="isdl-dm-doc-badge">\${docType}/\${docKey}</span>\`;

            const saveBtn = document.createElement("button");
            saveBtn.type = "button";
            saveBtn.className = "isdl-dm-panel-btn save";
            saveBtn.innerHTML = \`<i class="fa-solid fa-floppy-disk"></i> Save\`;
            saveBtn.addEventListener("click", e => { e.stopPropagation(); _dmSave(saveBtn, panel); });

            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "isdl-dm-panel-btn";
            closeBtn.innerHTML = \`<i class="fa-solid fa-times"></i>\`;
            closeBtn.style.cssText = "padding:3px 6px;";
            closeBtn.addEventListener("click", e => { e.stopPropagation(); _closeDesignMode(); });

            header.appendChild(saveBtn);
            header.appendChild(closeBtn);
            panel.appendChild(header);

            // Status row (#6)
            const statusRow = document.createElement("div");
            statusRow.className = "isdl-dm-status-row";
            statusRow.innerHTML =
                \`<span class="isdl-dm-status-dot"></span>\`
              + \`<span class="isdl-dm-status-label">Checking…</span>\`
              + \`<span class="isdl-dm-status-synced">—</span>\`;

            // Export button (#6)
            const exportBtn = document.createElement("button");
            exportBtn.type = "button";
            exportBtn.className = "isdl-dm-export-btn";
            exportBtn.innerHTML = \`<i class="fa-solid fa-download"></i>\`;
            exportBtn.title = 'Download layout JSON (drop next to your .isdl)';
            exportBtn.addEventListener("click", e => {
                e.stopPropagation();
                const payload = _dmBuildLayoutPayload();
                if (!payload) return;
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "${id}-layout.json";
                a.click();
                URL.revokeObjectURL(url);
            });
            statusRow.appendChild(exportBtn);
            panel.appendChild(statusRow);

            // Start status polling (#6)
            _dmLastSyncTime = null;
            _dmCheckStatus(panel);
            _dmStatusInterval = setInterval(() => {
                _dmCheckStatus(panel);
                const synced = panel.querySelector(".isdl-dm-status-synced");
                if (synced) synced.textContent = _dmFormatSyncTime();
            }, 30000);

            // Body (dynamic)
            const body = document.createElement("div");
            body.className = "isdl-dm-panel-body";
            body.dataset.dmPanelBody = "1";
            panel.appendChild(body);

            return panel;
        }

        function _dmRenderPanelBody() {
            if (!_dm?.panelEl) return;
            const body = _dm.panelEl.querySelector("[data-dm-panel-body]");
            if (!body) return;
            body.innerHTML = "";

            // Insert group — always visible (#5c)
            body.appendChild(_dmMakeSectionLabel("Insert"));
            const insertRow = document.createElement("div");
            insertRow.className = "isdl-dm-insert-row";
            for (const [label, type, defaultText] of [["H Heading", "heading", "Heading"], ["¶ Paragraph", "paragraph", "Paragraph text"], ["— Divider", "hr", undefined]]) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-dm-insert-btn";
                btn.textContent = label;
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    _dmInsertStatic(type, defaultText);
                });
                insertRow.appendChild(btn);
            }
            // Item 3c: Row and Column insert buttons
            for (const [label, kind] of [["↔ Row", "row"], ["↕ Column", "column"]]) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-dm-insert-btn";
                btn.textContent = label;
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    _dmInsertContainer(kind);
                });
                insertRow.appendChild(btn);
            }
            body.appendChild(insertRow);

            // Item 4b: Hidden fields section — always shown when there are hidden fields
            const hiddenNodes = [];
            _dmWalkNodes(Object.values(_dm.tree.pages).flatMap(p => p.children), n => {
                if (n.kind === "field" && n.hidden) hiddenNodes.push(n);
            });
            if (hiddenNodes.length > 0) {
                body.appendChild(_dmMakeSectionLabel("Hidden Fields"));
                const chipsEl = document.createElement("div");
                chipsEl.className = "isdl-dm-hidden-chips";
                for (const n of hiddenNodes) {
                    const chip = document.createElement("div");
                    chip.className = "isdl-dm-hidden-chip";
                    chip.textContent = n.label ?? n.name;
                    const x = document.createElement("button");
                    x.type = "button";
                    x.className = "isdl-dm-hidden-chip-x";
                    x.textContent = "✕";
                    x.title = "Unhide";
                    x.addEventListener("click", e => {
                        e.stopPropagation();
                        delete n.hidden;
                        _dmApplyPreview();
                    });
                    chip.appendChild(x);
                    chipsEl.appendChild(chip);
                }
                body.appendChild(chipsEl);
            }

            const sel = _dm.selected;
            if (!sel) {
                const hint = document.createElement("p");
                hint.className = "isdl-dm-panel-hint";
                hint.textContent = "Click a field or section to edit it. Drag to reorder.";
                body.appendChild(hint);
                return;
            }

            const node = sel.node;

            if (node.kind === "field") {
                _dmRenderFieldPanel(body, node, sel.pageKey);
            } else if (node.kind === "section") {
                _dmRenderSectionPanel(body, node, sel.pageKey);
            } else if (node.kind === "static") {
                _dmRenderStaticPanel(body, node, sel.pageKey);
            } else if (node.kind === "row" || node.kind === "column") {
                _dmRenderContainerPanel(body, node, sel.pageKey);
            }
        }

        function _dmInsertStatic(staticType, defaultText) {
            if (!_dm) return;
            const newNode = { kind: "static", id: "__static_" + Date.now(), staticType };
            if (defaultText != null) newNode.text = defaultText;

            const pageKey = _dmCurrentPageKey();
            if (!pageKey) return;
            const page = _dm.tree.pages[pageKey];
            if (!page) return;

            if (_dm.selected) {
                // Insert after the selected node in its parent container
                const sel = _dm.selected;
                const kind = sel.node.kind === "field" ? "field"
                           : sel.node.kind === "static" ? "static" : "section";
                const key = sel.node.kind === "field" ? sel.node.name : sel.node.id;
                const found = _dmFindNode(sel.pageKey, kind, key);
                if (found) {
                    found.parentChildren.splice(found.index + 1, 0, newNode);
                    _dm.selected = { pageKey: sel.pageKey, node: newNode };
                    _dmApplyPreview();
                    return;
                }
            }
            // Fallback: append at end of current page
            page.children.push(newNode);
            _dm.selected = { pageKey, node: newNode };
            _dmApplyPreview();
        }

        // Item 3c: insert a synthetic row or column container
        function _dmInsertContainer(kind) {
            if (!_dm) return;
            const ts = Date.now();
            const prefix = kind === "row" ? "__dmrow_" : "__dmcol_";
            const newNode = { kind, id: prefix + ts, synthetic: true, children: [] };

            const pageKey = _dmCurrentPageKey();
            if (!pageKey) return;
            const page = _dm.tree.pages[pageKey];
            if (!page) return;

            if (_dm.selected) {
                const sel = _dm.selected;
                const selKind = sel.node.kind === "field" ? "field"
                              : sel.node.kind === "static" ? "static" : sel.node.kind;
                const selKey = sel.node.kind === "field" ? sel.node.name : sel.node.id;
                const found = _dmFindNode(sel.pageKey, selKind, selKey);
                if (found) {
                    found.parentChildren.splice(found.index + 1, 0, newNode);
                    _dm.selected = { pageKey: sel.pageKey, node: newNode };
                    _dmApplyPreview();
                    return;
                }
            }
            page.children.push(newNode);
            _dm.selected = { pageKey, node: newNode };
            _dmApplyPreview();
        }

        function _dmMakeSectionLabel(text) {
            const div = document.createElement("div");
            div.className = "isdl-dm-section-label";
            div.textContent = text;
            return div;
        }

        // Item 2c: collapsible Theme group, shared between field, section, row/column panels.
        // node is a live tree node whose .theme object is mutated; onUpdate is called after each change.
        function _dmRenderThemeGroup(body, node, onUpdate) {
            const header = document.createElement("div");
            header.className = "isdl-dm-collapsible-header";
            const lbl = _dmMakeSectionLabel("Theme");
            const toggle = document.createElement("span");
            toggle.className = "isdl-dm-toggle-icon";
            toggle.textContent = "▼";
            header.appendChild(lbl);
            header.appendChild(toggle);

            const themeBody = document.createElement("div");
            themeBody.className = "isdl-dm-collapsible-body";
            let open = false;
            themeBody.style.display = "none";
            header.addEventListener("click", () => {
                open = !open;
                themeBody.style.display = open ? "flex" : "none";
                toggle.textContent = open ? "▲" : "▼";
            });
            body.appendChild(header);

            function ensureTheme() {
                if (!node.theme) node.theme = {};
                return node.theme;
            }
            function cleanTheme() {
                if (!node.theme) return;
                // Remove empty nested objects
                if (node.theme.border && Object.values(node.theme.border).every(v => !v)) delete node.theme.border;
                if (node.theme.width && Object.values(node.theme.width).every(v => !v)) delete node.theme.width;
                if (node.theme.height && Object.values(node.theme.height).every(v => !v)) delete node.theme.height;
                if (Object.keys(node.theme).length === 0) delete node.theme;
            }

            function makeColorRow(label, getter, setter) {
                const row = document.createElement("div");
                row.className = "isdl-dm-theme-row";
                const lbl = document.createElement("label");
                lbl.textContent = label;
                const inp = document.createElement("input");
                inp.type = "color";
                inp.value = getter() || "#000000";
                inp.addEventListener("input", () => { ensureTheme(); setter(inp.value); cleanTheme(); onUpdate(); });
                const clr = document.createElement("button");
                clr.type = "button";
                clr.className = "isdl-dm-theme-clear";
                clr.textContent = "✕";
                clr.addEventListener("click", () => { ensureTheme(); setter(null); cleanTheme(); onUpdate(); });
                row.appendChild(lbl);
                row.appendChild(inp);
                row.appendChild(clr);
                themeBody.appendChild(row);
            }

            function makeTextRow(label, placeholder, getter, setter) {
                const row = document.createElement("div");
                row.className = "isdl-dm-theme-row";
                const lbl = document.createElement("label");
                lbl.textContent = label;
                const inp = document.createElement("input");
                inp.type = "text";
                inp.className = "isdl-dm-text-input";
                inp.placeholder = placeholder;
                inp.value = getter() || "";
                inp.addEventListener("input", () => { ensureTheme(); setter(inp.value || null); cleanTheme(); onUpdate(); });
                row.appendChild(lbl);
                row.appendChild(inp);
                themeBody.appendChild(row);
            }

            makeColorRow("Background",
                () => node.theme?.background,
                v => { if (v) node.theme.background = v; else delete node.theme?.background; }
            );
            makeColorRow("Text",
                () => node.theme?.text,
                v => { if (v) node.theme.text = v; else delete node.theme?.text; }
            );
            makeColorRow("Border color",
                () => node.theme?.border?.color,
                v => { ensureTheme(); if (!node.theme.border) node.theme.border = {}; if (v) node.theme.border.color = v; else delete node.theme.border.color; }
            );
            makeTextRow("Border width", "2px",
                () => node.theme?.border?.width,
                v => { ensureTheme(); if (!node.theme.border) node.theme.border = {}; if (v) node.theme.border.width = v; else delete node.theme.border.width; }
            );
            makeTextRow("Border radius", "8px",
                () => node.theme?.border?.radius,
                v => { ensureTheme(); if (!node.theme.border) node.theme.border = {}; if (v) node.theme.border.radius = v; else delete node.theme.border.radius; }
            );
            makeTextRow("Min width", "150px",
                () => node.theme?.width?.min,
                v => { ensureTheme(); if (!node.theme.width) node.theme.width = {}; if (v) node.theme.width.min = v; else delete node.theme.width.min; }
            );
            makeTextRow("Max width", "300px",
                () => node.theme?.width?.max,
                v => { ensureTheme(); if (!node.theme.width) node.theme.width = {}; if (v) node.theme.width.max = v; else delete node.theme.width.max; }
            );
            makeTextRow("Min height", "60px",
                () => node.theme?.height?.min,
                v => { ensureTheme(); if (!node.theme.height) node.theme.height = {}; if (v) node.theme.height.min = v; else delete node.theme.height.min; }
            );

            body.appendChild(themeBody);
        }

        function _dmRenderFieldPanel(body, node, pageKey) {
            // Label + name
            const nameDiv = document.createElement("div");
            nameDiv.innerHTML = \`<strong>\${node.label ?? node.name}</strong> <span class="isdl-dm-field-name">\${node.name}</span>\`;
            body.appendChild(nameDiv);

            const typeBadge = document.createElement("span");
            typeBadge.className = "isdl-dm-type-badge";
            typeBadge.textContent = node.typeClass ?? "";
            body.appendChild(typeBadge);

            // Size
            body.appendChild(_dmMakeSectionLabel("Size"));
            const sizeRow = document.createElement("div");
            sizeRow.className = "isdl-dm-size-row";
            const sizable = node.sizable !== false;
            const currentSize = node.size ?? node.defaultSize ?? "single";
            for (const sz of ["single", "double", "full"]) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-dm-size-btn" + (currentSize === sz ? " active" : "");
                btn.textContent = sz.charAt(0).toUpperCase() + sz.slice(1);
                btn.disabled = !sizable;
                if (sizable) {
                    btn.addEventListener("click", e => {
                        e.stopPropagation();
                        node.size = sz;
                        _dmApplyPreview();
                    });
                }
                sizeRow.appendChild(btn);
            }
            body.appendChild(sizeRow);
            if (!sizable) {
                const note = document.createElement("p");
                note.className = "isdl-dm-panel-note";
                note.textContent = "This field type has a fixed size.";
                body.appendChild(note);
            }

            // Hide label
            body.appendChild(_dmMakeSectionLabel("Display"));
            const hideLabelRow = document.createElement("label");
            hideLabelRow.className = "isdl-dm-checkbox-row";
            const hlCheck = document.createElement("input");
            hlCheck.type = "checkbox";
            hlCheck.checked = !!node.hideLabel;
            hlCheck.addEventListener("change", e => {
                e.stopPropagation();
                node.hideLabel = hlCheck.checked ? true : undefined;
                _dmApplyPreview();
            });
            hideLabelRow.appendChild(hlCheck);
            hideLabelRow.appendChild(document.createTextNode(" Hide label"));
            body.appendChild(hideLabelRow);

            // Color
            body.appendChild(_dmMakeSectionLabel("Color"));
            const colorRow = document.createElement("div");
            colorRow.className = "isdl-dm-color-row";
            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = node.color || "#000000";
            colorInput.addEventListener("input", e => {
                e.stopPropagation();
                node.color = colorInput.value;
                _dmApplyPreview();
            });
            const clearColorBtn = document.createElement("button");
            clearColorBtn.type = "button";
            clearColorBtn.className = "isdl-dm-panel-btn";
            clearColorBtn.textContent = "Clear";
            clearColorBtn.addEventListener("click", e => {
                e.stopPropagation();
                node.color = undefined;
                colorInput.value = "#000000";
            });
            colorRow.appendChild(colorInput);
            colorRow.appendChild(clearColorBtn);
            body.appendChild(colorRow);

            // Icon
            body.appendChild(_dmMakeSectionLabel("Icon"));
            const iconInput = document.createElement("input");
            iconInput.type = "text";
            iconInput.className = "isdl-dm-icon-input";
            iconInput.placeholder = "fa-solid fa-star";
            iconInput.value = node.icon || "";
            iconInput.addEventListener("input", e => {
                e.stopPropagation();
                node.icon = iconInput.value || undefined;
                _dmApplyPreview();
            });
            body.appendChild(iconInput);

            const regenNote = document.createElement("p");
            regenNote.className = "isdl-dm-panel-note";
            regenNote.textContent = "Exact colors and icon apply on regenerate. Live preview is best-effort.";
            body.appendChild(regenNote);

            // Item 2c: Theme group
            _dmRenderThemeGroup(body, node, () => _dmApplyPreview());

            // Move + Reset
            body.appendChild(_dmMakeSectionLabel("Position"));
            const moveRow = document.createElement("div");
            moveRow.className = "isdl-dm-move-row";
            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "isdl-dm-panel-btn";
            upBtn.innerHTML = \`<i class="fa-solid fa-arrow-up"></i> Up\`;
            upBtn.addEventListener("click", e => { e.stopPropagation(); _dmMoveNode(pageKey, node, -1); });
            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "isdl-dm-panel-btn";
            downBtn.innerHTML = \`<i class="fa-solid fa-arrow-down"></i> Down\`;
            downBtn.addEventListener("click", e => { e.stopPropagation(); _dmMoveNode(pageKey, node, 1); });
            moveRow.appendChild(upBtn);
            moveRow.appendChild(downBtn);
            body.appendChild(moveRow);

            const resetBtn = document.createElement("button");
            resetBtn.type = "button";
            resetBtn.className = "isdl-dm-panel-btn danger";
            resetBtn.style.width = "100%";
            resetBtn.innerHTML = \`<i class="fa-solid fa-rotate-left"></i> Reset overrides\`;
            resetBtn.addEventListener("click", e => {
                e.stopPropagation();
                delete node.size;
                delete node.hideLabel;
                delete node.color;
                delete node.icon;
                delete node.theme;
                _dmApplyPreview();
            });
            body.appendChild(resetBtn);

            // Item 4b: Hide/Unhide field button
            if (node.hidden) {
                const unhideBtn = document.createElement("button");
                unhideBtn.type = "button";
                unhideBtn.className = "isdl-dm-panel-btn";
                unhideBtn.style.width = "100%";
                unhideBtn.innerHTML = \`<i class="fa-solid fa-eye"></i> Unhide field\`;
                unhideBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    delete node.hidden;
                    _dm.selected = null;
                    _dmApplyPreview();
                });
                body.appendChild(unhideBtn);
            } else {
                const hideBtn = document.createElement("button");
                hideBtn.type = "button";
                hideBtn.className = "isdl-dm-panel-btn danger";
                hideBtn.style.width = "100%";
                hideBtn.innerHTML = \`<i class="fa-solid fa-eye-slash"></i> Hide field\`;
                hideBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    node.hidden = true;
                    _dm.selected = null;
                    _dmApplyPreview();
                });
                body.appendChild(hideBtn);
            }
        }

        function _dmRenderSectionPanel(body, node, pageKey) {
            const nameDiv = document.createElement("div");
            nameDiv.innerHTML = \`<strong>\${node.label ?? node.id}</strong>\`;
            body.appendChild(nameDiv);

            // Hide title
            body.appendChild(_dmMakeSectionLabel("Display"));
            const hideTitleRow = document.createElement("label");
            hideTitleRow.className = "isdl-dm-checkbox-row";
            const htCheck = document.createElement("input");
            htCheck.type = "checkbox";
            htCheck.checked = !!node.hideLabel;
            htCheck.addEventListener("change", e => {
                e.stopPropagation();
                node.hideLabel = htCheck.checked ? true : undefined;
                _dmApplyPreview();
            });
            hideTitleRow.appendChild(htCheck);
            hideTitleRow.appendChild(document.createTextNode(" Hide title"));
            body.appendChild(hideTitleRow);

            // Item 2c: Theme group
            _dmRenderThemeGroup(body, node, () => _dmApplyPreview());

            // Move
            body.appendChild(_dmMakeSectionLabel("Position"));
            const moveRow = document.createElement("div");
            moveRow.className = "isdl-dm-move-row";
            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "isdl-dm-panel-btn";
            upBtn.innerHTML = \`<i class="fa-solid fa-arrow-up"></i> Up\`;
            upBtn.addEventListener("click", e => { e.stopPropagation(); _dmMoveNode(pageKey, node, -1); });
            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "isdl-dm-panel-btn";
            downBtn.innerHTML = \`<i class="fa-solid fa-arrow-down"></i> Down\`;
            downBtn.addEventListener("click", e => { e.stopPropagation(); _dmMoveNode(pageKey, node, 1); });
            moveRow.appendChild(upBtn);
            moveRow.appendChild(downBtn);
            body.appendChild(moveRow);
        }

        // Item 3c: panel for selected row/column container
        function _dmRenderContainerPanel(body, node, pageKey) {
            const kindLabel = node.kind === "row" ? "Row" : "Column";
            const nameDiv = document.createElement("div");
            nameDiv.innerHTML = \`<strong>\${kindLabel}</strong> <span class="isdl-dm-field-name">\${node.id}</span>\`;
            if (node.synthetic) {
                const badge = document.createElement("span");
                badge.className = "isdl-dm-type-badge";
                badge.textContent = "synthetic";
                nameDiv.appendChild(badge);
            }
            body.appendChild(nameDiv);

            // Item 2c: Theme group
            _dmRenderThemeGroup(body, node, () => _dmApplyPreview());

            // Move
            body.appendChild(_dmMakeSectionLabel("Position"));
            const moveRow = document.createElement("div");
            moveRow.className = "isdl-dm-move-row";
            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "isdl-dm-panel-btn";
            upBtn.innerHTML = \`<i class="fa-solid fa-arrow-up"></i> Up\`;
            upBtn.addEventListener("click", e => { e.stopPropagation(); _dmMoveNode(pageKey, node, -1); });
            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "isdl-dm-panel-btn";
            downBtn.innerHTML = \`<i class="fa-solid fa-arrow-down"></i> Down\`;
            downBtn.addEventListener("click", e => { e.stopPropagation(); _dmMoveNode(pageKey, node, 1); });
            moveRow.appendChild(upBtn);
            moveRow.appendChild(downBtn);
            body.appendChild(moveRow);

            // Remove: splice children into parent at container's former position
            if (node.synthetic) {
                const removeBtn = document.createElement("button");
                removeBtn.type = "button";
                removeBtn.className = "isdl-dm-panel-btn danger";
                removeBtn.style.width = "100%";
                removeBtn.innerHTML = \`<i class="fa-solid fa-trash"></i> Remove (keep children)\`;
                removeBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    const kind = node.kind;
                    const found = _dmFindAnywhere(kind, node.id);
                    if (!found) return;
                    const children = node.children ?? [];
                    // Replace this container with its children in-place
                    found.parentChildren.splice(found.index, 1, ...children);
                    _dm.selected = null;
                    _dmApplyPreview();
                });
                body.appendChild(removeBtn);
            }
        }

        function _dmRenderStaticPanel(body, node, pageKey) {
            const nameDiv = document.createElement("div");
            nameDiv.innerHTML = \`<strong>\${node.staticType === "hr" ? "Divider" : node.staticType.charAt(0).toUpperCase() + node.staticType.slice(1)}</strong> <span class="isdl-dm-field-name">\${node.id}</span>\`;
            body.appendChild(nameDiv);

            if (node.staticType !== "hr") {
                body.appendChild(_dmMakeSectionLabel("Text"));
                const textInput = document.createElement("input");
                textInput.type = "text";
                textInput.className = "isdl-dm-text-input";
                textInput.value = node.text ?? "";
                textInput.addEventListener("input", e => {
                    e.stopPropagation();
                    node.text = textInput.value;
                    // Live-update the preview element's textContent
                    const el = _dmStaticRoot(node.id);
                    if (el) {
                        const textEl = el.querySelector(".isdl-static-heading, .isdl-static-paragraph");
                        if (textEl) {
                            textEl.dataset.isdlDmLive = "1";
                            textEl.textContent = node.text;
                        }
                    }
                });
                body.appendChild(textInput);

                // Text size + color (persisted on the node; live preview via the DM stylesheet)
                body.appendChild(_dmMakeSectionLabel("Text size"));
                const sizeInput = document.createElement("input");
                sizeInput.type = "text";
                sizeInput.className = "isdl-dm-text-input";
                sizeInput.placeholder = node.staticType === "heading" ? "18px" : "13px";
                sizeInput.value = node.fontSize ?? "";
                sizeInput.addEventListener("input", e => {
                    e.stopPropagation();
                    const v = sizeInput.value.trim();
                    if (v) node.fontSize = v; else delete node.fontSize;
                    _dmApplyPreview();
                });
                body.appendChild(sizeInput);

                body.appendChild(_dmMakeSectionLabel("Text color"));
                const colorRow = document.createElement("div");
                colorRow.className = "isdl-dm-move-row";
                const colorInput = document.createElement("input");
                colorInput.type = "color";
                colorInput.value = node.color ?? "#c0d0e0";
                colorInput.addEventListener("input", e => {
                    e.stopPropagation();
                    node.color = colorInput.value;
                    _dmApplyPreview();
                });
                const clearColorBtn = document.createElement("button");
                clearColorBtn.type = "button";
                clearColorBtn.className = "isdl-dm-panel-btn";
                clearColorBtn.textContent = "Clear";
                clearColorBtn.addEventListener("click", e => {
                    e.stopPropagation();
                    delete node.color;
                    _dmApplyPreview();
                });
                colorRow.appendChild(colorInput);
                colorRow.appendChild(clearColorBtn);
                body.appendChild(colorRow);
            }

            body.appendChild(_dmMakeSectionLabel("Position"));
            const moveRow = document.createElement("div");
            moveRow.className = "isdl-dm-move-row";
            const upBtn = document.createElement("button");
            upBtn.type = "button";
            upBtn.className = "isdl-dm-panel-btn";
            upBtn.innerHTML = \`<i class="fa-solid fa-arrow-up"></i> Up\`;
            upBtn.addEventListener("click", e => { e.stopPropagation(); _dmMoveNode(pageKey, node, -1); });
            const downBtn = document.createElement("button");
            downBtn.type = "button";
            downBtn.className = "isdl-dm-panel-btn";
            downBtn.innerHTML = \`<i class="fa-solid fa-arrow-down"></i> Down\`;
            downBtn.addEventListener("click", e => { e.stopPropagation(); _dmMoveNode(pageKey, node, 1); });
            moveRow.appendChild(upBtn);
            moveRow.appendChild(downBtn);
            body.appendChild(moveRow);

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "isdl-dm-panel-btn danger";
            removeBtn.style.width = "100%";
            removeBtn.innerHTML = \`<i class="fa-solid fa-trash"></i> Remove\`;
            removeBtn.addEventListener("click", e => {
                e.stopPropagation();
                const found = _dmFindAnywhere("static", node.id);
                if (found) found.parentChildren.splice(found.index, 1);
                _dm.selected = null;
                _dmApplyPreview();
            });
            body.appendChild(removeBtn);
        }

        function _dmMoveNode(pageKey, node, delta) {
            const kind = node.kind === "field" ? "field" : node.kind === "static" ? "static" : "section";
            const key = node.kind === "field" ? node.name : node.id;
            const found = _dmFindNode(pageKey, kind, key);
            if (!found) return;
            const { parentChildren, index } = found;
            const newIdx = index + delta;
            if (newIdx < 0 || newIdx >= parentChildren.length) return;
            parentChildren.splice(index, 1);
            parentChildren.splice(newIdx, 0, node);
            _dmApplyPreview();
        }

        // ── Open / close ──────────────────────────────────────────────────────

        function _openDesignMode(doc, btn) {
            if (_dm) {
                _closeDesignMode();
                return;
            }

            const sheetApp = doc.sheet;
            if (!sheetApp) return ui.notifications?.warn("[isdl-dev] Sheet not found.");
            const sheetEl = sheetApp.element instanceof HTMLElement ? sheetApp.element : sheetApp.element?.[0];
            const windowContent = sheetEl?.querySelector(".window-content") ?? sheetEl;
            if (!windowContent) return;

            const docType = doc.documentName === "Actor" ? "actors" : "items";
            const docKey = (doc.type ?? "").toLowerCase();

            const docTree = LAYOUT_TREE[docType]?.[docKey];
            if (!docTree) {
                return ui.notifications?.warn(\`[isdl-dev] No layout tree for \${docType}/\${docKey}\`);
            }

            // Deep-clone the tree so mutations don't affect the static constant
            const tree = structuredClone(docTree);
            const appRoot = windowContent.querySelector(".v-application") ?? windowContent.firstElementChild;

            const panelEl = _dmBuildPanel(docType, docKey);
            const previewStyleEl = document.createElement("style");
            previewStyleEl.dataset.isdlDmPreview = "1";

            _dm = {
                doc, sheetEl, windowContent, appRoot, docType, docKey,
                tree, selected: null, panelEl, previewStyleEl,
                listeners: [], dragging: null, btn,
            };

            // Activate container layout
            windowContent.classList.add("isdl-dm-active");
            windowContent.style.display = "flex";
            if (appRoot) {
                appRoot.style.flex = "1 1 auto";
                appRoot.style.minWidth = "0";
            }

            windowContent.appendChild(panelEl);
            document.head.appendChild(previewStyleEl);

            // Attach delegated event listeners (capture phase)
            const onClick = e => _dmHandleClick(e);
            const onDragStart = e => _dmHandleDragStart(e);
            const onDragOver = e => _dmHandleDragOver(e);
            const onDragLeave = e => _dmHandleDragLeave(e);
            const onDrop = e => _dmHandleDrop(e);
            const onDragEnd = e => _dmHandleDragEnd(e);

            windowContent.addEventListener("click", onClick, true);
            windowContent.addEventListener("dragstart", onDragStart, true);
            windowContent.addEventListener("dragover", onDragOver, true);
            windowContent.addEventListener("dragleave", onDragLeave, true);
            windowContent.addEventListener("drop", onDrop, true);
            windowContent.addEventListener("dragend", onDragEnd, true);

            _dm.listeners = [
                ["click", onClick, true],
                ["dragstart", onDragStart, true],
                ["dragover", onDragOver, true],
                ["dragleave", onDragLeave, true],
                ["drop", onDrop, true],
                ["dragend", onDragEnd, true],
            ];

            btn.classList.add("active");
            _dmApplyPreview();
        }

        function _closeDesignMode() {
            if (!_dm) return;
            if (_dmStatusInterval) { clearInterval(_dmStatusInterval); _dmStatusInterval = null; }
            const { windowContent, appRoot, panelEl, previewStyleEl, listeners, btn } = _dm;

            // Remove event listeners
            for (const [type, handler, capture] of listeners) {
                windowContent.removeEventListener(type, handler, capture);
            }

            // Remove panel and preview style
            panelEl?.remove();
            previewStyleEl?.remove();

            // Remove DM class and reset flex
            windowContent.classList.remove("isdl-dm-active");
            windowContent.style.display = "";
            if (appRoot) {
                appRoot.style.flex = "";
                appRoot.style.minWidth = "";
            }

            // Remove synthesised static DOM elements
            windowContent.querySelectorAll("[data-isdl-dm-synth]").forEach(el => el.remove());

            // Restore any icon overrides applied via live preview
            windowContent.querySelectorAll("i[data-isdl-dm-orig-icon]").forEach(iconEl => {
                iconEl.className = iconEl.dataset.isdlDmOrigIcon;
                delete iconEl.dataset.isdlDmOrigIcon;
            });

            // Clean up all decorated DOM elements
            windowContent.querySelectorAll("[data-isdl-dm]").forEach(el => {
                el.removeAttribute("data-isdl-dm");
                el.removeAttribute("draggable");
                el.style.order = "";
                el.classList.remove("isdl-dm-selected", "isdl-dm-drop-before", "isdl-dm-drop-after", "isdl-dm-drop-into", "isdl-dm-hidden");
            });

            btn?.classList.remove("active");
            _dm = null;
        }

        // ── Interaction handlers ──────────────────────────────────────────────

        function _dmHandleClick(e) {
            if (!_dm) return;
            // Ignore clicks inside the panel
            if (_dm.panelEl?.contains(e.target)) return;

            const fieldRoot = e.target.closest("[class*='isdl-field-']");
            const sectionRoot = e.target.closest("[class*='isdl-section-']");
            const staticRoot = e.target.closest("[class*='isdl-static-']");
            const containerRoot = e.target.closest("[class*='isdl-container-']");
            const root = fieldRoot ?? staticRoot ?? sectionRoot ?? containerRoot;

            if (!root) {
                _dm.selected = null;
                _dmApplyPreview();
                return;
            }

            // Extract the key from class name: field > static > section > container
            let kind = null, key = null;
            if (fieldRoot) {
                const cls = [...fieldRoot.classList].find(c => /^isdl-field-[a-z0-9_-]/.test(c));
                if (cls) { kind = "field"; key = cls.replace("isdl-field-", ""); }
            }
            if (!kind && staticRoot) {
                const cls = [...staticRoot.classList].find(c => /^isdl-static-__static_/.test(c));
                if (cls) { kind = "static"; key = cls.replace("isdl-static-", ""); }
            }
            if (!kind && sectionRoot) {
                const cls = [...sectionRoot.classList].find(c => /^isdl-section-[a-z0-9_-]/.test(c));
                if (cls) { kind = "section"; key = cls.replace("isdl-section-", ""); }
            }
            // Item 3c: container (row/column) — lowest priority, detected via isdl-container-<id>
            if (!kind && containerRoot) {
                const cls = [...containerRoot.classList].find(c => /^isdl-container-/.test(c));
                if (cls) {
                    key = cls.replace("isdl-container-", "");
                    // Determine row vs column by looking it up in the tree
                    const foundR = _dmFindAnywhere("row", key);
                    const foundC = _dmFindAnywhere("column", key);
                    if (foundR) kind = "row";
                    else if (foundC) kind = "column";
                }
            }

            if (!kind || !key) {
                _dm.selected = null;
                _dmApplyPreview();
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const found = _dmFindAnywhere(kind, key);
            if (found) {
                _dm.selected = { pageKey: found.pageKey, node: found.node };
            } else {
                _dm.selected = null;
            }
            _dmApplyPreview();
        }

        function _dmHandleDragStart(e) {
            if (!_dm) return;
            const fieldRoot = e.target.closest("[class*='isdl-field-']");
            const staticRoot = e.target.closest("[class*='isdl-static-']");
            const sectionRoot = e.target.closest("[class*='isdl-section-']");
            const containerRoot = e.target.closest("[class*='isdl-container-']");
            const root = fieldRoot ?? staticRoot ?? sectionRoot ?? containerRoot;
            if (!root) return;

            let kind = null, key = null;
            if (fieldRoot) {
                const cls = [...fieldRoot.classList].find(c => /^isdl-field-[a-z0-9_-]/.test(c));
                if (cls) { kind = "field"; key = cls.replace("isdl-field-", ""); }
            }
            if (!kind && staticRoot) {
                const cls = [...staticRoot.classList].find(c => /^isdl-static-__static_/.test(c));
                if (cls) { kind = "static"; key = cls.replace("isdl-static-", ""); }
            }
            if (!kind && sectionRoot) {
                const cls = [...sectionRoot.classList].find(c => /^isdl-section-[a-z0-9_-]/.test(c));
                if (cls) { kind = "section"; key = cls.replace("isdl-section-", ""); }
            }
            if (!kind && containerRoot) {
                const cls = [...containerRoot.classList].find(c => /^isdl-container-/.test(c));
                if (cls) {
                    key = cls.replace("isdl-container-", "");
                    const foundR = _dmFindAnywhere("row", key);
                    const foundC = _dmFindAnywhere("column", key);
                    if (foundR) kind = "row";
                    else if (foundC) kind = "column";
                }
            }
            if (!kind || !key) return;

            _dm.dragging = { kind, key };
            e.dataTransfer.effectAllowed = "move";
        }

        function _dmHandleDragOver(e) {
            if (!_dm?.dragging) return;
            const fieldRoot = e.target.closest("[class*='isdl-field-']");
            const staticRoot = e.target.closest("[class*='isdl-static-']");
            const sectionRoot = e.target.closest("[class*='isdl-section-']");
            const containerRoot = e.target.closest("[class*='isdl-container-']");

            // Clear all indicators first
            _dm.windowContent.querySelectorAll(".isdl-dm-drop-before, .isdl-dm-drop-after, .isdl-dm-drop-into").forEach(el => {
                el.classList.remove("isdl-dm-drop-before", "isdl-dm-drop-after", "isdl-dm-drop-into");
            });

            if (fieldRoot) {
                const cls = [...fieldRoot.classList].find(c => /^isdl-field-[a-z0-9_-]/.test(c));
                if (cls) {
                    const dragKey = _dm.dragging.key;
                    const dragKind = _dm.dragging.kind;
                    const targetKey = cls.replace("isdl-field-", "");
                    if (dragKey === targetKey && dragKind === "field") return;
                    e.preventDefault();
                    const rect = fieldRoot.getBoundingClientRect();
                    const before = e.clientX < rect.left + rect.width / 2;
                    fieldRoot.classList.add(before ? "isdl-dm-drop-before" : "isdl-dm-drop-after");
                }
            } else if (staticRoot) {
                const cls = [...staticRoot.classList].find(c => /^isdl-static-__static_/.test(c));
                if (cls) {
                    const targetKey = cls.replace("isdl-static-", "");
                    if (_dm.dragging.key === targetKey) return;
                    e.preventDefault();
                    const rect = staticRoot.getBoundingClientRect();
                    const before = e.clientX < rect.left + rect.width / 2;
                    staticRoot.classList.add(before ? "isdl-dm-drop-before" : "isdl-dm-drop-after");
                }
            } else if (sectionRoot && (_dm.dragging.kind === "field" || _dm.dragging.kind === "static")) {
                // 4c: Allow dropping fields/statics into section padding/title area
                const cls = [...sectionRoot.classList].find(c => /^isdl-section-[a-z0-9_-]/.test(c));
                if (cls) {
                    e.preventDefault();
                    sectionRoot.classList.add("isdl-dm-drop-into");
                }
            } else if (sectionRoot && _dm.dragging.kind === "section") {
                const cls = [...sectionRoot.classList].find(c => /^isdl-section-[a-z0-9_-]/.test(c));
                if (cls) {
                    const targetKey = cls.replace("isdl-section-", "");
                    if (_dm.dragging.key === targetKey) return;
                    e.preventDefault();
                    const rect = sectionRoot.getBoundingClientRect();
                    const before = e.clientX < rect.left + rect.width / 2;
                    sectionRoot.classList.add(before ? "isdl-dm-drop-before" : "isdl-dm-drop-after");
                }
            } else if (containerRoot && (_dm.dragging.kind === "field" || _dm.dragging.kind === "static")) {
                // Item 3c: allow dropping fields/statics onto row/column containers
                const cls = [...containerRoot.classList].find(c => /^isdl-container-/.test(c));
                if (cls) {
                    e.preventDefault();
                    containerRoot.classList.add("isdl-dm-drop-into");
                }
            }
        }

        function _dmHandleDragLeave(e) {
            if (!_dm) return;
            // Only clear when truly leaving the element (not going to a child)
            const rel = e.relatedTarget;
            const fieldRoot = e.target.closest("[class*='isdl-field-']");
            const sectionRoot = e.target.closest("[class*='isdl-section-']");
            const containerRoot = e.target.closest("[class*='isdl-container-']");
            const root = fieldRoot ?? sectionRoot ?? containerRoot;
            if (root && !root.contains(rel)) {
                root.classList.remove("isdl-dm-drop-before", "isdl-dm-drop-after", "isdl-dm-drop-into");
            }
        }

        function _dmHandleDrop(e) {
            if (!_dm?.dragging) return;
            e.preventDefault();

            const { kind: dragKind, key: dragKey } = _dm.dragging;
            _dm.dragging = null;

            // Clear indicators
            _dm.windowContent.querySelectorAll(".isdl-dm-drop-before, .isdl-dm-drop-after, .isdl-dm-drop-into").forEach(el => {
                el.classList.remove("isdl-dm-drop-before", "isdl-dm-drop-after", "isdl-dm-drop-into");
            });

            const fieldRoot = e.target.closest("[class*='isdl-field-']");
            const staticRoot = e.target.closest("[class*='isdl-static-']");
            const sectionRoot = e.target.closest("[class*='isdl-section-']");
            const containerRoot = e.target.closest("[class*='isdl-container-']");

            const srcFound = _dmFindAnywhere(dragKind, dragKey);
            if (!srcFound) return;

            let targetKey = null, targetKind = null, insertBefore = true, dropInto = false;

            if (fieldRoot) {
                const cls = [...fieldRoot.classList].find(c => /^isdl-field-[a-z0-9_-]/.test(c));
                if (cls) {
                    targetKey = cls.replace("isdl-field-", "");
                    targetKind = "field";
                    const rect = fieldRoot.getBoundingClientRect();
                    insertBefore = e.clientX < rect.left + rect.width / 2;
                }
            } else if (staticRoot) {
                const cls = [...staticRoot.classList].find(c => /^isdl-static-__static_/.test(c));
                if (cls) {
                    targetKey = cls.replace("isdl-static-", "");
                    targetKind = "static";
                    const rect = staticRoot.getBoundingClientRect();
                    insertBefore = e.clientX < rect.left + rect.width / 2;
                }
            } else if (sectionRoot) {
                const cls = [...sectionRoot.classList].find(c => /^isdl-section-[a-z0-9_-]/.test(c));
                if (cls) {
                    targetKey = cls.replace("isdl-section-", "");
                    if (dragKind === "field" || dragKind === "static") {
                        dropInto = true;
                    } else {
                        targetKind = "section";
                        const rect = sectionRoot.getBoundingClientRect();
                        insertBefore = e.clientX < rect.left + rect.width / 2;
                    }
                }
            } else if (containerRoot && (dragKind === "field" || dragKind === "static")) {
                // Item 3c: dropping a field/static onto a container appends to its children
                const cls = [...containerRoot.classList].find(c => /^isdl-container-/.test(c));
                if (cls) {
                    const cid = cls.replace("isdl-container-", "");
                    const foundR = _dmFindAnywhere("row", cid);
                    const foundC = _dmFindAnywhere("column", cid);
                    const containerFound = foundR ?? foundC;
                    if (containerFound) {
                        srcFound.parentChildren.splice(srcFound.index, 1);
                        const containerNode = containerFound.node;
                        const children = containerNode.children ?? (containerNode.children = []);
                        children.push(srcFound.node);
                        _dmApplyPreview();
                        return;
                    }
                }
            }

            if (!targetKey) return;

            // Remove from source (MUST happen before target lookup for same-container moves)
            srcFound.parentChildren.splice(srcFound.index, 1);

            if (dropInto) {
                // Drop field/static into section — 4a: search entire tree not just source page
                const tgtFound = _dmFindAnywhere("section", targetKey);
                if (!tgtFound) return;
                const sectionNode = tgtFound.node;
                const children = sectionNode.children ?? (sectionNode.children = []);
                // Append directly to section children (not to a row sub-child)
                children.push(srcFound.node);
            } else if (targetKind) {
                // Reorder relative to target — 4a: search entire tree
                const tgtFound = _dmFindAnywhere(targetKind, targetKey);
                if (!tgtFound) return;
                // After splice above, index may have shifted if same array; re-check
                let insertIdx = tgtFound.index;
                if (!insertBefore) insertIdx++;
                tgtFound.parentChildren.splice(insertIdx, 0, srcFound.node);
            }

            _dmApplyPreview();
        }

        function _dmHandleDragEnd(e) {
            if (!_dm) return;
            _dm.dragging = null;
            _dm.windowContent.querySelectorAll(".isdl-dm-drop-before, .isdl-dm-drop-after, .isdl-dm-drop-into").forEach(el => {
                el.classList.remove("isdl-dm-drop-before", "isdl-dm-drop-after", "isdl-dm-drop-into");
            });
        }

        // ── Save ──────────────────────────────────────────────────────────────

        async function _dmSave(btn, panelEl) {
            if (!_dm) return;
            btn.disabled = true;
            btn.innerHTML = \`<i class="fa-solid fa-spinner fa-spin"></i> Saving…\`;

            const base = _dmBuildLayoutPayload();
            if (!base) {
                btn.disabled = false;
                btn.innerHTML = \`<i class="fa-solid fa-floppy-disk"></i> Save\`;
                return;
            }

            try {
                const resp = await fetch(_LAYOUT_SERVER + "/layout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: "${id}", layout: base })
                });
                const result = await resp.json();
                if (result.ok) {
                    ui.notifications.info("Layout saved — regenerate system to apply.");
                    _dmLastSyncTime = Date.now();
                    if (panelEl) _dmUpdateStatusRow(panelEl, true);
                } else {
                    ui.notifications.error("Save failed: " + (result.error ?? "unknown"));
                    if (panelEl) _dmUpdateStatusRow(panelEl, false);
                }
            } catch (err) {
                ui.notifications.error("Layout server error: " + err.message);
                if (panelEl) _dmUpdateStatusRow(panelEl, false);
            } finally {
                btn.disabled = false;
                btn.innerHTML = \`<i class="fa-solid fa-floppy-disk"></i> Save\`;
            }
        }

        // ─── Sheet overlay ────────────────────────────────────────────────────
        function _addHeaderControl(header, btn) {
            // Insert before the close button so our controls sit in the actions area,
            // not before the window icon/title (which prepend() would do).
            const closeBtn = header.querySelector(".close, [data-action='close'], [aria-label='Close']");
            if (closeBtn) closeBtn.before(btn);
            else header.append(btn);
        }

        function _activateOverlays(doc, html) {
            const root = html instanceof HTMLElement ? html : html?.[0];
            if (!root) return;

            const header = root.querySelector(".window-header, .window-controls")
                ?? root.closest(".window-app, .application")?.querySelector(".window-header, .window-controls");

            // Inspector button. Foundry v14 renders header-control icons as <i class="fa-...">
            // inside the button — FA classes directly on the button produce blank boxes.
            if (header && !header.querySelector(".isdl-inspector-btn")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-inspector-btn header-control";
                btn.innerHTML = \`<i class="fa-solid fa-magnifying-glass"></i>\`;
                btn.setAttribute("aria-label", "Inspect System Data");
                btn.setAttribute("data-tooltip", "Inspect System Data");
                btn.addEventListener("click", e => { e.preventDefault(); _openInspector(doc); });
                _addHeaderControl(header, btn);
            }

            // Design Mode button — enabled only when layout server is reachable
            if (header && !header.querySelector(".isdl-design-mode-btn")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-design-mode-btn header-control";
                btn.innerHTML = \`<i class="fa-solid fa-pen-ruler"></i>\`;
                btn.setAttribute("aria-label", "Design Mode");
                btn.setAttribute("data-tooltip", "Design Mode — checking for VS Code layout server…");
                btn.disabled = true;
                btn.style.opacity = "0.4";
                _addHeaderControl(header, btn);

                fetch(_LAYOUT_SERVER + "/status", { method: "GET" })
                    .then(r => r.ok ? r.json() : Promise.reject())
                    .then(() => {
                        btn.disabled = false;
                        btn.style.opacity = "";
                        btn.setAttribute("data-tooltip", "Design Mode");
                        btn.addEventListener("click", e => {
                            e.preventDefault();
                            _openDesignMode(doc, btn);
                        });
                    })
                    .catch(() => {
                        btn.setAttribute("data-tooltip", "Design Mode — start VS Code with your .isdl file to enable");
                    });
            }

            // System path + CSS selectors on hover for every rendered ISDL field
            // Guard: skip tooltip wiring when design mode is active (hover is suppressed anyway)
            root.querySelectorAll("[class*='isdl-']").forEach(el => {
                const input = el.querySelector("input[name^='system.'], select[name^='system.'], textarea[name^='system.']");
                if (!input) return;
                const systemPath = input.getAttribute("name");
                const { typeSelector, nameSelector } = _buildCssSelectors(el);
                el.addEventListener("mouseenter", () => {
                    if (_dm) return;
                    _showDevTooltip(el, systemPath, typeSelector, nameSelector);
                });
                el.addEventListener("mouseleave", _hideDevTooltip);
            });
        }

        // ─── Hooks ────────────────────────────────────────────────────────────
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
                const root = html instanceof HTMLElement ? html : html?.[0] ?? app.element;
                _activateOverlays(doc, root);
                console.log(\`[\${MODULE_ID}] \${hook}\`, doc?.name, doc?.system);

                // Re-render resilience: if design mode is open for this doc, re-attach after sheet re-render
                if (_dm && _dm.doc === doc) {
                    const sheetEl = app.element instanceof HTMLElement ? app.element : app.element?.[0];
                    const windowContent = sheetEl?.querySelector(".window-content") ?? sheetEl;
                    if (windowContent && windowContent !== _dm.windowContent) {
                        // windowContent was replaced — re-wire listeners
                        for (const [type, handler, capture] of _dm.listeners) {
                            _dm.windowContent.removeEventListener(type, handler, capture);
                        }
                        _dm.windowContent = windowContent;
                        for (const [type, handler, capture] of _dm.listeners) {
                            windowContent.addEventListener(type, handler, capture);
                        }
                    }
                    if (windowContent) {
                        windowContent.classList.add("isdl-dm-active");
                        windowContent.style.display = "flex";
                        const appRoot = windowContent.querySelector(".v-application") ?? windowContent.firstElementChild;
                        if (appRoot) { appRoot.style.flex = "1 1 auto"; appRoot.style.minWidth = "0"; }
                        if (_dm.panelEl && !_dm.panelEl.isConnected) windowContent.appendChild(_dm.panelEl);
                        requestAnimationFrame(() => _dmApplyPreview());
                    }
                }
            });
        }

        for (const hook of ["renderItemSheet", "renderItemSheetV2"]) {
            Hooks.on(hook, (app, html) => {
                const doc = app.item ?? app.document;
                const root = html instanceof HTMLElement ? html : html?.[0] ?? app.element;
                _activateOverlays(doc, root);
                console.log(\`[\${MODULE_ID}] \${hook}\`, doc?.name, doc?.system);

                // Re-render resilience
                if (_dm && _dm.doc === doc) {
                    const sheetEl = app.element instanceof HTMLElement ? app.element : app.element?.[0];
                    const windowContent = sheetEl?.querySelector(".window-content") ?? sheetEl;
                    if (windowContent && windowContent !== _dm.windowContent) {
                        for (const [type, handler, capture] of _dm.listeners) {
                            _dm.windowContent.removeEventListener(type, handler, capture);
                        }
                        _dm.windowContent = windowContent;
                        for (const [type, handler, capture] of _dm.listeners) {
                            windowContent.addEventListener(type, handler, capture);
                        }
                    }
                    if (windowContent) {
                        windowContent.classList.add("isdl-dm-active");
                        windowContent.style.display = "flex";
                        const appRoot = windowContent.querySelector(".v-application") ?? windowContent.firstElementChild;
                        if (appRoot) { appRoot.style.flex = "1 1 auto"; appRoot.style.minWidth = "0"; }
                        if (_dm.panelEl && !_dm.panelEl.isConnected) windowContent.appendChild(_dm.panelEl);
                        requestAnimationFrame(() => _dmApplyPreview());
                    }
                }
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
