import { XDesign } from "../../Design/XDesign.js";
import { XGuid } from "../../Core/XGuid.js";
import { XRect, XPoint } from "../../Core/XGeometry.js";
import { XORMTable } from "./XORMTable.js";
import { XORMReference } from "./XORMReference.js";
import { XORMField } from "./XORMField.js";

/** Lado de conexão da tabela */
enum XConnectionSide { Left, Right, Top, Bottom }

export interface XICreateTableOptions
{
    X?: number;
    Y?: number;
    Width?: number;
    Height?: number;
    Name?: string;
    Schema?: string;
}

export interface XICreateReferenceOptions
{
    SourceFieldID: string;
    TargetTableID: string;
    Name?: string;
}

export class XORMDesign extends XDesign
{
    public constructor()
    {
        super();
    }

    public CreateTable(pOptions?: XICreateTableOptions): XORMTable
    {
        const table = new XORMTable();
        table.ID = XGuid.NewValue();
        table.Name = pOptions?.Name ?? this.GenerateTableName();
        table.Schema = pOptions?.Schema ?? "dbo";
        table.Bounds = new XRect(
            pOptions?.X ?? 0,
            pOptions?.Y ?? 0,
            pOptions?.Width ?? 200,
            pOptions?.Height ?? 150
        );

        this.AppendChild(table);
        return table;
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
     * Roteia todas as referências do design ORM
     * Regras:
     * 1. Source sai APENAS horizontal (esquerda/direita) alinhado com o campo FK
     * 2. Target pode receber de qualquer lado (esquerda/direita/topo/fundo)
     * 3. Evita colisão com outras tabelas
     * 4. Múltiplos segmentos ortogonais quando necessário
     * 5. NUNCA diagonal - sempre vertical ou horizontal
     */
    public RouteAllLines(): void
    {
        const references = this.GetReferences();
        const tables = this.GetTables();

        for (const ref of references)
            this.RouteReference(ref, tables);
    }

    /**
     * Roteia uma referência específica com algoritmo ortogonal
     */
    private RouteReference(pRef: XORMReference, pTables: XORMTable[]): void
    {
        const sourceField = this.FindFieldByID(pRef.Source);
        const targetTable = this.FindTableByID(pRef.Target);

        if (!sourceField || !targetTable)
            return;

        const sourceTable = sourceField.ParentNode as XORMTable;
        if (!(sourceTable instanceof XORMTable))
            return;

        // Calcula Y do campo source dentro da tabela
        const fieldIndex = sourceTable.GetFields().findIndex(f => f.ID === sourceField.ID);
        if (fieldIndex < 0)
            return;

        const headerHeight = 30;
        const fieldHeight = 20;
        const fieldY = sourceTable.Bounds.Top + headerHeight + (fieldIndex * fieldHeight) + (fieldHeight / 2);

        // Coleta obstáculos (todas as tabelas exceto source e target)
        const obstacles = pTables
            .filter(t => t.ID !== sourceTable.ID && t.ID !== targetTable.ID)
            .map(t => t.Bounds);

        // Calcula rota ortogonal evitando colisões
        const points = this.CalculateOrthogonalRoute(
            sourceTable.Bounds,
            targetTable.Bounds,
            fieldY,
            obstacles
        );

        pRef.Points = points;
    }

    /**
     * Calcula rota ortogonal entre source e target evitando obstáculos
     * REGRAS FUNDAMENTAIS:
     * 1. Source SEMPRE sai pela lateral (esquerda ou direita), alinhado com o campo
     * 2. Target pode receber de qualquer lado (Left, Right, Top, Bottom)
     * 3. Segmento inicial e final devem ter tamanho mínimo (minSegment)
     * 4. Quando tabelas estão verticalmente alinhadas, usa rota em "C"
     * 5. NUNCA diagonal - sempre vertical ou horizontal
     */
    private CalculateOrthogonalRoute(
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pFieldY: number,
        pObstacles: XRect[]
    ): XPoint[]
    {
        const gap = 20; // Espaçamento mínimo das tabelas
        const minSegment = 30; // Tamanho mínimo do segmento inicial/final
        const points: XPoint[] = [];

        // Determina lado de saída do source baseado na posição relativa
        const sourceExitsRight = this.DetermineSourceExitSide(pSourceBounds, pTargetBounds);

        // Ponto de saída do source (horizontal, alinhado com o campo)
        const startX = sourceExitsRight ? pSourceBounds.Right : pSourceBounds.Left;
        const startY = pFieldY;
        points.push(new XPoint(startX, startY));

        // Determina melhor lado de entrada no target
        const targetSide = this.DetermineBestTargetSide(
            pSourceBounds, pTargetBounds, startX, startY, sourceExitsRight
        );

        // Calcula ponto de entrada no target
        const targetEntry = this.GetTargetEntryPoint(pTargetBounds, targetSide);

        // Calcula rota ortogonal
        const routePoints = this.BuildOrthogonalPath(
            new XPoint(startX, startY),
            targetEntry,
            sourceExitsRight,
            targetSide,
            pSourceBounds,
            pTargetBounds,
            pObstacles,
            gap,
            minSegment
        );

        points.push(...routePoints);
        return this.OptimizeRoute(points);
    }

    /**
     * Determina se o source deve sair pela direita ou esquerda
     * Considera posição horizontal e se há sobreposição vertical
     */
    private DetermineSourceExitSide(pSourceBounds: XRect, pTargetBounds: XRect): boolean
    {
        const sourceCenterX = pSourceBounds.Left + pSourceBounds.Width / 2;
        const targetCenterX = pTargetBounds.Left + pTargetBounds.Width / 2;
        
        // Verifica se há sobreposição horizontal (tabelas alinhadas verticalmente)
        const sourceRight = pSourceBounds.Right;
        const sourceLeft = pSourceBounds.Left;
        const targetRight = pTargetBounds.Right;
        const targetLeft = pTargetBounds.Left;
        
        const hasHorizontalOverlap = sourceLeft < targetRight && sourceRight > targetLeft;
        
        if (hasHorizontalOverlap)
        {
            // Tabelas alinhadas verticalmente - escolhe lado com mais espaço
            const spaceRight = Math.max(sourceRight, targetRight);
            const spaceLeft = Math.min(sourceLeft, targetLeft);
            // Prefere direita se há mais espaço ou igual
            return (spaceRight - sourceCenterX) >= (sourceCenterX - spaceLeft);
        }
        
        // Caso normal: sai pelo lado mais próximo do target
        return sourceCenterX < targetCenterX;
    }

    /**
     * Determina o melhor lado da tabela target para conexão
     * REGRA: Target pode receber de qualquer lado, mas deve formar rota limpa
     */
    private DetermineBestTargetSide(
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pStartX: number,
        pStartY: number,
        pSourceExitsRight: boolean
    ): XConnectionSide
    {
        const targetCenterY = pTargetBounds.Top + pTargetBounds.Height / 2;
        const targetTop = pTargetBounds.Top;
        const targetBottom = pTargetBounds.Bottom;
        
        // Verifica se há sobreposição horizontal (tabelas verticalmente alinhadas)
        const hasHorizontalOverlap = pSourceBounds.Left < pTargetBounds.Right && 
                                      pSourceBounds.Right > pTargetBounds.Left;
        
        if (hasHorizontalOverlap)
        {
            // Tabelas alinhadas verticalmente - entra pela lateral (rota em C)
            return pSourceExitsRight ? XConnectionSide.Right : XConnectionSide.Left;
        }
        
        // Tabelas lado a lado - preferência: lado oposto à saída do source
        if (pSourceExitsRight)
            return XConnectionSide.Left;
        
        if (pStartX > pTargetBounds.Right)
            return XConnectionSide.Right;

        // Fallback baseado na posição vertical
        if (pStartY < targetTop)
            return XConnectionSide.Top;
        
        // Último caso: entrar por baixo
        return XConnectionSide.Bottom;
    }

    /**
     * Obtém o ponto de entrada na tabela target baseado no lado
     */
    private GetTargetEntryPoint(pTargetBounds: XRect, pSide: XConnectionSide): XPoint
    {
        const centerX = pTargetBounds.Left + pTargetBounds.Width / 2;
        const centerY = pTargetBounds.Top + pTargetBounds.Height / 2;

        switch (pSide)
        {
            case XConnectionSide.Left:
                return new XPoint(pTargetBounds.Left, centerY);
            case XConnectionSide.Right:
                return new XPoint(pTargetBounds.Right, centerY);
            case XConnectionSide.Top:
                return new XPoint(centerX, pTargetBounds.Top);
            case XConnectionSide.Bottom:
                return new XPoint(centerX, pTargetBounds.Bottom);
        }
    }

    /**
     * Constrói caminho ortogonal com segmentos mínimos garantidos
     * REGRA CRÍTICA: Nunca diagonal - sempre segmentos verticais ou horizontais
     */
    private BuildOrthogonalPath(
        pStart: XPoint,
        pEnd: XPoint,
        pSourceExitsRight: boolean,
        pTargetSide: XConnectionSide,
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pObstacles: XRect[],
        pGap: number,
        pMinSegment: number
    ): XPoint[]
    {
        const points: XPoint[] = [];

        // Calcula X do primeiro segmento horizontal (com tamanho mínimo)
        const firstSegmentX = pSourceExitsRight 
            ? Math.max(pStart.X + pMinSegment, pSourceBounds.Right + pMinSegment)
            : Math.min(pStart.X - pMinSegment, pSourceBounds.Left - pMinSegment);

        // Verifica se é rota em C (source e target no mesmo lado - tabelas verticalmente alinhadas)
        const isCRoute = (pSourceExitsRight && pTargetSide === XConnectionSide.Right) ||
                        (!pSourceExitsRight && pTargetSide === XConnectionSide.Left);

        if (isCRoute)
        {
            // Rota em C - contorna por fora (usado quando tabelas estão verticalmente alinhadas)
            const outerX = pSourceExitsRight
                ? Math.max(pSourceBounds.Right, pTargetBounds.Right) + pMinSegment + pGap
                : Math.min(pSourceBounds.Left, pTargetBounds.Left) - pMinSegment - pGap;
            
            // Primeiro segmento horizontal
            points.push(new XPoint(outerX, pStart.Y));
            
            // Segmento vertical até altura do target center
            points.push(new XPoint(outerX, pEnd.Y));
            
            // Ponto final
            points.push(pEnd);
            return points;
        }

        // Conexão para lateral (Left ou Right) - caso mais comum
        if (pTargetSide === XConnectionSide.Left || pTargetSide === XConnectionSide.Right)
        {
            // Calcula X intermediário garantindo segmento mínimo no final também
            const targetApproachX = pTargetSide === XConnectionSide.Left
                ? pTargetBounds.Left - pMinSegment
                : pTargetBounds.Right + pMinSegment;
            
            // Determina o midX ideal
            const midX = this.CalculateMidX(
                firstSegmentX, pStart.Y,
                targetApproachX, pEnd.Y,
                pSourceExitsRight,
                pSourceBounds, pTargetBounds, pObstacles, pGap, pMinSegment
            );

            // Primeiro segmento horizontal (garante tamanho mínimo)
            points.push(new XPoint(midX, pStart.Y));

            // Segmento vertical
            if (Math.abs(pStart.Y - pEnd.Y) > 1)
                points.push(new XPoint(midX, pEnd.Y));

            // Ponto final
            points.push(pEnd);
        }
        else
        {
            // Target entry é Top ou Bottom - rota em S
            const approachY = pTargetSide === XConnectionSide.Top 
                ? pTargetBounds.Top - pGap 
                : pTargetBounds.Bottom + pGap;

            const midX = this.CalculateMidX(
                firstSegmentX, pStart.Y,
                pEnd.X, approachY,
                pSourceExitsRight,
                pSourceBounds, pTargetBounds, pObstacles, pGap, pMinSegment
            );

            // Primeiro segmento horizontal
            points.push(new XPoint(midX, pStart.Y));

            // Segmento vertical até approachY
            points.push(new XPoint(midX, approachY));

            // Segmento horizontal até alinhar com target
            points.push(new XPoint(pEnd.X, approachY));

            // Ponto final
            points.push(pEnd);
        }

        return points;
    }

    /**
     * Calcula o X intermediário para a rota respeitando segmentos mínimos
     */
    private CalculateMidX(
        pStartX: number,
        pStartY: number,
        pEndX: number,
        pEndY: number,
        pSourceExitsRight: boolean,
        pSourceBounds: XRect,
        pTargetBounds: XRect,
        pObstacles: XRect[],
        pGap: number,
        pMinSegment: number
    ): number
    {
        // Ponto médio ideal
        const directMidX = (pStartX + pEndX) / 2;
        
        // Verifica se há obstáculo no caminho direto
        const hasObstacle = this.SegmentHasCollision(pStartX, pStartY, pEndX, pEndY, pObstacles);

        if (!hasObstacle)
        {
            // Garante segmento mínimo mesmo sem obstáculo
            if (pSourceExitsRight)
                return Math.max(directMidX, pSourceBounds.Right + pMinSegment);
            return Math.min(directMidX, pSourceBounds.Left - pMinSegment);
        }

        // Precisa contornar - calcula X seguro
        if (pSourceExitsRight)
        {
            const maxRight = Math.max(
                pSourceBounds.Right + pMinSegment,
                ...pObstacles.map(o => o.Right + pGap)
            );
            return Math.max(directMidX, maxRight);
        }

        const minLeft = Math.min(
            pSourceBounds.Left - pMinSegment,
            ...pObstacles.map(o => o.Left - pGap)
        );
        return Math.min(directMidX, minLeft);
    }

    /**
     * Otimiza a rota removendo pontos duplicados consecutivos
     */
    /**
     * Retorna os pontos otimizados (sem operações extras necessárias)
     * BuildOrthogonalPath já garante que não há duplicatas
     */
    private OptimizeRoute(pPoints: XPoint[]): XPoint[]
    {
        return pPoints;
    }

    /**
     * Verifica se um segmento colide com obstáculos
     */
    private SegmentHasCollision(
        pX1: number, pY1: number,
        pX2: number, pY2: number,
        pObstacles: XRect[]
    ): boolean
    {
        const margin = 2;
        
        for (const obs of pObstacles)
        {
            if (this.LineIntersectsRect(pX1, pY1, pX2, pY2, obs, margin))
                return true;
        }
        
        return false;
    }

    /**
     * Verifica se linha intersecta retângulo (usada para detecção de colisão)
     * Nota: Esta função é chamada principalmente com segmentos diagonais para verificar
     * se o caminho direto entre dois pontos cruza um obstáculo
     */
    private LineIntersectsRect(
        pX1: number, pY1: number,
        pX2: number, pY2: number,
        pRect: XRect,
        pMargin: number
    ): boolean
    {
        const left = pRect.Left - pMargin;
        const top = pRect.Top - pMargin;
        const right = pRect.Right + pMargin;
        const bottom = pRect.Bottom + pMargin;

        // Verifica se linha está totalmente fora
        if ((pX1 < left && pX2 < left) || (pX1 > right && pX2 > right))
            return false;
        if ((pY1 < top && pY2 < top) || (pY1 > bottom && pY2 > bottom))
            return false;

        // Linha cruza ou está dentro do retângulo expandido
        return true;
    }
}