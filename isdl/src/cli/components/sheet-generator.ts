import type {
    ClassExpression,
    Document,
    Entry,
    HtmlExp,
    Section,
    Action,
    MethodBlock,
    StringExp,
    PipsExp,
    DamageTrackExp,
    DocumentArrayExp,
    IconParam,
    HiddenCondition,
    SingleDocumentExp,
    ColorParam,
} from '../../language/generated/ast.js';
import {
    isActor,
    isNumberExp,
    isHtmlExp,
    isSection,
    isStringExp,
    isBooleanExp,
    isResourceExp,
    isAttributeExp,
    isAction,
    isPipsExp,
    isDamageTrackExp,
    isDocumentArrayExp,
    isProperty,
    isDisabledCondition,
    isHiddenCondition,
    isIconParam,
    isSingleDocumentExp,
    isColorParam,
    isNumberParamValue,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { translateExpression } from './method-generator.js';
import { getSystemPath, toMachineIdentifier } from './utils.js';
import { Reference } from 'langium';

export function generateBaseSheet(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "sheets");
    const generatedFilePath = path.join(generatedFileDir, `${id}-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const fileNode = expandToNode`
        export default class ${entry.config.name}DocumentSheet extends DocumentSheet {
        
            /** @override */
            static get defaultOptions() {
                return foundry.utils.mergeObject(super.defaultOptions, {
                    classes: ["${id}", "sheet"],
                    width: 1000,
                    height: "auto",
                    resizable: true,
                    submitOnClose: true,
                    submitOnChange: true,
                    closeOnSubmit: false,
                    tabs: [{navSelector: ".tabs", contentSelector: ".tabs-container", initial: "description"}],
                    dragDrop: [{dragSelector: "tr", dropSelector: ".tabs-container"}, {dropSelector: ".single-document"}],
                });
            }

            /* -------------------------------------------- */

            /** @override */
            get title() {
                return \`\${this.object.name} \${game.i18n.localize("Config")}\`;
            }

            /* -------------------------------------------- */

            /** @override */
            async getData() {
                const context = await super.getData();
                context.descriptionHTML = await TextEditor.enrichHTML(
                    this.object.system.description,
                    {async: true, secrets: this.object.isOwner}
                );
                return context;
            }

            /* -------------------------------------------- */

            activatedTables = [];

            /** @override */
            activateListeners(html) {
                super.activateListeners(html);

                html.find(".pips-container").mousedown(this._onPipsClick.bind(this));
                html.find(".row-action").click(this._onTableRowAction.bind(this));
                html.find(".single-document-remove").click(this._onSingleDocumentRemove.bind(this));

                this.activateDataTables(html);
                this.activateProgressBars(html);
            }

            /* -------------------------------------------- */

            activateDataTables(html) {
                for ( let t of this.activatedTables ) {
                    try {
                        t.destroy();
                    } catch { }
                }
                this.activatedTables = [];
                var tables = this._element.find("table");
                for ( let t of tables ) {
                    let table = new DataTable(t, {
                        paging: false,
                        scrollY: 250,
                        stateSave: true,
                        responsive: true,
                        scrollX: false,
                        colReorder: true,
                        layout: {
                            topStart: {
                                buttons: [
                                    {
                                        text: '<i class="fas fa-plus"></i> Add',
                                        action: (e, dt, node, config) => {
                                            // Find the parent tab so we know what type of Item to create
                                            const tab = e.currentTarget.closest(".tab");
                                            const type = tab.dataset.type;
                                            if ( type == "ActiveEffect" ) {
                                                ActiveEffect.createDocuments([{label: "New Effect"}], {parent: this.object}).then(effect => {
                                                    effect[0].sheet.render(true);
                                                });
                                            }
                                            else {
                                                Item.createDocuments([{type: type, name: "New " + type}], {parent: this.object}).then(item => {
                                                    item[0].sheet.render(true);
                                                });
                                            }
                                        }
                                    }
                                ]
                            }
                        },
                        columnDefs: [
                            {
                                targets: [0, 1, -1], // Image, Name, Actions
                                responsivePriority: 1
                            },
                            {
                                target: 0, // Image
                                width: "40px"
                            },
                            {
                                target: -1, // Actions
                                orderable: false,
                                width: "200px"
                            }
                        ],
                        order: [
                            [1, "asc"]
                        ]
                    });

                    // When the table is re-ordered, update the sort attribute of each item
                    table.on('row-reordered', function (e, diff, edit) {
                        for (var i = 0, ien = diff.length; i < ien; i++) {
                            const id = diff[i].node.dataset.id;
                            const item = self.object.items.get(id);
                            if (item) {
                                item.update({sort: diff[i].newPosition});
                            }
                        }
                    });
                    this.activatedTables.push(table);
                }
            }

            /* -------------------------------------------- */

            lastKnownProgressBars = [];
            activateProgressBars(html) {
                const progressBars = html.find(".progress-bar");
                for ( let p of progressBars ) {
                    const fromColor = p.dataset.colorFrom;
                    const toColor = p.dataset.colorTo;

                    // If we don't have a value and max, we can't create a progress bar
                    if (p.dataset.value === undefined || p.dataset.max === undefined) continue;

                    const value = parseFloat(p.dataset.value);
                    const max = parseFloat(p.dataset.max);

                    if ( isNaN(value) || isNaN(max) ) continue;
                    if ( max <= 0 ) continue;

                    const percent = Math.min(Math.max(value / max, 0), 1);
                    const name = p.attributes.name.value;

                    var bar = new ProgressBar.Line(p, {
                        strokeWidth: 3,
                        easing: 'easeInOut',
                        duration: 1400,
                        color: '#FFEA82',
                        trailColor: '#eee',
                        trailWidth: 1,
                        svgStyle: {width: '100%', height: '100%'},
                        from: {color: fromColor},
                        to: {color: toColor},
                        step: (state, bar) => {
                            bar.path.setAttribute('stroke', state.color);
                        }
                    });

                    // We store a name: value pair for each progress bar. If there is a last known value, we set that as the non-animated base then update to the new value..
                    const lastKnown = this.lastKnownProgressBars.find(p => p.name === name);
                    if ( lastKnown ) {
                        bar.set(lastKnown.percent);
                        bar.animate(percent);
                        lastKnown.percent = percent;
                    } else {
                        bar.set(percent);
                        this.lastKnownProgressBars.push({name: name, percent: percent});
                    }
                }
            }

            /* -------------------------------------------- */

            /** @override */
            _onChangeTab(event, tabs, active) {
                super._onChangeTab(event, tabs, active);

                // Redraw any DataTable instances which are active within the form for correct sizing
                for ( let table of this.activatedTables ) {
                    table.draw();
                    table.responsive.rebuild();
                    table.responsive.recalc();
                }
            }

            /* -------------------------------------------- */

            /** @override */
            async close(options={}) {

                // Destroy any DataTable instances which are active within the form
                for ( let t of this.activatedTables ) {
                    t.destroy();
                }
                this.activatedTables = [];

                // Call the base close method
                return super.close(options);
            }

            /* -------------------------------------------- */

            /** @override */
            _onResize(event) {
                super._onResize(event);

                // Redraw any DataTable instances which are active within the form for correct sizing
                for ( let table of this.activatedTables ) {
                    table.draw();
                    table.responsive.rebuild();
                    table.responsive.recalc();
                }
            }

            /* -------------------------------------------- */

            async _onDrop(event) {
                super._onDrop(event);
                const data = JSON.parse(event.dataTransfer.getData("text/plain"));

                // If the drop target is a single document, handle it differently
                if (event.currentTarget.classList.contains("single-document")) {
                    const doc = await fromUuid(data.uuid);
                    if ( !doc ) return;
                    if ( doc.type !== event.currentTarget.dataset.type ) {
                        ui.notifications.error(\`Expected a \${event.currentTarget.dataset.type} type Document, but got a \${doc.type} type one instead. \`);
                        return;
                    }

                    const update = {};
                    update[event.currentTarget.dataset.name] = data.uuid;
                    await this.object.update(update);
                    return;
                }

                const dropTypes = ["Item", "ActiveEffect"];
                if ( !dropTypes.includes(data.type) ) return;
                const item = await fromUuid(data.uuid);
                if ( !item ) return;

                if ( data.type === "ActiveEffect" ) {
                    ActiveEffect.createDocuments([item], {parent: this.object})
                    return;
                }

                await this.handleItemDrop(item);
            }

            /* -------------------------------------------- */

            async handleItemDrop(item) { }

            /* -------------------------------------------- */

            async _onPipsClick(event) {
                event.preventDefault();

                const name = event.currentTarget.dataset.name;
                const update = {};

                // If this is a right click, decrement the value
                if ( event.button === 2 ) {
                    update["system." + name] = Math.max(0, this.object.system[name] - 1);
                }
                // Else, increment
                else {
                    const max = parseInt(event.currentTarget.dataset.max);
                    update["system." + name] = Math.min(max, this.object.system[name] + 1);
                }
                this.object.update(update);
            }

            /* -------------------------------------------- */

            async _onTableRowAction(event) {
                event.preventDefault();

                const action = event.currentTarget.dataset.action;
                const id = event.currentTarget.closest("tr").dataset.id;
                const type = event.currentTarget.closest(".tab").dataset.type;
                const typeAccessor = type === "ActiveEffect" ? "effects" : "items";
                const item = this.object[typeAccessor].get(id);

                // If this is a .item-custom-action, route it to the item sheet handler
                if ( event.currentTarget.classList.contains("item-custom-action") ) {
                    await item.sheet._onAction(event);
                    return;
                }

                switch ( action ) {
                    case "edit":
                        item.sheet.render(true);
                        break;
                    case "delete":
                        const shouldDelete = await Dialog.confirm({
                            title: "Delete Confirmation",
                            content: \`<p>Are you sure you would like to delete \${item.name}?</p>\`,
                            defaultYes: false
                        });
                        if ( shouldDelete ) item.delete();
                        break;
                    case "sendToChat":
                        const content = await renderTemplate("systems/${id}/system/templates/chat/standard-card.hbs", { 
                            cssClass: "${id}",
                            document: item,
                            description: item.description ?? item.system.description
                        });
                        ChatMessage.create({
                            content: content,
                            speaker: ChatMessage.getSpeaker(),
                            type: CONST.CHAT_MESSAGE_TYPES.IC
                        });
                        break;
                    case "toggle":
                        await item.update({ "disabled": !item.disabled });
                        break;
                    default:
                        await this.handleTableRowAction(item, action);
                        break;
                }
            }

            /* -------------------------------------------- */

            async handleTableRowAction(item, action) { }
            
            /* -------------------------------------------- */

            async _onSingleDocumentRemove(event) {
                event.preventDefault();
                const update = {};
                update[event.currentTarget.dataset.name] = null;
                await this.object.update(update);
            }

            /* -------------------------------------------- */

            _onDragStart(event) {
                console.log("Drag Start");
                const tr = event.currentTarget.closest("tr");
                const data = {
                    type: tr.dataset.type == "ActiveEffect" ? "ActiveEffect" : "Item",
                    uuid: tr.dataset.uuid
                };

                event.dataTransfer.setData("text/plain", JSON.stringify(data));
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

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
            getData(options={}) {
                const context = super.getData(options);
                context.actor = this.object;
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

export function generateDocumentSheet(document: Document, entry: Entry, id: string, destination: string) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "sheets", type);
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}-sheet.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateAction(action: Action): CompositeGeneratorNode | undefined {
        return expandToNode`

            /* -------------------------------------------- */

            async _on${action.name}Action(event, system) {
                event.preventDefault();
                const update = {};
                const parentUpdate = {};
                ${translateExpression(entry, id, action.method)}
                if (Object.keys(update).length > 0) {
                    this.object.update(update);
                }
                if (Object.keys(parentUpdate).length > 0) {
                    this.object.parent.update(parentUpdate);
                }
            }
        `;
    }

    let actions = document.body.filter(x => isAction(x)).map(x => x as Action);
    for (let section of document.body.filter(x => isSection(x))) {
        actions = actions.concat((section as Section).body.filter(x => isAction(x)).map(x => x as Action));
    }

    let html = document.body.filter(x => isHtmlExp(x)).map(x => x as HtmlExp);
    for (let section of document.body.filter(x => isSection(x))) {
        html = html.concat((section as Section).body.filter(x => isHtmlExp(x)).map(x => x as HtmlExp));
    }

    let stringChoices = document.body.filter(x => isStringExp(x) && x.choices != undefined && x.choices.length > 0).map(x => x as StringExp);
    for (let section of document.body.filter(x => isSection(x))) {
        stringChoices = stringChoices.concat((section as Section).body.filter(x => isStringExp(x) && x.choices != undefined && x.choices.length > 0).map(x => x as StringExp));
    }

    function generateStringChoices(property: StringExp): CompositeGeneratorNode | undefined {
        // We need to map an array of form [ "A", "B", "C" ] to an object of form { A: "A", B: "B", C: "C" }
        return expandToNode`
            context.${property.name.toLowerCase()}Choices = {
                ${joinToNode(property.choices, x => expandToNode`${toMachineIdentifier(x)}: "${document.name}.${property.name}.${x}",`.appendNewLineIfNotEmpty())}
            };
        `;
    }

    let pips = document.body.filter(x => isPipsExp(x)).map(x => x as PipsExp);
    for (let section of document.body.filter(x => isSection(x))) {
        pips = pips.concat((section as Section).body.filter(x => isPipsExp(x)).map(x => x as PipsExp));
    }

    function translateLiteralOrExpression(expression: number | MethodBlock | undefined): CompositeGeneratorNode | undefined {
        if ( expression == undefined ) {
            return undefined;
        }
        if (Number.isInteger(expression)) {
            return expandToNode`
                return ${expression};
            `
        }
        return expandToNode`
            ${translateExpression(entry, id, expression as MethodBlock)}
        `
    }

    function generatePipsInfo(property: PipsExp): CompositeGeneratorNode | undefined{
        console.log("Processing Pips: " + property.name);

        // Pips are a current number and a max. We need to turn this into an array of objects, where each object has a checked property of true if the index is less than or equal to the current value
        return expandToNode`
            // ${property.name} Pip Data
            const ${property.name.toLowerCase()}CurrentValue = this.object.${getSystemPath(property)} ?? 0;
            const ${property.name.toLowerCase()}MaxFunc = (system) => {
                ${translateLiteralOrExpression(property.max) ?? 0}
            };
            const ${property.name.toLowerCase()}InitialFunc = (system) => {
                return ${translateLiteralOrExpression(property.initial) ?? 0};
            };
            context.${property.name.toLowerCase()} = Array.from({length: ${property.name.toLowerCase()}MaxFunc(this.object.system)}, (_, i) => {
                return {checked: i < ${property.name.toLowerCase()}CurrentValue};
            });
            context.${property.name.toLowerCase()}Max = ${property.name.toLowerCase()}MaxFunc(this.object.system);
            context.${property.name.toLowerCase()}Initial = ${property.name.toLowerCase()}InitialFunc(this.object.system);
        `;
    }

    let damageTracks = document.body.filter(x => isDamageTrackExp(x)).map(x => x as DamageTrackExp);
    for (let section of document.body.filter(x => isSection(x))) {
        damageTracks = damageTracks.concat((section as Section).body.filter(x => isDamageTrackExp(x)).map(x => x as DamageTrackExp));
    }

    function generateDamageTrackInfo(property: DamageTrackExp): CompositeGeneratorNode | undefined{
        console.log("Processing DamageTrack: " + property.name);

        // DamageTracks are a list of types, each with their own current value. Last listed type is the highest priority and should be displayed first
        return expandToNode`

            // ${property.name} DamageTrack Data
            const ${property.name.toLowerCase()}MaxFunc = (system) => {
                ${translateLiteralOrExpression(property.max) ?? 0}
            };
            const ${property.name.toLowerCase()}Types = ["empty",${joinToNode(property.types, x => `"${x}",`)}];
            context.${property.name.toLowerCase()} = [];

            // There are 5 tiers of damage. Each tier is a different color. If we have less than 5 types, we skip some of the center tiers - 3 types = tier 1, 3, 5 for instance.
            let ${property.name.toLowerCase()}AssignedTiers = [];
            switch (${property.name.toLowerCase()}Types.length) {
                case 1:
                    ${property.name.toLowerCase()}AssignedTiers = ["tier-5"];
                    break;
                case 2:
                    ${property.name.toLowerCase()}AssignedTiers = ["tier-1", "tier-5"];
                    break;
                case 3:
                    ${property.name.toLowerCase()}AssignedTiers = ["tier-1", "tier-3", "tier-5"];
                    break;
                case 4:
                    ${property.name.toLowerCase()}AssignedTiers = ["tier-1", "tier-2", "tier-4", "tier-5"];
                    break;
                case 5:
                    ${property.name.toLowerCase()}AssignedTiers = ["tier-1", "tier-2", "tier-3", "tier-4", "tier-5"];
                    break;
                default:
                    console.error("Unsupported number of damage types");
                    break;
            }

            for (let j = ${property.name.toLowerCase()}Types.length - 1; j >= 0; j--) {
                for (let i = 0; i < this.object.system.${property.name.toLowerCase()}[${property.name.toLowerCase()}Types[j]]; i++) {
                    let type = ${property.name.toLowerCase()}Types[j];
                    let tier = type === "empty" ? "empty" : ${property.name.toLowerCase()}AssignedTiers[j];
                    context.${property.name.toLowerCase()}.push({type: type, tier: tier});
                }
            }
        `;
    }

    function generateActionInfo(property: Action): CompositeGeneratorNode | undefined {
        return expandToNode`
            // ${property.name} Action Info
            const ${property.name.toLowerCase()}DisabledFunc = (system) => {
                return ${translateExpression(entry, id, (property.conditions.filter(x => isDisabledCondition(x))[0] as HiddenCondition)?.when) ?? false}
            };
            const ${property.name.toLowerCase()}HiddenFunc = (system) => {
                return ${translateExpression(entry, id, (property.conditions.filter(x => isHiddenCondition(x))[0] as HiddenCondition)?.when) ?? false}
            };
            context.${property.name.toLowerCase()}Action = {
                label: "${document.name}.${property.name}",
                disabled: ${property.name.toLowerCase()}DisabledFunc(this.object.system),
                hidden: ${property.name.toLowerCase()}HiddenFunc(this.object.system)
            };
        `.appendNewLine().appendNewLine();
    }

    function generateItemActionLists(document: Document | undefined): CompositeGeneratorNode | undefined {

        if (document == undefined) {
            return undefined;
        }

        function generateItemActionList(document: Document | undefined): CompositeGeneratorNode | undefined {
            
            if (document == undefined) {
                return undefined;
            }

            const actions = document.body.filter(x => isAction(x)).map(x => x as Action);
            for (let section of document.body.filter(x => isSection(x))) {
                actions.concat((section as Section).body.filter(x => isAction(x)).map(x => x as Action));
            }

            function generateActionEntry(property: Action): CompositeGeneratorNode | undefined {
                const icon = (property.conditions.find(x => isIconParam(x)) as IconParam)?.value ?? "fa-solid fa-bolt";
                const color = (property.conditions.find(x => isColorParam(x)) as ColorParam)?.value ?? "#000000";
                return expandToNode`
                    {
                        label: "${property.name}",
                        icon: "${icon}",
                        action: "${property.name.toLowerCase()}",
                        color: "${color}"
                    }
                `;
            }

            return expandToNode`
            context.${document.name}ItemActions = [
                ${joinToNode(actions, property => generateActionEntry(property), { appendNewLineIfNotEmpty: true, separator: ","})}
            ];
        `;
        }
        
        return joinToNode(document.body.filter(x => isDocumentArrayExp(x)).map(x => x as DocumentArrayExp), property => generateItemActionList(property.document.ref), { appendNewLineIfNotEmpty: true });
    }

    function generateSingleDocumentContentLinks(document: Document): CompositeGeneratorNode | undefined {

        let expressions = document.body.filter(x => isSingleDocumentExp(x)).map(x => x as SingleDocumentExp);
        for (let section of document.body.filter(x => isSection(x))) {
            expressions = expressions.concat((section as Section).body.filter(x => isSingleDocumentExp(x)).map(x => x as SingleDocumentExp));
        }

        function generateContentLink(property: SingleDocumentExp): CompositeGeneratorNode | undefined {
            return expandToNode`
                context.${property.name.toLowerCase()}HasContentLink = this.object.system.${property.name.toLowerCase()}?.uuid != undefined;
                context.${property.name.toLowerCase()}ContentLink = await TextEditor.enrichHTML(\`@UUID[\${this.object.system.${property.name.toLowerCase()}?.uuid\}]\`);
            `;
        }

        return joinToNode(expressions, property => generateContentLink(property), { appendNewLineIfNotEmpty: true});
    }

    const fileNode = expandToNode`
        import ${entry.config.name}DocumentSheet from "../${id}-sheet.mjs";
        import ${entry.config.name}ActorSheet from "../${id}-actor-sheet.mjs";
        import ${entry.config.name}Roll from "../../rolls/roll.mjs";
        
        export default class ${document.name}Sheet extends ${entry.config.name}${document.$type == "Actor" ? "Actor" : "Document"}Sheet {
        
            /** @override */
            static get defaultOptions() {
                return foundry.utils.mergeObject(super.defaultOptions, {
                    classes: ["${id}", "sheet", "${type}", "${document.name.toLowerCase()}-sheet"]
                });
            }

            /* -------------------------------------------- */

            /** @override */
            get template() {
                const editMode = this.object.getFlag('${id}', 'edit-mode') ?? true;
                return editMode ? \`systems/${id}/system/templates/${type}/\${this.object.type}-config.hbs\` : \`systems/${id}/system/templates/${type}/\${this.object.type}.hbs\`;
            }

            /* -------------------------------------------- */

            _getHeaderButtons() {
                return [
                    {
                        class: '${id}-toggle-edit-mode',
                        label: game.i18n.localize('Edit'),
                        icon: 'fas fa-edit',
                        onclick: async (e) => {
                            await this._toggleEditMode(e)
                        }
                    },
                    ...super._getHeaderButtons()
                ]
            }

            async _toggleEditMode(event) {
                event.preventDefault()

                const currentValue = this.object.getFlag('${id}', 'edit-mode')
                await this.object.setFlag('${id}', 'edit-mode', !currentValue)
            }

            /* -------------------------------------------- */

            /** @override */
            async getData() {
                const context = await super.getData();
                ${joinToNode(html, property => `context.${property.name.toLowerCase()}HTML = await TextEditor.enrichHTML(
                        this.object.system.${property.name.toLowerCase()},
                        {async: true, secrets: this.object.isOwner}
                    ); `)}
                ${joinToNode(stringChoices, property => generateStringChoices(property), { appendNewLineIfNotEmpty: true})}
                ${joinToNode(pips, property => generatePipsInfo(property), { appendNewLineIfNotEmpty: true})}
                ${joinToNode(damageTracks, property => generateDamageTrackInfo(property), { appendNewLineIfNotEmpty: true})}
                ${joinToNode(actions, property => generateActionInfo(property), { appendNewLineIfNotEmpty: true})}
                ${expandToNode`${generateItemActionLists(document)}`.appendNewLineIfNotEmpty()}
                ${expandToNode`${generateSingleDocumentContentLinks(document)}`.appendNewLineIfNotEmpty()}
                return context;
            }

            /* -------------------------------------------- */

            /** @override */
            activateListeners(html) {
                super.activateListeners(html);

                // Actions
                html.find(".action").click(this._onAction.bind(this));
            }

            /* -------------------------------------------- */

            async _onAction(event) {
                event.preventDefault();
                const action = event.currentTarget.dataset.action;
                switch ( action ) {
                    ${joinToNode(actions, property => `case "${property.name.toLowerCase()}": this._on${property.name}Action(event, this.object.system); break;`, { appendNewLineIfNotEmpty: true })}
                }
            }

            ${joinToNode(actions, property => generateAction(property), { appendNewLineIfNotEmpty: true })}

            /* -------------------------------------------- */

            /** @override */
            async handleTableRowAction(item, action) {
                switch ( action ) {
                    ${joinToNode(actions, property => `case "${property.name.toLowerCase()}": this._on${property.name}Action(event, item.system); break;`, { appendNewLineIfNotEmpty: true })}
                }
            }

            /* -------------------------------------------- */

            /** @override */
            async handleItemDrop(item) {
                switch ( item.type ) {
                    ${joinToNode(document.body.filter(x => isDocumentArrayExp(x)).map(x => x as DocumentArrayExp), property => 
                        `case "${property.document.ref?.name.toLowerCase()}": {
                            Item.createDocuments([item], {parent: this.object})
                            break;
                        }`, { appendNewLineIfNotEmpty: true })}
                }
            }
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

export function generateDocumentHandlebars(document: Document, destination: string, edit: boolean) {
    const type = isActor(document) ? 'actor' : 'item';
    const generatedFileDir = path.join(destination, "system", "templates", type);
    const generatedFilePath = path.join(generatedFileDir, `${document.name.toLowerCase()}${edit ? "-config": ""}.hbs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const baseColors = [
        "#8B0000", // DarkRed
        "#006400", // DarkGreen
        "#00008B", // DarkBlue
        "#2F4F4F", // DarkSlateGray
        "#8B8B00", // DarkYellow
        "#8B008B", // DarkMagenta
        "#008B8B", // DarkCyan
        "#800000", // Maroon
        "#556B2F", // DarkOliveGreen
        "#4B0082"  // Indigo
    ];

    function shadeColor(color: string, percent: number): string {
        let num = parseInt(color.slice(1), 16),
            amt = Math.round(2.55 * percent),
            R = (num >> 16) + amt,
            G = (num >> 8 & 0x00FF) + amt,
            B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1).toUpperCase();
    }

    function generateColors(n: number): string[] {
        const colors = [];
        for (let i = 0; i < n; i++) {
            if (i < baseColors.length) {
                colors.push(baseColors[i]);
            } else {
                const baseColorIndex = (i - baseColors.length) % baseColors.length;
                const shadePercentage = 10 * Math.floor((i - baseColors.length) / baseColors.length + 1);
                colors.push(shadeColor(baseColors[baseColorIndex], shadePercentage));
            }
        }
        return colors;
    }

    // Generate a unique color per Resource
    let baseLevelResources = document.body.filter(isResourceExp).length;
    let sectionLevelResources = 0;
    document.body.filter(isSection).forEach(section => {
        sectionLevelResources += section.body.filter(isResourceExp).length;
    });
    const colors = generateColors(baseLevelResources + sectionLevelResources);
    console.log(colors);
    let currentColorIndex = 0;

    function generateField(property: ClassExpression | Section): CompositeGeneratorNode | undefined {

        if ( isNumberExp(property) ) {
            if (property.modifier == "hidden") return expandToNode``;

            let disabled = property.modifier == "readonly" || !edit;
            if (property.params.find(x => isNumberParamValue(x)) != undefined) { 
                disabled = true;
            }

            const iconParam = property.params.find(x => isIconParam(x)) as IconParam;
            const colorParam = property.params.find(x => isColorParam(x)) as ColorParam;
            const color = colorParam?.value ?? "#000000";
            
            return expandToNode`
                {{!-- Number ${property.name} --}}
                <div class="form-group property numberExp" data-name="system.${property.name.toLowerCase()}">
                    <label>${iconParam != undefined ? `<i class="${iconParam.value}" style="color: ${color};"></i> ` : ""}{{ localize "${document.name}.${property.name}" }}</label>
                    {{numberInput document.system.${property.name.toLowerCase()} name="system.${property.name.toLowerCase()}" disabled=${disabled} step=1}}
                </div>
            `.appendNewLine().appendNewLine();
        }

        if ( isStringExp(property) ) {
            if (property.modifier == "hidden") return expandToNode``;

            if (property.choices != undefined && property.choices.length > 0) {
                return expandToNode`
                    {{!-- String ${property.name} --}}
                    <div class="form-group property stringExp" data-name="system.${property.name.toLowerCase()}">
                        <label>{{ localize "${document.name}.${property.name}.label" }}</label>
                        <select name="system.${property.name.toLowerCase()}" ${property.modifier == "readonly" || !edit? "disabled='disabled'" : ""}>
                            {{selectOptions ${property.name.toLowerCase()}Choices selected=document.system.${property.name.toLowerCase()} localize=true}}
                        </select>
                    </div>
                `.appendNewLine().appendNewLine();
            }

            return expandToNode`
                {{!-- String ${property.name} --}}
                <div class="form-group property stringExp" data-name="system.${property.name.toLowerCase()}">
                    <label>{{ localize "${document.name}.${property.name}" }}</label>
                    <input name="system.${property.name.toLowerCase()}" type="text" value="{{document.system.${property.name.toLowerCase()}}}" placeholder="${property.name}" ${property.modifier == "readonly" || !edit ? "disabled='disabled'" : ""} />
                </div>
            `.appendNewLine().appendNewLine();
        }

        if ( isHtmlExp(property) ) {
            if (property.modifier == "hidden") return expandToNode``;
            return expandToNode`
                {{!-- HTML ${property.name} --}}
                <div class="form-group stacked double-wide property htmlExp" data-name="system.${property.name.toLowerCase()}">
                    <label>{{ localize "${document.name}.${property.name}" }}</label>
                    {{editor descriptionHTML target="system.${property.name.toLowerCase()}" button=false editable=editable engine="prosemirror" collaborate=false disabled=${property.modifier == "readonly" || !edit}}}
                </div>
            `.appendNewLine().appendNewLine();
        }

        if ( isBooleanExp(property) ) {
            if (property.modifier == "hidden") return expandToNode``;
            return expandToNode`
                {{!-- Boolean ${property.name} --}}
                <div class="form-group property booleanExp" data-name="system.${property.name.toLowerCase()}">
                    <label>{{ localize "${document.name}.${property.name}" }}</label>
                    <input type="checkbox" name="system.${property.name.toLowerCase()}" {{checked document.system.${property.name.toLowerCase()}}} ${property.modifier == "readonly" || !edit ? "disabled='disabled'" : ""} />
                </div>
            `.appendNewLine().appendNewLine();
        }

        if ( isResourceExp(property) ) {
            if (property.modifier == "hidden") return expandToNode``;
            const color = colors[currentColorIndex++];
            const darkColor = shadeColor(color, 25);
            const lightColor = shadeColor(color, 50);
            return expandToNode`
                {{!-- Resource ${property.name} --}}
                <fieldset style="border-color: ${color};" class="property resourceExp">
                    <legend>{{ localize "${document.name}.${property.name}" }}</legend>

                    {{!-- Current --}}
                    <div class="form-group" data-name="system.${property.name.toLowerCase()}">
                        <label>{{ localize "Current" }}</label>
                        {{numberInput document.system.${property.name.toLowerCase()}.value name="system.${property.name.toLowerCase()}.value" min=0 max=document.system.${property.name.toLowerCase()}.max step=1 disabled=${property.modifier == "readonly"}}}
                    </div>

                    {{!-- Max --}}
                    <div class="form-group" data-name="system.${property.name.toLowerCase()}">
                        <label>{{ localize "Max" }}</label>
                        {{numberInput document.system.${property.name.toLowerCase()}.max name="system.${property.name.toLowerCase()}.max" min=0 step=1 disabled=${property.modifier == "readonly" || property.max != undefined || !edit}}}
                    </div>

                    {{!-- Progress Bar --}}
                    <div class="form-group">
                        <div class="progress-bar" name="${property.name.toLowerCase()}" data-color-from="${lightColor}" data-color-to="${darkColor}" data-value="{{document.system.${property.name.toLowerCase()}.value}}" data-max="{{document.system.${property.name.toLowerCase()}.max}}"></div>
                    </div>
                </fieldset>
            `.appendNewLine().appendNewLine();
        }

        // <progress class="progress" value="{{document.system.${property.name.toLowerCase()}.current}}" max="{{document.system.${property.name.toLowerCase()}.max}}"></progress>

        if ( isAttributeExp(property) ) {
            if (property.modifier == "hidden") return expandToNode``;
            const min = property.min ?? 0;
            const max = property.max ?? 0;
            return expandToNode`
                {{!-- Attribute ${property.name} --}}
                <div class="form-group attributeExp" data-name="system.${property.name.toLowerCase()}">
                    <label>{{ localize "${document.name}.${property.name}" }}</label>
                    <div class="mod">{{document.system.${property.name.toLowerCase()}.mod}}</div>
                    {{numberInput document.system.${property.name.toLowerCase()}.value name="system.${property.name.toLowerCase()}" step=1 min=${min} max=${max} disabled=${!edit}}}
                </div>
            `.appendNewLine().appendNewLine();
        }

        if ( isAction(property) ) {
            const icon = (property.conditions.find(x => isIconParam(x)) as IconParam)?.value ?? "fa-solid fa-bolt";
            const color = (property.conditions.find(x => isColorParam(x)) as ColorParam)?.value ?? "#000000";
            return expandToNode`
                {{!-- Action ${property.name} --}}
                {{#unless ${property.name.toLowerCase()}Action.hidden}}
                <button type="button" class="action" data-action="${property.name.toLowerCase()}" {{#if ${property.name.toLowerCase()}Action.disabled}}disabled="disabled" data-tooltip="{{localize 'Disabled'}}"{{/if}}><i class="${icon}" style="color: ${color};" ></i> {{ localize "${document.name}.${property.name}" }}</button>
                {{/unless}}
            `.appendNewLine().appendNewLine();
        }

        if ( isPipsExp(property) ) {
            if (property.modifier == "hidden") return expandToNode``;
            const style = property.style ?? "squares";

            return expandToNode`
                {{!-- Pips ${property.name} --}}
                <div class="form-group property pips" data-name="system.${property.name.toLowerCase()}" data-tooltip="{{document.system.${property.name.toLowerCase()}}}">
                    <label>{{ localize "${document.name}.${property.name}" }}</label>
                    <div class="pips-container ${style}" data-style="${style}" data-max="{{${property.name.toLowerCase()}Max}}" data-current="{{document.system.${property.name.toLowerCase()}}}" data-name="${property.name.toLowerCase()}" ${property.modifier == "readonly" ? "disabled='disabled'" : ""}>
                        {{#each ${property.name.toLowerCase()}}}
                            <div class="pip{{#if this.checked}} filled{{/if}}"></div>
                        {{/each}}
                    </div>
                </div>
            `.appendNewLine().appendNewLine();
        }

        if ( isDamageTrackExp(property) ) {
            if (property.modifier == "hidden") return expandToNode``;
            const max = property.max ?? 10;

            return expandToNode`
                {{!-- Pips ${property.name} --}}
                <div class="form-group property damage-track" data-name="system.${property.name.toLowerCase()}">
                    <label>{{ localize "${document.name}.${property.name}" }}</label>
                    <div class="damage-track-container" data-max="${max}" data-current="{{document.system.${property.name.toLowerCase()}}}" data-name="${property.name.toLowerCase()}" ${property.modifier == "readonly" ? "disabled='disabled'" : ""}>
                        {{#each ${property.name.toLowerCase()}}}
                            <div class="damage {{type}} {{tier}}" data-tooltip="{{type}}"></div>
                        {{/each}}
                    </div>
                </div>
            `.appendNewLine().appendNewLine();
        }

        if (isSingleDocumentExp(property)) {
            return expandToNode`
                {{!-- Single Document ${property.name} --}}
                <div class="form-group property single-document" data-name="system.${property.name.toLowerCase()}" data-type="${property.document.ref?.name.toLowerCase()}">
                    <label>{{ localize "${document.name}.${property.name}" }}</label>
                    {{#if ${property.name.toLowerCase()}HasContentLink}}
                    {{{${property.name.toLowerCase()}ContentLink}}}
                    <a class="single-document-remove" data-name="system.${property.name.toLowerCase()}" data-action="remove" style="flex: 0;margin-left: 0.25rem;"><i class="fa-solid fa-delete-left"></i></a>
                    {{else}}
                    <p class="single-document-none">{{ localize "NoSingleDocument" }}</p>
                    {{/if}}
                </div>
            `.appendNewLine().appendNewLine();
        }

        if ( isSection(property) ) {
            return expandToNode`
                <fieldset class="section">
                    <legend>{{ localize "${document.name}.${property.name}" }}</legend>

                    ${joinToNode(property.body, property => generateField(property), { appendNewLineIfNotEmpty: true })}
                </fieldset>
            `.appendNewLine().appendNewLine();
        }
        return
    }

    function generateDocumentArray(property: DocumentArrayExp): CompositeGeneratorNode | undefined {

        function generateReferenceHeader(refDoc: Reference<Document> | undefined, property: ClassExpression | Section): CompositeGeneratorNode | undefined {
            if ( isSection(property) ) {
                return expandToNode`
                    ${joinToNode(property.body, p => generateReferenceHeader(refDoc, p), { appendNewLineIfNotEmpty: true })}
                `;
            }
            if ( isHtmlExp(property) ) return undefined;

            if ( isProperty(property) ) {
                if ( isStringExp(property) && property.choices != undefined && property.choices.length > 0 ) {
                    return expandToNode`
                        <th>{{ localize "${refDoc?.ref?.name}.${property.name}.label" }}</th>
                    `;
                }
                return expandToNode`
                    <th>{{ localize "${refDoc?.ref?.name}.${property.name}" }}</th>
                `;
            }
            return undefined;
        }

        function generateReferenceRow(refDoc: Reference<Document> | undefined, property: ClassExpression | Section): CompositeGeneratorNode | undefined {

            if ( isSection(property) ) {
                return expandToNode`
                    ${joinToNode(property.body, p => generateReferenceRow(refDoc, p), { appendNewLineIfNotEmpty: true })}
                `;
            }
            if ( isHtmlExp(property) ) return undefined;
            if ( isProperty(property) ) {
                return expandToNode`
                    <td>{{item.${getSystemPath(property)}}}</td>
                `
            }
            return undefined;
        }

        // We create each document array as a tab with a table of the documents, along with an add button
        return expandToNode`
            {{!-- ${property.name} Document Array --}}
            <div class="tab" data-group="primary" data-tab="${property.name.toLowerCase()}" data-type="${property.document.ref?.name.toLowerCase()}" >
                {{!-- ${property.name} Table --}}
                <table class="display" style="width: 100%">
                    <thead>
                        <tr>
                            <th data-class-name="priority" data-orderable="false">{{ localize "Image" }}</th>
                            <th data-class-name="priority">{{ localize "Name" }}</th>
                            ${joinToNode(property.document.ref!.body, p => generateReferenceHeader(property.document, p), { appendNewLineIfNotEmpty: true })}
                            <th data-class-name="priority" data-orderable="false">{{ localize "Actions" }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{#each document.system.${property.name.toLowerCase()} as |item|}}
                            <tr data-id="{{item._id}}" data-uuid="{{item.uuid}}" data-type="{{item.type}}">
                                <td><img src="{{item.img}}" title="{{item.name}}" width=40 height=40 /></td>
                                <td data-tooltip='{{item.system.description}}'>{{item.name}}</td>
                                ${joinToNode(property.document.ref!.body, p => generateReferenceRow(property.document, p), { appendNewLineIfNotEmpty: true })}
                                <td>
                                    <div class="flexrow">
                                        {{#each ../${property.document.ref!.name}ItemActions}}
                                            <a class="row-action item-custom-action" data-action="{{this.action}}" data-type="${property.document.ref!.name}" data-item="{{item._id}}" data-tooltip="{{localize this.label}}"><i class="{{this.icon}}"></i></a>
                                        {{/each}}
                                        <a class="row-action" data-action="edit" data-item="{{item._id}}" data-tooltip="{{localize 'Edit'}}"><i class="fas fa-edit"></i></a>
                                        <a class="row-action" data-action="sendToChat" data-item="{{item._id}}" data-tooltip="{{localize 'SendToChat'}}"><i class="fas fa-message"></i></a>
                                        <a class="row-action" data-action="delete" data-item="{{item._id}}" data-tooltip="{{ localize 'Delete' }}"><i class="fas fa-delete-left"></i></a>
                                    </div>
                                </td>
                            </tr>
                        {{/each}}
                    </tbody>
                </table>
            </div>
        `.appendNewLine().appendNewLine();
    }

    function translateArrayTabHeader(property: DocumentArrayExp): CompositeGeneratorNode | undefined {
        const iconParam = property.params.find(x => isIconParam(x)) as IconParam;
        const icon = iconParam?.value ?? "fa-solid fa-table";
        return expandToNode`
            <a class="item" data-tab="${property.name.toLowerCase()}"><i class="${icon}"></i> {{ localize "${document.name}.${property.name}" }}</a>
        `
    }

    const fileNode = expandToNode`
        <form class="{{cssClass}} flexcol" autocomplete="off">

            {{!-- Sheet Header --}}
            <header class="sheet-header flexrow">
                <img class="profile" src="{{document.img}}" title="{{document.name}}" data-edit="img"/>
                <h1 class="title">
                    <input name="name" type="text" value="{{document.name}}" placeholder="${document.name} Name"/>
                </h1>
            </header>

            {{!-- Body --}}
            <section class="sheet-body">

                {{!-- Main Configuration --}}
                <div class="grid-container">
                    ${joinToNode(document.body, property => generateField(property), { appendNewLineIfNotEmpty: true })}
                </div>

                {{!-- Sheet Navigation --}}
                <nav class="sheet-navigation tabs" data-group="primary">
                    <a class="item" data-tab="description"><i class="fa-solid fa-book"></i> {{ localize "Description" }}</a>
                    ${joinToNode(document.body.filter(x => isDocumentArrayExp(x)).map(x => x as DocumentArrayExp), property => translateArrayTabHeader(property), { appendNewLineIfNotEmpty: true })}
                    <a class="item" data-tab="effects"><i class="fa-solid fa-sparkles"></i> {{ localize "Effects" }}</a>
                </nav>

                <section class="tabs-container">
                    {{!-- Description Tab --}}
                    <div class="tab description flexrow" data-group="primary" data-tab="description">
                        <fieldset>
                            {{!-- Description --}}
                            <div class="form-group stacked" data-name="system.description">
                                <label>{{ localize "Description" }}</label>
                                {{editor descriptionHTML target="system.description" button=false editable=editable engine="prosemirror" collaborate=false}}
                            </div>
                        </fieldset>
                    </div>

                    ${joinToNode(document.body.filter(x => isDocumentArrayExp(x)).map(x => x as DocumentArrayExp), property => generateDocumentArray(property), { appendNewLineIfNotEmpty: true })}
                
                    {{!-- Effects Tab --}}
                    <div class="tab effects" data-group="primary" data-tab="effects" data-type="ActiveEffect">
                        {{!-- Effects Table --}}
                        <table class="display" style="width: 100%">
                            <thead>
                                <tr>
                                    <th data-class-name="priority" data-orderable="false">{{ localize "Image" }}</th>
                                    <th data-class-name="priority">{{ localize "Name" }}</th>
                                    <th data-class-name="priority" data-orderable="false">{{ localize "Actions" }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {{#each document.effects as |effect|}}
                                    <tr data-id="{{effect._id}}" data-uuid="{{effect.uuid}}" data-type="ActiveEffect">
                                        <td><img src="{{effect.img}}" title="{{effect.name}}" width=40 height=40 /></td>
                                        <td data-tooltip='{{effect.description}}'>{{effect.name}}</td>
                                        <td>
                                            <div class="flexrow">
                                                {{#if effect.disabled}}
                                                <a class="row-action" data-action="toggle" data-item="{{effect._id}}" data-tooltip="{{localize 'Enable'}}"><i class="fas fa-toggle-off"></i></a>
                                                {{else}}
                                                <a class="row-action" data-action="toggle" data-item="{{effect._id}}" data-tooltip="{{localize 'Disable'}}"><i class="fas fa-toggle-on"></i></a>
                                                {{/if}}
                                                <a class="row-action" data-action="edit" data-item="{{effect._id}}" data-tooltip="{{localize 'Edit'}}"><i class="fas fa-edit"></i></a>
                                                <a class="row-action" data-action="sendToChat" data-item="{{effect._id}}" data-tooltip="{{localize 'SendToChat'}}"><i class="fas fa-message"></i></a>
                                                <a class="row-action" data-action="delete" data-item="{{effect._id}}" data-tooltip="{{ localize 'Delete' }}"><i class="fas fa-delete-left"></i></a>
                                            </div>
                                        </td>
                                    </tr>
                                {{/each}}
                            </tbody>
                        </table>
                    </div>
                </section>
            </section>
        </form>
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
