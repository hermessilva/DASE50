import { describe, it, expect } from "vitest";
import { XRect, XPoint } from "../src/Core/XGeometry.js";
import { XOccupancyMap, XRouteContext } from "../src/Design/XRouteContext.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMMetrics } from "../src/Designers/ORM/XORMMetrics.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ISegment
{
    Vertical: boolean;
    Fixed: number;
    Lo: number;
    Hi: number;
}

function segmentsOf(pPoints: XPoint[]): ISegment[]
{
    const out: ISegment[] = [];
    for (let i = 1; i < pPoints.length; i++)
    {
        const a = pPoints[i - 1];
        const b = pPoints[i];
        if (Math.abs(a.X - b.X) < 0.5 && Math.abs(a.Y - b.Y) >= 0.5)
            out.push({ Vertical: true, Fixed: a.X, Lo: Math.min(a.Y, b.Y), Hi: Math.max(a.Y, b.Y) });
        else if (Math.abs(a.Y - b.Y) < 0.5 && Math.abs(a.X - b.X) >= 0.5)
            out.push({ Vertical: false, Fixed: a.Y, Lo: Math.min(a.X, b.X), Hi: Math.max(a.X, b.X) });
    }
    return out;
}

function expectOrthogonal(pPoints: XPoint[]): void
{
    for (let i = 1; i < pPoints.length; i++)
    {
        const a = pPoints[i - 1];
        const b = pPoints[i];
        const horizontal = Math.abs(a.Y - b.Y) < 0.5;
        const vertical = Math.abs(a.X - b.X) < 0.5;
        expect(horizontal || vertical, `segment ${i} must be orthogonal: (${a.X},${a.Y}) → (${b.X},${b.Y})`).toBe(true);
    }
}

/** Builds a design with a grid of tables; returns tables by index. */
function buildGrid(pCols: number, pRows: number, pFieldCount: number = 4): { design: XORMDesign; tables: XORMTable[] }
{
    const design = new XORMDesign();
    const tables: XORMTable[] = [];
    for (let r = 0; r < pRows; r++)
    {
        for (let c = 0; c < pCols; c++)
        {
            const t = design.CreateTable({
                Name: `T${r}_${c}`,
                X: c * 320,
                Y: r * 220,
                Width: 200,
                Height: 120
            });
            for (let f = 0; f < pFieldCount; f++)
                t.CreateField({ Name: `F${f}` });
            tables.push(t);
        }
    }
    return { design, tables };
}

function connect(pDesign: XORMDesign, pSource: XORMTable, pTarget: XORMTable, pFieldIndex: number = 0): void
{
    const field = pSource.GetFields()[pFieldIndex];
    pDesign.CreateReference({ SourceFieldID: field.ID, TargetTableID: pTarget.ID });
}

// ---------------------------------------------------------------------------
// XOccupancyMap
// ---------------------------------------------------------------------------

