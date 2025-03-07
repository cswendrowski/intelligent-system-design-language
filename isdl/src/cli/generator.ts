import {
    Actor,
    Document,
    Entry,
    HtmlExp,
    isDocumentCreatableParam,
    isDocumentDefaultParam,
    isDocumentDescriptionParam,
    isDocumentSvgParam,
    Item,
    ResourceExp,
    DocumentCreatableParam,
    DocumentSvgParam,
    DocumentDescriptionParam,
    StatusProperty,
    isStatusProperty,
    isStatusParamWhen
} from '../language/generated/ast.js';
import {
    isActor,
    isItem,
    isHtmlExp,
    isResourceExp,
} from "../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractDestinationAndName } from './cli-util.js';
import { generateDocumentSheet } from './components/document-sheet-generator.js';
import { generateCustomCss, generateSystemCss } from './components/css-generator.js';
import { generateLanguageJson } from './components/language-generator.js';
import { generateExtendedDocumentClasses } from './components/derived-data-generator.js';
import { generateDocumentDataModel, generateUuidDocumentField } from './components/datamodel-generator.js';
import { fileURLToPath } from 'url';
import { generateActiveEffectHandlebars, generateBaseActiveEffectBaseSheet as generateActiveEffectBaseSheet } from './components/active-effect-sheet-generator.js';
import { generateChatCardClass, generateStandardChatCardTemplate } from './components/chat-card-generator.js';
import { generateBaseDocumentSheet } from './components/base-sheet-generator.js';
import { generateBaseActorSheet } from './components/base-actor-sheet-generator.js';
import { generateDocumentHandlebars } from './components/document-sheet-handlebars-generator.js';
import { getAllOfType } from './components/utils.js';
import { generateCanvasToken, generateTokenDocument } from './components/token-generator.js';
import { generateVue, runViteBuild } from './components/vue/vue-generator.js';

export function generateJavaScript(entry: Entry, filePath: string, destination: string | undefined): string {
    const config = entry.config;

    const data = extractDestinationAndName(filePath, destination);
    const id = config.body.find(x => x.type == "id")!.value;
    data.destination = path.join(data.destination, id);
    console.log("Writing to " + data.destination);

    if (!fs.existsSync(path.join(data.destination, "system"))) {
        fs.mkdirSync(path.join(data.destination, "system"), { recursive: true });
    }

    // Generic shared components
    copyDataTableFiles(data.destination);
    copyProgressBarJs(data.destination);
    copyLogo(data.destination);
    copyPaperDoll(data.destination);
    generateSystemCss(entry, id, data.destination);
    generateCustomCss(entry, id, data.destination);
    generateUuidDocumentField(data.destination);
    //generateRpgAwesomeCss(data.destination);
    generateActiveEffectBaseSheet(entry, id, data.destination);
    generateActiveEffectHandlebars(id, entry, data.destination);
    generateSystemJson(entry, id, data.destination);
    generateLanguageJson(entry, id, data.destination);
    generateTemplateJson(entry, id, data.destination);
    generateBaseDocumentSheet(entry, id, data.destination);
    generateBaseActorSheet(entry, id, data.destination);
    generateExtendedDocumentClasses(entry, id, data.destination);
    generateEntryMjs(entry, id, data.destination);
    generateCustomEntryMjs(entry, id, data.destination);
    generateInitHookMjs(entry, id, data.destination);
    generateReadyHookMjs(entry, id, data.destination);
    generateHotReloadHookMjs(entry, id, data.destination);
    generateChatCardClass(entry, data.destination);
    generateStandardChatCardTemplate(data.destination);
    generateRenderChatLogHookMjs(entry, id, data.destination);
    generateExtendedRoll(entry, id, data.destination);
    generateContextMenu2(entry, id, data.destination);
    generateDocumentCreateHbs(entry, id, data.destination);
    generateCombatant(entry, id, data.destination);
    generateCanvasToken(entry, id, data.destination);
    generateTokenDocument(entry, id, data.destination);
    generateVue(entry, id, data.destination);

    // Documents
    entry.documents.forEach(x => {
        generateDocumentDataModel(entry, x, data.destination);
        generateDocumentSheet(x, entry, id, data.destination);
        generateDocumentHandlebars(id, x, data.destination, true);
        generateDocumentHandlebars(id, x, data.destination, false);
    });

    runViteBuild(data.destination);

    return data.destination;
}

