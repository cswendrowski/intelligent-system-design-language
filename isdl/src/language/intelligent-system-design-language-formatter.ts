import type { AstNode } from 'langium';
import { AbstractFormatter, Formatting } from 'langium/lsp';
import {
    isActor, isItem, isKeywords, isLayout, isMethodBlock, isMethodContainer,
    isMoneyField, isConfig, isChatBlock, isPrompt,
    isAttributeParamMod, isAttributeRollParam
} from './generated/ast.js';

export class IsdlFormatter extends AbstractFormatter {

    protected format(node: AstNode): void {
        if (isConfig(node)) {
            this.applyBraceFormatting(node);
        } else if (isKeywords(node)) {
            this.applyBraceFormatting(node);
        } else if (isActor(node)) {
            this.formatWithBlankLine(node, 'actor');
        } else if (isItem(node)) {
            this.formatWithBlankLine(node, 'item');
        } else if (isLayout(node)) {
            this.formatWithBlankLine(node, node.$type.toLowerCase());
        } else if (isMethodContainer(node)) {
            const keywords: Record<string, string> = { Action: 'action', HookHandler: 'on', FunctionDefinition: 'function' };
            this.formatWithBlankLine(node, keywords[node.$type]);
        } else if (isMethodBlock(node)) {
            if (isAttributeParamMod(node.$container) || isAttributeRollParam(node.$container)) {
                this.applyParamBraceFormatting(node);
            } else {
                this.applyBraceFormatting(node);
            }
        } else if (isChatBlock(node)) {
            this.applyBraceFormatting(node);
        } else if (isPrompt(node)) {
            this.applyBraceFormatting(node);
        } else if (isMoneyField(node)) {
            this.formatMoneyField(node);
        } else if (isAttributeParamMod(node)) {
            this.getNodeFormatter(node).keyword('mod:').prepend(Formatting.indent());
        } else if (isAttributeRollParam(node)) {
            this.getNodeFormatter(node).keyword('roll:').prepend(Formatting.indent());
        }
    }

    /** Block that gets a blank line before it */
    private formatWithBlankLine(node: AstNode, keyword: string): void {
        const formatter = this.getNodeFormatter(node);
        formatter.keyword(keyword).prepend(Formatting.newLines(2, { allowMore: true }));
        this.applyBraceFormatting(node);
    }

    /** MoneyField has an optional denomination block */
    private formatMoneyField(node: AstNode): void {
        const formatter = this.getNodeFormatter(node);
        const openBrace = formatter.keyword('{');
        if (openBrace.nodes.length > 0) {
            this.applyBraceFormatting(node);
        }
    }

    /**
     * Brace formatting for MethodBlocks inside attribute params (mod:/roll:).
     * Uses +2 tabs for the interior so the body is deeper than the param keyword,
     * which itself already used Formatting.indent() (+1) to get onto its own line.
     */
    private applyParamBraceFormatting(node: AstNode): void {
        const formatter = this.getNodeFormatter(node);
        const openBrace = formatter.keyword('{');
        const closeBrace = formatter.keyword('}');
        openBrace.prepend(Formatting.oneSpace());
        formatter.interior(openBrace, closeBrace).prepend({ options: {}, moves: [{ tabs: 2, lines: 1 }] });
        closeBrace.prepend(Formatting.indent());
    }

    /** Core brace formatting: space before `{`, indent interior, `}` on new line */
    private applyBraceFormatting(node: AstNode): void {
        const formatter = this.getNodeFormatter(node);
        const openBrace = formatter.keyword('{');
        const closeBrace = formatter.keyword('}');

        openBrace.prepend(Formatting.oneSpace());
        formatter.interior(openBrace, closeBrace).prepend(Formatting.indent());
        closeBrace.prepend(Formatting.newLine());
    }
}
