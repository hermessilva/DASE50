# DASE — MCP Integration (Estudo / Design)

> **Status:** Estudo de arquitetura. Define como expor o DASE via **Model Context Protocol (MCP)**
> para que **qualquer** AI externa (Cursor, Cline, Claude Desktop, ou qualquer client MCP genérico)
> possa manipular objetos e ferramentas do ORM Designer dentro do VS Code.

---

## 1. Contexto

O DASE já tem integração AI, porém **acoplada ao GitHub Copilot / VS Code**:

```
LM Tools (13) + Chat @dase  →  XAgentBridge (singleton)  →  XTFXBridge (por-doc)  →  XORMDesignerEditorProvider
   DASETools.ts                  AgentBridge.ts               TFXBridge.ts              Map<uri, State+Bridge>
```

- `XAgentBridge.GetInstance()` — adapter único, já formata resultados LLM-friendly.
- 13 tools registradas via `vscode.lm.registerTool` (só Copilot Agent Mode enxerga).
- `XTFXBridge` expõe **mais** API ainda não publicada às AIs: `DeleteElement`, `RenameElement`,
  `ReorderField`, `AddShadowTable`, `GetSeedData`/`SaveSeedData`, `ApplyOperation`.
- Não há infra de servidor/IPC. `XClaudeCli/` já spawna o processo `claude` (padrão child-process existe).

**Limitação:** o estado vivo (designers abertos, `Map<uri,State>`) só existe dentro do extension host.

## 2. Objetivo

Permitir que uma AI **externa**, em outro processo, leia e modifique o modelo ORM do designer ativo,
falando MCP — protocolo aberto, suportado por múltiplos clients.

## 3. Decisões adotadas

| Tema | Decisão |
|------|---------|
| Hospedagem | **MCP server embarcado no extension host** — reusa `XAgentBridge` direto, sem IPC |
| Clients alvo | **Genérico** (conformidade total com a spec) + foco prático em **Cursor / Cline** |
| Transporte | **Streamable HTTP** em loopback (`127.0.0.1`) |
| Reuso | Tools MCP = wrappers finos sobre `XAgentBridge` (mesma camada das LM Tools) |

### Por que embarcado (e não standalone/headless)

O requisito é manipular objetos **dentro do DACE vivo** (canvas, designer aberto). Só o extension host
tem esse estado. Embarcar dá acesso direto, zero IPC, e reusa 100% do `XAgentBridge`.
Headless-sobre-arquivo perde o canvas; standalone+IPC adiciona processo e protocolo sem ganho aqui.

### Por que Streamable HTTP (e não stdio)

O extension já é processo longo-vivo. HTTP loopback deixa **múltiplos** clients MCP conectarem sem
spawnar um processo por client. stdio forçaria um processo dedicado por conexão.

## 4. Arquitetura

```
AI externa (Cursor / Cline / qualquer MCP client)
        │  Streamable HTTP  →  http://127.0.0.1:<port>/mcp   (Bearer token)
        ▼
  XDaseMcpServer  (NOVO)  ── hospedado no extension host
        │  registra tools = wrappers finos
        ▼
  XAgentBridge.GetInstance()        ← REUSA tudo que já existe
        ▼
  XTFXBridge (designer ativo / por documentUri)
```

Novo diretório: `src/AgentIntegration/Mcp/`

| Arquivo | Responsabilidade |
|---------|------------------|
| `XDaseMcpServer.ts` | Cria `McpServer` + `StreamableHTTPServerTransport`, escuta porta loopback, lifecycle (start/stop/dispose) |
| `XDaseMcpTools.ts` | Registra as tools MCP (read + write), cada uma chamando `XAgentBridge` |
| `index.ts` | `RegisterDaseMcpServer(context)`, chamado por `RegisterAgentIntegration` (guard por config) |

Ligação em `AgentIntegration/index.ts` → ativa só se `dase.mcp.enabled === true`.

## 5. Superfície de tools (IMPLEMENTADA — 40 tools)

Toda a funcionalidade do DASE exposta. Cada tool é wrapper fino sobre `XAgentBridge`.

> **Endereçamento de documento:** todas as tools de modelo (read+write, exceto `dase_cmd_*`) aceitam
> um parâmetro opcional `document` (nome do arquivo, path relativo ou URI). Sem ele → designer ativo.
> Com ele → mira aquele modelo; **se não estiver aberto, abre automaticamente**. `dase_open_document`
> abre/revela explicitamente; `dase_list_documents` enumera os abertos. Implementado via wrapper
> `MakeRegDoc` (preflight `XAgentBridge.SetTargetDocument` → `provider.OpenDocument`) + alvo
> `_TargetUri` que reroteia `GetActiveBridge`/`RefreshActive` para o doc-alvo.

**Leitura (13):** `dase_open_document`, `dase_get_model`, `dase_list_tables`, `dase_get_table`, `dase_get_properties`,
`dase_get_datatypes`, `dase_validate`, `dase_export_dbml`, `dase_list_documents`,
`dase_get_element_info`, `dase_get_seed`, `dase_get_shadow_options`,
`dase_get_organization_context`

