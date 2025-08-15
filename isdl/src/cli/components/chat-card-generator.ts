import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from "langium/generate";
import { Document, Entry, isResourceExp, ResourceExp } from "../../language/generated/ast.js";
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAllOfType, getSystemPath } from "./utils.js";

export function generateChatCardClass(entry: Entry, destination: string) {

    const generatedFileDir = path.join(destination, "system", "documents");
    const generatedFilePath = path.join(generatedFileDir, `chat-card.mjs`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    const id = entry.config.body.find(x => x.type == "id")!.value;

    function generateHpElement(document: Document): CompositeGeneratorNode {
        const healthResource = getAllOfType<ResourceExp>(document.body, isResourceExp).find(x => x.tag == "health") as ResourceExp | undefined;

        if (!healthResource) {
            return expandToNode`
                case '${document.name.toLocaleLowerCase()}':
                    // No health resource found.
                    break;
            `;
        }

        return expandToNode`
            case '${document.name.toLocaleLowerCase()}':

                // If the type is temp, add to the temp health.
                if ( type === 'temp' ) {
                    update['${getSystemPath(healthResource, ['temp'], undefined, false)}'] = target.actor.${getSystemPath(healthResource, ['temp'], undefined, false)} + (finalDamage !== undefined ? finalDamage : roll);
                    break;
                }

                // If the type is damage and we have temp health, apply to temp health first.
                if ( type === 'damage' && target.actor.${getSystemPath(healthResource, ['temp'], undefined, false)} > 0 ) {
                    const appliedDamage = finalDamage !== undefined ? finalDamage : roll;
                    update['${getSystemPath(healthResource, ['temp'], undefined, false)}'] = target.actor.${getSystemPath(healthResource, ['temp'], undefined, false)} - appliedDamage;

                    if ( update['${getSystemPath(healthResource, ['temp'], undefined, false)}'] < 0 ) {
                        update['${getSystemPath(healthResource)}'] = target.actor.${getSystemPath(healthResource)} + update['${getSystemPath(healthResource, ['temp'], undefined, false)}'];
                        update['${getSystemPath(healthResource, ['temp'], undefined, false)}'] = 0;
                    }
                }
                else {
                    // Otherwise, apply to the main health.
                    update['${getSystemPath(healthResource)}'] = target.actor.${getSystemPath(healthResource)} - (finalDamage !== undefined ? finalDamage : roll);
                }
                break;
        `;
    }

    const fileNode = expandToNode`
        import { ContextMenu2 } from '../contextMenu2.js';

        export default class ${entry.config.name}ChatCard {
            
            static activateListeners(html) {
                html.on("click", ".collapsible", ${entry.config.name}ChatCard._onChatCardToggleCollapsible.bind(this));
                html.on("click", ".action", ${entry.config.name}ChatCard._handleActionClick.bind(this));
                html.on("click", ".revert-target-damage", ${entry.config.name}ChatCard._onRevertTargetDamage.bind(this));
                html.on("click", ".dice-roll", event => {
                    const rollElement = event.currentTarget;
                    rollElement.classList.toggle("expanded");
                });
            
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

                function uuidv4() {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                        return v.toString(16);
                    });
                }

                function applyMenus(roll) {
                    var uuid = uuidv4();

                    // Add a way to uniquely identify this roll
                    $(this)[0].dataset.uuid = uuid;
                    $(this).off("contextmenu");

                    // Determine if applying damage to targets is allowed.
                    const allowTargeting = game.settings.get('${id}', 'allowTargetDamageApplication');
                    let targetType = game.settings.get('${id}', 'userTargetDamageApplicationType');
                    if (!allowTargeting && targetType !== 'selected') {
                        game.settings.set('${id}', 'userTargetDamageApplicationType', 'selected');
                        targetType = 'selected';
                    }

                    let menuItems = [];

                    function getRollFromElement(rollElement) {
                        const element = rollElement.hasClass('inline-roll')
                        ? rollElement
                        : rollElement.find('.result');

                        if (element.length === 0) return null;
                        
                        // Check if this is a damage roll by looking for damage roll attributes
                        const isDamageRoll = rollElement.hasClass('damage-roll') || rollElement.closest('.damage-roll').length > 0;
                        const damageRollElement = isDamageRoll ? (rollElement.hasClass('damage-roll') ? rollElement : rollElement.closest('.damage-roll')) : null;
                        
                        const rollValue = getRollValue(element);
                        
                        // If this is a damage roll, extract metadata
                        if (isDamageRoll && damageRollElement && damageRollElement.length > 0) {
                            const damageType = damageRollElement.attr('data-damage-type') || null;
                            const damageTypeSpan = damageRollElement.find('.damage-type');
                            const damageColor = damageTypeSpan.length > 0 ? damageTypeSpan.css('color') : null;
                            const damageIcon = damageRollElement.find('i').first().attr('class') || null;
                            
                            // Extract custom metadata from damage-metadata section if present
                            const metadata = {};
                            damageRollElement.find('.damage-metadata .damage-property').each(function() {
                                const property = $(this).attr('data-property');
                                const text = $(this).text();
                                const colonIndex = text.indexOf(':');
                                if (colonIndex !== -1 && property) {
                                    const value = text.substring(colonIndex + 1).trim();
                                    metadata[property] = value;
                                }
                            });
                            
                            return {
                                value: rollValue,
                                isDamageRoll: true,
                                damageType: damageType,
                                damageColor: damageColor,
                                damageIcon: damageIcon,
                                metadata: metadata
                            };
                        }
                        
                        return { value: rollValue, isDamageRoll: false };
                    }

                    function getRollValue(roll) {
                        if (Number.isInteger(roll)) {
                            return roll;
                        }
                        if (roll instanceof Roll) {
                            return roll.total;
                        }
                        // Try the regex for expanded rolls.
                        const REGEX_EXPANDED_INLINE_ROLL = /.*=\s(\d+)/gm;
                        let match = REGEX_EXPANDED_INLINE_ROLL.exec(roll[0].innerText);
                        if (match) return Number.parseInt(match[1]);

                        // Regex failed to match, try grabbing the inner text.
                        match = Number.parseInt(roll[0].innerText.trim());
                        return match || 0;  // Fallback if we failed to parse
                    }

                    function getTargets(targetType) {
                        const targets = targetType === 'targeted'
                        ? [...game.user.targets]
                        : (canvas?.tokens?.controlled ?? []);

                        if (!targets || targets?.length < 1) {
                            ui.notifications.warn(game.i18n.localize(\`NOTIFICATIONS.\${targetType === 'targeted' ? 'NoTokenTargeted' : 'NoTokenSelected'}\`));
                            return [];
                        }

                        return targets;
                    }

                    async function apply(element, event, type) {
                        const menu = element.find('#context-menu2')?.[0];
                        const applyTargetType = menu?.dataset?.target ?? 'selected';
                        const applyMod = menu?.dataset?.mod ? Number(menu.dataset.mod) : 1;
                        const bonusDamage = menu?.dataset?.bonus ? Number(menu.dataset.bonus) : 0;

                        let rollData = getRollFromElement(element);
                        if ( !rollData ) return;

                        let baseRoll = rollData.value;
                        if ( type === 'healing' ) {
                            baseRoll = -baseRoll;
                        }

                        baseRoll *= applyMod;

                        const targets = getTargets(applyTargetType);
                        const applicationSummary = {
                            type: type,
                            originalDamage: rollData.value,
                            bonusDamage: bonusDamage,
                            multiplier: applyMod,
                            totalBaseDamage: baseRoll,
                            damageType: rollData.isDamageRoll ? rollData.damageType : null,
                            damageColor: rollData.isDamageRoll ? rollData.damageColor : null,
                            damageIcon: rollData.isDamageRoll ? rollData.damageIcon : null,
                            targets: [],
                            timestamp: Date.now(),
                            userId: game.user.id
                        };

                        for ( const target of targets ) {
                            console.log(type, baseRoll, target);
                            const update = {};

                            let roll = foundry.utils.duplicate(baseRoll);
                            
                            // Create enhanced context with damage type and metadata if available
                            const context = { 
                                amount: roll,
                                damageType: rollData.isDamageRoll ? rollData.damageType : null,
                                damageMetadata: rollData.isDamageRoll ? rollData.metadata : {},
                                color: rollData.isDamageRoll ? rollData.damageColor : null,
                                icon: rollData.isDamageRoll ? rollData.damageIcon : null,
                                isDamageRoll: rollData.isDamageRoll
                            };
                            
                            await Hooks.callAllAsync('preApply' + type.titleCase(), target.actor, context);
                            roll = context.amount;

                            // Calculate resistance information for this target
                            let flatResistance = 0;
                            let percentResistance = 0;
                            let finalDamage = roll;
                            
                            if (rollData.isDamageRoll && rollData.damageType && type === 'damage') {
                                // Get resistance information from actor using datamodel field names
                                const damageTypeKey = rollData.damageType.toLowerCase().replace(/\s+/g, '');
                                const flatResistanceField = \`\${damageTypeKey}damageresistanceflat\`;
                                const percentResistanceField = \`\${damageTypeKey}damageresistancepercent\`;
                                
                                flatResistance = target.actor.system[flatResistanceField] || 0;
                                percentResistance = target.actor.system[percentResistanceField] || 0;
                                
                                if (flatResistance > 0 || percentResistance > 0) {
                                    // Apply resistance: (damage - flat) * (1 - percent/100)
                                    finalDamage = Math.max(0, (roll - flatResistance) * (1 - percentResistance / 100));
                                    finalDamage = Math.floor(finalDamage);
                                }
                            }

                            // Store pre-application state for revert functionality
                            const preState = {};
                            const targetSummary = {
                                uuid: target.document.uuid,
                                name: target.actor.name,
                                appliedAmount: roll,
                                finalDamage: finalDamage,
                                flatResistance: flatResistance,
                                percentResistance: percentResistance,
                                preState: {},
                                postState: {}
                            };

                            switch ( target.actor.type ) {
                                ${joinToNode(entry.documents, document => generateHpElement(document), { appendNewLineIfNotEmpty: true })}
                            }

                            // Store pre-state for revert
                            for (const [key, value] of Object.entries(update)) {
                                targetSummary.preState[key] = foundry.utils.getProperty(target.actor, key);
                                targetSummary.postState[key] = value;
                            }

                            await target.actor.update(update);
                            applicationSummary.targets.push(targetSummary);
                            
                            // Call the applied hook with enhanced context
                            Hooks.callAll('applied' + type.titleCase(), target.actor, context);
                        }

                        // Create damage application summary chat card
                        await createDamageApplicationChatCard(applicationSummary);
                    }

                    async function createDamageApplicationChatCard(summary) {
                        const setting = game.settings.get('${id}', 'damageApplicationChatCard');
                        if (setting === 'none') return;

                        const whisper = setting === 'gm' ? ChatMessage.getWhisperRecipients('GM') : [];
                        const typeLabel = summary.type === 'damage' ? 'Damage' : summary.type === 'healing' ? 'Healing' : 'Temp HP';
                        
                        // Create HTML content for the chat card
                        const targetRows = summary.targets.map((target, index) => {
                            let resistanceText = 'N/A';
                            
                            if (summary.type === 'damage' && summary.damageType) {
                                const hasFlat = target.flatResistance > 0;
                                const hasPercent = target.percentResistance > 0;
                                
                                if (hasFlat || hasPercent) {
                                    const parts = [];
                                    if (hasFlat) parts.push(\`\${target.flatResistance}\`);
                                    if (hasPercent) parts.push(\`\${target.percentResistance}%\`);
                                    resistanceText = parts.join(', ');
                                } else {
                                    resistanceText = 'None';
                                }
                            }
                            
                            return \`
                                <tr class="target-row" data-target-index="\${index}">
                                    <td><strong>\${target.name}</strong></td>
                                    <td>\${resistanceText}</td>
                                    <td><strong>\${summary.type === 'healing' ? '+' : ''}\${target.finalDamage}</strong></td>
                                    <td>
                                        <button type="button" class="revert-target-damage" data-target-index="\${index}" data-summary='\${JSON.stringify(summary)}' title="Revert this target">
                                            <i class="fas fa-undo"></i>
                                        </button>
                                    </td>
                                </tr>
                            \`;
                        }).join('');

                        const content = \`
                            <div class="damage-application-summary">
                                <div class="card-header">
                                    <h3><i class="fas fa-sword-cross"></i> \${typeLabel} Applied</h3>
                                </div>
                                
                                <div class="damage-summary">
                                    <div class="base-damage">
                                        <strong>Base Damage:</strong> \${summary.originalDamage}
                                        \${summary.bonusDamage > 0 ? \`+ \${summary.bonusDamage} bonus\` : ''}
                                        \${summary.multiplier !== 1 ? \` × \${summary.multiplier}\` : ''}
                                        = <strong>\${summary.totalBaseDamage}</strong>
                                        \${summary.damageType ? \`<br><strong>Type:</strong> <span class="damage-type" style="color: \${summary.damageColor || '#666'}">\${summary.damageIcon ? \`<i class="\${summary.damageIcon}"></i> \` : ''}\${summary.damageType}</span>\` : ''}
                                    </div>
                                </div>

                                <div class="targets-summary">
                                    <h4>Applied to Targets:</h4>
                                    <table class="damage-targets">
                                        <thead>
                                            <tr>
                                                <th>Target</th>
                                                <th>Resistance</th>
                                                <th>Final Damage</th>
                                                <th>Revert</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            \${targetRows}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        \`;

                        await ChatMessage.create({
                            user: game.user.id,
                            content: content,
                            whisper: whisper,
                            flags: {
                                [game.system.id]: {
                                    damageApplicationSummary: summary
                                }
                            }
                        });
                    }

                    if ( allowTargeting ) {
                        menuItems.push({
                            name: \`
                                <div class="damage-target flex flexrow">
                                    <button type="button" data-target="targeted"><i class="fa-solid fa-bullseye"></i> \${game.i18n.localize('Targeted')}</button>
                                    <button type="button" data-target="selected"><i class="fa-solid fa-expand"></i> \${game.i18n.localize('Selected')}</button>
                                </div>\`,
                            id: 'targets',
                            icon: '',
                            preventClose: true,
                            callback: (inlineRoll, event) => {
                                const button = event?.target ?? event?.currentTarget;
                                if (button?.dataset?.target) {
                                    // Deactivate the other target type.
                                    const activeButtons = inlineRoll.find('button[data-target].active');
                                    activeButtons.removeClass('active');
                                    // Set the target type on the menu for later reference.
                                    const menu = inlineRoll.find('#context-menu2')[0];
                                    if (menu) {
                                        menu.dataset.target = button.dataset.target;
                                    }
                                    // Toggle the active button and update the user setting.
                                    button.classList.add('active');
                                    game.settings.set('${id}', 'userTargetDamageApplicationType', button.dataset.target);
                                }
                            }
                        });
                    }

                    // Add damage multipliers.
                    menuItems.push({
                        name: \`
                            <div class="damage-modifiers flex flexrow">
                                <button type="button" data-mod="0.25">&frac14;x</button>
                                <button type="button" data-mod="0.5">&frac12;x</button>
                                <button type="button" data-mod="1" class="active">1x</button>
                                <button type="button" data-mod="1.5">1.5x</button>
                                <button type="button" data-mod="2">2x</button>
                                <button type="button" data-mod="3">3x</button>
                                <button type="button" data-mod="4">4x</button>
                            </div>\`,
                        id: 'modifiers',
                        icon: '',
                        preventClose: true,
                        callback: (inlineRoll, event) => {
                            const button = event?.target ?? event?.currentTarget;
                            if (button?.dataset?.mod) {
                                // Deactivate the other target type.
                                const activeButtons = inlineRoll.find('button[data-mod].active');
                                activeButtons.removeClass('active');

                                // Set the target type on the menu for later reference.
                                const menu = inlineRoll.find('#context-menu2')[0];
                                if (menu) {
                                    menu.dataset.mod = button.dataset.mod;
                                }
                                
                                // Toggle the active button and update the user setting.
                                button.classList.add('active');
                            }
                        }
                    });

                    menuItems.push(
                        {
                            name: game.i18n.localize("CONTEXT.ApplyDamage"),
                            id: 'damage',
                            icon: '<i class="fas fa-tint"></i>',
                            callback: (inlineRoll, event) => apply(inlineRoll, event, 'damage')
                        },
                        {
                            name: game.i18n.localize("CONTEXT.ApplyHealing"),
                            id: 'healing',
                            icon: '<i class="fas fa-medkit"></i>',
                            callback: (inlineRoll, event) => apply(inlineRoll, event, 'healing')
                        },
                        {
                            name: game.i18n.localize("CONTEXT.ApplyTemp"),
                            id: 'temp-healing',
                            icon: '<i class="fas fa-heart"></i>',
                            callback: (inlineRoll, event) => apply(inlineRoll, event, 'temp')
                        }
                    );
                    new ContextMenu2($(this).parent(), \`[data-uuid=\${uuid}]\`, menuItems);
                }
                html.find('.inline-roll').each(applyMenus);
                html.find('.dice-total').each(applyMenus);
            }

            /* -------------------------------------------- */

            static _onChatCardToggleCollapsible(event) {
                const target = event.currentTarget;

                // If the target is a content-link, ignore the click event
                if (event.target.classList.contains("content-link")) return;

                event.preventDefault();
                target.classList.toggle("collapsed");

                // Clear the height from the chat popout container so that it appropriately resizes.
                const popout = target.closest(".chat-popout");
                if ( popout ) popout.style.height = "";
            }
            
            /* -------------------------------------------- */
            
            static _handleActionClick(event) {
                event.preventDefault();
                const action = event.currentTarget.dataset.action;
                
                switch (action) {
                    case "place":
                        const template = event.currentTarget.closest(".measured-template");
                        if (!template) return;
        
                        const context = {
                            type: template.dataset.type,
                            distance: template.dataset.distance,
                            direction: template.dataset.direction,
                            angle: template.dataset.angle,
                            width: template.dataset.width
                        };
        
                        // Trigger the place action on the template
                        game.system.measuredTemplatePreviewClass.place(context, game.user.character?.sheet);                 
                        break;
                }   
            }

            static async _onRevertTargetDamage(event) {
                const button = event.currentTarget;
                const summaryData = JSON.parse(button.dataset.summary);
                const targetIndex = parseInt(button.dataset.targetIndex);
                const targetData = summaryData.targets[targetIndex];
                
                if (!targetData) {
                    ui.notifications.error("Target data not found");
                    return;
                }
                
                // Confirm revert
                const confirm = await Dialog.confirm({
                    title: "Revert Target Damage",
                    content: \`<p>Are you sure you want to revert the \${summaryData.type} application to <strong>\${targetData.name}</strong>?</p><p>This will restore the actor to their previous state.</p>\`,
                    yes: () => true,
                    no: () => false
                });
                
                if (!confirm) return;
                
                const tokenDocument = await fromUuid(targetData.uuid);
                if (!tokenDocument || !tokenDocument.actor) {
                    ui.notifications.warn(\`Cannot find target: \${targetData.name}\`);
                    return;
                }
                
                try {
                    await tokenDocument.actor.update(targetData.preState);
                    console.log(\`Reverted \${targetData.name} to pre-application state\`);
                    
                    // Update the button to show it's been reverted
                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-check"></i>';
                    button.classList.add('reverted');
                    button.title = 'Reverted';
                    
                    // Mark the table row as reverted
                    const targetRow = button.closest('.target-row');
                    if (targetRow) {
                        targetRow.classList.add('reverted');
                        targetRow.style.opacity = '0.6';
                        targetRow.style.textDecoration = 'line-through';
                    }
                    
                    ui.notifications.info(\`Damage application reverted for \${targetData.name}\`);
                } catch (error) {
                    ui.notifications.error(\`Failed to revert \${targetData.name}: \${error.message}\`);
                }
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
            {{#if hasDescription}}
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
            {{else}}
            <div class="chat-header">
                <header class="flexrow">
                    <img src="{{document.img}}" title="{{document.name}}" width="50" height="50">
                    <div class="title">
                        <div class="name">{{document.name}}</div>
                        <div class="type">{{localize document.type}}</div>
                    </div>
                </header>
            </div>
            {{/if}}
            <div class="chat-info">
                <dl>
                    {{#each parts}}
                        {{#if this.isRoll}}
                            {{#if this.isDamageRoll}}
                                <div class="dice-roll damage-roll wide" data-damage-type="{{this.damageType}}">
                                    <div class="dice-result">
                                        <h4 class="dice-total">
                                            {{#if this.damageIcon}}<i class="{{this.damageIcon}}" style="color: {{this.damageColor}};"></i>{{else}}<i class="fa-solid fa-dice-d20"></i>{{/if}}
                                            <span class="dice-info" data-tooltip="{{this.value.cleanFormula}}">
                                                <span class="label">{{this.label}}:</span> 
                                                <span class="formula">{{this.value.cleanFormula}}</span>
                                                {{#if this.damageType}}<span class="damage-type" style="color: {{this.damageColor}};">[{{this.damageType}}]</span>{{/if}}
                                            </span> 
                                            <span class="result">{{this.value._total}}</span>
                                        </h4>
                                        {{{this.tooltip}}}
                                    </div>
                                </div>
                            {{else}}
                                <div class="dice-roll wide">
                                    <div class="dice-result">
                                        <h4 class="dice-total"><i class="fa-solid fa-dice-d20"></i> <span class="dice-info" data-tooltip="{{this.value.cleanFormula}}"><span class="label">{{this.label}}:</span> <span class="formula">{{this.value.cleanFormula}}</span></span> <span class="result">{{this.value._total}}</span></h4>
                                        {{{this.tooltip}}}
                                    </div>
                                </div>
                            {{/if}}
                        {{else if this.isMeasuredTemplate}}
                            <div class="measured-template wide" data-type="{{this.object.type}}" data-distance="{{this.object.distance}}" data-direction="{{this.object.direction}}" data-angle="{{this.object.angle}}" data-width="{{this.object.width}}">
                                <div class="measured-template-button">
                                    <h4 class="summary"><i class="fa-solid fa-ruler-combined"></i> <span class="info">{{this.value}}</span><span class="result action" data-action="place" data-tooltip="Place"><i class="fa-solid fa-border-outer"></i></span></h4>
                                </div>
                            </div>
                        {{else if this.isParagraph}}
                            <div class="wide">
                                <dt>{{this.value}}</dt>
                                <dd></dd>
                            </div>
                        {{else}}
                            {{#if this.hasValue}}
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
                        {{/if}}
                    {{/each}}
                </dl>

                <div class="chat-info-tags">
                    {{#each tags}}
                        {{#if this.hasValue}}
                        <div class="tag"><span class="label">{{this.label}}</span> {{this.value}}</div>
                        {{/if}}
                    {{/each}}
                </div>
            </div>
            {{#if hasEffects}}
            <div class="chat-effects collapsible">
                <h3 class="title">{{localize "EFFECTS.TabEffects"}} <i class="collapse-icon fas fa-chevron-down fa-fw"></i></h3>
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
            {{/if}}
        </div>
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}