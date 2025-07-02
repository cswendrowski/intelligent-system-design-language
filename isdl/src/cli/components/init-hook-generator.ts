import {
    Action,
    Actor,
    Document, DocumentCreatableParam, DocumentDescriptionParam, DocumentSvgParam,
    Entry, isAction, isActor, isDocumentCreatableParam, isDocumentDefaultParam, isDocumentDescriptionParam,
    isDocumentSvgParam, isItem, isPrompt,
    isResourceExp, isStatusParamWhen, isStatusProperty, isVariableExpression, Item, Prompt,
    ResourceExp,
    StatusProperty, VariableExpression
} from "../../language/generated/ast.js";
import path from "node:path";
import fs from "node:fs";
import {CompositeGeneratorNode, expandToNode, joinToNode, toString} from "langium/generate";
import {getAllOfType} from "./utils.js";

export function generateInitHookMjs(entry: Entry, id: string, destination: string) {
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
        if (!svg) {
            if (document.name.toLowerCase() === "dead") svg = "icons/svg/skull.svg";
            else svg = "icons/svg/upgrade.svg";
        }
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

    function generateRegisterStatusEffects(): CompositeGeneratorNode {
        let statusEffects = getAllOfType<StatusProperty>(entry.documents, isStatusProperty, false);
        if (statusEffects.length === 0) return expandToNode`
            function registerStatusEffects() { }
        `;

        let hasDead = statusEffects.find(x => x.name.toLowerCase() === "dead");

        return expandToNode`
        function registerStatusEffects() {
            CONFIG.statusEffects = [
                ${hasDead ? '' : `{"id":"dead","name":"EFFECT.StatusDead","img":"icons/svg/skull.svg"},`}
                {"id":"unconscious","name":"EFFECT.StatusUnconscious","img":"icons/svg/unconscious.svg"},
                {"id":"invisible","name":"EFFECT.StatusInvisible","img":"icons/svg/invisible.svg"},
                ${joinToNode(statusEffects, generateStatusEffect, { appendNewLineIfNotEmpty: true, separator: ',' })}
            ];
        }
        `.appendNewLine();
    }


    let actorDocs = entry.documents.filter(d => isActor(d)).map(d => d as Actor);
    let actorDefaultType = actorDocs.find(a => a.params.find(p => isDocumentDefaultParam(p) && p.value))?.name.toLowerCase() ?? actorDocs[0]?.name.toLowerCase();
    let actorArtworks = actorDocs.filter(a => a.params.find(p => isDocumentSvgParam(p)));
    let actorDescriptions = actorDocs.filter(a => a.params.find(p => isDocumentDescriptionParam(p)));
    let actorCreatables = actorDocs.filter(a => a.params.find(p => isDocumentCreatableParam(p)));

    let itemDocs = entry.documents.filter(d => isItem(d)).map(d => d as Item);
    let itemDefaultType = itemDocs.find(a => a.params.find(p => isDocumentDefaultParam(p) && p.value))?.name.toLowerCase() ?? itemDocs[0]?.name.toLowerCase();
    let itemArtworks = itemDocs.filter(a => a.params.find(p => isDocumentSvgParam(p)));
    let itemDescriptions = itemDocs.filter(a => a.params.find(p => isDocumentDescriptionParam(p)));
    let itemCreatables = itemDocs.filter(a => a.params.find(p => isDocumentCreatableParam(p)));

    function generateDocumentPromptImports(document: Document): CompositeGeneratorNode | undefined {
        const actions = getAllOfType<Action>(document.body, isAction, false);
        return joinToNode(actions.map(x => generatePromptImports(x, document)).filter(x => x !== undefined).map(x => x as CompositeGeneratorNode), { appendNewLineIfNotEmpty: true });
    }

    function generatePromptImports(action: Action, document: Document): CompositeGeneratorNode | undefined {
        const type = isActor(document) ? 'actor' : 'item';
        const variables = action.method.body.filter(x => isVariableExpression(x)) as VariableExpression[];
        const prompts = variables.filter(x => isPrompt(x.value)).map(x => x.value) as Prompt[];

        return joinToNode(prompts.map(x => `import ${document.name}${action.name}PromptApp from "../sheets/vue/${type}/prompts/${document.name.toLowerCase()}-${action.name}-prompt-app.mjs";`), { appendNewLineIfNotEmpty: true });
    }

    function generateDocumentPromptAssignment(document: Document): CompositeGeneratorNode | undefined {
        const actions = getAllOfType<Action>(document.body, isAction, false);
        return joinToNode(actions.map(x => generatePromptAssignments(x, document)).filter(x => x !== undefined).map(x => x as CompositeGeneratorNode), { appendNewLineIfNotEmpty: true, separator: ',' });
    }

    function generatePromptAssignments(action: Action, document: Document): CompositeGeneratorNode | undefined {
        const variables = action.method.body.filter(x => isVariableExpression(x)) as VariableExpression[];
        const prompts = variables.filter(x => isPrompt(x.value)).map(x => x.value) as Prompt[];

        return joinToNode(prompts.map(x => `${document.name.toLowerCase()}${action.name}: ${document.name}${action.name}PromptApp`), { appendNewLineIfNotEmpty: true, separator: ',' });
    }

    const fileNode = expandToNode`
        ${joinToNode(entry.documents, document => `import ${document.name}TypeDataModel from "../datamodels/${isActor(document) ? "actor" : "item"}/${document.name.toLowerCase()}.mjs"`, { appendNewLineIfNotEmpty: true })}
        ${joinToNode(entry.documents, document => `import ${document.name}VueSheet from "../sheets/vue/${isActor(document) ? "actor" : "item"}/${document.name.toLowerCase()}-sheet.mjs"`, { appendNewLineIfNotEmpty: true })}
        import DataTableApp from "../sheets/vue/datatable-app.mjs";
        ${joinToNode(entry.documents, generateDocumentPromptImports, { appendNewLineIfNotEmpty: true })}
        import ${entry.config.name}EffectSheet from "../sheets/active-effect-sheet.mjs";
        import ${entry.config.name}Actor from "../documents/actor.mjs";
        import ${entry.config.name}Item from "../documents/item.mjs";
        import ${entry.config.name}Combatant from "../documents/combatant.mjs";
        import ${entry.config.name}TokenDocument from "../documents/token.mjs";
        import ${entry.config.name}Token from "../canvas/token.mjs";
        import ${entry.config.name}Roll from "../rolls/roll.mjs";

        export function init() {
            console.log('${id} | Initializing System');

            CONFIG.ActiveEffect.legacyTransferral = false;

            registerSettings();
            registerDataModels();
            registerDocumentSheets();
            registerDocumentClasses();
            registerPromptClasses();
            registerCanvasClasses();
            registerTypeInfo();
            registerHandlebarsHelpers();
            registerResourceBars();
            registerStatusEffects();
            registerUtils();
            //addVueImportMap();

            game.system.documentHooks = new Map();
            game.system.datatableApp = DataTableApp;
            game.system.rollClass = ${entry.config.name}Roll;
            CONFIG.Dice.rolls.push(${entry.config.name}Roll);
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
                type: String
            });

            game.settings.register('${id}', 'hotReloadLastState', {
                scope: 'client',
                config: false,
                default: { openWindows: [] },
                type: Object
            });

            game.settings.register('${id}', 'documentColorThemes', {
                scope: 'client',
                config: false,
                default: {},
                type: Object
            });

            game.settings.register('${id}', 'documentLastState', {
                scope: 'client',
                config: false,
                default: {},
                type: Object
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
            ${joinToNode(entry.documents.filter(d => isActor(d)), document => `Actors.registerSheet("${id}", ${document.name}VueSheet, {types: ["${document.name.toLowerCase()}"], makeDefault: true});`, { appendNewLineIfNotEmpty: true })}

            // Items
            ${joinToNode(entry.documents.filter(d => isItem(d)), document => `Items.registerSheet("${id}", ${document.name}VueSheet, {types: ["${document.name.toLowerCase()}"], makeDefault: true});`, { appendNewLineIfNotEmpty: true })}
        
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

        function registerPromptClasses() {
            game.system.prompts = {
                ${joinToNode(entry.documents, document => generateDocumentPromptAssignment(document), { separator: ',\n' })}
            };
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

        ${generateRegisterStatusEffects()}

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

            async function callAllAsync(hook, ...args) {
                if ( CONFIG.debug.hooks ) {
                    console.log(\`DEBUG | Calling async \${hook} hook with args:\`);
                    console.log(args);
                }
                const events = Hooks.events;
                if ( !(hook in events) ) return true;
                for ( const entry of Array.from(events[hook]) ) {
                    await entry.fn(...args);
                }
                return true;
            }

            Hooks.callAllAsync = callAllAsync;
            
            let audioSources = new Map();
            let gainNodes = new Map();
            
            async function playAudio(id, url, onEndCallback, volume=0.5) {
                let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                let source = audioCtx.createBufferSource();
                let gainNode = audioCtx.createGain();
                audioSources.set(id, source);
                gainNodes.set(id, gainNode);
                source.connect(gainNode).connect(audioCtx.destination);
        
                let request = new XMLHttpRequest();
                request.open('GET', url, true);
                request.responseType = 'arraybuffer';
        
                request.onload = () => {
                    let audioData = request.response;
                    audioCtx.decodeAudioData(audioData,
                        (buffer) => {
                            source.buffer = buffer;
                            gainNode.gain.value = volume;
                            source.start(0);
                            source.onended = () => {
                                audioSources.delete(id);
                                gainNodes.delete(id);
                                onEndCallback();
                            };
                        },
                        (e) => {
                            ui.notifications.error("An error occurred while decoding audio data");
                            console.log(url);
                            console.log(audioData);
                            console.log(e);
                            onEndCallback();
                        });
                };
                try {
                    request.send();
                }
                catch (e) {
                    console.error("Error playing sound effect:", e);
                    onEndCallback();
                }
            }
            
            async function playSfx(url, volume=0.5) {
                // Invoke the playAudio function with the provided parameters and wait for it to complete vis the onEndCallback
                let finishedPromise = new Promise(async (resolve) => {
                    let onEndCallback = () => {
                        resolve();
                    };
                    // Attach base url
                    if (!url.startsWith("http")) {
                        url = \`\${window.location.origin}/systems/${id}/\${url}\`;
                    }
                    
                    await playAudio(foundry.utils.randomID(), url, onEndCallback, volume);
                });
                return finishedPromise;
            }
            game.system.utils.playSfx = playSfx;
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
