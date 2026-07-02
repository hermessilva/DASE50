import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XGuid } from "../src/Core/XGuid.js";
import { XRect, XPoint } from "../src/Core/XGeometry.js";
import { emptyRouterLine, createRouterLine } from "../src/Design/XRouterTypes.js";

// These tests exercise internal/private branches of XORMDesign.RouteReference
// to satisfy the repo strict 100% coverage thresholds.

describe("XORMDesign internal coverage", () =>
{
    beforeEach(() =>
    {
        RegisterORMElements();
    });

    it("SetupTableListeners should add a Bounds listener that re-routes affected", () =>
    {
        const design = new XORMDesign();

        const table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = "Table1";
        table.Schema = "dbo";
        table.Bounds = new XRect(0, 0, 100, 100);

        design.AppendChild(table as any);

        const spy = vi.spyOn(design, "RouteReferencesOf").mockImplementation(() => undefined);

        (design as any).SetupTableListeners();

        table.OnPropertyChanged.Invoke(table as any, { Name: "Bounds" } as any, null);
        expect(spy).toHaveBeenCalled();

        spy.mockClear();
        table.OnPropertyChanged.Invoke(table as any, { Name: "Name" } as any, null);
        expect(spy).not.toHaveBeenCalled();
    });

    it("SetupTableListeners should skip tables already registered", () =>
    {
        const design = new XORMDesign();
        const table = design.CreateTable({ Name: "T1", X: 10, Y: 10, Width: 100, Height: 80 });

        (design as any).SetupTableListeners();

        const spy = vi.spyOn(design, "RouteReferencesOf").mockImplementation(() => undefined);
        (design as any).SetupTableListeners();

        table.OnPropertyChanged.Invoke(table as any, { Name: "Bounds" } as any, null);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("CreateTable should add a Bounds listener that re-routes affected", () =>
    {
        const design = new XORMDesign();
        const spy = vi.spyOn(design, "RouteReferencesOf").mockImplementation(() => undefined);

        const table = design.CreateTable({ Name: "T", X: 10, Y: 20, Width: 200, Height: 150 });
        expect(table.Bounds.Left).toBe(10);
        expect(table.Bounds.Top).toBe(20);

        table.OnPropertyChanged.Invoke(table as any, { Name: "Bounds" } as any, null);
        expect(spy).toHaveBeenCalled();
    });

    it("SuspendRouting / ResumeRouting batches into single re-route", () =>
    {
        const design = new XORMDesign();
        const table = design.CreateTable({ Name: "T", X: 0, Y: 0, Width: 100, Height: 100 });

        const spy = vi.spyOn(design, "RouteAllLines");
        spy.mockClear();

        design.SuspendRouting();
        expect(design.IsRoutingSuspended).toBe(true);
        table.Bounds = new XRect(10, 10, 100, 100);
        table.Bounds = new XRect(20, 20, 100, 100);
        design.ResumeRouting();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("ResumeRouting with pRouteIfDirty=false skips flush", () =>
    {
        const design = new XORMDesign();
        const table = design.CreateTable({ Name: "T", X: 0, Y: 0, Width: 100, Height: 100 });

        design.SuspendRouting();
        const spy = vi.spyOn(design, "RouteAllLines");
        spy.mockClear();
        table.Bounds = new XRect(10, 10, 100, 100);
        design.ResumeRouting(false);
        expect(spy).not.toHaveBeenCalled();
    });

    it("RouteAllLines short-circuits and marks dirty when suspended", () =>
    {
        const design = new XORMDesign();
        design.CreateTable({ Name: "T", X: 0, Y: 0, Width: 100, Height: 100 });
        design.SuspendRouting();
        design.RouteAllLines();
        const spy = vi.spyOn(design, "RouteAllLines");
        design.ResumeRouting();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("ResumeRouting drops below zero is a no-op", () =>
    {
        const design = new XORMDesign();
        design.ResumeRouting();
        expect(design.IsRoutingSuspended).toBe(false);
    });

    it("ReferenceTouchesTable returns false for unrelated reference", () =>
    {
        const design = new XORMDesign();
        const t1 = design.CreateTable({ Name: "T1", X: 0, Y: 0, Width: 100, Height: 100 });
        const t2 = design.CreateTable({ Name: "T2", X: 200, Y: 0, Width: 100, Height: 100 });
        const tUnrelated = design.CreateTable({ Name: "T3", X: 400, Y: 0, Width: 100, Height: 100 });
        const f1 = t1.CreateField({ Name: "F1" });
        const ref = new XORMReference();
        ref.ID = XGuid.NewValue();
        ref.Source = f1.ID;
        ref.Target = t2.ID;
        design.AppendChild(ref as any);
        expect((design as any).ReferenceTouchesTable(ref, tUnrelated)).toBe(false);
    });

    it("RouteReferencesOf routes only touching refs, skips unrelated", () =>
    {
        const design = new XORMDesign();
        const t1 = design.CreateTable({ Name: "T1", X: 0, Y: 0, Width: 100, Height: 100 });
        const t2 = design.CreateTable({ Name: "T2", X: 200, Y: 0, Width: 100, Height: 100 });
        const t3 = design.CreateTable({ Name: "T3", X: 400, Y: 0, Width: 100, Height: 100 });
        const f1 = t1.CreateField({ Name: "F1" });
        const f2 = t2.CreateField({ Name: "F2" });
        const refTouching = new XORMReference();
        refTouching.ID = XGuid.NewValue();
        refTouching.Source = f1.ID;
        refTouching.Target = t2.ID;
        design.AppendChild(refTouching as any);
        const refUnrelated = new XORMReference();
        refUnrelated.ID = XGuid.NewValue();
        refUnrelated.Source = f2.ID;
        refUnrelated.Target = t3.ID;
        design.AppendChild(refUnrelated as any);

        const spy = vi.spyOn(design as any, "RouteReference");
        design.RouteReferencesOf(t1);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("RouteReference should cover linked-element vs fallback resolution", () =>
    {
        const design = new XORMDesign();

        const sourceTable = new XORMTable();
        sourceTable.ID = XGuid.NewValue();
        sourceTable.Name = "Source";
        sourceTable.Schema = "dbo";
        sourceTable.Bounds = new XRect(0, 0, 200, 150);
        const sourceField = sourceTable.CreateField({ Name: "FK_Field" });

        const targetTable = new XORMTable();
        targetTable.ID = XGuid.NewValue();
        targetTable.Name = "Target";
        targetTable.Schema = "dbo";
        targetTable.Bounds = new XRect(400, 0, 200, 150);

        design.AppendChild(sourceTable as any);
        design.AppendChild(targetTable as any);

        const refLinked = new XORMReference();
        refLinked.ID = XGuid.NewValue();
        refLinked.Source = sourceField.ID;
        refLinked.Target = targetTable.ID;
        (refLinked as any).GetSourceElement = () => sourceField;
        (refLinked as any).GetTargetElement = () => targetTable;

        (design as any).RouteReference(refLinked, [sourceTable, targetTable]);

        const refFallback = new XORMReference();
        refFallback.ID = XGuid.NewValue();
        refFallback.Source = sourceField.ID;
        refFallback.Target = targetTable.ID;
        (refFallback as any).GetSourceElement = () => null;
        (refFallback as any).GetTargetElement = () => null;

        (design as any).RouteReference(refFallback, [sourceTable, targetTable]);

        expect(refLinked.Points.length).toBeGreaterThan(0);
        expect(refFallback.Points.length).toBeGreaterThan(0);
    });

    it("RouteReference should route Table-to-Table references (source is a table ID)", () =>
    {
        const design = new XORMDesign();

        const sourceTable = design.CreateTable({ Name: "SrcTable", X: 0, Y: 0, Width: 200, Height: 120 });
        const targetTable = design.CreateTable({ Name: "TgtTable", X: 400, Y: 0, Width: 200, Height: 120 });

        const ref = new XORMReference();
        ref.ID = XGuid.NewValue();
        ref.Source = sourceTable.ID;
        ref.Target = targetTable.ID;
        (ref as any).GetSourceElement = () => null;
        (ref as any).GetTargetElement = () => null;
        design.AppendChild(ref as any);

        expect(() => (design as any).RouteReference(ref, [sourceTable, targetTable])).not.toThrow();
        expect(ref.Points.length).toBeGreaterThan(0);
    });

    it("RouteReference should abort when source resolves to neither field nor table", () =>
    {
        const design = new XORMDesign();
        const targetTable = design.CreateTable({ Name: "T", X: 400, Y: 0, Width: 200, Height: 100 });

        const ref = new XORMReference();
        ref.ID = XGuid.NewValue();
        ref.Source = XGuid.NewValue();
        ref.Target = targetTable.ID;
        (ref as any).GetSourceElement = () => null;
        (ref as any).GetTargetElement = () => targetTable;
        design.AppendChild(ref as any);

        ref.Points = [];
        (design as any).RouteReference(ref, [targetTable]);
        expect(ref.Points.length).toBe(0);
    });

    it("RouteReference should abort when target is not found", () =>
    {
        const design = new XORMDesign();
        const sourceTable = design.CreateTable({ Name: "Src", X: 0, Y: 0, Width: 200, Height: 120 });
        const field = sourceTable.CreateField({ Name: "FK" });

        const ref = new XORMReference();
        ref.ID = XGuid.NewValue();
        ref.Source = field.ID;
        ref.Target = XGuid.NewValue();
        (ref as any).GetSourceElement = () => field;
        (ref as any).GetTargetElement = () => null;
        design.AppendChild(ref as any);

        ref.Points = [];
        (design as any).RouteReference(ref, [sourceTable]);
        expect(ref.Points.length).toBe(0);
    });

    it("RouteReference executes second pass when first router pass returns no valid route", () =>
    {
        const design = new XORMDesign();
        const sourceTable = design.CreateTable({ Name: "Src", X: 0, Y: 0, Width: 200, Height: 120 });
        const field = sourceTable.CreateField({ Name: "FK" });
        const targetTable = design.CreateTable({ Name: "Tgt", X: 400, Y: 0, Width: 200, Height: 120 });

        const validRoute = createRouterLine([new XPoint(200, 60), new XPoint(400, 60)]);

        let callCount = 0;
        const router = (design as any).Router;
        const spy = vi.spyOn(router, "getAllLines").mockImplementation(() =>
        {
            callCount++;
            return callCount === 1 ? emptyRouterLine() : validRoute;
        });

        const ref = new XORMReference();
        ref.ID = XGuid.NewValue();
        ref.Source = field.ID;
        ref.Target = targetTable.ID;
        (ref as any).GetSourceElement = () => field;
        (ref as any).GetTargetElement = () => targetTable;
        design.AppendChild(ref as any);

        (design as any).RouteReference(ref, [sourceTable, targetTable]);

        expect(spy).toHaveBeenCalledTimes(2);
        expect(ref.Points.length).toBeGreaterThan(0);
    });

    it("RouteReference falls back to an orthogonal L/Z route when both router passes return invalid", () =>
    {
        const design = new XORMDesign();
        const sourceTable = design.CreateTable({ Name: "Src", X: 0, Y: 0, Width: 200, Height: 120 });
        const field = sourceTable.CreateField({ Name: "FK" });
        const targetTable = design.CreateTable({ Name: "Tgt", X: 400, Y: 0, Width: 200, Height: 120 });

        const router = (design as any).Router;
        vi.spyOn(router, "getAllLines").mockReturnValue(emptyRouterLine());

        const ref = new XORMReference();
        ref.ID = XGuid.NewValue();
        ref.Source = field.ID;
        ref.Target = targetTable.ID;
        (ref as any).GetSourceElement = () => field;
        (ref as any).GetTargetElement = () => targetTable;
        ref.Points = [];
        design.AppendChild(ref as any);

        (design as any).RouteReference(ref, [sourceTable, targetTable]);

        // Orthogonal fallback: at least two points, and every segment is H or V.
        expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        for (let i = 1; i < ref.Points.length; i++)
        {
            const a = ref.Points[i - 1];
            const b = ref.Points[i];
            const horizontal = Math.abs(a.Y - b.Y) < 0.5;
            const vertical = Math.abs(a.X - b.X) < 0.5;
            expect(horizontal || vertical).toBe(true);
        }
    });
});
