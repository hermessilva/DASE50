import { XDesign, XRouteOptions } from "../../Design/XDesign.js";
import { XGuid } from "../../Core/XGuid.js";
import { XRect, XPoint } from "../../Core/XGeometry.js";
import { XProperty } from "../../Core/XProperty.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMStateReference } from "./XORMStateReference.js";
import { XORMField } from "./XORMField.js";
import { XRouterShape, XRouterDirection } from "../../Design/XRouterTypes.js";
import { XORMMetrics } from "./XORMMetrics.js";

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

export interface XIEnableStateControlResult
{
    Success: boolean;
    Message?: string;
    StateFieldID?: string;
    StateReferenceID?: string;
    /** True if a shadow table was auto-created to represent the cross-model state table. */
    ShadowTableCreated?: boolean;
    ShadowTableID?: string;
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
    private _RoutingSuspendDepth: number = 0;
    private _RoutingDirty: boolean = false;

    public constructor()
    {
        super();
    }

    public SuspendRouting(): void
    {
        this._RoutingSuspendDepth++;
    }

    public ResumeRouting(pRouteIfDirty: boolean = true): void
    {
        if (this._RoutingSuspendDepth > 0)
            this._RoutingSuspendDepth--;
        if (this._RoutingSuspendDepth === 0 && this._RoutingDirty && pRouteIfDirty)
        {
            this._RoutingDirty = false;
            this.RouteAllLines();
        }
    }

    public get IsRoutingSuspended(): boolean
    {
        return this._RoutingSuspendDepth > 0;
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
            this.AttachTableListener(table);
    }

    private AttachTableListener(pTable: XORMTable): void
    {
        if (this._TablesWithListeners.has(pTable.ID))
            return;

        this._TablesWithListeners.add(pTable.ID);
        pTable.OnPropertyChanged.Add((pSender, pProperty, _pValue) =>
        {
            if (pProperty.Name !== "Bounds")
                return;
            if (this._RoutingSuspendDepth > 0)
            {
                this._RoutingDirty = true;
                return;
            }
            const t = pSender as XORMTable;
            this.RouteReferencesOf(t);
        });
    }

    public RouteReferencesOf(pTable: XORMTable): void
    {
        const refs = this.GetReferences();
        const tables = this.GetTables();
        for (const ref of refs)
        {
            if (this.ReferenceTouchesTable(ref, pTable))
                this.RouteReference(ref, tables);
        }
    }

