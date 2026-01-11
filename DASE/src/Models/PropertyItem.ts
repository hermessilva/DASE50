export const XPropertyType = {
    String: "String",
    Number: "Number",
    Boolean: "Boolean",
    Enum: "Enum",
    Color: "Color",
    Rect: "Rect"
} as const;

export type TPropertyType = typeof XPropertyType[keyof typeof XPropertyType];

export class XPropertyItem
{
    Key: string;
    Name: string;
    Value: unknown;
    Type: TPropertyType;
    Options: string[] | null;
    IsReadOnly: boolean;
    Category: string;

    constructor(pKey: string, pName: string, pValue: unknown, pType?: TPropertyType, pOptions?: string[])
    {
        this.Key = pKey;
        this.Name = pName;
        this.Value = pValue;
        this.Type = pType || XPropertyType.String;
        this.Options = pOptions || null;
        this.IsReadOnly = false;
        this.Category = "General";
    }
}
