
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
