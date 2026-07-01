import * as vscode from "vscode";

/**
 * Detaches the active ORM Designer editor into a separate floating window
 * (VS Code "auxiliary window"). Delegates to the built-in editor command so the
 * webview is moved — not reloaded — preserving its state (retainContextWhenHidden).
 */
export class XDetachDesignerCommand
{
    static get CommandID(): string
    {
        return "Dase.DetachDesigner";
    }

    static Register(pContext: vscode.ExtensionContext): XDetachDesignerCommand
    {
        const command = new XDetachDesignerCommand();
        const disposable = vscode.commands.registerCommand(
            XDetachDesignerCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void>
    {
        await vscode.commands.executeCommand("workbench.action.moveEditorToNewWindow");
    }
}

module.exports = { XDetachDesignerCommand };
