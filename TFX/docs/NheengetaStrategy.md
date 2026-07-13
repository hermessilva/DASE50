# Nheengetá — Notebooks Poliglotas no DASE

Estratégia para incorporar no DASE as funcionalidades da extensão
**Polyglot Notebooks** (`ms-dotnettools.dotnet-interactive-vscode`), como um novo
tipo de documento chamado **Nheengetá**, ao lado do ORM/MER.

> **Convenção de nome:** o produto se chama **Nheengetá** (com acento) em
> textos, UI e marketing. Em **código, identificadores, pastas, pacotes,
> comandos e configurações** usa-se **`Nheengeta`/`nheengeta`** (sem acento).

## About the name

> **Nheengetá** — "many tongues", in Old Tupi.
>
> Before Portuguese ever existed in Brazil, there was already the *nheenga*:
> speech, the word, the tongue. The ancients said *Nheengatu* — "the good
> tongue" — to name the language that bound different peoples into a single
> understanding.
>
> **Nheengetá** is born of the same spirit, turned inside out: instead of one
> good tongue, many tongues at once, all running together under the same roof.
> C#, F#, T-SQL, KQL, PowerShell, JavaScript, Python, R, HTML, Mermaid — and
> the developer's own thinking out loud while experimenting — everything
> speaking, everything being heard, everything answering on the spot.
>
> "The kind of polyglot *Nheengetá* has in mind is not someone who memorized words
> in several languages. It is someone who can stand between them — translating, testing,
> playing with an idea until it becomes certainty. That is the place
> **Nheengetá** occupies in your editor: the interval between thinking and
> confirming.

Esta nota deve constar no README da extensão standalone e na seção Nheengetá do
README do DASE.

---

## 1. Decisões de arquitetura (fechadas)

| Decisão | Escolha |
|---|---|
| Motor de execução | **Reusar o kernel `dotnet-interactive`** (open source, MIT). O Nheengetá registra seu próprio `NotebookController` via API de Notebooks do VS Code e conversa com o kernel por stdio/JSON-RPC. Nada de reimplementar kernels. |
| Integração na UI | No **editor de propriedades (HubView)** do DASE, acima das abas atuais (`Properties` / `Explorer`), entra uma **barra de botões de tipo de documento**: `ORM/MER` e `Nheengetá`. Cada botão alterna o contexto do hub (ações de novo/abrir e filtro do explorer). |
| Empacotamento | **Produto duplo**: o Nheengetá vive na pasta `Nheengeta/` na raiz do repositório, é escrito como núcleo independente do DASE, e é entregue de duas formas — (a) **extensão VS Code standalone** publicada no Marketplace (VSIX próprio), e (b) **biblioteca incorporada ao DASE**. Ver §4-A. |
| Formato de arquivo | Extensão **própria `.nhg`** (evita conflito com a extensão da Microsoft sobre `.dib`); `.dib` e `.ipynb` como **import/export**. Ver §3. |
| .NET SDK mínimo | **.NET 8** como mínimo suportado; testado também contra o SDK mais recente (.NET 10). |
| Licença | **MIT** (igual ao DASE), nos dois modos. |
| `nheengeta.handleIpynb` | **Desligado por default** na v1 (evita conflito com Jupyter/Polyglot). |
| Ordem de início | **F2 primeiro** (núcleo em `Nheengeta/`), depois F1 (chrome do HubView). |
| Entrega | Documento de estratégia primeiro; implementação em fases. |

### Por que reusar o kernel

- O `dotnet-interactive` já implementa: execução de C#, F#, PowerShell,
  JavaScript, SQL, KQL, HTML e Mermaid; subkernels Jupyter para Python/R;
  compartilhamento de variáveis (`#!set`); magic commands; diagnósticos e
  completions por célula.
- O protocolo stdio é público e estável: envelopes JSON de `KernelCommand`
  (ex.: `SubmitCode`, `RequestCompletions`, `RequestHoverText`,
  `RequestSignatureHelp`, `RequestValueInfos`, `RequestValue`) e `KernelEvent`
  (ex.: `ReturnValueProduced`, `StandardOutputValueProduced`,
  `DisplayedValueProduced`, `DiagnosticsProduced`, `CommandSucceeded`,
  `CommandFailed`).
