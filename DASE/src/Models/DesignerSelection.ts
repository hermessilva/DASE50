export class XDesignerSelection
{
    private _SelectedIDs: string[];
    private _PrimaryID: string | null;

    constructor()
    {
        this._SelectedIDs = [];
        this._PrimaryID = null;
    }

    get SelectedIDs(): string[]
    {
        return this._SelectedIDs;
    }

    get PrimaryID(): string | null
    {
        return this._PrimaryID;
    }

    get HasSelection(): boolean
    {
        return this._SelectedIDs.length > 0;
    }

    get Count(): number
    {
        return this._SelectedIDs.length;
    }

    Clear(): void
    {
        this._SelectedIDs = [];
        this._PrimaryID = null;
    }

    Set(pID: string): void
    {
        this._SelectedIDs = [pID];
        this._PrimaryID = pID;
    }

    SetMultiple(pIDs: string[]): void
    {
        this._SelectedIDs = [...pIDs];
        this._PrimaryID = pIDs.length > 0 ? pIDs[0] : null;
    }

    Add(pID: string): void
    {
        if (this._SelectedIDs.indexOf(pID) < 0)
        {
            this._SelectedIDs.push(pID);
            if (this._PrimaryID === null)
                this._PrimaryID = pID;
        }
    }

    Remove(pID: string): void
    {
        const idx = this._SelectedIDs.indexOf(pID);
        if (idx >= 0)
        {
            this._SelectedIDs.splice(idx, 1);
            if (this._PrimaryID === pID)
                this._PrimaryID = this._SelectedIDs.length > 0 ? this._SelectedIDs[0] : null;
        }
    }

    Contains(pID: string): boolean
    {
        return this._SelectedIDs.indexOf(pID) >= 0;
    }

    Toggle(pID: string): void
    {
        if (this.Contains(pID))
            this.Remove(pID);
        else
            this.Add(pID);
    }
}
