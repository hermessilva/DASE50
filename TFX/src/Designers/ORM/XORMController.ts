import { XGuid } from "../../Core/XGuid.js";
import { XRect, XPoint } from "../../Core/XGeometry.js";
import { XElement } from "../../Core/XElement.js";
import { XORMDocument } from "./XORMDocument.js";
import { XORMDesign } from "./XORMDesign.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMField } from "./XORMField.js";
import type { XPersistableElement } from "../../Core/XPersistableElement.js";

export interface XIORMOperation
{
    readonly Type: XORMOperationType;
    readonly ElementID?: string;
    readonly Data?: unknown;
}

export enum XORMOperationType
{
    AddTable = "AddTable",
    RemoveTable = "RemoveTable",
    AddReference = "AddReference",
    RemoveReference = "RemoveReference",
    AddField = "AddField",
    RemoveField = "RemoveField",
    UpdateProperty = "UpdateProperty",
    MoveElement = "MoveElement",
    RenameElement = "RenameElement"
}

export interface XIAddTableData
{
    X: number;
    Y: number;
    Name?: string;
}

export interface XIAddReferenceData
{
    SourceID: string;
    TargetID: string;
    Name?: string;
}

export interface XIAddFieldData
{
    TableID: string;
    Name?: string;
}

export interface XIUpdatePropertyData
{
    ElementID: string;
    PropertyKey: string;
    Value: unknown;
}

export interface XIMoveElementData
{
    ElementID: string;
    X: number;
    Y: number;
}

export interface XIRenameElementData
{
    ElementID: string;
    NewName: string;
}

export interface XIOperationResult
{
    Success: boolean;
    ElementID?: string;
    Message?: string;
}

export class XORMController
{
    private _Document: XORMDocument | null = null;

    public get Document(): XORMDocument | null
    {
        return this._Document;
    }

    public set Document(pValue: XORMDocument | null)
    {
        this._Document = pValue;
    }

    public get Design(): XORMDesign | null
    {
        return this._Document?.Design ?? null;
    }

    public ApplyOperation(pOperation: XIORMOperation): XIOperationResult
    {
        if (this._Document === null || this.Design === null)
            return { Success: false, Message: "No document loaded." };

        switch (pOperation.Type)
        {
            case XORMOperationType.AddTable:
                return this.AddTable(pOperation.Data as XIAddTableData);

            case XORMOperationType.RemoveTable:
                return this.RemoveElement(pOperation.ElementID!);

            case XORMOperationType.AddReference:
                return this.AddReference(pOperation.Data as XIAddReferenceData);

            case XORMOperationType.RemoveReference:
                return this.RemoveElement(pOperation.ElementID!);

            case XORMOperationType.AddField:
                return this.AddField(pOperation.Data as XIAddFieldData);

            case XORMOperationType.RemoveField:
                return this.RemoveElement(pOperation.ElementID!);

            case XORMOperationType.UpdateProperty:
                return this.UpdateProperty(pOperation.Data as XIUpdatePropertyData);

            case XORMOperationType.MoveElement:
                return this.MoveElement(pOperation.Data as XIMoveElementData);

            case XORMOperationType.RenameElement:
                return this.RenameElement(pOperation.Data as XIRenameElementData);

            default:
                return { Success: false, Message: `Unknown operation type: ${pOperation.Type}` };
        }
    }

    public AddTable(pData: XIAddTableData): XIOperationResult
    {
        if (this.Design === null)
            return { Success: false, Message: "No design loaded." };

        const table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = pData.Name ?? this.GenerateTableName();
        table.Bounds = new XRect(pData.X, pData.Y, 200, 150);

        this.Design.AppendChild(table);

        return { Success: true, ElementID: table.ID };
    }

    public AddReference(pData: XIAddReferenceData): XIOperationResult
    {
        if (this.Design === null)
            return { Success: false, Message: "No design loaded." };

        const sourceTable = this.GetTableByID(pData.SourceID);
        const targetTable = this.GetTableByID(pData.TargetID);

        if (sourceTable === null)
            return { Success: false, Message: "Source table not found." };

        if (targetTable === null)
            return { Success: false, Message: "Target table not found." };

        const reference = new XORMReference();
        reference.ID = XGuid.NewValue();
        reference.Name = pData.Name ?? this.GenerateReferenceName(sourceTable, targetTable);
        reference.Source = sourceTable.ID;
        reference.Target = targetTable.ID;

        const srcBounds = sourceTable.Bounds;
        const tgtBounds = targetTable.Bounds;
        reference.Points = [
            new XPoint(srcBounds.Left + srcBounds.Width, srcBounds.Top + srcBounds.Height / 2),
            new XPoint(tgtBounds.Left, tgtBounds.Top + tgtBounds.Height / 2)
        ];

        this.Design.AppendChild(reference);

        return { Success: true, ElementID: reference.ID };
    }

