import type { MaybePromise, GrammarAST } from 'langium';
import type { CompletionAcceptor, CompletionContext } from 'langium/lsp';
import { DefaultCompletionProvider } from 'langium/lsp';
import { CompletionItemKind, MarkupKind } from 'vscode-languageserver';
import { KEYWORD_DOCS, docMarkdown } from './isdl-docs.js';

/**
 * Enriches keyword completions with inline documentation and a deep link to the wiki.
 *
 * Langium's default keyword completion emits a bare label with `detail: 'Keyword'` and no
 * documentation. For a DSL aimed at non-developers, the completion list is the most natural
 * place to *discover while doing* — so for every ISDL keyword we recognise, we attach the
 * same markdown summary the hover shows (including the "Open the docs →" link) and a category
 * detail. Unknown keywords fall through to the default behaviour unchanged.
 */
export class IsdlCompletionProvider extends DefaultCompletionProvider {

    protected override completionForKeyword(
        context: CompletionContext,
        keyword: GrammarAST.Keyword,
        acceptor: CompletionAcceptor
    ): MaybePromise<void> {
        if (!this.filterKeyword(context, keyword)) {
            return;
        }

        const doc = KEYWORD_DOCS[keyword.value];
        acceptor(context, {
            label: keyword.value,
            kind: CompletionItemKind.Keyword,
            detail: doc?.detail ?? 'Keyword',
            documentation: doc
                ? { kind: MarkupKind.Markdown, value: docMarkdown(doc) }
                : undefined,
            // Documented keywords sort just above bare ones so the things we can explain surface first.
            sortText: doc ? '0' : '1',
        });
    }
}
