import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";

export class XValidateORMModelCommand
{
    private _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.ValidateORMModel";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XValidateORMModelCommand
    {
        const command = new XValidateORMModelCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XValidateORMModelCommand.CommandID,
            (pUri: vscode.Uri) => command.Execute(pUri)
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(pUri?: vscode.Uri): Promise<void>
    {
        let targetUri = pUri;

        if (!targetUri)
            targetUri = this._Provider.GetActiveUri() || undefined;

        if (!targetUri)
        {
            vscode.window.showWarningMessage("No ORM designer is active.");
            return;
        }

        await this._Provider.ValidateModel(targetUri);
    }
}
