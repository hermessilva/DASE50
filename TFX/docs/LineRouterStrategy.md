# Estratégia Completa — Roteador de Linhas ORM (XRouter v2)

Data: 2026-07-02 — **IMPLEMENTADO** (etapas 1–6; etapa 7 opcional pendente)
Escopo: `TFX/src/Design/XRouter.ts`, `TFX/src/Design/XRouteContext.ts` (novo),
`TFX/src/Designers/ORM/XORMDesign.ts`, `DASE/src/Services/TFXBridge.ts` (simplify),
`DASE/media/OrmDesigner.js` (render).

## Resultado medido (2026-07-02)

| Cenário | Antes | Depois |
|---|---|---|
| SYSx real (20 tabelas / 40 refs) | — | 33ms, 0 travessias, 7 overlaps (stubs de mesmo campo FK), 126 bends |
| Adversarial 100 tabelas / 300 refs aleatórias | 30.4s, 132 travessias, 2767 overlaps, 2978 bends | 0.65s, **0 travessias**, 1451 overlaps*, 1843 bends |

\* cenário saturado além de qualquer modelo real (corredores comportam ~40 lanes para 300 rotas longas).
Testes: TFX 2036/2036, DASE 967/967.

Decisões de calibração descobertas na implementação (importante para futuros ajustes):
- **Penalidades sociais brandas** (Overlap=1/px, Cross=12): valores altos criam "muralhas" de custo que
  enterram a heurística e fazem o A* inundar a grade (30s no benchmark). Brandas espalham igual e rodam 40× mais rápido.
- **A* ponderado (ε=50%) + estimativa de curvas no h** com heading: sem isso a busca vira Dijkstra
  porque TurnPenalty/social não aparecem no h.
- **Closed-set estrito por (célula, direção)**: re-expansão por g melhor causava buscas quase exaustivas.
- **Janela de busca** (união src/tgt + 2×gap) com retry em grade completa: corta a grade de 350² para ~40².
- **Tabelas src/tgt são obstáculos próprios** (não infladas): sem isso a rota corta o corpo da própria tabela.

---

## 1. Diagnóstico do código atual

### 1.1 Arquitetura hoje

```
RouteAllLines()
 ├─ ComputeAnchorDistribution()   → escolhe lado + âncora por referência (só geometria centro-a-centro)
 ├─ RouteReference() por ref      → XRouter A* isolado, obstáculos reconstruídos a cada ref
 │    ├─ pass 1: CheckCrossRect=true, obstáculos inflados (clearance 20)
 │    ├─ pass 2 (fallback): CheckCrossRect=false, SEM obstáculos  ← atravessa tabelas
 │    └─ guard: linha reta 2 pontos
 └─ DeOverlapSegments()           → separa segmentos colineares em lanes (curativo)
```

### 1.2 Defeitos identificados (causa das linhas amontoadas)

