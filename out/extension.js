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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const formRenderer_1 = require("./formRenderer");
function activate(context) {
    const provider = new formRenderer_1.JsonFormEditorProvider(context);
    // Register the WebView-based custom editor for JSON files.
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(formRenderer_1.JsonFormEditorProvider.viewType, provider, {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
    }));
    // "Open with JSON Form" command (explorer context menu + editor title menu).
    context.subscriptions.push(vscode.commands.registerCommand('json-form-viewer.openWithForm', async (uri) => {
        let target = uri;
        if (!target) {
            target = vscode.window.activeTextEditor?.document.uri;
        }
        if (!target) {
            void vscode.window.showWarningMessage('JSON Form: no JSON file selected.');
            return;
        }
        await vscode.commands.executeCommand('vscode.openWith', target, formRenderer_1.JsonFormEditorProvider.viewType);
    }));
    // Status bar item shown while a JSON document is active.
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'json-form-viewer.openWithForm';
    statusBarItem.text = '$(json) JSON Form';
    statusBarItem.tooltip = 'Open the current JSON file with JSON Form';
    const updateStatusBar = () => {
        const editor = vscode.window.activeTextEditor;
        const isJson = editor?.document?.uri?.fsPath?.toLowerCase().endsWith('.json') ?? false;
        if (isJson) {
            statusBarItem.show();
        }
        else {
            statusBarItem.hide();
        }
    };
    updateStatusBar();
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map