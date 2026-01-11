import { XRect, XPoint } from "../Core/XGeometry.js";
import { XGuid } from "../Core/XGuid.js";

/**
 * Direções de roteamento em graus
 */
export enum XRouterDirection {
    /** 0 graus - Norte / Cima */
    North = 0,
    /** 90 graus - Leste / Direita */
    East = 90,
    /** 180 graus - Sul / Baixo */
    South = 180,
    /** 270 graus - Oeste / Esquerda */
    West = 270
}

/**
 * Representa uma linha de roteamento candidata ou final
 */
export interface XRouterLine {
    /** Identificador único da linha */
    ID: string;
    /** Pontos que compõem a linha */
    Points: XPoint[];
    /** Direção inicial */
    StartDir: number;
    /** Direção final */
    EndDir: number;
    /** Indica se a linha é válida */
    IsValid: boolean;
}

/**
 * Define uma forma para o roteador (retângulo com pontos de conexão)
 */
export interface XRouterShape {
    /** Retângulo da forma */
    Rect: XRect;
    /** Ponto de início preferencial */
    StartPoint: XPoint;
    /** Direções permitidas para saída/entrada */
    DesiredDegree: number[];
}

/**
 * Cria uma linha de roteamento vazia/inválida
 */
export function emptyRouterLine(): XRouterLine {
    return {
        ID: "",
        Points: [],
        StartDir: -1,
        EndDir: -1,
        IsValid: false
    };
}

/**
 * Cria uma nova linha de roteamento
 * @param pPoints - Pontos da linha
 * @param pStartDir - Direção inicial (opcional)
 * @param pEndDir - Direção final (opcional)
 */
export function createRouterLine(pPoints: XPoint[], pStartDir: number = -1, pEndDir: number = -1): XRouterLine {
    return {
        ID: XGuid.NewValue(),
        Points: pPoints,
        StartDir: pStartDir,
        EndDir: pEndDir,
        IsValid: true
    };
}

/**
 * Normaliza um retângulo garantindo dimensões positivas
 * @param pRect - Retângulo a normalizar
 */
export function normalizeRect(pRect: XRect): XRect {
    if (pRect.Width < 0 || pRect.Height < 0) {
        return new XRect(
            pRect.Width < 0 ? pRect.Left + pRect.Width : pRect.Left,
            pRect.Height < 0 ? pRect.Top + pRect.Height : pRect.Top,
            Math.abs(pRect.Width),
            Math.abs(pRect.Height)
        );
    }
    return pRect;
}

/**
 * Verifica se um retângulo é nulo ou vazio
 * @param pRect - Retângulo para verificar
 */
export function isEmptyRect(pRect: XRect | null | undefined): boolean {
    return !pRect || pRect.IsEmpty;
}

/**
 * Clona um array de pontos
 * @param pPoints - Pontos a clonar
 */
export function clonePoints(pPoints: XPoint[]): XPoint[] {
    return pPoints.map(p => new XPoint(p.X, p.Y));
}
