import * as path from 'node:path';
import * as fs from 'node:fs';
import { expandToNode, joinToNode, toString } from 'langium/generate';
import { Document, HtmlExp, isActor, isHtmlExp } from "../../../language/generated/ast.js";
import { humanize, titleize } from 'inflection';
import { getAllOfType } from '../utils.js';

export function generateDocumentVueSheet(id: string, document: Document, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "sheets", "vue", type);
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const vueComponentName = `${document.name.toLowerCase()}-${type}-app`;

    const htmlElements = getAllOfType<HtmlExp>(document.body, isHtmlExp, false);

    const fileNode = expandToNode`
        import VueRenderingMixin from '../VueRenderingMixin.mjs';
        import { ${document.name}${titleize(type)}App } from "../components/components.vue.es.mjs";
        const { DOCUMENT_OWNERSHIP_LEVELS } = CONST;

        export default class ${document.name}VueSheet extends VueRenderingMixin(foundry.applications.sheets.${titleize(type)}SheetV2) {

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
                classes: ["${id}", "sheet", "vue-sheet", "${type}", "${document.name.toLowerCase()}-sheet"],
                viewPermission: DOCUMENT_OWNERSHIP_LEVELS.LIMITED,
                editPermission: DOCUMENT_OWNERSHIP_LEVELS.OWNER,
                position: {
                    width: 1200,
                    height: 950,
                },
                window: {
                    resizable: true,
                    title: "${humanize(document.name)}",
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

                    // Add the document.
                    object: this.document.toObject(),
                    document: this.document,

                    // Add the data to context.data for easier access, as well as flags.
                    system: this.document.system,
                    flags: this.document.flags,

                    // Roll data.
                    rollData: this.document.getRollData() ?? {},

                    // Editors
                    editors: {},

                    // Force re-renders. Defined in the vue mixin.
                    _renderKey: this._renderKey ?? 0,
                    _arrayEntryKey: this._arrayEntryKey ?? 0,
                    // tabs: this._getTabs(options.parts),

                    // Necessary for formInput and formFields helpers
                    fields: this.document.schema.fields,
                    systemFields: this.document.system.schema.fields
                };

                // Enrich editors
                await this._enrichEditor(context, "description");
                ${joinToNode(htmlElements, htmlElement => expandToNode`await this._enrichEditor(context, "${htmlElement.name.toLowerCase()}");`, { appendNewLineIfNotEmpty: true })}

                // Make another pass through the editors to fix the element contents.
                for (let [field, editor] of Object.entries(context.editors)) {
                    if (context.editors[field].element) {
                        context.editors[field].element.innerHTML = context.editors[field].enriched;
                    }
                }

                return context;
            }

            async _enrichEditor(context, field) {
                const enrichmentOptions = {
                    // Whether to show secret blocks in the finished html
                    secrets: this.document.isOwner,
                    // Data to fill in for inline rolls
                    rollData: this.document.getRollData() ?? {},
                    // Relative UUID resolution
                    relativeTo: this.document
                };

                const editorOptions = {
                    toggled: true,
                    collaborate: true,
                    documentUUID: this.document.uuid,
                    height: 300
                };

                const editorValue = this.document.system?.[field] ?? foundry.utils.getProperty(this.document.system, field);
                context.editors[\`system.\${field}\`] = {
                    enriched: await TextEditor.enrichHTML(editorValue, enrichmentOptions),
                    element: foundry.applications.elements.HTMLProseMirrorElement.create({
                        ...editorOptions,
                        name: \`system.\${field}\`,
                        value: editorValue ?? ""
                    })
                };
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
