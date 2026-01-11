export const XIssueSeverity = {
    Error: 2,
    Warning: 1,
    Info: 0
} as const;

export type TIssueSeverity = typeof XIssueSeverity[keyof typeof XIssueSeverity];

export class XIssueItem
{
    ElementID: string;
    ElementName: string;
    Severity: TIssueSeverity;
    Message: string;
    PropertyID: string | null;

    constructor(pElementID: string, pElementName: string, pSeverity: TIssueSeverity, pMessage: string, pPropertyID?: string)
    {
        this.ElementID = pElementID;
        this.ElementName = pElementName;
        this.Severity = pSeverity;
        this.Message = pMessage;
        this.PropertyID = pPropertyID || null;
    }

    get SeverityText(): string
    {
        switch (this.Severity)
        {
            case XIssueSeverity.Error:
                return "Error";
            case XIssueSeverity.Warning:
                return "Warning";
            default:
                return "Info";
        }
    }

    get Icon(): string
    {
        switch (this.Severity)
        {
            case XIssueSeverity.Error:
                return "error";
            case XIssueSeverity.Warning:
                return "warning";
            default:
                return "info";
        }
    }
}
