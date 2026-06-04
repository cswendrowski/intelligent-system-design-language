import {
    ChoiceStringValue,
    ClassExpression,
    Document,
    Entry,
    LabelParam,
    StandardFieldParams, StringChoice,
    StringParamChoices, isStatusProperty,
} from '../../language/generated/ast.js';
import {
    isSection,
    isAction,
    isProperty,
    isPage,
    isStringParamChoices,
    isActor,
    isItem,
    isHookHandler,
    isLabelParam, Layout, isLayout, isChoiceStringValue, isStringExtendedChoice, isStringChoiceField, isDamageTypeChoiceField, isStringChoicesField,
    isVariableExpression, isPrompt, isFunctionDefinition,
    isSettingHint, isSettingChoices,
} from "../../language/generated/ast.js"
import { Prompt, VariableExpression, SettingHint, SettingChoices } from '../../language/generated/ast.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {toMachineIdentifier, getAllSettings, settingChoiceKeySegment} from "./utils.js";

export function generateLanguageJson(entry: Entry, id: string, destination: string) {
    const generatedFileDir = path.join(destination, `lang`);
    const generatedFilePath = path.join(generatedFileDir, `en.json`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, { recursive: true });
    }

    function humanize(string: string) {
        return string
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
            .replace(/([a-zA-Z])(\d)/g, '$1 $2');
    }

    function choiceLocalize(choice: StringChoice): string {
        if (!isStringExtendedChoice(choice.value)) return humanize(choice.value);
        const label = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
        if (label) return label.value;
        const value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
        return value ? humanize(value.value) : 'Unknown Choice';
    }

    function choiceValue(choice: StringChoice): string {
        if (!isStringExtendedChoice(choice.value)) return toMachineIdentifier(choice.value);
        const value = choice.value.properties.find(isChoiceStringValue) as ChoiceStringValue | undefined;
        if (value) return toMachineIdentifier(value.value);
        const label = choice.value.properties.find(isLabelParam) as LabelParam | undefined;
        return label ? toMachineIdentifier(label.value) : 'unknown';
    }

    function propertyEntries(property: ClassExpression | Layout): Record<string, any> {
        if (isSection(property) && property.body.length > 0) {
            return {
                [property.name]: humanize(property.name),
                ...Object.assign({}, ...property.body.map(p => propertyEntries(p)))
            };
        }
        if (isPage(property)) {
            return {
                [property.name]: humanize(property.name),
                ...Object.assign({}, ...property.body.map(p => propertyEntries(p)))
            };
        }
        if (isLayout(property)) {
            return Object.assign({}, ...property.body.map(p => propertyEntries(p)));
        }
        if (isStatusProperty(property)) {
            const labelParam = property.params.find(x => isLabelParam(x)) as LabelParam | undefined;
            return { [`Status.${property.name}`]: labelParam ? labelParam.value : humanize(property.name) };
        }
        if (isProperty(property)) {
            const standardParams = property.params as StandardFieldParams[];
            const labelParam = standardParams.find(x => isLabelParam(x)) as LabelParam | undefined;
            const label = labelParam ? labelParam.value : humanize(property.name);

            if (isStringChoiceField(property) || isStringChoicesField(property) || isDamageTypeChoiceField(property)) {
                const lp = (property.params as any[]).find((x: any) => isLabelParam(x)) as LabelParam | undefined;
                const l = lp ? lp.value : humanize(property.name);
                const choiceParam = (property.params as any[]).find((p: any) => isStringParamChoices(p) || p.$type === 'StringChoicesParamChoices') as StringParamChoices | undefined;
                const choiceEntries = choiceParam
                    ? Object.fromEntries(choiceParam.choices.map((c: StringChoice) => [choiceValue(c), choiceLocalize(c)]))
                    : {};
                return { [property.name]: { label: l, ...choiceEntries } };
            }
            return { [property.name]: label };
        }
        if (isAction(property)) {
            const labelParam = property.params.find(x => isLabelParam(x)) as LabelParam | undefined;
            // Emit localization entries for any prompt fields inside the action so their labels resolve.
            const promptFields = (property.method.body.filter(x => isVariableExpression(x)) as VariableExpression[])
                .filter(v => isPrompt(v.value))
                .flatMap(v => (v.value as Prompt).body);
            const promptEntries = Object.assign({}, ...promptFields.map(f => propertyEntries(f)));
            return { [property.name]: labelParam ? labelParam.value : humanize(property.name), ...promptEntries };
        }
        if (isFunctionDefinition(property)) {
            // Functions have no label of their own, but prompt fields inside them still need
            // localization entries so their labels resolve (same as the action branch above).
            const promptFields = (property.method.body.filter(x => isVariableExpression(x)) as VariableExpression[])
                .filter(v => isPrompt(v.value))
                .flatMap(v => (v.value as Prompt).body);
            return Object.assign({}, ...promptFields.map(f => propertyEntries(f)));
        }
        if (isHookHandler(property)) {
            return { [property.name]: humanize(property.name) };
        }
        return {};
    }

    function documentEntries(document: Document): Record<string, any> {
        const bodyEntries = Object.assign({}, ...document.body.map(p => propertyEntries(p)));
        return {
            [document.name.toLowerCase()]: humanize(document.name),
            [document.name]: {
                [document.name]: humanize(document.name),
                ...bodyEntries
            }
        };
    }

    // Author-declared settings: Name + (optional) Hint, plus a nested label map
    // for choice<string> settings. Keys mirror those referenced by the init hook.
    const customSettingEntries: Record<string, any> = {};
    for (const setting of getAllSettings(entry)) {
        const labelParam = setting.params.find(x => isLabelParam(x)) as LabelParam | undefined;
        customSettingEntries[`${setting.name}Name`] = labelParam ? labelParam.value : humanize(setting.name);

        const hintParam = setting.params.find(x => isSettingHint(x)) as SettingHint | undefined;
        if (hintParam) customSettingEntries[`${setting.name}Hint`] = hintParam.value;

        const choicesParam = setting.params.find(x => isSettingChoices(x)) as SettingChoices | undefined;
        if (choicesParam) {
            customSettingEntries[setting.name] = Object.fromEntries(
                choicesParam.choices.map(c => [settingChoiceKeySegment(c), c])
            );
        }
    }

    const actors = entry.documents.filter(d => isActor(d));
    const items = entry.documents.filter(d => isItem(d));

    const localization: Record<string, any> = {
        NoSingleDocument: 'No Linked Document',
        EditModeWarning: 'Active Effects are not applied while in Edit mode. Base values are displayed and used for all rolls, calculations and actions.',
        SendToChat: 'Send to Chat',
        SETTINGS: {
            CreateSystemJournalName: 'Create System Journal',
            CreateSystemJournalHint: 'If disabled, the System Journal will not be automatically created on load.',
            RoundUpDamageApplicationName: 'Round Up Damage',
            RoundUpDamageApplicationHint: 'When enabled, damage is rounded up to the nearest whole number. When disabled, damage is rounded down.',
            AllowTargetDamageApplicationName: 'Allow Target Damage Application',
            AllowTargetDamageApplicationHint: 'Whether or not to allow damage and healing on chat messages to be applied to targeted tokens in addition to selected tokens. Targeting does not require permissions, so this can allow players and GMs to apply damage to ANY token they can see.',
            DamageApplicationChatCardName: 'Damage Application Summary',
            DamageApplicationChatCardHint: 'Controls when to send chat cards summarizing damage/healing applications with revert functionality.',
            DamageApplicationChatCard: { None: "Don't send", Public: 'Send to All (public message)', GM: 'Send to GM (GM-only message)' },
            ...customSettingEntries
        },
        ROLLVISUALIZER: { Min: 'Min', Max: 'Max', Average: 'Average', Simulations: 'simulations', NoFormula: 'No roll to visualize' },
        ROLL: { Critical: 'Critical!', Fumble: 'Fumble!', CritFumble: 'Critical Fumble!' },
        CONTEXT: { ApplyChanges: 'Apply', ApplyDamage: 'As Damage', ApplyHealing: 'As Healing', ApplyTemp: 'As Temporary' },
        NOTIFICATIONS: { NoTokenSelected: 'No Token is currently selected', NoTokenTargeted: 'No Token is currently targeted' },
        TYPES: {
            Actor: { actor: 'Actor', ...Object.fromEntries(actors.map(a => [a.name.toLowerCase(), humanize(a.name)])) },
            Item:  { item:  'Item',  ...Object.fromEntries(items.map(i =>  [i.name.toLowerCase(), humanize(i.name)])) }
        },
        EFFECTS: { AddOnce: 'Add Once', TabEffects: 'Effects' },
        JOURNAL: {
            System: 'System', Keywords: 'Keywords', DamageTypes: 'Damage Types', StatusEffects: 'Status Effects',
            KeywordsUsageTitle: 'Keyword Usage:',
            KeywordsUsageList: { GameMechanics: 'Defines special rules and mechanics for your game', References: 'Can be referenced in text and chat cards via @keyword', Documentation: 'Provide clear explanations for players and GMs' },
            DamageTypeEffectsTitle: 'Damage Type Effects:',
            DamageTypeEffectsList: { Usage: 'Can be used in damage rolls and calculations', Resistances: 'May have associated resistances and bonuses', ChoiceFields: 'Appears in damage type choice fields' },
            StatusEffectUsageTitle: 'Status Effect Usage:',
            StatusEffectUsageList: { TokenApplication: 'Can be applied to tokens on the canvas', MenuAppearance: 'Appear in the token status effects menu', VisualIndicators: 'Provide visual indicators of character state' },
            KeywordBadge: 'Keyword', DamageTypeBadge: 'Damage Type', StatusEffectBadge: 'Status Effect', DeathEffectBadge: 'Death Effect',
            AppliedWhen: 'Applied when:',
            OperatorLabels: { LessThanOrEqual: 'is less than or equal to', GreaterThanOrEqual: 'is greater than or equal to', LessThan: 'is less than', GreaterThan: 'is greater than', Equals: 'equals', NotEqual: 'does not equal', Exists: 'exists', NotExists: 'does not exist' }
        },
        ...Object.assign({}, ...entry.documents.map(d => documentEntries(d)))
    };

    fs.writeFileSync(generatedFilePath, JSON.stringify(localization, null, 4));
}
