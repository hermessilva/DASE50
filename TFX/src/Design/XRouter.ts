import { XRect, XPoint } from "../Core/XGeometry.js";
import {
    XRouterLine,
    XRouterShape,
    XRouterDirection,
    emptyRouterLine,
    createRouterLine,
    normalizeRect,
    isEmptyRect
} from "./XRouterTypes.js";

export interface XRouterOptions
{
    gap?: number;
    useInnerRect?: boolean;
    useOuterRect?: boolean;
    returnShorterLine?: boolean;
    checkCollision?: boolean;
    checkCrossRect?: boolean;
    turnPenalty?: number;
    maxNodes?: number;
}

export interface XRouterResult
{
    bestLine: XRouterLine;
    allLines: XRouterLine[];
    finalLines: XRouterLine[];
    steps: number;
    success: boolean;
}

interface IGridNode
{
    Key: string;
    X: number;
    Y: number;
    Dir: number;
    G: number;
    F: number;
    Parent: IGridNode | null;
}

const EPS = 0.5;
const DEFAULT_GAP = 20;
const DEFAULT_TURN_PENALTY = 12;
const DEFAULT_MAX_NODES = 20000;

export class XRouter
{
    public Gap: number = DEFAULT_GAP;
    public Rects: XRect[] = [];
    public UseInnerRect: boolean = false;
    public UseOuterRect: boolean = false;
    public ReturnShorterLine: boolean = true;
    public CheckCollision: boolean = false;
    public CheckCrossRect: boolean = true;
    public TurnPenalty: number = DEFAULT_TURN_PENALTY;
    public MaxNodes: number = DEFAULT_MAX_NODES;

    public SolvedLines: XRouterLine[] = [];
    public AllLines: XRouterLine[] = [];
    public FinalLines: XRouterLine[] = [];
    public LeftLines: XRouterLine[] = [];
    public RightLines: XRouterLine[] = [];
    public BestLine: XRouterLine = emptyRouterLine();
    public MainRect: XRect = new XRect(0, 0, 0, 0);
    public RightRect: XRect = new XRect(0, 0, 0, 0);
    public LeftRect: XRect = new XRect(0, 0, 0, 0);
    public Steps: number = 0;

    public constructor(pOptions?: XRouterOptions)
    {
        if (!pOptions)
            return;
        if (pOptions.gap !== undefined) this.Gap = pOptions.gap;
        if (pOptions.useInnerRect !== undefined) this.UseInnerRect = pOptions.useInnerRect;
        if (pOptions.useOuterRect !== undefined) this.UseOuterRect = pOptions.useOuterRect;
        if (pOptions.returnShorterLine !== undefined) this.ReturnShorterLine = pOptions.returnShorterLine;
        if (pOptions.checkCollision !== undefined) this.CheckCollision = pOptions.checkCollision;
        if (pOptions.checkCrossRect !== undefined) this.CheckCrossRect = pOptions.checkCrossRect;
        if (pOptions.turnPenalty !== undefined) this.TurnPenalty = pOptions.turnPenalty;
        if (pOptions.maxNodes !== undefined) this.MaxNodes = pOptions.maxNodes;
    }

    public setMaxIterations(pMax: number): void
    {
        this.MaxNodes = pMax;
    }

    public clear(): void
    {
        this.AllLines = [];
        this.SolvedLines = [];
        this.FinalLines = [];
        this.LeftLines = [];
        this.RightLines = [];
        this.BestLine = emptyRouterLine();
        this.Steps = 0;
    }

    public addObstacle(pRect: XRect): void
    {
        this.Rects.push(normalizeRect(pRect));
    }

    public clearObstacles(): void
    {
        this.Rects = [];
    }

    public setEndpoints(pLeft: XRect, pRight: XRect): void
    {
        this.LeftRect = normalizeRect(pLeft);
        this.RightRect = normalizeRect(pRight);
    }

    public getResult(): XRouterResult
    {
        return {
            bestLine: this.BestLine,
            allLines: this.AllLines,
            finalLines: this.FinalLines,
            steps: this.Steps,
            success: this.BestLine.IsValid
        };
    }

    public getAllLines(pLeft: XRouterShape, pRight: XRouterShape): XRouterLine
    {
        this.CheckCollision = this.Rects.length > 0;
        this.clear();
        return this.Route(pLeft, pRight);
    }

    public routeLine(
        pLeft: XRouterShape,
        pRight: XRouterShape,
        pLeftLines: XRouterLine[],
        pRightLines: XRouterLine[]
    ): boolean
    {
        this.CheckCollision = this.Rects.length > 0;
        this.LeftLines = pLeftLines;
        this.RightLines = pRightLines;
        const line = this.Route(pLeft, pRight);
        return line.IsValid;
    }

