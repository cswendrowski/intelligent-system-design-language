import {Entry} from "../../language/generated/ast.js";
import path from "node:path";
import fs from "node:fs";
import {expandToNode, toString} from "langium/generate";

export function generateReadyHookMjs(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "hooks");
    const generatedFilePath = path.join(generatedFileDir, `ready.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        export function ready() {
            console.log('${id} | Ready');

            registerSockets();
            //moveVuetifyStyles();
            reopenLastState();
            indexPacks();

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
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
