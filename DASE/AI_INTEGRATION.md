# DASE — AI Integration Guide

> **Documentation of the DASE extension's AI integration commands (GitHub Copilot).**

The DASE extension offers deep integration with GitHub Copilot and other VS Code Language Models, letting you use natural language to query, modify, and organize your ORM models.

---

## Table of Contents

1. [Overview](#overview)
2. [Chat Participant (@dase)](#chat-participant-dase)
3. [Language Model Tools (Agent Mode)](#language-model-tools-agent-mode)
4. [AI Organization (Automatic Organization)](#ai-organization-automatic-organization)
5. [Practical Examples](#practical-examples)

---

## Overview

DASE's AI integration works at three levels:

| Mode | Description | Activation |
|------|-----------|----------|
| **Chat Participant** | `@dase` chat assistant for questions and commands | Type `@dase` in Copilot Chat |
| **Agent Mode Tools** | Tools Copilot can invoke automatically | Copilot Agent Mode (automatic) |
| **AI Organization** | Visual organization of tables by functional domain | `Dase.OrganizeTablesAI` command |

### Requirements

- VS Code 1.93+
- GitHub Copilot installed and active
- A `.dsorm` file open in the ORM Designer

---

## Chat Participant (@dase)

The `@dase` chat participant is an assistant specialized in ORM design that you can invoke directly in Copilot Chat.

### Slash Commands

| Command | Description | Example |
|---------|-----------|---------|
| `/model` | Shows an overview of the current ORM model | `@dase /model` |
| `/table [name]` | Lists all tables or details a specific one | `@dase /table Customer` |
| `/validate` | Runs model validation and shows errors/warnings | `@dase /validate` |
| `/export` | Exports the model to DBML format | `@dase /export` |
| `/types` | Shows available data types | `@dase /types` |
| `/help` | Displays help with all commands | `@dase /help` |

### Usage Examples

```
@dase /model
```
Returns:
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
Returns full table details including fields, types, PKs, FKs, and references.

---

```
@dase /validate
```
Returns:
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

### Natural Language Questions

Besides slash commands, you can ask questions freely:

```
@dase How should I model a many-to-many relationship between Product and Category?
```

```
@dase What are the best practices for naming foreign keys?
```

```
@dase Help me understand the structure of the Customer table
```

---

## Language Model Tools (Agent Mode)

When Copilot is in **Agent Mode**, it can automatically invoke the DASE tools to perform operations on the ORM model.

### Available Tools

#### Read Tools

| Tool | Description | Parameters |
|------|-----------|------------|
| `dase_get_model` | Gets general model information | — |
| `dase_list_tables` | Lists tables (with optional filter) | `filter?: string` |
| `dase_get_table` | Details of a specific table | `tableName: string` |
| `dase_get_properties` | Properties of an element | `elementId: string` |
| `dase_validate` | Runs model validation | — |
| `dase_export_dbml` | Exports to DBML | — |

#### Modification Tools

| Tool | Description | Parameters |
|------|-----------|------------|
| `dase_add_table` | Adds a new table | `name: string`, `x?: number`, `y?: number` |
| `dase_add_field` | Adds a field to a table | `tableName: string`, `fieldName: string`, `dataType: string` |
| `dase_add_reference` | Creates an FK between tables | `sourceTable: string`, `targetTable: string`, `name?: string` |
| `dase_update_property` | Updates a property | `elementId: string`, `propertyKey: string`, `value: any` |
| `dase_move_table` | Moves a table on the canvas | `tableName: string`, `x: number`, `y: number` |
| `dase_set_color` | Sets a table's color | `tableName: string`, `color: string` |
| `dase_organize_layout` | Organizes the layout via AI | — |

### Example Prompts for Agent Mode

```
Create a Customer table with fields Name (String), Email (String) and BirthDate (DateTime)
```

Copilot will automatically invoke:
1. `dase_add_table` to create the table
2. `dase_add_field` (3×) to add the fields

---

```
Move the Order table to position (500, 200) and change its color to blue
```

Invokes:
1. `dase_move_table` with `x=500, y=200`
2. `dase_set_color` with `color=#4A90D9`

---

```
Create an FK from the Order table to Customer
```

Invokes `dase_add_reference` with:
- `sourceTable: "Order"`
- `targetTable: "Customer"`

---

```
List all tables that start with "Sys"
```

Invokes `dase_list_tables` with `filter: "Sys"`

---

### Operation Confirmation

Operations that modify the model (add, update, move) show a confirmation before executing:

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

## AI Organization (Automatic Organization)

The `Dase.OrganizeTablesAI` command uses artificial intelligence to:

1. **Analyze** table names and FK relationships
2. **Group** tables by functional domain (e.g. Security, Sales, Inventory)
3. **Position** groups in visual clusters on the canvas
4. **Color** each group with a distinct color

### How to Use

1. Open a `.dsorm` file in the ORM Designer
2. Run the `DASE: Organize Tables with AI` command (Ctrl+Shift+P)
3. Select your preferred language model from the list
4. Wait for processing
5. Review the result — use **Revert** if you don't like it

### Visual Flow

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

### Group Color Palette

| Domain | Color |
|---------|-----|
| Group 1 | 🔵 #4A90D9 (Blue) |
| Group 2 | 🟢 #50C878 (Emerald) |
| Group 3 | 🟡 #E8A838 (Amber) |
| Group 4 | 🔴 #D85C8A (Rose) |
| Group 5 | 🟣 #7B68EE (Purple) |
| Group 6 | 🩵 #20B2AA (Teal) |
| Group 7 | 🟠 #FF7F50 (Coral) |
| Group 8 | 🟢 #9ACD32 (Lime) |
| Others | ⚪ #AAAAAA (Gray) |

### Revert (Undo)

If the result is unsatisfactory:

1. Click the **Revert** button on the overlay
2. Or run `Dase.OrganizeTablesAIRevert`

The model returns to its previous state immediately.

---

## Practical Examples

### Scenario 1: Create a Complete Model

```
@dase Create a model for an e-commerce with the following tables:
- Customer (ID, Name, Email, Phone, Address)
- Product (ID, Name, Description, Price, Stock)
- Category (ID, Name, ParentCategoryID)
- Order (ID, CustomerID, OrderDate, TotalAmount, Status)
- OrderItem (ID, OrderID, ProductID, Quantity, UnitPrice)

Add the appropriate FKs between the tables.
```

### Scenario 2: Analyze an Existing Model

```
@dase /model

Now tell me: which tables are "orphans" (with no incoming or outgoing FK)?
```

### Scenario 3: Refactor the Visual Organization

```
Organize all tables in the current model using AI, grouping them by functional domain.
Put the security tables (User, Role, Permission) together in blue.
```

### Scenario 4: Export for Documentation

```
@dase /export

Now convert this DBML into Markdown documentation with a description of each table.
```

### Scenario 5: Validation and Fixing

```
@dase /validate

For each error found, suggest how to fix it.
```

---

## Quick Reference

### Chat Commands

| Input | Result |
|-------|-----------|
| `@dase /model` | Model overview |
| `@dase /table` | Lists all tables |
| `@dase /table Customer` | Details of the Customer table |
| `@dase /validate` | Runs validation |
| `@dase /export` | Exports to DBML |
| `@dase /types` | Lists data types |
| `@dase /help` | Help |

### Agent Mode Examples

| Prompt | Tool Invoked |
|--------|---------------|
| "List the tables" | `dase_list_tables` |
| "Create table X" | `dase_add_table` |
| "Add field Y to table X" | `dase_add_field` |
| "Create FK from A to B" | `dase_add_reference` |
| "Validate the model" | `dase_validate` |
| "Export to DBML" | `dase_export_dbml` |
| "Move table X to (100, 200)" | `dase_move_table` |
| "Change the color of X to red" | `dase_set_color` |
| "Organize the tables" | `dase_organize_layout` |

### VS Code Commands

| Command ID | Description |
|------------|-----------|
| `Dase.OrganizeTablesAI` | Opens the AI picker and organizes tables |
| `Dase.OrganizeTablesAIExecute` | Runs organization with the selected model |
| `Dase.OrganizeTablesAIRevert` | Undoes the last AI organization |

---

## Troubleshooting

### "No ORM designer is currently open"

Make sure you have a `.dsorm` file open in the ORM Designer before using the commands.

### "No AI language model available"

Install GitHub Copilot or another extension that provides the Language Model API.

### AI returns an unrecognized format

Try again with another model (GPT-4o tends to adhere better to the JSON format).

### The organization didn't turn out well

Use the **Revert** button and try again, or adjust manually after the initial organization.

---

*DASE — Design-Aided Software Engineering*  
*Version: 2026-03-02*
