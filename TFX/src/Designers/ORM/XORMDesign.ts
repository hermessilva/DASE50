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
        // Re-distribute anchors for ALL refs (incoming counts may have changed)
        // so the touched table's incoming arrows redistribute, and references
        // that connect to its FK fields keep proper field-row alignment.
        const touching = refs.filter(r => this.ReferenceTouchesTable(r, pTable));
        if (touching.length === 0)
            return;
        const anchors = this.ComputeAnchorDistribution(refs, tables);
        for (const ref of touching)
            this.RouteReference(ref, tables, anchors.get(ref.ID));
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
        const anchors = this.ComputeAnchorDistribution(references, tables);
        for (const ref of references)
            this.RouteReference(ref, tables, anchors.get(ref.ID));
    }

    /**
     * For each reference, computes the exact entry point on the target side and
     * the explicit exit point on the source side, distributing N parallel
     * connections evenly along each side so arrows do not stack at one spot.
     */
    private ComputeAnchorDistribution(
        pRefs: XORMReference[],
        _pTables: XORMTable[]
    ): Map<string, { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection } | undefined>
    {
        interface IPlan {
            Ref: XORMReference;
            SourceTable: XORMTable;
            TargetTable: XORMTable;
            SourceBounds: XRect;
            TargetBounds: XRect;
            SourceFieldY: number;
        }

        const plans: IPlan[] = [];
        for (const ref of pRefs)
        {
            let sourceField = ref.GetSourceElement<XORMField>();
            if (!sourceField && ref.Source)
                sourceField = this.FindFieldByID(ref.Source);

            let sourceTable: XORMTable | null = null;
            let fieldY = NaN;

            if (sourceField)
            {
                sourceTable = sourceField.ParentNode as XORMTable;
                if (!(sourceTable instanceof XORMTable))
                    continue;
                const idx = sourceTable.GetFields().findIndex(f => f.ID === sourceField!.ID);
                if (idx >= 0)
                    fieldY = XORMMetrics.GetFieldRowY(sourceTable, idx);
            }
            else
            {
                sourceTable = this.FindTableByID(ref.Source);
                if (!sourceTable)
                    continue;
            }

            let targetTable = ref.GetTargetElement<XORMTable>();
            if (!targetTable && ref.Target)
                targetTable = this.FindTableByID(ref.Target);
            if (!targetTable)
                continue;

            plans.push({
                Ref: ref,
                SourceTable: sourceTable,
                TargetTable: targetTable,
                SourceBounds: this.GetVisualBounds(sourceTable),
                TargetBounds: this.GetVisualBounds(targetTable),
                SourceFieldY: fieldY
            });
        }

        // Group by (target, target-side) for incoming distribution
        const incomingBySide = new Map<string, IPlan[]>();
        const planSides = new Map<IPlan, { TargetSide: XRouterDirection; SourceSide: XRouterDirection }>();
        for (const plan of plans)
        {
            const tSide = this.PickEntrySide(plan.SourceBounds, plan.TargetBounds);
            // The FK line MUST leave the source horizontally (East/West) at the
            // field-row height — never from the top/bottom. Choose the side that
            // faces the target.
            const srcCx = plan.SourceBounds.Left + plan.SourceBounds.Width / 2;
            const tgtCx = plan.TargetBounds.Left + plan.TargetBounds.Width / 2;
            const sSide = tgtCx >= srcCx ? XRouterDirection.East : XRouterDirection.West;
            planSides.set(plan, { TargetSide: tSide, SourceSide: sSide });
            const key = `${plan.TargetTable.ID}|${tSide}`;
            if (!incomingBySide.has(key)) incomingBySide.set(key, []);
            incomingBySide.get(key)!.push(plan);
        }

        const result = new Map<string, { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection } | undefined>();

        for (const [, group] of incomingBySide)
        {
            const tSide = planSides.get(group[0])!.TargetSide;
            const tBounds = group[0].TargetBounds;
            // Sort by where each line LEAVES its source so arrival order matches
            // departure order (prevents the connecting lines from crossing).
            // For E/W target sides the relevant departure coordinate is the source
            // FK field-row Y (falling back to the source center Y).
            const srcKey = (p: IPlan): number =>
            {
                if (tSide === XRouterDirection.East || tSide === XRouterDirection.West)
                    return isNaN(p.SourceFieldY)
                        ? p.SourceBounds.Top + p.SourceBounds.Height / 2
                        : p.SourceFieldY;
                return p.SourceBounds.Left + p.SourceBounds.Width / 2;
            };
            group.sort((a, b) => srcKey(a) - srcKey(b));

            const n = group.length;
            for (let i = 0; i < n; i++)
            {
                const t = (i + 1) / (n + 1);
                const tAnchor = this.AnchorOnSide(tBounds, tSide, t);
                const plan = group[i];
                const sides = planSides.get(plan)!;
                const sAnchor = this.SourceAnchor(plan.SourceBounds, sides.SourceSide, plan.SourceFieldY);
                result.set(plan.Ref.ID, {
                    TargetAnchor: tAnchor,
                    TargetSide: tSide,
                    SourceAnchor: sAnchor,
                    SourceSide: sides.SourceSide
                });
            }
        }

        return result;
    }

    private PickEntrySide(pFrom: XRect, pTo: XRect): XRouterDirection
    {
        const fromCx = pFrom.Left + pFrom.Width / 2;
        const fromCy = pFrom.Top + pFrom.Height / 2;
        const toCx = pTo.Left + pTo.Width / 2;
        const toCy = pTo.Top + pTo.Height / 2;
        const dx = fromCx - toCx;
        const dy = fromCy - toCy;
        if (Math.abs(dx) >= Math.abs(dy))
            return dx >= 0 ? XRouterDirection.East : XRouterDirection.West;
        return dy >= 0 ? XRouterDirection.South : XRouterDirection.North;
    }

    private AnchorOnSide(pRect: XRect, pSide: XRouterDirection, pT: number): XPoint
    {
        const margin = XORMMetrics.RouterGap / 2;
        const inset = Math.min(margin, Math.min(pRect.Width, pRect.Height) / 4);
        switch (pSide)
        {
            case XRouterDirection.East:
                return new XPoint(pRect.Left + pRect.Width, pRect.Top + inset + (pRect.Height - 2 * inset) * pT);
            case XRouterDirection.West:
                return new XPoint(pRect.Left, pRect.Top + inset + (pRect.Height - 2 * inset) * pT);
            case XRouterDirection.North:
                return new XPoint(pRect.Left + inset + (pRect.Width - 2 * inset) * pT, pRect.Top);
            default: // South
                return new XPoint(pRect.Left + inset + (pRect.Width - 2 * inset) * pT, pRect.Top + pRect.Height);
        }
    }

    private SourceAnchor(pBounds: XRect, pSide: XRouterDirection, pFieldY: number): XPoint
    {
        if (pSide === XRouterDirection.East)
            return new XPoint(pBounds.Left + pBounds.Width, isNaN(pFieldY) ? pBounds.Top + pBounds.Height / 2 : pFieldY);
        if (pSide === XRouterDirection.West)
            return new XPoint(pBounds.Left, isNaN(pFieldY) ? pBounds.Top + pBounds.Height / 2 : pFieldY);
        if (pSide === XRouterDirection.North)
            return new XPoint(pBounds.Left + pBounds.Width / 2, pBounds.Top);
        return new XPoint(pBounds.Left + pBounds.Width / 2, pBounds.Top + pBounds.Height);
    }

    /**
     * Routes a single reference using the XRouter graph-search algorithm.
     * Source exits horizontally (East/West) at the FK field row Y.
     * Target may be entered from any side.
     * Mirrors the C# XDesigner.DoRoute two-pass approach.
     */
    private RouteReference(
        pRef: XORMReference,
        pTables: XORMTable[],
        pAnchor?: { TargetAnchor: XPoint; TargetSide: XRouterDirection; SourceAnchor: XPoint; SourceSide: XRouterDirection }
    ): void
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

        const srcDirs = pAnchor
            ? [pAnchor.SourceSide]
            : this.PickSourceDirections(sourceBounds, targetBounds);
        const tgtDirs = pAnchor
            ? [pAnchor.TargetSide]
            : this.PickTargetDirections(sourceBounds, targetBounds);

        const srcStart = pAnchor
            ? pAnchor.SourceAnchor
            : (isNaN(fieldY) ? new XPoint(NaN, NaN) : new XPoint(NaN, fieldY));
        const tgtStart = pAnchor
            ? pAnchor.TargetAnchor
            : new XPoint(NaN, NaN);

        const srcShape: XRouterShape = {
            Rect: fieldRect,
            StartPoint: srcStart,
            DesiredDegree: srcDirs
        };

        const tgtShape: XRouterShape = {
            Rect: targetBounds,
            StartPoint: tgtStart,
            DesiredDegree: tgtDirs
        };

        const router = this.Router;
        router.Gap = XORMMetrics.RouterGap;
        router.clearObstacles();
        router.setEndpoints(sourceBounds, targetBounds);

        const clearance = XORMMetrics.RouterGap / 2;
        for (const t of pTables)
        {
            if (t.ID !== sourceTable.ID && t.ID !== targetTable.ID)
            {
                const b = this.GetVisualBounds(t);
                router.addObstacle(new XRect(
                    b.Left - clearance,
                    b.Top - clearance,
                    b.Width + clearance * 2,
                    b.Height + clearance * 2
                ));
            }
        }

        router.CheckCrossRect = true;
        router.clear();
        let result = router.getAllLines(srcShape, tgtShape);

        if (!result.IsValid || result.Points.length === 0)
        {
            router.CheckCrossRect = false;
            router.clearObstacles();
            router.clear();
            result = router.getAllLines(srcShape, tgtShape);
        }

        if (result.IsValid && result.Points.length > 0)
        {
            pRef.Points = result.Points;
            return;
        }

        // Final guard: if no route was found, fall back to a direct two-point
        // line between the chosen anchors so the reference always renders.
        const srcPt = pAnchor
            ? pAnchor.SourceAnchor
            : new XPoint(sourceBounds.Left + sourceBounds.Width, sourceBounds.Top + sourceBounds.Height / 2);
        const tgtPt = pAnchor
            ? pAnchor.TargetAnchor
            : new XPoint(targetBounds.Left, targetBounds.Top + targetBounds.Height / 2);
        pRef.Points = [srcPt, tgtPt];
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
