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
```

Only build the project, do not attempt to do test generations as this consumes too many tokens.

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
        <base-vuetify-field class="your-field">
            <!-- Your component template here -->
        </base-vuetify-field>
    </template>
    `.appendNewLine();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
```

**Key Points:**
- Always include standard props: `label`, `systemPath`, `context`, `disabled`, `color`, and `icon`
- Use `inject("rawDocument")` to access the actor/item document
- The base component shouldn't handle visibility, use `v-if` on the sheet generation when rendering the component, and pass in `disabled` as a prop for disabling inputs
- Disable editable fields when `disabled` is true
- Scoped styles aren't supported and should go in `_isdlStyles.scss` instead
- All fields should be applied with either the single-wide field (most common) or double-wide if it needs extra space
- Style classes should use the .isdl-fieldname as a scope in SCSS, and focus on being compact
- Editable inputs should have a `name="${systemPath}"`. For complex fields with multiple subproperties, this might be `name="${systemPath}.subproperty"` instead.
- If you need more than one color, you can bind `secondaryColor`, and `teritaryColor`
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

## Updating the Wiki

The ISDL project maintains comprehensive documentation in a GitHub wiki located at `F:\Programming\Git\intelligent-system-design-language.wiki`. When adding new features or making significant changes, the wiki should be updated to help users understand and use the new functionality.

### Wiki Structure

The wiki uses the following organization:

```
intelligent-system-design-language.wiki/
├── Home.md                     # Main landing page with overview
├── _Sidebar.md                 # Navigation sidebar
├── Getting-Started.md          # Installation and setup
├── Your-first-System.md       # Tutorial
├── Config.md                   # System configuration  
├── Document.md                 # Actors and items
├── Fields.md                   # Field types reference
├── Keywords-and-Journals.md    # Keywords and auto-documentation
├── Basic-Logic.md             # Programming basics
├── Advanced-Logic.md          # Complex programming
├── Interactivity.md           # User interaction
├── Recipes.md                 # Common patterns
├── Keywords-Quick-Reference.md # Developer cheat sheet
├── Logic-Reference.md         # Complete syntax reference
└── GitHub-Integration.md      # Publishing and sharing
```

### Adding New Documentation

When adding major features like keywords, status effects, or new field types:

1. **Create comprehensive documentation** in a new `.md` file
2. **Update the sidebar** (`_Sidebar.md`) to include the new page
3. **Update the home page** (`Home.md`) to mention the new functionality
4. **Create quick reference** if the feature has complex syntax
5. **Link from related pages** to maintain cross-references

### Documentation Best Practices

#### Content Structure
- Start with a clear overview and purpose
- Include practical code examples with explanations
- Document all parameters and options
- Provide visual examples or generated output when possible
- Include troubleshooting and common issues
- End with best practices and tips

#### Code Examples
```isdl
// Always include complete, working examples
config MySystem {
    keywords {
        Advantage summary: "Roll twice, take higher" color: "#38a169"
    }
}

actor Character {
    status Blessed when: self.Faith > 5 img: "icons/svg/holy-symbol.svg"
}
```

#### Cross-References
- Link to related concepts: `[Fields](Fields)`, `[Basic Logic](Basic-Logic)`
- Reference implementation details when helpful
- Connect features to their practical applications

### Quick Reference Pages

For complex features with lots of syntax, create companion quick reference pages:

- **Syntax tables** - Quick lookup of parameters and options
- **Code snippets** - Copy-paste examples for common use cases  
- **Visual guides** - Show generated output or UI elements
- **Best practices** - Do's and don'ts in checklist format

### Updating Existing Pages

When features interact with existing functionality:

1. **Update Home.md** - Add to key features list if significant
2. **Update field documentation** - If new field types are added
3. **Update logic references** - If new functions or operations are added
4. **Cross-link pages** - Ensure related concepts are connected

### Example: Keywords Documentation

The keywords feature required:

1. **New comprehensive page**: `Keywords-and-Journals.md` with full feature documentation
2. **New quick reference**: `Keywords-Quick-Reference.md` with syntax tables and examples
3. **Home page updates**: Added to key features and core concepts
4. **Sidebar updates**: Added to both Core Concepts and Quick Reference sections
5. **Cross-references**: Links from Fields.md and other related pages

This ensures users can discover, learn, and effectively use the new functionality through multiple pathways in the documentation.
