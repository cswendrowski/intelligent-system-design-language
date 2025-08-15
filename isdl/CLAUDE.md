# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension and CLI tool for the Intelligent System Design Language (ISDL), a domain-specific language for creating tabletop RPG systems for Foundry VTT. The project uses Langium as the language framework and generates JavaScript/Vue applications for game systems.

## Architecture

### Core Components

1. **Language Server** (`src/language/`): Langium-based language server providing syntax highlighting, validation, and completion
   - `intelligent-system-design-language.langium`: Grammar definition for the ISDL language
   - `intelligent-system-design-language-module.ts`: Dependency injection configuration
   - `intelligent-system-design-language-validator.ts`: Custom validation rules
   - `main.ts`: Language server entry point

2. **VS Code Extension** (`src/extension/`): Extension that integrates the language server with VS Code
   - `main.ts`: Extension activation, command registration, and GitHub integration setup
   - `github/`: GitHub publishing functionality for sharing systems

3. **CLI Generator** (`src/cli/`): Command-line tool that generates Foundry VTT systems from ISDL files
   - `main.ts`: CLI entry point with commander.js
   - `generator.ts`: Main code generation logic
   - `components/`: Generators for specific system components (actors, items, sheets, etc.)

### Key Technologies

- **Langium**: Language workbench for building DSLs with TypeScript
- **Vue 3 + Vuetify**: Frontend framework for generated character sheets
- **DataTables**: Table components for item/actor lists
- **GitHub API**: Integration for publishing systems to repositories

## Development Commands

```bash
# Build the project
npm run build

# Development with auto-rebuild
npm run watch

# Generate Langium artifacts from grammar
npm run langium:generate

# Generate system from ISDL file (CLI)
npm run fsdl:generate
# or
node ./bin/cli.js generate <file.isdl> --destination <output-dir>
```

You can generate test output into the /test-output/ folder.

## File Extensions

The project supports two file extensions:
- `.isdl` - Intelligent System Design Language files
- `.fsdl` - Legacy Foundry System Design Language files (deprecated)

## Code Generation Flow

1. ISDL file is parsed using Langium grammar
2. AST is validated using custom validation rules
3. Generator traverses AST and creates:
   - Foundry VTT system manifest (`system.json`)
   - Data models for actors and items
   - Vue components for character sheets
   - CSS styles and assets
   - JavaScript hooks and initialization code

## GitHub Integration

The extension includes comprehensive GitHub publishing features:
- OAuth authentication with GitHub
- Repository creation and management
- Automated publishing of generated systems
- Documentation and build script generation
- Status bar integration and repository wizards

## Testing

- Uses Vitest for testing
- Test files are in `test/` directory organized by feature:
  - `linking/`: Cross-reference resolution tests
  - `parsing/`: Grammar parsing tests
  - `validating/`: Validation rule tests

## Important Notes

- The project generates Foundry VTT v12 and v13 compatible systems
- Generated code includes Vue 3 reactive character sheets
- Support for complex RPG mechanics like damage tracks, dice rolling, and status effects
- Extensive customization options through ISDL syntax parameters
- Aimed at people new to development

## Implementation notes
- System paths are always lowercase, such as system.firebonusdamage
- User facing strings such as labels should be localized and added to the generated localization file
- When checking Langium AST types, use the generated type checker method such as isConfig

## Adding New Field Types

This section provides a step-by-step guide for adding new field types to the ISDL language and Vue component system.

### 1. Grammar Definition (`src/language/intelligent-system-design-language.langium`)

Add your new field type to the `ComplexFields` rule and define its grammar:

```langium
ComplexFields:
    (ResourceExp | TrackerExp | AttributeExp | DamageTrackExp | MeasuredTemplateField | DamageBonusesField | DamageResistancesField | YourNewField);

YourNewField:
    ExpressionModifier "yourFieldType" name=ID StandardFieldParamsFrag;
```

**Key Points:**
- Use `StandardFieldParamsFrag` for all fields to include support for standard parameters (label, icon, color, visibility)
- Add field-specific parameters if needed (use existing parameter types when possible, otherwise create new parameter types)
- Follow existing naming conventions (e.g., `FieldTypeField` for the AST node name)

### 2. Vue Component Creation (`src/cli/components/vue/base-components/`)

Create a new Vue component file (e.g., `vue-your-field.ts`):

```typescript
import * as path from 'node:path';
import * as fs from 'node:fs';
import {expandToNode, toString} from 'langium/generate';
import {Entry} from "../../../../language/generated/ast.js";

export default function generateYourFieldComponent(destination: string, entry?: Entry) {
    const generatedFileDir = path.join(destination, "system", "templates", "vue", "components");
    const generatedFilePath = path.join(generatedFileDir, `your-field.vue`);

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
    <script setup>
        import { ref, computed, inject } from "vue";

        const props = defineProps({
            label: String,
            systemPath: String,
            context: Object,
            disabled: Boolean
            editMode: Boolean,
            icon: String
        });

        const document = inject("rawDocument");

        // Your component logic here
    </script>

    <template>
        <div class="your-field">
            <!-- Your component template here -->
        </div>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
```

