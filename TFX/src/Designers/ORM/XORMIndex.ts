import { XPersistableElement } from "../../Core/XPersistableElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XORMIndexField } from "./XORMIndexField.js";

/**
 * XORMIndex — A database index definition on an ORM table.
 *
 * Holds the index metadata (name, uniqueness constraint) and references the
 * specific fields that compose the index via XORMIndexField children.
 *
 * ClassID matches C# XORMIndex: 22F0A974-7CE7-41E5-AE23-3EE6B49FC848
 */
export class XORMIndex extends XPersistableElement
{
    public constructor()
    {
        super();
    }

    /**
     * Whether this index enforces a UNIQUE constraint.
     * Matches C# XORMIndex.IsUnique (GUID: 93ADA328-...).
     */
    public static readonly IsUniqueProp = XProperty.Register<XORMIndex, boolean>(
        (p: XORMIndex) => p.IsUnique,
        "93ADA328-E1D2-4B42-A86B-A3C442070D3E",
        "IsUnique",
        "Is Unique",
        false
    );

    public get IsUnique(): boolean
    {
        return this.GetValue(XORMIndex.IsUniqueProp) as boolean;
    }

    public set IsUnique(pValue: boolean)
    {
        this.SetValue(XORMIndex.IsUniqueProp, pValue);
    }

    /**
     * Returns all XORMIndexField children for this index.
     */
    public GetIndexFields(): XORMIndexField[]
    {
        return this.GetChildrenOfType(XORMIndexField);
    }
}
