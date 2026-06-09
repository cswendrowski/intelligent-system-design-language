import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Entry } from '../../language/generated/ast.js';
import { isConfigExpression } from '../../language/generated/ast.js';

export function generateDevModule(entry: Entry, id: string, devDest: string) {
    const scriptsDir = path.join(devDest, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
    }

    const title = (entry.config.body.find(x => isConfigExpression(x) && x.type === 'label') as any)?.value ?? id;
    const author = (entry.config.body.find(x => isConfigExpression(x) && x.type === 'author') as any)?.value ?? '';

    generateModuleJson(id, title, author, devDest);
    generateDevTools(id, title, devDest);
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

function generateDevTools(id: string, title: string, devDest: string) {
    const filePath = path.join(devDest, 'scripts', 'dev-tools.mjs');
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
                .isdl-design-mode-btn { opacity: 0.4; cursor: not-allowed !important; }
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

        // ─── Sheet overlay ──────────────────────────────────────────────────
        function _activateOverlays(html) {
            const root = html instanceof HTMLElement ? html : html?.[0];
            if (!root) return;

            // Design Mode stub button (greyed out until VS Code HTTP server is up)
            const controls = root.closest(".window-app")?.querySelector(".window-controls");
            if (controls && !controls.querySelector(".isdl-design-mode-btn")) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "isdl-design-mode-btn header-control fa-solid fa-pen-ruler";
                btn.setAttribute("aria-label", "Design Mode");
                btn.setAttribute("data-tooltip", "Design Mode — open your .isdl file in VS Code to enable");
                btn.disabled = true;
                controls.prepend(btn);
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
        for (const hook of ["renderActorSheet", "renderActorSheetV2"]) {
            Hooks.on(hook, (app, html) => {
                _activateOverlays(html instanceof HTMLElement ? html : html?.[0] ?? app.element);
                console.log(\`[\${MODULE_ID}] \${hook}\`, app.actor?.name, app.actor?.system);
            });
        }

        for (const hook of ["renderItemSheet", "renderItemSheetV2"]) {
            Hooks.on(hook, (app, html) => {
                _activateOverlays(html instanceof HTMLElement ? html : html?.[0] ?? app.element);
                console.log(\`[\${MODULE_ID}] \${hook}\`, app.item?.name, app.item?.system);
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
