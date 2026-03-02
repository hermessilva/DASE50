import * as vscode from "vscode";
import { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";
import { GetLogService } from "../../../Services/LogService";

export class XExportToDBMLCommand {
    private readonly _Provider: XORMDesignerEditorProvider;

    constructor(pProvider: XORMDesignerEditorProvider) {
        this._Provider = pProvider;
    }

    static get CommandID(): string {
        return "Dase.ExportToDBML";
    }

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): XExportToDBMLCommand {
        const command = new XExportToDBMLCommand(pProvider);
        const disposable = vscode.commands.registerCommand(
            XExportToDBMLCommand.CommandID,
            () => command.Execute()
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(): Promise<void> {
        const state = this._Provider.GetActiveState();
        if (!state) {
            vscode.window.showErrorMessage("No active ORM Designer found to export.");
            return;
        }

        try {
            const targetUri = await vscode.window.showSaveDialog({
                filters: { "DBML Document": ["dbml"] },
                title: "Export Model to DBML"
            });

            if (!targetUri)
                return;

            const dbmlContent = state.ExportToDBML();
            const bytes = Buffer.from(dbmlContent, "utf8");

            await vscode.workspace.fs.writeFile(targetUri, bytes);

            vscode.window.showInformationMessage(`Successfully exported model to ${targetUri.fsPath}`);
            GetLogService().Info(`Exported DBML to ${targetUri.fsPath}`);
        }
        catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export to DBML: ${error.message}`);
            GetLogService().Error("Failed to export DBML", error);
        }
    }
}

module.exports = { XExportToDBMLCommand };
