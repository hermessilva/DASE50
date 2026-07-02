import { XRect, XPoint } from "../Core/XGeometry.js";
import { normalizeRect } from "./XRouterTypes.js";

/**
 * Intervalo ocupado em um track (coordenada fixa) por uma rota já traçada.
 */
export interface XOccupancyInterval
{
    /** Coordenada fixa exata do segmento (X para vertical, Y para horizontal) */
    Fixed: number;
    Lo: number;
    Hi: number;
    RefID: string;
}

/**
 * Mapa de ocupação de tracks: registra os segmentos H/V de rotas já traçadas
 * para que o A* possa penalizar sobreposição colinear e cruzamentos.
 * Indexado por coordenada quantizada para consulta O(1) por bucket.
 */
export class XOccupancyMap
{
    private readonly _H = new Map<number, XOccupancyInterval[]>();
    private readonly _V = new Map<number, XOccupancyInterval[]>();
    private _HKeys: number[] | null = null;
    private _VKeys: number[] | null = null;
    private readonly _Quantum: number;

    public constructor(pQuantum: number = 4)
    {
        this._Quantum = pQuantum;
    }

    private KeyOf(pValue: number): number
    {
        return Math.round(pValue / this._Quantum);
    }

    /** Sorted key cache so range queries touch only buckets that exist. */
    private SortedKeys(pVertical: boolean): number[]
    {
        if (pVertical)
        {
            if (!this._VKeys)
                this._VKeys = [...this._V.keys()].sort((a, b) => a - b);
            return this._VKeys;
        }
        if (!this._HKeys)
            this._HKeys = [...this._H.keys()].sort((a, b) => a - b);
        return this._HKeys;
    }

    private static LowerBound(pArr: number[], pValue: number): number
    {
        let lo = 0;
        let hi = pArr.length;
        while (lo < hi)
        {
            const mid = (lo + hi) >> 1;
            if (pArr[mid] < pValue)
                lo = mid + 1;
            else
                hi = mid;
        }
        return lo;
    }

    public Clear(): void
    {
        this._H.clear();
        this._V.clear();
        this._HKeys = null;
        this._VKeys = null;
    }

    /** Registra todos os segmentos ortogonais de uma rota. Segmentos diagonais são ignorados. */
    public AddPath(pPoints: XPoint[], pRefID: string): void
    {
        for (let i = 1; i < pPoints.length; i++)
        {
            const a = pPoints[i - 1];
            const b = pPoints[i];
            if (Math.abs(a.X - b.X) < 0.5)
                this.AddInterval(this._V, a.X, Math.min(a.Y, b.Y), Math.max(a.Y, b.Y), pRefID);
            else if (Math.abs(a.Y - b.Y) < 0.5)
                this.AddInterval(this._H, a.Y, Math.min(a.X, b.X), Math.max(a.X, b.X), pRefID);
        }
    }

    /** Remove todos os intervalos de uma referência (para re-rota incremental). */
    public RemoveRef(pRefID: string): void
    {
        const prune = (pMap: Map<number, XOccupancyInterval[]>): void =>
        {
            for (const [key, list] of pMap)
            {
                const kept = list.filter(iv => iv.RefID !== pRefID);
                if (kept.length === 0)
                    pMap.delete(key);
                else if (kept.length !== list.length)
                    pMap.set(key, kept);
            }
        };
        prune(this._H);
        prune(this._V);
        this._HKeys = null;
        this._VKeys = null;
    }

    private AddInterval(pMap: Map<number, XOccupancyInterval[]>, pFixed: number, pLo: number, pHi: number, pRefID: string): void
    {
        if (pHi - pLo < 0.5)
            return;
        const key = this.KeyOf(pFixed);
        let list = pMap.get(key);
        if (!list)
        {
            list = [];
            pMap.set(key, list);
            if (pMap === this._H)
                this._HKeys = null;
            else
                this._VKeys = null;
        }
        list.push({ Fixed: pFixed, Lo: pLo, Hi: pHi, RefID: pRefID });
    }

    /**
     * Comprimento total de sobreposição colinear de [pLo,pHi] no track pFixed
     * contra intervalos de OUTRAS referências (tolerância pTol na coordenada fixa).
     */
    public OverlapLength(pVertical: boolean, pFixed: number, pLo: number, pHi: number, pExcludeRef: string, pTol: number = 3): number
    {
        const map = pVertical ? this._V : this._H;
        if (map.size === 0)
            return 0;
        const kLo = this.KeyOf(pFixed - pTol);
        const kHi = this.KeyOf(pFixed + pTol);
        let total = 0;
        for (let k = kLo; k <= kHi; k++)
        {
            const list = map.get(k);
            if (!list)
                continue;
            for (const iv of list)
            {
                if (iv.RefID === pExcludeRef)
                    continue;
                if (Math.abs(iv.Fixed - pFixed) > pTol)
                    continue;
                const lo = Math.max(pLo, iv.Lo);
                const hi = Math.min(pHi, iv.Hi);
                if (hi > lo)
                    total += hi - lo;
            }
        }
        return total;
    }

