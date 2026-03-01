import { XRectangle } from "./XRectangle.js";
import { XProperty } from "../Core/XProperty.js";

export abstract class XField extends XRectangle
{
    public static readonly IndexProp = XProperty.Register<XField, number>(
        (p: XField) => p.Index,
        "5469955E-340A-40D3-A1AE-9C6122EE0BF9",
        "Index",
        "Index",
        0
    );

    public static readonly DataTypeProp = XProperty.Register<XField, string>(
        (p: XField) => p.DataType,
        "244BD6B3-4873-4957-A34D-FD97F7DBD90D",
        "DataType",
        "Data Type",
        "String"
    );

    public static readonly IsRequiredProp = XProperty.Register<XField, boolean>(
        (p: XField) => p.IsRequired,
        "6DF729B6-538E-4622-AB5C-8FE1E62618A3",
        "IsRequired",
        "Is Required",
        true
    );

    public static readonly DefaultValueProp = XProperty.Register<XField, string>(
        (p: XField) => p.DefaultValue,
        "2152CB85-A8E7-4C05-85E0-02A6EAFB7C74",
        "DefaultValue",
        "Default Value",
        ""
    );

    public static readonly LengthProp = XProperty.Register<XField, number>(
        (p: XField) => p.Length,
        "D1AEAA0E-9FC0-478D-9464-DF991F5CE009",
        "Length",
        "Length",
        0
    );

    public static readonly ScaleProp = XProperty.Register<XField, number>(
        (p: XField) => p.Scale,
        "C093D02A-AF28-4E79-BD27-1CF1FAF20204",
        "Scale",
        "Scale",
        0
    );

    public constructor()
    {
        super();
    }

    public get Index(): number
    {
        return this.GetValue(XField.IndexProp) as number;
    }

    public set Index(pValue: number)
    {
        this.SetValue(XField.IndexProp, pValue);
    }

    public get DataType(): string
    {
        return this.GetValue(XField.DataTypeProp) as string;
    }

    public set DataType(pValue: string)
    {
        this.SetValue(XField.DataTypeProp, pValue);
    }

    public get IsRequired(): boolean
    {
        return this.GetValue(XField.IsRequiredProp) as boolean;
    }

    public set IsRequired(pValue: boolean)
    {
        this.SetValue(XField.IsRequiredProp, pValue);
    }

    public get DefaultValue(): string
    {
        return this.GetValue(XField.DefaultValueProp) as string;
    }

    public set DefaultValue(pValue: string)
    {
        this.SetValue(XField.DefaultValueProp, pValue);
    }

    public get Length(): number
    {
        return this.GetValue(XField.LengthProp) as number;
    }

    public set Length(pValue: number)
    {
        if (pValue < 0)
            pValue = 0;
        this.SetValue(XField.LengthProp, pValue);
    }

    public get Scale(): number
    {
        return this.GetValue(XField.ScaleProp) as number;
    }

    public set Scale(pValue: number)
    {
        if (pValue < 0)
            pValue = 0;
        this.SetValue(XField.ScaleProp, pValue);
    }
}