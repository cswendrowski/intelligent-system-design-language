import { Entry } from '../../language/generated/ast.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Generate AI Parser localization entries
 */
export function generateAIParserLocalization(entry: Entry, destination: string) {
    const localizationFileDir = path.join(destination, "system", "lang");
    const localizationFilePath = path.join(localizationFileDir, "en.json");

    if (!fs.existsSync(localizationFileDir)) {
        fs.mkdirSync(localizationFileDir, {recursive: true});
    }

    // Read existing localization
    let existingData = {};
    if (fs.existsSync(localizationFilePath)) {
        try {
            existingData = JSON.parse(fs.readFileSync(localizationFilePath, 'utf8'));
        } catch (error) {
            console.warn('Could not read existing localization file:', error);
        }
    }

    // Add AI Parser entries
    const aiParserEntries = {
        "AI_PARSER": {
            "OpenParser": "Open AI Text Parser",
            "ParseText": "Parse Text with AI",
            "ProcessingText": "Processing text with AI...",
            "ParsingComplete": "Text parsing complete",
            "NoItemsFound": "No items found in the provided text",
            "ItemsCreated": "Created {count} item(s) from parsed text",
            "APIKeyRequired": "AI API key required for enhanced parsing",
            "FallbackUsed": "Using fallback parser - results may be less accurate"
        }
    };

    // Merge with existing data
    const mergedData = { ...existingData, ...aiParserEntries };

    // Write back to file
    fs.writeFileSync(localizationFilePath, JSON.stringify(mergedData, null, 2));
}