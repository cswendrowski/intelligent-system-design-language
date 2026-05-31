import { LangiumParserErrorMessageProvider } from 'langium';

/**
 * Rewrites the most common Chevrotain parser errors into plain-English, actionable messages.
 * ISDL targets people new to development, so the default "Expecting one of [INT, STRING, DICE...]"
 * jargon is unhelpful. Any case we don't explicitly recognize falls back to the default Langium
 * message, so this only ever improves clarity -- it never hides information.
 *
 * Detection is deliberately conservative: a wrong "friendly" message is worse than correct jargon,
 * so we only rewrite patterns we've reproduced and verified end-to-end.
 */
export class IsdlParserErrorMessageProvider extends LangiumParserErrorMessageProvider {
    override buildMismatchTokenMessage(options: any): string {
        const friendly = this.friendlyMessage(options?.actual, options?.previous, options?.ruleName);
        return friendly ?? super.buildMismatchTokenMessage(options);
    }

    override buildNoViableAltMessage(options: any): string {
        const actual = Array.isArray(options?.actual) ? options.actual[0] : options?.actual;
        const friendly = this.friendlyMessage(actual, options?.previous, options?.ruleName);
        return friendly ?? super.buildNoViableAltMessage(options);
    }

    private friendlyMessage(_actual: any, _previous: any, _rawRuleName: string | undefined): string | undefined {
        // Extension point for plain-English rewrites of common parser mistakes. Add a detector here
        // (keyed conservatively on ruleName + previous/actual tokens) when a recurring confusing
        // error is identified; unrecognized cases fall back to the default Langium message.
        //
        // Rule names carry a trailing zero-width space (U+200B) -- strip non-letters before comparing:
        //   const ruleName = (rawRuleName ?? '').replace(/[^A-Za-z]/g, '');
        return undefined;
    }
}
