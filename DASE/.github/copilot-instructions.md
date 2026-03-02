# DASE — Design-Aided Software Engineering

## Project Overview

DASE is a VS Code extension for visual ORM database design. Users create and edit `.dsorm` files using a graphical canvas designer that renders tables, fields, and FK references as an interactive SVG diagram.

## Architecture

```
DASE Extension (VS Code)
├── TFX Core Library (@tootega/tfx) — ORM engine, design models, persistence
├── ORM Designer — Custom webview editor (SVG canvas)
├── AgentIntegration/ — AI Copilot integration (chat + tools)
├── Services/ — TFXBridge adapter, LogService, SelectionService
├── Commands/ — VS Code commands (AddTable, Validate, Export, etc.)
└── Views/ — Properties panel, Issues panel
```

### Key Classes

- **`XTFXBridge`** — Adapter between VS Code and TFX core. All ORM operations go through this bridge.
- **`XORMDesignerEditorProvider`** — Custom editor provider for `.dsorm` files. Manages webview lifecycle.
- **`XORMDesignerState`** — Per-document state: holds the TFXBridge, dirty flag, URI.
- **`XAgentBridge`** — Singleton adapter for AI tools. Translates AI requests → TFXBridge calls.

## ORM Model Structure

A `.dsorm` file contains:
- **Tables** (`XORMTable`) — Database tables with Name, ID, PKType, Fill color, X/Y position
- **Fields** (`XORMField`) — Column definitions with Name, DataType, IsPrimaryKey, IsForeignKey, IsRequired, Length
- **References** (`XORMReference`) — FK relationships linking a source field to a target table
- **Shadow Tables** — References to tables from other `.dsorm` modules

## Naming Conventions

- **Classes**: `X` prefix (e.g., `XORMTable`, `XTFXBridge`)
- **Interfaces**: `I` prefix (e.g., `ITableData`, `ISelectPayload`)
- **Parameters**: `p` prefix (e.g., `pName`, `pTableID`)
- **Private fields**: `_` prefix (e.g., `_Controller`, `_Webviews`)
- **Constants**: `X` prefix objects (e.g., `XDesignerMessageType`)
- **Table naming**: PascalCase, singular (e.g., `Customer`, `OrderItem`)

## Available DASE Tools (Agent Mode)

When working with DASE through Copilot Agent Mode, the following tools are available:

| Tool | Purpose | Mutating |
|------|---------|----------|
| `dase_get_model` | Get ORM model overview | No |
| `dase_list_tables` | List all tables | No |
| `dase_get_table` | Get table details | No |
| `dase_add_table` | Add a new table | Yes |
| `dase_add_field` | Add a field to a table | Yes |
| `dase_add_reference` | Create FK reference | Yes |
| `dase_validate` | Validate model | No |
| `dase_export_dbml` | Export to DBML | No |
| `dase_get_properties` | Get element properties | No |
| `dase_update_property` | Update a property | Yes |
| `dase_move_table` | Move table to position | Yes |
| `dase_set_color` | Set table fill color | Yes |
| `dase_organize_layout` | AI-organize table layout | Yes |

## Color Format

TFX stores colors as ARGB hex strings (8 chars, no `#`): `AARRGGBB` (e.g., `FF4A90D9` for opaque blue).
When setting colors through `UpdateProperty("Fill", ...)`, you can use either:
- CSS format: `#4A90D9`
- TFX format: `FF4A90D9`

## Common Data Types

`String`, `Int16`, `Int32`, `Int64`, `Decimal`, `Float`, `Double`, `Boolean`, `DateTime`, `Date`, `Time`, `Guid`, `Byte`, `Binary`, `Text`

## File Types

- `.dsorm` — ORM model file (XML-based, opened by the ORM Designer)
- `.dbml` — Database Markup Language (import/export format)
