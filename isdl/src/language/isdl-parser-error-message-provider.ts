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
        const friendly = this.friendlyMessage(options?.expected, options?.actual, options?.previous, options?.ruleName);
        return friendly ?? super.buildMismatchTokenMessage(options);
    }

    override buildNoViableAltMessage(options: any): string {
        const actual = Array.isArray(options?.actual) ? options.actual[0] : options?.actual;
        const friendly = this.friendlyMessage(undefined, actual, options?.previous, options?.ruleName);
        return friendly ?? super.buildNoViableAltMessage(options);
    }

    private friendlyMessage(expected: any, actual: any, previous: any, _rawRuleName: string | undefined): string | undefined {
        // Spaces in a name. Writing `section Physical Attributes {` (or `actor My Hero {`, etc.)
        // parses the first word as the name, then expects the body's `{` but hits the second word.
        // The default "Expecting token of type '{' but found `Attributes`" is opaque to newcomers.
        // Detect conservatively: the parser wanted `{` and got an identifier where the name should
        // have ended. The two adjacent words are the likely intended single-word name.
        if (expected?.name === '{' && actual?.tokenType?.name === 'ID') {
            const combined = `${previous?.image ?? ''}${actual.image}`;
            const suggestion = previous?.tokenType?.name === 'ID' && previous?.image ? `, e.g. \`${combined}\`` : '';
            return `Expected '{' to open the body, but found \`${actual.image}\`. `
                + `This usually means a name has a space in it — names must be a single word `
                + `(letters, numbers, and underscores only)${suggestion}.`;
        }

        // Extension point for further plain-English rewrites. Add a detector here (keyed
        // conservatively on expected/previous/actual tokens or ruleName) when a recurring confusing
        // error is identified; unrecognized cases fall back to the default Langium message.
        //
        // Rule names carry a trailing zero-width space (U+200B) -- strip non-letters before comparing:
        //   const ruleName = (rawRuleName ?? '').replace(/[^A-Za-z]/g, '');
        return undefined;
    }
}
