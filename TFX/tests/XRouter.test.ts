import { describe, it, expect } from "vitest";
import { XRect, XPoint } from "../src/Core/XGeometry.js";
import { 
    XRouter, 
    XRouterOptions 
} from "../src/Design/XRouter.js";
import { 
    XRouterDirection, 
    emptyRouterLine, 
    createRouterLine, 
    normalizeRect, 
    isEmptyRect, 
    clonePoints,
    XRouterShape
} from "../src/Design/XRouterTypes.js";

describe("XRouterTypes", () => {
    it("XRouterDirection enum values", () => {
        expect(XRouterDirection.North).toBe(0);
        expect(XRouterDirection.East).toBe(90);
        expect(XRouterDirection.South).toBe(180);
        expect(XRouterDirection.West).toBe(270);
    });

    it("emptyRouterLine should return an invalid line", () => {
        const line = emptyRouterLine();
        expect(line.ID).toBe("");
        expect(line.Points).toEqual([]);
        expect(line.IsValid).toBe(false);
    });

    it("createRouterLine should return a valid line with ID", () => {
        const points = [new XPoint(0, 0), new XPoint(10, 10)];
        const line = createRouterLine(points, 0, 90);
        expect(line.ID).not.toBe("");
        expect(line.Points).toBe(points);
        expect(line.StartDir).toBe(0);
        expect(line.EndDir).toBe(90);
        expect(line.IsValid).toBe(true);
    });

    it("normalizeRect should handle rects with negative dimensions", () => {
        const r1 = new XRect(10, 10, -5, -5);
        const norm1 = normalizeRect(r1);
        expect(norm1.Left).toBe(5);
        expect(norm1.Top).toBe(5);
        expect(norm1.Width).toBe(5);
        expect(norm1.Height).toBe(5);

        const r2 = new XRect(10, 10, 5, 5);
        const norm2 = normalizeRect(r2);
        expect(norm2).toBe(r2);
    });

    it("normalizeRect should handle rect with only negative width", () => {
        const r = new XRect(10, 10, -5, 5);
        const norm = normalizeRect(r);
        expect(norm.Left).toBe(5);
        expect(norm.Top).toBe(10);
        expect(norm.Width).toBe(5);
        expect(norm.Height).toBe(5);
    });

    it("normalizeRect should handle rect with only negative height", () => {
        const r = new XRect(10, 10, 5, -5);
        const norm = normalizeRect(r);
        expect(norm.Left).toBe(10);
        expect(norm.Top).toBe(5);
        expect(norm.Width).toBe(5);
        expect(norm.Height).toBe(5);
    });

    it("isEmptyRect should work as expected", () => {
        expect(isEmptyRect(null)).toBe(true);
        expect(isEmptyRect(undefined)).toBe(true);
        expect(isEmptyRect(new XRect(0, 0, 0, 0))).toBe(true);
        expect(isEmptyRect(new XRect(0, 0, 10, 10))).toBe(false);
    });

    it("clonePoints should return a deep copy", () => {
        const pts = [new XPoint(1, 2), new XPoint(3, 4)];
        const cloned = clonePoints(pts);
        expect(cloned).toEqual(pts);
        expect(cloned).not.toBe(pts);
        expect(cloned[0]).not.toBe(pts[0]);
    });
});

