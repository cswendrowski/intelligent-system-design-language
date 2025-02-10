import {
    ClassExpression,
    Document,
    Entry,
    Section,
    MethodBlock,
    NumberParameter,
    NumberExp,
    Page,
    ResourceExp,
    isStringExp,
    isStringParamValue,
    StringParamValue,
    InitiativeProperty,
    isInitiativeProperty,
    isAttributeParamMod,
    AttributeParamMod,
} from '../../language/generated/ast.js';
import {
    isActor,
    isItem,
    isSection,
    isResourceExp,
    isAttributeExp,
    isMethodBlock,
    isDocumentArrayExp,
    isNumberExp,
    isNumberParamMax,
    isNumberParamValue,
    isNumberParamMin,
    isWhereParam,
    isPage,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { translateExpression } from './method-generator.js';
import { getAllOfType } from './utils.js';

export function generateExtendedDocumentClasses(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, "system", "documents");


    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function generateExtendedDocumentClass(type: string, entry: Entry) {
        const generatedFilePath = path.join(generatedFileDir, `${type.toLowerCase()}.mjs`);

        const toBeReapplied = new Set<string>();
        function generateDerivedAttribute(property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {

            if (isSection(property)) {
                return joinToNode(property.body, property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true });
            }

            if (isPage(property)) {
                return joinToNode(property.body, property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true });
            }

            if (isStringExp(property)) {
                let stringValue = property.params.find(p => isStringParamValue(p)) as StringParamValue;
                if (stringValue != undefined) {
                    if (stringValue.value == "") return;
                    if (typeof stringValue.value == "string") {
                        return expandToNode`
                            // ${property.name} String Derived Data
                            this.system.${property.name.toLowerCase()} = "${stringValue.value}";
                        `.appendNewLineIfNotEmpty();
                    }
                    else {
                        return expandToNode`
                        // ${property.name} String Derived Data
                        const ${property.name.toLowerCase()}CurrentValueFunc = (system) => {
                            ${translateExpression(entry, id, stringValue.value, true, property)}
                        };
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}CurrentValueFunc(this.system);
                        `.appendNewLineIfNotEmpty();
                    }
                }
            }

            if (isNumberExp(property)) {
                function translateMethodOrValueOrStored(property: NumberExp, param: NumberParameter | undefined): CompositeGeneratorNode {
                    if (param == undefined) {
                        return expandToNode`
                            return system.${property.name.toLowerCase()} ?? 0
                        `
                    }

                    if (isMethodBlock(param.value)) {

                        if (isNumberParamValue(param)) {
                            toBeReapplied.add("system." + property.name.toLowerCase());
                        }

                        return expandToNode`
                            ${translateExpression(entry, id, param.value, true, property)}
                        `
                    }

                    return expandToNode`
                        return ${param.value}
                    `
                }

                const valueParam = property.params.find(p => isNumberParamValue(p));
                const minParam = property.params.find(p => isNumberParamMin(p));
                const maxParam = property.params.find(p => isNumberParamMax(p));

                return expandToNode`
                    // ${property.name} Number Derived Data
                    const ${property.name.toLowerCase()}CurrentValueFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, valueParam)}
                    };
                    this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}CurrentValueFunc(this.system);

                    ${minParam != undefined ? expandToNode`
                    const ${property.name.toLowerCase()}MinFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, minParam)}
                    };
                    const ${property.name.toLowerCase()}Min = ${property.name.toLowerCase()}MinFunc(this.system);
                    if ( this.system.${property.name.toLowerCase()} < ${property.name.toLowerCase()}Min ) {
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}Min;
                    }
                    `.appendNewLine() : ""}

                    ${maxParam != undefined ? expandToNode`
                    const ${property.name.toLowerCase()}MaxFunc = (system) => {
                        ${translateMethodOrValueOrStored(property, maxParam)}
                    };
                    const ${property.name.toLowerCase()}Max = ${property.name.toLowerCase()}MaxFunc(this.system);
                    if ( this.system.${property.name.toLowerCase()} > ${property.name.toLowerCase()}Max ) {
                        this.system.${property.name.toLowerCase()} = ${property.name.toLowerCase()}Max;
                    }
                    `.appendNewLine() : ""}
                `.appendNewLineIfNotEmpty();
            }

            if ( isAttributeExp(property) ) {
                console.log("Processing Derived Attribute: " + property.name);
                const modParam = property.params.find(p => isAttributeParamMod(p)) as AttributeParamMod | undefined;
                return expandToNode`

                    // ${property.name} Attribute Derived Data
                    const ${property.name.toLowerCase()}CurrentValue = this.system.${property.name.toLowerCase()}?.value ?? 0;
                    const ${property.name.toLowerCase()}CurrentMax = this.system.${property.name.toLowerCase()}?.max ?? 0;
                    const ${property.name.toLowerCase()}ModFunc = (system) => {
                        ${modParam ? translateExpression(entry, id, modParam.method, true, property) : `return ${property.name.toLowerCase()}CurrentValue`}
                    };
                    this.system.${property.name.toLowerCase()} = {
                        value: ${property.name.toLowerCase()}CurrentValue,
                        max: ${property.name.toLowerCase()}CurrentMax,
                        mod: ${property.name.toLowerCase()}ModFunc(this.system)
                    };
                    if ( this.system.${property.name.toLowerCase()}.value > this.system.${property.name.toLowerCase()}.max ) {
                        this.system.${property.name.toLowerCase()}.value = this.system.${property.name.toLowerCase()}.max;
                    }
                `.appendNewLineIfNotEmpty();
            };

            if ( isResourceExp(property) && property.max != undefined && isMethodBlock(property.max) ) {
                console.log("Processing Derived Resource: " + property.name);
                //toBeReapplied.add("system." + property.name.toLowerCase() + ".max");
                return expandToNode`
                    // ${property.name} Resource Derived Data
                    const ${property.name.toLowerCase()}CurrentValue = this.system.${property.name.toLowerCase()}.value ?? 0;
                    const ${property.name.toLowerCase()}TempValue = this.system.${property.name.toLowerCase()}.temp ?? 0;
                    const ${property.name.toLowerCase()}MaxFunc = (system) => {
                        ${translateExpression(entry, id, property.max as MethodBlock, true, property)}
                    };
                    this.system.${property.name.toLowerCase()} = {
                        value: ${property.name.toLowerCase()}CurrentValue,
                        temp: ${property.name.toLowerCase()}TempValue,
                        max: ${property.name.toLowerCase()}MaxFunc(this.system)
                    };
                    this.reapplyActiveEffectsForName("system.${property.name.toLowerCase()}.max");
                    if ( this.system.${property.name.toLowerCase()}.value > this.system.${property.name.toLowerCase()}.max ) {
                        this.system.${property.name.toLowerCase()}.value = this.system.${property.name.toLowerCase()}.max;
                    }
                `.appendNewLineIfNotEmpty();
            }

            if ( isDocumentArrayExp(property) ) {
                console.log("Processing Derived Document Array: " + property.name);

                const whereParam = property.params.find(p => isWhereParam(p));
                if ( whereParam ) {
                    return expandToNode`
                    // ${property.name} Document Array Derived Data
                    this.system.${property.name.toLowerCase()} = this.items.filter((item) => {
                        if ( item.type !== "${property.document.ref?.name.toLowerCase()}") return false;
                        return ${translateExpression(entry, id, whereParam.value, true, property)};
                    });
                    `.appendNewLineIfNotEmpty();
                }
                return expandToNode`
                    // ${property.name} Document Array Derived Data
                    // this.system.${property.name.toLowerCase()} = this.system.${property.name.toLowerCase()}.map((item) => {
                    //     return item();
                    // });
                    this.system.${property.name.toLowerCase()} = this.items.filter((item) => item.type == "${property.document.ref?.name.toLowerCase()}");
                `.appendNewLineIfNotEmpty();
            }

            return
        }

        function generateDerivedData(document: Document): CompositeGeneratorNode | undefined {
            return expandToNode`
                async _prepare${document.name}DerivedData() {
                    ${joinToNode(document.body, property => generateDerivedAttribute(property), { appendNewLineIfNotEmpty: true })}

                    ${isActor(document) ? expandToNode`
                        // Reapply Active Effects for calculated values
                        ${joinToNode(toBeReapplied, name => expandToNode`this.reapplyActiveEffectsForName("${name}");`, { appendNewLineIfNotEmpty: true})}
                    ` : ""}
                }
            `.appendNewLineIfNotEmpty().appendNewLine();
        }

        function generateActorPreUpdate(document: Document): CompositeGeneratorNode | undefined {
            const allResources = getAllOfType<ResourceExp>(document.body, isResourceExp);
            const healthResource = allResources.find(x => x.tag == "health") as ResourceExp | undefined;
            if (healthResource == undefined) return expandToNode`
            _handlePreUpdate${document.name}Delta(changes, deltas) {
                // No health resource defined
            }
            `.appendNewLine();

            return expandToNode`
            _handlePreUpdate${document.name}Delta(changes, deltas) {
                // Health resource updates
                if (changes.system.${healthResource.name.toLowerCase()} === undefined) return;

                // Store value and temp changes
                const valueChange = changes.system.${healthResource.name.toLowerCase()}.value;
                const tempChange = changes.system.${healthResource.name.toLowerCase()}.temp;

                // Calculate delta
                if (valueChange !== undefined) {
                    const delta = valueChange - this.system.${healthResource.name.toLowerCase()}.value;
                    if (delta !== 0) {
                        deltas.${healthResource.name.toLowerCase()} = delta;
                    }
                }

                // Calculate temp delta
                if (tempChange !== undefined) {
                    const tempDelta = tempChange - this.system.${healthResource.name.toLowerCase()}.temp;
                    if (tempDelta !== 0) {
                        deltas.${healthResource.name.toLowerCase()}Temp = tempDelta;
                    }
                }
            }
            `.appendNewLine();
        }

        function generateDeltas(documents: Document[]): CompositeGeneratorNode | undefined {

            if (type != "Actor") return;

            function generateHealthResourceAssignments(documents: Document[]) {
                function documentHealthResource(document: Document): CompositeGeneratorNode | undefined {
                    const healthResource = getAllOfType<ResourceExp>(document.body, isResourceExp).find(x => x.tag == "health") as ResourceExp | undefined;
                    if (healthResource == undefined) return;

                    return expandToNode`
                    case "${document.name.toLowerCase()}": {
                        // ${healthResource.name} health resource

                        if ( !data.prototypeToken.bar1.attribute ) data.prototypeToken.bar1.attribute = "${healthResource.name.toLowerCase()}";
                        if ( !data.prototypeToken.displayBars ) data.prototypeToken.displayBars = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
                    }
                    `.appendNewLineIfNotEmpty();
                }

                return expandToNode`
                    switch ( data.type ) {
                        ${joinToNode(documents.filter(x => isActor(x)), document => documentHealthResource(document), { appendNewLineIfNotEmpty: true })}
                    }
                `.appendNewLineIfNotEmpty();
            }

            return expandToNode`
            async _preUpdate(data, options, userId) {
                await super._preUpdate(data, options, userId);
                if (!options.diff || data === undefined) return;
                let changes = {};

                // Foundry v12 no longer has diffed data during _preUpdate, so we need to compute it ourselves.
                if (game.release.version >= 12) {
                    // Retrieve a copy of the existing actor data.
                    let newData = game.system.utils.flattenObject(data);
                    let oldData = game.system.utils.flattenObject(this);

                    // Limit data to just the new data.
                    const diffData = foundry.utils.diffObject(oldData, newData);
                    changes = foundry.utils.expandObject(diffData);
                }
                else {
                    changes = foundry.utils.duplicate(data);
                }

                // Handle name changes
                if (changes.name) {
                    let tokenData = {};

                    // Propagate name update to prototype token if same as actor
                    if (changes.name && this.name == this.prototypeToken.name) {
                        data.prototypeToken = {name: data.name};
                    }

                    // Update tokens.
                    let tokens = this.getActiveTokens();
                    tokens.forEach(token => {
                        let updateData = foundry.utils.duplicate(tokenData);

                        // Propagate name update to token if same as actor
                        if (data.name && this.name == token.name) {
                            updateData.name = data.name;
                        }
                        token.document.update(updateData);
                    });
                }
    
                if (changes.system === undefined) return; // Nothing more to do

                const deltas = {};

                ${joinToNode(documents.filter(x => isActor(x)), document => expandToNode`
                    if (this.type == "${document.name.toLowerCase()}") this._handlePreUpdate${document.name}Delta(changes, deltas);
                `, { appendNewLineIfNotEmpty: true })}

                options.fromPreUpdate = deltas;
            }

            /* -------------------------------------------- */

            ${joinToNode(documents.filter(x => isActor(x)), document => generateActorPreUpdate(document), { appendNewLineIfNotEmpty: true })}

            /* -------------------------------------------- */

            async _onUpdate(data, options, userId) {
                await super._onUpdate(data, options, userId);

                // Iterate over all objects in fromPreUpdate, showing scrolling text for each.
                if (options.fromPreUpdate) {
                    for (const [key, delta] of Object.entries(options.fromPreUpdate)) {
                        this._showScrollingText(delta, key);
                    }
                }

                // Add / remove status effects
                const calculatedStatusEffects = CONFIG.statusEffects.filter(effect => effect.calculated);
                for (const effect of calculatedStatusEffects) {
                    const key = effect.id;
                    const active = this.system[key] ?? false;
                    const existing = this.effects.find(e => e.statuses.has(key));

                    if ((active && existing) || (!active && !existing)) continue;

                    // If the effect is active the AE doesn't exist, add it
                    if (active && !existing) {
                        const cls = getDocumentClass("ActiveEffect");
                        const createData = foundry.utils.deepClone(effect);
                        createData.statuses = [key];
                        delete createData.id;
                        createData.name = game.i18n.localize(createData.name);
                        await cls.create(createData, {parent: this});
                    }

                    // If the effect is active the AE doesn't exist, add it
                    if (!active && existing) {
                        this.deleteEmbeddedDocuments("ActiveEffect", [existing.id]);
                    }
                }
            }

            /* -------------------------------------------- */

            async _onCreate(data, options, userId) {
                await super._onCreate(data, options, userId);

                console.log("onCreate", data, options, userId);

                ${generateHealthResourceAssignments(documents)}
            }

            /* -------------------------------------------- */

            _showScrollingText(delta, suffix="", overrideOptions={}) {
            // Show scrolling text of hp update
            const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
            if (delta != 0 && tokens.length > 0) {
                let color = delta < 0 ? 0xcc0000 : 0x00cc00;
                for ( let token of tokens ) {
                    let textOptions = {
                        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
                        direction: CONST.TEXT_ANCHOR_POINTS.TOP,
                        fontSize: 32,
                        fill: color,
                        stroke: 0x000000,
                        strokeThickness: 4,
                        duration: 3000
                    };
                    canvas.interface.createScrollingText(
                        token.center,
                        delta.signedString()+" "+suffix,
                        foundry.utils.mergeObject(textOptions, overrideOptions)
                    );
                    // Flash dynamic token rings.
                    if (token?.ring) {
                        const flashColor = delta < 0 ? Color.fromString('#ff0000') : Color.fromString('#00ff00');
                        token.ring.flashColor(flashColor, {
                            duration: 600,
                            easing: foundry.canvas.tokens.TokenRing.easeTwoPeaks,
                        });
                    }
                }
            }
        }
        `.appendNewLineIfNotEmpty();
        }

        function generateInitiativeFormula(document: Document): CompositeGeneratorNode | undefined {
            const initiativeAttribute = getAllOfType<InitiativeProperty>(document.body, isInitiativeProperty);
            if (initiativeAttribute.length == 0) return;

            var initiative = initiativeAttribute[0]?.value;
            if (initiative == undefined) return;
            console.log("Initiative Formula");
            return expandToNode`
            case "${document.name.toLowerCase()}": return "${translateExpression(entry, id, initiative, true, initiativeAttribute[0])}";
            `.appendNewLineIfNotEmpty();
        }

        const fileNode = expandToNode`
            export default class ${entry.config.name}${type} extends ${type} {
                /** @override */
                prepareDerivedData() {
                    switch ( this.type ) {
                        ${joinToNode(entry.documents.filter(d => type == "Actor" ? isActor(d) : isItem(d)), document => `case "${document.name.toLowerCase()}": return this._prepare${document.name}DerivedData();`, { appendNewLineIfNotEmpty: true })}
                    }
                }

                /* -------------------------------------------- */

                ${joinToNode(entry.documents.filter(d => type == "Actor" ? isActor(d) : isItem(d)), document => generateDerivedData(document), { appendNewLineIfNotEmpty: true })}
            
                /* -------------------------------------------- */

                ${generateDeltas(entry.documents)}

                /* -------------------------------------------- */

                reapplyActiveEffectsForName(name) {
                    for (const effect of this.appliedEffects) {
                        for (const change of effect.changes) {
                            if (change.key == name) {
                                const changes = effect.apply(this, change);
                                Object.assign(this.overrides, changes);
                            }
                        }
                    }
                }

                /* -------------------------------------------- */

                // In order to support per-document type effects, we need to override the allApplicableEffects method to yield virtualized effects with only changes that match the document type
                /** @override */
                *allApplicableEffects() {
                    const systemFlags = this.flags["${id}"] ?? {};
                    const edit = systemFlags["edit-mode"] ?? true;

                    function getTypedEffect(type, edit, effect, source) {
                        const typedEffect = new ActiveEffect(foundry.utils.duplicate(effect));
                        typedEffect.changes = typedEffect.changes.filter(c => c.key.startsWith(type));
                        for ( const change of typedEffect.changes ) {
                            change.key = change.key.replace(type + ".", "");
                        }
                        if ( edit ) typedEffect.disabled = true;
                        typedEffect.source = source;
                        return typedEffect;
                    }

                    for ( const effect of this.effects ) {
                        yield getTypedEffect(this.type, edit, effect, game.i18n.localize("Self"));
                    }
                    for ( const item of this.items ) {
                        for ( const effect of item.effects ) {
                            if ( effect.transfer ) yield getTypedEffect(this.type, edit, effect, item.name);
                        }
                    }
                }

                /* -------------------------------------------- */

                _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
                    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);

                    for (const document of documents) {
                        if (document.documentName !== "ActiveEffect") continue;
                        
                        for (const change of document.changes) {
                            if (change.mode != 0) continue;
                            const customMode = foundry.utils.getProperty(document.flags["${id}"], change.key + "-custommode");
                            switch (customMode) {
                                case 1: // Add Once
                                    this._effectAddOnce(parent, document, change);
                                    break;
                                default:
                                    console.error("Unknown custom mode", customMode);
                                    break;
                            }
                        }
                    }
                }

                /* -------------------------------------------- */

                _effectAddOnce(parent, ae, change) {
                    console.dir("AddOnce", parent, ae, change);

                    const key = change.key.replace(parent.type + ".", "");
                    const currentValue = foundry.utils.getProperty(parent.data, key);

                    // Create an update for the parent
                    const update = {
                        [key]: currentValue + parseInt(change.value)
                    };
                    parent.update(update);

                    // Create a chat card
                    const chatData = {
                        user: game.user._id,
                        speaker: ChatMessage.getSpeaker({ actor: parent }),
                        content: \`<p>Added "\${ae.name}" once</p>\`
                    };
                    ChatMessage.create(chatData);
                }

                /* -------------------------------------------- */
                
                static async createDialog(data = {}, { parent = null, pack = null, types = null, ...options } = {}) {
                    types ??= game.documentTypes[this.documentName].filter(t => (t !== CONST.BASE_DOCUMENT_TYPE) && (CONFIG[this.documentName].typeCreatables[t] !== false));
                    if (!types.length) return null;

                    const collection = parent ? null : pack ? game.packs.get(pack) : game.collections.get(this.documentName);
                    const folders = collection?._formatFolderSelectOptions() ?? [];

                    const label = game.i18n.localize(this.metadata.label);
                    const title = game.i18n.format("DOCUMENT.Create", { type: label });
                    const name = data.name || game.i18n.format("DOCUMENT.New", { type: label });

                    let type = data.type || CONFIG[this.documentName]?.defaultType;
                    if (!types.includes(type)) type = types[0];

                    // If there's only one type, no need to prompt
                    if (types.length === 1) {
                        let createName = this.defaultName();
                        const createData = {
                            name: createName,
                            type
                        };
                        return this.create(createData, { parent, pack, renderSheet: true });
                    }

                    const content = await renderTemplate("systems/wrm/system/templates/document-create.hbs", {
                        folders, name, type,
                        folder: data.folder,
                        hasFolders: folders.length > 0,
                        types: types.reduce((arr, typer) => {
                            arr.push({
                                type: typer,
                                label: game.i18n.has(typer) ? game.i18n.localize(typer) : typer,
                                icon: this.getDefaultArtwork({ typer })?.img ?? "icons/svg/item-bag.svg",
                                description: CONFIG[this.documentName]?.typeDescriptions?.[typer] ?? "",
                                selected: type === typer
                            });
                            return arr;
                        }, []).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
                    });
                    return Dialog.prompt({
                        title, content,
                        label: title,
                        render: html => {
                            const app = html.closest(".app");
                            const folder = app.querySelector("select");
                            if (folder) app.querySelector(".dialog-buttons").insertAdjacentElement("afterbegin", folder);
                            app.querySelectorAll(".window-header .header-button").forEach(btn => {
                                const label = btn.innerText;
                                const icon = btn.querySelector("i");
                                btn.innerHTML = icon.outerHTML;
                                btn.dataset.tooltip = label;
                                btn.setAttribute("aria-label", label);
                            });
                            app.querySelector(".document-name").select();
                        },
                        callback: html => {
                            const form = html.querySelector("form");
                            const fd = new FormDataExtended(form);
                            const createData = foundry.utils.mergeObject(data, fd.object, { inplace: false });
                            if (!createData.folder) delete createData.folder;
                            if (!createData.name?.trim()) createData.name = this.defaultName();
                            return this.create(createData, { parent, pack, renderSheet: true });
                        },
                        rejectClose: false,
                        options: { ...options, jQuery: false, width: 700, classes: ["${id}", "create-document", "dialog"] }
                    });
                }

                /* -------------------------------------------- */

                static getDefaultArtwork(itemData = {}) {
                    const { type } = itemData;
                    const { img } = super.getDefaultArtwork(itemData);
                    return { img: CONFIG[this.documentName]?.typeArtworks?.[type] ?? img };
                }

                /* -------------------------------------------- */

                getRollData() {
                    const data = super.getRollData();
                    const rollData = foundry.utils.duplicate(data);
                    rollData.system = this.system;
                    return rollData;
                }

                /* -------------------------------------------- */

                /** @override */
                async modifyTokenAttribute(attribute, value, isDelta, isBar) {
                    const resource = foundry.utils.getProperty(this.system, attribute);

                    if (isDelta && value < 0) {
                        // Apply to temp first
                        resource.temp += value;

                        // If temp is negative, apply to value
                        if (resource.temp < 0) {
                            resource.value += resource.temp;
                            resource.temp = 0;
                        }
                        await this.update({ ["system." + attribute]: resource });
                        return;
                    }

                    return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
                }

                ${type == "Actor" ? expandToNode`
/* -------------------------------------------- */

getInitiativeFormula() {
    switch ( this.type ) {
        ${joinToNode(entry.documents.filter(d => isActor(d)), document => generateInitiativeFormula(document), { appendNewLineIfNotEmpty: true })}
    }
}
`.appendNewLine() : ""}
            }
            `.appendNewLineIfNotEmpty();
        fs.writeFileSync(generatedFilePath, toString(fileNode));
    }

    generateExtendedDocumentClass("Actor", entry);
    generateExtendedDocumentClass("Item", entry);
}
