import {
    ClassExpression,
    Document,
    Section,
    DocumentArrayExp,
    IconParam,
    ColorParam,
    Page,
    isPage,
    isBackgroundParam,
    BackgroundParam,
    ResourceExp,
    isStringParamChoices,
    StringParamChoices,
    StringParamValue,
    isStringParamValue,
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
    isIconParam,
    isSingleDocumentExp,
    isColorParam,
    isNumberParamValue,
} from "../../language/generated/ast.js"
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAllOfType, getSystemPath } from './utils.js';
import { Reference } from 'langium';

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
            }
            else {
                let baseColorIndex = (i - baseColors.length) % baseColors.length;
                // Clamp to valid indexes
                if (baseColorIndex < 0) baseColorIndex = 0;
                if (baseColorIndex >= baseColors.length) baseColorIndex = baseColors.length - 1;
                console.log(i, baseColorIndex, baseColors.length);
                const shadePercentage = 10 * Math.floor((i - baseColors.length) / baseColors.length + 1);
                colors.push(shadeColor(baseColors[baseColorIndex], shadePercentage));
            }
        }
        return colors;
    }

    // Generate a unique color per Resource
    let allResources = getAllOfType<ResourceExp>(document.body, isResourceExp);
    const colors = generateColors(allResources.length);
    console.log(colors);
    let currentColorIndex = 0;

    function generateField(property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {

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
            let stringValue = property.params.find(x => isStringParamValue(x)) as StringParamValue;
            let choices = property.params.find(x => isStringParamChoices(x)) as StringParamChoices;

            let disabled = property.modifier == "readonly" || stringValue != undefined || !edit;

            if (choices != undefined && choices.choices.length > 0) {
                return expandToNode`
                    {{!-- String ${property.name} --}}
                    <div class="form-group property stringExp" data-name="system.${property.name.toLowerCase()}">
                        <label>{{ localize "${document.name}.${property.name}.label" }}</label>
                        <select name="system.${property.name.toLowerCase()}" ${disabled ? "disabled='disabled'" : ""}>
                            {{selectOptions ${property.name.toLowerCase()}Choices selected=document.system.${property.name.toLowerCase()} localize=true}}
                        </select>
                    </div>
                `.appendNewLine().appendNewLine();
            }

            return expandToNode`
                {{!-- String ${property.name} --}}
                <div class="form-group property stringExp" data-name="system.${property.name.toLowerCase()}">
                    <label>{{ localize "${document.name}.${property.name}" }}</label>
                    <input name="system.${property.name.toLowerCase()}" type="text" value="{{document.system.${property.name.toLowerCase()}}}" placeholder="${property.name}" ${disabled ? "disabled='disabled'" : ""} />
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
            let darkColor = shadeColor(color, 25);
            let lightColor = shadeColor(color, 50);

            // If this is a health resource, use red and green colors
            if (property.tag == "health") {
                lightColor = "#8B0000";
                darkColor = "#33cc33";
            }

            return expandToNode`
                {{!-- Resource ${property.name} --}}
                <fieldset style="border-color: ${color};" class="property resourceExp">
                    <legend>{{ localize "${document.name}.${property.name}" }}</legend>

                    {{!-- Current --}}
                    <div class="form-group" data-name="system.${property.name.toLowerCase()}">
                        <label>{{ localize "Current" }}</label>
                        <div class="flexrow values">
                            {{numberInput document.system.${property.name.toLowerCase()}.value name="system.${property.name.toLowerCase()}.value" min=0 max=document.system.${property.name.toLowerCase()}.max step=1 disabled=${property.modifier == "readonly"}}}
                        
                            {{!-- Temp --}}
                            <input type="number" class="temp" value="{{document.system.${property.name.toLowerCase()}.temp}}" step="1" name="system.${property.name.toLowerCase()}.temp" min="0" data-tooltip="{{localize "Temporary"}}">
                        </div>
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
                    <div class="single-document-content">
                        {{{${property.name.toLowerCase()}ContentLink}}}
                        ${edit ? `<a class="single-document-remove" data-name="system.${property.name.toLowerCase()}" data-action="remove" style="flex: 0;margin-left: 0.25rem;"><i class="fa-solid fa-delete-left"></i></a>` : ""}
                    </div>
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

        // if (isPage(property)) {
        //     return joinToNode(property.body, property => generateField(property), { appendNewLineIfNotEmpty: true });
        // }

        return
    }

    function generateDocumentArray(property: DocumentArrayExp): CompositeGeneratorNode | undefined {

        function generateReferenceHeader(refDoc: Reference<Document> | undefined, property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {
            if ( isSection(property) ) {
                return expandToNode`
                    ${joinToNode(property.body, p => generateReferenceHeader(refDoc, p), { appendNewLineIfNotEmpty: true })}
                `;
            }
            if ( isHtmlExp(property) ) return undefined;

            if ( isProperty(property) ) {

                const isHidden = property.modifier == "hidden";
                if (isHidden) return undefined;

                if (isStringExp(property)) {
                    let choices = property.params.find(x => isStringParamChoices(x)) as StringParamChoices;
                    if (choices != undefined && choices.choices.length > 0 ) {
                        return expandToNode`
                            <th>{{ localize "${refDoc?.ref?.name}.${property.name}.label" }}</th>
                        `;
                    }
                }
                return expandToNode`
                    <th>{{ localize "${refDoc?.ref?.name}.${property.name}" }}</th>
                `;
            }
            return undefined;
        }

        function generateReferenceRow(refDoc: Reference<Document> | undefined, property: ClassExpression | Page | Section): CompositeGeneratorNode | undefined {

            if ( isSection(property) ) {
                return expandToNode`
                    ${joinToNode(property.body, p => generateReferenceRow(refDoc, p), { appendNewLineIfNotEmpty: true })}
                `;
            }
            if ( isHtmlExp(property) ) return undefined;
            if ( isProperty(property) ) {

                const isHidden = property.modifier == "hidden";
                if (isHidden) return undefined;

                return expandToNode`
                    <td>{{item.${getSystemPath(property)}}}</td>
                `
            }
            return undefined;
        }

        // We create each document array as a tab with a table of the documents, along with an add button
        return expandToNode`
            {{!-- ${property.name} Document Array --}}
            <div class="tab" data-group="secondary" data-tab="${property.name.toLowerCase()}" data-type="${property.document.ref?.name.toLowerCase()}" >
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

    const pages = getAllOfType<Page>(document.body, isPage);

    function generatePageTabHeader(property: Page): CompositeGeneratorNode | undefined {
        const iconParam = property.params.find(x => isIconParam(x)) as IconParam;
        const icon = iconParam?.value ?? "fa-solid fa-book";
        const backgroundParam = property.params.find(x => isBackgroundParam(x)) as BackgroundParam;
        const background = backgroundParam?.background ?? "topography";
        return expandToNode`
            <a class="item" data-tab="${property.name.toLowerCase()}" data-background="${background}"><i class="${icon}"></i> {{ localize "${document.name}.${property.name}" }}</a>
        `
    }

    function generateSheetBody(): CompositeGeneratorNode {
        function generatePage(property: Page): CompositeGeneratorNode {
            return expandToNode`
                <div class="tab" data-group="primary" data-tab="${property.name.toLowerCase()}">
                    <div class="grid-container">
                        ${joinToNode(property.body, property => generateField(property), { appendNewLineIfNotEmpty: true })}
                    </div>

                    {{!-- Tab Navigation --}}
                    <nav class="sheet-navigation tabs ${property.name.toLowerCase()}-nav" data-group="secondary">
                        ${joinToNode(property.body.filter(x => isDocumentArrayExp(x)).map(x => x as DocumentArrayExp), property => translateArrayTabHeader(property), { appendNewLineIfNotEmpty: true })}
                    </nav>

                    <section class="tabs-container ${property.name.toLowerCase()}-container">
                        ${joinToNode(property.body.filter(x => isDocumentArrayExp(x)).map(x => x as DocumentArrayExp), property => generateDocumentArray(property), { appendNewLineIfNotEmpty: true })}
                    </section>
                </div>
            `.appendNewLine().appendNewLine();
        }

        const iconParam = document.params?.find(x => isIconParam(x)) as IconParam;
        const icon = iconParam?.value ?? isActor(document) ? "fa-user" : "fa-suitcase";

        const backgroundParam = document.params?.find(x => isBackgroundParam(x)) as BackgroundParam;
        const background = backgroundParam?.background ?? "topography";

        return expandToNode`
            ${pages.length > 0 ? expandToNode`
                {{!-- Page Navigation --}}
                <nav class="sheet-navigation pages" data-group="primary">
                    <a class="item" data-tab="main" data-background="${background}"><i class="fa-solid ${icon}"></i> {{ localize "${document.name}" }}</a>
                    ${joinToNode(pages, page => generatePageTabHeader(page), { appendNewLineIfNotEmpty: true })}
                </nav>
            `: expandToNode``}

            <section class="pages-container">
                <div class="tab active" data-group="primary" data-tab="main">
                    {{!-- Main Configuration --}}
                    <div class="grid-container">
                        ${joinToNode(document.body, property => generateField(property), { appendNewLineIfNotEmpty: true })}
                    </div>

                    {{!-- Tab Navigation --}}
                    <nav class="sheet-navigation tabs" data-group="secondary">
                        <a class="item" data-tab="description"><i class="fa-solid fa-book"></i> {{ localize "Description" }}</a>
                        ${joinToNode(getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp), property => translateArrayTabHeader(property), { appendNewLineIfNotEmpty: true })}
                        <a class="item" data-tab="effects"><i class="fa-solid fa-sparkles"></i> {{ localize "Effects" }}</a>
                    </nav>

                    <section class="tabs-container">
                        {{!-- Description Tab --}}
                        <div class="tab description flexrow" data-group="secondary" data-tab="description">
                            <fieldset>
                                {{!-- Description --}}
                                <div class="form-group stacked" data-name="system.description">
                                    <label>{{ localize "Description" }}</label>
                                    {{editor descriptionHTML target="system.description" button=false editable=editable engine="prosemirror" collaborate=false}}
                                </div>
                            </fieldset>
                        </div>

                        ${joinToNode(getAllOfType<DocumentArrayExp>(document.body, isDocumentArrayExp), property => generateDocumentArray(property), { appendNewLineIfNotEmpty: true })}
                    
                        {{!-- Effects Tab --}}
                        <div class="tab effects" data-group="secondary" data-tab="effects" data-type="ActiveEffect">
                            {{!-- Effects Table --}}
                            <table class="display" style="width: 100%">
                                <thead>
                                    <tr>
                                        <th data-class-name="priority" data-orderable="false">{{ localize "Image" }}</th>
                                        <th data-class-name="priority">{{ localize "Name" }}</th>
                                        <th>{{ localize "Source" }}</th>
                                        <th data-class-name="priority" data-orderable="false">{{ localize "Actions" }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {{#each ${document.$type == "Actor" ? "applicableEffects" : "document.effects"} as |effect|}}
                                        <tr data-id="{{effect._id}}" data-uuid="{{effect.uuid}}" data-type="ActiveEffect">
                                            <td><img src="{{effect.img}}" title="{{effect.name}}" width=40 height=40 /></td>
                                            <td data-tooltip='{{effect.description}}'>{{effect.name}}</td>
                                            <td>{{effect.source}}</td>
                                            <td>
                                                <div class="flexrow">
                                                    ${edit ? expandToNode``: expandToNode`
                                                    {{#if effect.disabled}}
                                                    <a class="row-action" data-action="toggle" data-item="{{effect._id}}" data-tooltip="{{localize 'Enable'}}"><i class="fas fa-toggle-off"></i></a>
                                                    {{else}}
                                                    <a class="row-action" data-action="toggle" data-item="{{effect._id}}" data-tooltip="{{localize 'Disable'}}"><i class="fas fa-toggle-on"></i></a>
                                                    {{/if}}
                                                    `}
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
                </div>

                ${joinToNode(pages, property => generatePage(property), { appendNewLineIfNotEmpty: true })}
            </section>
        `;
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

            ${edit && isActor(document) ? expandToNode`
                <div class="notification warning">{{localize 'EditModeWarning'}}</div>
            `: expandToNode``}

            {{!-- Body --}}
            <section class="sheet-body">
                ${generateSheetBody()}
            </section>
        </form>
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
