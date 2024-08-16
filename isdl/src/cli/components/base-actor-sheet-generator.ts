import * as fs from 'node:fs';
import * as path from 'node:path';
import { Entry } from '../../language/generated/ast.js';
import { expandToNode, toString } from 'langium/generate';

export function generateBaseActorSheet(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "sheets");
    const generatedFilePath = path.join(generatedFileDir, `${id}-actor-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        import ${entry.config.name}DocumentSheet from "./${id}-sheet.mjs";

        export default class ${entry.config.name}ActorSheet extends ${entry.config.name}DocumentSheet {
        
            /** @override */
            static get defaultOptions() {
                return foundry.utils.mergeObject(super.defaultOptions, {
                    secrets: [{parentSelector: ".editor"}],
                });
            }

            /* -------------------------------------------- */

            /** @override */
            get title() {
                return this.actor.isToken ? \`[Token] \${this.actor.name}\` : this.actor.name;
            }

            /* -------------------------------------------- */

            /**
             * A convenience reference to the Actor document
             * @type {Actor}
             */
            get actor() {
                return this.object;
            }

            /* -------------------------------------------- */

            /**
             * If this Actor Sheet represents a synthetic Token actor, reference the active Token
             * @type {Token|null}
             */
            get token() {
                return this.object.token || this.options.token || null;
            }

            /* -------------------------------------------- */
            /*  Methods                                     */
            /* -------------------------------------------- */

            /** @inheritdoc */
            async close(options) {
                this.options.token = null;
                return super.close(options);
            }
            
            /* -------------------------------------------- */

            /** @inheritdoc */
            async getData(options={}) {
                const context = await super.getData(options);
                context.actor = this.object;
                context.applicableEffects = Array.from(this.object.allApplicableEffects());
                return context;
            }

            /* -------------------------------------------- */

            /** @inheritdoc */
            _getHeaderButtons() {
                let buttons = super._getHeaderButtons();
                const canConfigure = game.user.isGM || (this.actor.isOwner && game.user.can("TOKEN_CONFIGURE"));
                if ( this.options.editable && canConfigure ) {
                    const closeIndex = buttons.findIndex(btn => btn.label === "Close");
                    buttons.splice(closeIndex, 0, {
                        label: this.token ? "Token" : "TOKEN.TitlePrototype",
                        class: "configure-token",
                        icon: "fas fa-user-circle",
                        onclick: ev => this._onConfigureToken(ev)
                    });
                }
                return buttons;
            }

            /* -------------------------------------------- */
            /*  Event Listeners                             */
            /* -------------------------------------------- */

            /**
             * Handle requests to configure the Token for the Actor
             * @param {PointerEvent} event      The originating click event
             * @private
             */
            _onConfigureToken(event) {
                event.preventDefault();
                const renderOptions = {
                left: Math.max(this.position.left - 560 - 10, 10),
                top: this.position.top
                };
                if ( this.token ) return this.token.sheet.render(true, renderOptions);
                else new CONFIG.Token.prototypeSheetClass(this.actor.prototypeToken, renderOptions).render(true);
            }

            /* -------------------------------------------- */
            /*  Drag and Drop                               */
            /* -------------------------------------------- */

            /** @inheritdoc */
            _canDragStart(selector) {
                return this.isEditable;
            }

            /* -------------------------------------------- */

            /** @inheritdoc */
            _canDragDrop(selector) {
                return this.isEditable;
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
