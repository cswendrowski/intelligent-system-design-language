import type {
    Document,
    Entry,
    HtmlExp,
    ResourceExp,
    Section,
} from '../language/generated/ast.js';
import {
    isActor,
    isItem,
    isHtmlExp,
    isResourceExp,
    isSection,
} from "../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractDestinationAndName } from './cli-util.js';
import { generateBaseSheet, generateDocumentSheet, generateDocumentHandlebars, generateBaseActorSheet } from './components/sheet-generator.js';
import { generateCustomCss, generateSystemCss } from './components/css-generator.js';
import { generateLanguageJson } from './components/language-generator.js';
import { generateExtendedDocumentClasses } from './components/derived-data-generator.js';
import { generateDocumentDataModel, generateUuidDocumentField } from './components/datamodel-generator.js';
import { fileURLToPath } from 'url';
import { generateActiveEffectHandlebars, generateBaseActiveEffectBaseSheet as generateActiveEffectBaseSheet } from './components/active-effect-sheet-generator.js';
import { generateChatCardClass, generateStandardChatCardTemplate } from './components/chat-card-generator.js';

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
    generateSystemCss(entry, id, data.destination);
    generateCustomCss(entry, id, data.destination);
    generateUuidDocumentField(data.destination);
    //generateRpgAwesomeCss(data.destination);
    generateActiveEffectBaseSheet(entry, id, data.destination);
    generateActiveEffectHandlebars(id, entry, data.destination);
    generateSystemJson(entry, id, data.destination);
    generateLanguageJson(entry, id, data.destination);
    generateTemplateJson(entry, id, data.destination);
    generateBaseSheet(entry, id, data.destination);
    generateBaseActorSheet(entry, id, data.destination);
    generateExtendedDocumentClasses(entry, id, data.destination);
    generateEntryMjs(entry, id, data.destination);
    generateCustomEntryMjs(entry, id, data.destination);
    generateInitHookMjs(entry, id, data.destination);
    generateChatCardClass(entry, data.destination);
    generateStandardChatCardTemplate(data.destination);
    generateRenderChatLogHookMjs(entry, id, data.destination);
    generateExtendedRoll(entry, id, data.destination);

    // Documents
    entry.documents.forEach(x => {
        generateDocumentDataModel(config, x, data.destination);
        generateDocumentSheet(x, entry, id, data.destination);
        generateDocumentHandlebars(x, data.destination, true);
        generateDocumentHandlebars(x, data.destination, false);
    });

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

function generateSystemJson(entry: Entry, id: string, destination: string) {
    const generatedFilePath = path.join(destination, `system.json`);

    const fileNode = expandToNode`
        {
            "id": "${id}",
            "title": "${entry.config.body.find(x => x.type == "label")?.value}",
            "description": "${entry.config.body.find(x => x.type == "description")?.value}",
            "version": "This is auto replaced",
            "compatibility": {
                "minimum": 11,
                "verified": 11
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
                "system/${id}-custom.mjs",
            ],
            "styles": [
                "css/${id}.css",
                "css/${id}-custom.css",
                "css/datatables.min.css"
            ],
            "license": "LICENSE",
            "readme": "README.md",
            "languages": [
              {
                "lang": "en",
                "name": "English",
                "path": "lang/en.json"
              }
            ],
            "flags": {
                "hotReload": {
                    "extensions": ["css", "hbs", "json"],
                    "paths": ["css", "system/templates", "lang"]
                }
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
            ${joinToNode(document.body.filter(x => isHtmlExp(x)), property => `,"${(property as HtmlExp).name.toLowerCase()}"`)}
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
        import {renderChatLog} from "./hooks/render-chat-log.mjs";

        Hooks.once("init", init);
        Hooks.on("devModeReady", ({registerPackageDebugFlag}) => registerPackageDebugFlag("${id}"));
        Hooks.on("renderChatMessage", renderChatLog);
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
        let resourceExps = document.body.filter(x => isResourceExp(x)).map(x => x as ResourceExp);
        for (let section of document.body.filter(x => isSection(x))) {
            resourceExps = resourceExps.concat((section as Section).body.filter(x => isResourceExp(x)).map(x => x as ResourceExp));
        }
        return expandToNode`
            "${document.name.toLowerCase()}": {
                "bar": [${joinToNode(resourceExps, x => `"${x.name.toLowerCase()}"`, { separator: ',' })}],
                "value": []
            }
        `;
    }

    const fileNode = expandToNode`
        ${joinToNode(entry.documents, document => `import ${document.name}TypeDataModel from "../datamodels/${isActor(document) ? "actor" : "item"}/${document.name.toLowerCase()}.mjs"`, { appendNewLineIfNotEmpty: true })}
        ${joinToNode(entry.documents, document => `import ${document.name}Sheet from "../sheets/${isActor(document) ? "actor" : "item"}/${document.name.toLowerCase()}-sheet.mjs"`, { appendNewLineIfNotEmpty: true })}
        import ${entry.config.name}EffectSheet from "../sheets/active-effect-sheet.mjs";
        import ${entry.config.name}Actor from "../documents/actor.mjs";
        import ${entry.config.name}Item from "../documents/item.mjs";

        export function init() {
            console.log('${id} | Initializing System');

            registerDataModels();
            registerDocumentSheets();
            registerDocumentClasses();
            registerHandlebarsHelpers();
            registerResourceBars();
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

            // Items
            ${joinToNode(entry.documents.filter(d => isItem(d)), document => `Items.registerSheet("${id}", ${document.name}Sheet, {types: ["${document.name.toLowerCase()}"], makeDefault: true});`, { appendNewLineIfNotEmpty: true })}
        
            // Active Effects
            DocumentSheetConfig.registerSheet(ActiveEffect, "${id}", ${entry.config.name}EffectSheet, { makeDefault: true });
        }

        /* -------------------------------------------- */

        function registerDocumentClasses() {
            CONFIG.Actor.documentClass = ${entry.config.name}Actor;
            CONFIG.Item.documentClass = ${entry.config.name}Item;
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
        }

        /* -------------------------------------------- */

        function registerResourceBars() {
            CONFIG.Actor.trackableAttributes = {
                ${joinToNode(entry.documents.filter(d => isActor(d)), document => generateTrackableResourceBars(document), { appendNewLineIfNotEmpty: true, separator: ',' })}
            };
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
                return cleanFormula;
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
