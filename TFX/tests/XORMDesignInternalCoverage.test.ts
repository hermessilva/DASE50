import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XGuid } from "../src/Core/XGuid.js";
import { XPoint, XRect } from "../src/Core/XGeometry.js";

// These tests intentionally exercise internal/private branches to satisfy
// the repo's strict 100% coverage thresholds.

describe("XORMDesign internal coverage", () =>
{
    beforeEach(() =>
    {
        RegisterORMElements();
    });

    it("SetupTableListeners should add a Bounds listener that re-routes", () =>
    {
        const design = new XORMDesign();

        const table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = "Table1";
        table.Schema = "dbo";
        table.Bounds = new XRect(0, 0, 100, 100);

        design.AppendChild(table as any);

        const spy = vi.spyOn(design, "RouteAllLines").mockImplementation(() => undefined);

        // Call private setup directly to cover the internal branch.
        (design as any).SetupTableListeners();

        table.OnPropertyChanged.Invoke(table as any, { Name: "Bounds" } as any, null);
        expect(spy).toHaveBeenCalled();

        // Non-Bounds property changes should not re-route
        spy.mockClear();
        table.OnPropertyChanged.Invoke(table as any, { Name: "Name" } as any, null);
        expect(spy).not.toHaveBeenCalled();
    });

    it("CreateTable should add a Bounds listener that re-routes", () =>
    {
        const design = new XORMDesign();
        const spy = vi.spyOn(design, "RouteAllLines").mockImplementation(() => undefined);

        const table = design.CreateTable({ Name: "T", Schema: "dbo", X: 10, Y: 20, Width: 200, Height: 150 });
        expect(table.Bounds.Left).toBe(10);
        expect(table.Bounds.Top).toBe(20);

        table.OnPropertyChanged.Invoke(table as any, { Name: "Bounds" } as any, null);
        expect(spy).toHaveBeenCalled();
    });

    it("BuildOrthogonalPath should take the internal C-route branch when requested", () =>
    {
        const design = new XORMDesign();

        const start = new XPoint(0, 10);
        const end = new XPoint(0, 50);

        const sourceBounds = new XRect(0, 0, 10, 10);
        const targetBounds = new XRect(0, 40, 10, 10);

        // XConnectionSide is a private enum inside the module. By inspection: Left=0, Right=1, Top=2, Bottom=3.
        const pointsCRoute = (design as any).BuildOrthogonalPath(
            start,
            end,
            true,
            1, // Right
            sourceBounds,
            targetBounds,
            [],
            10,
            20
        ) as XPoint[];

        expect(pointsCRoute.length).toBe(3);
        expect(pointsCRoute[0].Y).toBe(10);
        expect(pointsCRoute[1].Y).toBe(50);
        expect(pointsCRoute[2]).toEqual(end);
    });

    it("BuildOrthogonalPath should take the internal C-route branch for left-exit as well", () =>
    {
        const design = new XORMDesign();

        const start = new XPoint(0, 10);
        const end = new XPoint(0, 50);

        const sourceBounds = new XRect(0, 0, 10, 10);
        const targetBounds = new XRect(0, 40, 10, 10);

        const pointsCRoute = (design as any).BuildOrthogonalPath(
            start,
            end,
            false,
            0, // Left
            sourceBounds,
            targetBounds,
            [],
            10,
            20
        ) as XPoint[];

        expect(pointsCRoute.length).toBe(3);
        expect(pointsCRoute[0].Y).toBe(10);
        expect(pointsCRoute[1].Y).toBe(50);
        expect(pointsCRoute[2]).toEqual(end);
    });

    it("BuildOrthogonalPath should add a horizontal segment for Top/Bottom routes when needed", () =>
    {
        const design = new XORMDesign();

        const start = new XPoint(0, 0);
        const sourceBounds = new XRect(0, 0, 0, 0);

        const targetBounds = new XRect(200, 100, 100, 100);
        const end = new XPoint(260, 100); // Top entry point

        const points = (design as any).BuildOrthogonalPath(
            start,
            end,
            true,
            2, // Top
            sourceBounds,
            targetBounds,
            [],
            5,
            10
        ) as XPoint[];

        // Ensure the "Point 3" horizontal alignment segment was included.
        expect(points.some(p => p.X === end.X && p.Y !== end.Y)).toBe(true);
    });

    it("BuildOrthogonalPath should include the approachY segment when intermediateY differs", () =>
    {
        const design = new XORMDesign();

        // Make start below target while still requesting a Top entry to force CalculateIntermediateY to adjust.
        const targetBounds = new XRect(100, 100, 100, 100);
        const sourceBounds = new XRect(0, 0, 10, 10);

        const start = new XPoint(0, 300);
        const end = new XPoint(150, targetBounds.Top); // Top entry point

        const gap = 5;
        const minSegment = 10;
        const approachY = targetBounds.Top - minSegment;

        const points = (design as any).BuildOrthogonalPath(
            start,
            end,
            true,
            2, // Top
            sourceBounds,
            targetBounds,
            [],
            gap,
            minSegment
        ) as XPoint[];

        // This specifically covers the branch that adds the (end.X, approachY) point.
        expect(points.some(p => p.X === end.X && p.Y === approachY)).toBe(true);
    });

    it("BuildOrthogonalPath should skip optional segments when already aligned", () =>
    {
        const design = new XORMDesign();

        const targetBounds = new XRect(100, 100, 100, 100);
        const sourceBounds = new XRect(0, 0, 0, 0);

        const gap = 5;
        const minSegment = 10;
        const approachY = targetBounds.Top - minSegment; // 90

        const start = new XPoint(0, approachY);
        const firstSegmentX = Math.max(start.X + minSegment, sourceBounds.Right + minSegment);
        const end = new XPoint(firstSegmentX, targetBounds.Top);

        const points = (design as any).BuildOrthogonalPath(
            start,
            end,
            true,
            2, // Top
            sourceBounds,
            targetBounds,
            [],
            gap,
            minSegment
        ) as XPoint[];

        // Only the initial horizontal point and the final point should exist.
        expect(points.length).toBe(2);
        expect(points[0]).toEqual(new XPoint(firstSegmentX, start.Y));
        expect(points[1]).toEqual(end);
    });

    it("CalculateIntermediateY should handle sourceAbove branch", () =>
    {
        const design = new XORMDesign();

        const targetBounds = new XRect(100, 100, 100, 100);
        const sourceBounds = new XRect(0, 0, 10, 10);

        const approachY = 90;
        const result = (design as any).CalculateIntermediateY(
            0, // startY above target
            approachY,
            targetBounds,
            sourceBounds,
            5
        ) as number;

        expect(result).toBe(90);
    });

    it("CalculateIntermediateY should handle sourceBelow branch", () =>
    {
        const design = new XORMDesign();

        const targetBounds = new XRect(100, 100, 100, 100); // Bottom = 200
        const sourceBounds = new XRect(0, 0, 10, 10);

        const approachY = 90;
        const result = (design as any).CalculateIntermediateY(
            250, // startY below target
            approachY,
            targetBounds,
            sourceBounds,
            5
        ) as number;

        expect(result).toBe(205); // max(90, 200 + 5)
    });

    it("CalculateIntermediateY should return approachY when source is alongside", () =>
    {
        const design = new XORMDesign();

        const targetBounds = new XRect(100, 100, 100, 100); // Top=100 Bottom=200
        const sourceBounds = new XRect(0, 0, 10, 10);

        const approachY = 90;
        const result = (design as any).CalculateIntermediateY(
            150, // within target vertical band
            approachY,
            targetBounds,
            sourceBounds,
            5
        ) as number;

        expect(result).toBe(approachY);
    });

    it("CheckLRouteCollision should detect vertical collision", () =>
    {
        const design = new XORMDesign();

        const source = new XRect(0, 0, 10, 10);
        const target = new XRect(90, 90, 10, 10);

        const obstacle = new XRect(45, 20, 10, 60); // intersects vertical segment at x=50 between y=0..100

        const collided = (design as any).CheckLRouteCollision(
            0,
            0,
            50,
            100,
            source,
            target,
            [obstacle]
        ) as boolean;

        expect(collided).toBe(true);
    });

    it("CheckLRouteCollision should detect horizontal collision and skip source/target obstacles", () =>
    {
        const design = new XORMDesign();

        const source = new XRect(0, 0, 10, 10);
        const target = new XRect(100, 0, 10, 10);

        const obstacle = new XRect(40, -5, 10, 10); // intersects horizontal segment at y=0 between x=0..80

        const collided = (design as any).CheckLRouteCollision(
            0,
            0,
            80,
            100,
            source,
            target,
            [source, target, obstacle]
        ) as boolean;

        expect(collided).toBe(true);
    });

    it("CheckLRouteCollision should skip source/target during vertical segment checks", () =>
    {
        const design = new XORMDesign();

        const source = new XRect(0, 0, 10, 10);
        const target = new XRect(100, 0, 10, 10);

        const collided = (design as any).CheckLRouteCollision(
            0,
            0,
            50,
            100,
            source,
            target,
            [source]
        ) as boolean;

        expect(collided).toBe(false);
    });

    it("CheckLRouteCollision should check X overlap but return false when no collision (line 917 false branch)", () =>
    {
        const design = new XORMDesign();

        const source = new XRect(0, 0, 10, 10);
        const target = new XRect(200, 0, 10, 10);
        // Obstacle at Y overlap range but X is completely outside the horizontal segment
        // Horizontal segment: from startX=0 to turnX=100, at Y=5
        // Obstacle: Left=300, Top=0, Width=10, Height=10 (Right=310, Bottom=10)
        // Y check: pStartY=5, obs.Top=0, obs.Bottom=10 -> 5 >= 0 && 5 <= 10 -> true (enters outer if)
        // X check: minX=0, maxX=100, obs.Left=300, obs.Right=310
        //   !(maxX < obs.Left || minX > obs.Right) = !(100 < 300 || 0 > 310) = !(true || false) = !true = false
        // So inner if is false, no collision returned
        const obstacle = new XRect(300, 0, 10, 10);

        const collided = (design as any).CheckLRouteCollision(
            0,
            5,
            100,
            50,
            source,
            target,
            [obstacle]
        ) as boolean;

        expect(collided).toBe(false);
    });

    it("CalculateMidX should cover both obstacle and no-obstacle branches", () =>
    {
        const design = new XORMDesign();

        const sourceBounds = new XRect(0, 0, 10, 10);
        const targetBounds = new XRect(200, 0, 10, 10);

        // No obstacles: should take the !hasObstacle branch
        const noObsRightExit = (design as any).CalculateMidX(
            0,
            0,
            10,
            0,
            true,
            sourceBounds,
            targetBounds,
            [],
            5,
            10
        ) as number;
        expect(noObsRightExit).toBe(20);

        const noObsLeftExit = (design as any).CalculateMidX(
            0,
            0,
            200,
            0,
            false,
            sourceBounds,
            targetBounds,
            [],
            5,
            10
        ) as number;
        expect(noObsLeftExit).toBe(-10);

        // With obstacle: should take the hasObstacle branch
        const obstacle = new XRect(80, -10, 40, 40);
        const withObsRightExit = (design as any).CalculateMidX(
            0,
            0,
            200,
            20,
            true,
            sourceBounds,
            targetBounds,
            [obstacle],
            5,
            10
        ) as number;
        expect(withObsRightExit).toBeGreaterThanOrEqual(0);

        const withObsLeftExit = (design as any).CalculateMidX(
            200,
            0,
            0,
            20,
            false,
            new XRect(200, 0, 10, 10),
            new XRect(0, 0, 10, 10),
            [obstacle],
            5,
            10
        ) as number;
        expect(withObsLeftExit).toBeLessThanOrEqual(200);
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

        // Case 1: GetLinkedElement works (if conditions are false)
        const refLinked = new XORMReference();
        refLinked.ID = XGuid.NewValue();
        refLinked.Source = sourceField.ID;
        refLinked.Target = targetTable.ID;
        (refLinked as any).GetSourceElement = () => sourceField;
        (refLinked as any).GetTargetElement = () => targetTable;

        ;(design as any).RouteReference(refLinked, [sourceTable, targetTable], 0, 1);

        // Case 2: GetLinkedElement fails -> fallback FindFieldByID/FindTableByID (if conditions are true)
        const refFallback = new XORMReference();
        refFallback.ID = XGuid.NewValue();
        refFallback.Source = sourceField.ID;
        refFallback.Target = targetTable.ID;
        (refFallback as any).GetSourceElement = () => null;
        (refFallback as any).GetTargetElement = () => null;

        ;(design as any).RouteReference(refFallback, [sourceTable, targetTable], 0, 1);

        expect(refLinked.Points.length).toBeGreaterThan(0);
        expect(refFallback.Points.length).toBeGreaterThan(0);
    });

    it("GetTargetEntryPoint should compute symmetric offsets based on routeIndex and totalRoutes", () =>
    {
        const design = new XORMDesign();

        const targetBounds = new XRect(0, 0, 100, 200);
        const spacing = 15;
        const centerY = targetBounds.Top + targetBounds.Height / 2;

        // Single route - should be centered (offset = 0)
        const single = (design as any).GetTargetEntryPoint(targetBounds, 1, 0, 1, spacing) as XPoint;
        expect(single.Y).toBe(centerY);

        // Two routes - should be distributed symmetrically
        // routeIndex 0: offset = (0 - 0.5) * 15 = -7.5
        // routeIndex 1: offset = (1 - 0.5) * 15 = +7.5
        const two0 = (design as any).GetTargetEntryPoint(targetBounds, 1, 0, 2, spacing) as XPoint;
        const two1 = (design as any).GetTargetEntryPoint(targetBounds, 1, 1, 2, spacing) as XPoint;
        expect(two0.Y).toBe(centerY - 7.5);
        expect(two1.Y).toBe(centerY + 7.5);

        // Three routes - distributed: -15, 0, +15
        const three0 = (design as any).GetTargetEntryPoint(targetBounds, 1, 0, 3, spacing) as XPoint;
        const three1 = (design as any).GetTargetEntryPoint(targetBounds, 1, 1, 3, spacing) as XPoint;
        const three2 = (design as any).GetTargetEntryPoint(targetBounds, 1, 2, 3, spacing) as XPoint;
        expect(three0.Y).toBe(centerY - spacing);
        expect(three1.Y).toBe(centerY);
        expect(three2.Y).toBe(centerY + spacing);
    });

    it("SegmentHasCollision should return true when a segment intersects an obstacle", () =>
    {
        const design = new XORMDesign();

        const obstacle = new XRect(10, 10, 10, 10);
        const hit = (design as any).SegmentHasCollision(0, 15, 50, 15, [obstacle]) as boolean;
        expect(hit).toBe(true);

        const miss = (design as any).SegmentHasCollision(0, 0, 50, 0, [obstacle]) as boolean;
        expect(miss).toBe(false);
    });

    it("LineIntersectsRect should return false when segment is fully outside, true otherwise", () =>
    {
        const design = new XORMDesign();

        const rect = new XRect(10, 10, 10, 10);

        // Completely left
        expect((design as any).LineIntersectsRect(0, 0, 0, 30, rect, 0)).toBe(false);

        // Completely above
        expect((design as any).LineIntersectsRect(0, 0, 30, 0, rect, 0)).toBe(false);

        // Crosses the expanded bounds
        expect((design as any).LineIntersectsRect(0, 0, 30, 30, rect, 0)).toBe(true);
    });

    it("OptimizeRoute should return input points unchanged", () =>
    {
        const design = new XORMDesign();
        const pts = [new XPoint(1, 2), new XPoint(3, 4)];
        const out = (design as any).OptimizeRoute(pts) as XPoint[];
        expect(out).toBe(pts);
    });
});
