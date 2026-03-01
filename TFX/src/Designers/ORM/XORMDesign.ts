import { XDesign, XRouteOptions } from "../../Design/XDesign.js";
import { XGuid } from "../../Core/XGuid.js";
import { XRect, XPoint } from "../../Core/XGeometry.js";
import { XProperty } from "../../Core/XProperty.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMField } from "./XORMField.js";
import { XRouterShape, XRouterDirection } from "../../Design/XRouterTypes.js";

export interface XICreateTableOptions
{
    X?: number;
    Y?: number;
    Width?: number;
    Height?: number;
    Name?: string;
}

export interface XICreateReferenceOptions
{
    SourceFieldID: string;
    TargetTableID: string;
    Name?: string;
}

/**
 * XORMDesign - ORM model designer canvas.
 *
 * Line routing uses the XRouter graph-search algorithm (ported from C# XRouter):
 *   - Source exits horizontally (East or West) aligned with the FK field row.
 *   - Target may be entered from any side (East, West, North, South).
 *   - Obstacles (all other tables) are registered so routes go around them.
 *   - Two-pass: first with CheckCrossRect=true; if no valid route found,
 *     retries with CheckCrossRect=false (mirrors C# DoRoute fallback).
 */
export class XORMDesign extends XDesign
{
    public static readonly SchemaProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.Schema,
        "95511660-A5D9-4339-9DE2-62ABD7AB4535",
        "Schema",
        "Database Schema",
        "dbo"
    );

    public static readonly ParentModelProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.ParentModel,
        "C2F5A832-7D4B-4E1F-AC3A-6B7E8D1A4F20",
        "ParentModel",
        "Parent Model",
        ""
    );

    public static readonly StateControlTableProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.StateControlTable,
        "3A8B7C2D-1E4F-4D6A-89C5-2D7E1F8A3B4C",
        "StateControlTable",
        "State Control Table",
        ""
    );

    public static readonly TenantControlTableProp = XProperty.Register<XORMDesign, string>(
        (p: XORMDesign) => p.TenantControlTable,
        "F6E1D9B4-3C2A-4A7E-B8D8-1B4C7E9F2A6D",
        "TenantControlTable",
        "Tenant Control Table",
        ""
    );

    private _TablesWithListeners: Set<string> = new Set<string>();

    public constructor()
    {
        super();
    }

    public get Schema(): string
    {
        return this.GetValue(XORMDesign.SchemaProp) as string;
    }

    public set Schema(pValue: string)
    {
        this.SetValue(XORMDesign.SchemaProp, pValue);
    }

    /**
     * Pipe-separated list of relative parent model file names, e.g. "Auth.dsorm|Common.dsorm".
     * An empty string means no parent models are selected.
     */
    public get ParentModel(): string
    {
        return this.GetValue(XORMDesign.ParentModelProp) as string;
    }

    public set ParentModel(pValue: string)
    {
        this.SetValue(XORMDesign.ParentModelProp, pValue);
    }

    /** Name of the table that controls state (state machine) for this design. */
    public get StateControlTable(): string
    {
        return this.GetValue(XORMDesign.StateControlTableProp) as string;
    }

    public set StateControlTable(pValue: string)
    {
        this.SetValue(XORMDesign.StateControlTableProp, pValue);
    }

    /** Name of the table that controls tenant isolation for this design. */
    public get TenantControlTable(): string
    {
        return this.GetValue(XORMDesign.TenantControlTableProp) as string;
    }

    public set TenantControlTable(pValue: string)
    {
        this.SetValue(XORMDesign.TenantControlTableProp, pValue);
    }

    public override Initialize(): void
    {
        super.Initialize();
        this.SetupTableListeners();
    }

    private SetupTableListeners(): void
    {
        const tables = this.GetTables();
        for (const table of tables)
        {
            if (this._TablesWithListeners.has(table.ID))
                continue;

            this._TablesWithListeners.add(table.ID);
            table.OnPropertyChanged.Add((_pSender, pProperty, _pValue) =>
            {
                if (pProperty.Name === "Bounds")
                    this.RouteAllLines();
            });
        }
    }

    public CreateTable(pOptions?: XICreateTableOptions): XORMTable
    {
        const headerHeight = 28;
        const table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = pOptions?.Name ?? this.GenerateTableName();
        table.Bounds = new XRect(
            pOptions?.X ?? 0,
            pOptions?.Y ?? 0,
            pOptions?.Width ?? 200,
            pOptions?.Height ?? headerHeight  // Empty table = header height only
        );

        this._TablesWithListeners.add(table.ID);
        table.OnPropertyChanged.Add((_pSender, pProperty, _pValue) =>
        {
            if (pProperty.Name === "Bounds")
                this.RouteAllLines();
        });

        this.AppendChild(table);
        return table;
    }

    /**
     * Calculates the visual bounds of a table including dynamically calculated height.
     * Visual height is calculated based on field count, matching the frontend rendering.
     * @param pTable - The table to get visual bounds for
     * @returns XRect with visual bounds (height is calculated, not stored value)
     */
    private GetVisualBounds(pTable: XORMTable): XRect
    {
        const headerHeight = 28;
        const fieldHeight = 16;
        const padding = 12;
        
        const fieldCount = pTable.GetFields().length;
        const visualHeight = fieldCount > 0 
            ? headerHeight + (fieldCount * fieldHeight) + padding
            : headerHeight;
        
        return new XRect(
            pTable.Bounds.Left,
            pTable.Bounds.Top,
            pTable.Bounds.Width,
            visualHeight
        );
    }

    public CreateReference(pOptions: XICreateReferenceOptions): XORMReference
    {
        const sourceField = this.FindFieldByID(pOptions.SourceFieldID);
        const targetTable = this.FindTableByID(pOptions.TargetTableID);

        if (sourceField === null)
            throw new Error("Source field not found.");

        if (targetTable === null)
            throw new Error("Target table not found.");

        const sourceTable = sourceField.ParentNode as XORMTable;
        if (!(sourceTable instanceof XORMTable))
            throw new Error("Source field has no parent table.");

        const reference = new XORMReference();
        reference.ID = XGuid.NewValue();
        reference.Name = pOptions.Name ?? this.GenerateReferenceName(sourceField, targetTable);
        reference.Source = sourceField.ID;
        reference.Target = targetTable.ID;

        const srcBounds = sourceTable.Bounds;
        const tgtBounds = targetTable.Bounds;
        reference.Points = [
            new XPoint(srcBounds.Left + srcBounds.Width, srcBounds.Top + srcBounds.Height / 2),
            new XPoint(tgtBounds.Left, tgtBounds.Top + tgtBounds.Height / 2)
        ];

        this.AppendChild(reference);
        return reference;
    }

    public DeleteTable(pTable: XORMTable): boolean
    {
        if (pTable.ParentNode !== this)
            return false;

        if (!pTable.CanDelete)
            return false;

        this.RemoveReferencesForTable(pTable.ID);
        return this.RemoveChild(pTable);
    }

    public DeleteReference(pReference: XORMReference): boolean
    {
        if (pReference.ParentNode !== this)
            return false;

        if (!pReference.CanDelete)
            return false;

        return this.RemoveChild(pReference);
    }

    public GetTables(): XORMTable[]
    {
        return this.GetChildrenOfType(XORMTable);
    }

    public GetReferences(): XORMReference[]
    {
        return this.GetChildrenOfType(XORMReference);
    }

    public FindTableByID(pID: string): XORMTable | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMTable && child.ID === pID)
                return child;
        }
        return null;
    }

    public FindReferenceByID(pID: string): XORMReference | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMReference && child.ID === pID)
                return child;
        }
        return null;
    }

    public FindReferenceBySourceFieldID(pFieldID: string): XORMReference | null
    {
        for (const child of this.ChildNodes)
        {
            if (child instanceof XORMReference && child.Source === pFieldID)
                return child;
        }
        return null;
    }

    public FindFieldByID(pID: string): XORMField | null
    {
        for (const table of this.GetTables())
        {
            const field = table.FindFieldByID(pID);
            if (field !== null)
                return field;
        }
        return null;
    }

    private RemoveReferencesForTable(pTableID: string): void
    {
        const references = this.GetReferences();
        for (const ref of references)
        {
            const sourceField = this.FindFieldByID(ref.Source);
            const sourceTableID = sourceField?.ParentNode instanceof XORMTable ? sourceField.ParentNode.ID : null;
            if (sourceTableID === pTableID || ref.Target === pTableID)
                this.RemoveChild(ref);
        }
    }

    private GenerateTableName(): string
    {
        const tables = this.GetTables();
        let idx = tables.length + 1;
        let name = `Table${idx}`;

        while (tables.some(t => t.Name.toLowerCase() === name.toLowerCase()))
        {
            idx++;
            name = `Table${idx}`;
        }

        return name;
    }

    private GenerateReferenceName(pSourceField: XORMField, pTargetTable: XORMTable): string
    {
        const sourceTable = pSourceField.ParentNode as XORMTable;
        return `FK_${sourceTable.Name}_${pTargetTable.Name}`;
    }

    /**
     * Routes all ORM references using the XRouter graph-search algorithm.
     * Mirrors the C# XDesigner.DoRoute pattern.
     */
    public override RouteAllLines(_pOptions?: XRouteOptions): void
    {
        this.SetupTableListeners();
        const references = this.GetReferences();
        const tables = this.GetTables();
        for (const ref of references)
            this.RouteReference(ref, tables);
    }

    /**
     * Routes a single reference using the XRouter graph-search algorithm.
     * Source exits horizontally (East/West) at the FK field row Y.
     * Target may be entered from any side.
     * Mirrors the C# XDesigner.DoRoute two-pass approach.
     */
    private RouteReference(pRef: XORMReference, pTables: XORMTable[]): void
    {
        let sourceField = pRef.GetSourceElement<XORMField>();
        if (!sourceField && pRef.Source)
            sourceField = this.FindFieldByID(pRef.Source);

        let sourceTable: XORMTable | null = null;
        let fieldY = NaN;

        if (sourceField)
        {
            sourceTable = sourceField.ParentNode as XORMTable;
            if (!(sourceTable instanceof XORMTable))
                return;

            const fieldIndex = sourceTable.GetFields().findIndex(f => f.ID === sourceField!.ID);
            if (fieldIndex >= 0)
            {
                const headerHeight = 28;
                const fieldHeight = 16;
                fieldY = sourceTable.Bounds.Top + headerHeight + 12 + fieldIndex * fieldHeight;
            }
        }
        else
        {
            sourceTable = this.FindTableByID(pRef.Source);
            if (!sourceTable)
                return;
        }

        let targetTable = pRef.GetTargetElement<XORMTable>();
        if (!targetTable && pRef.Target)
            targetTable = this.FindTableByID(pRef.Target);

        if (!targetTable)
            return;

        const sourceBounds = this.GetVisualBounds(sourceTable);
        const targetBounds = this.GetVisualBounds(targetTable);

        const fieldHeight = 16;
        const fieldRect = isNaN(fieldY)
            ? sourceBounds
            : new XRect(sourceBounds.Left, fieldY - fieldHeight / 2, sourceBounds.Width, fieldHeight);

        const srcShape: XRouterShape = {
            Rect: fieldRect,
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: [XRouterDirection.East, XRouterDirection.West]
        };

        const tgtShape: XRouterShape = {
            Rect: targetBounds,
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: [XRouterDirection.West, XRouterDirection.East, XRouterDirection.North, XRouterDirection.South]
        };

        const router = this.Router;
        router.Gap = 20;
        router.clearObstacles();
        router.setEndpoints(sourceBounds, targetBounds);

        for (const t of pTables)
        {
            if (t.ID !== sourceTable.ID && t.ID !== targetTable.ID)
                router.addObstacle(this.GetVisualBounds(t));
        }

        router.CheckCrossRect = true;
        router.clear();
        let result = router.getAllLines(srcShape, tgtShape);

        if (!result.IsValid || result.Points.length === 0)
        {
            router.CheckCrossRect = false;
            router.clear();
            result = router.getAllLines(srcShape, tgtShape);
        }

        if (result.IsValid && result.Points.length > 0)
            pRef.Points = result.Points;
    }
}
