import {
    Document,
    Entry,
    HtmlExp,
} from '../language/generated/ast.js';
import {
    isActor,
    isItem,
    isHtmlExp,
    isConfigExpression,
} from "../language/generated/ast.js"
import { expandToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractDestinationAndName } from './cli-util.js';
import { generateCustomCss, generateSystemCss } from './components/css-generator.js';
import { generateLanguageJson } from './components/language-generator.js';
import { generateExtendedDocumentClasses } from './components/derived-data-generator.js';
import { generateDocumentDataModel, generateUuidDocumentField, generateUuidDocumentArrayField } from './components/datamodel-generator.js';
import { fileURLToPath } from 'url';
import { generateActiveEffectHandlebars, generateBaseActiveEffectBaseSheet as generateActiveEffectBaseSheet } from './components/active-effect-sheet-generator.js';
import { generateChatCardClass, generateStandardChatCardTemplate } from './components/chat-card-generator.js';
import { getAllOfType } from './components/utils.js';
import { generateCanvasToken, generateTokenDocument } from './components/token-generator.js';
import { generateVue, runViteBuild } from './components/vue/vue-generator.js';
import {generateInitHookMjs} from "./components/init-hook-generator.js";
import {generateReadyHookMjs} from "./components/ready-hook-generator.js";
import {generateHotbarDropHookMjs} from "./components/hotbar-drop-hook-generator.js";
import {generateMeasuredTemplatePreview} from "./components/measured-template-preview.js";
import {generateDamageRoll} from "./components/damage-roll-generator.js";

export async function generateJavaScript(entry: Entry, filePath: string, destination: string | undefined): Promise<string> {
    const config = entry.config;

    const data = extractDestinationAndName(filePath, destination);
    const id = (config.body.find(x => isConfigExpression(x) && x.type == "id")! as any).value;
    data.destination = path.join(data.destination, id);
    console.log("Writing to " + data.destination);

    if (!fs.existsSync(path.join(data.destination, "system"))) {
        fs.mkdirSync(path.join(data.destination, "system"), { recursive: true });
    }

    // Libraries
    copyProgressBarJs(data.destination);

    // Images
    copyImage("isdl.png", data.destination);
    copyImage("paperdoll_default.png", data.destination);
    copyImage("missing-character.png", data.destination);

    // Generic shared components
    generateSystemCss(entry, id, data.destination);
    generateCustomCss(entry, id, data.destination);
    generateUuidDocumentField(data.destination);
    generateUuidDocumentArrayField(data.destination);

    generateActiveEffectBaseSheet(entry, id, data.destination);
    generateActiveEffectHandlebars(id, entry, data.destination);
    generateSystemJson(entry, id, data.destination);
    generateLanguageJson(entry, id, data.destination);
    generateTemplateJson(entry, id, data.destination);
    generateExtendedDocumentClasses(entry, id, data.destination);
    generateMeasuredTemplatePreview(data.destination);
    generateEntryMjs(entry, id, data.destination);
    generateCustomEntryMjs(entry, id, data.destination);
    generateInitHookMjs(entry, id, data.destination);
    generateReadyHookMjs(entry, id, data.destination);
    generateHotbarDropHookMjs(entry, id, data.destination);
    generateHotReloadHookMjs(entry, id, data.destination);
    generateChatCardClass(entry, data.destination);
    generateStandardChatCardTemplate(data.destination);
    generateRenderChatLogHookMjs(entry, id, data.destination);
    generateRenderSettingsHookMjs(entry, id, data.destination);
    generateExtendedRoll(entry, id, data.destination);
    generateDamageRoll(entry, id, data.destination);
    generateContextMenu2(entry, id, data.destination);
    generateDocumentCreateHbs(entry, id, data.destination);
    generateCombatant(entry, id, data.destination);
    generateCanvasToken(entry, id, data.destination);
    generateTokenDocument(entry, id, data.destination);
    generateVue(entry, id, data.destination);

    // Documents
    entry.documents.forEach(x => {
        generateDocumentDataModel(entry, x, data.destination);
    });

    console.log("Running Vite build");
    await runViteBuild(data.destination);
    console.log("Vite build complete");

    return data.destination;
}

