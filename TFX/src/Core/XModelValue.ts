
import { XGuid } from "./XGuid.js";
import type { XProperty } from "./XProperty.js";

export abstract class XModelValueElement
{
    public abstract ID: string;
}

export class XModelValue
{
    public Element: XModelValueElement | null = null;

    public readonly Owner: XModelValueElement;
    public readonly PropertyId: string;
    public readonly Value: unknown;
    public readonly SourceId: string;
    public readonly TargetId: string;

    public constructor(
        pOwner: XModelValueElement,
        pPropertyId: string,
        pValue: unknown,
        pSourceId: string,
        pTargetId: string = XGuid.EmptyValue
    )
    {
        this.Owner = pOwner;
        this.PropertyId = pPropertyId;
        this.Value = pValue;
        this.SourceId = pSourceId;
        this.TargetId = pTargetId;
    }

    public static FromProperty(
        pOwner: XModelValueElement,
        pProperty: XProperty,
        pValue: unknown,
        pSourceId: string,
        pTargetId: string = XGuid.EmptyValue
    ): XModelValue
    {
        return new XModelValue(pOwner, pProperty.ID, pValue, pSourceId, pTargetId);
    }
}