| # | Defeito | Local | Efeito visual |
|---|---------|-------|---------------|
| D1 | Cada referência roteada **sem conhecimento das já roteadas** — nenhum custo por reutilizar o mesmo track ou cruzar linha existente | `RouteReference` / `XRouter.Route` | Todas as rotas ótimas convergem para o mesmo corredor → feixes amontoados |
| D2 | `DeOverlapSegments` é curativo: só separa segmentos **interiores exatamente colineares** (tol 1.5px); não valida colisão com tabelas após o shift; não trata stubs (1º/último segmento), que é onde amontoa nos hubs | `XORMDesign.ts:534` | Sobreposições residuais; shifts que empurram linha para dentro de tabela |
| D3 | Lado de entrada/saída decidido **apenas por centro-a-centro** (`PickEntrySide`), ignora congestão e obstáculos no caminho | `XORMDesign.ts:734` | Hubs (SYSxInquilino, SYSxEstadoRegistro) recebem tudo pelo mesmo lado; setas empilhadas |
| D4 | Fallback do pass 2 **remove obstáculos e permite atravessar tabelas**; guard final desenha reta diagonal | `XORMDesign.ts:880-902` | Linhas cortando tabelas em diagramas densos |
| D5 | Grade de tracks pobre: 5 tracks por rect + midpoints; **não existem lanes paralelas** entre tabelas | `XRouter.BuildTracks` | Não há espaço físico na grade para 2 linhas lado a lado — empate resolvido por sobreposição |
| D6 | `tracks.X/Y` **crescem dentro do loop** de direções sem reset; sort+Unique re-executado por combo src×tgt (até 16×) | `XRouter.Route:239-260` | Desperdício de CPU; grade inconsistente entre combos |
| D7 | `TurnPenalty=12` baixo vs `Gap=40` | `XRouter.ts:113` | Zig-zags valem a pena se pouparem 13px → rotas com curvas gratuitas |
| D8 | A* completo por combo de direções; `MaxNodes=20000` compartilhado por combo — estoura em diagrama grande → cai no fallback feio | `XRouter.Route` | Degradação abrupta de qualidade justamente nos diagramas maiores |
| D9 | Nenhuma minimização de cruzamentos global; ordenação por `srcKey` só evita cruzamento entre irmãos do mesmo lado do mesmo alvo | `ComputeAnchorDistribution` | Cruzamentos desnecessários em X no meio do diagrama |
| D10 | Nenhuma estabilidade entre re-rotas: AlignLines global recalcula tudo do zero, rotas "pulam" | `RouteAllLines` | Jitter; usuário perde referência visual |

### 1.3 Diagnóstico da imagem (SYSx)

- **Corredor central vertical**: ~6 linhas descem coladas até `SYSxInquilino`; sem lane pitch, ilegível (D1+D5).
- **Hub `SYSxInquilino`**: ~10 setas entram por oeste/norte no mesmo trecho de borda; distribuição `t=(i+1)/(n+1)` espreme tudo na altura útil (D3).
- **`SYSxEstadoRegistro`** (2 instâncias, laranja): FKs de status chegam de todo o diagrama com desvios longos e cruzamentos evitáveis (D9).
- **Desvios não-óbvios**: p.ex. `SYSxUsuario → SYSxInquilino` contorna por baixo em vez do corredor direto — rota "ótima" já ocupada não é penalizada, mas obstáculos inflados + tracks pobres forçam volta (D5).
- **Cantos gratuitos** em rotas curtas (`SYSxPagamento → SYSxEstadoPagamento`) (D7).
- **Cruzamentos em leque** saindo de `SYSxFatura`/`SYSxAssinatura` — ordem de chegada não casa com ordem de partida entre grupos distintos (D9).

---

## 2. Requisitos expandidos (v2)

### Funcionais

- **RF1 — Ortogonalidade estrita**: toda rota é sequência de segmentos H/V; diagonais proibidas inclusive no fallback.
- **RF2 — Zero travessia**: nenhum segmento intersecta o interior de tabela (clearance mínimo 12px), em TODOS os passes, incluindo fallback (fallback = rota em L/Z ao redor do bounding box da união).
- **RF3 — Lane pitch**: linhas paralelas no mesmo corredor separadas por ≥ 8px, ordem estável (sem trocas que gerem cruzamento extra no nudge).
- **RF4 — Stubs incluídos**: separação vale também para 1º/último segmento (leque de entrada nos hubs), respeitando a âncora no field-row.
- **RF5 — Saída no field-row**: FK sai horizontal (E/W) na altura do campo — regra atual mantida; exceção: se ambos os lados E/W bloqueados por obstáculo adjacente, permitir N/S com dobra imediata.
- **RF6 — Minimização de cruzamentos**: ordenar âncoras por barycenter da outra extremidade (ângulo real da rota, não só Y de partida); meta ≤ 1 cruzamento por rota em média no SYSx.
- **RF7 — Rota óbvia**: comprimento ≤ 1.3× distância Manhattan entre âncoras; curvas ≤ 4 por rota (p95).
- **RF8 — Estabilidade**: re-rota de uma referência prefere tracks a ≤ Gap da rota anterior (custo de desvio); mover 1 tabela nunca altera rotas de referências não conectadas (regra já vigente — preservar).
- **RF9 — Cruzamentos legíveis**: cruzamentos remanescentes renderizados com "jump" (semicírculo r=4) na linha que cruza por cima (frontend `BuildPathFromPoints`).

