# DASE — AI Integration Guide

> **Documentação dos comandos de integração com AI (GitHub Copilot) da extensão DASE.**

A extensão DASE oferece integração profunda com o GitHub Copilot e outros Language Models do VS Code, permitindo que você use linguagem natural para consultar, modificar e organizar seus modelos ORM.

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Chat Participant (@dase)](#chat-participant-dase)
3. [Language Model Tools (Agent Mode)](#language-model-tools-agent-mode)
4. [AI Organization (Organização Automática)](#ai-organization-organização-automática)
5. [Exemplos Práticos](#exemplos-práticos)

---

## Visão Geral

A integração AI do DASE funciona em três níveis:

| Modo | Descrição | Ativação |
|------|-----------|----------|
| **Chat Participant** | Assistente de chat `@dase` para perguntas e comandos | Digite `@dase` no Copilot Chat |
| **Agent Mode Tools** | Ferramentas que o Copilot pode invocar automaticamente | Copilot Agent Mode (automático) |
| **AI Organization** | Organização visual de tabelas por domínio funcional | Comando `Dase.OrganizeTablesAI` |

### Requisitos

- VS Code 1.93+
- GitHub Copilot instalado e ativo
- Um arquivo `.dsorm` aberto no ORM Designer

---

## Chat Participant (@dase)

O chat participant `@dase` é um assistente especializado em design ORM que você pode invocar diretamente no Copilot Chat.

### Slash Commands

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `/model` | Mostra visão geral do modelo ORM atual | `@dase /model` |
| `/table [nome]` | Lista todas as tabelas ou detalha uma específica | `@dase /table Customer` |
| `/validate` | Executa validação do modelo e mostra erros/warnings | `@dase /validate` |
| `/export` | Exporta o modelo para formato DBML | `@dase /export` |
| `/types` | Mostra tipos de dados disponíveis | `@dase /types` |
| `/help` | Exibe ajuda com todos os comandos | `@dase /help` |

### Exemplos de Uso

```
@dase /model
```
Retorna:
```
## ORM Model: MyDatabase
- **Schema:** dbo
- **Tables:** 5
- **References (FK):** 3

### Tables
- **Customer** — 6 fields
- **Order** — 8 fields
- **Product** — 5 fields
```

---

```
@dase /table Order
```
Retorna detalhes completos da tabela incluindo campos, tipos, PKs, FKs e referências.

---

```
@dase /validate
```
Retorna:
```
### Validation Results
- **Errors:** 1
- **Warnings:** 2

#### Errors
- ❌ **Order**: Field "CustomerID" references non-existent table

#### Warnings
- ⚠️ **Product**: Table has no description
```

---

### Perguntas em Linguagem Natural

Além dos slash commands, você pode fazer perguntas livremente:

```
@dase Como devo modelar um relacionamento many-to-many entre Product e Category?
```

```
@dase Quais são as boas práticas para nomear foreign keys?
```

```
@dase Me ajude a entender a estrutura da tabela Customer
```

---

## Language Model Tools (Agent Mode)

Quando o Copilot está em **Agent Mode**, ele pode invocar automaticamente as ferramentas DASE para realizar operações no modelo ORM.

### Ferramentas Disponíveis

#### Ferramentas de Leitura

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `dase_get_model` | Obtém informações gerais do modelo | — |
| `dase_list_tables` | Lista tabelas (com filtro opcional) | `filter?: string` |
| `dase_get_table` | Detalhes de uma tabela específica | `tableName: string` |
| `dase_get_properties` | Propriedades de um elemento | `elementId: string` |
| `dase_validate` | Executa validação do modelo | — |
| `dase_export_dbml` | Exporta para DBML | — |

#### Ferramentas de Modificação

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `dase_add_table` | Adiciona nova tabela | `name: string`, `x?: number`, `y?: number` |
| `dase_add_field` | Adiciona campo a uma tabela | `tableName: string`, `fieldName: string`, `dataType: string` |
| `dase_add_reference` | Cria FK entre tabelas | `sourceTable: string`, `targetTable: string`, `name?: string` |
| `dase_update_property` | Atualiza propriedade | `elementId: string`, `propertyKey: string`, `value: any` |
| `dase_move_table` | Move tabela no canvas | `tableName: string`, `x: number`, `y: number` |
| `dase_set_color` | Define cor de uma tabela | `tableName: string`, `color: string` |
| `dase_organize_layout` | Organiza layout via AI | — |

### Exemplos de Prompts para Agent Mode

```
Crie uma tabela Customer com campos Name (String), Email (String) e BirthDate (DateTime)
```

O Copilot automaticamente invocará:
1. `dase_add_table` para criar a tabela
2. `dase_add_field` (3×) para adicionar os campos

---

```
Mova a tabela Order para a posição (500, 200) e mude sua cor para azul
```

Invoca:
1. `dase_move_table` com `x=500, y=200`
2. `dase_set_color` com `color=#4A90D9`

---

```
Crie uma FK da tabela Order para Customer
```

Invoca `dase_add_reference` com:
- `sourceTable: "Order"`
- `targetTable: "Customer"`

---

```
Liste todas as tabelas que começam com "Sys"
```

Invoca `dase_list_tables` com `filter: "Sys"`

---

### Confirmação de Operações

Operações que modificam o modelo (add, update, move) exibem uma confirmação antes de executar:

```
┌─────────────────────────────────────┐
│ Add Table                           │
├─────────────────────────────────────┤
│ Add a new table named **Customer**  │
│ to the ORM model?                   │
│                                     │
│        [Cancel]  [Continue]         │
└─────────────────────────────────────┘
```

---

## AI Organization (Organização Automática)

O comando `Dase.OrganizeTablesAI` usa inteligência artificial para:

1. **Analisar** nomes de tabelas e relacionamentos FK
2. **Agrupar** tabelas por domínio funcional (ex: Security, Sales, Inventory)
3. **Posicionar** grupos em clusters visuais no canvas
4. **Colorir** cada grupo com uma cor distinta

### Como Usar

1. Abra um arquivo `.dsorm` no ORM Designer
2. Execute o comando `DASE: Organize Tables with AI` (Ctrl+Shift+P)
3. Selecione o modelo de linguagem preferido na lista
4. Aguarde o processamento
5. Visualize o resultado — use **Revert** se não gostar

### Fluxo Visual

```
┌────────────────────────────────────────────────┐
│  ✨ AI Table Organization                       │
├────────────────────────────────────────────────┤
│                                                │
│  Select AI Model:                              │
│  ┌──────────────────────────────────────────┐  │
│  │ ○ Claude 3.5 Sonnet (Copilot) — 1x       │  │
│  │ ● GPT-4o (Copilot) — 0x                  │  │
│  │ ○ Claude Opus 4 — 3x                      │  │
│  │ ○ Gemini 2.5 Flash — 0.33x               │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  Tables to organize: 12                        │
│                                                │
│  Prompt Preview:                               │
│  ┌──────────────────────────────────────────┐  │
│  │ You are an expert database architect...  │  │
│  │ Tables (12):                             │  │
│  │   • Customer (6 fields)                  │  │
│  │   • Order (8 fields)                     │  │
│  │   ...                                    │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│           [Cancel]  [Execute]                  │
└────────────────────────────────────────────────┘
```

### Paleta de Cores dos Grupos

| Domínio | Cor |
|---------|-----|
| Grupo 1 | 🔵 #4A90D9 (Blue) |
| Grupo 2 | 🟢 #50C878 (Emerald) |
| Grupo 3 | 🟡 #E8A838 (Amber) |
| Grupo 4 | 🔴 #D85C8A (Rose) |
| Grupo 5 | 🟣 #7B68EE (Purple) |
| Grupo 6 | 🩵 #20B2AA (Teal) |
| Grupo 7 | 🟠 #FF7F50 (Coral) |
| Grupo 8 | 🟢 #9ACD32 (Lime) |
| Outros | ⚪ #AAAAAA (Gray) |

### Revert (Desfazer)

Se o resultado não for satisfatório:

1. Clique no botão **Revert** no overlay
2. Ou execute `Dase.OrganizeTablesAIRevert`

O modelo volta ao estado anterior imediatamente.

---

## Exemplos Práticos

### Cenário 1: Criar um Modelo Completo

```
@dase Crie um modelo para um e-commerce com as seguintes tabelas:
- Customer (ID, Name, Email, Phone, Address)
- Product (ID, Name, Description, Price, Stock)
- Category (ID, Name, ParentCategoryID)
- Order (ID, CustomerID, OrderDate, TotalAmount, Status)
- OrderItem (ID, OrderID, ProductID, Quantity, UnitPrice)

Adicione as FKs apropriadas entre as tabelas.
```

### Cenário 2: Analisar Modelo Existente

```
@dase /model

Agora me diga: quais tabelas estão "órfãs" (sem nenhuma FK entrando ou saindo)?
```

### Cenário 3: Refatorar Organização Visual

```
Organize todas as tabelas do modelo atual usando AI, agrupando por domínio funcional.
Coloque as tabelas de segurança (User, Role, Permission) juntas em azul.
```

### Cenário 4: Exportar para Documentação

```
@dase /export

Agora converta esse DBML para uma documentação Markdown com descrição de cada tabela.
```

### Cenário 5: Validação e Correção

```
@dase /validate

Para cada erro encontrado, me sugira como corrigir.
```

---

## Referência Rápida

### Chat Commands

| Input | Resultado |
|-------|-----------|
| `@dase /model` | Visão geral do modelo |
| `@dase /table` | Lista todas as tabelas |
| `@dase /table Customer` | Detalhes da tabela Customer |
| `@dase /validate` | Executa validação |
| `@dase /export` | Exporta para DBML |
| `@dase /types` | Lista tipos de dados |
| `@dase /help` | Ajuda |

### Agent Mode Examples

| Prompt | Tool Invocado |
|--------|---------------|
| "Liste as tabelas" | `dase_list_tables` |
| "Crie tabela X" | `dase_add_table` |
| "Adicione campo Y na tabela X" | `dase_add_field` |
| "Crie FK de A para B" | `dase_add_reference` |
| "Valide o modelo" | `dase_validate` |
| "Exporte para DBML" | `dase_export_dbml` |
| "Mova tabela X para (100, 200)" | `dase_move_table` |
| "Mude a cor de X para vermelho" | `dase_set_color` |
| "Organize as tabelas" | `dase_organize_layout` |

### VS Code Commands

| Command ID | Descrição |
|------------|-----------|
| `Dase.OrganizeTablesAI` | Abre picker de AI e organiza tabelas |
| `Dase.OrganizeTablesAIExecute` | Executa organização com modelo selecionado |
| `Dase.OrganizeTablesAIRevert` | Desfaz última organização AI |

---

## Troubleshooting

### "No ORM designer is currently open"

Certifique-se de ter um arquivo `.dsorm` aberto no ORM Designer antes de usar os comandos.

### "No AI language model available"

Instale o GitHub Copilot ou outra extensão que forneça Language Model API.

### AI retorna formato não reconhecido

Tente novamente com outro modelo (GPT-4o costuma ter melhor aderência ao formato JSON).

### Organização não ficou boa

Use o botão **Revert** e tente novamente, ou ajuste manualmente após a organização inicial.

---

*DASE — Design-Aided Software Engineering*  
*Versão: 2026-03-02*
