---

## TFX — Core Framework

[![CI](https://github.com/Tootega/DASE50/actions/workflows/ci.yml/badge.svg)](https://github.com/HermesSilva/DASE50/actions/workflows/ci.yml)
![Tests](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/tfx-tests.json)
![Lines](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/tfx-lines.json)
![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/tfx-coverage.json)

![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020-blue.svg)
![Vitest](https://img.shields.io/badge/tested%20with-vitest-663399?logo=vitest)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript&logoColor=white)
![AI Written](https://img.shields.io/badge/written%20by-AI-blueviolet)

## DASE — VS Code Extension

[![CI](https://github.com/Tootega/DASE50/actions/workflows/ci.yml/badge.svg)](https://github.com/HermesSilva/DASE50/actions/workflows/ci.yml)
![Tests](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/dase-tests.json)
![Lines](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/dase-lines.json)
![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/HermesSilva/4a8de64c5760e89b94863a7f0d9ecc46/raw/dase-coverage.json)

![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020-blue.svg)
![Jest](https://img.shields.io/badge/tested%20with-jest-C21325?logo=jest)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript&logoColor=white)
![AI Written](https://img.shields.io/badge/written%20by-AI-blueviolet)

---

# DASE50 — Design-Aided Software Engineering

## 🧪 Um Experimento em Desenvolvimento de Software Orientado a IA

**Este projeto é um experimento deliberado** em escrever um projeto de software de médio porte **inteiramente através de prompts de IA**, sem qualquer codificação humana direta. Cada linha de código, teste, configuração e documentação foi gerada por IA (GitHub Copilot) com base em prompts cuidadosamente elaborados e instruções arquiteturais.

O objetivo é explorar:
- **Viabilidade:** A IA consegue escrever código de qualidade de produção a partir de descrições de alto nível?
- **Qualidade:** O código gerado por IA atende a padrões profissionais de segurança, performance e manutenibilidade?
- **Cobertura:** A IA consegue atingir 100% de cobertura de testes mantendo elegância no código?
- **Iteração:** Com que eficiência a IA pode refatorar, depurar e expandir bases de código existentes?

> *"O melhor código é aquele que se escreve sozinho — guiado por intenção clara."*

---

## 📋 Índice

- [Visão Geral do Projeto](#-visão-geral-do-projeto)
- [Princípios Filosóficos](#-princípios-filosóficos)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [DASE — Extensão VS Code](#-dase--extensão-vs-code)
- [TFX — Tootega Framework X](#-tfx--tootega-framework-x)
  - [Módulo Core](#-módulo-core)
  - [Módulo Data — Motor de Serialização XML](#-módulo-data--motor-de-serialização-xml)
  - [Módulo Design — Primitivos Visuais](#-módulo-design--primitivos-visuais)
  - [Módulo Designers — ORM Designer](#-módulo-designers--orm-designer)
- [Padrões de Qualidade de Código](#-padrões-de-qualidade-de-código)
- [Guia de Desenvolvimento](#-guia-de-desenvolvimento)
- [Pipeline CI/CD](#-pipeline-cicd)

---

## 🎯 Visão Geral do Projeto

**DASE** (Design-Aided Software Engineering) é um ambiente de design visual para modelagem e geração de aplicações web multi-camadas, multi-plataforma, multi-banco de dados e multi-paradigma.

O projeto consiste em dois componentes principais:

| Componente | Descrição | Status |
|-----------|-------------|--------|
| **[TFX/](TFX/)** | Framework core fornecendo a fundação para extensões VS Code | ✅ Completo |
| **[DASE/](DASE/)** | Extensão VS Code implementando os designers visuais | 🚧 Em Desenvolvimento |

### Tecnologias Core

- **TypeScript 5.3+** com convenções inspiradas no .NET
- **Node.js 20+** runtime
- **Vitest** para testes unitários com cobertura (TFX)
- **Jest** para testes unitários com cobertura (DASE)
- **GitHub Actions** para automação CI/CD

---

## 🧭 Princípios Filosóficos

Esses princípios são a fundação por trás de cada diretriz neste documento.  
Eles existem para manter as decisões consistentes quando surgem compromissos.

1. O melhor código é aquele que se escreve sozinho — guiado por intenção clara.
2. Qualquer linha de código que não possa ser exercida por testes automáticos não deveria existir.
3. Verdade acima de aparência: recusamos "teatro de métricas" (inflação de cobertura, ramos artificiais, testes cosméticos).
4. Cobertura é evidência, não um objetivo: o objetivo é confiança no comportamento sob condições realistas.
5. Se um ramo é verdadeiramente inalcançável, a ação correta é removê-lo ou criar um invariante explícito — não um teste fabricado.
6. Código inalcançável é um cheiro de design: ou o modelo está errado, ou o ramo está morto, ou o contrato não está claro.
7. Prefira deleção à decoração: remover caminhos mortos é de maior qualidade do que "cobri-los".
8. Testes devem representar mundos plausíveis: um teste que não pode ocorrer em produção é documentação de ficção.
9. Cada teste deve responder a uma pergunta: "Que falha isso detectaria, e por que importaria?"
10. Asserções são contratos: valide invariantes onde pertencem, e teste através de comportamento público.
11. Contratos fortes reduzem ruído defensivo: menos "por precaução", mais "não pode acontecer por construção".
12. Escreva código fácil de provar: clareza supera esperteza; determinismo supera surpresas.
13. Prefira verdade de domínio sobre conveniência de framework: o modelo dita o código, não o contrário.
14. Código é um passivo: cada linha adicionada DEVE pagar aluguel (valor claro, comportamento verificado).
15. Torne o estado explícito; estado implícito vira bugs ocultos.
16. Otimize para o próximo leitor: o futuro mantenedor geralmente é você.
17. Complexidade deve ser conquistada por benefício mensurável; mecanismos simples escalam melhor.
18. Falhe rápido, falhe em voz alta: rejeite entrada inválida cedo com erros precisos e acionáveis.
19. Meça antes de otimizar; otimize apenas o que o profiling prova ser quente.
20. Segurança é um invariante, não uma funcionalidade.
21. Integridade é inegociável: não negociamos verdade por aparência, mesmo quando "parece melhor" no papel.
22. Um pipeline verde não é um certificado: é um sinal que deve permanecer honesto para manter significado.
23. Assim como 10 segundos de silêncio encerram uma vida de $3 \times 10^9$ batimentos, erros sequenciais são a ruína do software: continuidade é vida, estatísticas são uma ilusão.

---

## 📁 Estrutura do Repositório

```
DASE50/
├── .github/
│   ├── copilot-instructions.md    # Padrões de codificação para IA
│   └── workflows/
│       └── ci.yml                 # Pipeline CI/CD
├── TFX/                           # Framework Core
│   ├── src/
│   │   ├── Config/                # Configurações e tipos do framework
│   │   ├── Core/                  # Classes fundamentais
│   │   ├── Data/                  # Motor de serialização XML
│   │   ├── Design/                # Elementos de design visual
│   │   └── Designers/             # Designers específicos de domínio
│   │       └── ORM/               # Designer ORM completo
│   └── tests/                     # Testes unitários (Vitest)
├── DASE/                          # Extensão VS Code
│   ├── src/
│   │   ├── Commands/              # Comandos da extensão
│   │   ├── Designers/ORM/         # Provider do designer ORM
│   │   │   └── Commands/          # Comandos específicos do ORM
│   │   ├── Models/                # Modelos de dados da UI
│   │   ├── Services/              # Serviços (Log, Bridge, Seleção, Issues)
│   │   └── Views/                 # Painéis laterais (Propriedades, Issues)
│   ├── media/                     # Assets do webview
│   └── src/__tests__/             # Testes unitários (Jest)
├── Engine Model.dsorm             # Modelo ORM de exemplo
└── README.md                      # Este arquivo
```

---

# 🖥️ DASE — Extensão VS Code

**DASE** (Design-Aided Software Engineering) é uma extensão VS Code que oferece designers visuais para modelagem de software. O foco inicial é um **ORM Designer** para modelagem de esquemas de banco de dados.

## Visão

DASE visa ser um ambiente de design visual abrangente suportando:
- 📊 **ORM Designer** — Modelagem de esquema de banco de dados (fase atual)
- 📐 **UI Designer** — Layouts de interface de usuário (planejado)
- 🔄 **Flow Designer** — Workflows de processos de negócio (planejado)
- 📡 **API Designer** — Modelagem de endpoints REST/GraphQL (planejado)

## Fase Atual: ORM Designer

### Funcionalidades

| Funcionalidade | Descrição | Status |
|---------|-------------|--------|
| Custom Editor | Abre arquivos `.dsorm` no designer visual | ✅ Implementado |
| Tabelas | Representação visual de tabelas com colunas | ✅ Implementado |
| Relações | Linhas de relacionamento visuais entre tabelas | ✅ Implementado |
| Painel de Propriedades | Edita propriedades do elemento selecionado | ✅ Implementado |
| Painel de Issues | Erros e avisos de validação | ✅ Implementado |
| Menus de Contexto | Todas as ações via menus de clique direito | ✅ Implementado |
| Integração TFX | Bridge para o framework TFX para gerenciamento do modelo | ✅ Implementado |
| Adicionar Campos | Adição de campos diretamente pelo VS Code | ✅ Implementado |
| Alinhamento de Linhas | Alinhamento automático de conexões visuais | ✅ Implementado |
| Recarregar Tipos | Recarga dinâmica de tipos de dados configurados | ✅ Implementado |
| Serviço de Log | Log estruturado de eventos da extensão | ✅ Implementado |

### Arquitetura da Extensão

```
DASE/src/
├── ExtensionMain.ts                      # Ponto de entrada — ativa todos os providers e comandos
├── Commands/
│   ├── DeleteSelectedCommand.ts          # Exclui elementos selecionados
│   ├── ReloadDataTypesCommand.ts         # Recarrega tipos de dados ORM
│   └── RenameSelectedCommand.ts          # Renomeia elemento selecionado
├── Designers/ORM/
│   ├── ORMDesignerEditorProvider.ts      # Provider de editor cuFstom VS Code
│   ├── ORMDesignerMessages.ts            # Protocolo de mensagens tipadas (webview ↔ extensão)
│   ├── ORMDesignerState.ts               # Gerenciamento de estado em memória
│   └── Commands/
│       ├── AddTableCommand.ts            # Adicionar tabela ao modelo
│       ├── AddFieldCommand.ts            # Adicionar campo a uma tabela
│       ├── AlignLinesCommand.ts          # Realinhar conexões visuais
│       ├── NewORMDesignerCommand.ts      # Criar novo arquivo .dsorm
│       ├── OpenORMDesignerCommand.ts     # Abrir arquivo .dsorm no designer
│       └── ValidateORMModelCommand.ts    # Validar modelo e popular Issues
├── Models/
│   ├── DesignerSelection.ts              # Estruturas de dados de seleção
│   ├── IssueItem.ts                      # Representação de um problema de validação
│   └── PropertyItem.ts                   # Representação de uma propriedade editável
├── Services/
│   ├── IssueService.ts                   # Gerenciamento de problemas de validação
│   ├── LogService.ts                     # Serviço de log estruturado
│   ├── SelectionService.ts               # Estado de seleção
│   └── TFXBridge.ts                      # Integração com o framework TFX
└── Views/
    ├── IssuesViewProvider.ts             # Painel de problemas
    └── PropertiesViewProvider.ts         # Painel de propriedades
```

### Protocolo de Mensagens

O designer usa um protocolo de mensagens tipado para comunicação webview ↔ extensão:

| Tipo de Mensagem | Direção | Propósito |
|--------------|-----------|---------| 
| `DesignerReady` | Webview → Extensão | Webview inicializado e pronto |
| `LoadModel` | Extensão → Webview | Envia dados do modelo para renderização |
| `ModelLoaded` | Webview → Extensão | Confirma que o modelo foi carregado |
| `SaveModel` | Webview → Extensão | Solicita persistência do modelo |
| `SelectElement` | Webview → Extensão | Usuário selecionou um elemento |
| `SelectionChanged` | Extensão → Webview | Estado de seleção atualizado |
| `UpdateProperty` | Extensão → Webview | Valor de propriedade alterado |
| `PropertiesChanged` | Webview → Extensão | Propriedades precisam ser atualizadas |
| `ValidateModel` | Ambos | Inicia validação do modelo |
| `IssuesChanged` | Extensão → Webview | Resultados de validação atualizados |

### Comandos e Menus de Contexto

**Canvas do Designer:**
- `Dase.AddTable` — Adicionar nova tabela ao modelo
- `Dase.AddField` — Adicionar campo a uma tabela selecionada
- `Dase.AddRelation` — Adicionar relacionamento entre tabelas
- `Dase.AlignLines` — Realinhar conexões visuais automaticamente
- `Dase.DeleteSelected` — Excluir elementos selecionados
- `Dase.RenameSelected` — Renomear elemento selecionado

**Explorer (arquivos `.dsorm`):**
- `Dase.NewORMDesigner` — Criar novo arquivo de modelo ORM
- `Dase.OpenORMDesigner` — Abrir arquivo no designer visual
- `Dase.ValidateORMModel` — Validar modelo e popular painel de Issues

**Global:**
- `Dase.ReloadDataTypes` — Recarregar tipos de dados do arquivo de configuração

---

# 📦 TFX — Tootega Framework X

**TFX** é a biblioteca core que impulsiona a extensão DASE. Ela fornece uma fundação robusta e type-safe para construir extensões VS Code com designers visuais complexos. Organizada em quatro módulos principais, cada um com responsabilidade clara e testabilidade máxima.

---

## 🔹 Módulo Core

O módulo Core é o **coração pulsante** do TFX — a fundação de tudo que existe acima dele. Ele não depende de nenhum outro módulo e oferece os blocos construtivos essenciais que tornam o framework expressivo, seguro e poderoso.

### `XElement` — A Espinha Dorsal Hierárquica

> *"Cada coisa no universo é feita de algo menor."*

`XElement` é a classe base abstrata de todos os elementos do framework. Não é apenas uma estrutura de dados — é um **modelo de árvore vivo**, com suporte completo a navegação pai-filho, travessias em profundidade, consultas tipadas e manipulação segura de hierarquia.

**Capacidades notáveis:**
- Navegação bidirecional: `ParentNode` e `ChildNodes`
- Consultas generics type-safe: `GetChild<T>()`, `GetChildren<T>()`, `GetChildDeep<T>()`, `GetChildrenDeep<T>()`
- Ancestrais: `GetOwner<T>()`, `HasOwner<T>()`
- Manipulação: `AppendChild()`, `InsertChildAt()`, `RemoveChild()`, `RemoveFromParent()`
- Travessia da árvore completa via `GetTree()` — percorre de volta à raiz
- Identidade: `ID`, `Name`, `ClassName`, `DisplayText`, `Folder`
- Capacidades: `CanDuplicate`, `IsInheritable`, `IsCacheable`
- Operações de clipboard: `Copy()`, `Cut()`, `Paste()`

```typescript
// Exemplo: atravessando uma hierarquia
const allFields = design.GetChildrenDeep<XORMField>(
    child => child instanceof XORMField
);
```

---

### `XPersistableElement` — Elemento com Superpoderes

> *"Persistência não é apenas salvar dados — é manter a integridade do estado."*

`XPersistableElement` estende `XElement` adicionando um conjunto completo de capacidades para elementos que precisam ser gerenciados, selecionados, rastreados e persistidos. É a classe pai de todos os elementos do designer que importam.

**O que torna este elemento especial:**

- **Sistema de propriedades reativo** via `GetValue()`/`SetValue()` com rastreamento de mudanças automático
- **Seleção**: `IsSelected`, `IsLocked`, `IsVisible`, `CanDelete`
- **Rastreamento de mudanças**: cada alteração de propriedade alimenta o `XChangeTracker` para undo/redo
- **Eventos**: `OnPropertyChanged` — evento type-safe disparado a cada mudança
- **Referências vinculadas**: `GetLinkedElement<T>()`, `SetLinkedElement<T>()` para FK e referências entre elementos
- **Referências de array**: `GetLinkedElements<T>()`, `SetLinkedElements<T>()` para coleções de links
- **Validação integrada**: `Validate()`, `AddValidationError()`, `AddValidationWarning()`, `ValidateRequired()`
- **Clone**: `Clone<T>()` — clonagem tipada com novo ID
- **Ciclo de vida**: `InitializeNew()`, `Initialize()`, `Delete()`
- **Serialização**: `GetModelValues()`, `SetModelValue()`, `GetSerializableProperties()`
- **Localização**: suporte a cultura/idioma via `GetValue(prop, culture)`

```typescript
// Exemplo: criando e rastreando mudança
const table = new XORMTable();
table.InitializeNew(); // Atribui novo GUID
table.Name = "Customers"; // Dispara OnPropertyChanged + rastreia mudança
```

---

### `XSelectionManager` — Gerenciador de Seleção

Gerencia o estado de seleção de múltiplos elementos de forma eficiente e sem duplicatas. Mantém a lista de `XSelectable` selecionados, atualizando automaticamente o flag `IsSelected` de cada elemento.

---

### `XProperty` — Sistema Reativo de Propriedades

> *"Propriedades não são apenas campos — são contratos com metadados, validação e roteamento."*

Inspirado no sistema de propriedades de dependência do WPF/XAML, `XProperty` é o mecanismo central que conecta elementos a valores com total controle e observabilidade.

**Como funciona:**
```typescript
// Registro de propriedade com metadados completos
public static readonly NameProp = XProperty.Register<XORMTable, string>(
    (p: XORMTable) => p.Name,
    "8F3E9777-A802-...",    // GUID único da propriedade
    "Name",                  // Nome técnico
    "Table Name",            // Label de exibição
    ""                       // Valor padrão
);

// Acesso via GetValue/SetValue
public get Name(): string {
    return this.GetValue(XORMTable.NameProp) as string;
}
public set Name(pValue: string) {
    this.SetValue(XORMTable.NameProp, pValue);
}
```

- Cada propriedade tem um GUID único — garantia absoluta de não-colisão
- Metadados ricos via `XPropertyMetadata`: visibilidade, tipo, grupo, persistência, sensibilidade cultural
- Acesso por chave: `GetValueByKey()`, `SetValueByKey()`
- Strings convertidas: `GetValueString()`, `SetValueString()`
- Verificação de estado default: `CheckValueDefault()`, `HasValue()`
- Registry global singleton para lookup por ID ou chave

---

### `XChangeTracker` — Rastreamento de Mudanças (Undo/Redo)

`XChangeTracker` captura automaticamente as mudanças de propriedade para suporte de desfazer/refazer. Cada chamada de `SetValue()` em `XPersistableElement` alimenta o tracker com o valor anterior e novo, viabilizando histórico de edição sem esforço manual.

---

### `XEvent<T>` — Eventos Type-Safe

Um sistema de eventos genérico e type-safe. `XEvent<T>` aceita handlers tipados via `Add()` e os despacha via `Raise()`. Sem casting, sem surpresas.

```typescript
// Assinando o evento com type-safety completo
table.OnPropertyChanged.Add((sender, property, value) => {
    if (property.Name === "Bounds")
        this.RouteAllLines();
});
```

---

### `XValidation` — Framework de Validação

Sistema de validação declarativo com severidade, vinculação à propriedade e acumulação de erros via `XConcurrentBag<XDataValidateError>`. Suporta `Error` e `Warning`, mensagens específicas de propriedade e erros de campo obrigatório.

---

### `XGeometry` — Primitivos Espaciais Completos

Uma biblioteca completa de tipos geométricos 2D imutáveis com serialização/deserialização embutida:

| Tipo | Descrição |
|------|-----------|
| `XPoint` | Ponto 2D (X, Y) com move, parse, equals |
| `XSize` | Dimensão (Width, Height) com shrink |
| `XRect` | Retângulo com `X/Y` alias para `Left/Top`, inflate, shrink, fromPercent, fromPoints |
| `XThickness` | Margens/bordas (Left, Top, Right, Bottom) — uniforme ou individual |
| `XColor` | Cor ARGB com parse hex, inverse via HSL, hash code |
| `XHSLColor` | Cor no espaço HSL com conversão RGB bidirecional |
| `XBorderColor` | Cor de borda com 4 laterais independentes |
| `XFont` | Fonte tipográfica (família, tamanho, cor, alinhamento, estilo) |
| `XAlignment` | Enum de alinhamento 2D com flags combinados |
| `XTextAlignment` | 9 posições de alinhamento de texto (3×3) |
| `XFontStyle` | Normal, Bold, Italic, BoldItalic |

---

### `XMath` — Matemática 2D de Alto Nível

`XMath` é uma biblioteca matemática de 2D abrangente — 847 linhas de pura utilidade geométrica, portada e aprimorada a partir do C# original:

- **Interseção de linhas**: `LineIntersection()`, `LineIntersectsRect()`, `LineIntersectsLine()`, `HasLineIntersection()`
- **Geometria de retângulos**: `InflateRect()`, `UnionRect()`, `RoundRect()`, `MaxRect()`, `RectFromPoints()`
- **Polígonos**: `ToPolygon()`, `ToPolygonEx()`, `ToRect()`, `PointInPolygon()`, `CrossLineInPolygon()`
- **Pontos**: `Center()`, `Distance2Points()`, `Distance2PointsSquared()`, `PointInLine()`, `PointToLine()`
- **Rotação e ângulos**: `AngleInDegree()`, `AngleInRad()`, `RotatePoint()`, `RotatePoints()`
- **Interpolação**: `Lerp()`, `LerpPoint()`, `Clamp()`, `MinMax()`
- **Grade**: `ToGrid()`, `RectToGrid()`, `SizeToGrid()`
- **Círculos**: `LineCircleIntersections()`, `PointCircle()`
- **Setas**: `CreateArrow()` — gera os 3 pontos de uma ponta de seta direcional
- **Utilitários**: `Round()`, `RoundPoint()`, `RoundToFactor()`, `NormalizeAngle()`, `DegreesToRadians()`

---

### `XGuid` — Identidade Universal

Geração e manipulação de GUIDs. Distingue GUIDs "vazios" (zero) de GUIDs "cheios" (válidos) com `IsEmptyValue()`, `IsFullValue()`. Fornece `NewValue()` para geração e `EmptyValue` como sentinela.

---

### `XConvert` — Conversão Tipada

Utilitários de conversão type-safe entre tipos primitivos: `ToString()`, `ToNumber()`, `ToBoolean()` com tratamento robusto de nulos, NaN e tipos inesperados.

---

## 🔹 Módulo Data — Motor de Serialização XML

> *"Um modelo sem persistência é um sonho. Com serialização, vira realidade."*

O módulo `Data` é o **motor de serialização XML** do TFX — um sistema completo, extensível e configurável para transformar qualquer grafo de `XPersistableElement` em XML e de volta, sem perder fidelidade.

### `XSerializationEngine` — Orquestrador Central

O cérebro da serialização. Singleton acessível via `XSerializationEngine.Instance`, oferece:

- `Serialize()` — converte elemento para XML string
- `Deserialize<T>()` — reconstrói objeto a partir de XML
- `SerializeToDocument()` — serialização de documentos com contexto de módulo
- `ValidateXml()` — validação estrutural do XML sem desserializar completamente
- Hooks extesíveis: `RegisterHook()`, `UnregisterHook()` com `XISerializationHook` (BeforeSerialize, AfterSerialize, BeforeDeserialize, AfterDeserialize, OnError)
- Serializers customizados: `RegisterCustomSerializer()` para tipos especiais
- Registry integrado: `RegisterElement()`, `GetClassID()`

```typescript
// Serializar um documento ORM para XML
const engine = XSerializationEngine.Instance;
const result = engine.Serialize(ormDocument);
if (result.Success) {
    console.log(result.XmlOutput);
}

// Desserializar de volta para objeto
const loaded = engine.Deserialize<XORMDocument>(xmlString);
```

### `XElementRegistry` — Registro de Tipos Polimórfico

Mapeia classes TypeScript para tags XML e vice-versa. Suporta serialização polimórfica: o tipo correto é instanciado automaticamente ao ler um arquivo XML, sem switches manuais.

### `XSerializationContext` — Estado de Serialização

Carrega o estado durante todo o processo: direção (Serialize/Deserialize), erros, fase atual, ID do documento, módulo. Resolve referências de links após a desserialização completa.

### `XmlWriter` — Gerador de XML

Escreve XML formado com indentação, atributos e elementos de forma eficiente e limpa. Suporta declaração XML, seções de propriedades e elementos filhos.

### `XmlReader` — Parser de XML

Faz parsing de XML em `XIXmlNode` com suporte a namespaces, atributos e texto interno. Modo estrito opcional rejeita elementos e atributos desconhecidos.

### `XTypeConverter` — Conversão para Serialização

Converte valores tipados para string para XML e de volta: primitivos, GUIDs, enums, tipos geométricos (`XColor`, `XPoint`, `XRect`, `XFont`, etc.), com tratamento completo de tipos inválidos.

---

## 🔹 Módulo Design — Primitivos Visuais

O módulo `Design` fornece os **elementos base para qualquer canvas de design visual**. É a camada que sabe o que é um retângulo, o que é uma linha, o que é um campo de texto — sem saber o que é uma tabela ou uma relação.

### `XDesign` — Superfície de Design Base

Classe base para todos os designs. Gerencia o canvas, lista de elementos e o **motor de roteamento ortogonal** integrado. Possui `RouteAllLines()` que pode ser sobrescrito por designers específicos.

### `XDocument<T>` — Container de Documento

Wrapper genérico para documentos de design. Contém um único `Design` do tipo parametrizado.

### `XDesignElement` — Elemento Visual Base

Elemento visual abstrato com propriedades de layout. Todos os elementos visuais herdam daqui.

### `XRectangle` — Forma Retangular Completa

Retângulo visual com propriedades funcionais completas:
- `Bounds` (posição e tamanho), `Width`, `Height`, `Left`, `Top`
- Bordas configuráveis: `BorderColor`, `BorderThickness`
- Preenchimento: `FillColor`
- Texto interno: `Text`, `Font`, `TextAlignment`
- Alinhamento: `Alignment`

### `XLine` — Elemento de Linha

Linha conectora visual com pontos de roteamento (`Points`), estilo (`LineCap`, `LineJoin`), cor e espessura. Base de todas as conexões visuals.

### `XField` — Campo de Texto

Elemento de campo de texto com `DataType`, `Length`, `Scale`, `IsRequired`, `DefaultValue`, `Index`. Base para `XORMField`.

### `XRouter` — Roteamento Ortogonal Inteligente

> *"A linha mais elegante entre dois pontos não é sempre a reta."*

`XRouter` é o **algoritmo de roteamento ortogonal** do TFX — portado e melhorado a partir do C# original. Encontra o caminho mais curto e mais limpo entre dois retângulos, contornando obstáculos de forma inteligente.

**Como funciona:**
1. Define os retângulos de origem e destino
2. Registra os obstáculos (outros elementos no canvas)
3. Gera linhas de saída a partir de cada lado da forma de origem
4. Executa busca em grafo seguindo interseções de linhas recursivamente
5. Filtra rotas que colidem com obstáculos
6. Retorna a rota mais curta válida

**Configuração:**
```typescript
const router = new XRouter({
    gap: 20,           // Espaçamento entre elementos e linhas
    checkCrossRect: true,  // Verificar cruzamento de retângulos
    returnShorterLine: true // Retornar a linha mais curta
});

router.setEndpoints(sourceBounds, targetBounds);
router.addObstacle(obstacleRect);
const bestLine = router.getAllLines(srcShape, tgtShape);
```

**Capacidades:**
- Direções de saída configuráveis por forma (Norte, Sul, Leste, Oeste)
- Busca com limite de iterações (segurança contra loops infinitos)
- Duas passadas: com verificação de cruzamento, depois sem (espelhando o fallback C#)
- Resultado completo: `bestLine`, `allLines`, `finalLines`, `steps`, `success`
- Adição e remoção dinâmica de obstáculos

---

## 🔹 Módulo Designers — ORM Designer

> *"Modele seu banco de dados visualmente. O código se escreve sozinho a partir do seu design."*

O módulo Designers contém a **implementação completa do designer ORM** — o coração do produto DASE. Este é onde a teoria do framework se torna realidade tangível.

### `XORMDocument` — Documento ORM

Container raiz do modelo ORM. Encapsula o `XORMDesign` e fornece acesso ao `XChangeTracker` e `XSelectionManager`. Ponto de entrada para serialização e operações de documento.

### `XORMDesign` — Canvas do Designer ORM

A superfície de design central. Gerencia tabelas, referências e o ciclo de vida completo do modelo:

**Propriedades de Design:**
- `Schema` — esquema do banco de dados (ex: `dbo`)
- `ParentModel` — modelos pai (pipe-separated, ex: `Auth.dsorm|Common.dsorm`)
- `StateControlTable` — tabela que gerencia máquina de estados
- `TenantControlTable` — tabela que controla isolamento de tenants

**Operações de Tabelas:**
- `CreateTable(options?)` — cria tabela com posição, tamanho e nome
- `DeleteTable(table)` — exclui tabela e remove todos os relacionamentos dependentes
- `GetTables()` — retorna todas as tabelas do design
- `FindTableByID(id)`, `FindFieldByID(id)` — busca por ID

**Operações de Referências:**
- `CreateReference(options)` — cria relacionamento FK entre campo e tabela alvo
- `DeleteReference(ref)` — remove relacionamento
- `GetReferences()` — retorna todos os relacionamentos
- `FindReferenceByID(id)`, `FindReferenceBySourceFieldID(fieldId)` — busca por ID ou campo fonte

**State Control (máquina de estados):**
- `EnableStateControl(table)` — habilita padrão de controle de estado para uma tabela
  - Cria `XORMStateField` e `XORMStateReference` automaticamente
  - Cria shadow table se a tabela de estados não estiver no design atual
  - Idempotente — pode ser chamado múltiplas vezes sem efeitos colaterais
- `DisableStateControl(table)` — remove campo e referência de estado da tabela

**Roteamento Automático:**
- `RouteAllLines()` — recalcula todas as conexões visuais usando `XRouter`
- Roteamento automaticamente acionado quando `Bounds` de qualquer tabela muda
- Dois modos: com e sem verificação de cruzamento (fallback inteligente)

---

### `XORMTable` — Tabela do Banco de Dados

Representa uma tabela do banco de dados com todos os seus elementos estruturais:

**Propriedades:**
- `Name` — nome da tabela
- `PKType` — tipo de dado da chave primária (`Int32`, `Int64`, `Guid`)
- `Bounds` — posição e dimensão visual (altura calculada automaticamente com base nos campos)
- `UseStateControl` — participa do padrão de máquina de estados
- `IsShadow` — tabela fantasma (referência externa de outro modelo)
- `ShadowDocumentID/Name`, `ShadowTableID/Name`, `ShadowModuleID/Name` — metadados de referência a tabelas de outros módulos

**Gerenciamento de Campos:**
- `CreatePKField(options?)` — cria ou retorna PK existente (idempotente)
- `EnsurePKField()` — garante existência do campo PK
- `HasPKField()`, `GetPKField()` — verifica e obtém PK
- `CreateField(options?)` — cria campo com nome, tipo, tamanho, required, autoincrement, defaultValue, allowedValues
- `DeleteField(field)` — remove campo com verificação de `CanDelete`
- `MoveFieldToIndex(field, index)` — reordena campos (PK sempre fica em index 0)
- `UpdateFieldIndexes()` — sincroniza propriedade `Index` após reordenação
- `GetFields()` — retorna todos os campos
- `FindFieldByID(id)`, `FindFieldByName(name)` — busca por ID ou nome

**State Control:**
- `CreateStateField(dataType, fieldName)` — cria campo de estado FK automático
- `DeleteStateField()` — remove campo de estado
- `GetStateField()` — obtém campo de estado existente

**Altura Dinâmica:**
```
Altura = headerHeight(28) + fieldCount × fieldHeight(16) + padding(12)
```
A altura da tabela se ajusta automaticamente conforme campos são adicionados ou removidos.

---

### `XORMField` — Campo da Tabela

Campo de dados com propriedades ricas para modelagem avançada:

- `DataType` — tipo de dado (`String`, `Int32`, `Int64`, `Decimal`, `Boolean`, `DateTime`, `Guid`, etc.)
- `Length` — tamanho/precisão (obrigatório para `Decimal`)
- `Scale` — escala (apenas para `Decimal`)
- `IsRequired` — campo obrigatório
- `IsAutoIncrement` — incremento automático
- `DefaultValue` — valor padrão
- `IsFK` — flag explícita de chave estrangeira (compatibilidade C#)
- `IsForeignKey` — computed: `IsFK OR existe XORMReference com este campo como source`
- `AllowedValues` — lista de valores permitidos (enum-like, pipe-separated)
- `AllowedValuesList` — array parseado de `AllowedValues`
- `HasAllowedValues` — verificação rápida
- `IsAllowedValue(value)` — valida um valor contra a lista
- `SetAllowedValuesList(values)` — atualiza a lista removendo duplicatas e entradas vazias
- `GetReference()` — referência FK ativa neste campo
- `GetExpectedDataType()` — tipo de dado esperado baseado na tabela alvo FK

---

### `XORMPKField` — Chave Primária

Herda de `XORMField`. Sobrescreve `IsPrimaryKey` para retornar `true`. O `DataType` pode ser travado após configuração com `LockDataType()` — impedindo alterações acidentais.

---

### `XORMReference` — Relacionamento Entre Tabelas

Conecta um campo FK de uma tabela a outra tabela. Herda de `XLine` para ter representação visual com pontos de roteamento. Provê `Source` (ID do campo FK) e `Target` (ID da tabela destino), além de métodos `GetSourceElement<T>()` e `GetTargetElement<T>()` para resolução lazy de referências.

---

### `XORMStateReference` — Referência de Estado (Invisível)

Variante especializada de `XORMReference` para o padrão de máquina de estados. Representa a conexão entre a tabela e sua tabela de controle de estado — criada automaticamente por `EnableStateControl()`, invisível no canvas mas presente no modelo.

---

### `XORMValidator` — Validação Declarativa do Modelo

> *"Um modelo correto não é acidente — é resultado de validação rigorosa."*

`XORMValidator` estende `XValidator<XORMDocument, XORMDesign>` e executa um conjunto completo de regras sobre o modelo:

**Validação de Tabelas:**
- ❌ **Erro:** Nome de tabela é obrigatório
- ❌ **Erro:** Nomes de tabela duplicados não são permitidos
- ✅ **Auto-correção:** Cria PK field automaticamente se não existir
- ✅ **Auto-correção:** Sincroniza `PKType` da tabela com `DataType` do campo PK

**Validação de Campos:**
- ❌ **Erro:** Nome de campo é obrigatório
- ❌ **Erro:** Nomes de campo duplicados na mesma tabela
- ❌ **Erro:** `DataType` inválido para chave primária (verificado contra `ValidPKTypes`)
- ❌ **Erro:** Campo `Decimal` sem `Length` definido
- ⚠️ **Aviso:** Campo com `Scale` definido mas tipo não é `Decimal`
- ⚠️ **Aviso:** `DefaultValue` fora da lista `AllowedValues`
- ⚠️ **Aviso:** `AllowedValues` e `IsAutoIncrement` combinados (mutuamente exclusivos)
- ⚠️ **Aviso:** Nome de campo com espaços no início ou fim
- ✅ **Auto-correção:** Sincroniza `DataType` de campos FK com `PKType` da tabela alvo

**Validação de Referências:**
- ❌ **Erro:** Campo fonte da referência não definido
- ❌ **Erro:** Campo fonte da referência não encontrado no design
- ❌ **Erro:** Tabela destino não definida
- ❌ **Erro:** Tabela destino não encontrada no design
- ⚠️ **Aviso:** Relação auto-referenciante (tabela referencia ela mesma)
- ✅ **Auto-correção:** Referências legadas apontando para tabela em vez de campo PK são corrigidas automaticamente

**Validação do Design:**
- ⚠️ **Aviso:** Design sem nome definido
- ⚠️ **Aviso:** Design sem tabelas

---

### `XORMController` — Controlador de Operações ORM

Orquestrador de alto nível para operações complexas sobre o modelo ORM. Coordena múltiplas operações do designer e implementa fluxos de trabalho de modificação que envolvem múltiplos elementos.

---

### `XORMRegistry` — Registro do Modelo ORM

Registra todos os tipos ORM no `XElementRegistry` do engine de serialização, vinculando classes TypeScript às suas tags XML. Garante que a serialização/desserialização polimórfica funcione corretamente para todos os tipos do domínio ORM.

---

## 📜 Padrões de Qualidade de Código

Este projeto segue padrões rigorosos de codificação definidos em [.github/copilot-instructions.md](.github/copilot-instructions.md).

### Pilares de Qualidade (Ordem de Prioridade)

1. **🔒 Seguro** — Proteção contra ataques comuns
2. **✅ Correto** — Sem bugs, lógica sólida
3. **⚡ Performático** — Alocação mínima de memória (mentalidade zero-alocação)
4. **📖 Claro** — Código autodocumentado (sem necessidade de comentários)
5. **🎯 Consistente** — Estilo uniforme em toda a base de código
6. **✨ Elegante** — Esteticamente agradável, fácil de navegar
7. **🔧 Manutenível** — Fácil de modificar e expandir
8. **🧪 Testável** — Projetado para testes automatizados

### Convenções de Nomenclatura

| Elemento | Convenção | Exemplo |
|---------|------------|---------| 
| Classes/Tipos | `PascalCase` com prefixo `X` | `XUserService`, `XORMTable` |
| Interfaces | Prefixo `XI` + `PascalCase` | `XIRepository`, `XISerializable` |
| Métodos/Propriedades | `PascalCase` | `GetById`, `SaveChanges` |
| Campos Privados | Prefixo `_` + `PascalCase` | `_Cache`, `_Repository` |
| Parâmetros | Prefixo `p` + `PascalCase` | `pUserID`, `pOptions` |
| Variáveis Locais | Mnemônicos minúsculos | `lstua`, `frsrt` |

### Regras de Estilo de Código

- ✅ Um tipo por arquivo
- ✅ Sem chaves para blocos de linha única
- ✅ Retornos antecipados (guard clauses)
- ✅ Sem comentários (código autodocumentado)
- ✅ Evitar lambdas em caminhos quentes (hot paths)
- ✅ Preferir loops explícitos sobre LINQ
- ✅ Usar classes `sealed` quando herança não é necessária

---

## 🏗️ Guia de Desenvolvimento

### Pré-requisitos

- Node.js 20+
- VS Code (versão mais recente)
- TypeScript 5.3+

### Desenvolvimento TFX

```powershell
# Navegar para o diretório TFX
cd TFX

# Instalar dependências
npm install

# Compilar o framework
npm run build

# Executar testes
npm run test

# Executar testes com cobertura
npm run test:coverage

# Modo watch para desenvolvimento
npm run test:watch
```

**Scripts TFX:**

| Script | Descrição |
|--------|-------------|
| `npm run build` | Compilar TypeScript para JavaScript (dist/) |
| `npm run watch` | Compilação em modo watch |
| `npm run test` | Executar todos os testes unitários com Vitest |
| `npm run test:coverage` | Gerar relatório de cobertura (100% obrigatório) |
| `npm run test:watch` | Modo watch interativo para testes |
| `npm run clean` | Remover artefatos de build (dist/) |
| `npm run lint` | Executar verificações ESLint |

### Desenvolvimento da Extensão DASE

```powershell
# Navegar para o diretório DASE
cd DASE

# Instalar dependências (inclui TFX local)
npm install

# Compilar a extensão
npm run compile

# Executar testes
npm run test

# Executar testes com cobertura
npm run test:coverage

# Iniciar extensão no VS Code
# Pressione F5 no VS Code, ou:
code --extensionDevelopmentPath=./DASE
```

**Scripts DASE:**

| Script | Descrição |
|--------|-------------|
| `npm run compile` | Compilar TypeScript para JavaScript (out/) |
| `npm run watch` | Compilação em modo watch |
| `npm run test` | Executar todos os testes unitários com Jest |
| `npm run test:coverage` | Gerar relatório de cobertura (100% obrigatório) |
| `npm run lint` | Executar verificações ESLint |
| `npm run package` | Criar pacote VSIX da extensão |

### Executando Ambos os Projetos

```powershell
# Da raiz do repositório, compilar tudo
cd TFX
npm ci
npm run build

cd ../DASE
npm ci
npm run compile

# Executar todos os testes
cd ../TFX && npm run test:coverage
cd ../DASE && npm run test:coverage
```

### Scripts de Conveniência

| Script | Descrição |
|--------|-------------|
| `sow.ps1` | Start of Work — prepara o ambiente de desenvolvimento |
| `eow.ps1` | End of Work — finaliza e resume o progresso |
| `check-work.ps1` | Verifica status dos testes e cobertura |
| `run-tests.ps1` | Executa suite completa de testes |
| `transform-properties-view.ps1` | Transforma a visualização de propriedades |

---

## 🚀 Pipeline CI/CD

O repositório usa um único workflow CI/CD unificado que compila e testa ambos os componentes:

### TFX Framework

**Workflow:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

**Triggers:**
- Push no branch `master` (mudanças em TFX/**)
- Pull requests para o branch `master`

**Estágios do Pipeline:**
1. **Checkout** — Clonar repositório
2. **Setup Node.js 20** — Configurar ambiente Node.js
3. **Instalar Dependências** — Executar `npm ci` em TFX/
4. **Build** — Compilar TypeScript (`npm run build`)
5. **Test** — Executar suite de testes com Vitest
6. **Coverage** — Gerar e validar 100% de cobertura
7. **Upload Reports** — Publicar artefatos de cobertura

**Quality Gates:**
- ✅ Todos os testes automatizados devem passar
- ✅ 100% de cobertura de código obrigatório
- ✅ Sem erros de compilação TypeScript
- ✅ Padrões de zero-alocação aplicados

### DASE Extension

**Workflow:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

**Triggers:**
- Push no branch `master` (mudanças em DASE/** ou TFX/**)
- Pull requests para o branch `master`

**Estágios do Pipeline:**
1. **Checkout** — Clonar repositório
2. **Setup Node.js 20** — Configurar ambiente Node.js
3. **Build TFX** — Compilar dependência do framework
4. **Test TFX** — Validar integridade do framework
5. **Instalar Dependências DASE** — Executar `npm ci` em DASE/
6. **Build DASE** — Compilar extensão (`npm run compile`)
7. **Lint** — Executar verificações ESLint
8. **Test** — Executar suite de testes com Jest
9. **Coverage** — Gerar e validar 100% de cobertura
10. **Upload Reports** — Publicar artefatos de cobertura
11. **Package** (apenas master) — Criar pacote VSIX

**Quality Gates:**
- ✅ Todos os testes automatizados devem passar
- ✅ 100% de cobertura de código obrigatório
- ✅ Sem violações TypeScript/ESLint
- ✅ Integridade da dependência TFX validada
- ✅ Pacote VSIX compila com sucesso

**Artefatos:**
- Relatórios de cobertura (tanto TFX quanto DASE)
- Pacote VSIX (apenas branch master)

---

## 📄 Licença

MIT License — Veja [LICENSE](LICENSE) para detalhes.

---

<p align="center">
  <i>Construído inteiramente através de desenvolvimento orientado por IA com GitHub Copilot</i><br>
  <b>🤖 Nenhum humano escreveu este código diretamente — apenas prompts 🤖</b>
</p>