    /**
     * Número de cruzamentos perpendiculares que um segmento em pFixed
     * varrendo [pLo,pHi] provoca contra intervalos do eixo oposto.
     * Junções em T (encostar no endpoint) não contam como cruzamento.
     */
    public CrossingCount(pVertical: boolean, pFixed: number, pLo: number, pHi: number, pExcludeRef: string): number
    {
        const map = pVertical ? this._H : this._V;
        if (map.size === 0)
            return 0;
        const eps = 1;
        // Iterate only buckets that exist inside the span (binary search over
        // the sorted key cache) — a long segment no longer walks empty buckets.
        const keys = this.SortedKeys(!pVertical);
        const kLo = this.KeyOf(pLo);
        const kHi = this.KeyOf(pHi);
        let count = 0;
        for (let i = XOccupancyMap.LowerBound(keys, kLo); i < keys.length && keys[i] <= kHi; i++)
        {
            const list = map.get(keys[i]);
            if (!list)
                continue;
            for (const iv of list)
            {
                if (iv.RefID === pExcludeRef)
                    continue;
                if (iv.Fixed <= pLo + eps || iv.Fixed >= pHi - eps)
                    continue;
                if (pFixed > iv.Lo + eps && pFixed < iv.Hi - eps)
                    count++;
            }
        }
        return count;
    }
}

/**
 * Contexto global de roteamento construído UMA vez por passada de RouteAllLines:
 *   - grade de tracks compartilhada (bordas ± gap, centros, lanes de corredor, halo)
 *   - obstáculos com ID (para exclusão de origem/destino por referência)
 *   - occupancy map preenchido à medida que as rotas são traçadas
 * Elimina a reconstrução de tracks por referência × combinação de direções.
 */
export class XRouteContext
{
    public readonly Gap: number;
    public readonly LanePitch: number;
    public readonly TracksX: number[];
    public readonly TracksY: number[];
    public readonly Occupancy: XOccupancyMap;

    /** Retângulos originais (não inflados), indexados por ID do elemento. */
    private readonly _RectsByID = new Map<string, XRect>();

    public constructor(pRects: Array<{ ID: string; Rect: XRect }>, pGap: number, pLanePitch?: number)
    {
        this.Gap = pGap;
        this.LanePitch = pLanePitch ?? Math.max(8, Math.round(pGap / 4));
        this.Occupancy = new XOccupancyMap();

        const rects: XRect[] = [];
        for (const entry of pRects)
        {
            const r = normalizeRect(entry.Rect);
            this._RectsByID.set(entry.ID, r);
            rects.push(r);
        }

        const built = XRouteContext.BuildTracks(rects, pGap, this.LanePitch);
        this.TracksX = built.X;
        this.TracksY = built.Y;
    }

    public GetRect(pID: string): XRect | undefined
    {
        return this._RectsByID.get(pID);
    }

    public GetAllRects(): Array<{ ID: string; Rect: XRect }>
    {
        const out: Array<{ ID: string; Rect: XRect }> = [];
        for (const [id, rect] of this._RectsByID)
            out.push({ ID: id, Rect: rect });
        return out;
    }

    /**
     * True se um segmento ortogonal NÃO intersecta o interior de nenhum
     * retângulo registrado (com clearance). Usado pelo nudging para validar shifts.
     */
    public IsSegmentFree(pVertical: boolean, pFixed: number, pLo: number, pHi: number, pClearance: number = 0): boolean
    {
        for (const rect of this._RectsByID.values())
        {
            const left = rect.Left - pClearance;
            const right = rect.Left + rect.Width + pClearance;
            const top = rect.Top - pClearance;
            const bottom = rect.Top + rect.Height + pClearance;
            if (pVertical)
            {
                if (pFixed > left && pFixed < right && pHi > top && pLo < bottom)
                    return false;
            }
            else
            {
                if (pFixed > top && pFixed < bottom && pHi > left && pLo < right)
                    return false;
            }
        }
        return true;
    }

    /**
     * Grade global: tracks por retângulo (bordas ± gap, centro), lanes
     * intermediárias em corredores largos e halo externo. Ordenada e única.
     */
    private static BuildTracks(pRects: XRect[], pGap: number, pLanePitch: number): { X: number[]; Y: number[] }
    {
        const xs: number[] = [];
        const ys: number[] = [];

        for (const r of pRects)
        {
            xs.push(r.Left - pGap, r.Left, r.Left + r.Width / 2, r.Right, r.Right + pGap);
            ys.push(r.Top - pGap, r.Top, r.Top + r.Height / 2, r.Bottom, r.Bottom + pGap);
        }

        if (pRects.length > 0)
        {
            let minLeft = Infinity, maxRight = -Infinity, minTop = Infinity, maxBottom = -Infinity;
            for (const r of pRects)
            {
                if (r.Left < minLeft) minLeft = r.Left;
                if (r.Top < minTop) minTop = r.Top;
                if (r.Right > maxRight) maxRight = r.Right;
                if (r.Bottom > maxBottom) maxBottom = r.Bottom;
            }
            const halo = pGap * 2;
            xs.push(minLeft - halo, maxRight + halo);
            ys.push(minTop - halo, maxBottom + halo);
        }

        const finalize = (pArr: number[]): number[] =>
        {
            pArr.sort((a, b) => a - b);
            const unique: number[] = [];
            for (const v of pArr)
            {
                if (unique.length === 0 || Math.abs(v - unique[unique.length - 1]) > 0.5)
                    unique.push(v);
            }
            // Lanes intermediárias: corredores largos ganham tracks extras para
            // que linhas paralelas tenham espaço físico na grade (cap 3 por corredor).
            const withLanes: number[] = [];
            for (let i = 0; i < unique.length; i++)
            {
                withLanes.push(unique[i]);
                if (i + 1 >= unique.length)
                    continue;
                const span = unique[i + 1] - unique[i];
                if (span > pLanePitch * 3)
                {
                    const lanes = Math.min(2, Math.floor(span / (pLanePitch * 2)) - 1);
                    for (let l = 1; l <= lanes; l++)
                        withLanes.push(unique[i] + (span * l) / (lanes + 1));
                }
            }
            return withLanes;
        };

        return { X: finalize(xs), Y: finalize(ys) };
    }
}