### Não-funcionais

- **RN1 — Performance**: full reroute de 100 tabelas / 300 referências < 50ms; SYSx (28 tabelas / ~40 refs) < 10ms. Sem travar extension host (já houve incidente — heap binário existente).
- **RN2 — Determinismo**: mesma entrada → mesma saída (ordenar refs por ID antes de rotear).
- **RN3 — Degradação suave**: estourar budget de nós reduz qualidade (menos combos, grade mais grossa), nunca atravessa tabela.
- **RN4 — Métricas expostas**: `XRouterResult` reporta { crossings, overlaps, bends, totalLength, steps } para testes e telemetria.

### Métricas de aceitação (gate de teste sobre SYSx.dsorm)

| Métrica | Hoje (estimado) | Meta v2 |
|---|---|---|
| Sobreposições colineares | > 10 | **0** |
| Travessias de tabela | ocasional (fallback) | **0** |
| Cruzamentos totais | alto | −50% |
| Curvas por rota (p95) | 6+ | ≤ 4 |
| Comprimento / Manhattan (p95) | ~1.8× | ≤ 1.3× |
| Full reroute SYSx | ~? | < 10ms |

---

## 3. Solução — pipeline em 5 fases

### Fase A — Contexto global de roteamento (fundação)

Novo `XRouteContext` construído **uma vez** por `RouteAllLines`:

- Grade de tracks global: tracks por rect (bordas ± gap, centro) **+ K lanes intermediárias** em cada corredor livre entre rects vizinhos (K = ceil(larguraCorredor / lanePitch), cap 5) + halo externo.
- Obstáculos inflados uma vez; segment-tree/bucket espacial por track para consulta O(log n).
- **Occupancy map**: por track, lista de intervalos ocupados por rotas já traçadas nesta passada `{lo, hi, refId}`.

Corrige D5, D6 (grade construída 1×, sort 1×) e habilita D1.

### Fase B — Planejamento de terminais (âncoras cientes de congestão)

1. Para cada ref, calcular candidatos de lado com custo = distância Manhattan + penalidade de obstáculo direto no raio + **penalidade de congestão** (nº de refs já atribuídas àquele lado ÷ capacidade = altura útil / lanePitch).
2. Distribuir âncoras no lado escolhido ordenando por **barycenter da extremidade oposta** (posição projetada da outra âncora), não por Y de origem — elimina cruzamentos em leque (D9, RF6).
3. Se um lado excede capacidade, transbordar para o segundo melhor lado (hubs deixam de espremer tudo num lado — D3).

### Fase C — Busca com custos sociais (A* cooperativo)

`XRouter.Route` passa a receber o contexto e soma ao custo do passo:

- comprimento Manhattan (atual)
- `TurnPenalty` ↑ para `Gap` (40) — mata zig-zag (D7)
- **`OverlapPenalty`** (alto, ~200/px sobreposto): passo colinear sobre intervalo já ocupado no occupancy map
- **`CrossPenalty`** (médio, ~30): passo que cruza perpendicular um intervalo ocupado
- `ProximityPenalty` (leve): track encostado em borda de tabela
- **Bônus de estabilidade** (RF8): custo −ε em tracks a ≤ Gap da rota anterior da mesma ref

Ordem de roteamento: refs mais longas primeiro (mais difíceis reservam corredores), determinística por ID em empate. Passo opcional **rip-up & reroute**: reroteia as 10% piores rotas (por custo social) numa 2ª passada.

