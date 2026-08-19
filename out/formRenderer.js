"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonFormEditorProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Custom text editor provider that renders JSON documents as an editable
 * HTML form inside a WebView.
*/
class JsonFormEditorProvider {
    constructor(context) {
        this.context = context;
    }
    async resolveCustomTextEditor(document, webviewPanel, _token) {
        webviewPanel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        const updateWebview = () => { webviewPanel.webview.postMessage({ type: 'update', text: document.getText() }); };
        // Keep the WebView in sync when the underlying document changes
        // (e.g. an undo or an external edit).
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });
        webviewPanel.onDidDispose(() => { changeDocumentSubscription.dispose(); });
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'save':
                    await this.saveDocument(document, message.text);
                    return;
                case 'ready':
                    updateWebview();
                    return;
                case 'error':
                    void vscode.window.showErrorMessage(`JSON Form: ${message.message}`);
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
    async saveDocument(document, text) {
        try {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text);
            const applied = await vscode.workspace.applyEdit(edit);
            if (!applied) {
                void vscode.window.showErrorMessage('JSON Form: could not apply changes to the document.');
                return;
            }
            const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === document.uri.toString());
            if (doc && doc.isDirty) {
                await doc.save();
            }
        }
        catch (err) {
            void vscode.window.showErrorMessage(`JSON Form: save failed: ${err.message}`);
        }
    }
    getHtmlForWebview(webview) {
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
exports.JsonFormEditorProvider = JsonFormEditorProvider;
JsonFormEditorProvider.viewType = 'jsonFormViewer.jsonEditor';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=formRenderer.js.map