- Licença MIT permite uso e redistribuição do protocolo/ferramenta.

### Dependência externa

- Requer **.NET SDK** instalado (mínimo .NET 8; a extensão da Microsoft hoje
  pede .NET 10 — o kernel funciona com menos).
- O kernel é instalado como **dotnet global tool**
  (`dotnet tool install -g Microsoft.dotnet-interactive`) — **não** embutimos
  binários no VSIX. O Nheengetá detecta e oferece instalação guiada.

---

## 2. Mapa de funcionalidades (paridade com Polyglot Notebooks)

| # | Funcionalidade Polyglot | Como o Nheengetá entrega |
|---|---|---|
| 1 | Execução em 8 linguagens (C#, F#, PowerShell, JS, SQL, KQL, HTML, Mermaid) | `SubmitCode` no kernel; linguagem por célula resolvida pelo magic (`#!csharp`, `#!fsharp`, `#!pwsh`, `#!javascript`, `#!sql`, `#!kql`, `#!html`, `#!mermaid`) |
| 2 | Python e R | Subkernels Jupyter via `#!connect jupyter` (local ou remoto) |
| 3 | Compartilhamento de variáveis | Magic `#!set` já implementado no kernel; Nheengetá só repassa |
| 4 | Variables View | `RequestValueInfos` + `RequestValue` por subkernel; renderizado em painel próprio |
| 5 | Completions, hover, signature help, diagnósticos | Comandos do kernel mapeados para providers do VS Code registrados no notebook type |
| 6 | Conexão SQL Server | `#!connect mssql` — sinergia direta com o LocalDB dos modelos `.dsorm` |
| 7 | Conexão Kusto | `#!connect kusto` |
| 8 | Requisições HTTP | Kernel HTTP do dotnet-interactive |
| 9 | Mermaid / visualizações | Renderer de outputs rich MIME (`text/html`, `image/*`, `application/json`) + renderer Mermaid |
| 10 | Interop `.ipynb` | Import/export no serializer (formato nativo é `.nhg`) |
| 11 | Diff de notebooks | Herdado do diff nativo de notebooks do VS Code (vem de graça ao usar a Notebook API) |
| 12 | Outline | Herdado das células markdown (nativo da Notebook API) |
| 13 | Layout customizável | Configurações nativas de notebook do VS Code |
| 14 | Pacotes NuGet (`#r "nuget:..."`) e `#!import` | Nativos do kernel — vêm de graça |
| 15 | Magics utilitários (`#!time`, `#!lsmagic`, `#!about`, `#!input`) | Nativos do kernel — vêm de graça |

### Extra exclusivo do DASE (fase final)

| Funcionalidade | Descrição |
|---|---|
| Subkernel `#!dase` | Células que consultam/alteram o modelo `.dsorm` aberto via `XAgentBridge` (mesma engine do MCP/Copilot). Notebook vira documentação executável do design: célula Mermaid gerada do modelo, célula SQL rodando contra o LocalDB gerado, célula C# sobre o código gerado |

---

## 3. Formato de arquivo

- **Nativo: `.nhg`** — mesmo layout textual do `.dib` (células separadas por
  linhas de magic `#!csharp`, `#!markdown`…), diff-friendly, igual à filosofia
  do `.dsorm`. Extensão própria evita disputa de seletor com a extensão da
  Microsoft.
- **Import/Export `.dib`**: conversão trivial (formato compatível) — comandos
  `Nheengeta.ImportDib` / `Nheengeta.ExportDib`.
- **Import/Export `.ipynb`**: intercâmbio com Jupyter — `Nheengeta.ImportIpynb`
  / `Nheengeta.ExportIpynb`. Abertura direta de `.ipynb` só quando
  `nheengeta.handleIpynb` estiver ligado (default: desligado).
- O explorer do HubView, no modo Nheengetá, lista `**/*.nhg` (e `.dib`/`.ipynb`
  quando habilitado).

---

## 4. Componentes novos

O Nheengetá mora em **`Nheengeta/`** (raiz do repositório), irmão de `DASE/` e
`TFX/`, seguindo o mesmo padrão do TFX (empacotado como `.tgz` e consumido pelo
DASE via dependência npm).

```
Nheengeta/
  package.json                 // pacote @tootega/nheengeta + manifesto de extensão standalone
  src/
    Core/                      // núcleo SEM nenhuma dependência do DASE
      NheengetaSerializer.ts   // .nhg (+ import/export .dib/.ipynb) <-> NotebookData
      NheengetaController.ts   // NotebookController; roteia execução p/ o kernel
      KernelProcess.ts         // spawn/lifecycle de `dotnet interactive stdio`
      KernelProtocol.ts        // tipos de KernelCommand/KernelEvent + correlação por token
      KernelInstaller.ts       // detecção do SDK/tool + fluxo de instalação guiada
      LanguageServices.ts      // completions/hover/signature/diagnostics por célula
      VariablesView.ts         // painel de variáveis (RequestValueInfos/RequestValue)
      SubkernelRegistry.ts     // ponto de extensão p/ subkernels do host (ex.: #!dase)
    NheengetaApi.ts            // API pública: activateNheengeta(context, options), tipos
    ExtensionMain.ts           // entry point do modo standalone (chama activateNheengeta)

DASE/src/Nheengeta/
  DaseNheengetaHost.ts         // incorporação: chama activateNheengeta com opções DASE
  DaseSubkernel.ts             // (fase final) ponte #!dase -> XAgentBridge
```

Contribuições no `package.json` (nos dois manifestos — ver §4-A):

- `notebooks`: tipo `nheengeta` (seletor `*.nhg`; `.dib`/`.ipynb` opcionais).
- `notebookRenderer`: renderer Mermaid + fallback HTML rich.
- Comandos: `Nheengeta.New`, `Nheengeta.Open`, `Nheengeta.RestartKernel`,
  `Nheengeta.Variables`, `Nheengeta.InstallKernel`, `Nheengeta.ImportDib`,
  `Nheengeta.ExportDib`, `Nheengeta.ImportIpynb`, `Nheengeta.ExportIpynb`.
- Configurações: `nheengeta.dotnetPath`, `nheengeta.kernelArgs`,
  `nheengeta.handleIpynb` (default `false`).

---

## 4-A. Produto duplo: standalone + incorporado

### Princípios

1. **Núcleo agnóstico**: `Nheengeta/src/Core` depende só da API do VS Code e do
   Node. Proibido importar qualquer coisa de `DASE/` ou `TFX/`.
2. **Uma única API de ativação**: `activateNheengeta(context, options)` faz todo
   o registro (serializer, controller, comandos, renderers). `options` permite
   ao host injetar: subkernels extras (`SubkernelRegistry`), namespace de
   configuração e branding.
3. **IDs neutros**: tipo de notebook, comandos e configurações usam namespace
   `nheengeta.*` / `Nheengeta.*` nos dois modos — evita duplicação de
   contribuições e mantém keybindings/documentação válidos em ambos.

### Modo standalone (Marketplace)

- `Nheengeta/package.json` é manifesto completo de extensão
  (`name: "nheengeta"`, `displayName: "Nheengetá Notebooks"`,
  `publisher: "HermesSilva"`, licença MIT), com `contributes` próprio.
- `ExtensionMain.ts` só chama `activateNheengeta(context, {})`.
- Build/empacote com `vsce package` dentro de `Nheengeta/` — **VSIX
  independente**, publicado no Marketplace.

### Modo incorporado (DASE)

- Nheengetá empacotado como **`tootega-nheengeta-x.y.z.tgz`** (mesmo fluxo do
  `tootega-tfx`), dependência npm do DASE.
- As contribuições estáticas (`notebooks`, `notebookRenderer`, comandos,
  configurações) são **copiadas para o `package.json` do DASE** por script de
  build (`scripts/sync-nheengeta-contributions`), fonte única no manifesto do
  Nheengetá.
- `DaseNheengetaHost.ts` chama
  `activateNheengeta(context, { subkernels: [DaseSubkernel] })` na ativação do DASE.
- HubView ganha a barra `ORM/MER | Nheengetá` (§5) — isso é código do DASE, não
  do núcleo.

### Coexistência

Se a extensão standalone **e** o DASE estiverem instalados juntos, os dois
tentariam registrar o mesmo tipo de notebook. Regra: na ativação, o DASE checa
`vscode.extensions.getExtension("HermesSilva.nheengeta")`; se presente e ativa,
**delega** (não registra o núcleo, só o subkernel `#!dase` via API exportada
pela standalone) e loga aviso. A standalone é sempre a dona quando presente.

### Versionamento

- Nheengetá versiona independente (semver próprio, CHANGELOG próprio).
- DASE fixa versão exata do `.tgz`, como já faz com o TFX.

---

## 5. Mudança no HubView (PropertiesViewProvider)

Hoje o chrome é: `toolbar (Config)` → `tabs (Properties | Explorer)`.

Passa a ser:

```
┌─────────────────────────────────────────┐
│ [ORM/MER] [Nheengetá]       ⚙ Config    │  <- barra de tipo de documento (nova)
├─────────────────────────────────────────┤
│ Properties | Explorer                   │  <- abas existentes
├─────────────────────────────────────────┤
│ (painel ativo)                          │
└─────────────────────────────────────────┘
```

- A barra é injetada no `ChromeTopHtml()` — mesma técnica atual (injeção nos
  DOIS templates HTML).
- Estado `documentType` (`orm` | `nheengeta`) guardado no webview e persistido
  em `workspaceState`.
- Efeitos da seleção:
  - **Explorer**: filtro `*.dsorm` (ORM/MER) vs `*.nhg` (Nheengetá); título e
    ação de "novo" mudam de acordo.
  - **Properties**: no modo Nheengetá, sem seleção de elemento gráfico — mostra
    estado do kernel (rodando/parado, versão, botão restart) e, futuramente,
    propriedades da célula selecionada.

---

## 6. Fases de implementação (nesta ordem)

> Início decidido: **F2 primeiro**, F1 depois (chrome fica melhor com algo real
> para abrir).

### F2 — Notebook mínimo executável (em `Nheengeta/`)
Scaffold do pacote `Nheengeta/` (manifesto duplo, build, `activateNheengeta`).
`NheengetaSerializer` (`.nhg` somente), `NheengetaController`, `KernelProcess` +
`KernelProtocol`, `KernelInstaller` (detecção `dotnet tool list -g` + instalação
guiada). Executar célula C# e mostrar stdout/return value. Comandos
`Nheengeta.New` / `Nheengeta.Open`. Testável já como extensão standalone
(F5/debug dentro de `Nheengeta/`).

### F2.5 — Incorporação no DASE
`.tgz` + `sync-nheengeta-contributions` + `DaseNheengetaHost`. DASE abre e
executa o mesmo notebook. Regra de coexistência com a standalone (§4-A).

### F1 — Chrome do HubView
Barra de botões `ORM/MER | Nheengetá` acima das abas; alternância de contexto do
explorer; persistência da escolha.

### F3 — Multi-linguagem e variáveis compartilhadas
Magics de linguagem por célula (as 8 linguagens), `#!set`, `#!import`, seletor
de kernel por célula. Restart/interrupt do kernel.

### F4 — Language services nas células
Completions, hover, signature help e diagnósticos via comandos do kernel.

### F5 — Variables View
Painel de variáveis por subkernel com refresh após cada execução.

### F6 — Outputs ricos
Renderer Mermaid, HTML, imagens, JSON tabular (grids para resultados SQL/KQL).

### F7 — Conexões
`#!connect mssql` (com atalho para o LocalDB do modelo ativo), `#!connect kusto`,
`#!connect jupyter` (Python/R), kernel HTTP.

### F8 — Interop e polimento
Import/export `.dib` e `.ipynb` completos (ida e volta), diff, outline, layout.
Publicação da extensão standalone no Marketplace (README, ícone, CI de release).

### F9 — Subkernel `#!dase`
Ponte para `XAgentBridge`: notebook lê/escreve o modelo ORM; templates de
notebook gerados a partir do `.dsorm` (ex.: "notebook de exploração do schema").

### F10 — Diferenciais funcionais grandes
Parâmetros de notebook + execução headless, export HTML/Markdown, ferramentas
MCP (ver §7).

### F11 — Depuração de células (breakpoints)
Breakpoints em célula exigem um **debug adapter (DAP)** ligado ao kernel. O
`dotnet-interactive` não expõe DAP hoje; caminho provável: subkernels Jupyter
via `debugpy` (Python) primeiro, e/ou attach do debugger .NET ao processo do
kernel para células C#. Investigação própria — sem paridade com Polyglot aqui
(Polyglot também não tem breakpoints em notebook).

---

## 7. Além da paridade — diferenciais do Nheengetá

Requisito: mais elegante que o Polyglot, funcional e com mais recursos.

### Elegância (UX) — entra distribuída em F5–F6

| Diferencial | Descrição |
|---|---|
| Grid de resultados interativo | Resultados SQL/KQL/tabulares em grid com sort, filtro, paginação e export CSV/JSON — Polyglot mostra tabela HTML estática |
| Gráficos com um clique | Botão "Chart" no grid: barras/linhas/pizza direto do resultado, sem escrever código de plot |
| Variables View rica | Inspeção profunda (drill-down em objetos/coleções), busca, edição de valores primitivos, badge de kernel de origem |
| Instalação one-click | Detecção de SDK/tool com botão único "Instalar e reiniciar kernel", barra de progresso — Polyglot só mostra erro e link |
| Status de kernel elegante | Indicador vivo na status bar + painel do HubView (uptime, memória, linguagens ativas, restart/interrupt) |
| Templates de notebook | "Novo Nheengetá" oferece galeria: vazio, exploração SQL, tutorial C#, relatório de schema |

### Recursos a mais (funcional) — F9/F10

| Diferencial | Descrição |
|---|---|
| Subkernel `#!dase` | Ler/alterar o modelo ORM aberto de dentro do notebook (exclusivo) |
| Conexão automática ao modelo | `#!connect mssql` pré-preenchido com o LocalDB do `.dsorm` ativo — zero connection string manual |
| Relatório executável de schema | Template que gera, a partir do `.dsorm`: diagrama Mermaid, dicionário de dados, queries de amostra — documentação viva |
| Export de notebook | HTML self-contained e Markdown (com outputs) para publicar relatórios |
| Parâmetros de notebook | Células marcadas como parâmetro + execução headless (`Nheengeta.RunNotebook` com args) — estilo papermill, permite CI e automação |
| MCP para notebooks | Ferramentas MCP (`nheengeta_run_cell`, `nheengeta_list_variables`, `nheengeta_add_cell`) no servidor MCP do DASE — agentes externos dirigem o notebook |
| Segredos fora do arquivo | Connection strings/tokens via `SecretStorage` do VS Code referenciados por nome (`@secret:prod-db`) — nunca em texto no `.nhg` |

---

## 8. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| .NET SDK ausente na máquina | `KernelInstaller` com detecção precoce e mensagem acionável; Nheengetá degrada graciosamente (abre/edita, não executa) |
| Mudança no protocolo stdio entre versões do tool | Fixar versão mínima testada do `Microsoft.dotnet-interactive`; testar em CI contra ela |
| Conflito com a extensão Polyglot instalada | Formato nativo `.nhg` elimina disputa de seletor; `.dib`/`.ipynb` só via import/export ou opt-in (`nheengeta.handleIpynb`) |
| Standalone + DASE instalados juntos | Regra de coexistência (§4-A): standalone é dona do tipo de notebook; DASE delega e só acrescenta `#!dase` |
| Deriva entre manifestos (standalone vs DASE) | Fonte única no `Nheengeta/package.json`; script `sync-nheengeta-contributions` copia contribuições no build do DASE |
| Kernel zumbi/orfão | `KernelProcess` com kill no dispose do documento e watchdog de inatividade |
| Tamanho do escopo | Fases pequenas e independentes; F2 + F2.5 já entregam valor demonstrável nos dois modos |
