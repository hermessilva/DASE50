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
import { XRouteContext } from "./XRouteContext.js";

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
    Key: number;
    Ix: number;
    Iy: number;
    X: number;
    Y: number;
    Dir: number;
    G: number;
    F: number;
    Parent: IGridNode | null;
}

/**
 * Binary min-heap keyed on node F cost. Replaces a per-iteration Array.sort of
 * the whole open set (which made A* O(n² log n) and froze the extension host on
 * large diagrams). Push/pop are O(log n).
 */
class XNodeHeap
{
    private _Items: IGridNode[] = [];

    public get Size(): number
    {
        return this._Items.length;
    }

    public Push(pNode: IGridNode): void
    {
        const items = this._Items;
        items.push(pNode);
        let i = items.length - 1;
        while (i > 0)
        {
            const parent = (i - 1) >> 1;
            if (items[parent].F <= items[i].F)
                break;
            const tmp = items[parent];
            items[parent] = items[i];
            items[i] = tmp;
            i = parent;
        }
    }

    public Pop(): IGridNode | undefined
    {
        const items = this._Items;
        const n = items.length;
        if (n === 0)
            return undefined;
        const top = items[0];
        const last = items.pop()!;
        if (n > 1)
        {
            items[0] = last;
            let i = 0;
            const size = items.length;
            for (;;)
            {
                const left = 2 * i + 1;
                const right = left + 1;
                let smallest = i;
                if (left < size && items[left].F < items[smallest].F)
                    smallest = left;
                if (right < size && items[right].F < items[smallest].F)
                    smallest = right;
                if (smallest === i)
                    break;
                const tmp = items[smallest];
                items[smallest] = items[i];
                items[i] = tmp;
                i = smallest;
            }
        }
        return top;
    }
}

