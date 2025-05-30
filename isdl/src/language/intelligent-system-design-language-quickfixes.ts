
import * as vscode from 'vscode';
import { CodeAction } from 'vscode';
import { ExpectDiagnosticData } from 'langium/test';

export class IntelligentSystemDesignLanguageQuickfixes implements vscode.CodeActionProvider {

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (diagnostic.range) {
                switch (diagnostic.code) {
                    case 'tracker-segments-unnecessary':
                        this.trackerSegmentsUnnecessary(document, diagnostic, actions);
                        break;
                    case 'pips-deprecated':
                        this.pipsDeprecated(document, diagnostic, actions);
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

    private pipsDeprecated(document: vscode.TextDocument, diagnostic: vscode.Diagnostic, actions: vscode.CodeAction[]) {

        const fix = new vscode.CodeAction(
            "Replace with Tracker",
            vscode.CodeActionKind.QuickFix
        );
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;
        fix.edit = new vscode.WorkspaceEdit();

        const diagnosticData = diagnostic as ExpectDiagnosticData;
        const data = diagnosticData.data as { name: string, style: string, min: string, value: string, initial: string, max: string };
        let tracker = `tracker ${data.name}`;

        const hasParams = data.min || data.value || data.initial || data.max || data.style;

        let hasPreviousParam = false;
        if (hasParams) {
            tracker += `(`;
            if (data.style) {
                if (hasPreviousParam) {
                    tracker += `, `;
                }
                tracker += `style: icons, `;
    
                if (data.style === 'squares') {
                    tracker += `icon: 'fa-square'`;
                }
                else if (data.style === 'circles') {
                    tracker += `icon: 'fa-circle'`;
                }
                hasPreviousParam = true;
            }

            if (data.min) {
                if (hasPreviousParam) {
                    tracker += `, `;
                }
                tracker += `${data.min}`;
                hasPreviousParam = true;
            }

            if (data.value) {
                if (hasPreviousParam) {
                    tracker += `, `;
                }
                tracker += `${data.value}`;
                hasPreviousParam = true;
            }

            if (data.initial) {
                if (hasPreviousParam) {
                    tracker += `,`;
                }
                tracker += `initial: ${data.initial}`;
                hasPreviousParam = true;
            }

            if (data.max) {
                if (hasPreviousParam) {
                    tracker += `, `;
                }
                tracker += `${data.max}`;
                hasPreviousParam = true;
            }

            tracker += `)`;
        }

        fix.edit.replace(document.uri, diagnostic.range, tracker);
        actions.push(fix);
    }

    resolveCodeAction?(codeAction: vscode.CodeAction, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeAction> {
        return codeAction;
    }
}
