# TFX + DASE — Complete Copilot Guide

> **Revision:** 2026-02-28 — Full deep analysis of all source files.  
> This document is the single authoritative reference for GitHub Copilot when working in this repository.  
> Every section is **mandatory**. No rule is optional.

---

## Table of Contents

1. [Repository Identity](#1-repository-identity)
2. [Architecture Overview](#2-architecture-overview)
3. [TFX Framework — Full Module Reference](#3-tfx-framework--full-module-reference)
4. [DASE Extension — Full Module Reference](#4-dase-extension--full-module-reference)
5. [ORM Object Model — Invariants & Lifecycle](#5-orm-object-model--invariants--lifecycle)
6. [TFX Property System](#6-tfx-property-system)
7. [TFX Serialization Engine](#7-tfx-serialization-engine)
8. [TFX Configuration Manager](#8-tfx-configuration-manager)
9. [TFX Validation System](#9-tfx-validation-system)
10. [TFX Event & Dispatch System](#10-tfx-event--dispatch-system)
11. [TFX Geometry & Visual Model](#11-tfx-geometry--visual-model)
12. [TFX Routing System](#12-tfx-routing-system)
13. [DASE Webview Message Protocol](#13-dase-webview-message-protocol)
14. [DASE State & Bridge Layer](#14-dase-state--bridge-layer)
15. [DASE Services Reference](#15-dase-services-reference)
16. [Naming Conventions](#16-naming-conventions)
17. [Code Style — TypeScript](#17-code-style--typescript)
18. [Quality, Design & SOLID](#18-quality-design--solid)
19. [Performance Rules](#19-performance-rules)
20. [Security Rules](#20-security-rules)
21. [Error Handling & Resilience](#21-error-handling--resilience)
22. [Testing Standards](#22-testing-standards)
23. [Build & CI/CD](#23-build--cicd)
24. [Anti-Patterns (Prohibited Patterns)](#24-anti-patterns-prohibited-patterns)
25. [Extending the Codebase](#25-extending-the-codebase)
26. [Philosophical Principles](#26-philosophical-principles)
27. [Final Validation Checklist](#27-final-validation-checklist)

---

## 1. Repository Identity

### 1.1 Two Projects, One Repository

This repository contains **two completely distinct projects** that must never be confused:

| Project | Folder | Role | Type |
|---------|--------|------|------|
| **TFX** | `/TFX/` | Core framework / domain library | TypeScript library (`@tootega/tfx`) |
| **DASE** | `/DASE/` | VS Code extension | VS Code Extension (`dase`) |

Dependency direction is **strictly one-way**: `DASE → TFX`. TFX must **never** import anything from DASE.

### 1.2 Context Validation — Before Every Change

Before writing a single line of code:

1. **Identify the file path.** Is it under `/TFX/` or `/DASE/`?
2. **State the context explicitly:** "Change targets: TFX" or "Change targets: DASE."
3. **Check the dependency direction:** DASE may reference TFX APIs; TFX must not reference DASE.
4. **Never infer structure** — search the repository for existing patterns and follow them exactly.
5. **When mentioning an API/class/module**, always clarify which side: `(TFX) XORMDesign` or `(DASE) XTFXBridge`.
6. **All comments in English.** No Portuguese in code, comments, or identifiers.

### 1.3 Current Phase

Current active development focus: **ORM Designer** for `.dsorm` files.

Do **not** introduce UI Designer, Flow Designer, or API Designer until the ORM foundation is declared stable.

### 1.4 Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.3+ |
| Runtime | Node.js 20+ |
| TFX Build | `tsc` (CommonJS + `.d.ts`) |
| TFX Test | **Vitest** with `@vitest/coverage-v8` |
| DASE Build | `tsc` |
| DASE Test | **Jest** + `ts-jest` |
| Coverage threshold | **100%** lines / branches / functions / statements — both projects |
| Package | `@tootega/tfx` (published as `dist/`) |

---

## 2. Architecture Overview

### 2.1 Layered Class Hierarchy (TFX)

```
XElement                        (Core — tree node, ID, Name, ChildNodes)
  └── XPersistableElement       (Core — property system, validation, selection, serialization)
        └── XDesignElement      (Design — abstract base for visual elements)
              ├── XRectangle    (Design — bounds, colors, stroke, fill, cursor, shadow)
              │     ├── XField  (Design — Index, DataType, IsRequired, Length, Scale, DefaultValue)
              │     │     ├── XORMField     (ORM — IsAutoIncrement, IsNullable + FK resolution)
              │     │     └── XORMPKField   (ORM — locked DataType, always IsRequired=true)
              │     ├── XDesign (Design — abstract design canvas with routing)
              │     │     └── XORMDesign    (ORM — Schema, tables/references creation, routing rules)
              │     └── XORMTable           (ORM — PKType, CreatePKField, CreateField, GetPKField)
              └── XLine         (Design — Source/Target IDs, Points, Stroke)
                    └── XORMReference       (ORM — FK to PK relationship line)

XDocumentBase   (Core — abstract, GetTree)
  └── XDocument<T extends XDesign>   (Design — owns PDesign: T | null)
        └── XORMDocument             (ORM — creates XORMDesign in constructor, Initialize merges duplicates)
```

### 2.2 DASE Extension Layers

```
ExtensionMain.activate()
  ├── XORMDesignerEditorProvider   (Designers/ORM — CustomEditorProvider<ICustomDocument>)
  ├── XNewORMDesignerCommand       (Designers/ORM/Commands)
  ├── XOpenORMDesignerCommand      (Designers/ORM/Commands)
  ├── XAddTableCommand             (Designers/ORM/Commands)
  ├── XAddFieldCommand             (Designers/ORM/Commands)
  ├── XAlignLinesCommand           (Designers/ORM/Commands)
  ├── XValidateORMModelCommand     (Designers/ORM/Commands)
  ├── XDeleteSelectedCommand       (Commands)
  ├── XRenameSelectedCommand       (Commands)
  ├── XReloadDataTypesCommand      (Commands)
  ├── XIssuesViewProvider          (Views)
  └── XPropertiesViewProvider      (Views)

XORMDesignerState  (per document — owns XTFXBridge, IsDirty, issues, selection)
  └── XTFXBridge  (Integration — XORMController + XSerializationEngine + XORMValidator)
```

### 2.3 Data Flow: User Action to Persistence

```
User UI gesture  ->  Webview message  ->  XORMDesignerEditorProvider.HandleMessage()
  ->  XORMDesignerState.ExecuteOperation()
  ->  XTFXBridge.[method]()
  ->  XORMController.[method]()    // TFX domain operation
  ->  XORMDesign/XORMTable/XORMField  (TFX model mutated)
  ->  XTFXBridge.BuildModelData()  // Convert TFX model to JSON for webview
  ->  Webview receives updated model
  ->  IssueService.SetIssues()     // Validation results published
  ->  SelectionService updates     // Selection state published
  ->  PropertiesViewProvider refreshes
  ->  IssuesViewProvider refreshes
```

---

## 3. TFX Framework — Full Module Reference

### 3.1 Core (`TFX/src/Core/`)

#### `XElement` — Base Tree Node
- Abstract base for all domain objects.
- Owns `ChildNodes: XElement[]` — always a live array, never replaced from outside.
- Key properties: `ID: string`, `Name: string`, `ParentNode`, `ClassName`, `DisplayText`.
- Computed read-only: `CanDuplicate`, `IsInheritable`, `IsCacheable`, `FullNameSpace`.
- Tree traversal helpers: `GetChild<T>()`, `GetChildDeep<T>()`, `GetChildrenOfType<T>()`.
- **Never** manipulate `ChildNodes` directly from outside TFX — use `AppendChild()` / `RemoveChild()`.

#### `XPersistableElement` — Property-Enabled, Serializable Element
- Extends `XElement`.
- Owns the reactive property store (`_Values: XValues`) — do not access directly.
- All property access **must** go through `GetValue(XProperty)` / `SetValue(XProperty, value)`.
- Provides `IsSelected`, `IsLocked`, `CanDelete`, `CanRename`, `Description`, `FillColor` properties.
- Provides `Validate(): XDataValidateError[]` — override to add domain validation.
- All changes tracked via `XChangeTracker`.
- Exposes `XEvent` instances for property change notifications.

#### `XProperty<T, TType>` — Static Property Descriptor
- Registered once per class using `XProperty.Register<TClass, TType>(selector, guid, key, displayName, defaultValue)`.
- The `guid` MUST be globally unique across the entire codebase — use a proper UUID.
- Property GUIDs starting with `00000001-...` are reserved for TFX framework properties.
- For link properties (ID references): use `XProperty.RegisterLink<TClass>(selector, guid, key, displayName, defaultValue)`.
- For link arrays: use `XProperty.RegisterLinkArray<TClass>(selector, guid, key, displayName)`.
- **Pattern:**
  ```typescript
  public static readonly MyProp = XProperty.Register<XMyClass, string>(
      (p: XMyClass) => p.MyValue,
      "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
      "MyValue",
      "My Value Display Name",
      "defaultValue"
  );

  public get MyValue(): string { return this.GetValue(XMyClass.MyProp) as string; }
  public set MyValue(pValue: string) { this.SetValue(XMyClass.MyProp, pValue); }
  ```

#### `XGuid` — GUID Utilities
- `XGuid.EmptyValue`: `"00000000-0000-0000-0000-000000000000"`.
- `XGuid.NewValue()`: generates a new UUID v4 string.
- `XGuid.IsEmptyValue(pValue)`: true when value equals `EmptyValue`.
- `XGuid.IsFullValue(pValue)`: true when value is non-empty, non-null, and not `EmptyValue`.

#### `XValidation` — Validation Types
- `XDesignerErrorSeverity.Error` (2) and `XDesignerErrorSeverity.Warning` (1).
- `XDataValidateError`: combines `Element`, `Severity`, `Message`, optional `Property`.
- `XDataValidateError.Required(element, property)` — factory for required-field errors.
- `XValidator<TDocument, TDesign>`: abstract base for domain validators. Override `ValidateDesign()` and `ValidateElements()`.
- `XConcurrentBag<T>`: simple append-only collection used internally.
- `XIValidationIssue`: interface for validation result output.

#### `XChangeTracker` — Undo/Redo Foundation
- `StartGroup(title, action)`, `TrackInsert(element)`, `TrackDelete(element)`, `TrackChange(element, property, default, oldVal, newVal)`.
- Currently a stub implementation — full undo/redo will be implemented in a future phase.
- Every structural and property change MUST route through it to remain forward-compatible.

#### `XEvent<THandler>` — Typed Event
- `Add(handler)`, `Remove(handler)`, `Invoke(...args)` / `Raise(...args)`.
- Backed by a `Set<THandler>` — handlers are deduplicated automatically.
- `HasHandlers: boolean`, `Clear()`.

#### `XDispatcher` — Execution Context
- `XDispatcher.Execute(action)`: synchronous dispatch.
- `XDispatcher.ExecuteAsync(action)`: via `queueMicrotask`.

#### `XConvert` — Type-Safe Conversion
- `ToNumber(value)`, `ToBoolean(value)`, `ToString(value)`, etc.
- Use instead of raw casts for serialization/deserialization paths.

#### `XError` — Domain Error
- Extend or throw `XError` for domain-level failures instead of bare `Error`.

#### `XEnums` — Shared Enumerations
- `XConstraintType`, `XPropertyGroup`, `XElementType`.
- `XPropertyGroupDescription`: label map for property editors.

#### `XModelValue` — Internal Property Storage Unit
- Stores a single property value with its origin (owner, propertyId, value, sourceId, targetId).
- Not accessed directly — all access through `GetValue`/`SetValue` on `XPersistableElement`.

#### `XData` / `XLinkData` / `XLinkArrayData` — Serialization Primitives
- `XData`: base node used in XML tree during serialization.
- `XLinkData`: stores a reference by ID (foreign key relationship in serialized form).
- `XLinkArrayData`: stores multiple `XLinkData` children.
- `XParentData`, `XValues`, `XLinkableElement`, `XSelectable`: supporting types.

#### `XDefaults` — Runtime Configuration Flags
- `XDefault.StopCheck`, `XDefault.SetNewID`: serialization-phase flags — do not toggle outside serialization.
- `XDesignerDefault.CurrentCulture`, `DefaultCulture`: currently `"pt-BR"`.

### 3.2 Design (`TFX/src/Design/`)

#### `XDesignElement`
- Thin abstract bridge from `XPersistableElement` to visual hierarchy. No additional logic.

#### `XRectangle`
- Extends `XDesignElement`.
- Properties: `Bounds (XRect)`, `MinWidth/MinHeight/MaxWidth/MaxHeight`, `RadiusX/RadiusY`, `Fill (XColor)`, `Stroke (XColor)`, `StrokeThickness`, `Shadow`, `Cursor`, `Alignment`, `IsVisible`, `Opacity`, `ZIndex`, `Name`, `Description`, `Tag`.
- Computed: `X`, `Y`, `Width`, `Height`, `Right`, `Bottom`, `Center`.
- Mutators: `MoveTo(x, y)`, `ResizeTo(w, h)`, `Inflate(dx, dy)`, `Intersects(rect)`.

#### `XLine`
- Extends `XDesignElement`.
- Properties: `Source (string — Element ID)`, `Target (string — Element ID)`, `Points (XPoint[])`, `Stroke (XColor)`, `StrokeThickness`, `LineCap`, `LineJoin`, `IsDashed`.
- Source/Target are stored as `XLinkData` children — use `Source` / `Target` getters/setters, not raw data access.

#### `XField`
- Extends `XRectangle`.
- Properties: `Index`, `DataType`, `IsRequired`, `DefaultValue`, `Length`, `Scale`, `Description`.

#### `XDocument<T>`
- Generic base for domain documents. Owns `PDesign: T | null`.
- `get Design(): T | null` — the primary access point.

#### `XDesign`
- Abstract base for visual canvases. Extends `XRectangle`.
- Owns the `XRouter` instance (lazy init).
- `RouteAllLines(options?)`: routes every `XLine` in the canvas.
- `RouteLine(line, obstacles?, options?)`: routes a single line.
- `DefaultGap: number` (default 20px) — minimum gap from elements.

#### `XRouter`
- Implements the orthogonal line-routing algorithm.
- Routing rules (extracted from `XORMDesign` comments):
  - Source ALWAYS exits horizontally (left or right), aligned with the FK field vertically.
  - Target can receive from any side (L, R, T, B).
  - Target entry point is distributed to prevent congestion (15px spacing between connections).
  - Routes: L-shape, C-shape, or Vertical.
  - Minimum segment: 30px horizontal at source, 30px at target approach.
  - Collision avoidance: routes around other table rectangles.

### 3.3 Data (`TFX/src/Data/`)

#### `XSerializationEngine`
- Singleton (`XSerializationEngine.Instance`) or configured via `XSerializationEngine.Configure(config)`.
- `Serialize<T>(element, options?)`: returns `XISerializationResult<string>`.
- `Deserialize<T>(xml, constructor, options?)`: returns `XISerializationResult<T>`.
- Hooks: `RegisterHook(name, hook)` — `BeforeSerialize`, `AfterSerialize`, `BeforeDeserialize`, `AfterDeserialize`, `OnError`.
- Custom serializers: `RegisterCustomSerializer(tagName, serializer)`.
- Config: `XIEngineConfiguration` with `SerializationOptions`, `WriterOptions`, `ReaderOptions`.

#### `XElementRegistry`
- Singleton (`XElementRegistry.Instance`).
- `Register(registration)`: maps `TagName -> Constructor + ClassID + metadata`.
- `RegisterChildTag(parentTag, childTag)`: declares valid parent-child relationships.
- `RegisterProperty(tagName, property, asAttribute?)`: links `XProperty` to a registered element.
- **All ORM element types MUST be registered by calling `RegisterORMElements()` before any serialization.**

#### `XmlReader` / `XmlWriter`
- Low-level XML parsing/generation — used exclusively by `XSerializationEngine`.
- Do not use them directly; go through the engine.

#### `XSerializationContext`
- Tracks state during a serialization pass (direction, phase, current element, errors, resolved refs).

#### `XTypeConverter`
- Converts `XGeometry` value types (XRect, XPoint, XColor, etc.) to/from string for XML persistence.

### 3.4 Config (`TFX/src/Config/`)

#### `XConfigurationManager`
- Singleton: `XConfigurationManager.GetInstance()`.
- Requires an `XIFileSystemAdapter` injected via `SetFileSystem(adapter)` before use.
- `GetConfiguration<T>(target, group, contextPath)`: async — searches filesystem hierarchically.
- Search algorithm:
  1. Memory cache (key: `Target:Group:ResolvedPath`).
  2. Walk directories from `contextPath` upward looking for `.DASE/{Target}.{Group}.json`.
  3. Stop at repo root (`.git` folder or drive root).
  4. If not found: create `.DASE/` at repo root with default config, return default.
- `InvalidateCache(target?, group?)`: clears cache.

#### `XConfigTarget` (enum)
- `ORM`, `UI` (future), `Flow` (future), `API` (future).

#### `XConfigGroup` (enum)
- `DataType` maps to `ORM.DataType.json`.
- `Validation` maps to `ORM.Validation.json` (future).
- `Naming` maps to `ORM.Naming.json` (future).

#### `XORMTypesConfig`
- `Types: XORMDataTypeInfo[]` — each entry has `TypeName`, `CanUseInPK`, `HasLength`, `HasScale`, `CanUseInIndex`, `IsUTF8`, `CanAutoIncrement`.
- This JSON file lives in `.DASE/ORM.DataType.json` at repo/project root.

#### `XFileSystemAdapters`
- `XNodeFileSystemAdapter`: Node.js filesystem implementation (used in TFX tests).
- `XVsCodeFileSystemAdapter` (DASE): uses VS Code workspace filesystem API.
- **Always inject via `SetFileSystem()` — never instantiate adapters inside TFX core.**

### 3.5 Designers/ORM (`TFX/src/Designers/ORM/`)

#### `XORMDocument`
- Extends `XDocument<XORMDesign>`.
- Constructor creates exactly one `XORMDesign` and appends it.
- `Initialize()`: called after deserialization — merges duplicate `XORMDesign` children (handles round-trip edge cases).
- External code accesses the design **only** via `document.Design`.
- **Never** call `new XORMDesign()` from outside and push it manually.

#### `XORMDesign`
- Extends `XDesign`.
- Registered property: `Schema (string)` — default `"dbo"`.
- Factory methods (the **only** valid way to create children):
  - `CreateTable(options?: XICreateTableOptions): XORMTable`
  - `RemoveTable(tableOrId: XORMTable | string): boolean`
  - `CreateReference(options: XICreateReferenceOptions): XORMReference`
  - `RemoveReference(refOrId: XORMReference | string): boolean`
- `GetTableByID(id): XORMTable | null`, `GetTables(): XORMTable[]`, `GetReferences(): XORMReference[]`.
- `GetChildrenOfType<T>(ctor): T[]` — typed child accessor.
- `Initialize()`: sets up table listeners after deserialization (routes lines).
- Routing comment block in source — read before modifying routing logic.
- Anti-congestion: distributes multiple connections on the same side with 15px spacing.

#### `XORMTable`
- Extends `XRectangle`.
- Registered property: `PKType (string)` — default `"Int32"`.
- Factory methods:
  - `CreatePKField(options?: XICreatePKFieldOptions): XORMPKField` — idempotent (returns existing if already present).
  - `EnsurePKField(): XORMPKField` — ensures PK exists; called during validation.
  - `CreateField(options?: XICreateFieldOptions): XORMField`
  - `RemoveField(fieldOrId: XORMField | string): boolean`
- Query methods: `GetPKField(): XORMPKField | null`, `HasPKField(): boolean`, `GetFields(): XORMField[]`.

#### `XORMField`
- Extends `XField`.
- Additional properties: `IsAutoIncrement (boolean)`, `IsNullable (boolean)`.
- `IsNullable` and `IsRequired` are **synchronized**: setting one updates the other automatically.
- `IsPrimaryKey: boolean` — always `false` for `XORMField`; `XORMPKField` overrides to `true`.
- `GetReference(): XORMReference | null` — returns the reference where this field is the FK source.

#### `XORMPKField`
- Extends `XORMField`.
- `DEFAULT_PK_DATA_TYPE = "Int32"`, `DEFAULT_PK_NAME = "ID"`.
- `DataType` is locked after creation (set via constructor defaults; `_DataTypeLocked` guards mutations).
- `IsRequired` is always `true` — cannot be set to `false`.
- `IsPrimaryKey` always returns `true`.
- Valid PK DataTypes come from `ORM.DataType.json` with `CanUseInPK: true`.

#### `XORMReference`
- Extends `XLine`.
- Represents a FK to PK relationship.
- `Source`: FK field ID (`XORMField.ID`).
- `Target`: target table ID (`XORMTable.ID`).
- Creation only via `XORMDesign.CreateReference(options)`.

#### `XORMController`
- Stateful coordinator between the extension and TFX ORM operations.
- Exposes `Document: XORMDocument | null`, `Design: XORMDesign | null`.
- Operation dispatch: `Execute(operation: XIORMOperation): XIOperationResult`.
- Operation types (`XORMOperationType`): `AddTable`, `RemoveTable`, `AddReference`, `RemoveReference`, `AddField`, `RemoveField`, `ReorderField`, `UpdateProperty`, `MoveElement`, `RenameElement`.
- Each operation type has a corresponding payload interface (`XIAddTableData`, `XIAddFieldData`, etc.).
- Return type `XIOperationResult`: `{ Success: boolean; ElementID?: string; Message?: string }`.

#### `XORMValidator`
- Extends `XValidator<XORMDocument, XORMDesign>`.
- Validation rules enforced:
  - Design name must not be empty/GUID-only.
  - Duplicate table names (case-insensitive) produces error.
  - Empty table name produces error.
  - Tables with no fields produces warning.
  - Missing PK field — auto-creates via `EnsurePKField()`.
  - `pkField.DataType` mismatched with `table.PKType` — auto-corrects.
  - Duplicate field names (case-insensitive within table) produces error.
  - Empty field name produces error.
  - References pointing to non-existent source field or target table produces error.
  - At least one table required — otherwise warning.
- `ValidPKTypes: string[]` — must be loaded from `ORM.DataType.json` before validation.

#### `XORMRegistry` — `RegisterORMElements()`
- Must be called **exactly once** before any serialization.
- Idempotent (guarded by `_Registered` flag).
- Registrations: `XORMDocument`, `XORMDesign`, `XORMTable`, `XORMField`, `XORMPKField`, `XORMReference`.
- Child tag rules mirror the ORM hierarchy.
- Called inside `XTFXBridge` constructor.

---

## 4. DASE Extension — Full Module Reference

### 4.1 Activation (`DASE/src/ExtensionMain.ts`)

- `activate(context)`:
  1. Initialize `LogService`.
  2. Register `XORMDesignerEditorProvider` (custom editor for `.dsorm` files).
  3. Register all commands.
  4. Register `XIssuesViewProvider` and `XPropertiesViewProvider`.
- `deactivate()`: logs deactivation only. Cleanup is handled by VS Code disposing the registered providers.

### 4.2 Commands

All commands follow the same pattern:
```typescript
export class XMyCommand
{
    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): void
    {
        const cmd = vscode.commands.registerCommand("Dase.MyCommand", () =>
        {
            // Delegate to provider or bridge — no domain logic here
        });
        pContext.subscriptions.push(cmd);
    }
}
```

**Commands MUST NOT** contain domain logic — they only orchestrate.

| Command ID | Class | Purpose |
|------------|-------|---------|
| `Dase.NewORMDesigner` | `XNewORMDesignerCommand` | Creates a new `.dsorm` file |
| `Dase.OpenORMDesigner` | `XOpenORMDesignerCommand` | Opens an existing `.dsorm` file |
| `Dase.AddTable` | `XAddTableCommand` | Delegates add-table to active provider |
| `Dase.AddField` | `XAddFieldCommand` | Delegates add-field to active provider |
| `Dase.AlignLines` | `XAlignLinesCommand` | Re-routes all lines in active design |
| `Dase.ValidateORMModel` | `XValidateORMModelCommand` | Triggers validation, publishes issues |
| `Dase.DeleteSelected` | `XDeleteSelectedCommand` | Delegates delete-selected to active provider |
| `Dase.RenameSelected` | `XRenameSelectedCommand` | Requests rename from webview |
| `Dase.ReloadDataTypes` | `XReloadDataTypesCommand` | Invalidates config cache, reloads ORM types |

### 4.3 Designers/ORM (`DASE/src/Designers/ORM/`)

#### `XORMDesignerEditorProvider`
- Implements `vscode.CustomEditorProvider<ICustomDocument>`.
- Registered as `ViewType = "Dase.ORMDesigner"` for `.dsorm` files.
- Maintains three `Map<string, ...>` keyed by URI string:
  - `_Webviews`: active `WebviewPanel` instances.
  - `_States`: `XORMDesignerState` instances (per document).
  - `_Documents`: `ICustomDocument` instances.
- `_LastActiveKey`: tracks the most recently active designer.
- `HandleMessage(key, message)`: routes incoming webview messages to state methods.
- Message routing is exhaustive — unknown message types are rejected/logged.
- All webview message payloads are validated before processing.

#### `ORMDesignerMessages.ts` — `XDesignerMessageType`
Complete set of typed message identifiers:

| Message | Direction | Purpose |
|---------|-----------|---------|
| `DesignerReady` | Webview to Ext | Webview canvas initialized |
| `LoadModel` | Ext to Webview | Send full model data |
| `ModelLoaded` | Webview to Ext | Confirm model rendered |
| `SaveModel` | Webview to Ext | Request save (triggers persistence) |
| `SelectElement` | Webview to Ext | Element click/selection |
| `SelectionChanged` | Ext to Webview | Reflect selection update |
| `AddTable` | Webview to Ext | Drop table on canvas |
| `AddField` | Webview to Ext | Add field to table |
| `MoveElement` | Webview to Ext | Table drag |
| `ReorderField` | Webview to Ext | Drag field up/down |
| `DragDropAddRelation` | Webview to Ext | Draw FK line |
| `DeleteSelected` | Both directions | Delete selected element |
| `RenameSelected` | Ext to Webview | Trigger inline rename |
| `UpdateProperty` | Webview to Ext | Property panel edit |
| `PropertiesChanged` | Ext to Webview | Refresh properties panel |
| `ValidateModel` | Ext to Webview | Trigger validation pass |
| `IssuesChanged` | Ext to Webview | Push validation results |
| `RequestRename` | Ext to Webview | Open inline rename input |
| `RenameCompleted` | Webview to Ext | Rename confirmed |
| `AlignLines` | Ext to Webview | Re-route all lines |
| `ReloadDataTypes` | Ext to Webview | Reload ORM type list |
| `DataTypesReloaded` | Ext to Webview | Confirm reload complete |

**All messages** are plain objects with a `Type: TDesignerMessageType` discriminant and optional `Payload: unknown`.  
**Extension must validate** `Payload` shape before trusting any field.

#### `XORMDesignerState`
- Per-document state container.
- Owns `XTFXBridge`, `IsDirty`, `_LastIssues`, `_OnStateChanged`.
- `IsDirty` setter fires `_OnStateChanged` event.
- Delegates all operations to `XTFXBridge`.
- Surfaces `IssueService` and `SelectionService` from global singletons.

### 4.4 Services (`DASE/src/Services/`)

#### `XTFXBridge` — TFX Integration Layer
- Instantiated once per `XORMDesignerState`.
- Creates and owns: `XORMController`, `XSerializationEngine`, `XORMValidator`, `XConfigurationManager`.
- Injects `XVsCodeFileSystemAdapter` into config manager at construction.
- Entry points:
  - `LoadFromJson(json, fsPath)`: deserializes `.dsorm` JSON into TFX model.
  - `SaveToJson()`: serializes TFX model to JSON string.
  - `ExecuteOperation(op)`: delegates to `XORMController.Execute(op)`.
  - `ValidateModel()`: runs `XORMValidator`, returns `XIssueItem[]`.
  - `BuildModelData()`: converts TFX model to plain `IModelData` for webview transfer.
  - `BuildPropertiesFor(elementId)`: returns `XPropertyItem[]` for the properties panel.

`XTFXBridge` is the **only file in DASE that imports TFX by name**.  
All other DASE files use the `IModelData`/`ITableData`/`IFieldData` JSON interfaces for webview interop.

#### `XIssueService`
- Singleton: `GetIssueService()`.
- Stores `XIssueItem[]` and fires `OnIssuesChanged: vscode.Event<XIssueItem[]>`.
- `SetIssues(issues)`, `AddIssue(issue)`, `Clear()`.
- `GetIssuesForElement(elementID)`: filtered lookup.
- `ErrorCount`, `WarningCount` computed properties.

#### `XSelectionService`
- Singleton: `GetSelectionService()`.
- Stores `XDesignerSelection` and fires `OnSelectionChanged: vscode.Event<XDesignerSelection>`.
- `Select(id)`, `SelectMultiple(ids)`, `ToggleSelection(id)`, `Clear()`.
- `SelectedIDs: string[]`, `PrimaryID: string | null`, `HasSelection: boolean`.

#### `LogService` — `XLogService`
- Singleton: `GetLogService()` / `InitializeLogService(context)`.
- `Info(msg)`, `Warn(msg)`, `Error(msg, err?)`.
- Outputs to a VS Code output channel named `"DASE"`.

#### `XVsCodeFileSystemAdapter`
- Implements `XIFileSystemAdapter` from TFX `Config` module.
- Uses `vscode.workspace.fs` API.
- Injected into `XConfigurationManager` inside `XTFXBridge`.

### 4.5 Models (`DASE/src/Models/`)

#### `XPropertyItem`
- `Key`, `Name`, `Value`, `Type (TPropertyType)`, `Options`, `IsReadOnly`, `Category`, `Group`.
- `XPropertyType`: `String | Number | Boolean | Enum | Color | Rect`.

#### `XIssueItem`
- `ElementID`, `ElementName`, `Severity (TIssueSeverity)`, `Message`, `PropertyID?`.
- `XIssueSeverity`: `Error = 2`, `Warning = 1`, `Info = 0`.
- Computed: `SeverityText`, `Icon`.

#### `XDesignerSelection`
- `SelectedIDs: string[]`, `PrimaryID: string | null`, `HasSelection: boolean`.
- `Set(id)`, `SetMultiple(ids)`, `Toggle(id)`, `Clear()`.

### 4.6 Views (`DASE/src/Views/`)

#### `XIssuesViewProvider`
- `TreeDataProvider<XIssueItem>`.
- Subscribes to `IssueService.OnIssuesChanged`.
- Groups issues by severity (errors first, then warnings).
- Static `Register(context)`.

#### `XPropertiesViewProvider`
- `WebviewViewProvider`.
- Renders a simple HTML form with the properties of the selected element.
- Subscribes to `SelectionService.OnSelectionChanged`.
- Delegates property reads to `XTFXBridge.BuildPropertiesFor(elementId)` via the active `XORMDesignerState`.

---

## 5. ORM Object Model — Invariants & Lifecycle

### 5.1 Creation Entry Points (Mandatory)

| Object | Created By | Prohibited Creation Pattern |
|--------|-----------|----------------------------|
| `XORMDocument` | `new XORMDocument()` | Fine — this is the root |
| `XORMDesign` | `XORMDocument` constructor | `new XORMDesign()` outside document |
| `XORMTable` | `XORMDesign.CreateTable()` | `new XORMTable()` + manual push |
| `XORMField` | `XORMTable.CreateField()` | `new XORMField()` + manual push |
| `XORMPKField` | `XORMTable.CreatePKField()` / `EnsurePKField()` | `new XORMPKField()` + manual push |
| `XORMReference` | `XORMDesign.CreateReference()` | `new XORMReference()` + manual push |

### 5.2 Deletion Entry Points (Mandatory)

| Object | Removed By |
|--------|-----------|
| `XORMTable` | `XORMDesign.RemoveTable(tableOrId)` |
| `XORMField` | `XORMTable.RemoveField(fieldOrId)` |
| `XORMPKField` | `XORMTable.RemoveField(pkFieldOrId)` (same method) |
| `XORMReference` | `XORMDesign.RemoveReference(refOrId)` |

Deletion MUST cascade correctly: removing a table removes its fields and any references that use those fields.

### 5.3 Single PK Rule

Every `XORMTable` MUST have **exactly one** `XORMPKField`.  
`CreatePKField()` is idempotent — calling it when one already exists returns the existing instance.  
`EnsurePKField()` is called automatically by `XORMValidator` during validation.

### 5.4 Reference Integrity

`XORMReference.Source` must be the ID of an existing `XORMField` (FK field) within an `XORMTable`.  
`XORMReference.Target` must be the ID of an existing `XORMTable`.  
`XORMValidator` checks both; dangling references produce errors.

### 5.5 IsNullable / IsRequired Invariant

On `XORMField`:
- `IsNullable = true` is equivalent to `IsRequired = false`.
- `IsNullable = false` is equivalent to `IsRequired = true`.
- Setting either automatically syncs the other (done inside property setters).

On `XORMPKField`:
- `IsRequired` is always `true` — cannot be set to `false`.
- `IsNullable` is always `false`.

---

## 6. TFX Property System

### 6.1 Registration Rule

Properties are registered as **static class members**. Each registration requires a **globally unique GUID**.

```typescript
public static readonly MyProp = XProperty.Register<XMyClass, MyType>(
    (p: XMyClass) => p.MyPropValue,    // property selector (used for name inference)
    "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",  // UNIQUE GUID — never duplicate
    "MyPropValue",                     // internal key (matches getter name)
    "My Prop Display Name",            // human-readable label for Properties panel
    defaultValue                       // typed default value
);
```

GUID ranges reserved for TFX built-in properties:
- `00000001-0001-0001-0001-XXXXXXXXXXXX` — `XPersistableElement`
- `00000001-0001-0001-0003-XXXXXXXXXXXX` — `XRectangle`
- `00000001-0001-0001-0004-XXXXXXXXXXXX` — `XLine` / `XField`
- `00000001-0002-0001-0001-XXXXXXXXXXXX` — `XDesign`
- `00000001-0002-0002-XXXX-XXXXXXXXXXXX` — `XDocument`
- `00000001-0002-0003-XXXX-XXXXXXXXXXXX` — ORM objects

**New user-defined properties must use fresh UUID v4 values outside these reserved ranges.**

### 6.2 Access Pattern

```typescript
public get MyPropValue(): MyType
{
    return this.GetValue(XMyClass.MyProp) as MyType;
}

public set MyPropValue(pValue: MyType)
{
    this.SetValue(XMyClass.MyProp, pValue);
}
```

Never access the internal value store directly. Always use `GetValue` / `SetValue`.

### 6.3 Link Properties

```typescript
public static readonly SourceProp = XProperty.RegisterLink<XMyLine>(
    (p: XMyLine) => p.Source,
    "...", "Source", "Source Element ID", XGuid.EmptyValue
);
```

Link properties store Element IDs, not object references. Resolution happens at runtime or during `Initialize()`.

---

## 7. TFX Serialization Engine

### 7.1 Round-Trip Contract

Serialization format is **XML** (not JSON — the `.dsorm` file is XML wrapped/stored as JSON by `XTFXBridge`).

The same TFX model MUST always produce identical XML output (deterministic ordering).  
When changing serialization format: add a migration strategy and preserve old-format reading.

### 7.2 Registration Requirement

Before deserializing, call `RegisterORMElements()` once. Without this, the registry has no constructors to instantiate.

### 7.3 Engine API

```typescript
const engine = XSerializationEngine.Instance;

// Serialize
const result = engine.Serialize(document, { indent: true });
if (result.Success) { const xml = result.XmlOutput; }

// Deserialize
const result2 = engine.Deserialize<XORMDocument>(xmlString, XORMDocument);
if (result2.Success) { const doc = result2.Data; }
```

### 7.4 Post-Deserialization

Always call `document.Initialize()` after successful deserialization. This resolves link references and, for `XORMDocument`, merges duplicate design nodes.

---

## 8. TFX Configuration Manager

### 8.1 Initialization

```typescript
const manager = XConfigurationManager.GetInstance();
manager.SetFileSystem(myAdapter);
```

### 8.2 Usage

```typescript
const config = await manager.GetConfiguration<XORMTypesConfig>(
    XConfigTarget.ORM,
    XConfigGroup.DataType,
    "/path/to/design/file.dsorm"
);
const validTypes = config?.Types ?? [];
```

### 8.3 Cache Management

- Cache is keyed by `Target:Group:ResolvedPath`.
- `InvalidateCache()` clears everything.
- `InvalidateCache(target, group)` clears a specific entry.
- Called by `XReloadDataTypesCommand` when user triggers reload.

### 8.4 Default Configuration

If no `.DASE/ORM.DataType.json` is found, the manager creates one at repo root.  
Default types are defined in `XConfigResources` (embedded JSON resource strings in TFX).

---

## 9. TFX Validation System

### 9.1 `XValidator<TDocument, TDesign>` — Abstract Base

Override:
- `GetDesign(document): TDesign | null`
- `GetDocumentID(document): string`
- `GetDocumentName(document): string`
- `ValidateDesign(design): void`
- `ValidateElements(design): void`

Helper methods: `AddError(id, name, msg, property?)`, `AddWarning(id, name, msg, property?)`.

Result: `GetIssues(): XIValidationIssue[]`.

### 9.2 Issue Severity

| Value | Enum | Meaning |
|-------|------|---------|
| 2 | `XDesignerErrorSeverity.Error` | Blocks generation/export |
| 1 | `XDesignerErrorSeverity.Warning` | Advisory, not blocking |

### 9.3 DASE Issue Mapping

`XTFXBridge.ValidateModel()` converts `XIValidationIssue[]` (TFX) to `XIssueItem[]` (DASE).  
`XIssueService.SetIssues(items)` publishes them.  
`XIssuesViewProvider` renders them in the Issues tree view.

---

## 10. TFX Event & Dispatch System

### 10.1 `XEvent<THandler>`

```typescript
// Declare on class
private readonly _OnChanged = new XEvent<(pElement: XORMTable) => void>();

// Expose
public get OnChanged() { return this._OnChanged; }

// Subscribe
design.OnChanged.Add(handler);
design.OnChanged.Remove(handler);

// Fire
this._OnChanged.Invoke(this);
```

### 10.2 `XDispatcher`

```typescript
// Synchronous — use for immediate, single-call dispatch
XDispatcher.Execute(() => { ... });

// Asynchronous — use for deferred UI updates (microtask queue)
XDispatcher.ExecuteAsync(() => { ... });
```

---

## 11. TFX Geometry & Visual Model

### 11.1 Value Types

| Type | Properties | Parse | Serialize |
|------|-----------|-------|-----------|
| `XRect` | `X, Y, Width, Height` | `XRect.Parse(str)` | `rect.ToString()` |
| `XPoint` | `X, Y` | `XPoint.Parse(str)` | `point.ToString()` |
| `XSize` | `Width, Height` | `XSize.Parse(str)` | `size.ToString()` |
| `XColor` | `R, G, B, A` | `XColor.Parse(str)` | `color.ToString()` |
| `XThickness` | `Left, Top, Right, Bottom` | `XThickness.Parse(str)` | `t.ToString()` |

All value types are **mutable reference objects** — use `.Clone()` when you need an independent copy.

### 11.2 `XColor` Named Values
`XColor.Black`, `XColor.White`, `XColor.Transparent`, `XColor.Red`, `XColor.Blue`, `XColor.Green`.

### 11.3 Enumerations (Geometry)
- `XAlignment`: bitfield — `Left | Right | Top | Bottom | Client` combinations.
- `XTextAlignment`: `TopLeft` through `BottomRight | Center`.
- `XFontStyle`: `Normal | Bold | Italic | BoldItalic`.
- `XLineCap`: `Flat | Round | Square`.
- `XLineJoin`: `Miter | Bevel | Round`.
- `XCursor`: `Default` through `Grabbing`.

---

## 12. TFX Routing System

### 12.1 Rules (from `XORMDesign` source)

1. **Source exits horizontally** — always left or right, aligned with FK field vertical center.
2. **Target receives from any side** — determined by relative positions; entry point is distributed.
3. **No diagonal segments** — all segments are strictly horizontal or vertical.
4. **Minimum segment lengths**: 30px from source, 30px before target.
5. **Minimum gap**: 20px clearance from table edges.
6. **Route shapes**: L-shape (side-to-side), C-shape (vertical alignment avoidance), Vertical (top/bottom).
7. **Anti-congestion**: multiple connections on same side distributed at 15px intervals.
8. **Collision avoidance**: routes that pass through other tables are redirected.

### 12.2 API

```typescript
// Route all lines
design.RouteAllLines({ Gap: 20, CheckCollision: true });

// Route a single line
design.RouteLine(reference, obstacles, { Gap: 20 });
```

---

## 13. DASE Webview Message Protocol

### 13.1 Security Contract

All messages from the webview are **untrusted external input**.

Mandatory validation for every inbound message:
- Check `typeof message.Type === "string"`.
- Verify `message.Type` against the `XDesignerMessageType` allowlist — reject unknowns.
- Validate `Payload` shape — check required fields exist and are the expected type.
- Reject oversized payloads (enforce maximum size if large blobs are possible).
- Never `eval()` or `new Function()` with any payload string.
- Never execute or call any dynamic code derived from webview messages.

### 13.2 Message Shape

```typescript
interface IDesignerMessage {
    Type: TDesignerMessageType;
    Payload?: unknown;
}
```

Every payload interface is defined inside `XORMDesignerEditorProvider` (e.g., `IAddTablePayload`, `IMoveElementPayload`).

### 13.3 Extension to Webview

```typescript
panel.webview.postMessage({ Type: XDesignerMessageType.LoadModel, Payload: modelData });
```

### 13.4 Webview to Extension

The webview must only send messages with types from `XDesignerMessageType`. Any other type MUST be silently ignored on the extension side.

---

## 14. DASE State & Bridge Layer

### 14.1 State Ownership

```
XORMDesignerEditorProvider
    ._States: Map<uri, XORMDesignerState>
        XORMDesignerState
            ._Bridge: XTFXBridge
                ._Controller: XORMController
                    ._Document: XORMDocument (TFX)
```

One `XORMDesignerState` per open document. Disposed when the document is closed.

### 14.2 Operation Flow

```
Provider.HandleMessage("AddTable", { X, Y, Name })
  -> State.AddTable(X, Y, Name)
  -> Bridge.AddTable({ X, Y, Name })
  -> Controller.Execute({ Type: "AddTable", Data: { X, Y, Name } })
  -> Design.CreateTable({ X, Y, Name })  [TFX mutation]
  -> Bridge.BuildModelData()              [TFX to JSON]
  -> Provider sends "LoadModel" to webview
  -> State.IsDirty = true
```

### 14.3 Persistence

Save flow:
```
Webview sends "SaveModel"
  -> Provider.saveCustomDocument()
  -> State.Save()
  -> Bridge.SaveToJson()      (TFX -> XML -> JSON wrapper)
  -> vscode.workspace.fs.writeFile()
  -> State.IsDirty = false
```

---

## 15. DASE Services Reference

All services are **module-level singletons** initialized at extension activation.

| Service | Singleton Getter | Role |
|---------|-----------------|------|
| `XIssueService` | `GetIssueService()` | Validation issue store + events |
| `XSelectionService` | `GetSelectionService()` | Selection state + events |
| `XLogService` | `GetLogService()` | VS Code output channel |

Services expose `vscode.Event<T>` for reactive subscriptions.  
Views subscribe at registration time and refresh their trees/panels on events.

---

## 16. Naming Conventions

| Entity | Pattern | Example |
|--------|---------|---------|
| Classes | `X` prefix + `PascalCase` | `XORMTable`, `XDesignElement` |
| Interfaces | `XI` prefix + `PascalCase` | `XICreateTableOptions`, `XIValidationIssue` |
| Abstract classes | `X` prefix + `PascalCase` | `XElement`, `XDesign` |
| Enums | `X` prefix + `PascalCase` | `XPropertyGroup`, `XConnectionSide` |
| `const` objects (type maps) | `X` prefix + `PascalCase` | `XDesignerMessageType`, `XPropertyType` |
| Static property descriptors | `PascalCase` + `Prop` suffix | `XORMTable.PKTypeProp` |
| Private fields | `_` prefix + `PascalCase` | `_Controller`, `_Registry` |
| Method parameters | `p` prefix + `PascalCase` | `pDocument`, `pOptions`, `pTableID` |
| Local variables | Short lowercase mnemonic | `doc`, `tbl`, `fld`, `ref`, `res` |
| File names | Match the primary exported class/interface | `XORMDocument.ts`, `IssueService.ts` |
| Test files | `{Subject}.test.ts` | `XORMDesign.test.ts` |

### 16.1 Abbreviation Rules

Preserve acronyms in UPPERCASE in all contexts:
- `pUserID` not `pUserId`
- `GetByURL` not `GetByUrl`
- `LoadFromDB` not `LoadFromDb`
- `XORMDocument` not `XOrmDocument`
- `XGuid` follows the framework convention as-is

### 16.2 Type Alias Pattern

`const` object type unions use a `T` prefix for the `typeof` alias:
```typescript
export const XDesignerMessageType = { ... } as const;
export type TDesignerMessageType = typeof XDesignerMessageType[keyof typeof XDesignerMessageType];
```

---

## 17. Code Style — TypeScript

### 17.1 Single Type per File

Each `.ts` file exports **one primary type** (class, interface, enum, or const object). Its filename must match.

### 17.2 Braces

```typescript
// CORRECT — no braces for single-statement blocks
if (!table) return null;
for (const field of fields) names.add(field.Name.toLowerCase());

// WRONG
if (!table) { return null; }
```

### 17.3 Early Returns

Always guard preconditions at the top. Avoid deeply nested `if` blocks.

```typescript
public CreateTable(pOptions?: XICreateTableOptions): XORMTable
{
    if (!pOptions) pOptions = {};
    if (!pOptions.Name) pOptions.Name = "NewTable";
    // proceed with guaranteed state
}
```

### 17.4 No Lambdas on Hot Paths

Avoid anonymous functions, `Func`-style delegates, and LINQ-style chaining on frequently used code paths.

```typescript
// WRONG on hot path
const names = tables.map(t => t.Name.toLowerCase());

// CORRECT on hot path
const names: string[] = [];
for (const t of tables) names.push(t.Name.toLowerCase());
```

Exception: one-time setup, configuration, or event subscriptions where performance is not critical.

### 17.5 No Comments in Code

Code MUST be self-explanatory. Only exception: XML-Doc `/** ... */` blocks for public APIs describing *what* (not *how*).

Remove `console.log` statements before merging — log through `XLogService` instead.

### 17.6 Type Assertions

Prefer type guards over casts. When casting is necessary, use `as Type` — never `<Type>value`.

```typescript
// Prefer
if (child instanceof XORMTable) { child.PKType; }

// Minimal acceptable cast (only when type is certain)
const table = this.GetChildByID(id) as XORMTable;
```

### 17.7 `readonly` Where Possible

```typescript
private readonly _Handlers: Set<THandler> = new Set();
public readonly ChildNodes: XElement[] = [];
```

### 17.8 Prefer `for...of` Over `forEach`

`forEach` uses a callback closure. `for...of` has no closure overhead.

### 17.9 String Concatenation

Never concatenate in loops with `+`. Accumulate in an array and `join()`, or use template literals for simple cases.

### 17.10 `null` vs `undefined`

- TFX prefers `null` for "not set" on reference types.
- Use `?` parameter suffix for optional parameters.
- Use explicit `| null` return type when a method can return null.

---

## 18. Quality, Design & SOLID

### 18.1 SOLID (Mandatory)

- **S — Single Responsibility:** one class, one reason to change.
- **O — Open/Closed:** extend via inheritance/interfaces; never modify closed code.
- **L — Liskov Substitution:** subtypes must be substitutable without breaking callers (`XORMPKField` IS-A `XORMField`).
- **I — Interface Segregation:** small focused interfaces (`XICreateTableOptions`, `XIOperationResult`).
- **D — Dependency Inversion:** inject filesystem adapters, validators, trackers — never instantiate inside low-level classes.

### 18.2 Immutability

- Expose collections as `readonly` or return copies:
  ```typescript
  public GetTables(): XORMTable[] { return this.GetChildrenOfType(XORMTable); }  // returns new array
  ```
- Value type instances (`XRect`, `XPoint`, `XColor`) — clone when storing.
- `readonly` on fields set only at construction.

### 18.3 Class Design Intent

When a class is not designed for subclassing, document that intent clearly in JSDoc and do not create subclasses of it. TypeScript has no `sealed` keyword — use convention and documentation.

---

## 19. Performance Rules

### 19.1 Avoid On Hot Paths

- No `.filter()`, `.map()`, `.reduce()` inside loops or frequently-called methods.
- No anonymous function creation on hot paths (avoids closure allocation).
- No `JSON.parse()` / `JSON.stringify()` on every render pass — cache results.

### 19.2 Async

- Use `async/await` for all I/O (filesystem, VS Code API).
- For synchronous operations that look async, return resolved values directly without unnecessary wrapping.

### 19.3 Collection Allocation

- Pre-size arrays when the length is known.
- Use `Set<string>` for existence checks instead of `array.includes()` in O(n) scans.
- Do not materialize large collections until needed.

### 19.4 String Operations

- Use template literals for clarity on simple concatenation.
- For large text assembly (XML, HTML), build arrays and join.

---

## 20. Security Rules

### 20.1 Webview Isolation

- The webview is an untrusted boundary.
- All inbound `postMessage` data MUST be validated before use.
- **Never** `eval()`, `new Function()`, or execute arbitrary code from webview messages.
- Set `localResourceRoots` and `enableScripts: true` only when required.
- Do not pass VS Code API handles into the webview — only serialize data.

### 20.2 File System Access

- All file reads/writes go through `XIFileSystemAdapter` — never use raw `fs` module in TFX.
- In DASE, use `vscode.workspace.fs` through the adapter.
- Validate file paths before constructing them from user input.

### 20.3 Secrets and Credentials

- No secrets, tokens, or connection strings anywhere in source code or config files.
- Configuration files in `.DASE/` are project-local data, not secrets — do not mix.

### 20.4 Input Validation

- All external input (filenames, element names, property values) must be validated against expected patterns before processing.
- Element names must be non-empty strings after trimming.
- Numeric values must be within expected ranges.

---

## 21. Error Handling & Resilience

### 21.1 Fail Fast

Validate inputs at method entry. Throw `XError` with a precise message for contract violations.

```typescript
if (!pTableID) throw new XError("TableID is required.");
```

### 21.2 Don't Swallow Exceptions

```typescript
// WRONG
try { ... } catch { }

// CORRECT — log and rethrow or handle meaningfully
try { ... } catch (err) { log.Error("Failed to load model", err); throw err; }
```

### 21.3 Operation Results

For TFX operations that can legitimately fail (not programming errors), return `XIOperationResult`:
```typescript
return { Success: false, Message: "Table not found." };
```

### 21.4 `null` Return Contracts

Document and respect null return contracts. If a method returns `T | null`, callers MUST check for null.

---

## 22. Testing Standards

### 22.1 Coverage Threshold — Non-Negotiable

Both projects enforce **100% coverage** on `lines`, `branches`, `functions`, and `statements`.  
These thresholds are enforced by CI — the build fails if they drop.

### 22.2 TFX Tests (Vitest)

- Location: `TFX/tests/*.test.ts`
- Runner: `vitest run`
- Coverage: `vitest run --coverage` then output goes to `TFX/coverage/`
- Framework: `describe` / `it` / `expect` from `vitest`.
- Config: `TFX/vitest.config.ts` — include: `tests/**/*.test.ts`, exclude index files.
- No mocks of TFX internals — test through public APIs only.
- Pattern:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
  import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";

  describe("XORMDocument", () => {
      it("should create with a default XORMDesign", () => {
          const doc = new XORMDocument();
          expect(doc.Design).toBeDefined();
          expect(doc.Design).toBeInstanceOf(XORMDesign);
      });
  });
  ```

### 22.3 DASE Tests (Jest + ts-jest)

- Location: `DASE/src/__tests__/**/*.test.ts`
- Runner: `jest`
- Coverage: output goes to `DASE/coverage/`
- Config: `DASE/jest.config.js` — uses `ts-jest` with `tsconfig.test.json`.
- VS Code API mock: `DASE/src/__tests__/__mocks__/vscode.ts`.
- Setup: `DASE/src/__tests__/setup.ts`.
- All VS Code dependencies must be mocked.
- Pattern:
  ```typescript
  import { XORMDesignerState } from "../../Designers/ORM/ORMDesignerState";
  jest.mock("vscode");

  describe("XORMDesignerState", () => {
      it("should initialize with IsDirty = false", () => {
          const state = new XORMDesignerState(mockDocument);
          expect(state.IsDirty).toBe(false);
      });
  });
  ```

### 22.4 Test Quality Rules

- Every test MUST answer: "What failure would this catch, and why would it matter in production?"
- Tests must represent plausible real-world scenarios.
- No test that cannot fail meaningfully.
- Coverage files in separate `*Coverage.test.ts` files are acceptable for edge-case paths.
- `/* v8 ignore start/stop */` annotations are allowed only for truly unreachable defensive code.

### 22.5 Test Organization

| Test file pattern | Purpose |
|------------------|---------|
| `XFoo.test.ts` | Primary behavior tests for `XFoo` |
| `XFooCoverage.test.ts` | Branch/edge-case coverage for `XFoo` |
| `XFooIntegration.test.ts` | Cross-object integration tests |
| `XFooInternalCoverage.test.ts` | Internal state coverage (use sparingly) |

---

## 23. Build & CI/CD

### 23.1 TFX Build

```bash
cd TFX
npm run build          # tsc to dist/
npm run test           # vitest run
npm run test:coverage  # vitest run --coverage
npm run clean          # rimraf dist/
```

### 23.2 DASE Build

```bash
cd DASE
npm run build  # tsc to out/
npm test       # jest to coverage/
```

### 23.3 CI Pipeline (`.github/workflows/ci.yml`)

- Triggers: push or pull_request to `master`.
- Steps:
  1. Checkout.
  2. Node.js 20 setup with `npm` cache.
  3. `npm ci` + `npm run build` + `npm run test:coverage` for **TFX**.
  4. `npm ci` + `npm run build` + `npm test` for **DASE**.
  5. Extract metrics from `test-results.json` and `coverage-summary.json`.
  6. Upload coverage reports as artifacts.
  7. Update README badges.
- **The pipeline MUST stay green.** Never suppress failures to pass CI.
- Failures are signals — they MUST be fixed, not hidden.

### 23.4 Package Export Map

`TFX/package.json` exports:
- `.` maps to `dist/index.js` + `dist/index.d.ts`
- `./Core` maps to `dist/Core/index.js` + types
- `./Design` maps to `dist/Design/index.js` + types

DASE imports TFX as: `import * as tfx from "@tootega/tfx"` (CommonJS CJS).

---

## 24. Anti-Patterns (Prohibited Patterns)

### 24.1 ORM Object Construction Anti-Patterns

```typescript
// NEVER — direct construction bypasses factory invariants
const table = new XORMTable();
design.ChildNodes.push(table);

// ALWAYS — use factory
const table = design.CreateTable({ Name: "Customer" });
```

### 24.2 Direct Collection Mutation

```typescript
// NEVER — mutates internal state from outside
element.ChildNodes.splice(0, 1);

// ALWAYS — use domain method
design.RemoveTable(tableId);
```

### 24.3 Domain Logic in DASE

```typescript
// NEVER — DASE must not contain domain rules
if (table.Name.includes(" ")) { ... } // validation belongs in XORMValidator

// ALWAYS — route through TFX
const issues = bridge.ValidateModel();
```

### 24.4 TFX Importing DASE

```typescript
// NEVER — creates circular dependency
// In TFX/src/...
import { XIssueItem } from "../../../DASE/src/Models/IssueItem"; // FORBIDDEN
```

### 24.5 `console.log` in Production Code

All debug `console.log` statements (including those present in `XORMDocument.Initialize`) MUST be removed before merging. Use `XLogService` in DASE or remove entirely in TFX.

### 24.6 Portuguese in Code

```typescript
// NEVER
const tabela = design.CreateTable(); // Portuguese variable name
// enum XLadoConexao { Esquerda, Direita } // Portuguese enum

// ALWAYS — English only
const table = design.CreateTable();
```

### 24.7 Non-Unique Property GUIDs

```typescript
// NEVER — duplicate GUID causes silent property collision
public static readonly MyProp = XProperty.Register<XFoo, string>(
    (p) => p.Name,
    "00000001-0002-0003-0001-000000000001", // ALREADY USED BY ANOTHER PROP
    ...
);
```

### 24.8 Raw `JSON.parse` on TFX XML Data

The `.dsorm` file format is XML serialized by `XSerializationEngine`. Do not parse it with `JSON.parse` directly; always go through `XTFXBridge.LoadFromJson()` which handles the XML/JSON wrapper.

### 24.9 TFX Referencing VS Code API

```typescript
// NEVER — TFX must be VS Code-agnostic and testable without VS Code
import * as vscode from "vscode"; // FORBIDDEN in TFX
```

### 24.10 Hardcoded GUIDs as IDs for New Elements

```typescript
// NEVER
table.ID = "00000001-0002-0003-0001-000000000001"; // collides with property GUIDs

// ALWAYS
table.ID = XGuid.NewValue(); // fresh UUID v4
```

---

## 25. Extending the Codebase

### 25.1 Adding a New ORM Field Type

1. Create `XMyField.ts` in `TFX/src/Designers/ORM/` extending `XORMField`.
2. Register `XProperty` descriptors with unique GUIDs outside the reserved ranges.
3. Register in `XORMRegistry.RegisterORMElements()`.
4. Add `RegisterChildTag("XORMTable", "XMyField")` in the registry function.
5. Add factory method on `XORMTable` (e.g., `CreateMyField(options)`).
6. Update `XORMValidator` to validate new field type invariants.
7. Write tests in `TFX/tests/XMyField.test.ts` with 100% coverage.
8. Update `XTFXBridge.BuildModelData()` to include new field data.
9. Update webview JS/CSS to render the new field type.

### 25.2 Adding a New ORM Property to an Existing Object

1. Add `public static readonly MyNewProp = XProperty.Register<XFoo, TType>(...)` to `XFoo` with a fresh UUID v4.
2. Add getter/setter using `GetValue` / `SetValue`.
3. Update `XTFXBridge.BuildPropertiesFor()` to include the new property.
4. Add test for get/set in `TFX/tests/XFoo.test.ts`.

### 25.3 Adding a New Operation to `XORMController`

1. Add a new entry to `XORMOperationType` enum.
2. Define `XIMyOperationData` interface.
3. Add a `case XORMOperationType.MyOp:` branch in `Execute()`.
4. Add the corresponding private handler method.
5. Call TFX factory/mutation method — no inline domain logic.
6. Return `XIOperationResult`.
7. Add test in `TFX/tests/XORMController.test.ts`.

### 25.4 Adding a New Webview Message

1. Add the new key to `XDesignerMessageType` in `ORMDesignerMessages.ts`.
2. Define the payload interface in `ORMDesignerEditorProvider.ts`.
3. Add handler in `HandleMessage()`.
4. Validate the payload before using it.
5. Update tests for the new message flow.

### 25.5 Adding a New Designer (UI, Flow, API)

**Prerequisites:** ORM Designer must be stable and fully tested.

1. Create `TFX/src/Designers/UI/` (or Flow/API) with: Document, Design, Registry, Controller, Validator.
2. Create `TFX/src/Designers/UI/index.ts` and export from `TFX/src/Designers/index.ts`.
3. Add `XConfigTarget.UI` support (already declared in enum).
4. Create `DASE/src/Designers/UI/` mirroring the ORM designer structure.
5. Keep ORM-specific and UI-specific code **completely separate** — no shared modules except via TFX base classes.

---

## 26. Philosophical Principles

1. The best code is code that writes itself — guided by clear intent.
2. Any line that cannot be exercised by automated tests should not exist.
3. Truth over optics: refuse metric theater (coverage inflation, artificial branches, cosmetic tests).
4. Coverage is evidence, not a goal — the goal is confidence in behavior under realistic conditions.
5. If a branch is truly unreachable, remove it or mark it with an explicit invariant — do not fabricate a test for it.
6. Unreachable code is a design smell: either the model is wrong, the branch is dead, or the contract is unclear.
7. Prefer deletion to decoration: removing dead paths is higher quality than "covering" them.
8. Tests must represent plausible worlds: a test that cannot occur in production is documentation of fiction.
9. Every test must answer a question: "What failure would this catch, and why would it matter?"
10. Assertions are contracts: validate invariants where they belong, and test through public behavior.
11. Strong contracts reduce defensive noise: less "just in case", more "cannot happen by construction."
12. Write code that is easy to prove: clarity beats cleverness; determinism beats surprises.
13. Prefer domain truth over framework convenience: the model dictates the code, not the other way around.
14. Code is a liability: every added line MUST pay rent (clear value, verified behavior).
15. Make state explicit; implicit state becomes hidden bugs.
16. Optimize for the next reader: the future maintainer is usually you.
17. Complexity must be earned by measurable benefit; simple mechanisms scale best.
18. Fail fast, fail loud: reject invalid input early with precise, actionable errors.
19. Measure before optimizing; optimize only what profiling proves is hot.
20. Security is an invariant, not a feature.
21. Integrity is non-negotiable: do not trade truth for appearance, even when it looks "better" on paper.
22. A green pipeline is not a certificate: it is a signal that must remain honest to keep meaning.

---

## 27. Final Validation Checklist

A change is **only complete** when **ALL** of the following are true:

### Context
- [ ] Change target (TFX or DASE) is explicitly identified.
- [ ] Dependency direction verified (DASE depends on TFX, never TFX on DASE).
- [ ] No Portuguese in identifiers, comments, or JSDoc.
- [ ] No `console.log` statements in production code.

### Architecture
- [ ] ORM elements created only via TFX factory methods (no `new XORMXxx()` + push).
- [ ] Collections not mutated from outside — only through domain methods.
- [ ] No domain logic added to DASE — it belongs in TFX.
- [ ] VS Code API not used inside TFX.

### Code Quality
- [ ] Single type per file; filename matches class/interface name.
- [ ] No braces on single-line blocks.
- [ ] Early returns guard all preconditions.
- [ ] No lambdas/anonymous functions on hot paths.
- [ ] `XProperty` descriptors use globally unique GUIDs.
- [ ] All properties use `GetValue` / `SetValue` — no direct store access.
- [ ] `XGuid.NewValue()` used for new IDs — no hardcoded fake GUIDs.

### Serialization
- [ ] `RegisterORMElements()` called before any serialization.
- [ ] New element types registered in `XElementRegistry` with `RegisterChildTag`.
- [ ] `document.Initialize()` called after deserialization.

### Webview Security
- [ ] All inbound messages validated (type checked + payload shape verified).
- [ ] No `eval()` or `new Function()` with payload data.
- [ ] Unknown message types silently rejected.

### Testing
- [ ] Tests written for all new/changed code.
- [ ] Tests cover positive, negative, and edge cases.
- [ ] Coverage remains at 100% (lines, branches, functions, statements).
- [ ] Tests use `vitest` in TFX, `jest` in DASE.
- [ ] No fabricated tests for truly unreachable code.

### Build & CI
- [ ] `npm run build` passes in both TFX and DASE.
- [ ] `npm run test:coverage` passes in TFX.
- [ ] `npm test` passes in DASE.
- [ ] CI pipeline remains green.

---

*End of TFX + DASE Copilot Guide — Version 2026-02-28.*