function copyProgressBarJs(destination: string) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Make the scripts and css directories
    const jsDir = path.join(destination, "scripts");

    if (!fs.existsSync(jsDir)) {
        fs.mkdirSync(jsDir, { recursive: true });
    }

    // Copy the files
    const jsFilePath = path.join(destination, "scripts", "progressbar.min.js");

    fs.copyFileSync(path.join(__dirname, "../progressbar.min.js"), jsFilePath);
}

function copyImage(source: string, destination: string) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const imgDir = path.join(destination, "img");

    if (!fs.existsSync(imgDir)) {
        fs.mkdirSync(imgDir, { recursive: true });
    }

    // Copy the files
    const imgFilePath = path.join(imgDir, source);

    fs.copyFileSync(path.join(__dirname, "../" + source), imgFilePath);
}

function getExtensionVersion(): string | undefined {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    var packageJsonPath = path.join(__dirname, "../extension/package.json");
    console.log(packageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
}

function generateSystemJson(entry: Entry, id: string, destination: string) {
    const generatedFilePath = path.join(destination, `system.json`);

    // Get the version of the extension
    const extensionVersion = getExtensionVersion();

    const fileNode = expandToNode`
        {
            "id": "${id}",
            "title": "${(entry.config.body.find(x => isConfigExpression(x) && x.type == "label") as any)?.value}",
            "description": "${(entry.config.body.find(x => isConfigExpression(x) && x.type == "description") as any)?.value}",
            "version": "This is auto replaced",
            "compatibility": {
                "minimum": 12,
                "verified": 14
            },
            "authors": [
                {
                    "name": "${(entry.config.body.find(x => isConfigExpression(x) && x.type == "author") as any)?.value}"
                }
            ],
            "scripts": [
            ],
            "esmodules": [
                "system/${id}-main.mjs",
                "system/${id}-custom.mjs"
            ],
            "styles": [
                "css/materialdesignicons.min.css",
                "css/${id}.css",
                "css/${id}-custom.css"
            ],
            "license": "LICENSE",
            "readme": "README.md",
            "socket": true,
            "languages": [
              {
                "lang": "en",
                "name": "English",
                "path": "lang/en.json"
              }
            ],
            "flags": {
                "hotReload": {
                    "extensions": ["css", "hbs", "json", "mjs"],
                    "paths": ["css", "system", "lang", "system", "system.json"]
                },
                "isdl-version": "${extensionVersion}"
            },
            "media": [
                {
                    "type": "setup",
                    "url": "systems/${id}/img/isdl.png",
                    "thumbnail": "systems/${id}/img/isdl.png"
                }
            ],
            "relationships": {
                "recommends": [
                    {
                        "id": "intelligent-filepicker",
                        "type": "module",
                        "manifest": "https://github.com/cswendrowski/intelligent-filepicker/releases/latest/download/module.json",
                        "reason": "Makes it much faster to pick out Icons for your Documents"
                    },
                    {
                        "id": "ric",
                        "type": "module",
                        "manifest": "https://github.com/GamerFlix/ric/releases/latest/download/module.json",
                        "reason": "Adds an UI for managing invalid Documents, such as when fields change to become required but were not filled in"
                    }
                ]
            },
            "url": "This is auto replaced",
            "manifest": "This is auto replaced",
            "download": "This is auto replaced"
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}


function generateTemplateJson(entry: Entry, id: string, destination: string) {
    const generatedFilePath = path.join(destination, `template.json`);

    function getHtmlFields(documents: Document[]): string[] {
        const extra = documents.flatMap(doc =>
            getAllOfType<HtmlExp>(doc.body, isHtmlExp).map(p => (p as HtmlExp).name.toLowerCase())
        );
        return ['description', ...extra];
    }

    const actorDocs = entry.documents.filter(d => isActor(d));
    const itemDocs = entry.documents.filter(d => isItem(d));

    const template = {
        Actor: {
            types: actorDocs.map(d => d.name.toLowerCase()),
            htmlFields: getHtmlFields(actorDocs),
            ...Object.fromEntries(actorDocs.map(d => [d.name.toLowerCase(), {}]))
        },
        Item: {
            types: itemDocs.map(d => d.name.toLowerCase()),
            htmlFields: getHtmlFields(itemDocs),
            ...Object.fromEntries(itemDocs.map(d => [d.name.toLowerCase(), {}]))
        }
    };

    fs.writeFileSync(generatedFilePath, JSON.stringify(template, null, 4));
}


function generateEntryMjs(entry: Entry, id: string, destination: string) {
    const generatedFilePath = path.join(destination, "system", `${id}-main.mjs`);

    const fileNode = expandToNode`
        import {init} from "./hooks/init.mjs";
        import {ready} from "./hooks/ready.mjs";
        import {renderChatLog} from "./hooks/render-chat-log.mjs";
        import {renderSettings} from "./hooks/render-settings.mjs";
        import {hotReload} from "./hooks/hot-reload.mjs";
        import {hotbarDrop} from "./hooks/hotbar-drop.mjs";

        Hooks.once("init", init);
        Hooks.once("ready", ready);
        Hooks.on("devModeReady", ({registerPackageDebugFlag}) => registerPackageDebugFlag("${id}"));
        Hooks.on("renderChatMessage", renderChatLog);
        Hooks.on("renderSettings", renderSettings);
        Hooks.on("hotReload", hotReload);
        Hooks.on("hotbarDrop", hotbarDrop);
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateCustomEntryMjs(entry: Entry, id: string, destination: string) {
    const generatedFilePath = path.join(destination, "system", `${id}-custom.mjs`);

    // If the file already exists, don't overwrite it
    if (fs.existsSync(generatedFilePath)) {
        return;
    }

    const fileNode = expandToNode`
        // Write your custom code and hooks here. This file will not be overwritten by the generator.

        Hooks.once("init", () => {});
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}


function generateHotReloadHookMjs(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "hooks");
    const generatedFilePath = path.join(generatedFileDir, `hot-reload.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        export function hotReload(context) {
            const reloadFileTypes = ["mjs", "json"];
            if (!reloadFileTypes.includes(context.extension)) return;
            
            if (context.extension === "json") {
                if (!context.path.endsWith("system.json")) return;
                ui.notifications.warn("The system configuration has been updated. Please reload your world to apply changes.", { permanent: true });
            }

            ui.notifications.info("Reloading page to apply script changes", { permanent: true });

            const lastState = {
                openWindows: []
            };
            for (const window of Object.values(ui.windows)) {
                if (!window.object) continue;
                const uuid = window.object.uuid;
                lastState.openWindows.push({
                    uuid: uuid,
                    position: window.position
                });
            }
            game.settings.set("${id}", "hotReloadLastState", lastState).then(() => 
            {
                // Reload the page
                window.location.reload(true);
            });
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateRenderChatLogHookMjs(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "hooks");
    const generatedFilePath = path.join(generatedFileDir, `render-chat-log.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        import ${entry.config.name}ChatCard from "../documents/chat-card.mjs";

        export function renderChatLog(app, html, data) {
            ${entry.config.name}ChatCard.activateListeners(html);
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateRenderSettingsHookMjs(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "hooks");
    const generatedFilePath = path.join(generatedFileDir, `render-settings.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        // Adds an "ISDL" version row to the Foundry Settings sidebar, next to the
        // system info, showing which version of ISDL generated this system.
        export function renderSettings(app, html) {
            const root = html instanceof HTMLElement ? html : html?.[0];
            if (!root) return;

            const info = root.querySelector("section.info");
            if (!info || info.querySelector(".isdl-version")) return;

            const version = game.system.flags?.["isdl-version"] ?? "unknown";

            const row = document.createElement("div");
            row.classList.add("isdl-version");
            const label = document.createElement("span");
            label.classList.add("label");
            label.textContent = "ISDL";
            const value = document.createElement("span");
            value.classList.add("value");
            value.textContent = version;
            row.append(label, value);

            // Place it right after the system row when present, else append.
            const systemRow = info.querySelector(".system");
            if (systemRow) systemRow.after(row);
            else info.appendChild(row);
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateExtendedRoll(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "rolls");
    const generatedFilePath = path.join(generatedFileDir, `roll.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        export default class ${entry.config.name}Roll extends Roll {
            async getTooltip() {
                const parts = [];

                for ( const term of this.terms ) {
                    if ( foundry.utils.isSubclass(term.constructor, foundry.dice.terms.DiceTerm) ) {
                        parts.push(term.getTooltipData());
                    }
                    else if ( foundry.utils.isSubclass(term.constructor, foundry.dice.terms.NumericTerm) ) {
                        parts.push({
                            formula: term.flavor,
                            total: term.total,
                            faces: null,
                            flavor: "",
                            rolls: []
                        });
                    }
                }

                return renderTemplate(this.constructor.TOOLTIP_TEMPLATE, { parts });
            }

            /* -------------------------------------------- */

            get cleanFormula() {
                // Replace flavor terms such as 5[STR] with just the flavor text
                let cleanFormula = this._formula;
                for ( const term of this.terms ) {
                    if ( term.formula && term.flavor ) {
                        cleanFormula = cleanFormula.replace(term.formula, term.flavor);
                    }
                }

                // If there are still parts of the formula such as 5[STR] then replace them with just the flavor text
                const rgx = new RegExp(/(\\d+)\\[(.*?)\\]/g);
                cleanFormula = cleanFormula.replace(rgx, "$2");

                return cleanFormula;
            }

            /* -------------------------------------------- */
            /*  Roll result inspection (crit / fumble / dice pools)         */
            /* -------------------------------------------- */

            // Apply a comparison operator string. A missing operator means equality.
            _cmp(a, op, b) {
                switch ( op ) {
                    case "<":  return a <  b;
                    case "<=": return a <= b;
                    case ">":  return a >  b;
                    case ">=": return a >= b;
                    case "!=": return a != b;
                    case "==":
                    default:   return a == b;
                }
            }

            // The natural (unmodified) total of the first DiceTerm in the roll.
            get _firstDieTotal() {
                const die = this.dice[0];
                if ( !die ) return this.total;
                return die.results.filter(r => r.active).reduce((sum, r) => sum + r.result, 0);
            }

            // Evaluate a crit/fumble config: { op, value } against the first die's natural face.
            // Returns false when unconfigured.
            _evalCondition(cfg) {
                if ( !cfg ) return false;
                return this._cmp(this._firstDieTotal, cfg.op, cfg.value);
            }

            // crit/fumble may be set manually (e.g. for game-specific rules that a crit:/fumble:
            // threshold can't express). A manually-assigned value wins over the param evaluation;
            // ?? only falls through when no manual value has been set (undefined).
            get crit()   { return this._critForced ?? this._evalCondition(this.options.crit); }
            set crit(v)  { this._critForced = v; }
            get fumble()  { return this._fumbleForced ?? this._evalCondition(this.options.fumble); }
            set fumble(v) { this._fumbleForced = v; }

            // Every standing face result across all DiceTerms in the roll. Keeps faces dropped
            // by keep/drop modifiers (so 'any die shows a 1' works on Nd6kh1) but excludes the
            // pre-reroll value of a rerolled die.
            get _allResults() {
                return this.dice.flatMap(d => d.results.filter(r => !r.rerolled).map(r => r.result));
            }

            // ISDL \`r.dice\` maps to this getter -- Foundry's Roll#dice returns DiceTerm
            // objects, so the face-value array gets its own name to avoid clobbering it.
            get diceFaces() { return this._allResults; }

            get highest() { const r = this._allResults; return r.length ? Math.max(...r) : 0; }
            get lowest()  { const r = this._allResults; return r.length ? Math.min(...r) : 0; }

            // Success counting: faces matching success:, minus faces matching failure:.
            get successes() {
                const s = this.options.success;
                if ( !s ) return 0;
                const hits = this._allResults.filter(r => this._cmp(r, s.op, s.value)).length;
                const f = this.options.failure;
                const misses = f ? this._allResults.filter(r => this._cmp(r, f.op, f.value)).length : 0;
                return hits - misses;
            }

            // count(arg)/contains(arg): arg is a face value or a die predicate function.
            _predicate(arg) {
                return typeof arg === "function" ? arg : (r => r === arg);
            }
            countDice(arg)   { return this._allResults.filter(this._predicate(arg)).length; }
            containsDie(arg) { return this._allResults.some(this._predicate(arg)); }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateContextMenu2(entry: Entry, id: string, destination: string) {

    const generatedFilePath = path.join(destination, "system", "contextMenu2.js");

    const fileNode = expandToNode`
    export class ContextMenu2 {
        constructor(element, selector, menuItems, {eventName="contextmenu"}={}) {
    
            /**
             * The target HTMLElement being selected
             * @type {HTMLElement}
             */
            this.element = element;
        
            /**
             * The target CSS selector which activates the menu
             * @type {String}
             */
            this.selector = selector || element.attr("id");
        
            /**
             * An interaction event name which activates the menu
             * @type {String}
             */
            this.eventName = eventName;
        
            /**
             * The array of menu items being rendered
             * @type {Array}
             */
            this.menuItems = menuItems;
        
            /**
             * Track which direction the menu is expanded in
             * @type {Boolean}
             */
            this._expandUp = false;
        
            // Bind to the current element
            this.bind();
        }
    
        /* -------------------------------------------- */
    
        /**
         * A convenience accessor to the context menu HTML object
         * @return {*|jQuery.fn.init|jQuery|HTMLElement}
         */
        get menu() {
            return $("#context-menu2");
        }
    
        /* -------------------------------------------- */
    
        /**
         * Attach a ContextMenu instance to an HTML selector
         */
        bind() {
            this.element.on(this.eventName, this.selector, event => {
                event.preventDefault();
                event.stopPropagation();
                let parent = $(event.currentTarget);

                if (this.selector == ".message") return;

                // Remove existing context UI
                $('.context').removeClass("context");

                // The menu mounts on <body> (not inside the target), so a fresh right-click can't
                // rely on DOM containment to toggle. Tear down any open menu immediately to avoid
                // duplicates/animation races, then open a fresh one anchored to this target.
                $("#context-menu2").stop(true, true).remove();
                if ( ui.context ) delete ui.context;

                this.render(parent);
                ui.context = this;
            })
        }
    
        /* -------------------------------------------- */
    
        /**
         * Animate closing the menu by sliding up and removing from the DOM
         */
        async close() {
            let menu = this.menu;
            await this._animateClose(menu);
            menu.remove();
            $('.context').removeClass("context");
            delete ui.context;
        }
    
        /* -------------------------------------------- */
    
        async _animateOpen(menu) {
            menu.hide();
            return new Promise(resolve => menu.slideDown(200, resolve));
        }
    
        /* -------------------------------------------- */
    
        async _animateClose(menu) {
            return new Promise(resolve => menu.slideUp(200, resolve));
        }
    
        /* -------------------------------------------- */
    
        /**
         * Render the Context Menu by iterating over the menuItems it contains
         * Check the visibility of each menu item, and only render ones which are allowed by the item's logical condition
         * Attach a click handler to each item which is rendered
         * @param target
         */
        render(target) {
            // Always a fresh node -- bind() removed any prior menu, so appending h2/items here
            // can't accumulate onto a reused element.
            let html = $('<nav id="context-menu2" data-mod="1"></nav>');
            let ol = $('<ol class="context-items"></ol>');
            html.append($(\`<h2>\${game.i18n.localize('CONTEXT.ApplyChanges')}</h2>\`));
            html.append(ol);

            // Determine if user-selected targets are allowed.
            const allowTargeting = game.settings.get('${id}', 'allowTargetDamageApplication');
            let targetType = game.settings.get('${id}', 'userTargetDamageApplicationType');
            if (!allowTargeting && targetType !== 'selected') {
                game.settings.set('${id}', 'userTargetDamageApplicationType', 'selected');
                targetType = 'selected';
            }

            // Add default target type.
            html[0].dataset.target = targetType;
        
            // Build menu items
            for (let item of this.menuItems) {
                
                // Determine menu item visibility (display unless false)
                let display = true;
                if ( item.condition !== undefined ) {
                display = ( item.condition instanceof Function ) ? item.condition(target) : item.condition;
                }
                if ( !display ) continue;
        
                // Construct and add the menu item
                let name = game.i18n.localize(item.name);
                let li = $(\`<li class="context-item \${item?.id ?? ''}">\${item.icon}\${name}</li>\`);
                // If this is the target buttons option, set one of them to active.
                if (name.includes('data-target="targeted"')) {
                    const button = li.find(\`[data-target="\${targetType}"]\`);
                    button.addClass('active');
                }
                li.children("i").addClass("fa-fw");
                li.click(e => {
                    e.preventDefault();
                    e.stopPropagation();
                    item.callback(target, e);
                    // If this was a target button, prevent closing the context menu.
                    if (!item?.preventClose) {
                        this.close();
                    }
                });
                ol.append(li);
            }
        
            // Bail out if there are no children
            if ( ol.children().length === 0 ) return;
        
            // Append to target
            this._setPosition(html, target);

            // Deactivate global tooltip
            game.tooltip.deactivate();
        
            // Animate open the menu
            return this._animateOpen(html);
        }
    
        /* -------------------------------------------- */
    
        /**
         * Set the position of the context menu, taking into consideration whether the menu should expand upward or downward
         * @private
         */
        _setPosition(html, target) {
            const targetRect = target[0].getBoundingClientRect();

            // Mount on <body> with fixed positioning so the menu escapes the chat log's overflow
            // clipping (#chat-log is overflow-x:hidden / overflow-y:auto) and any transformed sheet
            // ancestor. We then place it explicitly in viewport coordinates.
            html.css("visibility", "hidden");
            document.body.appendChild(html[0]);
            const contextRect = html[0].getBoundingClientRect();

            // Expand upward only when there isn't room below the target but there is above it.
            const roomBelow = window.innerHeight - targetRect.bottom;
            this._expandUp = (roomBelow < contextRect.height) && (targetRect.top > contextRect.height);
            const top = this._expandUp
                ? targetRect.top - contextRect.height - 2
                : targetRect.bottom + 2;

            // Align to the target's left edge, clamped to stay within the viewport.
            let left = targetRect.left;
            const maxLeft = window.innerWidth - contextRect.width - 4;
            if (left > maxLeft) left = maxLeft;
            if (left < 4) left = 4;

            // Display the menu
            html.css({ top: Math.round(top) + "px", left: Math.round(left) + "px" });
            html.addClass(this._expandUp ? "expand-up" : "expand-down");
            html.css("visibility", "");
            target.addClass("context");
        }
    
        /* -------------------------------------------- */
    
        static eventListeners() {
            document.addEventListener("click", ev => {
                if ( ui.context ) ui.context.close();
            });
        };
    }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateDocumentCreateHbs(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates");
    const generatedFilePath = path.join(generatedFileDir, `document-create.hbs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    <form id="document-create" autocomplete="off">
        <header>
            <input type="text" class="document-name uninput" name="name" value="{{ name }}" autofocus
                placeholder="{{ localize 'Name' }}">
            {{#if hasFolders}}
            <select class="unselect" name="folder" form="document-create">
                {{ selectOptions folders selected=folder labelAttr="name" valueAttr="id"
                                blank=(localize "DOCUMENT.Folder") }}
            </select>
            {{/if}}
        </header>
        <ol class="unlist card">
            {{#each types}}
            <li data-tooltip="{{ description }}">
                <label>
                    <img src="{{ icon }}" alt="{{ label }}">
                    <span>{{ label }}</span>
                    <input type="radio" name="type" value="{{ type }}" required {{#if selected}}checked{{/if}}>
                </label>
            </li>
            {{/each}}
        </ol>
    </form>
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateCombatant(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "documents");
    const generatedFilePath = path.join(generatedFileDir, `combatant.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
    export default class ${entry.config.name}Combatant extends Combatant {
        _getInitiativeFormula() {
            return String(CONFIG.Combat.initiative.formula || game.system.initiative || this.actor.getInitiativeFormula());
        }
    }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
