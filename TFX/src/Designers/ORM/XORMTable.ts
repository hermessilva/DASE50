import { XRectangle } from "../../Design/XRectangle.js";
import { XProperty } from "../../Core/XProperty.js";

export class XORMTable extends XRectangle
{
    public static readonly SchemaProp = XProperty.Register<XORMTable, string>(
        (p: XORMTable) => p.Schema,
        "00000001-0002-0001-0001-000000000002",
        "Schema",
        "Database Schema",
        "dbo"
    );

    public constructor()
    {
        super();
    }

    public get Schema(): string
    {
        return this.GetValue(XORMTable.SchemaProp) as string;
    }

    public set Schema(pValue: string)
    {
        this.SetValue(XORMTable.SchemaProp, pValue);
    }
}
