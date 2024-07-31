import { expandToNode, toString } from "langium/generate";
import { Entry } from "../../language/generated/ast.js";
import * as fs from 'node:fs';
import * as path from 'node:path';

export function generateChatCardClass(entry: Entry, destination: string) {

    const generatedFileDir = path.join(destination, "system", "documents");
    const generatedFilePath = path.join(generatedFileDir, `chat-card.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        export default class ${entry.config.name}ChatCard {
            
            static activateListeners(html) {
                html.on("click", ".collapsible", ${entry.config.name}ChatCard._onChatCardToggleCollapsible.bind(this));
            
                // Customize the drag data of effects
                html.find(".effect").each((i, li) => {
                    li.setAttribute("draggable", true);
                    li.addEventListener("dragstart", async ev => {
                        let dragData = {
                            type: "ActiveEffect",
                            uuid: li.dataset.uuid
                        };
                        ev.dataTransfer.setData("text/plain", JSON.stringify(dragData));
                    }, false);
                });

                // If this is not the latest message, default to collapsed
                const thisMessageId = html.data("messageId");
                const messages = Array.from(game.messages);
                const latestMessageId = messages[game.messages.size - 1]._id;
                if (thisMessageId !== latestMessageId) {
                    html.find(".collapsible").addClass("collapsed");
                }

                // Collapse the previous message automatically if it is not already collapsed
                const previousMessageId = messages[game.messages.size - 2]?._id;
                const previousMessage = window.document.querySelector(\`#chat .chat-message[data-message-id="\${previousMessageId}"]\`);
                if (previousMessage) {
                    for (const collapsible of previousMessage.querySelectorAll(".collapsible") ?? []) {
                        if (!collapsible.classList.contains("collapsed")) {
                            collapsible.classList.add("collapsed");
                        }
                    }
                }
            }

            /* -------------------------------------------- */

            static _onChatCardToggleCollapsible(event) {
                const target = event.currentTarget;
                event.preventDefault();
                target.classList.toggle("collapsed");

                // Clear the height from the chat popout container so that it appropriately resizes.
                const popout = target.closest(".chat-popout");
                if ( popout ) popout.style.height = "";
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

export function generateStandardChatCardTemplate(destination: string) {
    const generatedFileDir = path.join(destination, "system", "templates", "chat");
    const generatedFilePath = path.join(generatedFileDir, `standard-card.hbs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        <div class="{{cssClass}} standard-chat-card chat-card">
            <div class="chat-header collapsible collapsed">
                <header class="flexrow">
                    <img src="{{document.img}}" title="{{document.name}}" width="50" height="50">
                    <div class="title">
                        <div class="name">{{document.name}}</div>
                        <div class="type">{{localize document.type}}</div>
                    </div>
                    <i class="collapse-icon fas fa-chevron-down fa-fw"></i>
                </header>

                <section class="description collapsible-content">
                    {{{description}}}
                </section>
            </div>
            <div class="chat-info">
                <dl>
                    {{#each parts}}
                        {{#if this.isRoll }}
                            <div class="dice-roll wide">
                                <div class="dice-result">
                                    <h4 class="dice-total"><i class="fa-solid fa-dice-d20"></i> <span class="label">{{this.label}}:</span> <span class="formula">{{this.value.cleanFormula}}</span> <span class="result">{{this.value._total}}</span></h4>
                                    {{{this.tooltip}}}
                                </div>
                            </div>
                        {{else}}
                            {{#if this.wide}}
                                <div class="wide collapsible">
                                    <dt class="title">{{this.label}} <i class="collapse-icon fas fa-chevron-down fa-fw"></i></dt>
                                    <dd class="collapsible-content">{{{this.value}}}</dd>
                                </div>
                            {{else}}
                                <dt>{{this.label}}</dt>
                                <dd>{{{this.value}}}</dd>
                            {{/if}}
                        {{/if}}
                    {{/each}}
                </dl>

                <div class="chat-info-tags">
                    {{#each tags}}
                        <div class="tag"><span class="label">{{this.label}}</span> {{this.value}}</div>
                    {{/each}}
                </div>
            </div>
            <div class="chat-effects collapsible">
                <h3 class="title">{{localize "EFFECT.TabEffects"}} <i class="collapse-icon fas fa-chevron-down fa-fw"></i></h3>
                <div class="effects collapsible-content">
                {{#each document.effects}}
                    <div class="effect" draggable="true" data-uuid="{{this.uuid}}">
                        <header class="flexrow">
                            <img src="{{this.img}}" title="{{this.name}}" width="30" height="30">
                            <div class="name">{{this.name}}</div>
                        </header>
                        <div class="effect-content">{{{this.description}}}</div>
                    </div>
                {{/each}}
                </div>
            </div>
        </div>
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}