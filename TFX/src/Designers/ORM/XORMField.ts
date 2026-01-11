import { XField } from "../../Design/XField.js";
import { XProperty } from "../../Core/XProperty.js";

export enum XORMFieldDataType
{
    String = "String",
    Integer = "Integer",
    Long = "Long",
    Decimal = "Decimal",
    Boolean = "Boolean",
    DateTime = "DateTime",
    Guid = "Guid",
    Binary = "Binary",
    Text = "Text"
}

export class XORMField extends XField
{
    public static readonly DataTypeProp = XProperty.Register<XORMField, XORMFieldDataType>(
        (p: XORMField) => p.DataType,
        "00000001-0002-0003-0001-000000000002",
        "DataType",
        "Data Type",
        XORMFieldDataType.String
    );

    public static readonly LengthProp = XProperty.Register<XORMField, number>(
        (p: XORMField) => p.Length,
        "00000001-0002-0003-0001-000000000003",
        "Length",
        "Field Length",
        0
    );

    public static readonly IsPrimaryKeyProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsPrimaryKey,
        "00000001-0002-0003-0001-000000000004",
        "IsPrimaryKey",
        "Is Primary Key",
        false
    );

    public static readonly IsNullableProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsNullable,
        "00000001-0002-0003-0001-000000000005",
        "IsNullable",
        "Is Nullable",
        true
    );

    public static readonly IsAutoIncrementProp = XProperty.Register<XORMField, boolean>(
        (p: XORMField) => p.IsAutoIncrement,
        "00000001-0002-0003-0001-000000000006",
        "IsAutoIncrement",
        "Is Auto Increment",
        false
    );

    public static readonly DefaultValueProp = XProperty.Register<XORMField, string>(
        (p: XORMField) => p.DefaultValue,
        "00000001-0002-0003-0001-000000000007",
        "DefaultValue",
        "Default Value",
        ""
    );

    public constructor()
    {
        super();
    }

    public get DataType(): XORMFieldDataType
    {
        return this.GetValue(XORMField.DataTypeProp) as XORMFieldDataType;
    }

    public set DataType(pValue: XORMFieldDataType)
    {
        this.SetValue(XORMField.DataTypeProp, pValue);
    }

    public get Length(): number
    {
        return this.GetValue(XORMField.LengthProp) as number;
    }

    public set Length(pValue: number)
    {
        this.SetValue(XORMField.LengthProp, pValue);
    }

    public get IsPrimaryKey(): boolean
    {
        return this.GetValue(XORMField.IsPrimaryKeyProp) as boolean;
    }

    public set IsPrimaryKey(pValue: boolean)
    {
        this.SetValue(XORMField.IsPrimaryKeyProp, pValue);
    }

    public get IsNullable(): boolean
    {
        return this.GetValue(XORMField.IsNullableProp) as boolean;
    }

    public set IsNullable(pValue: boolean)
    {
        this.SetValue(XORMField.IsNullableProp, pValue);
    }

    public get IsAutoIncrement(): boolean
    {
        return this.GetValue(XORMField.IsAutoIncrementProp) as boolean;
    }

    public set IsAutoIncrement(pValue: boolean)
    {
        this.SetValue(XORMField.IsAutoIncrementProp, pValue);
    }

    public get DefaultValue(): string
    {
        return this.GetValue(XORMField.DefaultValueProp) as string;
    }

    public set DefaultValue(pValue: string)
    {
        this.SetValue(XORMField.DefaultValueProp, pValue);
    }
}
