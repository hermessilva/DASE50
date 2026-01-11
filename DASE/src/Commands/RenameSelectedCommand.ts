import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../Designers/ORM/ORMDesignerEditorProvider";

export class XRenameSelectedCommand
{
    private _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.RenameSelected";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XRenameSelectedCommand
    {
        const command = new XRenameSelectedCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XRenameSelectedCommand.CommandID,
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

        await this._Provider.RenameSelected(uri);
    }
}
