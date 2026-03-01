export const XDesignerMessageType = {
    DesignerReady: "DesignerReady",
    LoadModel: "LoadModel",
    ModelLoaded: "ModelLoaded",
    SaveModel: "SaveModel",
    SelectElement: "SelectElement",
    SelectionChanged: "SelectionChanged",
    AddTable: "AddTable",
    AddField: "AddField",
    MoveElement: "MoveElement",
    ReorderField: "ReorderField",
    DragDropAddRelation: "DragDropAddRelation",
    DeleteSelected: "DeleteSelected",
    RenameSelected: "RenameSelected",
    UpdateProperty: "UpdateProperty",
    PropertiesChanged: "PropertiesChanged",
    ValidateModel: "ValidateModel",
    IssuesChanged: "IssuesChanged",
    RequestRename: "RequestRename",
    RenameCompleted: "RenameCompleted",
    AlignLines: "AlignLines",
    ReloadDataTypes: "ReloadDataTypes",
    DataTypesReloaded: "DataTypesReloaded",
    // Seed / fixture-data editor
    OpenSeedEditor: "OpenSeedEditor",
    RequestSeedData: "RequestSeedData",
    SeedDataLoaded: "SeedDataLoaded",
    SaveSeedData: "SaveSeedData",
    SeedDataSaved: "SeedDataSaved"
} as const;

export type TDesignerMessageType = typeof XDesignerMessageType[keyof typeof XDesignerMessageType];
