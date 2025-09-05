import {Entry, isConfigExpression} from "../../language/generated/ast.js";
import path from "node:path";
import fs from "node:fs";
import {expandToNode, toString} from "langium/generate";
import {collectAllStatusEffects} from "./keywords-generator.js";

export function generateReadyHookMjs(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "hooks");
    const generatedFilePath = path.join(generatedFileDir, `ready.mjs`);

    // Extract system label for journal naming
    const systemLabel = (entry.config.body.find(x => isConfigExpression(x) && x.type === "label") as any)?.value?.replace(/['"]/g, '') || id;

    // Collect status effects with conditions at build time
    const statusEffectsMap = collectAllStatusEffects(entry);
    const statusEffectsData = Object.fromEntries(statusEffectsMap);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        export async function ready() {
            console.log('${id} | Ready');

            registerSockets();
            //moveVuetifyStyles();
            reopenLastState();
            indexPacks();
            await createKeywordJournals();

            function getTargetOrNothing() {
                if (game.user.targets.size > 0) {
                    const firstTarget = game.user.targets.first();
                    return firstTarget.actor;
                }
                return null;
            }
            // Attach to game.user
            game.user.getTargetOrNothing = getTargetOrNothing;
        }
        
        /* -------------------------------------------- */

        function registerSockets() {
            game.socket.on("system.${id}", (data) => {
                console.log("Socket Data", data);

                if (data.type === "prompt") {
                    _handlePrompt(data);
                }
                else if (data.type === "combat") {
                    _handleCombat(data);
                }
            });
        }

        /* -------------------------------------------- */

        async function _handlePrompt(message) {
            await new Promise(async (resolve, reject) => {
                if (message.timeLimit && message.timeLimit > 0) {
                    setTimeout(() => {
                        console.warn("Prompt timed out:", message.uuid);
                        // Find the window from ui.windows with the uuid
                        const dialog = Object.values(ui.windows).find(w => w.options.classes.includes("dialog") && w.options.classes.includes("prompt") && w.options.classes.includes(message.uuid));
                        if (dialog) {
                            dialog.close();
                        }
                        game.socket.emit("system.${id}", {
                            type: "promptResponse",
                            uuid: message.uuid,
                            data: {}
                        }, { recipients: [message.userId] });
                        resolve();
                    }, message.timeLimit);
                }
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
                            else if (value === "null") {
                                data[key] = null;
                                data.system[key] = null;
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
    
                        resolve();
                        return data;
                    },
                    options: {
                        classes: ["${id}", "dialog", "prompt", message.uuid],
                        width: message.width,
                        height: message.height,
                        left: message.left,
                        top: message.top,
                    }
                });
            });
        }
        
        /* -------------------------------------------- */
        
        async function _handleCombat(message) {
            switch(message.method) {
                case "nextTurn": game.combat.nextTurn(); break;
                case "endCombat": game.combat.endCombat(); break;
            }
        }

        /* -------------------------------------------- */

        function moveVuetifyStyles() {

            const observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === "childList") {
                        const themeStylesheet = document.getElementById("vuetify-theme-stylesheet");
                        if (themeStylesheet) {
                            console.log("Vuetify theme stylesheet loaded:", themeStylesheet);
                            
                            // Create a new style node
                            const vuetifyThemeOverrides = document.createElement("style");
                            vuetifyThemeOverrides.id = "vuetify-theme-overrides";
                            vuetifyThemeOverrides.innerHTML = \`
                                .v-theme--light {
                                    --v-disabled-opacity: 0.7;
                                }
                            \`;

                            document.head.insertAdjacentElement('beforeEnd', vuetifyThemeOverrides);
                            
                            // Perform any modifications or actions here
                            observer.disconnect(); // Stop observing once found
                        }
                    }
                }
            });

            // Observe the <head> for new styles being added
            observer.observe(document.head, { childList: true, subtree: true });
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

        /* -------------------------------------------- */

        function indexPacks() {
            for (const pack of game.packs) {
                pack.getIndex({ fields: ['system.description', 'system'] });
            }
        }

        /* -------------------------------------------- */

        async function createKeywordJournals() {
            if (!game.user.isGM || (!game.system.keywords && !game.system.statusEffects)) return;
            if (!game.settings.get("${id}", "createSystemJournal")) return;

            // Create System folder if it doesn't exist
            let keywordsFolder = game.folders.find(f => f.name === "System" && f.type === "JournalEntry");
            if (!keywordsFolder) {
                keywordsFolder = await Folder.create({
                    name: "System",
                    type: "JournalEntry",
                    color: "#42a5f5",
                    parent: null,
                    sort: 0
                });
            }

            // Find or create the system documentation journal
            let keywordsJournal = game.journal.find(j => j.getFlag('${id}', 'systemJournal') === true);
            
            if (!keywordsJournal) {
                // Create the main system documentation journal
                const journalData = {
                    name: "${systemLabel}",
                    folder: keywordsFolder.id,
                    flags: {
                        core: {
                            keywordsJournal: true  // Legacy compatibility
                        },
                        '${id}': {
                            systemJournal: true,
                            version: game.system.version
                        }
                    }
                };

                keywordsJournal = await JournalEntry.create(journalData);
            }

            // Separate keywords by type
            const regularKeywords = {};
            const damageTypes = {};
            
            if (game.system.keywords) {
                for (const [keywordKey, keywordData] of Object.entries(game.system.keywords)) {
                    if (keywordData.type === 'damage-type') {
                        damageTypes[keywordKey] = keywordData;
                    } else {
                        regularKeywords[keywordKey] = keywordData;
                    }
                }
            }

            // Use pre-collected status effects data with conditions
            const statusEffects = ${JSON.stringify(statusEffectsData, null, 12).split('\n').join('\n            ')};

            // Check and create/update Keywords page
            let keywordsPage = keywordsJournal.pages.find(p => p.getFlag('core', 'pageType') === 'keywords');
            if (Object.keys(regularKeywords).length > 0) {
                const keywordsContent = generateKeywordsPageContent(regularKeywords);
                
                if (!keywordsPage) {
                    // Create new page
                    const keywordsPageData = {
                        name: "Keywords",
                        type: "text",
                        title: {
                            show: true,
                            level: 1
                        },
                        text: {
                            content: keywordsContent,
                            format: 1 // HTML format
                        },
                        flags: {
                            core: {
                                pageType: 'keywords'
                            }
                        }
                    };

                    await keywordsJournal.createEmbeddedDocuments("JournalEntryPage", [keywordsPageData]);
                } else {
                    // Update existing page content
                    await keywordsPage.update({
                        "text.content": keywordsContent
                    });
                }
            }

            // Check and create/update Damage Types page
            let damageTypesPage = keywordsJournal.pages.find(p => p.getFlag('core', 'pageType') === 'damage-types');
            if (Object.keys(damageTypes).length > 0) {
                const damageTypesContent = generateDamageTypesPageContent(damageTypes);
                
                if (!damageTypesPage) {
                    // Create new page
                    const damageTypesPageData = {
                        name: "Damage Types",
                        type: "text",
                        title: {
                            show: true,
                            level: 1
                        },
                        text: {
                            content: damageTypesContent,
                            format: 1 // HTML format
                        },
                        flags: {
                            core: {
                                pageType: 'damage-types'
                            }
                        }
                    };

                    await keywordsJournal.createEmbeddedDocuments("JournalEntryPage", [damageTypesPageData]);
                } else {
                    // Update existing page content
                    await damageTypesPage.update({
                        "text.content": damageTypesContent
                    });
                }
            }

            // Check and create/update Status Effects page
            let statusEffectsPage = keywordsJournal.pages.find(p => p.getFlag('core', 'pageType') === 'status-effects');
            if (Object.keys(statusEffects).length > 0) {
                const statusEffectsContent = generateStatusEffectsPageContent(statusEffects);
                
                if (!statusEffectsPage) {
                    // Create new page
                    const statusEffectsPageData = {
                        name: "Status Effects",
                        type: "text",
                        title: {
                            show: true,
                            level: 1
                        },
                        text: {
                            content: statusEffectsContent,
                            format: 1 // HTML format
                        },
                        flags: {
                            core: {
                                pageType: 'status-effects'
                            }
                        }
                    };

                    await keywordsJournal.createEmbeddedDocuments("JournalEntryPage", [statusEffectsPageData]);
                } else {
                    // Update existing page content
                    await statusEffectsPage.update({
                        "text.content": statusEffectsContent
                    });
                }
            }
        }

        function generateKeywordsPageContent(keywords) {
            let content = '<div style="margin-bottom: 20px;"><p>Game mechanics and special conditions that affect gameplay:</p></div>';
            
            for (const [keywordKey, keyword] of Object.entries(keywords)) {
                content += \`<div class="keyword-entry" id="\${keywordKey}" style="border-left: 4px solid \${keyword.color}; padding: 12px; margin-bottom: 16px;">
                    <header style="display: flex; align-items: center; margin-bottom: 8px;">
                        \${keyword.icon ? \`<i class="\${keyword.icon}" style="color: \${keyword.color}; margin-right: 8px; font-size: 1.2em;"></i>\` : ''}
                        <h3 style="margin: 0;">\${keyword.name}</h3>
                    </header>
                    \${keyword.description ? \`<div class="description"><p>\${keyword.description}</p></div>\` : ''}
                </div>\`;
            }
            
            return content;
        }

        function generateDamageTypesPageContent(damageTypes) {
            let content = \`<div style="margin-bottom: 20px;"><p>Types of damage that can be dealt and their effects.</p>
                             <div class="damage-type-info" style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 0.9em;">
                                    <strong>Damage Type Effects:</strong>
                                    <ul style="margin: 4px 0 0 16px;">
                                        <li>Can be used in damage rolls and calculations</li>
                                        <li>May have associated resistances and bonuses</li>
                                        <li>Appears in damage type choice fields</li>
                                    </ul>
                                </div>
                            </div>\`;

            for (const [keywordKey, keyword] of Object.entries(damageTypes)) {
                content += \`<div class="damage-type-entry" id="\${keywordKey}" style="border-left: 4px solid \${keyword.color}; padding: 12px; margin-bottom: 16px;">
                    <header style="display: flex; align-items: center; margin-bottom: 8px;">
                        \${keyword.icon ? \`<i class="\${keyword.icon}" style="color: \${keyword.color}; margin-right: 8px; font-size: 1.2em;"></i>\` : ''}
                        <h3 style="margin: 0; color: \${keyword.color};">\${keyword.name}</h3>
                        <span style="margin-left: auto; font-size: 0.8em; background: \${keyword.color}20; padding: 2px 6px; border-radius: 3px;">Damage Type</span>
                    </header>
                    \${keyword.description ? \`<div class="description" style="margin-bottom: 12px;"><p>\${keyword.description}</p></div>\` : ''}
                </div>\`;
            }
            
            return content;
        }

        function generateStatusEffectsPageContent(statusEffects) {
            let content = \`<div style="margin-bottom: 20px;"><p>Conditions and effects that can be applied to characters.</p>
                             <div class="status-effect-info" style="background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 0.9em;">
                                    <strong>Status Effect Usage:</strong>
                                    <ul style="margin: 4px 0 0 16px;">
                                        <li>Can be applied to tokens on the canvas</li>
                                        <li>Appear in the token status effects menu</li>
                                        <li>Provide visual indicators of character state</li>
                                    </ul>
                                </div>
                            </div>\`;
            console.log(statusEffects);
            for (const [statusId, statusEffect] of Object.entries(statusEffects)) {
                const isDeathEffect = statusEffect.isDeath || statusId.toLowerCase().includes('dead');
                const effectColor = isDeathEffect ? '#dc2626' : '#4f46e5';
                const effectBadge = isDeathEffect ? 'Death Effect' : 'Status Effect';
                
                content += \`<div class="status-effect-entry" id="\${statusId}" style="border-left: 4px solid \${effectColor}; padding: 12px; margin-bottom: 16px;">
                    <header style="display: flex; align-items: center; margin-bottom: 8px;">
                        \${statusEffect.img ? \`<img src="\${statusEffect.img}" alt="\${statusEffect.name}" style="width: 32px; height: 32px; margin-right: 8px; border-radius: 4px; object-fit: cover;" />\` : ''}
                        <h3 style="margin: 0; color: \${effectColor};">\${statusEffect.name}</h3>
                        <span style="margin-left: auto; font-size: 0.8em; background: \${effectColor}20; color: \${effectColor}; padding: 2px 6px; border-radius: 3px;">\${effectBadge}</span>
                    </header>
                    \${statusEffect.condition ? \`<div class="condition-info" style="margin-bottom: 12px; padding: 8px; background: #f0f9ff; border-left: 3px solid #0ea5e9; border-radius: 4px;">
                        <p style="margin: 0;"><strong>Applied when:</strong> \${statusEffect.condition}</p>
                    </div>\` : ''}
                    <div class="technical-info" style="margin-top: 12px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 0.85em; color: #6b7280;">
                        \${isDeathEffect ? '<br>• <strong style="color: #dc2626;">Death Effect</strong> - Will be applied when character reaches 0 health' : ''}
                    </div>
                </div>\`;
            }
            
            return content;
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
