import { Cancellation, DefaultDocumentValidator, DocumentValidator } from 'langium';
import type { LangiumDocument, ValidationOptions } from 'langium';
import type { Diagnostic } from 'vscode-languageserver-types';

/**
 * When a document has syntax (lexing/parsing) errors, the parser's error recovery produces a
 * cascade of downstream parser, linking, and validation diagnostics that bury the real problem
 * (a single typo can yield dozens of misleading errors). In that case we surface only the first
 * few syntax errors so the root cause is obvious to the user.
 *
 * Documents that parse cleanly are completely unaffected -- their linking and validation
 * diagnostics (e.g. "referenced field does not exist") are reported as usual.
 */
const MAX_SYNTAX_ERRORS = 1;

export class IsdlDocumentValidator extends DefaultDocumentValidator {
    override async validateDocument(
        document: LangiumDocument,
        options: ValidationOptions = {},
        cancelToken?: Cancellation.CancellationToken
    ): Promise<Diagnostic[]> {
        const diagnostics = await super.validateDocument(document, options, cancelToken);

        const syntaxErrors = diagnostics.filter(d => {
            const code = (d.data as { code?: string } | undefined)?.code;
            return code === DocumentValidator.ParsingError || code === DocumentValidator.LexingError;
        });

        // No syntax errors -> behave exactly like the default validator.
        if (syntaxErrors.length === 0) {
            return diagnostics;
        }

        // Syntax errors present -> the AST is unreliable, so drop the recovery cascade and the
        // bogus linking/validation diagnostics, surfacing only the root syntax error(s).
        return syntaxErrors.slice(0, MAX_SYNTAX_ERRORS);
    }
}
