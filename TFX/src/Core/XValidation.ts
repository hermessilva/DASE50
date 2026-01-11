
import type { XProperty } from "./XProperty.js";

export enum XDesignerErrorSeverity
{
    Warning = 1,
    Error = 2
}

export class XConcurrentBag<T>
{
    private readonly _Items: T[] = [];

    public Add(pItem: T): void
    {
        this._Items.push(pItem);
    }

    public ToArray(): T[]
    {
        return this._Items.slice();
    }

    public Clear(): void
    {
        this._Items.length = 0;
    }

    public get Count(): number
    {
        return this._Items.length;
    }

    public *[Symbol.iterator](): IterableIterator<T>
    {
        yield* this._Items;
    }
}

export abstract class XValidatableElement
{
    public abstract ID: string;
    public abstract Name: string;
    public abstract ClassName: string;
    public abstract TreeDisplayText: string | null;
}

export class XDataValidateError
{
    public readonly Element: XValidatableElement;
    public readonly Severity: XDesignerErrorSeverity;
    public readonly Message: string;
    public readonly Property?: XProperty;

    public constructor(
        pElement: XValidatableElement,
        pSeverity: XDesignerErrorSeverity,
        pMessage: string,
        pProperty?: XProperty
    )
    {
        this.Element = pElement;
        this.Severity = pSeverity;
        this.Message = pMessage;
        this.Property = pProperty;
    }

    public static Required(pElement: XValidatableElement, pProperty: XProperty): XDataValidateError
    {
        return new XDataValidateError(
            pElement,
            XDesignerErrorSeverity.Error,
            `Property [${pProperty.Name}] is required.`,
            pProperty
        );
    }
}

export interface XIValidationIssue
{
    readonly ElementID: string;
    readonly ElementName: string;
    readonly Severity: XDesignerErrorSeverity;
    readonly Message: string;
    readonly PropertyID?: string;
}

export abstract class XValidator<TDocument, TDesign>
{
    protected readonly _Errors: XConcurrentBag<XIValidationIssue> = new XConcurrentBag<XIValidationIssue>();

    public Validate(pDocument: TDocument): XIValidationIssue[]
    {
        this._Errors.Clear();

        if (pDocument === null)
        {
            this._Errors.Add({
                ElementID: "",
                ElementName: "",
                Severity: XDesignerErrorSeverity.Error,
                Message: "Document is null."
            });
            return this._Errors.ToArray();
        }

        const design = this.GetDesign(pDocument);
        if (design === null)
        {
            this._Errors.Add({
                ElementID: this.GetDocumentID(pDocument),
                ElementName: this.GetDocumentName(pDocument),
                Severity: XDesignerErrorSeverity.Error,
                Message: "Document has no design."
            });
            return this._Errors.ToArray();
        }

        this.ValidateDocument(pDocument);
        this.ValidateDesign(design);
        this.ValidateElements(design);

        return this._Errors.ToArray();
    }

    protected abstract GetDesign(pDocument: TDocument): TDesign | null;
    protected abstract GetDocumentID(pDocument: TDocument): string;
    protected abstract GetDocumentName(pDocument: TDocument): string;

    protected ValidateDocument(_pDocument: TDocument): void
    {
    }

    protected ValidateDesign(_pDesign: TDesign): void
    {
    }

    protected ValidateElements(_pDesign: TDesign): void
    {
    }

    protected AddError(pElementID: string, pElementName: string, pMessage: string, pPropertyID?: string): void
    {
        this._Errors.Add({
            ElementID: pElementID,
            ElementName: pElementName,
            Severity: XDesignerErrorSeverity.Error,
            Message: pMessage,
            PropertyID: pPropertyID
        });
    }

    protected AddWarning(pElementID: string, pElementName: string, pMessage: string, pPropertyID?: string): void
    {
        this._Errors.Add({
            ElementID: pElementID,
            ElementName: pElementName,
            Severity: XDesignerErrorSeverity.Warning,
            Message: pMessage,
            PropertyID: pPropertyID
        });
    }

    protected AddIssue(pElementID: string, pElementName: string, pSeverity: XDesignerErrorSeverity, pMessage: string, pPropertyID?: string): void
    {
        this._Errors.Add({
            ElementID: pElementID,
            ElementName: pElementName,
            Severity: pSeverity,
            Message: pMessage,
            PropertyID: pPropertyID
        });
    }
}
