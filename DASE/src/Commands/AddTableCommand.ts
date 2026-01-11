import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../Designer/ORMDesignerEditorProvider";

export class XAddTableCommand
{
    private readonly _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider)
    {
        this._Provider = pProvider;
    }

    static get CommandID(): string
    {
        return "Dase.AddTable";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XAddTableCommand
    {
        const command = new XAddTableCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XAddTableCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void>
    {
        this._Provider.AddTableToActiveDesigner();
    }
}

module.exports = { XAddTableCommand };
