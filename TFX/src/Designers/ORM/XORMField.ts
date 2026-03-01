import { XField } from "../../Design/XField.js";
import { XProperty } from "../../Core/XProperty.js";
import type { XORMDesign } from "./XORMDesign.js";
import type { XORMTable } from "./XORMTable.js";

export class XORMField extends XField
{
    public static readonly IsAutoIncrementProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsAutoIncrement,
        "00000001-0002-0003-0001-000000000006",
        "IsAutoIncrement",
        "Is Auto Increment",
        false
    );

    /**
     * Explicit FK flag — matches C# XORMField.IsFK (GUID: 7CBD471F-...).
     * Set to true when the field is a foreign key stored/loaded from C# files.
     * For TS-native files, use IsForeignKey which is computed from XORMReference.
     */
    public static readonly IsFKProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsFK,
        "7CBD471F-E1F2-4A36-B0FC-A962000DF07F",
        "IsFK",
        "Is Foreign Key",
        false
    );

    /**
     * Returns whether this field is a primary key.
     * Always false for regular fields.
     * XORMPKField overrides this getter to return true.
     */
    public get IsPrimaryKey(): boolean
    {
        return false;
    }

    public get IsAutoIncrement(): boolean
    {
        return this.GetValue(XORMField.IsAutoIncrementProp) as boolean;
    }

    public set IsAutoIncrement(pValue: boolean)
    {
        this.SetValue(XORMField.IsAutoIncrementProp, pValue);
    }

    public get IsFK(): boolean
    {
        return this.GetValue(XORMField.IsFKProp) as boolean;
    }

    public set IsFK(pValue: boolean)
    {
        this.SetValue(XORMField.IsFKProp, pValue);
    }

    /**
     * Gets the reference that uses this field as source (FK field)
     * Returns null if this field is not an FK field
     */
    public GetReference(): import("./XORMReference.js").XORMReference | null
    {
        const table = this.ParentNode as XORMTable | null;
        if (!table)
            return null;

        const design = table.ParentNode as XORMDesign | null;
        if (!design || typeof design.FindReferenceBySourceFieldID !== "function")
            return null;

        return design.FindReferenceBySourceFieldID(this.ID);
    }

    /**
     * Returns true when the explicit IsFK flag is set (C# file compatibility)
     * OR when a XORMReference in the design uses this field as its source (TS native).
     */
    public get IsForeignKey(): boolean
    {
        return this.IsFK || this.GetReference() !== null;
    }

    /**
     * Gets the expected DataType for this field if it's an FK field
     * Returns the PKType of the target table, or null if not an FK field
     */
    public GetExpectedDataType(): string | null
    {
        const ref = this.GetReference();
        if (!ref)
            return null;

        const table = this.ParentNode as XORMTable | null;
        if (!table)
            return null;

        const design = table.ParentNode as XORMDesign | null;
        if (!design || typeof design.FindTableByID !== "function")
            return null;

        const targetTable = design.FindTableByID(ref.Target);
        if (!targetTable)
            return null;

        return targetTable.PKType;
    }
}