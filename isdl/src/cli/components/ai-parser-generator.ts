import { Entry, Document, isItem, ClassExpression } from '../../language/generated/ast.js';
import { CompositeGeneratorNode, expandToNode, joinToNode, toString } from 'langium/generate';
import { getAllOfType } from './utils.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Generate AI text parser service for Foundry VTT systems
 */
export function generateAIParserService(entry: Entry, destination: string) {
    const generatedFileDir = path.join(destination, "system", "services");
    const generatedFilePath = path.join(generatedFileDir, "ai-parser.mjs");

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const itemDocuments = entry.documents.filter(isItem);

    function generateFieldSchema(document: Document): CompositeGeneratorNode {
        const fields = getAllOfType<ClassExpression>(document.body, (node): node is ClassExpression => {
            return 'name' in node && '$type' in node && typeof (node as any).name === 'string';
        });

        return expandToNode`
            "${document.name}": {
                type: "${document.name.toLowerCase()}",
                fields: {
                    ${joinToNode(fields, field => `"${(field as any).name}": "${field.$type}"`, {separator: ',\n                    '})}
                }
            }
        `;
    }

    const fileNode = expandToNode`
        /**
         * AI Text Parser Service for ${entry.config.name}
         * Extracts structured item data from text using AI or fallback parsing
         */
        export class AITextParser {
            constructor() {
                this.apiKey = null;
                this.apiEndpoint = 'https://api.anthropic.com/v1/messages';
                this.schema = null;
                this._initialized = false;
            }

            /**
             * Initialize settings - called when game is ready
             */
            _initialize() {
                if (this._initialized) return;
                
                try {
                    this.apiKey = game.settings.get(game.system.id, 'aiParserApiKey') || null;
                    this.apiEndpoint = game.settings.get(game.system.id, 'aiParserEndpoint') || 'https://api.anthropic.com/v1/messages';
                    this.schema = this._buildSchema();
                    this._initialized = true;
                } catch (error) {
                    console.warn('AI Parser initialization failed:', error);
                    // Use defaults
                    this.apiKey = null;
                    this.apiEndpoint = 'https://api.anthropic.com/v1/messages';
                    this.schema = this._buildSchema();
                    this._initialized = true;
                }
            }

            /**
             * Parse text content and extract items
             * @param {string} text - The text content to parse
             * @param {string|null} targetType - Optional target item type to focus on
             * @returns {Promise<Object>} Parsed results
             */
            async parseText(text, targetType = null) {
                // Ensure initialization
                this._initialize();

                if (!text || !text.trim()) {
                    return {
                        items: [],
                        confidence: 0,
                        warnings: ['No text provided']
                    };
                }

                try {
                    if (this.apiKey && this._isValidApiKey()) {
                        return await this._parseWithAI(text, targetType);
                    } else {
                        ui.notifications.info("AI API key not configured, using fallback parser");
                        return this._fallbackParsing(text, targetType);
                    }
                } catch (error) {
                    console.warn('AI parsing failed:', error);
                    ui.notifications.warn("AI parsing failed, using fallback parser");
                    return this._fallbackParsing(text, targetType);
                }
            }

            /**
             * Create Foundry items from parsed data
             * @param {Array} parsedItems - Items from parseText()
             * @param {Object} options - Creation options
             * @returns {Promise<Array>} Created item documents
             */
            async createItemsFromParsed(parsedItems, options = {}) {
                // Ensure initialization
                this._initialize();

                const createdItems = [];
                const folder = options.folder || null;

                for (const parsedItem of parsedItems) {
                    try {
                        const itemData = this._convertToFoundryData(parsedItem);
                        if (folder) itemData.folder = folder.id;
                        
                        const item = await Item.create(itemData);
                        createdItems.push(item);
                    } catch (error) {
                        console.error('Failed to create item:', parsedItem.name, error);
                        ui.notifications.error(\`Failed to create item: \${parsedItem.name}\`);
                    }
                }

                if (createdItems.length > 0) {
                    ui.notifications.info(\`Created \${createdItems.length} item(s) from parsed text\`);
                }

                return createdItems;
            }

            /**
             * Build item type schema for AI prompts
             */
            _buildSchema() {
                return {
                    ${joinToNode(itemDocuments, generateFieldSchema, {separator: ',\n                    '})}
                };
            }

            /**
             * Parse text using AI API
             */
            async _parseWithAI(text, targetType) {
                const prompt = this._buildAIPrompt(text, targetType);
                const response = await this._callAIAPI(prompt);
                return this._processAIResponse(response);
            }

            /**
             * Build AI prompt for parsing
             */
            _buildAIPrompt(text, targetType) {
                const schemaInfo = targetType && this.schema[targetType] ?
                    \`Focus on extracting "\${targetType}" type items with fields: \${Object.keys(this.schema[targetType].fields).join(', ')}\` :
                    \`Available item types: \${Object.keys(this.schema).join(', ')}\`;

                return \`You are an expert at extracting structured RPG item data from text descriptions.

\${schemaInfo}

Extract items from the following text and return them as JSON in this exact format:

{
  "items": [
    {
      "name": "Item Name",
      "type": "ItemTypeName", 
      "fields": {
        "fieldName": "field value",
        "anotherField": 123
      },
      "confidence": 0.95
    }
  ],
  "confidence": 0.85,
  "warnings": ["Any issues or assumptions made"]
}

Rules:
- Only extract items that clearly match available types
- Confidence should be 0.0-1.0 (1.0 = completely certain)
- Match field names exactly to the schema
- Convert values to appropriate types (strings, numbers, booleans)
- Include warnings for assumptions made
- Focus on clear, identifiable items only

Text to parse:
\${text}\`;
            }

            /**
             * Call AI API
             */
            async _callAIAPI(prompt) {
                const response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${this.apiKey}\`,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-sonnet-20240229',
                        max_tokens: 3000,
                        messages: [{
                            role: 'user',
                            content: prompt
                        }]
                    })
                });

                if (!response.ok) {
                    throw new Error(\`API request failed: \${response.status} \${response.statusText}\`);
                }

                const data = await response.json();
                return data.content[0].text;
            }

            /**
             * Process AI response
             */
            _processAIResponse(response) {
                const parsed = JSON.parse(response);
                
                // Validate structure
                if (!parsed.items || !Array.isArray(parsed.items)) {
                    return {
                        items: [],
                        confidence: 0,
                        warnings: ['Invalid AI response structure']
                    };
                }

                // Filter valid items
                const validItems = parsed.items.filter(item => {
                    return item.name && 
                           item.type && 
                           this.schema[item.type] &&
                           typeof item.confidence === 'number';
                });

                return {
                    items: validItems,
                    confidence: parsed.confidence || 0.5,
                    warnings: parsed.warnings || []
                };
            }

            /**
             * Fallback parsing when AI is not available
             */
            _fallbackParsing(text, targetType) {
                const lines = text.split('\\n').filter(line => line.trim());
                const items = [];
                
                const availableTypes = Object.keys(this.schema);
                const defaultType = targetType || availableTypes[0];

                if (!defaultType) {
                    return {
                        items: [],
                        confidence: 0,
                        warnings: ['No item types available']
                    };
                }

                let currentItem = null;

                for (const line of lines) {
                    const trimmed = line.trim();
                    
                    // Detect potential item names (lines that look like titles)
                    if (this._looksLikeItemName(trimmed)) {
                        // Save previous item
                        if (currentItem) {
                            items.push(currentItem);
                        }
                        
                        // Start new item
                        currentItem = {
                            name: trimmed.replace(/[:.]\s*$/, '').trim(),
                            type: defaultType,
                            fields: {},
                            confidence: 0.6
                        };
                    } else if (currentItem && trimmed) {
                        // Add content as description
                        if (!currentItem.fields.description) {
                            currentItem.fields.description = trimmed;
                        } else {
                            currentItem.fields.description += '\\n' + trimmed;
                        }
                    }
                }

                // Add final item
                if (currentItem) {
                    items.push(currentItem);
                }

                return {
                    items,
                    confidence: 0.6,
                    warnings: ['Used fallback parsing - results may be less accurate']
                };
            }

            /**
             * Check if a line looks like an item name
             */
            _looksLikeItemName(text) {
                // Heuristics for identifying item names
                return /^[A-Z][^.]*[:.]\s*$/.test(text) || // "Item Name:" or "Item Name."
                       /^[A-Z\s]{2,50}$/i.test(text) ||    // "ITEM NAME" or short all-caps
                       /^[A-Z][a-z\s]{1,30}$/.test(text);  // "Item Name" title case
            }

            /**
             * Convert parsed item to Foundry item data
             */
            _convertToFoundryData(parsedItem) {
                const itemData = {
                    name: parsedItem.name,
                    type: parsedItem.type.toLowerCase(),
                    system: {}
                };

                // Map fields to system data
                for (const [fieldName, value] of Object.entries(parsedItem.fields)) {
                    itemData.system[fieldName.toLowerCase()] = value;
                }

                return itemData;
            }

            /**
             * Check if API key looks valid
             */
            _isValidApiKey() {
                return this.apiKey && 
                       typeof this.apiKey === 'string' && 
                       this.apiKey.length > 10;
            }
        }

        // Export singleton instance
        export const aiTextParser = new AITextParser();
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}

/**
 * Generate AI parser settings for system configuration
 */
export function generateAIParserSettings(entry: Entry, destination: string) {
    const generatedFileDir = path.join(destination, "system", "settings");
    const generatedFilePath = path.join(generatedFileDir, "ai-parser-settings.mjs");

    if (!fs.existsSync(generatedFileDir)) {
        fs.mkdirSync(generatedFileDir, {recursive: true});
    }

    const fileNode = expandToNode`
        /**
         * Register AI Parser settings
         */
        export function registerAIParserSettings() {
            game.settings.register(game.system.id, 'aiParserApiKey', {
                name: 'AI Parser API Key',
                hint: 'API key for AI text parsing service (e.g., Anthropic Claude). Leave empty to use fallback parsing.',
                scope: 'world',
                config: true,
                type: String,
                default: '',
                onChange: () => {
                    // Update parser instance with new key
                    if (game.system.aiTextParser) {
                        game.system.aiTextParser.apiKey = game.settings.get(game.system.id, 'aiParserApiKey');
                    }
                }
            });

            game.settings.register(game.system.id, 'aiParserEndpoint', {
                name: 'AI Parser API Endpoint',
                hint: 'API endpoint for AI parsing service. Only change if using a different provider.',
                scope: 'world',
                config: true,
                type: String,
                default: 'https://api.anthropic.com/v1/messages'
            });

            game.settings.register(game.system.id, 'aiParserAutoCreate', {
                name: 'Auto-Create Items',
                hint: 'Automatically create items in Foundry after successful parsing (otherwise just preview).',
                scope: 'world',
                config: true,
                type: Boolean,
                default: false
            });
        }
    `.appendNewLineIfNotEmpty();

    fs.writeFileSync(generatedFilePath, toString(fileNode));
}
