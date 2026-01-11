import * as vscode from "vscode";
import { XIssueItem, XIssueSeverity } from "../Models/IssueItem";

export class XIssueService
{
    private _Issues: XIssueItem[];
    private _OnIssuesChanged: vscode.EventEmitter<XIssueItem[]>;

    constructor()
    {
        this._Issues = [];
        this._OnIssuesChanged = new vscode.EventEmitter<XIssueItem[]>();
    }

    get Issues(): XIssueItem[]
    {
        return this._Issues;
    }

    get OnIssuesChanged(): vscode.Event<XIssueItem[]>
    {
        return this._OnIssuesChanged.event;
    }

    get ErrorCount(): number
    {
        return this._Issues.filter(i => i.Severity === XIssueSeverity.Error).length;
    }

    get WarningCount(): number
    {
        return this._Issues.filter(i => i.Severity === XIssueSeverity.Warning).length;
    }

    SetIssues(pIssues: XIssueItem[]): void
    {
        this._Issues = pIssues || [];
        this._OnIssuesChanged.fire(this._Issues);
    }

    Clear(): void
    {
        this._Issues = [];
        this._OnIssuesChanged.fire(this._Issues);
    }

    AddIssue(pIssue: XIssueItem): void
    {
        this._Issues.push(pIssue);
        this._OnIssuesChanged.fire(this._Issues);
    }

    GetIssuesForElement(pElementID: string): XIssueItem[]
    {
        return this._Issues.filter(i => i.ElementID === pElementID);
    }

    Dispose(): void
    {
        this._OnIssuesChanged.dispose();
    }
}

let _Instance: XIssueService | null = null;

export function GetIssueService(): XIssueService
{
    if (_Instance === null)
        _Instance = new XIssueService();
    return _Instance;
}
