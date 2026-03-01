import { XPersistableElement } from "../../Core/XPersistableElement.js";
import { XProperty } from "../../Core/XProperty.js";
import { XGuid } from "../../Core/XGuid.js";

/**
 * XFieldValue — A single field value inside an XORMDataTuple.
 *
 * Pairs a field reference (via FieldID) with a raw string value, representing
 * one column's data within a seed data row.
 *
 * Note on C# file compatibility: in C# .dsorm files the FieldID is stored as
 * an XML attribute on the element tag (not as an XData child inside XValues).
 * When reading C# files the FieldID attribute is silently ignored; it is
 * preserved correctly only for TS-native .dsorm files produced by this engine.
 *
 * ClassID matches C# XFieldValue: 31A002BE-A5F3-42C8-BF56-B167149225D0
 */
export class XFieldValue extends XPersistableElement
{
    public constructor()
    {
        super();
    }

    /**
     * ID of the field this value belongs to.
     * Stored as a plain string — FieldID is a key reference, not a live link.
     * Using Register (not RegisterLink) avoids link-resolution requirements.
     * Fresh TS-specific GUID — C# stores FieldID as an XML attribute.
     */
    public static readonly FieldIDProp = XProperty.Register<XFieldValue, string>(
        (p: XFieldValue) => p.FieldID,
        "3DA1B8E4-FA2C-4B7A-9E63-0D57C84A1F92",
        "FieldID",
        "Field ID",
        XGuid.EmptyValue
    );

    /**
     * The raw string value for the field in this row.
     * Fresh TS-specific GUID — C# stores the value as element text content.
     */
    public static readonly ValueProp = XProperty.Register<XFieldValue, string>(
        (p: XFieldValue) => p.Value,
        "7A6E3F81-2B9C-4D5E-8F07-1C4D8E9A2B03",
        "Value",
        "Field Value",
        ""
    );

    public get FieldID(): string
    {
        return this.GetValue(XFieldValue.FieldIDProp) as string;
    }

    public set FieldID(pValue: string)
    {
        this.SetValue(XFieldValue.FieldIDProp, pValue);
    }

    public get Value(): string
    {
        return this.GetValue(XFieldValue.ValueProp) as string;
    }

    public set Value(pValue: string)
    {
        this.SetValue(XFieldValue.ValueProp, pValue);
    }
}