    private Route(pLeft: XRouterShape, pRight: XRouterShape): XRouterLine
    {
        if (isEmptyRect(pLeft.Rect) || isEmptyRect(pRight.Rect))
            return this.BestLine;

        const leftRect = normalizeRect(pLeft.Rect);
        const rightRect = normalizeRect(pRight.Rect);
        if (this.LeftRect.IsEmpty) this.LeftRect = leftRect;
        if (this.RightRect.IsEmpty) this.RightRect = rightRect;

        const srcDirs = pLeft.DesiredDegree.length > 0
            ? pLeft.DesiredDegree
            : [XRouterDirection.East, XRouterDirection.West, XRouterDirection.North, XRouterDirection.South];
        const tgtDirs = pRight.DesiredDegree.length > 0
            ? pRight.DesiredDegree
            : [XRouterDirection.East, XRouterDirection.West, XRouterDirection.North, XRouterDirection.South];

        const tracks = this.BuildTracks(leftRect, rightRect);

        let best: XPoint[] | null = null;
        let bestCost = Infinity;

        for (const sd of srcDirs)
        {
            for (const td of tgtDirs)
            {
                const startAnchor = this.AnchorPoint(leftRect, sd, pLeft.StartPoint);
                const endAnchor = this.AnchorPoint(rightRect, td, pRight.StartPoint);
                const startExit = this.ExitPoint(startAnchor, sd);
                const endEntry = this.ExitPoint(endAnchor, td);

                this.RegisterTrack(tracks.X, startAnchor.X);
                this.RegisterTrack(tracks.X, startExit.X);
                this.RegisterTrack(tracks.X, endAnchor.X);
                this.RegisterTrack(tracks.X, endEntry.X);
                this.RegisterTrack(tracks.Y, startAnchor.Y);
                this.RegisterTrack(tracks.Y, startExit.Y);
                this.RegisterTrack(tracks.Y, endAnchor.Y);
                this.RegisterTrack(tracks.Y, endEntry.Y);

                tracks.X.sort((a, b) => a - b);
                tracks.Y.sort((a, b) => a - b);
                const xs = this.Unique(tracks.X);
                const ys = this.Unique(tracks.Y);

                const path = this.AStar(xs, ys, startExit, endEntry, sd, leftRect, rightRect);
                if (!path)
                    continue;

                const full: XPoint[] = [startAnchor, ...path, endAnchor];
                const simplified = this.Simplify(full);
                const cost = this.PathCost(simplified);
                if (cost < bestCost)
                {
                    bestCost = cost;
                    best = simplified;
                }
            }
        }

        if (best)
        {
            const line = createRouterLine(best);
            this.BestLine = line;
            this.SolvedLines.push(line);
            this.FinalLines.push(line);
            this.AllLines.push(line);
        }

        return this.BestLine;
    }

    private BuildTracks(pLeft: XRect, pRight: XRect): { X: number[]; Y: number[] }
    {
        const xs: number[] = [];
        const ys: number[] = [];
        const gap = this.Gap;

        const pushRectTracks = (pR: XRect) =>
        {
            xs.push(pR.Left - gap, pR.Left, pR.Left + pR.Width / 2, pR.Right, pR.Right + gap);
            ys.push(pR.Top - gap, pR.Top, pR.Top + pR.Height / 2, pR.Bottom, pR.Bottom + gap);
        };

        pushRectTracks(pLeft);
        pushRectTracks(pRight);

        for (const r of this.Rects)
            pushRectTracks(r);

        const lcx = pLeft.Left + pLeft.Width / 2;
        const rcx = pRight.Left + pRight.Width / 2;
        xs.push((lcx + rcx) / 2);
        const lcy = pLeft.Top + pLeft.Height / 2;
        const rcy = pRight.Top + pRight.Height / 2;
        ys.push((lcy + rcy) / 2);

        const allRects: XRect[] = [pLeft, pRight, ...this.Rects];
        let minLeft = Infinity, maxRight = -Infinity, minTop = Infinity, maxBottom = -Infinity;
        for (const r of allRects)
        {
            if (r.Left < minLeft) minLeft = r.Left;
            if (r.Top < minTop) minTop = r.Top;
            if (r.Right > maxRight) maxRight = r.Right;
            if (r.Bottom > maxBottom) maxBottom = r.Bottom;
        }
        const halo = gap * 2;
        xs.push(minLeft - halo, maxRight + halo);
        ys.push(minTop - halo, maxBottom + halo);

        return { X: xs, Y: ys };
    }

