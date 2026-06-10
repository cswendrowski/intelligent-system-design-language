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
                .isdl-dm-active .isdl-section { pointer-events: auto !important; cursor: pointer; }
                .isdl-dm-active .isdl-section * { pointer-events: none !important; }
                .isdl-dm-active .isdl-field { pointer-events: auto !important; cursor: pointer; }
                .isdl-dm-active .isdl-field * { pointer-events: none !important; }
                .isdl-dm-selected { outline: 2px solid #4a9eff !important; outline-offset: 1px; }
                .isdl-dm-drop-before { box-shadow: -3px 0 0 0 #ffaa4a !important; }
                .isdl-dm-drop-after { box-shadow: 3px 0 0 0 #ffaa4a !important; }
                .isdl-dm-drop-into { outline: 2px solid #ffaa4a !important; outline-offset: 1px; }
                /* ── Design Mode sidebar panel ── */
                .isdl-dm-panel {
                    width: 240px;
                    flex-shrink: 0;
                    border-left: 1px solid #1a2a4a;
                    overflow-y: auto;
                    background: #0a0e18;
                    display: flex;
                    flex-direction: column;
                    color: #c0d8f0;
                    font-family: var(--font-primary, sans-serif);
                    font-size: 12px;
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
                .isdl-dm-panel-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
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
                if (n.children) _dmWalkNodes(n.children, visitor);
            }
        }

        function _dmFindNode(pageKey, kind, key) {
            const page = _dm.tree.pages[pageKey];
            if (!page) return null;
            let result = null;
            function walk(nodes, parent) {
                for (let i = 0; i < nodes.length; i++) {
                    const n = nodes[i];
                    const matches = kind === "field" ? n.kind === "field" && n.name === key
                                                     : n.kind !== "field" && n.id === key;
                    if (matches) {
                        result = { node: n, parent, index: i, parentChildren: nodes };
                        return true;
                    }
                    if (n.children && walk(n.children, n)) return true;
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

        function _dmNodeRoot(node) {
            return node.kind === "field" ? _dmFieldRoot(node.name) : _dmSectionRoot(node.id);
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
                        const name = node.name;
                        css += \`.isdl-dm-active .isdl-field-\${name} .v-field-label,\`
                             + \` .isdl-dm-active .isdl-field-\${name} .v-label,\`
                             + \` .isdl-dm-active .isdl-field-\${name} legend { display: none !important; }\\n\`;
                    }
                    if (node.kind === "section" && node.hideLabel === true) {
                        const id = node.id;
                        css += \`.isdl-dm-active .isdl-section-\${id} .v-card-title { display: none !important; }\\n\`;
                    }
                });
            }
            return css;
        }

        function _dmApplyOrderToDOMChildren(nodes) {
            let order = 0;
            for (const node of nodes) {
                const el = _dmNodeRoot(node);
                if (!el) {
                    order++;
                    continue;
                }
                el.style.order = String(order++);
                el.setAttribute("data-isdl-dm", "1");
                el.draggable = true;
            }
        }

        function _dmApplyPreview() {
            if (!_dm) return;

            // Rebuild preview CSS
            _dm.previewStyleEl.textContent = _dmBuildPreviewCss();

            // DOM pass: set CSS order + draggable on addressable nodes per page
            for (const [pageKey, page] of Object.entries(_dm.tree.pages)) {
                // Top-level children
                _dmApplyOrderToDOMChildren(page.children);
                // Recurse into containers
                _dmWalkNodes(page.children, node => {
                    if (node.kind !== "field" && node.children) {
                        _dmApplyOrderToDOMChildren(node.children);
                    }
                });
            }

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
            saveBtn.addEventListener("click", e => { e.stopPropagation(); _dmSave(saveBtn); });

            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "isdl-dm-panel-btn";
            closeBtn.innerHTML = \`<i class="fa-solid fa-times"></i>\`;
            closeBtn.style.cssText = "padding:3px 6px;";
            closeBtn.addEventListener("click", e => { e.stopPropagation(); _closeDesignMode(); });

            header.appendChild(saveBtn);
            header.appendChild(closeBtn);
            panel.appendChild(header);

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
            }
        }

        function _dmMakeSectionLabel(text) {
            const div = document.createElement("div");
            div.className = "isdl-dm-section-label";
            div.textContent = text;
            return div;
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
            });
            body.appendChild(iconInput);

            const regenNote = document.createElement("p");
            regenNote.className = "isdl-dm-panel-note";
            regenNote.textContent = "Color and icon apply on regenerate.";
            body.appendChild(regenNote);

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
                _dmApplyPreview();
            });
            body.appendChild(resetBtn);
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

        function _dmMoveNode(pageKey, node, delta) {
            const kind = node.kind === "field" ? "field" : "container";
            const key = node.kind === "field" ? node.name : node.id;
            const found = _dmFindNode(pageKey, kind === "field" ? "field" : "section", key);
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

            // Clean up all decorated DOM elements
            windowContent.querySelectorAll("[data-isdl-dm]").forEach(el => {
                el.removeAttribute("data-isdl-dm");
                el.removeAttribute("draggable");
                el.style.order = "";
                el.classList.remove("isdl-dm-selected", "isdl-dm-drop-before", "isdl-dm-drop-after", "isdl-dm-drop-into");
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
            const root = fieldRoot ?? sectionRoot;

            if (!root) {
                _dm.selected = null;
                _dmApplyPreview();
                return;
            }

            // Extract the key from class name, prefer field over section
            let kind = null, key = null;
            if (fieldRoot) {
                const cls = [...fieldRoot.classList].find(c => /^isdl-field-[a-z0-9_-]/.test(c));
                if (cls) { kind = "field"; key = cls.replace("isdl-field-", ""); }
            }
            if (!kind && sectionRoot) {
                const cls = [...sectionRoot.classList].find(c => /^isdl-section-[a-z0-9_-]/.test(c));
                if (cls) { kind = "section"; key = cls.replace("isdl-section-", ""); }
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
            const sectionRoot = e.target.closest("[class*='isdl-section-']");
            const root = fieldRoot ?? sectionRoot;
            if (!root) return;

            let kind = null, key = null;
            if (fieldRoot) {
                const cls = [...fieldRoot.classList].find(c => /^isdl-field-[a-z0-9_-]/.test(c));
                if (cls) { kind = "field"; key = cls.replace("isdl-field-", ""); }
            }
            if (!kind && sectionRoot) {
                const cls = [...sectionRoot.classList].find(c => /^isdl-section-[a-z0-9_-]/.test(c));
                if (cls) { kind = "section"; key = cls.replace("isdl-section-", ""); }
            }
            if (!kind || !key) return;

            _dm.dragging = { kind, key };
            e.dataTransfer.effectAllowed = "move";
        }

        function _dmHandleDragOver(e) {
            if (!_dm?.dragging) return;
            const fieldRoot = e.target.closest("[class*='isdl-field-']");
            const sectionRoot = e.target.closest("[class*='isdl-section-']");

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
            } else if (sectionRoot && _dm.dragging.kind === "field") {
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
            }
        }

        function _dmHandleDragLeave(e) {
            if (!_dm) return;
            // Only clear when truly leaving the element (not going to a child)
            const rel = e.relatedTarget;
            const fieldRoot = e.target.closest("[class*='isdl-field-']");
            const sectionRoot = e.target.closest("[class*='isdl-section-']");
            const root = fieldRoot ?? sectionRoot;
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
            const sectionRoot = e.target.closest("[class*='isdl-section-']");

            const srcFound = _dmFindAnywhere(dragKind, dragKey);
            if (!srcFound) return;
            const pageKey = srcFound.pageKey;

            let targetKey = null, targetKind = null, insertBefore = true, dropInto = false;

            if (fieldRoot) {
                const cls = [...fieldRoot.classList].find(c => /^isdl-field-[a-z0-9_-]/.test(c));
                if (cls) {
                    targetKey = cls.replace("isdl-field-", "");
                    targetKind = "field";
                    const rect = fieldRoot.getBoundingClientRect();
                    insertBefore = e.clientX < rect.left + rect.width / 2;
                }
            } else if (sectionRoot) {
                const cls = [...sectionRoot.classList].find(c => /^isdl-section-[a-z0-9_-]/.test(c));
                if (cls) {
                    targetKey = cls.replace("isdl-section-", "");
                    if (dragKind === "field") {
                        dropInto = true;
                    } else {
                        targetKind = "section";
                        const rect = sectionRoot.getBoundingClientRect();
                        insertBefore = e.clientX < rect.left + rect.width / 2;
                    }
                }
            }

            if (!targetKey) return;

            // Remove from source
            srcFound.parentChildren.splice(srcFound.index, 1);

            if (dropInto) {
                // Drop field into section
                const tgtFound = _dmFindNode(pageKey, "section", targetKey);
                if (!tgtFound) return;
                const sectionNode = tgtFound.node;
                const children = sectionNode.children ?? (sectionNode.children = []);
                // Append to last row child if exists, else to children directly
                const lastChild = children[children.length - 1];
                if (lastChild && lastChild.kind === "row") {
                    lastChild.children.push(srcFound.node);
                } else {
                    children.push(srcFound.node);
                }
            } else if (targetKind) {
                // Reorder relative to target
                const tgtFound = _dmFindNode(pageKey, targetKind, targetKey);
                if (!tgtFound) return;
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

        async function _dmSave(btn) {
            if (!_dm) return;
            btn.disabled = true;
            btn.innerHTML = \`<i class="fa-solid fa-spinner fa-spin"></i> Saving…\`;

            const { docType, docKey, tree } = _dm;

            // Build clean layout nodes from the current tree
            function stripNode(node) {
                if (node.kind === "field") {
                    const out = { kind: "field", name: node.name };
                    if (node.size) out.size = node.size;
                    if (node.hideLabel === true) out.hideLabel = true;
                    if (node.color) out.color = node.color;
                    if (node.icon) out.icon = node.icon;
                    return out;
                }
                const out = { kind: node.kind, id: node.id };
                if (node.kind === "section" && node.hideLabel === true) out.hideLabel = true;
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

            try {
                const resp = await fetch(_LAYOUT_SERVER + "/layout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: "${id}", layout: base })
                });
                const result = await resp.json();
                if (result.ok) {
                    ui.notifications.info("Layout saved — regenerate system to apply.");
                } else {
                    ui.notifications.error("Save failed: " + (result.error ?? "unknown"));
                }
            } catch (err) {
                ui.notifications.error("Layout server error: " + err.message);
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