    private ReferenceTouchesTable(pRef: XORMReference, pTable: XORMTable): boolean
    {
        if (pRef.Target === pTable.ID)
            return true;
        const srcField = this.FindFieldByID(pRef.Source);
        if (srcField?.ParentNode instanceof XORMTable && srcField.ParentNode.ID === pTable.ID)
            return true;
        if (pRef.Source === pTable.ID)
            return true;
        return false;
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

        this.AttachTableListener(table);

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
        return XORMMetrics.GetVisualBounds(pTable);
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

    /**
     * Enables the state-control pattern for the given table.
     *
     * Creates an XORMStateField and XORMStateReference linking the table to the design's
     * StateControlTable. If the state table is not found in the current design a shadow
     * table is automatically created.
     *
     * The operation is idempotent: calling it again when already enabled returns success
     * with the existing field/reference IDs.
     */
    public EnableStateControl(pTable: XORMTable): XIEnableStateControlResult
    {
        if (pTable.ParentNode !== this)
            return { Success: false, Message: "Table does not belong to this design." };

        const stateTableName = this.StateControlTable.trim();
        if (!stateTableName)
            return { Success: false, Message: "StateControlTable is not set on the design." };

        // Idempotency: already enabled and field exists
        const existingField = pTable.GetStateField();
        if (existingField && pTable.UseStateControl)
        {
            const existingRef = this.GetStateReferenceForTable(pTable.ID);
            return {
                Success: true,
                StateFieldID: existingField.ID,
                StateReferenceID: existingRef?.ID
            };
        }

        // Locate or auto-create the state control table
        let targetTable = this.GetTables().find(t => t.Name === stateTableName) ?? null;
        let shadowCreated = false;
        let shadowTableID: string | undefined;

        if (targetTable === null)
        {
            // Not in current design → create a shadow placeholder
            const shadowX = pTable.Bounds.X + pTable.Bounds.Width + 60;
            const shadowY = pTable.Bounds.Y;
            targetTable = this.CreateTable({ Name: stateTableName, X: shadowX, Y: shadowY });
            targetTable.IsShadow = true;
            targetTable.ShadowTableName = stateTableName;
            shadowCreated = true;
            shadowTableID = targetTable.ID;
        }

        // DataType inherits the target table's PKType (always non-empty — default is "Int32")
        const fieldDataType = targetTable.PKType;
        const stateField = pTable.CreateStateField(fieldDataType, `${stateTableName}ID`);

        // Create the invisible XORMStateReference
        const stateRef = new XORMStateReference();
        stateRef.ID = XGuid.NewValue();
        stateRef.Name = `FK_${pTable.Name}_${stateTableName}`;
        stateRef.Source = stateField.ID;
        stateRef.Target = targetTable.ID;
        stateRef.Points = [
            new XPoint(pTable.Bounds.Left + pTable.Bounds.Width, pTable.Bounds.Top + pTable.Bounds.Height / 2),
            new XPoint(targetTable.Bounds.Left, targetTable.Bounds.Top + targetTable.Bounds.Height / 2)
        ];
        this.AppendChild(stateRef);

        pTable.UseStateControl = true;

        return {
            Success: true,
            StateFieldID: stateField.ID,
            StateReferenceID: stateRef.ID,
            ShadowTableCreated: shadowCreated,
            ShadowTableID: shadowTableID
        };
    }

    /**
     * Disables the state-control pattern for the given table.
     *
     * Removes the XORMStateReference and the XORMStateField, then clears UseStateControl.
     * The shadow table (if it was auto-created) is NOT removed automatically.
     *
     * @returns true on success; false if the table does not belong to this design.
     */
    public DisableStateControl(pTable: XORMTable): boolean
    {
        if (pTable.ParentNode !== this)
            return false;

        // Remove the state reference first
        const stateRef = this.GetStateReferenceForTable(pTable.ID);
        if (stateRef)
            this.RemoveChild(stateRef);

        // Remove the state field from the table
        pTable.DeleteStateField();

        pTable.UseStateControl = false;
        return true;
    }

    /** Finds the XORMStateReference whose source field belongs to the given table. */
    private GetStateReferenceForTable(pTableID: string): XORMStateReference | null
    {
        for (const child of this.ChildNodes)
        {
            if (!(child instanceof XORMStateReference))
                continue;
            const sourceField = this.FindFieldByID(child.Source);
            if (sourceField?.ParentNode instanceof XORMTable && sourceField.ParentNode.ID === pTableID)
                return child;
        }
        return null;
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
        if (this._RoutingSuspendDepth > 0)
        {
            this._RoutingDirty = true;
            return;
        }
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
                fieldY = XORMMetrics.GetFieldRowY(sourceTable, fieldIndex);
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

        const fieldRect = isNaN(fieldY)
            ? sourceBounds
            : new XRect(
                sourceBounds.Left,
                fieldY - XORMMetrics.FieldRowHeight / 2,
                sourceBounds.Width,
                XORMMetrics.FieldRowHeight
              );

        const srcDirs = this.PickSourceDirections(sourceBounds, targetBounds);
        const tgtDirs = this.PickTargetDirections(sourceBounds, targetBounds);

        const srcShape: XRouterShape = {
            Rect: fieldRect,
            StartPoint: isNaN(fieldY) ? new XPoint(NaN, NaN) : new XPoint(NaN, fieldY),
            DesiredDegree: srcDirs
        };

        const tgtShape: XRouterShape = {
            Rect: targetBounds,
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: tgtDirs
        };

        const router = this.Router;
        router.Gap = XORMMetrics.RouterGap;
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

    private PickSourceDirections(pSource: XRect, pTarget: XRect): XRouterDirection[]
    {
        if (pTarget.Left >= pSource.Right)
            return [XRouterDirection.East, XRouterDirection.West];
        if (pTarget.Right <= pSource.Left)
            return [XRouterDirection.West, XRouterDirection.East];
        return [XRouterDirection.East, XRouterDirection.West];
    }

    private PickTargetDirections(pSource: XRect, pTarget: XRect): XRouterDirection[]
    {
        const dirs: XRouterDirection[] = [];
        if (pTarget.Left >= pSource.Right)
            dirs.push(XRouterDirection.West);
        else if (pTarget.Right <= pSource.Left)
            dirs.push(XRouterDirection.East);

        if (pTarget.Top >= pSource.Bottom)
            dirs.push(XRouterDirection.North);
        else if (pTarget.Bottom <= pSource.Top)
            dirs.push(XRouterDirection.South);

        if (dirs.indexOf(XRouterDirection.West) < 0) dirs.push(XRouterDirection.West);
        if (dirs.indexOf(XRouterDirection.East) < 0) dirs.push(XRouterDirection.East);
        if (dirs.indexOf(XRouterDirection.North) < 0) dirs.push(XRouterDirection.North);
        if (dirs.indexOf(XRouterDirection.South) < 0) dirs.push(XRouterDirection.South);
        return dirs;
    }
}