**Key Points:**
- Always include standard props: `label`, `systemPath`, `context`, `disabled`, `color`, and `icon`
- Use `inject("rawDocument")` to access the actor/item document
- Disable editable fields when `disabled` is true
- Scoped styles aren't supported and should go in `_isdlStyles.scss` instead
- Editable inputs should have a `name="${systemPath}"`. For complex fields with multiple subproperties, this might be `name="${systemPath}.subproperty"` instead.
- If you need more than one color, you can bind `primaryColor`, `secondaryColor`, and `teritaryColor`
- Human readable text (labels, messages, etc) need to be localized with `game.i18n.localize(<text>)` and have an entry in the localization file

### 3. Base Components Generator (`src/cli/components/vue/vue-base-components-generator.ts`)

Add import and generation call:

```typescript
import generateYourFieldComponent from "./base-components/vue-your-field.js";

export function generateBaseVueComponents(destination: string, entry?: Entry) {
    // ... existing components
    generateYourFieldComponent(destination, entry);
}
```

### 4. Vue Generator Exports (`src/cli/components/vue/vue-generator.ts`)

Add export in the `generateIndexMjs` function:

```typescript
export { default as YourField } from "./components/your-field.vue";
```

### 5. Vue Mixin Registration (`src/cli/components/vue/vue-mixin.ts`)

Add component to the `customComponents` object:

```typescript
const customComponents = {
    // ... existing components
    "i-your-field": "YourField",
};
```

### 6. Sheet Application Generator (`src/cli/components/vue/vue-sheet-application-generator.ts`)

Add import and field handling:

```typescript
// Add to imports
import { isYourNewField } from "../../../language/generated/ast.js";

// Add field handling in generateVueFieldComponent function
if (isYourNewField(element)) {
    return expandToNode`
    <i-your-field
        :context="context"
        label="${label}"
        icon="${iconParam?.value}"
        systemPath="${systemPath}"
        ${standardParamsFragment}>
    </i-your-field>
    `;
}
```

### 7. Datamodel Generation (`src/cli/components/datamodel-generator.ts`)

Add import and field handling for Foundry VTT data schema:

```typescript
// Add to imports
import { isYourNewField } from "../../language/generated/ast.js";

// Add field handling in generateField function
if (isYourNewField(property)) {
    return expandToNode`
        ${property.name.toLowerCase()}: new fields.SchemaField({
            // Define your field's data structure here
            // Example for a simple text field:
            value: new fields.StringField({initial: ""}),
            // Example for complex fields with multiple properties:
            // subfield1: new fields.NumberField({initial: 0, integer: true}),
            // subfield2: new fields.BooleanField({initial: false}),
        }),
    `;
}
```

**Key Points:**
- Use appropriate Foundry field types: `StringField`, `NumberField`, `BooleanField`, `SchemaField`, etc.
- Always provide `initial` values for fields
- Use `SchemaField` for complex fields with multiple sub-properties
- Field names should be lowercase in the datamodel
- Consider data persistence and what needs to be saved to the database
- **Note:** Read-only display fields (like `bonuses`/`resistances`) that aggregate existing data don't need datamodel entries

### 8. Localization Support (`src/cli/components/language-generator.ts`)

Add import and field handling:

```typescript
// Add to imports
import { isYourNewField } from "../../language/generated/ast.js";

// Add field handling in generateProperty function
if (isYourNewField(property)) {
    const labelParam = property.params.find(x => isLabelParam(x)) as LabelParam | undefined;
    const label = labelParam ? labelParam.value : humanize(property.name);

    return expandToNode`
        "${property.name}": "${label}"
    `;
}
```

### 9. Build and Test

After adding all components:

1. Run `npm run langium:generate` to regenerate AST types
2. Run `npm run build` to compile TypeScript
3. Test with a sample ISDL file containing your new field
4. Verify the generated Vue component renders correctly

### Common Patterns

**Data Binding:**
- Use `props.context.object.system[systemPath]` to access field data
- Use `document.system` when accessing via inject
- Always handle cases where data might be undefined

**AST Integration:**
- Pass `entry` parameter to access AST data at build time
- Use utility functions like `globalGetAllOfType` and `getAllOfType` for AST traversal
- Extract configuration from AST during generation, not runtime

**Field Parameters:**
- Standard parameters: `label`, `icon`, `color`, `visibility`
- Access via `element.params.find(isParamType) as ParamType`
- Always provide fallback values

**Component Styling:**
- Use Vuetify components and design system
- Follow existing component patterns for consistency
- Use scoped styles to prevent conflicts

### Example: Recent Implementation

The `bonuses` and `resistances` fields demonstrate this pattern:

1. **Grammar:** Added to `ComplexFields` with `StandardFieldParamsFrag`
2. **Components:** Created focused Vue components with AST-based damage type extraction
3. **Integration:** Added to all required generators and systems
4. **Theming:** Used consistent color schemes (green for bonuses, blue for resistances)

This approach ensures new field types integrate seamlessly with the existing ISDL ecosystem.
