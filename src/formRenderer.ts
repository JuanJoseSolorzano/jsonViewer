import * as vscode from 'vscode';

/**
 * Custom text editor provider that renders JSON documents as an editable
 * HTML form inside a WebView.
*/
export class JsonFormEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'jsonFormViewer.jsonEditor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(document:vscode.TextDocument, webviewPanel:vscode.WebviewPanel, _token:vscode.CancellationToken):Promise<void> {
    webviewPanel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const updateWebview = (): void => { webviewPanel.webview.postMessage({ type:'update', text:document.getText() }); };

    // Keep the WebView in sync when the underlying document changes
    // (e.g. an undo or an external edit).
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    webviewPanel.onDidDispose(() => { changeDocumentSubscription.dispose(); });
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'save':
          await this.saveDocument(document, message.text as string);
          return;
        case 'ready':
          updateWebview();
          return;
        case 'error':
          void vscode.window.showErrorMessage(
            `JSON Form: ${message.message as string}`
          );
          return;
        default:
          return;
      }
    });
    updateWebview();
  }

  /**
   * Replaces the document contents with the given JSON text and persists it
   * to disk.
   */
  private async saveDocument(document: vscode.TextDocument, text: string): Promise<void> {
    try {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0),text);
      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) {
        void vscode.window.showErrorMessage('JSON Form: could not apply changes to the document.');
        return;
      }

      const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === document.uri.toString());
      if (doc && doc.isDirty) {
        await doc.save();
      }
    } catch (err) {
      void vscode.window.showErrorMessage(`JSON Form: save failed: ${(err as Error).message}`);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>JSON Form</title>
</head>
<body>
  <div id="toolbar">
    <button id="expand-all" title="Expand all sections">Expand All</button>
    <button id="collapse-all" title="Collapse all sections">Collapse All</button>
    <button id="save" title="Save JSON back to disk">Save</button>
    <span id="status"></span>
  </div>
  <div id="editor" class="hidden"></div>
  <div id="empty-state">
    <p>Loading document&hellip;</p>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
