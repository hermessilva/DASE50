export const XDesignerMessageType = {
    DesignerReady: "DesignerReady",
    LoadModel: "LoadModel",
    ModelLoaded: "ModelLoaded",
    SaveModel: "SaveModel",
    SelectElement: "SelectElement",
    SelectionChanged: "SelectionChanged",
    AddTable: "AddTable",
    MoveElement: "MoveElement",
    DragDropAddRelation: "DragDropAddRelation",
    DeleteSelected: "DeleteSelected",
    RenameSelected: "RenameSelected",
    UpdateProperty: "UpdateProperty",
    PropertiesChanged: "PropertiesChanged",
    ValidateModel: "ValidateModel",
    IssuesChanged: "IssuesChanged",
    RequestRename: "RequestRename",
    RenameCompleted: "RenameCompleted"
} as const;

export type TDesignerMessageType = typeof XDesignerMessageType[keyof typeof XDesignerMessageType];
