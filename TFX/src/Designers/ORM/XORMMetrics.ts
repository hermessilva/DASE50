import { XRect } from "../../Core/XGeometry.js";
import { XORMTable } from "./XORMTable.js";

export class XORMMetrics
{
    public static readonly HeaderHeight: number = 28;
    public static readonly FieldRowHeight: number = 16;
    public static readonly FieldsPadding: number = 12;
    public static readonly DefaultTableWidth: number = 200;
    public static readonly RouterGap: number = 20;

    public static GetTableHeight(pFieldCount: number): number
    {
        if (pFieldCount <= 0)
            return XORMMetrics.HeaderHeight;
        return XORMMetrics.HeaderHeight
            + pFieldCount * XORMMetrics.FieldRowHeight
            + XORMMetrics.FieldsPadding;
    }

    public static GetVisualBounds(pTable: XORMTable): XRect
    {
        const fieldCount = pTable.GetFields().length;
        return new XRect(
            pTable.Bounds.Left,
            pTable.Bounds.Top,
            pTable.Bounds.Width,
            XORMMetrics.GetTableHeight(fieldCount)
        );
    }

    public static GetFieldRowY(pTable: XORMTable, pFieldIndex: number): number
    {
        return pTable.Bounds.Top
            + XORMMetrics.HeaderHeight
            + XORMMetrics.FieldsPadding
            + pFieldIndex * XORMMetrics.FieldRowHeight;
    }
}
