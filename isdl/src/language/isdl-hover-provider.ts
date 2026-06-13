import type { AstNode } from 'langium';
import type { Hover, HoverParams } from 'vscode-languageserver';
import type { LangiumDocument } from 'langium';
import type { MaybePromise } from 'langium';
import type { HoverProvider } from 'langium/lsp';
import { CstUtils } from 'langium';
import { TYPE_DOCS, docMarkdown } from './isdl-docs.js';

export class IsdlHoverProvider implements HoverProvider {

    getHoverContent(document: LangiumDocument, params: HoverParams): MaybePromise<Hover | undefined> {
        const rootCst = document.parseResult?.value?.$cstNode;
        if (!rootCst) return undefined;

        const offset = document.textDocument.offsetAt(params.position);
        const leaf = CstUtils.findLeafNodeAtOffset(rootCst, offset);
        if (!leaf) return undefined;

        // Walk up the AST container chain until we find a type with docs
        let node: AstNode | undefined = leaf.astNode;
        while (node) {
            const doc = TYPE_DOCS[node.$type];
            if (doc) {
                // Summary + a deep link to the wiki page that explains this construct.
                return { contents: { kind: 'markdown', value: docMarkdown(doc) } };
            }
            node = node.$container;
        }

        return undefined;
    }
}

