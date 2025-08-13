import generateMeasuredTemplateComponent from "./base-components/vue-measured-template.js";
import generateAttributeComponent from "./base-components/vue-attribute.js";
import generateResourceComponent from "./base-components/vue-resource.js";
import generateDocumentLinkComponent from "./base-components/vue-document-link.js";
import generateProsemirrorComponent from "./base-components/vue-prosemirror.js";
import generateRollVisualizerComponent from "./base-components/vue-roll-visualizer.js";
import generatePaperdollComponent from "./base-components/vue-paperdoll.js";
import generateCalculator from "./base-components/vue-calculator.js";
import generateTextFieldComponent from "./base-components/vue-text-field.js";
import generateDateTimeComponent from "./base-components/vue-date-time.js";
import generateTrackerComponent from "./base-components/vue-tracker.js";
import generateMacroChoiceComponent from "./base-components/vue-macro-choice.js";
import generateExtendedChoiceComponent from "./base-components/vue-extended-choice.js";
import generateDiceComponent from "./base-components/vue-dice.js";
import generateDamageApplicationComponent from "./base-components/vue-damage-application.js";

export function generateBaseVueComponents(destination: string) {
    generateAttributeComponent(destination);
    generateResourceComponent(destination);
    generateDocumentLinkComponent(destination);
    generateProsemirrorComponent(destination);
    generateRollVisualizerComponent(destination);
    generatePaperdollComponent(destination);
    generateCalculator(destination);
    generateTextFieldComponent(destination);
    generateDateTimeComponent(destination);
    generateTrackerComponent(destination);
    generateMacroChoiceComponent(destination);
    generateMeasuredTemplateComponent(destination);
    generateExtendedChoiceComponent(destination);
    generateDiceComponent(destination);
    generateDamageApplicationComponent(destination);
}