Corrige D1, D7, D9, D10.

### Fase D — Nudging ortogonal final (substitui DeOverlapSegments)

Algoritmo clássico de nudging (estilo libavoid):

1. Agrupar segmentos por track (H e V separados), **incluindo stubs** (RF4) — só a âncora exata no field-row fica fixa; o stub pode abrir em leque logo após sair.
2. Dentro de cada grupo com sobreposição, resolver a ordem das lanes por conectividade das extremidades (ordem que minimiza cruzamentos entre vizinhos — ordenação topológica por comparador de rota).
3. Espaçar por lanePitch (8–12px) **limitado ao corredor livre** (consulta ao índice espacial); se não couber, reduzir pitch até 4px; nunca invadir clearance de tabela (corrige D2).
4. Deslocar endpoints deslizando sobre os segmentos perpendiculares vizinhos (mantém ortogonalidade — mecânica atual preservada).

### Fase E — Fallback seguro + render

- Pass 2 atual (sem obstáculos) **eliminado**. Nova cadeia: (1) A* grade fina → (2) A* grade grossa (só tracks de bordas) → (3) rota em L/Z ao redor do bounding box união com clearance — sempre ortogonal, nunca atravessa (RF2, RN3).
- Frontend: `BuildPathFromPoints` ganha suporte a jump-over (RF9): backend envia índices de cruzamento por segmento; render desenha arco. (Opcional, última prioridade.)
- `simplifyRoutePoints` no TFXBridge permanece só como saneamento (não re-simplificar o que o nudge separou — atenção: tolerância de colinearidade 2px NÃO pode fundir lanes de 8px — ok).

---

## 4. Performance (RN1)

- Grade global 1× por reroute; A* por ref reaproveita `xs/ys` e índice espacial (D6).
- Com âncora definida: 1 combo (src, tgt) por ref — hoje já; sem âncora: máx 2 combos.
- Budget adaptativo: `MaxNodes = min(20000, 40 × |xs| + 40 × |ys|)`; estouro → grade grossa (RN3).
- Occupancy map com intervalos ordenados por track → consulta de sobreposição O(log k).
- Cache por ref: hash(srcBounds, tgtBounds, versão de obstáculos) → skip se inalterado (drag de tabela não conectada zero-cost, coerente com regra "no global re-route").
- Benchmark vitest: gerar 100 tabelas/300 refs sintéticas + SYSx real; asserts de tempo e métricas RN4.

## 5. Plano de implementação (ordem)

| Etapa | Entrega | Risco |
|---|---|---|
| 1 | `XRouteContext` + grade global + occupancy map (Fase A) | baixo |
| 2 | Custos sociais no A* + TurnPenalty=40 + ordem por comprimento (Fase C) | médio |
| 3 | Nudging completo substituindo `DeOverlapSegments` (Fase D) | médio |
| 4 | Terminais cientes de congestão + barycenter (Fase B) | médio |
| 5 | Fallback seguro sem travessia (Fase E) | baixo |
| 6 | Métricas RN4 + suite de testes/benchmark | baixo |
| 7 | Rip-up & reroute + estabilidade RF8 + jump-over RF9 | opcional |

Cada etapa isolada e testável; etapas 1–3 já eliminam o amontoado visível na imagem.

## 6. Testes

- **Property tests** (vitest): para todo diagrama gerado — nenhum segmento intersecta interior de tabela; todos os segmentos H/V; pares de segmentos colineares no mesmo track distam ≥ lanePitch−ε; pontos finitos.
- **Snapshot de métricas** no SYSx.dsorm: crossings/bends/length registrados; regressão falha se piorar > 10%.
- **Benchmark**: 100×300 < 50ms (CI com margem 3×).
- Testes existentes (`XDesign.test.ts`, `XORMDesignCoverage.test.ts`) atualizados — DeOverlapSegments removido.
