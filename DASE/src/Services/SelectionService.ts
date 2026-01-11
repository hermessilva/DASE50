import * as vscode from "vscode";
import { XDesignerSelection } from "../Models/DesignerSelection";

export class XSelectionService
{
    private _Selection: XDesignerSelection;
    private _OnSelectionChanged: vscode.EventEmitter<XDesignerSelection>;

    constructor()
    {
        this._Selection = new XDesignerSelection();
        this._OnSelectionChanged = new vscode.EventEmitter<XDesignerSelection>();
    }

    get Selection(): XDesignerSelection
    {
        return this._Selection;
    }

    get OnSelectionChanged(): vscode.Event<XDesignerSelection>
    {
        return this._OnSelectionChanged.event;
    }

    get SelectedIDs(): string[]
    {
        return this._Selection.SelectedIDs;
    }

    get PrimaryID(): string | null
    {
        return this._Selection.PrimaryID;
    }

    get HasSelection(): boolean
    {
        return this._Selection.HasSelection;
    }

    Clear(): void
    {
        this._Selection.Clear();
        this._OnSelectionChanged.fire(this._Selection);
    }

    Select(pID: string): void
    {
        this._Selection.Set(pID);
        this._OnSelectionChanged.fire(this._Selection);
    }

    SelectMultiple(pIDs: string[]): void
    {
        this._Selection.SetMultiple(pIDs);
        this._OnSelectionChanged.fire(this._Selection);
    }

    ToggleSelection(pID: string): void
    {
        this._Selection.Toggle(pID);
        this._OnSelectionChanged.fire(this._Selection);
    }

    AddToSelection(pID: string): void
    {
        this._Selection.Add(pID);
        this._OnSelectionChanged.fire(this._Selection);
    }

    RemoveFromSelection(pID: string): void
    {
        this._Selection.Remove(pID);
        this._OnSelectionChanged.fire(this._Selection);
    }

    IsSelected(pID: string): boolean
    {
        return this._Selection.Contains(pID);
    }

    Dispose(): void
    {
        this._OnSelectionChanged.dispose();
    }
}

let _Instance: XSelectionService | null = null;

export function GetSelectionService(): XSelectionService
{
    if (_Instance === null)
        _Instance = new XSelectionService();
    return _Instance;
}
