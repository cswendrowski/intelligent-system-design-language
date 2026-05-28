import type { AstNode } from 'langium';
import { AbstractFormatter, Formatting } from 'langium/lsp';
import {
    isAction, isActor, isColumn, isFunctionDefinition, isHookHandler,
    isItem, isKeywords, isMethodBlock, isMoneyField, isPage, isRow, isSection,
    isTab, isConfig, isChatBlock, isPrompt
} from './generated/ast.js';

export class IsdlFormatter extends AbstractFormatter {

    protected format(node: AstNode): void {
        if (isConfig(node)) {
            this.formatNamedBlock(node, 'config');
        } else if (isKeywords(node)) {
            this.formatKeywords(node);
        } else if (isActor(node)) {
            this.formatDocumentNode(node, 'actor');
        } else if (isItem(node)) {
            this.formatDocumentNode(node, 'item');
        } else if (isSection(node)) {
            this.formatSection(node);
        } else if (isRow(node)) {
            this.formatAnonymousBlock(node, 'row');
        } else if (isColumn(node)) {
            this.formatAnonymousBlock(node, 'column');
        } else if (isPage(node)) {
            this.formatNamedBlock(node, 'page');
        } else if (isTab(node)) {
            this.formatNamedBlock(node, 'tab');
        } else if (isAction(node) || isFunctionDefinition(node) || isHookHandler(node)) {
            this.formatBraceBlock(node);
        } else if (isMethodBlock(node)) {
            this.formatBraceBlock(node);
        } else if (isChatBlock(node)) {
            this.formatBraceBlock(node);
        } else if (isPrompt(node)) {
            this.formatBraceBlock(node);
        } else if (isMoneyField(node)) {
            this.formatMoneyField(node);
        }
    }

    /** Top-level actor/item: ensure blank line before, then format braces */
    private formatDocumentNode(node: AstNode, keyword: string): void {
        const formatter = this.getNodeFormatter(node);
        formatter.keyword(keyword).prepend(Formatting.newLines(2, { allowMore: true }));
        this.applyBraceFormatting(node);
    }

    /** Section: blank line before, then standard brace formatting */
    private formatSection(node: AstNode): void {
        const formatter = this.getNodeFormatter(node);
        formatter.keyword('section').prepend(Formatting.newLines(2, { allowMore: true }));
        this.applyBraceFormatting(node);
    }

    /** Named block like config, page, tab: space before `{`, indent interior */
    private formatNamedBlock(node: AstNode, _keyword: string): void {
        this.applyBraceFormatting(node);
    }

    /** Anonymous block like row, column: space before `{`, indent interior */
    private formatAnonymousBlock(node: AstNode, _keyword: string): void {
        this.applyBraceFormatting(node);
    }

    /** keywords block has no name, just `keywords { ... }` */
    private formatKeywords(node: AstNode): void {
        this.applyBraceFormatting(node);
    }

    /** Action, HookHandler, FunctionDefinition, MethodBlock */
    private formatBraceBlock(node: AstNode): void {
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
