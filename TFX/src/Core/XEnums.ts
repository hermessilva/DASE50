export enum XConstraintType
{
    Dependence = 1,
    Reference = 2,
    Child = 4
}

export enum XPropertyGroup
{
    None = 0,
    Tenanttity = 1,
    Behaviour = 2,
    Control = 3,
    Appearance = 4,
    Test = 5,
    Design = 6,
    Data = 7
}

export const XPropertyGroupDescription: Record<number, string> =
{
    [XPropertyGroup.Tenanttity]: "Tenanttity",
    [XPropertyGroup.Behaviour]: "Behaviour",
    [XPropertyGroup.Control]: "Control",
    [XPropertyGroup.Appearance]: "Appearance",
    [XPropertyGroup.Test]: "Test",
    [XPropertyGroup.Design]: "Design",
    [XPropertyGroup.Data]: "Data"
};

export enum XElementType
{
    None = 0,
    OTRMTable = 10
}
