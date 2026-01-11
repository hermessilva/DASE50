import { XDesignElement } from "./XDesignElement.js";
import { XProperty } from "../Core/XProperty.js";
import { XColor, XPoint } from "../Core/XGeometry.js";
import { XGuid } from "../Core/XGuid.js";

export abstract class XLine extends XDesignElement
{
    public static readonly SourceProp = XProperty.RegisterLink<XLine>(
        (p: XLine) => p.Source,
        "00000001-0001-0001-0004-000000000010",
        "Source",
        "Source Element ID",
        XGuid.EmptyValue
    );

    public static readonly TargetProp = XProperty.RegisterLink<XLine>(
        (p: XLine) => p.Target,
        "00000001-0001-0001-0004-000000000011",
        "Target",
        "Target Element ID",
        XGuid.EmptyValue
    );

    public static readonly PointsProp = XProperty.Register<XLine, XPoint[]>(
        (p: XLine) => p.Points,
        "00000001-0001-0001-0004-000000000001",
        "Points",
        "Points List",
        []
    );

    public static readonly StrokeProp = XProperty.Register<XLine, XColor>(
        (p: XLine) => p.Stroke,
        "00000001-0001-0001-0004-000000000005",
        "Stroke",
        "Stroke Color",
        XColor.Black
    );

    public static readonly StrokeThicknessProp = XProperty.Register<XLine, number>(
        (p: XLine) => p.StrokeThickness,
        "00000001-0001-0001-0004-000000000006",
        "StrokeThickness",
        "Stroke Thickness",
        1
    );

    public constructor()
    {
        super();
    }

    public get Source(): string
    {
        return this.GetValue(XLine.SourceProp) as string;
    }

    public set Source(pValue: string)
    {
        this.SetValue(XLine.SourceProp, pValue);
    }

    public get SourceID(): string
    {
        return this.Source;
    }

    public get Target(): string
    {
        return this.GetValue(XLine.TargetProp) as string;
    }

    public set Target(pValue: string)
    {
        this.SetValue(XLine.TargetProp, pValue);
    }

    public get TargetID(): string
    {
        return this.Target;
    }

    public get Points(): XPoint[]
    {
        return this.GetValue(XLine.PointsProp) as XPoint[];
    }

    public set Points(pValue: XPoint[])
    {
        this.SetValue(XLine.PointsProp, pValue);
    }

    public get Stroke(): XColor
    {
        return this.GetValue(XLine.StrokeProp) as XColor;
    }

    public set Stroke(pValue: XColor)
    {
        this.SetValue(XLine.StrokeProp, pValue);
    }

    public get StrokeThickness(): number
    {
        return this.GetValue(XLine.StrokeThicknessProp) as number;
    }

    public set StrokeThickness(pValue: number)
    {
        this.SetValue(XLine.StrokeThicknessProp, pValue);
    }
}