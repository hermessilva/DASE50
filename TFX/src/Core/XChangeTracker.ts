
import type { XProperty, XPropertyDefault } from "./XProperty.js";

export abstract class XTrackableElement
{
    public abstract ID: string;
}

export enum XTrackAction
{
    None = 0,
    Insert = 1,
    Delete = 2,
    Change = 3
}

export class XChangeTracker
{
    private _GroupTitle: string = "";
    private _GroupAction: XTrackAction = XTrackAction.None;

    public StartGroup(pTitle: string, pAction: XTrackAction): void
    {
        this._GroupTitle = pTitle;
        this._GroupAction = pAction;
    }

    public TrackInsert(_pElement: XTrackableElement): void
    {
    }

    public TrackDelete(_pElement: XTrackableElement): void
    {
    }

    public TrackChange(
        _pElement: XTrackableElement,
        _pProperty: XProperty,
        _pDefault: XPropertyDefault,
        _pOldValue: string | null,
        _pNewValue: string | null
    ): void
    {
    }

    public get GroupTitle(): string
    {
        return this._GroupTitle;
    }

    public get GroupAction(): XTrackAction
    {
        return this._GroupAction;
    }
}
