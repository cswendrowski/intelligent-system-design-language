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