function copyDataTableFiles(destination: string) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Make the scripts and css directories
    const cssDir = path.join(destination, "css");
    const jsDir = path.join(destination, "scripts");

    if (!fs.existsSync(cssDir)) {
        fs.mkdirSync(cssDir, { recursive: true });
    }
    if (!fs.existsSync(jsDir)) {
        fs.mkdirSync(jsDir, { recursive: true });
    }

    // Copy the files
    const cssFilePath = path.join(destination, "css", "datatables.min.css");
    const jsFilePath = path.join(destination, "scripts", "datatables.min.js");

    fs.copyFileSync(path.join(__dirname, "../datatables.min.css"), cssFilePath);
    fs.copyFileSync(path.join(__dirname, "../datatables.min.js"), jsFilePath);
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

function copyLogo(destination: string) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Make the scripts and css directories
    const imgDir = path.join(destination, "img");

    if (!fs.existsSync(imgDir)) {
        fs.mkdirSync(imgDir, { recursive: true });
    }

    // Copy the files
    const imgFilePath = path.join(destination, "img", "isdl.png");

    fs.copyFileSync(path.join(__dirname, "../isdl.png"), imgFilePath);
}

function copyPaperDoll(destination: string) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Make the scripts and css directories
    const imgDir = path.join(destination, "img");

    if (!fs.existsSync(imgDir)) {
        fs.mkdirSync(imgDir, { recursive: true });
    }

    // Copy the files
    const imgFilePath = path.join(destination, "img", "paperdoll_default.png");

    fs.copyFileSync(path.join(__dirname, "../paperdoll_default.png"), imgFilePath);
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
            "title": "${entry.config.body.find(x => x.type == "label")?.value}",
            "description": "${entry.config.body.find(x => x.type == "description")?.value}",
            "version": "This is auto replaced",
            "compatibility": {
                "minimum": 12,
                "verified": 12
            },
            "authors": [
                {
                    "name": "${entry.config.body.find(x => x.type == "author")?.value}"
                }
            ],
            "scripts": [
                "scripts/datatables.min.js",
                "scripts/progressbar.min.js"
            ],
            "esmodules": [
                "system/${id}-main.mjs",
                "system/${id}-custom.mjs"
            ],
            "styles": [
                "css/datatables.min.css",
                "css/vuetify.min.css",
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
                        "reason": "Makes it much faster to pick out Icons for your Documents"
                    },
                    {
                        "id": "ric",
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

    function generateHtmlFields(document: Document): CompositeGeneratorNode | undefined {
        return expandToNode`
            ${joinToNode(getAllOfType<HtmlExp>(document.body, isHtmlExp), property => `,"${(property as HtmlExp).name.toLowerCase()}"`)}
        `;
    }

    const fileNode = expandToNode`
    {
        "Actor": {
            "types": [ ${joinToNode(entry.documents.filter(d => isActor(d)), document => `"${document.name.toLowerCase()}"`, { separator: ',' })} ],
            "htmlFields": ["description" ${joinToNode(entry.documents.filter(d => isActor(d)), document => generateHtmlFields(document))} ],
            ${joinToNode(entry.documents.filter(d => isActor(d)), document => `"${document.name.toLowerCase()}": {}`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            
        },
        "Item": {
            "types": [ ${joinToNode(entry.documents.filter(d => isItem(d)), document => `"${document.name.toLowerCase()}"`, { separator: ',' })} ],
            "htmlFields": [ "description" ${joinToNode(entry.documents.filter(d => isItem(d)), document => generateHtmlFields(document))} ],
            ${joinToNode(entry.documents.filter(d => isItem(d)), document => `"${document.name.toLowerCase()}": {}`, { appendNewLineIfNotEmpty: true, separator: ',' })}
        }
    }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}


function generateEntryMjs(entry: Entry, id: string, destination: string) {
    const generatedFilePath = path.join(destination, "system", `${id}-main.mjs`);

    const fileNode = expandToNode`
        import {init} from "./hooks/init.mjs";
        import {ready} from "./hooks/ready.mjs";
        import {renderChatLog} from "./hooks/render-chat-log.mjs";
        import {hotReload} from "./hooks/hot-reload.mjs";

        Hooks.once("init", init);
        Hooks.once("ready", ready);
        Hooks.on("devModeReady", ({registerPackageDebugFlag}) => registerPackageDebugFlag("${id}"));
        Hooks.on("renderChatMessage", renderChatLog);
        Hooks.on("hotReload", hotReload);
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

function generateInitHookMjs(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "hooks");
    const generatedFilePath = path.join(generatedFileDir, `init.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateTrackableResourceBars(document: Document): CompositeGeneratorNode {
        let resourceExps = getAllOfType<ResourceExp>(document.body, isResourceExp);
        return expandToNode`
            "${document.name.toLowerCase()}": {
                "bar": [${joinToNode(resourceExps, x => `"${x.name.toLowerCase()}"`, { separator: ',' })}],
                "value": []
            }
        `;
    }

    function generateStatusEffect(document: StatusProperty): CompositeGeneratorNode {
        let svg = (document.params.find(p => isDocumentSvgParam(p)) as DocumentSvgParam)?.value;
        if (!svg) svg = "icons/svg/upgrade.svg";
        let calculated = document.params.find(p => isStatusParamWhen(p)) ? true : false;
        return expandToNode`
            {
                id: "${document.name.toLowerCase()}",
                name: "${document.name}",
                label: "${document.name}",
                icon: "${svg}",
                img: "${svg}",
                calculated: ${calculated}
            }
        `;
    }


    let actorDocs = entry.documents.filter(d => isActor(d)).map(d => d as Actor);
    let actorDefaultType = actorDocs.find(a => a.params.find(p => isDocumentDefaultParam(p) && p.value.toLowerCase() == "true"))?.name.toLowerCase() ?? actorDocs[0]?.name.toLowerCase();
    let actorArtworks = actorDocs.filter(a => a.params.find(p => isDocumentSvgParam(p)));
    let actorDescriptions = actorDocs.filter(a => a.params.find(p => isDocumentDescriptionParam(p)));
    let actorCreatables = actorDocs.filter(a => a.params.find(p => isDocumentCreatableParam(p)));

    let itemDocs = entry.documents.filter(d => isItem(d)).map(d => d as Item);
    let itemDefaultType = itemDocs.find(a => a.params.find(p => isDocumentDefaultParam(p) && p.value.toLowerCase() == "true"))?.name.toLowerCase() ?? itemDocs[0]?.name.toLowerCase();
    let itemArtworks = itemDocs.filter(a => a.params.find(p => isDocumentSvgParam(p)));
    let itemDescriptions = itemDocs.filter(a => a.params.find(p => isDocumentDescriptionParam(p)));
    let itemCreatables = itemDocs.filter(a => a.params.find(p => isDocumentCreatableParam(p)));

    let statusEffects = getAllOfType<StatusProperty>(entry.documents, isStatusProperty);

    const fileNode = expandToNode`
        ${joinToNode(entry.documents, document => `import ${document.name}TypeDataModel from "../datamodels/${isActor(document) ? "actor" : "item"}/${document.name.toLowerCase()}.mjs"`, { appendNewLineIfNotEmpty: true })}
        ${joinToNode(entry.documents, document => `import ${document.name}Sheet from "../sheets/${isActor(document) ? "actor" : "item"}/${document.name.toLowerCase()}-sheet.mjs"`, { appendNewLineIfNotEmpty: true })}
        ${joinToNode(entry.documents, document => `import ${document.name}VueSheet from "../sheets/vue/${isActor(document) ? "actor" : "item"}/${document.name.toLowerCase()}-sheet.mjs"`, { appendNewLineIfNotEmpty: true })}
        import ${entry.config.name}EffectSheet from "../sheets/active-effect-sheet.mjs";
        import ${entry.config.name}Actor from "../documents/actor.mjs";
        import ${entry.config.name}Item from "../documents/item.mjs";
        import ${entry.config.name}Combatant from "../documents/combatant.mjs";
        import ${entry.config.name}TokenDocument from "../documents/token.mjs";
        import ${entry.config.name}Token from "../canvas/token.mjs";
        import ${id}Roll from "../rolls/roll.mjs";

        export function init() {
            console.log('${id} | Initializing System');

            CONFIG.ActiveEffect.legacyTransferral = false;

            registerSettings();
            registerDataModels();
            registerDocumentSheets();
            registerDocumentClasses();
            registerCanvasClasses();
            registerTypeInfo();
            registerHandlebarsHelpers();
            registerResourceBars();
            registerStatusEffects();
            registerUtils();
            //addVueImportMap();

            game.system.rollClass = ${id}Roll;
        }

        /* -------------------------------------------- */

        function registerSettings() {

            game.settings.register('${id}', 'roundUpDamageApplication', {
                name: game.i18n.localize("SETTINGS.RoundUpDamageApplicationName"),
                hint: game.i18n.localize("SETTINGS.RoundUpDamageApplicationHint"),
                scope: 'world',
                config: true,
                default: true,
                type: Boolean
            });

            game.settings.register('${id}', 'allowTargetDamageApplication', {
                name: game.i18n.localize('SETTINGS.AllowTargetDamageApplicationName'),
                hint: game.i18n.localize('SETTINGS.AllowTargetDamageApplicationHint'),
                scope: 'world',
                config: true,
                default: false,
                type: Boolean,
                requiresReload: true
            });

            game.settings.register('${id}', 'userTargetDamageApplicationType', {
                scope: 'client',
                config: false,
                default: 'selected',
                type: String,
            });

            game.settings.register('${id}', 'hotReloadLastState', {
                scope: 'client',
                config: false,
                default: { openWindows: [] },
                type: Object,
            });
        }
        
        /* -------------------------------------------- */

        function registerDataModels() {
            CONFIG.Actor.dataModels = {
                ${joinToNode(entry.documents.filter(d => isActor(d)), document => `${document.name.toLowerCase()}: ${document.name}TypeDataModel`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            };

            CONFIG.Item.dataModels = {
                ${joinToNode(entry.documents.filter(d => isItem(d)), document => `${document.name.toLowerCase()}: ${document.name}TypeDataModel`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            };
        }

        /* -------------------------------------------- */

        function registerDocumentSheets() {
            Actors.unregisterSheet("core", ActorSheet);
            Items.unregisterSheet("core", ItemSheet);

            // Actors
            ${joinToNode(entry.documents.filter(d => isActor(d)), document => `Actors.registerSheet("${id}", ${document.name}Sheet, {types: ["${document.name.toLowerCase()}"], makeDefault: true});`, { appendNewLineIfNotEmpty: true })}
            ${joinToNode(entry.documents.filter(d => isActor(d)), document => `Actors.registerSheet("${id}", ${document.name}VueSheet, {types: ["${document.name.toLowerCase()}"], makeDefault: false});`, { appendNewLineIfNotEmpty: true })}

            // Items
            ${joinToNode(entry.documents.filter(d => isItem(d)), document => `Items.registerSheet("${id}", ${document.name}Sheet, {types: ["${document.name.toLowerCase()}"], makeDefault: true});`, { appendNewLineIfNotEmpty: true })}
            ${joinToNode(entry.documents.filter(d => isItem(d)), document => `Items.registerSheet("${id}", ${document.name}VueSheet, {types: ["${document.name.toLowerCase()}"], makeDefault: false});`, { appendNewLineIfNotEmpty: true })}
        
            // Active Effects
            DocumentSheetConfig.registerSheet(ActiveEffect, "${id}", ${entry.config.name}EffectSheet, { makeDefault: true });
        }

        /* -------------------------------------------- */

        function registerDocumentClasses() {
            CONFIG.Actor.documentClass = ${entry.config.name}Actor;
            CONFIG.Item.documentClass = ${entry.config.name}Item;
            CONFIG.Combatant.documentClass = ${entry.config.name}Combatant;
            CONFIG.Token.documentClass = ${entry.config.name}TokenDocument;
        }

        /* -------------------------------------------- */

        function registerCanvasClasses() {
            CONFIG.Token.objectClass = ${entry.config.name}Token;
        }

        /* -------------------------------------------- */

        function registerTypeInfo() {
            CONFIG.Actor.defaultType = "${actorDefaultType}";
            CONFIG.Item.defaultType = "${itemDefaultType}";

            CONFIG.Actor.typeArtworks = {
                ${joinToNode(actorArtworks, document => `"${document.name.toLowerCase()}": "systems/${id}/${(document.params.find(p => isDocumentSvgParam(p)) as DocumentSvgParam)?.value}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            }
            CONFIG.Item.typeArtworks = {
                ${joinToNode(itemArtworks, document => `"${document.name.toLowerCase()}": "systems/${id}/${(document.params.find(p => isDocumentSvgParam(p)) as DocumentSvgParam)?.value}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            }

            CONFIG.Actor.typeDescriptions = {
                ${joinToNode(actorDescriptions, document => `"${document.name.toLowerCase()}": "${(document.params.find(p => isDocumentDescriptionParam(p)) as DocumentDescriptionParam)?.value}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            }
            CONFIG.Item.typeDescriptions = {
                ${joinToNode(itemDescriptions, document => `"${document.name.toLowerCase()}": "${(document.params.find(p => isDocumentDescriptionParam(p)) as DocumentDescriptionParam)?.value}"`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            }

            CONFIG.Actor.typeCreatables = {
                ${joinToNode(actorCreatables, document => `"${document.name.toLowerCase()}": ${(document.params.find(p => isDocumentCreatableParam(p)) as DocumentCreatableParam)?.value}`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            }
            CONFIG.Item.typeCreatables = {
                ${joinToNode(itemCreatables, document => `"${document.name.toLowerCase()}": ${(document.params.find(p => isDocumentCreatableParam(p)) as DocumentCreatableParam)?.value}`, { appendNewLineIfNotEmpty: true, separator: ',' })}
            }
        }

        /* -------------------------------------------- */

        function registerHandlebarsHelpers() {

            // Convert a type and value to a localized label
            Handlebars.registerHelper("typeLabel", (type, value) => {
                return game.i18n.localize(CONFIG.SYSTEM[type][value]?.label);
            });

            // Truncate a string to a certain length with an ellipsis
            Handlebars.registerHelper("truncate", (str, len) => {
                if (str.length > len) {
                    return \`\${str.slice(0, len)}...\`;
                }
                return str;
            });

            // Get a property on an object using a string key
            Handlebars.registerHelper("getProperty", (obj, key) => {
                if (obj == null) return "";
                return foundry.utils.getProperty(obj, key);
            });

            // Humanize a string
            Handlebars.registerHelper("humanize", (str) => {
                let humanized = str.replace(/_/g, " ");
                humanized = humanized.replace("system.", "").replaceAll(".", " ");
                humanized = humanized.charAt(0).toUpperCase() + humanized.slice(1);
                return humanized;
            });
        }

        /* -------------------------------------------- */

        function registerResourceBars() {
            CONFIG.Actor.trackableAttributes = {
                ${joinToNode(entry.documents.filter(d => isActor(d)), document => generateTrackableResourceBars(document), { appendNewLineIfNotEmpty: true, separator: ',' })}
            };
        }

        /* -------------------------------------------- */

        function registerStatusEffects() {
            CONFIG.statusEffects = [
                ${joinToNode(statusEffects, document => generateStatusEffect(document), { appendNewLineIfNotEmpty: true, separator: ',' })}
            ];
        }

        /** -------------------------------------------- */

        function addVueImportMap() {
            let script = document.createElement('script');
            script.type = 'importmap';
            script.text = \`{
                "imports": {
                    "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.js"
                }
            }\`;
            document.head.appendChild(script);
        }

        /* -------------------------------------------- */

        function registerUtils() {
            game.system.utils = {};

            function flattenObject(obj, _d=0) {
                const flat = {};
                if ( _d > 100 ) {
                    throw new Error("Maximum depth exceeded");
                }
                for ( let [k, v] of Object.entries(obj) ) {
                    let t = foundry.utils.getType(v);
                    if ( t === "Object" ) {
                        if ( k == "parent" ) continue;
                        if ( foundry.utils.isEmpty(v) ) flat[k] = v;
                        let inner = flattenObject(v, _d+1);
                        for ( let [ik, iv] of Object.entries(inner) ) {
                            flat[\`\${k}.\${ik}\`] = iv;
                        }
                    }
                    else flat[k] = v;
                }
                return flat;
            }

            game.system.utils.flattenObject = flattenObject;

            function toNearest(interval=1, method="round") {
                if (!Number.isNumeric(this)) {
                    throw new Error("toNearest() must be called on a numeric looking value");
                }
                const number = Number.fromString(this);
                return number.toNearest(interval, method);
            }

            Object.defineProperties(String.prototype, {
                toNearest: {value: toNearest}
            });
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

function generateReadyHookMjs(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "hooks");
    const generatedFilePath = path.join(generatedFileDir, `ready.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        export function ready() {
            console.log('${id} | Ready');

            registerSockets();
            reopenLastState();
        }
        
        /* -------------------------------------------- */

        function registerSockets() {
            game.socket.on("system.${id}", (data) => {
                console.log("Socket Data", data);

                if (data.type === "prompt") {
                    _handlePrompt(data);
                }
            });
        }

        /* -------------------------------------------- */

        function _handlePrompt(message) {
            Dialog.prompt({
                title: message.title,
                content: message.content,
                callback: (html, event) => {
                    // Grab the form data
                    const formData = new FormDataExtended(html[0].querySelector("form"));
                    const data = { system: {} };
                    for (const [key, value] of formData.entries()) {
                        // Translate values to more helpful ones, such as booleans and numbers
                        if (value === "true") {
                            data[key] = true;
                            data.system[key] = true;
                        }
                        else if (value === "false") {
                            data[key] = false;
                            data.system[key] = false;
                        }
                        else if (!isNaN(value)) {
                            data[key] = parseInt(value);
                            data.system[key] = parseInt(value);
                        }
                        else {
                            data[key] = value;
                            data.system[key] = value;
                        }
                    }

                    game.socket.emit("system.${id}", {
                        type: "promptResponse",
                        uuid: message.uuid,
                        data: data
                    }, { recipients: [message.userId] });

                    return data;
                },
                options: {
                    classes: ["${id}", "dialog"]
                }
            });
        }

        /* -------------------------------------------- */

        function reopenLastState() {
            const lastState = game.settings.get("${id}", "hotReloadLastState");
            if (lastState.openWindows.length > 0) {
                for (const window of lastState.openWindows) {
                    const document = fromUuidSync(window.uuid);
                    const app = document.sheet;
                    if (app) {
                        try {
                            app.render(true).setPosition(window.position);
                        }
                        catch (e) {}
                    }
                }
            }
            game.settings.set("${id}", "hotReloadLastState", { openWindows: [] });
        }
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
                    console.log(term.constructor.name);
                    if ( foundry.utils.isSubclass(term.constructor, DiceTerm) ) {
                        parts.push(term.getTooltipData());
                    }
                    else if ( foundry.utils.isSubclass(term.constructor, NumericTerm) ) {
                        parts.push({
                            formula: term.flavor,
                            total: term.total,
                            faces: null,
                            flavor: "",
                            rolls: []
                        });
                    }
                }

                console.dir(parts);

                return renderTemplate(this.constructor.TOOLTIP_TEMPLATE, { parts });
            }

            /* -------------------------------------------- */

            get cleanFormula() {
                // Replace flavor terms such as 5[STR] with just the flavor text
                let cleanFormula = this._formula;
                for ( const term of this.terms ) {
                    if ( term instanceof NumericTerm ) {
                        cleanFormula = cleanFormula.replace(term.formula, term.flavor);
                    }
                }

                // If there are still parts of the formula such as 5[STR] then replace them with just the flavor text
                const rgx = new RegExp(/(\\d+)\\[(.*?)\\]/g);
                cleanFormula = cleanFormula.replace(rgx, "$2");

                return cleanFormula;
            }
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
                let parent = $(event.currentTarget),
                    menu = this.menu;
        
                if (this.selector == ".message") return;
        
                // Remove existing context UI
                $('.context').removeClass("context");
        
                // Close the current context
                if ( $.contains(parent[0], menu[0]) ) this.close();
        
                // If the new target element is different
                else {
                this.render(parent);
                ui.context = this;
                }
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
            let html = $("#context-menu2").length ? $("#context-menu2") : $('<nav id="context-menu2" data-mod="1"></nav>');
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
            const parentRect = target[0].parentElement.getBoundingClientRect();
        
            // Append to target and get the context bounds
            target.css('position', 'relative');
            html.css("visibility", "hidden");
            target.append(html);
            const contextRect = html[0].getBoundingClientRect();
        
            // Determine whether to expand down or expand up
            const bottomHalf = targetRect.bottom > (window.innerHeight / 2);
            this._expandUp = bottomHalf && ((parentRect.bottom - targetRect.bottom) < contextRect.height);

            // Shift left if needed to avoid overflowing
            const horizontalOverflow = parentRect.right - contextRect.right;
            if (horizontalOverflow < 0) {
                html.css("left", Math.floor(horizontalOverflow));
            }
        
            // Display the menu
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