    private RegisterTrack(pArr: number[], pV: number): void
    {
        pArr.push(pV);
    }

    private Unique(pArr: number[]): number[]
    {
        if (pArr.length === 0) return pArr;
        const out: number[] = [pArr[0]];
        for (let i = 1; i < pArr.length; i++)
        {
            if (Math.abs(pArr[i] - out[out.length - 1]) > EPS)
                out.push(pArr[i]);
        }
        return out;
    }

    private AnchorPoint(pRect: XRect, pDir: number, pHint: XPoint): XPoint
    {
        const cx = pRect.Left + pRect.Width / 2;
        const cy = pRect.Top + pRect.Height / 2;
        const hx = Number.isFinite(pHint.X) ? pHint.X : cx;
        const hy = Number.isFinite(pHint.Y) ? pHint.Y : cy;

        if (pDir === XRouterDirection.North) return new XPoint(hx, pRect.Top);
        if (pDir === XRouterDirection.South) return new XPoint(hx, pRect.Top + pRect.Height);
        if (pDir === XRouterDirection.West)  return new XPoint(pRect.Left, hy);
        return new XPoint(pRect.Left + pRect.Width, hy);
    }

    private ExitPoint(pAnchor: XPoint, pDir: number): XPoint
    {
        const gap = this.Gap;
        if (pDir === XRouterDirection.North) return new XPoint(pAnchor.X, pAnchor.Y - gap);
        if (pDir === XRouterDirection.South) return new XPoint(pAnchor.X, pAnchor.Y + gap);
        if (pDir === XRouterDirection.West)  return new XPoint(pAnchor.X - gap, pAnchor.Y);
        return new XPoint(pAnchor.X + gap, pAnchor.Y);
    }

    private SegmentBlocked(
        pAx: number, pAy: number, pBx: number, pBy: number,
        pSrc: XRect, pTgt: XRect
    ): boolean
    {
        if (this.LineIntersectsRectInterior(pSrc, pAx, pAy, pBx, pBy))
            return true;
        if (this.LineIntersectsRectInterior(pTgt, pAx, pAy, pBx, pBy))
            return true;

        if (!this.CheckCollision)
            return false;

        for (const r of this.Rects)
        {
            if (r === pSrc || r === pTgt)
                continue;
            if (this.LineIntersectsRectInterior(r, pAx, pAy, pBx, pBy))
                return true;
        }
        return false;
    }

    private LineIntersectsRectInterior(pR: XRect, pAx: number, pAy: number, pBx: number, pBy: number): boolean
    {
        const left = pR.Left + EPS;
        const right = pR.Left + pR.Width - EPS;
        const top = pR.Top + EPS;
        const bottom = pR.Top + pR.Height - EPS;

        if (Math.abs(pAx - pBx) < EPS)
        {
            if (pAx <= left || pAx >= right)
                return false;
            const ymin = Math.min(pAy, pBy);
            const ymax = Math.max(pAy, pBy);
            return ymax > top && ymin < bottom;
        }

        if (pAy <= top || pAy >= bottom)
            return false;
        const xmin = Math.min(pAx, pBx);
        const xmax = Math.max(pAx, pBx);
        return xmax > left && xmin < right;
    }

    private AStar(
        pXs: number[],
        pYs: number[],
        pStart: XPoint,
        pEnd: XPoint,
        pStartDir: number,
        pSrc: XRect,
        pTgt: XRect
    ): XPoint[] | null
    {
        const startIx = this.NearestIndex(pXs, pStart.X);
        const startIy = this.NearestIndex(pYs, pStart.Y);
        const endIx = this.NearestIndex(pXs, pEnd.X);
        const endIy = this.NearestIndex(pYs, pEnd.Y);

        if (startIx < 0 || startIy < 0 || endIx < 0 || endIy < 0)
            return null;

        const ex = pXs[endIx];
        const ey = pYs[endIy];

        const open: IGridNode[] = [];
        const closed = new Map<string, number>();

        const startNode: IGridNode = {
            Key: this.NodeKey(startIx, startIy, pStartDir),
            X: pXs[startIx],
            Y: pYs[startIy],
            Dir: pStartDir,
            G: 0,
            F: this.Heuristic(pXs[startIx], pYs[startIy], ex, ey),
            Parent: null
        };
        open.push(startNode);

        while (open.length > 0)
        {
            this.Steps++;
            if (this.Steps > this.MaxNodes)
                return null;

            open.sort((a, b) => a.F - b.F);
            const cur = open.shift()!;
            const curIx = this.NearestIndex(pXs, cur.X);
            const curIy = this.NearestIndex(pYs, cur.Y);

            if (curIx === endIx && curIy === endIy)
                return this.Reconstruct(cur);

            const prevG = closed.get(cur.Key);
            if (prevG !== undefined && prevG <= cur.G)
                continue;
            closed.set(cur.Key, cur.G);

            for (const nbr of this.Neighbors(curIx, curIy, pXs, pYs))
            {
                const nx = pXs[nbr.Ix];
                const ny = pYs[nbr.Iy];
                if (this.SegmentBlocked(cur.X, cur.Y, nx, ny, pSrc, pTgt))
                    continue;

                const stepDir = this.DirOf(cur.X, cur.Y, nx, ny);

                const turn = cur.Parent === null ? 0 : (stepDir !== cur.Dir ? this.TurnPenalty : 0);
                const step = Math.abs(nx - cur.X) + Math.abs(ny - cur.Y);
                const g = cur.G + step + turn;
                const key = this.NodeKey(nbr.Ix, nbr.Iy, stepDir);
                const oldG = closed.get(key);
                if (oldG !== undefined && oldG <= g)
                    continue;

                open.push({
                    Key: key,
                    X: nx,
                    Y: ny,
                    Dir: stepDir,
                    G: g,
                    F: g + this.Heuristic(nx, ny, ex, ey),
                    Parent: cur
                });
            }
        }

        return null;
    }