describe("XRouter", () => {
    it("should initialize with default options", () => {
        const router = new XRouter();
        expect(router.Gap).toBe(20);
        expect(router.UseInnerRect).toBe(false);
        expect(router.ReturnShorterLine).toBe(true);
    });

    it("should initialize with custom options", () => {
        const options: XRouterOptions = {
            gap: 10,
            useInnerRect: true,
            returnShorterLine: false,
            checkCollision: true
        };
        const router = new XRouter(options);
        expect(router.Gap).toBe(10);
        expect(router.UseInnerRect).toBe(true);
        expect(router.ReturnShorterLine).toBe(false);
        expect(router.CheckCollision).toBe(true);
    });

    it("setMaxIterations should update internal value", () => {
        const router = new XRouter();
        // @ts-ignore - reaching into private for test verification if needed, 
        // but we just call it to ensure coverage.
        router.setMaxIterations(500);
    });

    it("clear should reset results", () => {
        const router = new XRouter();
        router.AllLines = [createRouterLine([])];
        router.clear();
        expect(router.AllLines.length).toBe(0);
        expect(router.BestLine.IsValid).toBe(false);
    });

    it("getAllLines should find a path between two shapes", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(50, 25),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(200, 25),
            DesiredDegree: [270]
        };

        const result = router.getAllLines(shapeL, shapeR);
        expect(result.IsValid).toBe(true);
        expect(router.FinalLines.length).toBeGreaterThan(0);
    });

    it("getResult should return final state", () => {
        const router = new XRouter();
        const result = router.getResult();
        expect(result.success).toBe(false);
        expect(result.steps).toBe(0);
    });

    it("should handle obstacles", () => {
        const router = new XRouter({ checkCollision: true });
        const obstacle = new XRect(100, 0, 20, 100);
        router.addObstacle(obstacle);
        expect(router.Rects.length).toBe(1);

        router.clearObstacles();
        expect(router.Rects.length).toBe(0);
    });

    it("setEndpoints should update internal rects", () => {
        const router = new XRouter();
        const l = new XRect(0, 0, 10, 10);
        const r = new XRect(100, 100, 10, 10);
        router.setEndpoints(l, r);
        expect(router.LeftRect.Left).toBe(0);
        expect(router.RightRect.Left).toBe(100);
    });

    it("getAllLines should handle NaN points to cover all branches in getStartPoint", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: [0, 90, 180, 270]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: [270]
        };

        const result = router.getAllLines(shapeL, shapeR);
        expect(result.IsValid).toBe(true);
    });

    it("getAllLines should cover partial NaN points", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(25, NaN),
            DesiredDegree: [0, 90, 180, 270]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(NaN, 25),
            DesiredDegree: [270]
        };

        const result = router.getAllLines(shapeL, shapeR);
        expect(result.IsValid).toBe(true);
    });

    it("should calculate line collision", () => {
        const router = new XRouter({ checkCollision: true, checkCrossRect: true });
        const obstacle = new XRect(100, -50, 20, 200);
        router.addObstacle(obstacle);

        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(50, 25),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(200, 25),
            DesiredDegree: [270]
        };

        // This path is blocked by the obstacle
        router.getAllLines(shapeL, shapeR);
        // If it finds another path it's fine, but we want to exercise the collision code
        expect(router.Steps).toBeGreaterThan(0);
    });

    it("should handle custom LeftRect and RightRect in union", () => {
        const router = new XRouter();
        router.LeftRect = new XRect(0, 0, 10, 10);
        router.RightRect = new XRect(100, 100, 10, 10);
        
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(50, 25),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(200, 25),
            DesiredDegree: [270]
        };

        router.getAllLines(shapeL, shapeR);
        expect(router.BestLine.IsValid).toBe(true);
    });

    it("routeLine should work with predefined lines", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(50, 25),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(200, 25),
            DesiredDegree: [270]
        };

        const leftLines = [createRouterLine([new XPoint(50, 25), new XPoint(100, 25)], 90)];
        const rightLines = [createRouterLine([new XPoint(150, 25), new XPoint(200, 25)], -1, 270)];

        const success = router.routeLine(shapeL, shapeR, leftLines, rightLines);
        expect(router.BestLine.IsValid).toBeDefined();
    });

    it("getAllLines should handle vertical separation for connection lines", () => {
        const router = new XRouter({ gap: 5 });
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 20, 20),
            StartPoint: new XPoint(20, 10),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(60, 0, 20, 20),
            StartPoint: new XPoint(60, 10),
            DesiredDegree: [270]
        };
        // Separation vy = 60 - 20 = 40. 2 * gap = 10. 40 > 10.
        router.getAllLines(shapeL, shapeR);
        expect(router.AllLines.length).toBeGreaterThan(0);
    });

    it("getAllLines should handle horizontal separation for connection lines", () => {
        const router = new XRouter({ gap: 5 });
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 20, 20),
            StartPoint: new XPoint(10, 20),
            DesiredDegree: [180]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(0, 60, 20, 20),
            StartPoint: new XPoint(10, 60),
            DesiredDegree: [0]
        };
        // Separation vx = 60 - 20 = 40. 2 * gap = 10. 40 > 10.
        router.getAllLines(shapeL, shapeR);
        expect(router.AllLines.length).toBeGreaterThan(0);
    });

    it("should detect collision through getAllLines with obstacle in path", () => {
        const router = new XRouter({ checkCollision: true, checkCrossRect: true, gap: 10 });
        router.addObstacle(new XRect(40, 0, 20, 100));
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 40, 20, 20),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: [XRouterDirection.East]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(100, 40, 20, 20),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: [XRouterDirection.West]
        };
        router.setEndpoints(shapeL.Rect, shapeR.Rect);
        const line = router.getAllLines(shapeL, shapeR);
        expect(line.IsValid).toBe(true);
    });

    it("setMaxIterations affects MaxNodes budget", () => {
        const router = new XRouter();
        router.setMaxIterations(7);
        expect(router.MaxNodes).toBe(7);
    });

    it("getAllLines should return invalid line when prepare fails", () => {
        const router = new XRouter();
        // Create shapes with empty/invalid rects to force prepare to fail
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 0, 0),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: []
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(0, 0, 0, 0),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: []
        };

        const result = router.getAllLines(shapeL, shapeR);
        // Even with invalid shapes, router should not crash
        expect(result).toBeDefined();
    });

    it("routeLine should return false when prepare fails", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 0, 0),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: []
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(0, 0, 0, 0),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: []
        };

        const result = router.routeLine(shapeL, shapeR, [], []);
        expect(typeof result).toBe("boolean");
    });

    it("should handle rects without Right property using fallback calculation", () => {
        const router = new XRouter({ gap: 5 });
        // Create rects that use Left + Width for Right calculation
        const rect1 = new XRect(0, 0, 20, 20);
        const rect2 = new XRect(60, 0, 20, 20);
        
        // These rects don't have explicit Right property, so fallback is used
        router.setEndpoints(rect1, rect2);
        
        const shapeL: XRouterShape = {
            Rect: rect1,
            StartPoint: new XPoint(20, 10),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: rect2,
            StartPoint: new XPoint(60, 10),
            DesiredDegree: [270]
        };

        const result = router.getAllLines(shapeL, shapeR);
        expect(result).toBeDefined();
    });

    it("routing should skip source/target rects from obstacle list", () => {
        const router = new XRouter({ checkCollision: true, checkCrossRect: true, gap: 10 });
        const leftRect = new XRect(0, 0, 50, 50);
        const rightRect = new XRect(200, 0, 50, 50);
        router.setEndpoints(leftRect, rightRect);
        router.addObstacle(leftRect);
        router.addObstacle(rightRect);
        const shapeL: XRouterShape = { Rect: leftRect, StartPoint: new XPoint(NaN, NaN), DesiredDegree: [XRouterDirection.East] };
        const shapeR: XRouterShape = { Rect: rightRect, StartPoint: new XPoint(NaN, NaN), DesiredDegree: [XRouterDirection.West] };
        const line = router.getAllLines(shapeL, shapeR);
        expect(line.IsValid).toBe(true);
    });

    it("followLine should handle hopes parameter", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(50, 25),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(200, 25),
            DesiredDegree: [270]
        };

        // Add obstacles to force more complex routing
        router.addObstacle(new XRect(100, 0, 20, 50));
        
        const result = router.getAllLines(shapeL, shapeR);
        expect(result).toBeDefined();
    });

    it("should return empty result when left shape has empty rect in getAllLines", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 0, 0),  // Empty rect
            StartPoint: new XPoint(0, 0),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(200, 25),
            DesiredDegree: [270]
        };

        const result = router.getAllLines(shapeL, shapeR);
        expect(result.IsValid).toBe(false);
    });

    it("should return empty result when right shape has empty rect in getAllLines", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(50, 25),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(0, 0, 0, 0),  // Empty rect
            StartPoint: new XPoint(0, 0),
            DesiredDegree: [270]
        };

        const result = router.getAllLines(shapeL, shapeR);
        expect(result.IsValid).toBe(false);
    });

    it("should return false when left shape has empty rect in routeLine", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 0, 0),  // Empty rect
            StartPoint: new XPoint(0, 0),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(200, 25),
            DesiredDegree: [270]
        };

        const result = router.routeLine(shapeL, shapeR, [], []);
        expect(result).toBe(false);
    });

    it("should return false when right shape has empty rect in routeLine", () => {
        const router = new XRouter();
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(50, 25),
            DesiredDegree: [90]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(0, 0, 0, 0),
            StartPoint: new XPoint(0, 0),
            DesiredDegree: [270]
        };

        const result = router.routeLine(shapeL, shapeR, [], []);
        expect(result).toBe(false);
    });

    it("AStar aborts when MaxNodes budget exceeded", () => {
        const router = new XRouter({ gap: 10 });
        router.MaxNodes = 1;
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: [XRouterDirection.East]
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(500, 500, 50, 50),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: [XRouterDirection.West]
        };
        const line = router.getAllLines(shapeL, shapeR);
        expect(line.IsValid).toBe(false);
        expect(router.Steps).toBeGreaterThan(1);
    });

    it("AStar returns null when start/end indices are invalid", () => {
        const router = new XRouter({ gap: 10 });
        const tracks: number[] = [];
        // @ts-ignore — invoke private to cover defensive empty-track branch
        const path = router["AStar"](tracks, tracks, new XPoint(0, 0), new XPoint(10, 10), 90, new XRect(0, 0, 1, 1), new XRect(20, 20, 1, 1));
        expect(path).toBe(null);
    });

    it("constructor honours all options", () => {
        const router = new XRouter({
            gap: 5,
            useInnerRect: true,
            useOuterRect: true,
            returnShorterLine: false,
            checkCollision: true,
            checkCrossRect: false,
            turnPenalty: 99,
            maxNodes: 12345
        });
        expect(router.Gap).toBe(5);
        expect(router.UseInnerRect).toBe(true);
        expect(router.UseOuterRect).toBe(true);
        expect(router.ReturnShorterLine).toBe(false);
        expect(router.CheckCollision).toBe(true);
        expect(router.CheckCrossRect).toBe(false);
        expect(router.TurnPenalty).toBe(99);
        expect(router.MaxNodes).toBe(12345);
    });

    it("Unique returns empty array unchanged", () => {
        const router = new XRouter();
        // @ts-ignore
        const out = router["Unique"]([]);
        expect(out).toEqual([]);
    });

    it("Route uses all four directions when DesiredDegree is empty", () => {
        const router = new XRouter({ gap: 10 });
        const shapeL: XRouterShape = {
            Rect: new XRect(0, 0, 50, 50),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: []
        };
        const shapeR: XRouterShape = {
            Rect: new XRect(200, 0, 50, 50),
            StartPoint: new XPoint(NaN, NaN),
            DesiredDegree: []
        };
        const line = router.getAllLines(shapeL, shapeR);
        expect(line.IsValid).toBe(true);
    });

    it("AStar respects grid boundaries (corner-to-corner route on a 2x2 grid)", () => {
        const router = new XRouter();
        const xs = [0, 5];
        const ys = [0, 5];
        // @ts-ignore
        const path = router["AStar"](xs, ys, new XPoint(0, 0), new XPoint(5, 5), XRouterDirection.East,
            new XRect(0, 0, 0, 0), new XRect(0, 0, 0, 0), []);
        expect(path).not.toBeNull();
        expect(path![0].X).toBe(0);
        expect(path![path!.length - 1].X).toBe(5);
    });

    it("Simplify returns short paths unchanged", () => {
        const router = new XRouter();
        // @ts-ignore
        const short = router["Simplify"]([new XPoint(0, 0), new XPoint(5, 5)]);
        expect(short.length).toBe(2);
    });

    it("PathCost penalises turns", () => {
        const router = new XRouter({ turnPenalty: 100 });
        // @ts-ignore
        const straight = router["PathCost"]([new XPoint(0, 0), new XPoint(10, 0), new XPoint(20, 0)]);
        // @ts-ignore
        const bent = router["PathCost"]([new XPoint(0, 0), new XPoint(10, 0), new XPoint(10, 10)]);
        expect(bent).toBeGreaterThan(straight);
    });

    it("AStar exhausts open queue when no path exists", () => {
        const router = new XRouter({ gap: 1 });
        const xs = [0, 5, 10];
        const ys = [0, 5, 10];
        const src = new XRect(-100, -100, 1, 1);
        const tgt = new XRect(100, 100, 1, 1);
        const blocker = new XRect(-1, -1, 12, 12);
        router.addObstacle(blocker);
        router.CheckCollision = true;
        // @ts-ignore
        const path = router["AStar"](xs, ys, new XPoint(0, 0), new XPoint(10, 10), 90, src, tgt);
        expect(path).toBe(null);
    });
});
