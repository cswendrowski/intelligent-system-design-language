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

        // Missing comma in a choices list. Writing `choices: ["A" "B"]` (two STRING tokens in a
        // row) means the user forgot the comma between items. Chevrotain expected `,` or `]`.
        if (previous?.tokenType?.name === 'STRING' && actual?.tokenType?.name === 'STRING') {
            return `Missing comma between items — expected ',' before ${actual.image}.`;
        }

        // Quoted dice in a die/dice `choices:` list. Writing `choices: ["d4", "d6"]` is a natural
        // guess -- `choice<string>` lists really are quoted -- but dice sizes are bare tokens, so
        // the STRING never matches DICE and the list fails to parse. Keyed on a STRING that looks
        // like a die appearing where a list item belongs, so it can't fire on ordinary text choices.
        if (actual?.tokenType?.name === 'STRING' && this.looksLikeQuotedDie(actual.image)
            && (previous?.image === '[' || previous?.image === ',')) {
            const bare = actual.image.slice(1, -1);
            return `Dice sizes are written without quotes — use \`${bare}\` instead of ${actual.image}. `
                + `(Quoted lists are for \`choice<string>\` fields; \`die\` and \`dice\` take bare sizes like \`d4\`, \`2d6\`, or \`d6x\`.)`;
        }

        // Extension point for further plain-English rewrites. Add a detector here (keyed
        // conservatively on expected/previous/actual tokens or ruleName) when a recurring confusing
        // error is identified; unrecognized cases fall back to the default Langium message.
        //
        // Rule names carry a trailing zero-width space (U+200B) -- strip non-letters before comparing:
        //   const ruleName = (rawRuleName ?? '').replace(/[^A-Za-z]/g, '');
        return undefined;
    }

    /** Matches a STRING token whose contents are a dice size: "d4", "2d6", "d6x". */
    private looksLikeQuotedDie(image: string | undefined): boolean {
        if (!image || image.length < 3) return false;
        const quote = image[0];
        if ((quote !== '"' && quote !== "'") || image[image.length - 1] !== quote) return false;
        return /^\d*d\d+\w*$/.test(image.slice(1, -1));
    }
}
