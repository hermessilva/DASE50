import * as vscode from "vscode";
import { XTFXBridge } from "../../Services/TFXBridge";
import { GetIssueService, XIssueService } from "../../Services/IssueService";
import { GetSelectionService, XSelectionService } from "../../Services/SelectionService";
import { GetLogService } from "../../Services/LogService";
import { XPropertyItem } from "../../Models/PropertyItem";
import { XIssueItem } from "../../Models/IssueItem";

interface IOperationResult
{
    Success: boolean;
    Message?: string;
}

interface IModelData
{
    Tables: unknown[];
    References: unknown[];
}

interface IStateChangedEvent
{
    IsDirty: boolean;
}

export class XORMDesignerState
{
    private _Document: vscode.TextDocument;
    private _Bridge: XTFXBridge;
    private _IsDirty: boolean;
    private _OnStateChanged: vscode.EventEmitter<IStateChangedEvent>;

    constructor(pDocument: vscode.TextDocument)
    {
        this._Document = pDocument;
        this._Bridge = new XTFXBridge();
        this._IsDirty = false;
        this._OnStateChanged = new vscode.EventEmitter<IStateChangedEvent>();
    }

    get Document(): vscode.TextDocument
    {
        return this._Document;
    }

    get Bridge(): XTFXBridge
    {
        return this._Bridge;
    }

    get IsDirty(): boolean
    {
        return this._IsDirty;
    }

    set IsDirty(pValue: boolean)
    {
        if (this._IsDirty !== pValue)
        {
            this._IsDirty = pValue;
            this._OnStateChanged.fire({ IsDirty: pValue });
        }
    }

    get OnStateChanged(): vscode.Event<IStateChangedEvent>
    {
        return this._OnStateChanged.event;
    }

    get IssueService(): XIssueService
    {
        return GetIssueService();
    }

    get SelectionService(): XSelectionService
    {
        return GetSelectionService();
    }

    get IsUntitled(): boolean
    {
        return this._Document.uri.scheme === "untitled";
    }

    async Load(): Promise<void>
    {
        try
        {
            const uri = this._Document.uri;
            GetLogService().Info(`Loading ORM model: ${uri.fsPath}`);
            
            // Handle untitled files
            if (uri.scheme === "untitled")
            {
                await this._Bridge.LoadOrmModelFromText("{}");
                this._IsDirty = true; // Mark as dirty so user is prompted to save
                GetLogService().Info("Created new empty ORM model");
                return;
            }

            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(bytes).toString("utf8");
            await this._Bridge.LoadOrmModelFromText(text);
            this._IsDirty = false;
            GetLogService().Info(`ORM model loaded successfully: ${uri.fsPath}`);
        }
        catch (error)
        {
            GetLogService().Error(`Failed to load ORM model: ${this._Document.uri.fsPath}`, error);
            throw error;
        }
    }

    async Save(): Promise<void>
    {
        try
        {
            const uri = this._Document.uri;
            
            // For untitled files, we can't write directly - just mark as dirty
            // The VS Code framework will prompt the user to "Save As"
            if (uri.scheme === "untitled")
            {
                GetLogService().Info("Untitled file - changes kept in memory until saved");
                return;
            }
            
            const text = this._Bridge.SaveOrmModelToText();
            const bytes = Buffer.from(text, "utf8");
            await vscode.workspace.fs.writeFile(uri, bytes);
            this._IsDirty = false;
            GetLogService().Info(`ORM model saved: ${uri.fsPath}`);
        }
        catch (error)
        {
            GetLogService().Error(`Failed to save ORM model: ${this._Document.uri.fsPath}`, error);
            throw error;
        }
    }

    async GetModelData(): Promise<IModelData>
    {
        return await this._Bridge.GetModelData();
    }

    async Validate(): Promise<XIssueItem[]>
    {
        const issues = await this._Bridge.ValidateOrmModel();
        this.IssueService.SetIssues(issues);
        return issues;
    }

    AddTable(pX: number, pY: number, pName: string): IOperationResult
    {
        const result = this._Bridge.AddTable(pX, pY, pName);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    AddReference(pSourceTableID: string, pTargetTableID: string, pName: string): IOperationResult
    {
        GetLogService().Info(`ORMDesignerState.AddReference: Source=${pSourceTableID}, Target=${pTargetTableID}, Name=${pName}`);
        const result = this._Bridge.AddReference(pSourceTableID, pTargetTableID, pName);
        GetLogService().Info(`Bridge.AddReference result: ${JSON.stringify(result)}`);
        if (result?.Success)
            this.IsDirty = true;
        return result || { Success: false };
    }

    DeleteSelected(): IOperationResult
    {
        const selection = this.SelectionService;
        if (!selection.HasSelection)
            return { Success: false, Message: "No selection." };

        const ids = [...selection.SelectedIDs];
        let success = true;

        for (const id of ids)
        {
            const result = this._Bridge.DeleteElement(id);
            if (!result)
                success = false;
        }

        if (success)
        {
            selection.Clear();
            this.IsDirty = true;
        }

        return { Success: success };
    }

    RenameSelected(pNewName: string): IOperationResult
    {
        const selection = this.SelectionService;
        if (!selection.HasSelection || !selection.PrimaryID)
            return { Success: false, Message: "No selection." };

        const result = this._Bridge.RenameElement(selection.PrimaryID, pNewName);
        if (result)
            this.IsDirty = true;
        return { Success: !!result };
    }

    MoveElement(pElementID: string, pX: number, pY: number): IOperationResult
    {
        const result = this._Bridge.MoveElement(pElementID, pX, pY);
        if (result)
            this.IsDirty = true;
        return { Success: !!result };
    }

    UpdateProperty(pElementID: string, pPropertyKey: string, pValue: unknown): IOperationResult
    {
        const result = this._Bridge.UpdateProperty(pElementID, pPropertyKey, pValue);
        if (result)
            this.IsDirty = true;
        return { Success: !!result };
    }

    async GetProperties(pElementID: string): Promise<XPropertyItem[]>
    {
        return await this._Bridge.GetProperties(pElementID);
    }

    Dispose(): void
    {
        this._OnStateChanged.dispose();
    }
}
