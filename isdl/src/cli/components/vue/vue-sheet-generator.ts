import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, toString } from 'langium/generate';
import { Document, isActor } from "../../../language/generated/ast.js";
import { titleize } from 'inflection';

export function generateDocumentVueSheet(id: string, document: Document, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "sheets", "vue", type);
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const vueComponentName = `${document.name.toLowerCase()}-${type}-app`;

    const fileNode = expandToNode`
        import VueRenderingMixin from '../VueRenderingMixin.mjs';
        import { ${document.name}${titleize(type)}App } from "../components/components.vue.es.mjs";
        const { DOCUMENT_OWNERSHIP_LEVELS } = CONST;

        export default class ${document.name}VueSheet extends VueRenderingMixin(foundry.applications.sheets.ActorSheetV2) {

            vueParts = {
                "${vueComponentName}": {
                    component: ${document.name}${titleize(type)}App,
                    template: "<${vueComponentName} :context=\\"context\\">Vue rendering for sheet failed.</${vueComponentName}>"
                }
            };

            _arrayEntryKey = 0;
            _renderKey = 0;

            /** @override */
            static DEFAULT_OPTIONS = {
                classes: ["${id}", "sheet", "${type}", "${document.name.toLowerCase()}-sheet"],
                viewPermission: DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
                editPermission: DOCUMENT_OWNERSHIP_LEVELS.OWNER,
                position: {
                    width: 1000,
                    height: 950,
                },
                window: {
                    resizable: true
                },
                tag: "form",
                actions: {
                },
                changeActions: {
                },
                // Custom property that's merged into this.options
                dragDrop: [
                    {dragSelector: "tr", dropSelector: ".tabs-container"},
                    {dropSelector: ".single-document"},
                    {dragSelector: ".paper-doll-slot", dropSelector: ".paper-doll-slot"}
                ],
                form: {
                    submitOnChange: true,
                    submitOnClose: true,
                    closeOnSubmit: false,
                }
            };

            async _prepareContext(options) {
                // Output initialization
                const context = {
                    // Validates both permissions and compendium status
                    editable: this.isEditable,
                    owner: this.document.isOwner,
                    limited: this.document.limited,

                    // Add the actor document.
                    actor: this.actor.toObject(),

                    // Add the actor's data to context.data for easier access, as well as flags.
                    system: this.actor.system,
                    flags: this.actor.flags,

                    // Roll data.
                    rollData: this.actor.getRollData() ?? {},

                    // Force re-renders. Defined in the vue mixin.
                    _renderKey: this._renderKey ?? 0,
                    _arrayEntryKey: this._arrayEntryKey ?? 0,
                    // tabs: this._getTabs(options.parts),

                    // Necessary for formInput and formFields helpers
                    fields: this.document.schema.fields,
                    systemFields: this.document.system.schema.fields
                };

                return context;
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