    public AddField(pData: XIAddFieldData): XIOperationResult
    {
        const table = this.GetTableByID(pData.TableID);
        if (table === null)
            return { Success: false, Message: "Table not found." };

        const field = new XORMField();
        field.ID = XGuid.NewValue();
        field.Name = pData.Name ?? this.GenerateFieldName(table);

        table.AppendChild(field);

        return { Success: true, ElementID: field.ID };
    }

    public RemoveElement(pElementID: string): XIOperationResult
    {
        if (this.Design === null)
            return { Success: false, Message: "No design loaded." };

        const element = this.GetElementByID(pElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        if (!element.CanDelete)
            return { Success: false, Message: "Element cannot be deleted." };

        if (element instanceof XORMTable)
            this.RemoveReferencesForTable(pElementID);

        if (element.ParentNode instanceof XElement)
            element.ParentNode.RemoveChild(element);

        return { Success: true, ElementID: pElementID };
    }

    public UpdateProperty(pData: XIUpdatePropertyData): XIOperationResult
    {
        const element = this.GetElementByID(pData.ElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        element.SetValueByKey(pData.PropertyKey, pData.Value);

        return { Success: true, ElementID: pData.ElementID };
    }

    public MoveElement(pData: XIMoveElementData): XIOperationResult
    {
        const element = this.GetElementByID(pData.ElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        if (element instanceof XORMTable)
        {
            const bounds = element.Bounds;
            element.Bounds = new XRect(pData.X, pData.Y, bounds.Width, bounds.Height);
            this.UpdateReferencesForTable(element);
        }

        return { Success: true, ElementID: pData.ElementID };
    }

    public RenameElement(pData: XIRenameElementData): XIOperationResult
    {
        const element = this.GetElementByID(pData.ElementID);
        if (element === null)
            return { Success: false, Message: "Element not found." };

        element.Name = pData.NewName;

        return { Success: true, ElementID: pData.ElementID };
    }

    public GetElementByID(pID: string): XPersistableElement | null
    {
        if (this._Document === null)
            return null;

        return this.FindElementRecursive(this._Document, pID);
    }

    public GetTableByID(pID: string): XORMTable | null
    {
        const element = this.GetElementByID(pID);
        if (element instanceof XORMTable)
            return element;
        return null;
    }

    public GetTables(): XORMTable[]
    {
        if (this.Design === null)
            return [];
        return this.Design.GetChildrenOfType(XORMTable);
    }

    public GetReferences(): XORMReference[]
    {
        if (this.Design === null)
            return [];
        return this.Design.GetChildrenOfType(XORMReference);
    }

    private FindElementRecursive(pElement: XPersistableElement, pID: string): XPersistableElement | null
    {
        if (pElement.ID === pID)
            return pElement;

        for (const child of pElement.ChildNodes)
        {
            const found = this.FindElementRecursive(child as XPersistableElement, pID);
            if (found !== null)
                return found;
        }

        return null;
    }

    private RemoveReferencesForTable(pTableID: string): void
    {
        if (this.Design === null)
            return;

        const references = this.GetReferences();
        for (const ref of references)
        {
            if (ref.SourceID === pTableID || ref.TargetID === pTableID)
                this.Design.RemoveChild(ref);
        }
    }

    private UpdateReferencesForTable(pTable: XORMTable): void
    {
        if (this.Design === null)
            return;

        const references = this.GetReferences();
        const tableBounds = pTable.Bounds;

        for (const ref of references)
        {
            if (ref.SourceID === pTable.ID)
            {
                const points = [...ref.Points];
                if (points.length > 0)
                {
                    points[0] = new XPoint(
                        tableBounds.Left + tableBounds.Width,
                        tableBounds.Top + tableBounds.Height / 2
                    );
                    ref.Points = points;
                }
            }

            if (ref.TargetID === pTable.ID)
            {
                const points = [...ref.Points];
                if (points.length > 1)
                {
                    points[points.length - 1] = new XPoint(
                        tableBounds.Left,
                        tableBounds.Top + tableBounds.Height / 2
                    );
                    ref.Points = points;
                }
            }
        }
    }

    private GenerateTableName(): string
    {
        const tables = this.GetTables();
        let idx = tables.length + 1;
        let name = `Table${idx}`;

        while (tables.some(t => t.Name.toLowerCase() === name.toLowerCase()))
        {
            idx++;
            name = `Table${idx}`;
        }

        return name;
    }

    private GenerateReferenceName(pSource: XORMTable, pTarget: XORMTable): string
    {
        return `${pSource.Name}_${pTarget.Name}`;
    }

    private GenerateFieldName(pTable: XORMTable): string
    {
        const fields = pTable.GetChildrenOfType(XORMField);
        let idx = fields.length + 1;
        let name = `Field${idx}`;

        while (fields.some(f => f.Name.toLowerCase() === name.toLowerCase()))
        {
            idx++;
            name = `Field${idx}`;
        }

        return name;
    }
}