describe("XOccupancyMap", () =>
{
    it("measures colinear overlap against other refs only", () =>
    {
        const map = new XOccupancyMap();
        map.AddPath([new XPoint(100, 0), new XPoint(100, 200)], "A");

        expect(map.OverlapLength(true, 100, 50, 150, "B")).toBe(100);
        expect(map.OverlapLength(true, 100, 50, 150, "A")).toBe(0);
        expect(map.OverlapLength(true, 100, 300, 400, "B")).toBe(0);
    });

    it("respects the fixed-coordinate tolerance", () =>
    {
        const map = new XOccupancyMap();
        map.AddPath([new XPoint(100, 0), new XPoint(100, 200)], "A");

        expect(map.OverlapLength(true, 102, 0, 200, "B")).toBe(200);
        expect(map.OverlapLength(true, 120, 0, 200, "B")).toBe(0);
    });

    it("counts perpendicular crossings, excluding T-junctions", () =>
    {
        const map = new XOccupancyMap();
        map.AddPath([new XPoint(0, 100), new XPoint(200, 100)], "A");

        // Vertical segment crossing the middle of the horizontal one.
        expect(map.CrossingCount(true, 100, 0, 200, "B")).toBe(1);
        // Vertical segment ending ON the horizontal line: T-junction, no crossing.
        expect(map.CrossingCount(true, 100, 0, 100, "B")).toBe(0);
        // Vertical segment far away.
        expect(map.CrossingCount(true, 400, 0, 200, "B")).toBe(0);
    });

    it("RemoveRef prunes all intervals of a reference", () =>
    {
        const map = new XOccupancyMap();
        map.AddPath([new XPoint(100, 0), new XPoint(100, 200), new XPoint(300, 200)], "A");
        map.RemoveRef("A");
        expect(map.OverlapLength(true, 100, 0, 200, "B")).toBe(0);
        expect(map.OverlapLength(false, 200, 100, 300, "B")).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// XRouteContext
// ---------------------------------------------------------------------------

describe("XRouteContext", () =>
{
    it("builds a shared track grid with corridor lanes and halo", () =>
    {
        const ctx = new XRouteContext([
            { ID: "a", Rect: new XRect(0, 0, 200, 100) },
            { ID: "b", Rect: new XRect(600, 0, 200, 100) }
        ], 40);

        expect(ctx.TracksX.length).toBeGreaterThan(10);
        expect(ctx.TracksY.length).toBeGreaterThan(5);
        // Sorted ascending
        for (let i = 1; i < ctx.TracksX.length; i++)
            expect(ctx.TracksX[i]).toBeGreaterThan(ctx.TracksX[i - 1]);
        // Halo extends beyond extremes
        expect(ctx.TracksX[0]).toBeLessThanOrEqual(-80);
        expect(ctx.TracksX[ctx.TracksX.length - 1]).toBeGreaterThanOrEqual(880);
        // Corridor between the tables (240..600) received intermediate lanes
        const lanes = ctx.TracksX.filter(x => x > 250 && x < 590);
        expect(lanes.length).toBeGreaterThan(0);
    });

    it("IsSegmentFree detects table interior collisions with clearance", () =>
    {
        const ctx = new XRouteContext([{ ID: "a", Rect: new XRect(100, 100, 200, 100) }], 40);

        expect(ctx.IsSegmentFree(true, 200, 0, 400)).toBe(false);
        expect(ctx.IsSegmentFree(true, 50, 0, 400)).toBe(true);
        expect(ctx.IsSegmentFree(false, 150, 0, 400)).toBe(false);
        expect(ctx.IsSegmentFree(false, 50, 0, 400)).toBe(true);
        // Clearance pushes the free boundary outward
        expect(ctx.IsSegmentFree(true, 98, 0, 400, 4)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Cooperative routing (end-to-end through XORMDesign)
// ---------------------------------------------------------------------------

describe("XORMDesign cooperative routing", () =>
{
    it("routes all references orthogonally with no table crossings", () =>
    {
        const { design, tables } = buildGrid(3, 3);
        // Star: everything points at the center table (hub) + some long refs.
        const hub = tables[4];
        for (const t of tables)
        {
            if (t !== hub)
                connect(design, t, hub);
        }
        connect(design, tables[0], tables[8], 1);
        connect(design, tables[2], tables[6], 1);

        design.RouteAllLines();

        for (const ref of design.GetReferences())
        {
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            expectOrthogonal(ref.Points);
        }

        const metrics = design.GetRoutingMetrics();
        expect(metrics.TableCrossings).toBe(0);
    });

    it("parallel references between the same corridor do not overlap colinearly", () =>
    {
        const { design, tables } = buildGrid(2, 1);
        // Four parallel refs through the same corridor.
        connect(design, tables[0], tables[1], 0);
        connect(design, tables[0], tables[1], 1);
        connect(design, tables[0], tables[1], 2);
        connect(design, tables[0], tables[1], 3);

        design.RouteAllLines();

        const metrics = design.GetRoutingMetrics();
        expect(metrics.Overlaps).toBe(0);
    });

    it("hub with many incoming references spreads anchors over multiple sides", () =>
    {
        const design = new XORMDesign();
        const hub = design.CreateTable({ Name: "Hub", X: 800, Y: 400, Width: 200, Height: 60 });
        hub.CreateField({ Name: "ID" });

        const spokes: XORMTable[] = [];
        for (let i = 0; i < 8; i++)
        {
            const t = design.CreateTable({
                Name: `S${i}`,
                X: (i % 4) * 400,
                Y: i < 4 ? 0 : 800,
                Width: 200,
                Height: 100
            });
            t.CreateField({ Name: "FK" });
            spokes.push(t);
            connect(design, t, hub);
        }

        design.RouteAllLines();

        // Entry points on the hub: no two anchors closer than 4px on the same side.
        const entries = design.GetReferences().map(r => r.Points[r.Points.length - 1]);
        for (let i = 0; i < entries.length; i++)
        {
            for (let j = i + 1; j < entries.length; j++)
            {
                const d = Math.abs(entries[i].X - entries[j].X) + Math.abs(entries[i].Y - entries[j].Y);
                expect(d).toBeGreaterThan(4);
            }
        }
    });

    it("keeps routes deterministic across repeated full reroutes", () =>
    {
        const { design, tables } = buildGrid(3, 2);
        connect(design, tables[0], tables[5]);
        connect(design, tables[1], tables[3]);
        connect(design, tables[2], tables[4]);

        design.RouteAllLines();
        const first = design.GetReferences().map(r => r.Points.map(p => `${p.X},${p.Y}`).join(";"));

        design.RouteAllLines();
        const second = design.GetReferences().map(r => r.Points.map(p => `${p.X},${p.Y}`).join(";"));

        expect(second).toEqual(first);
    });

    it("moving one table re-routes only its own references", () =>
    {
        const { design, tables } = buildGrid(3, 2);
        connect(design, tables[0], tables[1]);
        connect(design, tables[4], tables[5]);

        design.RouteAllLines();
        const refs = design.GetReferences();
        const untouched = refs.find(r => r.Target === tables[5].ID)!;
        const before = untouched.Points.map(p => `${p.X},${p.Y}`).join(";");

        // Move a table not connected to `untouched`.
        tables[0].Bounds = new XRect(40, 40, 200, 120);

        const after = untouched.Points.map(p => `${p.X},${p.Y}`).join(";");
        expect(after).toBe(before);
    });
});

// ---------------------------------------------------------------------------
// Route shape quality (anchor projection + jog tightening)
// ---------------------------------------------------------------------------

describe("route shape quality", () =>
{
    function bendsOf(pPoints: XPoint[]): number
    {
        let bends = 0;
        for (let i = 2; i < pPoints.length; i++)
        {
            const h1 = Math.abs(pPoints[i - 2].Y - pPoints[i - 1].Y) < 0.5;
            const h2 = Math.abs(pPoints[i - 1].Y - pPoints[i].Y) < 0.5;
            if (h1 !== h2)
                bends++;
        }
        return bends;
    }

    it("table directly below enters straight — no mid-descent jog", () =>
    {
        // Image-3 pattern: source above, target below with a large X overlap.
        // The line exits West at the FK row, descends once and enters the
        // target top — 2 bends, never down→right→down.
        const design = new XORMDesign();
        const src = design.CreateTable({ Name: "MenuRecente", X: 300, Y: 100, Width: 200, Height: 100 });
        src.CreateField({ Name: "UsuarioID" });
        const tgt = design.CreateTable({ Name: "Usuario", X: 220, Y: 400, Width: 200, Height: 100 });
        tgt.CreateField({ Name: "ID" });
        connect(design, src, tgt);

        design.RouteAllLines();

        const ref = design.GetReferences()[0];
        expectOrthogonal(ref.Points);
        expect(bendsOf(ref.Points)).toBeLessThanOrEqual(2);
    });

    it("target below-right enters as a clean L — no staircase before the arrow", () =>
    {
        // Image-1 pattern: source top-left, target bottom-right; the route
        // must descend and enter with a single corner near the target.
        const design = new XORMDesign();
        const src = design.CreateTable({ Name: "Politica", X: 100, Y: 50, Width: 220, Height: 120 });
        src.CreateField({ Name: "AcaoSensivelID" });
        const tgt = design.CreateTable({ Name: "AcaoSensivel", X: 420, Y: 400, Width: 200, Height: 80 });
        tgt.CreateField({ Name: "ID" });
        connect(design, src, tgt);

        design.RouteAllLines();

        const ref = design.GetReferences()[0];
        expectOrthogonal(ref.Points);
        expect(bendsOf(ref.Points)).toBeLessThanOrEqual(2);
    });

    it("lone incoming anchor aligns with the approach coordinate", () =>
    {
        // Anchor projection: a single incoming line lands where the route
        // naturally arrives (source exit-stub X), not at the border middle.
        const design = new XORMDesign();
        const src = design.CreateTable({ Name: "A", X: 300, Y: 100, Width: 200, Height: 100 });
        src.CreateField({ Name: "FK" });
        const tgt = design.CreateTable({ Name: "B", X: 100, Y: 400, Width: 300, Height: 100 });
        tgt.CreateField({ Name: "ID" });
        connect(design, src, tgt);

        design.RouteAllLines();

        const ref = design.GetReferences()[0];
        const entry = ref.Points[ref.Points.length - 1];
        // Source exits West (target center is left of source center):
        // stub X = src.Left - gap = 300 - 40 = 260, inside the target top span.
        expect(Math.abs(entry.X - 260)).toBeLessThanOrEqual(0.5);
    });
});

// ---------------------------------------------------------------------------
// RF5 invariant — the source stub always exits E/W at the FK field row
// ---------------------------------------------------------------------------

describe("RF5 source-exit invariant", () =>
{
    it("300 random non-overlapping scenes: stub exits sideways at the field row and never re-enters the source", () =>
    {
        const violations: string[] = [];
        for (let seedBase = 1; seedBase <= 300; seedBase++)
        {
            let seed = seedBase;
            const next = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };

            const design = new XORMDesign();
            const tables: XORMTable[] = [];
            const cols = 3 + (next() % 3);
            const rows = 2 + (next() % 3);
            for (let r = 0; r < rows; r++)
            {
                for (let c = 0; c < cols; c++)
                {
                    if (next() % 5 === 0)
                        continue; // holes make corridors irregular
                    const t = design.CreateTable({
                        Name: `T${r}_${c}`,
                        X: c * 340 + (next() % 30) - 15,
                        Y: r * 260 + (next() % 30) - 15,
                        Width: 160 + (next() % 120),
                        Height: 100
                    });
                    const fc = 1 + (next() % 7);
                    for (let f = 0; f < fc; f++)
                        t.CreateField({ Name: `F${f}` });
                    tables.push(t);
                }
            }
            if (tables.length < 2)
                continue;
            const refCount = 6 + (next() % 16);
            for (let r = 0; r < refCount; r++)
            {
                const a = tables[next() % tables.length];
                const b = tables[next() % tables.length];
                if (a === b)
                    continue;
                const fields = a.GetFields();
                design.CreateReference({ SourceFieldID: fields[next() % fields.length].ID, TargetTableID: b.ID });
            }

            design.RouteAllLines();

            for (const ref of design.GetReferences())
            {
                const pts = ref.Points;
                if (!pts || pts.length < 2)
                    continue;
                const srcField = design.FindFieldByID(ref.Source);
                const srcTable = srcField?.ParentNode as XORMTable;
                if (!srcTable)
                    continue;
                const vb = XORMMetrics.GetVisualBounds(srcTable);
                const idx = srcTable.GetFields().findIndex(f => f.ID === srcField!.ID);
                const fieldY = XORMMetrics.GetFieldRowY(srcTable, idx);
                const p0 = pts[0];
                const p1 = pts[1];

                const onWest = Math.abs(p0.X - vb.Left) < 0.75;
                const onEast = Math.abs(p0.X - vb.Right) < 0.75;
                const atRow = Math.abs(p0.Y - fieldY) < 0.75;
                const firstH = Math.abs(p1.Y - p0.Y) < 0.75;
                const outward = onEast ? p1.X > p0.X + 8 : (onWest ? p1.X < p0.X - 8 : false);

                if (!(onWest || onEast) || !atRow || !firstH || !outward)
                {
                    violations.push(`seed=${seedBase} STUB pts=${pts.map(p => `(${p.X},${p.Y})`).join(" ")}`);
                    continue;
                }
                for (let i = 1; i < pts.length - 1; i++)
                {
                    const a2 = pts[i];
                    const b2 = pts[i + 1];
                    const loX = Math.min(a2.X, b2.X);
                    const hiX = Math.max(a2.X, b2.X);
                    const loY = Math.min(a2.Y, b2.Y);
                    const hiY = Math.max(a2.Y, b2.Y);
                    if (hiX > vb.Left + 0.75 && loX < vb.Right - 0.75 && hiY > vb.Top + 0.75 && loY < vb.Bottom - 0.75)
                        violations.push(`seed=${seedBase} CUT seg${i} pts=${pts.map(p => `(${p.X},${p.Y})`).join(" ")}`);
                }
            }
        }
        expect(violations, violations.slice(0, 10).join("\n")).toHaveLength(0);
    }, 180000);
});

// ---------------------------------------------------------------------------
// Performance benchmark (RN1)
// ---------------------------------------------------------------------------

describe("routing performance", () =>
{
    it("routes 100 tables / 300 fully random references within budget (adversarial)", () =>
    {
        const { design, tables } = buildGrid(10, 10, 6);
        let refCount = 0;
        // Deterministic pseudo-random pairs — mostly LONG cross-diagram refs,
        // far denser than any real ORM model. Worst-case stress.
        let seed = 42;
        const next = (): number =>
        {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        while (refCount < 300)
        {
            const a = tables[next() % tables.length];
            const b = tables[next() % tables.length];
            if (a === b)
                continue;
            connect(design, a, b, refCount % 6);
            refCount++;
        }

        const start = performance.now();
        design.RouteAllLines();
        const elapsed = performance.now() - start;

        for (const ref of design.GetReferences())
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);

        const metrics = design.GetRoutingMetrics();
        expect(metrics.TableCrossings).toBe(0);

        // ~650ms on dev hardware for the adversarial case; margin for CI.
        expect(elapsed).toBeLessThan(2000);
    }, 30000);

    it("routes 100 tables / 300 mostly-local references within budget (realistic)", () =>
    {
        const { design, tables } = buildGrid(10, 10, 6);
        let refCount = 0;
        let seed = 7;
        const next = (): number =>
        {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        // Real ORM models connect mostly neighbouring tables: 80% of the refs
        // link a table to one at most 2 grid cells away, 20% are long.
        while (refCount < 300)
        {
            const ai = next() % tables.length;
            let bi: number;
            if (refCount % 5 !== 0)
            {
                const dc = (next() % 5) - 2;
                const dr = (next() % 5) - 2;
                const col = Math.min(9, Math.max(0, (ai % 10) + dc));
                const row = Math.min(9, Math.max(0, Math.floor(ai / 10) + dr));
                bi = row * 10 + col;
            }
            else
                bi = next() % tables.length;
            if (ai === bi)
                continue;
            connect(design, tables[ai], tables[bi], refCount % 6);
            refCount++;
        }

        const start = performance.now();
        design.RouteAllLines();
        const elapsed = performance.now() - start;

        const metrics = design.GetRoutingMetrics();
        expect(metrics.TableCrossings).toBe(0);
        expect(elapsed).toBeLessThan(1000);
    }, 30000);
});