**Escrita (20):** `dase_add_table`, `dase_rename_table`, `dase_delete_table`, `dase_move_table`,
`dase_set_color`, `dase_add_field`, `dase_rename_field`, `dase_delete_field`, `dase_reorder_field`,
`dase_add_reference`, `dase_delete_reference`, `dase_update_property`, `dase_delete_element`,
`dase_rename_element`, `dase_align_lines`, `dase_save_seed`, `dase_add_shadow_table`,
`dase_save_document`, `dase_apply_organization`, `dase_revert_organization`

> **Organização MCP-nativa:** `dase_get_organization_context` (JSON) + `dase_apply_organization`
> + `dase_revert_organization` deixam a AI EXTERNA buscar dados, calcular o layout e aplicar via
> MCP — sem usar o LM interno do VS Code (`dase_cmd_organize_tables_ai`).

> **Identidade de elementos (shadow tables):** tabelas shadow podem ter nome duplicado. Tools que
> miram elementos aceitam `tableId`/`fieldId`/`referenceId` (preferencial, único) além de nome;
> `isShadow` desambigua nome duplicado de tabela. Nome ambíguo → erro listando candidatos com IDs.
> IDs aparecem em `dase_list_tables`, `dase_get_table`, `dase_get_organization_context`,
> `dase_get_element_info`. Resolvers: `XAgentBridge.ResolveTable/ResolveField/ResolveReference`.

**Command triggers (7)** — invocam comandos VS Code (`executeCommand`), p/ fluxos UI/AI:
`dase_cmd_organize_tables_ai`, `dase_cmd_create_sql_script`, `dase_cmd_generate_orm_code`,
`dase_cmd_import_dbml`, `dase_cmd_reload_datatypes`, `dase_cmd_new_designer`,
`dase_cmd_open_designer`

> Tools destrutivas (`delete_*`, `save_seed`) carregam annotation `destructiveHint`; posicionais
> (`move_table`, `set_color`, `align_lines`, `save_document`) carregam `idempotentHint`; command
> triggers carregam `openWorldHint`. Clients MCP usam isso p/ avisar o usuário antes de invocar.

**Arquivos:** read tools em `XDaseMcpTools.ts`; write + command tools em `XDaseMcpWriteTools.ts`.
Mutações passam por `XAgentBridge.RefreshActive()` → atualiza o canvas (postMessage `LoadModel`),
marca dirty e salva.

## 6. Pontos de design

### Endereçamento multi-documento
Hoje `XAgentBridge` usa só `GetActiveState()` (designer focado). Vindo de processo externo, "ativo" é
ambíguo. Adicionar:
- tool `dase_list_documents` — lista os `.dsorm` abertos (uri + nome);
- param opcional `documentUri` nas tools → roteia ao bridge correto; sem ele, mira o último-ativo.

### Designer fechado
Sem `.dsorm` aberto, as tools retornam "no designer". Client externo não controla o foco do VS Code →
avaliar tool `open_document(path)`.

### Confirmação de operações destrutivas
As LM Tools usam `confirmationMessages`. MCP não tem confirm equivalente embutido. Estratégia:
- `delete_element` / `update_property` gated por config `dase.mcp.autoApprove` (allowlist), **ou**
- usar **elicitation** (spec MCP) para pedir OK ao client quando suportado.

### Segurança do transporte
- bind exclusivo em `127.0.0.1`;
- **Bearer token** aleatório por sessão (gravado no Output channel / settings local);
- validar header `Origin` (defesa anti-DNS-rebind — recomendação da spec MCP).

### Concorrência
AI externa + usuário editando simultaneamente. `SuspendRouting`/refresh do webview já existem;
validar race conditions ao aplicar mutações fora do fluxo do usuário.

## 7. Configuração (proposta `package.json` contributes)

```jsonc
"dase.mcp.enabled":     { "type": "boolean", "default": false },
"dase.mcp.port":        { "type": "number",  "default": 39100 },
"dase.mcp.autoApprove": { "type": "array",   "default": [],
                          "description": "Tools de escrita aprovadas sem confirmação" }
```

Exemplo de config no client (ex. Cline / genérico):

```jsonc
{
  "mcpServers": {
    "dase": {
      "url": "http://127.0.0.1:39100/mcp",
      "headers": { "Authorization": "Bearer <token-da-sessao>" }
    }
  }
}
```

## 8. Plano de implementação

1. **F1 — Esqueleto:** dep `@modelcontextprotocol/sdk`; `XDaseMcpServer` (HTTP loopback) + 1 tool read
   (`get_model`); config `enabled`/`port`; smoke test via **MCP Inspector**.
2. **F2 — Paridade:** portar os 13 tools (wrappers → `XAgentBridge`); endereçamento multi-doc.
3. **F3 — Segurança:** Bearer token, checagem de `Origin`, confirm/allowlist para destrutivas.
4. **F4 — Extras:** `delete`/`rename`/`reorder`/`seed`/`shadow`.
5. **F5 — Testes & docs:** Jest com `XAgentBridge` mockado; guia de setup p/ Cursor/Cline; finalizar este doc.

## 9. Riscos / questões abertas

- **Descoberta de porta:** client precisa saber a porta → porta fixa configurável + escrever em arquivo conhecido.
- **Designer fechado** no momento da chamada (ver §6).
- **Reentrância** AI×usuário (ver §6).
- **Versão da spec MCP / SDK** a fixar na F1.

---

*DASE — Design-Aided Software Engineering*
*Estudo MCP — 2026-06-30*