const EPS = 0.5;
const DEFAULT_GAP = 20;
const DEFAULT_TURN_PENALTY = 12;
const DEFAULT_MAX_NODES = 20000;
// Social penalties are deliberately mild: strong values build cost "walls"
// that bury the A* heuristic and make the search flood large diagrams.
// Overlap 1/px means a 40px stacked run costs one 40px detour — enough for
// lines to prefer a free neighbouring lane, cheap enough to stay fast.
const DEFAULT_OVERLAP_PENALTY_PER_PX = 1;
const DEFAULT_CROSS_PENALTY = 12;

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

    /**
     * Contexto global compartilhado (grade + occupancy). Quando presente:
     *   - a grade de tracks vem do contexto (construída uma vez por passada)
     *   - o A* soma custos sociais: sobreposição colinear e cruzamento com
     *     rotas já traçadas nesta passada (penaliza amontoar linhas).
     */
    public Context: XRouteContext | null = null;
    /** ID da referência sendo roteada — excluída das consultas de ocupação. */
    public CurrentRefID: string = "";
    /** Custo por pixel de sobreposição colinear com rota existente. */
    public OverlapPenaltyPerPx: number = DEFAULT_OVERLAP_PENALTY_PER_PX;
    /** Custo por cruzamento perpendicular com rota existente. */
    public CrossPenalty: number = DEFAULT_CROSS_PENALTY;

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

        // Base tracks: from the shared context when available (built once per
        // full reroute), otherwise computed locally for this pair.
        const baseTracks = this.Context
            ? { X: this.Context.TracksX, Y: this.Context.TracksY }
            : this.BuildTracks(leftRect, rightRect);

        // Search window: routes rarely need to leave the corridor between the
        // two endpoints. Clipping tracks and obstacles to this window keeps
        // the A* grid small on large diagrams; a full-grid retry below covers
        // the rare detour that must leave the window.
        const windowMargin = this.Gap * 2;
        const winLeft = Math.min(leftRect.Left, rightRect.Left) - windowMargin;
        const winRight = Math.max(leftRect.Right, rightRect.Right) + windowMargin;
        const winTop = Math.min(leftRect.Top, rightRect.Top) - windowMargin;
        const winBottom = Math.max(leftRect.Bottom, rightRect.Bottom) + windowMargin;

        const windowTracks = {
            X: baseTracks.X.filter(v => v >= winLeft && v <= winRight),
            Y: baseTracks.Y.filter(v => v >= winTop && v <= winBottom)
        };
        const windowRects = this.Rects.filter(r =>
            r.Right >= winLeft && r.Left <= winRight && r.Bottom >= winTop && r.Top <= winBottom);

        let best = this.RouteWithTracks(
            pLeft, pRight, srcDirs, tgtDirs, leftRect, rightRect, windowTracks, windowRects);

        if (!best && (windowTracks.X.length < baseTracks.X.length || windowTracks.Y.length < baseTracks.Y.length))
            best = this.RouteWithTracks(
                pLeft, pRight, srcDirs, tgtDirs, leftRect, rightRect, baseTracks, this.Rects);

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

    /**
     * Tries every requested direction combination over the given track set and
     * obstacle list, returning the cheapest simplified path (or null).
     */
    private RouteWithTracks(
        pLeft: XRouterShape,
        pRight: XRouterShape,
        pSrcDirs: number[],
        pTgtDirs: number[],
        pLeftRect: XRect,
        pRightRect: XRect,
        pTracks: { X: number[]; Y: number[] },
        pActiveRects: XRect[]
    ): XPoint[] | null
    {
        let best: XPoint[] | null = null;
        let bestCost = Infinity;

        for (const sd of pSrcDirs)
        {
            for (const td of pTgtDirs)
            {
                const startAnchor = this.AnchorPoint(pLeftRect, sd, pLeft.StartPoint);
                const endAnchor = this.AnchorPoint(pRightRect, td, pRight.StartPoint);
                const startExit = this.ExitPoint(startAnchor, sd);
                const endEntry = this.ExitPoint(endAnchor, td);

                // Copy base tracks per combination so anchor tracks of one
                // combo never leak into the next (keeps the base immutable).
                const tx = pTracks.X.slice();
                const ty = pTracks.Y.slice();
                tx.push(startAnchor.X, startExit.X, endAnchor.X, endEntry.X);
                ty.push(startAnchor.Y, startExit.Y, endAnchor.Y, endEntry.Y);
                tx.sort((a, b) => a - b);
                ty.sort((a, b) => a - b);
                const xs = this.Unique(tx);
                const ys = this.Unique(ty);

                const path = this.AStar(xs, ys, startExit, endEntry, sd, pLeftRect, pRightRect, pActiveRects);
                if (!path)
                    continue;

                const full: XPoint[] = [startAnchor, ...path, endAnchor];
                const simplified = this.Simplify(full);
                const cost = this.PathCost(simplified) + this.SocialCost(simplified);
                if (cost < bestCost)
                {
                    bestCost = cost;
                    best = simplified;
                }
            }
        }

        return best;
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

    private AStar(
        pXs: number[],
        pYs: number[],
        pStart: XPoint,
        pEnd: XPoint,
        pStartDir: number,
        pSrc: XRect,
        pTgt: XRect,
        pActiveRects?: XRect[]
    ): XPoint[] | null
    {
        const activeRects = pActiveRects ?? this.Rects;
        const startIx = this.NearestIndex(pXs, pStart.X);
        const startIy = this.NearestIndex(pYs, pStart.Y);
        const endIx = this.NearestIndex(pXs, pEnd.X);
        const endIy = this.NearestIndex(pYs, pEnd.Y);

        if (startIx < 0 || startIy < 0 || endIx < 0 || endIy < 0)
            return null;

        const ex = pXs[endIx];
        const ey = pYs[endIy];

        // Precomputed straddle lists: for every x-track, the y-interiors of the
        // rects that this track passes through (and symmetrically for y-tracks).
        // Turns the per-edge obstacle test from O(rects) into O(straddling few).
        const blockRects: XRect[] = [pSrc, pTgt];
        if (this.CheckCollision)
        {
            for (const r of activeRects)
            {
                if (r !== pSrc && r !== pTgt)
                    blockRects.push(r);
            }
        }
        const vBlock: number[][] = new Array(pXs.length);
        for (let i = 0; i < pXs.length; i++)
        {
            const x = pXs[i];
            const list: number[] = [];
            for (const r of blockRects)
            {
                if (x > r.Left + EPS && x < r.Left + r.Width - EPS)
                    list.push(r.Top + EPS, r.Top + r.Height - EPS);
            }
            vBlock[i] = list;
        }
        const hBlock: number[][] = new Array(pYs.length);
        for (let i = 0; i < pYs.length; i++)
        {
            const y = pYs[i];
            const list: number[] = [];
            for (const r of blockRects)
            {
                if (y > r.Top + EPS && y < r.Top + r.Height - EPS)
                    list.push(r.Left + EPS, r.Left + r.Width - EPS);
            }
            hBlock[i] = list;
        }

        const verticalStepBlocked = (pIx: number, pYa: number, pYb: number): boolean =>
        {
            const list = vBlock[pIx];
            const lo = pYa < pYb ? pYa : pYb;
            const hi = pYa < pYb ? pYb : pYa;
            for (let i = 0; i < list.length; i += 2)
            {
                if (hi > list[i] && lo < list[i + 1])
                    return true;
            }
            return false;
        };
        const horizontalStepBlocked = (pIy: number, pXa: number, pXb: number): boolean =>
        {
            const list = hBlock[pIy];
            const lo = pXa < pXb ? pXa : pXb;
            const hi = pXa < pXb ? pXb : pXa;
            for (let i = 0; i < list.length; i += 2)
            {
                if (hi > list[i] && lo < list[i + 1])
                    return true;
            }
            return false;
        };

        // Strict closed set: each (cell, heading) state expands at most once.
        // Social costs make the cost landscape inconsistent with the heuristic;
        // allowing re-expansion caused near-exhaustive searches on large grids
        // for a marginal quality gain, so re-expansion is deliberately not done.
        const open = new XNodeHeap();
        const closed = new Set<number>();
        const yLen = pYs.length;
        const xLen = pXs.length;
        // Exploring more than every (cell, direction) state is pointless.
        const maxSteps = Math.min(this.MaxNodes, xLen * yLen * 4 + 1000);

        const startNode: IGridNode = {
            Key: this.NodeKey(startIx, startIy, pStartDir, yLen),
            Ix: startIx,
            Iy: startIy,
            X: pXs[startIx],
            Y: pYs[startIy],
            Dir: pStartDir,
            G: 0,
            F: this.Heuristic(pXs[startIx], pYs[startIy], ex, ey, pStartDir),
            Parent: null
        };
        open.Push(startNode);

        // Social costs are stable for a given edge during one search — cache
        // them so re-pushed nodes do not rescan the occupancy buckets.
        const socialCache = new Map<number, number>();

        const tryStep = (pCur: IGridNode, pNIx: number, pNIy: number): void =>
        {
            const nx = pXs[pNIx];
            const ny = pYs[pNIy];
            let stepDir: number;
            if (pNIx === pCur.Ix)
            {
                if (verticalStepBlocked(pNIx, pCur.Y, ny))
                    return;
                stepDir = ny < pCur.Y ? XRouterDirection.North : XRouterDirection.South;
            }
            else
            {
                if (horizontalStepBlocked(pNIy, pCur.X, nx))
                    return;
                stepDir = nx < pCur.X ? XRouterDirection.West : XRouterDirection.East;
            }

            const turn = pCur.Parent === null ? 0 : (stepDir !== pCur.Dir ? this.TurnPenalty : 0);
            const step = Math.abs(nx - pCur.X) + Math.abs(ny - pCur.Y);
            const key = this.NodeKey(pNIx, pNIy, stepDir, yLen);
            if (closed.has(key))
                return;
            let social = socialCache.get(key);
            if (social === undefined)
            {
                social = this.StepSocialCost(pCur.X, pCur.Y, nx, ny);
                socialCache.set(key, social);
            }
            const g = pCur.G + step + turn + social;

            open.Push({
                Key: key,
                Ix: pNIx,
                Iy: pNIy,
                X: nx,
                Y: ny,
                Dir: stepDir,
                G: g,
                F: g + this.Heuristic(nx, ny, ex, ey, stepDir),
                Parent: pCur
            });
        };

        let steps = 0;
        while (open.Size > 0)
        {
            steps++;
            this.Steps++;
            if (steps > maxSteps)
                return null;

            const cur = open.Pop()!;
            const curIx = cur.Ix;
            const curIy = cur.Iy;

            if (curIx === endIx && curIy === endIy)
                return this.Reconstruct(cur);

            if (closed.has(cur.Key))
                continue;
            closed.add(cur.Key);

            if (curIx > 0) tryStep(cur, curIx - 1, curIy);
            if (curIx < xLen - 1) tryStep(cur, curIx + 1, curIy);
            if (curIy > 0) tryStep(cur, curIx, curIy - 1);
            if (curIy < yLen - 1) tryStep(cur, curIx, curIy + 1);
        }

        return null;
    }

    private NodeKey(pIx: number, pIy: number, pDir: number, pYLen: number): number
    {
        // Numeric key: (ix * yLen + iy) * 4 + dirIndex — avoids string
        // allocation in the A* hot path. Directions are multiples of 90.
        return (pIx * pYLen + pIy) * 4 + (pDir / 90);
    }

    private Heuristic(pAx: number, pAy: number, pBx: number, pBy: number, pDir: number = -1): number
    {
        // Weighted A* (ε = 20%) plus a lower bound on the remaining turns
        // given the current heading. Real routes accumulate turn and social
        // penalties the heuristic cannot see, so an unweighted search floods
        // the grid; the weight trades a bounded optimality loss for an
        // order-of-magnitude fewer expansions. Route shape is still governed
        // by the turn and social terms in G.
        const dx = pBx - pAx;
        const dy = pBy - pAy;
        const dist = (Math.abs(dx) + Math.abs(dy)) * 1.5;

        if (pDir < 0 || dist < EPS)
            return dist;

        const needX = Math.abs(dx) > EPS;
        const needY = Math.abs(dy) > EPS;
        let turns: number;
        if (pDir === XRouterDirection.East || pDir === XRouterDirection.West)
        {
            const forward = pDir === XRouterDirection.East ? dx : -dx;
            if (!needY)
                turns = forward > EPS ? 0 : 2;
            else if (forward > EPS)
                turns = 1;
            else if (!needX)
                turns = 1;
            else
                turns = 2;
        }
        else
        {
            const forward = pDir === XRouterDirection.South ? dy : -dy;
            if (!needX)
                turns = forward > EPS ? 0 : 2;
            else if (forward > EPS)
                turns = 1;
            else if (!needY)
                turns = 1;
            else
                turns = 2;
        }
        return dist + turns * this.TurnPenalty;
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

    /**
     * Social cost of a single A* step against routes already committed in the
     * shared context: colinear overlap (strong) and perpendicular crossings
     * (medium). Zero when no context is attached — legacy behavior preserved.
     */
    private StepSocialCost(pAx: number, pAy: number, pBx: number, pBy: number): number
    {
        const ctx = this.Context;
        if (!ctx)
            return 0;
        const occ = ctx.Occupancy;
        if (Math.abs(pAx - pBx) < EPS)
        {
            const lo = Math.min(pAy, pBy);
            const hi = Math.max(pAy, pBy);
            return this.OverlapPenaltyPerPx * occ.OverlapLength(true, pAx, lo, hi, this.CurrentRefID)
                + this.CrossPenalty * occ.CrossingCount(true, pAx, lo, hi, this.CurrentRefID);
        }
        const lo = Math.min(pAx, pBx);
        const hi = Math.max(pAx, pBx);
        return this.OverlapPenaltyPerPx * occ.OverlapLength(false, pAy, lo, hi, this.CurrentRefID)
            + this.CrossPenalty * occ.CrossingCount(false, pAy, lo, hi, this.CurrentRefID);
    }

    /** Social cost of an entire path — used to compare direction combinations. */
    private SocialCost(pPoints: XPoint[]): number
    {
        if (!this.Context)
            return 0;
        let total = 0;
        for (let i = 1; i < pPoints.length; i++)
            total += this.StepSocialCost(pPoints[i - 1].X, pPoints[i - 1].Y, pPoints[i].X, pPoints[i].Y);
        return total;
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
