import type { AstNode } from 'langium';
import { AbstractFormatter, Formatting } from 'langium/lsp';
import {
    isAction, isActor, isFunctionDefinition, isHookHandler,
    isItem, isKeywords, isLayout, isMethodBlock, isMoneyField,
    isConfig, isChatBlock, isPrompt
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
        } else if (isAction(node)) {
            this.formatWithBlankLine(node, 'action');
        } else if (isFunctionDefinition(node)) {
            this.formatWithBlankLine(node, 'function');
        } else if (isHookHandler(node)) {
            this.formatWithBlankLine(node, 'on');
        } else if (isMethodBlock(node)) {
            this.applyBraceFormatting(node);
        } else if (isChatBlock(node)) {
            this.applyBraceFormatting(node);
        } else if (isPrompt(node)) {
            this.applyBraceFormatting(node);
        } else if (isMoneyField(node)) {
            this.formatMoneyField(node);
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
