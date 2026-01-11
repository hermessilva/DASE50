import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../Designer/ORMDesignerEditorProvider";

export class XDeleteSelectedCommand
{
    private _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.DeleteSelected";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XDeleteSelectedCommand
    {
        const command = new XDeleteSelectedCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XDeleteSelectedCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void>
    {
        const uri = this._Provider.GetActiveUri();
        if (!uri)
        {
            vscode.window.showWarningMessage("No ORM designer is active.");
            return;
        }

        await this._Provider.DeleteSelected(uri);
    }
}
