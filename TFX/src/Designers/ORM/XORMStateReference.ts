import { XColor } from "../../Core/XGeometry.js";
import { XORMReference } from "./XORMReference.js";

/**
 * A relationship that exists only in the model to generate a SQL FK constraint.
 * It has no visual representation in the designer canvas.
 */
export class XORMStateReference extends XORMReference
{
    public constructor()
    {
        super();
    }

    /** State references have no visual representation — always invisible. */
    public get IsVisible(): boolean
    {
        return false;
    }

    public override get Stroke(): XColor
    {
        return XColor.Transparent;
    }

    public override set Stroke(_pValue: XColor)
    {
        // No-op — state references carry no stroke.
    }

    public override get StrokeThickness(): number
    {
        return 0;
    }

    public override set StrokeThickness(_pValue: number)
    {
        // No-op — state references carry no stroke thickness.
    }
}
