import * as vscode from 'vscode';
import { JsonFormEditorProvider } from './formRenderer';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new JsonFormEditorProvider(context);

  // Register the WebView-based custom editor for JSON files.
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      JsonFormEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // "Open with JSON Form" command (explorer context menu + editor title menu).
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'json-form-viewer.openWithForm',
      async (uri?: vscode.Uri) => {
        let target = uri;
        if (!target) {
          target = vscode.window.activeTextEditor?.document.uri;
        }
        if (!target) {
          void vscode.window.showWarningMessage(
            'JSON Form: no JSON file selected.'
          );
          return;
        }
        await vscode.commands.executeCommand(
          'vscode.openWith',
          target,
          JsonFormEditorProvider.viewType
        );
      }
    )
  );

  // Status bar item shown while a JSON document is active.
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'json-form-viewer.openWithForm';
  statusBarItem.text = '$(json) JSON Form';
  statusBarItem.tooltip = 'Open the current JSON file with JSON Form';

  const updateStatusBar = (): void => {
    const editor = vscode.window.activeTextEditor;
    const isJson =
      editor?.document?.uri?.fsPath?.toLowerCase().endsWith('.json') ?? false;
    if (isJson) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };

  updateStatusBar();
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
  );
}

export function deactivate(): void {}
