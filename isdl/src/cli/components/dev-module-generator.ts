import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Entry } from '../../language/generated/ast.js';
import { isConfigExpression, isActor, isItem } from '../../language/generated/ast.js';

export function generateDevModule(entry: Entry, id: string, devDest: string) {
    const scriptsDir = path.join(devDest, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
    }

    const title = (entry.config.body.find(x => isConfigExpression(x) && x.type === 'label') as any)?.value ?? id;
    const author = (entry.config.body.find(x => isConfigExpression(x) && x.type === 'author') as any)?.value ?? '';

    // Foundry fires `render${ClassName}` — for our generated sheets that's `render<Doc>VueSheet`
    // (e.g. renderHeroVueSheet), NOT the generic renderActorSheet. Hook the real class names so
    // the dev overlays actually attach.
    const sheetHooks = entry.documents
        .filter(d => isActor(d) || isItem(d))
        .map(d => `render${d.name}VueSheet`);

    generateModuleJson(id, title, author, devDest);
    generateDevTools(id, title, devDest, sheetHooks);
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

function generateDevTools(id: string, title: string, devDest: string, sheetHooks: string[]) {
    const filePath = path.join(devDest, 'scripts', 'dev-tools.mjs');
    const allRenderHooks = ['renderActorSheet', 'renderActorSheetV2', 'renderItemSheet', 'renderItemSheetV2', ...sheetHooks];
    const fileNode = expandToNode`
        // ${id}-dev — developer companion for ${title}
        // Regenerated on each build. Customise ${id}-custom.mjs instead.

        const MODULE_ID = "${id}-dev";

        // ─── Vue DevTools ───────────────────────────────────────────────────
        // Only enable if the Vue DevTools extension is already installed —
        // creating a stub hook causes Vue to call emit() on a no-op object and break.
        if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
            window.__VUE_DEVTOOLS_GLOBAL_HOOK__.enabled = true;
        }

        // ─── Tooltip styles ─────────────────────────────────────────────────
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
                    pointer-events: none;
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
                .isdl-pick-mode-btn { opacity: 0.4; transition: opacity 0.15s, color 0.15s; }
                .isdl-pick-mode-btn.isdl-pick-active { opacity: 1; color: #f6a623 !important; }
                .isdl-dev-tooltip.isdl-dev-locked { border-color: #f6a623; box-shadow: 0 4px 16px rgba(0,0,0,.8); pointer-events: auto; }
                .isdl-dev-tip-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #2a3a5a; }
                .isdl-dev-tip-title { font-size: 10px; font-weight: bold; color: #f6a623; letter-spacing: 0.05em; }
                .isdl-dev-dismiss { background: none; border: 1px solid #f6a623; border-radius: 2px; color: #f6a623; cursor: pointer; padding: 0 5px; font-size: 11px; line-height: 1.6; }
                .isdl-dev-dismiss:hover { background: #f6a623; color: #1a1a2e; }
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

        // ─── Pick-mode field inspector ──────────────────────────────────────
        let _pickMode = false;
        let _hoverTip = null;
        let _lockedTip = null;

        function _setPickMode(enabled) {
            _pickMode = enabled;
            if (!enabled) { _clearLockedTip(); _clearHoverTip(); }
            document.querySelectorAll(".isdl-pick-mode-btn")
                .forEach(b => b.classList.toggle("isdl-pick-active", enabled));
            console.log(\`[\${MODULE_ID}] pick mode \${enabled ? "ON — hover a field, click to lock" : "off"}\`);
        }
        function _clearHoverTip() { _hoverTip?.remove(); _hoverTip = null; }
        function _clearLockedTip() { _lockedTip?.remove(); _lockedTip = null; }

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

        function _buildTipBody(systemPath, typeSelector, nameSelector) {
            return \`<div class="isdl-dev-section-header"><i class="fa-solid fa-database"></i> Data Path<span class="isdl-dev-section-hint">for macros &amp; scripts</span></div>\`
                + _makeRow("fa-solid fa-folder-open", "system path", systemPath)
                + \`<div class="isdl-dev-section-header" style="margin-top:8px"><i class="fa-solid fa-paintbrush"></i> CSS Selectors<span class="isdl-dev-section-hint">for custom.css</span></div>\`
                + (typeSelector ? _makeRow("fa-solid fa-layer-group", "all fields of this type", typeSelector) : "")
                + (nameSelector ? _makeRow("fa-solid fa-crosshairs", "just this field", nameSelector) : "");
        }

        function _positionTip(tip, el) {
            const rect = el.getBoundingClientRect();
            tip.style.top = (rect.bottom + 4) + "px";
            tip.style.left = rect.left + "px";
        }

        function _showHoverTip(el, systemPath, typeSelector, nameSelector) {
            _clearHoverTip();
            if (!_pickMode || _lockedTip) return;
            const tip = document.createElement("div");
            tip.className = "isdl-dev-tooltip";
            tip.innerHTML = _buildTipBody(systemPath, typeSelector, nameSelector);
            _positionTip(tip, el);
            document.body.appendChild(tip);
            _hoverTip = tip;
        }

        function _lockTip(el, systemPath, typeSelector, nameSelector) {
            _clearHoverTip();
            _clearLockedTip();
            const tip = document.createElement("div");
            tip.className = "isdl-dev-tooltip isdl-dev-locked";
            tip.innerHTML =
                \`<div class="isdl-dev-tip-header"><span class="isdl-dev-tip-title"><i class="fa-solid fa-crosshairs"></i> FIELD INFO</span><button type="button" class="isdl-dev-dismiss" title="Dismiss">&times;</button></div>\`
                + _buildTipBody(systemPath, typeSelector, nameSelector);
            tip.querySelector(".isdl-dev-dismiss").addEventListener("click", e => { e.stopPropagation(); _clearLockedTip(); });
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
            _positionTip(tip, el);
            document.body.appendChild(tip);
            _lockedTip = tip;
        }

        // Delegated field listeners — attached once on document, so they work for Vue-mounted
        // fields regardless of render timing and survive sheet re-renders.
        let _pickWired = false;
        function _wirePickDelegation() {
            if (_pickWired) return;
            _pickWired = true;
            let _curField = null;
            const _fieldAt = t => {
                const el = t?.closest?.("[class*='isdl-']");
                if (!el) return null;
                const input = el.querySelector("input[name^='system.'], select[name^='system.'], textarea[name^='system.']");
                if (!input) return null;
                const { typeSelector, nameSelector } = _buildCssSelectors(el);
                return { el, systemPath: input.getAttribute("name"), typeSelector, nameSelector };
            };
            document.addEventListener("mouseover", e => {
                if (!_pickMode) return;
                const f = _fieldAt(e.target);
                if (f && f.el !== _curField) { _curField = f.el; _showHoverTip(f.el, f.systemPath, f.typeSelector, f.nameSelector); }
                else if (!f && _curField) { _curField = null; _clearHoverTip(); }
            });
            document.addEventListener("click", e => {
                if (!_pickMode) return;
                const f = _fieldAt(e.target);
                if (f) { e.stopPropagation(); _lockTip(f.el, f.systemPath, f.typeSelector, f.nameSelector); }
            }, true);
        }

        function _buildCssSelectors(el) {
            const classes = [...el.classList];
            // e.g. isdl-field-brawn → "Just this field"
            const nameClass = classes.find(c => /^isdl-field-[a-z]/.test(c));
            // e.g. isdl-number, isdl-attribute — the field type, skip field/visibility/name classes
            const typeClass = classes.find(c =>
                c.startsWith("isdl-") &&
                c !== "isdl-field" &&
                !c.startsWith("isdl-visibility-") &&
                !c.startsWith("isdl-field-")
            );
            return {
                typeSelector: typeClass ? \`.\${typeClass}\` : null,
                nameSelector: nameClass ? \`.\${nameClass}\` : null
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
                            Use these paths in macros, roll formulas, and scripts.
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

        // ─── Sheet overlay ──────────────────────────────────────────────────
        function _addHeaderControl(header, btn) {
            const closeBtn = header.querySelector(".close, [data-action='close'], [aria-label='Close']");
            if (closeBtn) closeBtn.before(btn); else header.append(btn);
        }

        function _activateOverlays(doc, html) {
            const root = html instanceof HTMLElement ? html : html?.[0];
            if (!root) return;

            // v14: header is a direct child of the form (root IS the sheet element)
            // v12/v13: header is a sibling of root inside .window-app
            const header = root.querySelector(".window-header, .window-controls")
                ?? root.closest(".window-app, .application")?.querySelector(".window-header, .window-controls");

            // System Data Viewer button — icon as an <i> child (not a class on the button),
            // inserted before the close control so it sits on the right.
            if (header && !header.querySelector(".isdl-inspector-btn")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-inspector-btn header-control";
                btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
                btn.setAttribute("aria-label", "Inspect System Data");
                btn.setAttribute("data-tooltip", "Inspect System Data");
                btn.addEventListener("click", e => { e.preventDefault(); _openInspector(doc); });
                _addHeaderControl(header, btn);
            }

            // Pick Mode button — toggles the field path/CSS picker: hover a field to preview
            // its data path + CSS selectors, click to lock the tooltip.
            if (header && !header.querySelector(".isdl-pick-mode-btn")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-pick-mode-btn header-control";
                btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
                btn.setAttribute("aria-label", "Pick Mode");
                btn.setAttribute("data-tooltip", "Pick Mode — hover a field to preview its data path & CSS, click to lock the tooltip");
                btn.addEventListener("click", e => { e.preventDefault(); _setPickMode(!_pickMode); });
                _addHeaderControl(header, btn);
            }

            // Field hover/click is handled by a single delegated listener (wired once below),
            // so it works for Vue-mounted fields regardless of render timing.
            _wirePickDelegation();
        }

        // ─── Verbose logging ────────────────────────────────────────────────
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

        // ApplicationV2 (Foundry v13+) fires renderActorSheetV2 / renderItemSheetV2
        // ApplicationV1 fires the legacy renderActorSheet / renderItemSheet
        // Foundry fires render<ClassName>; our sheets are <Doc>VueSheet. The generic
        // ActorSheet/ItemSheet names are kept as a fallback for other Foundry versions.
        for (const hook of ${JSON.stringify(allRenderHooks)}) {
            Hooks.on(hook, (app, html) => {
                const doc = app.actor ?? app.item ?? app.document;
                _activateOverlays(doc, html instanceof HTMLElement ? html : html?.[0] ?? app.element);
                console.log(\`[\${MODULE_ID}] \${hook}\`, doc?.name);
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
