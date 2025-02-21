import {
    Document,
    Entry,
    HtmlExp,
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
    DisabledCondition,
    Page,
    isPage,
    isBackgroundParam,
    BackgroundParam,
    isStringParamChoices,
    StringParamChoices,
    ParentPropertyRefExp,
    isParentPropertyRefExp,
    AttributeExp,
    isAttributeExp,
    NumberExp,
    isNumberExp,
    isResourceExp,
    ResourceExp,
    Property,
    isNumberParamMax,
    isNumberParamInitial,
    NumberParamMax,
    NumberParamInitial,
} from '../../language/generated/ast.js';
import {
    isActor,
    isHtmlExp,
    isStringExp,
    isAction,
    isPipsExp,
    isDamageTrackExp,
    isDocumentArrayExp,
    isDisabledCondition,
    isHiddenCondition,
    isIconParam,
    isSingleDocumentExp,
    isColorParam,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { translateExpression } from './method-generator.js';
import { getAllOfType, getDocument, getSystemPath, globalGetAllOfType, toMachineIdentifier } from './utils.js';

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
                let update = {};
                let parentUpdate = {};
                let selfDeleted = false;
                let rerender = false;
                ${translateExpression(entry, id, action.method)}
                if (!selfDeleted && Object.keys(update).length > 0) {
                    await this.object.update(update);
                    rerender = true;
                }
                if (Object.keys(parentUpdate).length > 0) {
                    await this.object.parent.update(parentUpdate);
                    rerender = true;
                }
                if (rerender) {
                    this.render();
                }
            }
        `;
    }

    let actions = getAllOfType<Action>(document.body, isAction);

    let html = getAllOfType<HtmlExp>(document.body, isHtmlExp);

    let stringChoices = getAllOfType<StringExp>(document.body, (property) => isStringExp(property) && property.params.find(p => isStringParamChoices(p)) != undefined && (property.params.find(p => isStringParamChoices(p)) as StringParamChoices)!.choices.length > 0);

    function generateStringChoices(property: StringExp): CompositeGeneratorNode | undefined {
        // We need to map an array of form [ "A", "B", "C" ] to an object of form { A: "A", B: "B", C: "C" }
        let choices = property.params.find(x => isStringParamChoices(x)) as StringParamChoices;
        if (choices == undefined) {
            return undefined;
        }
        return expandToNode`
            context.${property.name.toLowerCase()}Choices = {
                ${joinToNode(choices.choices, x => expandToNode`${toMachineIdentifier(x)}: "${document.name}.${property.name}.${x}",`.appendNewLineIfNotEmpty())}
            };
        `;
    }

    let pips = getAllOfType<PipsExp>(document.body, isPipsExp);

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

        const maxParam = property.params.find(x => isNumberParamMax(x)) as NumberParamMax;
        const initialParam = property.params.find(x => isNumberParamInitial(x)) as NumberParamInitial;

        // Pips are a current number and a max. We need to turn this into an array of objects, where each object has a checked property of true if the index is less than or equal to the current value
        return expandToNode`
            // ${property.name} Pip Data
            const ${property.name.toLowerCase()}CurrentValue = this.object.${getSystemPath(property)} ?? 0;
            const ${property.name.toLowerCase()}MaxFunc = (system) => {
                ${translateLiteralOrExpression(maxParam?.value) ?? 0}
            };
            const ${property.name.toLowerCase()}InitialFunc = (system) => {
                return ${translateLiteralOrExpression(initialParam?.value) ?? 0};
            };
            context.${property.name.toLowerCase()} = Array.from({length: ${property.name.toLowerCase()}MaxFunc(this.object.system)}, (_, i) => {
                return {checked: i < ${property.name.toLowerCase()}CurrentValue};
            });
            context.${property.name.toLowerCase()}Max = ${property.name.toLowerCase()}MaxFunc(this.object.system);
            context.${property.name.toLowerCase()}Initial = ${property.name.toLowerCase()}InitialFunc(this.object.system);
        `;
    }

    let damageTracks = getAllOfType<DamageTrackExp>(document.body, isDamageTrackExp);

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
                return ${translateExpression(entry, id, (property.conditions.filter(x => isDisabledCondition(x))[0] as DisabledCondition)?.when) ?? false}
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

            const actions = getAllOfType<Action>(document.body, isAction);
            
            // document.body.filter(x => isAction(x)).map(x => x as Action);
            // for (let section of document.body.filter(x => isSection(x))) {
            //     actions.concat((section as Section).body.filter(x => isAction(x)).map(x => x as Action));
            // }

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
        
        return joinToNode(getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp), property => generateItemActionList(property.document.ref), { appendNewLineIfNotEmpty: true });
    }

    function generateSingleDocumentContentLinks(document: Document): CompositeGeneratorNode | undefined {

        let expressions = getAllOfType<SingleDocumentExp>(document.body, isSingleDocumentExp);

        function generateContentLink(property: SingleDocumentExp): CompositeGeneratorNode | undefined {
            return expandToNode`
                context.${property.name.toLowerCase()}HasContentLink = this.object.system.${property.name.toLowerCase()}?.uuid != undefined;
                context.${property.name.toLowerCase()}ContentLink = await TextEditor.enrichHTML(\`@UUID[\${this.object.system.${property.name.toLowerCase()}?.uuid\}]\`);
            `;
        }

        return joinToNode(expressions, property => generateContentLink(property), { appendNewLineIfNotEmpty: true});
    }

    const backgroundParam = document.params?.find(x => isBackgroundParam(x)) as BackgroundParam;
    const background = backgroundParam?.background ?? "topography";

    const pages = getAllOfType<Page>(document.body, isPage);

    const parentPropertyReferences = getAllOfType<ParentPropertyRefExp>(document.body, isParentPropertyRefExp);

    function generateParentPropertyReference(property: ParentPropertyRefExp): CompositeGeneratorNode | undefined {

        let allChoices: Property[] = [];
        switch (property.propertyType) {
            case "attribute": allChoices = globalGetAllOfType<AttributeExp>(entry, isAttributeExp); break;
            case "resource": allChoices = globalGetAllOfType<ResourceExp>(entry, isResourceExp); break;
            case "number": allChoices = globalGetAllOfType<NumberExp>(entry, isNumberExp); break;
            default: console.error("Unsupported parent property type: " + property.propertyType); break;
        }

        if (allChoices.length == 0) {
            return expandToNode`
                context.${property.name.toLowerCase()}ParentChoices = {};
            `;
        }

        let refChoices = allChoices.map(x => {
            let parentDocument = getDocument(x);

            if (property.choices.length > 0) {
                if (!property.choices.find(y => {
                    const documentNameMatches = y.document.ref?.name.toLowerCase() == parentDocument?.name.toLowerCase();

                    if (y.property != undefined) {
                        const propertyNameMatches = y.property.ref?.name.toLowerCase() == x.name.toLowerCase();
                        return documentNameMatches && propertyNameMatches;
                    }
                    // Just check document name
                    return documentNameMatches;
                })) {
                    return undefined;
                }
            }

            return {
                name: `system.${x.name.toLowerCase()}`,
                label: `${parentDocument?.name} - ${x.name}`
            };
        });
        refChoices = refChoices.filter(x => x != undefined);
        return expandToNode`
            context.${property.name.toLowerCase()}ParentChoices = {
                "" : "None",
                ${joinToNode(refChoices, x => expandToNode`"${x!.name}": "${x!.label}"`, { separator: ",", appendNewLineIfNotEmpty: true })}
            };
        `;
    }

    const fileNode = expandToNode`
        import ${entry.config.name}DocumentSheet from "../${id}-sheet.mjs";
        import ${entry.config.name}ActorSheet from "../${id}-actor-sheet.mjs";
        import ${entry.config.name}Roll from "../../rolls/roll.mjs";
        
        export default class ${document.name}Sheet extends ${entry.config.name}${document.$type == "Actor" ? "Actor" : "Document"}Sheet {
        
            /** @override */
            static get defaultOptions() {
                return foundry.utils.mergeObject(super.defaultOptions, {
                    classes: ["${id}", "sheet", "${type}", "${document.name.toLowerCase()}-sheet"],
                    tabs: [
                        {navSelector: ".pages", contentSelector: ".pages-container", initial: "main"},
                        {navSelector: ".tabs", contentSelector: ".tabs-container", initial: "description"},
                        ${joinToNode(pages, property => `{ navSelector: ".${property.name.toLowerCase()}-nav", contentSelector: ".${property.name.toLowerCase()}-container", initial: "${property.name.toLowerCase()}" },`, { appendNewLineIfNotEmpty: true })}
                    ],
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
                context.editMode = this.object.getFlag('${id}', 'edit-mode') ?? true;
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
                ${joinToNode(parentPropertyReferences, property => generateParentPropertyReference(property), { appendNewLineIfNotEmpty: true})}
                return context;
            }

            /* -------------------------------------------- */

            /** @override */
            activateListeners(html) {
                super.activateListeners(html);

                if (this.documentType === "Actor") {
                    // Find the outer window and attach edit mode class
                    const outer = html.closest(".window-app")[0];
                    const editMode = this.object.getFlag('${id}', 'edit-mode') ?? true;
                    if (editMode && !outer.classList.contains("edit-mode")) {
                        outer.classList.add("edit-mode");
                    } else if (!editMode && outer.classList.contains("edit-mode")) {
                        outer.classList.remove("edit-mode");
                    }
                }

                // Actions
                html.find(".action").click(this._onAction.bind(this));
            }

            /* -------------------------------------------- */

            /** @override */
            get defaultBackground() {
                return "${background}";
            }

            /* -------------------------------------------- */

            async _onAction(event) {
                event.preventDefault();
                const action = event.currentTarget.dataset.action;
                switch ( action ) {
                    case "toggle-calculator": this._onToggleCalculator(event); break;
                    case "calc-mode": this._onCalculatorModeSwap(event, action); break;
                    case "calc-submit": this._onCalculatorSubmit(event); break;
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

            _onToggleCalculator(event) {
                const calculator = event.currentTarget.closest(".form-group").querySelector(".calculator");
                if (calculator.style.display === "block") {
                    calculator.style.display = "none";
                } else {
                    // Find the window app
                    const windowApp = event.currentTarget.closest(".window-app");
                    const rect = windowApp.getBoundingClientRect();

                    // Get the bounding box of the button too
                    const button = event.currentTarget.getBoundingClientRect();

                    // Calculate relative position
                    const relativeX = button.left - rect.left;
                    const relativeY = button.top - rect.top + 26;
                    calculator.style.position = "absolute";
                    calculator.style.top = \`\${relativeY}px\`;
                    calculator.style.left = \`\${relativeX}px\`;
                    calculator.style.display = "block";
                }
            }

            /* -------------------------------------------- */

            _onCalculatorModeSwap(event, mode) {
                event.preventDefault();
                const calculator = event.currentTarget.closest(".form-group").querySelector(".calculator");
                const modeButtons = calculator.querySelectorAll(".mode-button");
                for (let button of modeButtons) {
                    button.classList.remove("active");
                }
                event.currentTarget.classList.add("active");
                calculator.dataset.mode = mode;
            }

            /* -------------------------------------------- */

            _onCalculatorSubmit(event) {
                const calculator = event.currentTarget.closest(".calculator");

                // Get the mode
                const modeButtons = calculator.querySelectorAll(".mode-button");
                let mode = "add";
                for (let button of modeButtons) {
                    if (button.classList.contains("active")) {
                        mode = button.dataset.mode;
                    }
                }

                // Get the number
                const input = calculator.querySelector("input");
                const number = parseInt(input.value);

                // Get the attribute name
                const formGroup = calculator.closest(".form-group");
                const attribute = formGroup.dataset.name;

                let property = event.currentTarget.closest(".property");
                let isResourceExp = property.classList.contains("resourceExp");

                const currentValue = isResourceExp ? foundry.utils.getProperty(this.object, attribute + ".value") : foundry.utils.getProperty(this.object, attribute);
                const updateAttribute = isResourceExp ? attribute + ".value" : attribute;
                const update = {};
                if (mode === "add") {
                    update[updateAttribute] = currentValue + number;
                }
                else if (mode === "subtract") {
                    if (isResourceExp) {
                        const temp = foundry.utils.getProperty(this.object, attribute + ".temp");
                        update[attribute + ".temp"] = temp - number;

                        if (temp - number < 0) {
                            update[attribute + ".value"] = currentValue + (temp - number);
                            update[attribute + ".temp"] = 0;
                        }
                    }
                    else {
                        update[updateAttribute] = currentValue - number;
                    }
                }
                else if (mode === "multiply") {
                    update[updateAttribute] = currentValue * number;
                }
                else if (mode === "divide") {
                    update[updateAttribute] = currentValue / number;
                }
                this.object.update(update);

                // Close the calculator
                calculator.style.display = "none";
            }

            /* -------------------------------------------- */

            /** @override */
            async handleItemDrop(item) {
                switch ( item.type ) {
                    ${joinToNode(getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp), property => 
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

