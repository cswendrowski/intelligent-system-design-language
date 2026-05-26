import * as vscode from 'vscode';
import { CodeAction } from 'vscode';

export class IntelligentSystemDesignLanguageQuickfixes implements vscode.CodeActionProvider {

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.range) {
                switch (diagnostic.code) {
                    case 'tracker-segments-unnecessary':
                        this.trackerSegmentsUnnecessary(document, diagnostic, actions);
                        break;
                    default:
                        // Handle other diagnostics if needed
                        break;
                }
            }
        }

        return actions;
    }

    private trackerSegmentsUnnecessary(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, actions: vscode.CodeAction[]) {
        const text = document.getText();
        const endOffset = document.offsetAt(diagnostic.range.end);

        // Look ahead for trailing comma and whitespace
        const after = text.slice(endOffset);
        const commaMatch = after.match(/^([\s,]+)/);
        const fullEnd = commaMatch
            ? document.positionAt(endOffset + commaMatch[0].length)
            : diagnostic.range.end;

        const fullRange = new vscode.Range(diagnostic.range.start, fullEnd);

        const fix = new vscode.CodeAction(
            "Remove unnecessary `segments` parameter",
            vscode.CodeActionKind.QuickFix
        );
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;
        fix.edit = new vscode.WorkspaceEdit();
        fix.edit.replace(document.uri, fullRange, '');
        actions.push(fix);
    }

}