    private Neighbors(pIx: number, pIy: number, pXs: number[], pYs: number[]): Array<{ Ix: number; Iy: number }>
    {
        const out: Array<{ Ix: number; Iy: number }> = [];
        if (pIx > 0) out.push({ Ix: pIx - 1, Iy: pIy });
        if (pIx < pXs.length - 1) out.push({ Ix: pIx + 1, Iy: pIy });
        if (pIy > 0) out.push({ Ix: pIx, Iy: pIy - 1 });
        if (pIy < pYs.length - 1) out.push({ Ix: pIx, Iy: pIy + 1 });
        return out;
    }

    private DirOf(pAx: number, pAy: number, pBx: number, pBy: number): number
    {
        if (Math.abs(pAx - pBx) < EPS)
            return pBy < pAy ? XRouterDirection.North : XRouterDirection.South;
        return pBx < pAx ? XRouterDirection.West : XRouterDirection.East;
    }

    private NodeKey(pIx: number, pIy: number, pDir: number): string
    {
        return `${pIx}|${pIy}|${pDir}`;
    }

    private Heuristic(pAx: number, pAy: number, pBx: number, pBy: number): number
    {
        return Math.abs(pAx - pBx) + Math.abs(pAy - pBy);
    }

    private NearestIndex(pArr: number[], pV: number): number
    {
        if (pArr.length === 0) return -1;
        let bestI = 0;
        let bestD = Math.abs(pArr[0] - pV);
        for (let i = 1; i < pArr.length; i++)
        {
            const d = Math.abs(pArr[i] - pV);
            if (d < bestD)
            {
                bestD = d;
                bestI = i;
            }
        }
        return bestI;
    }

    private Reconstruct(pNode: IGridNode): XPoint[]
    {
        const out: XPoint[] = [];
        let n: IGridNode | null = pNode;
        while (n)
        {
            out.unshift(new XPoint(n.X, n.Y));
            n = n.Parent;
        }
        return out;
    }

    private Simplify(pPoints: XPoint[]): XPoint[]
    {
        if (pPoints.length <= 2) return pPoints;
        const out: XPoint[] = [pPoints[0]];
        for (let i = 1; i < pPoints.length - 1; i++)
        {
            const a = out[out.length - 1];
            const b = pPoints[i];
            const c = pPoints[i + 1];
            const colX = Math.abs(a.X - b.X) < EPS && Math.abs(b.X - c.X) < EPS;
            const colY = Math.abs(a.Y - b.Y) < EPS && Math.abs(b.Y - c.Y) < EPS;
            if (!colX && !colY)
                out.push(b);
        }
        out.push(pPoints[pPoints.length - 1]);
        return out;
    }

    private PathCost(pPoints: XPoint[]): number
    {
        let len = 0;
        let turns = 0;
        for (let i = 1; i < pPoints.length; i++)
        {
            const a = pPoints[i - 1];
            const b = pPoints[i];
            len += Math.abs(a.X - b.X) + Math.abs(a.Y - b.Y);
            if (i >= 2)
            {
                const p = pPoints[i - 2];
                const horiz1 = Math.abs(p.Y - a.Y) < EPS;
                const horiz2 = Math.abs(a.Y - b.Y) < EPS;
                if (horiz1 !== horiz2)
                    turns++;
            }
        }
        return len + turns * this.TurnPenalty;
    }
}
