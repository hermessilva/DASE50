/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { GetLogService } from "../Services/LogService";
import type { XORMDesignerEditorProvider } from "../Designers/ORM/ORMDesignerEditorProvider";
import type { XTFXBridge, ITableData } from "../Services/TFXBridge";

/**
 * AgentBridge — Adapter layer between AI agent tools/participants and the DASE extension.
 *
 * Provides a singleton accessor to the active XTFXBridge instance through the
 * XORMDesignerEditorProvider. Translates between AI API contracts and XTFXBridge methods,
 * formatting results as LLM-friendly text.
 *
 * This class ensures that AI agent integrations never need to know about the
 * internals of XTFXBridge or XORMDesignerEditorProvider.
 */
export class XAgentBridge {
    private static _Instance: XAgentBridge | null = null;
    private _Provider: XORMDesignerEditorProvider | null = null;
    private _OrganizationSnapshot: ITableSnapshot[] | null = null;

    private constructor() { }

    static GetInstance(): XAgentBridge {
        if (!XAgentBridge._Instance)
            XAgentBridge._Instance = new XAgentBridge();
        return XAgentBridge._Instance;
    }

    /**
     * Set the active designer editor provider.
     * Called once during extension activation.
     */
    SetProvider(pProvider: XORMDesignerEditorProvider): void {
        this._Provider = pProvider;
    }

    /**
     * Get the active XTFXBridge instance from the active custom editor.
     * Returns null if no ORM designer is currently open.
     */
    private GetActiveBridge(): XTFXBridge | null {
        if (!this._Provider)
            return null;

        const state = this._Provider.GetActiveState();
        return state?.Bridge ?? null;
    }

    /**
     * Check whether an ORM designer is currently active.
     */
    IsDesignerActive(): boolean {
        return this.GetActiveBridge() !== null;
    }

    /**
     * Get a summary of the currently open ORM model.
     * Returns a formatted text description for the LLM.
     */
    GetModelInfo(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            const doc = bridge.Document;
            const design = bridge.Controller?.Design;

            const tableCount = modelData.Tables?.length ?? 0;
            const refCount = modelData.References?.length ?? 0;
            const schema = design?.Schema ?? "dbo";
            const docName = doc?.Name ?? "Unnamed";

            let result = `## ORM Model: ${docName}\n`;
            result += `- **Schema:** ${schema}\n`;
            result += `- **Tables:** ${tableCount}\n`;
            result += `- **References (FK):** ${refCount}\n`;

            if (tableCount > 0) {
                result += `\n### Tables\n`;
                for (const table of modelData.Tables) {
                    const fieldCount = table.Fields?.length ?? 0;
                    const shadowLabel = table.IsShadow ? " _(shadow)_" : "";
                    result += `- **${table.Name}**${shadowLabel} — ${fieldCount} fields\n`;
                }
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetModelInfo failed", err);
            return "Error reading model information.";
        }
    }

    /**
     * List all tables in the current model with optional name filter.
     */
    ListTables(pFilter?: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            let tables: ITableData[] = modelData.Tables ?? [];

            if (pFilter) {
                const lowerFilter = pFilter.toLowerCase();
                tables = tables.filter(t => t.Name.toLowerCase().includes(lowerFilter));
            }

            if (tables.length === 0)
                return pFilter
                    ? `No tables found matching "${pFilter}".`
                    : "The model has no tables.";

            let result = `Found ${tables.length} table(s):\n\n`;
            for (const table of tables) {
                const fieldCount = table.Fields?.length ?? 0;
                const pkField = table.Fields?.find((f: any) => f.IsPrimaryKey);
                const pkInfo = pkField ? ` (PK: ${pkField.Name} ${pkField.DataType})` : "";
                const shadowLabel = table.IsShadow ? " [Shadow]" : "";
                result += `- **${table.Name}**${shadowLabel}${pkInfo} — ${fieldCount} fields\n`;
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ListTables failed", err);
            return "Error listing tables.";
        }
    }

    /**
     * Get detailed information about a specific table by name.
     */
    GetTableDetails(pTableName: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            const table = modelData.Tables?.find(
                (t: ITableData) => t.Name.toLowerCase() === pTableName.toLowerCase()
            );

            if (!table)
                return `Table "${pTableName}" not found. Use the list_tables tool to see available tables.`;

            let result = `## Table: ${table.Name}\n`;
            result += `- **ID:** ${table.ID}\n`;
            if (table.Description)
                result += `- **Description:** ${table.Description}\n`;
            if (table.PKType)
                result += `- **PK Type:** ${table.PKType}\n`;
            if (table.FillProp)
                result += `- **Color:** ${table.FillProp}\n`;
            if (table.IsShadow) {
                result += `- **Shadow Table:** Yes\n`;
                if (table.ShadowDocumentName)
                    result += `- **Source Model:** ${table.ShadowDocumentName}\n`;
                if (table.ShadowTableName)
                    result += `- **Source Table:** ${table.ShadowTableName}\n`;
            }

            result += `\n### Fields (${table.Fields?.length ?? 0})\n`;
            if (table.Fields) {
                result += `| # | Name | Type | PK | FK | Required | AutoInc | Length |\n`;
                result += `|---|------|------|----|----|----------|---------|--------|\n`;
                for (let i = 0; i < table.Fields.length; i++) {
                    const f = table.Fields[i];
                    result += `| ${i + 1} | ${f.Name} | ${f.DataType} | ${f.IsPrimaryKey ? "✓" : ""} | ${f.IsForeignKey ? "✓" : ""} | ${f.IsRequired ? "✓" : ""} | ${f.IsAutoIncrement ? "✓" : ""} | ${f.Length ?? ""} |\n`;
                }
            }

            // Show incoming references (FKs targeting this table)
            const incomingRefs = modelData.References?.filter(
                (r: any) => r.TargetTableID === table.ID
            );
            if (incomingRefs && incomingRefs.length > 0) {
                result += `\n### Incoming References (FK → this table)\n`;
                for (const ref of incomingRefs) {
                    const fieldInfo = bridge.GetElementInfo(ref.SourceFieldID);
                    const fieldLabel = fieldInfo ? `${fieldInfo.Name}` : ref.SourceFieldID;
                    result += `- ${fieldLabel} → ${table.Name}\n`;
                }
            }

            // Show outgoing references (FKs from this table)
            const outgoingRefs = modelData.References?.filter((r: any) => {
                return table.Fields?.some((f: any) => f.ID === r.SourceFieldID);
            });
            if (outgoingRefs && outgoingRefs.length > 0) {
                result += `\n### Outgoing References (this table → FK target)\n`;
                for (const ref of outgoingRefs) {
                    const targetInfo = bridge.GetElementInfo(ref.TargetTableID);
                    const targetLabel = targetInfo ? targetInfo.Name : ref.TargetTableID;
                    const fieldInfo = bridge.GetElementInfo(ref.SourceFieldID);
                    const fieldLabel = fieldInfo ? fieldInfo.Name : ref.SourceFieldID;
                    result += `- ${fieldLabel} → ${targetLabel}\n`;
                }
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetTableDetails failed", err);
            return `Error getting details for table "${pTableName}".`;
        }
    }

    /**
     * Add a new table to the model.
     * Returns a description of the result.
     */
    AddTable(pName: string, pX?: number, pY?: number): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const x = pX ?? 100;
            const y = pY ?? 100;
            const result = bridge.AddTable(x, y, pName);

            if (result.Success)
                return `Table "${pName}" added successfully at position (${x}, ${y}).`;
            else
                return `Failed to add table "${pName}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.AddTable failed", err);
            return `Error adding table "${pName}".`;
        }
    }

    /**
     * Add a field to a table.
     */
    AddField(pTableName: string, pFieldName: string, pDataType: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            const table = modelData.Tables?.find(
                (t: ITableData) => t.Name.toLowerCase() === pTableName.toLowerCase()
            );

            if (!table)
                return `Table "${pTableName}" not found. Use the list_tables tool to see available tables.`;

            const result = bridge.AddField(table.ID, pFieldName, pDataType);

            if (result.Success)
                return `Field "${pFieldName}" (${pDataType}) added to table "${pTableName}" successfully.`;
            else
                return `Failed to add field "${pFieldName}" to "${pTableName}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.AddField failed", err);
            return `Error adding field "${pFieldName}" to "${pTableName}".`;
        }
    }

    /**
     * Add a FK reference between two tables.
     */
    AddReference(pSourceTable: string, pTargetTable: string, pName?: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            const sourceTable = modelData.Tables?.find(
                (t: ITableData) => t.Name.toLowerCase() === pSourceTable.toLowerCase()
            );
            const targetTable = modelData.Tables?.find(
                (t: ITableData) => t.Name.toLowerCase() === pTargetTable.toLowerCase()
            );

            if (!sourceTable)
                return `Source table "${pSourceTable}" not found.`;
            if (!targetTable)
                return `Target table "${pTargetTable}" not found.`;

            const refName = pName || `FK_${pSourceTable}_${pTargetTable}`;
            const result = bridge.AddReference(sourceTable.ID, targetTable.ID, refName);

            if (result.Success)
                return `Reference "${refName}" from "${pSourceTable}" to "${pTargetTable}" created successfully.`;
            else
                return `Failed to create reference: ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.AddReference failed", err);
            return `Error creating reference from "${pSourceTable}" to "${pTargetTable}".`;
        }
    }

    /**
     * Validate the current ORM model.
     */
    ValidateModel(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const issues = bridge.ValidateOrmModel();

            if (issues.length === 0)
                return "✅ Validation passed — no issues found.";

            const errors = issues.filter(i => i.Severity === 2);
            const warnings = issues.filter(i => i.Severity === 1);

            let result = `### Validation Results\n`;
            result += `- **Errors:** ${errors.length}\n`;
            result += `- **Warnings:** ${warnings.length}\n\n`;

            if (errors.length > 0) {
                result += `#### Errors\n`;
                for (const err of errors)
                    result += `- ❌ **${err.ElementName}**: ${err.Message}\n`;
            }

            if (warnings.length > 0) {
                result += `\n#### Warnings\n`;
                for (const warn of warnings)
                    result += `- ⚠️ **${warn.ElementName}**: ${warn.Message}\n`;
            }

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ValidateModel failed", err);
            return "Error running validation.";
        }
    }

    /**
     * Export the model to DBML format.
     */
    ExportToDBML(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const dbml = bridge.ExportToDBML();
            if (!dbml || dbml.trim().length === 0)
                return "The model is empty — nothing to export.";
            return dbml;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ExportToDBML failed", err);
            return "Error exporting to DBML.";
        }
    }

    /**
     * Get properties of a specific element by ID.
     */
    GetProperties(pElementId: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const props = bridge.GetProperties(pElementId);
            if (!props || props.length === 0)
                return `No properties found for element "${pElementId}".`;

            let result = `### Properties\n`;
            result += `| Property | Value | Type | Read-Only |\n`;
            result += `|----------|-------|------|-----------|\n`;
            for (const prop of props)
                result += `| ${prop.Name} | ${prop.Value ?? ""} | ${prop.Type} | ${prop.IsReadOnly ? "✓" : ""} |\n`;

            return result;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetProperties failed", err);
            return `Error getting properties for element "${pElementId}".`;
        }
    }

    /**
     * Update a property on an element.
     */
    UpdateProperty(pElementId: string, pPropertyKey: string, pValue: unknown): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const result = bridge.UpdateProperty(pElementId, pPropertyKey, pValue);
            if (result.Success)
                return `Property "${pPropertyKey}" updated successfully.`;
            else
                return `Failed to update property "${pPropertyKey}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.UpdateProperty failed", err);
            return `Error updating property "${pPropertyKey}".`;
        }
    }

    /**
     * Get all available data types in the configuration.
     */
    GetAvailableDataTypes(): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        const allTypes = bridge.GetAllDataTypes();
        const pkTypes = bridge.GetPKDataTypes();

        let result = `### Available Data Types\n`;
        result += `**All types:** ${allTypes.join(", ")}\n\n`;
        result += `**PK-compatible types:** ${pkTypes.join(", ")}\n`;

        return result;
    }

    /**
     * Convert a CSS hex color (#RRGGBB or #RGB) to TFX ARGB format (FFRRGGBB).
     * XColor.Parse requires exactly 8 hex chars: AARRGGBB, no '#' prefix.
     */
    private CssToTfxColor(pColor: string): string {
        let hex = pColor.trim();
        if (hex.startsWith("#"))
            hex = hex.slice(1);
        // Expand shorthand #RGB → RRGGBB
        if (hex.length === 3)
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        // If already 8 chars (AARRGGBB), return as-is
        if (hex.length === 8)
            return hex.toUpperCase();
        // 6 chars (RRGGBB) → prepend FF for full opacity
        if (hex.length === 6)
            return "FF" + hex.toUpperCase();
        return hex.toUpperCase();
    }

    // ─── Table Positioning & Coloring (Agent Mode) ──────────────────────────

    /**
     * Move a table to a specific position on the canvas (by table name).
     */
    MoveTable(pTableName: string, pX: number, pY: number): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            const table = modelData.Tables?.find(
                (t: ITableData) => t.Name.toLowerCase() === pTableName.toLowerCase()
            );

            if (!table)
                return `Table "${pTableName}" not found.`;

            const result = bridge.MoveElement(table.ID, pX, pY);
            if (result.Success)
                return `Table "${pTableName}" moved to (${pX}, ${pY}).`;
            else
                return `Failed to move table "${pTableName}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.MoveTable failed", err);
            return `Error moving table "${pTableName}".`;
        }
    }

    /**
     * Set the fill color of a table (by table name).
     * Accepts CSS hex colors (#RRGGBB) or ARGB (AARRGGBB).
     */
    SetTableColor(pTableName: string, pColor: string): string {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return "No ORM designer is currently open. Please open a .dsorm file first.";

        try {
            const modelData = bridge.GetModelData();
            const table = modelData.Tables?.find(
                (t: ITableData) => t.Name.toLowerCase() === pTableName.toLowerCase()
            );

            if (!table)
                return `Table "${pTableName}" not found.`;

            const tfxColor = this.CssToTfxColor(pColor);
            const result = bridge.UpdateProperty(table.ID, "Fill", tfxColor);
            if (result.Success)
                return `Table "${pTableName}" color set to ${pColor}.`;
            else
                return `Failed to set color for "${pTableName}": ${result.Message ?? "Unknown error"}.`;
        }
        catch (err) {
            GetLogService().Error("AgentBridge.SetTableColor failed", err);
            return `Error setting color for table "${pTableName}".`;
        }
    }

    /**
     * Trigger the AI-powered table organization (delegates to the OrganizeTablesAI command).
     * Returns a message indicating the command was triggered.
     */
    async OrganizeLayout(): Promise<string> {
        try {
            await (await import("vscode")).commands.executeCommand("Dase.OrganizeTablesAI");
            return "AI organization command has been triggered. Check the progress notification.";
        }
        catch (err) {
            GetLogService().Error("AgentBridge.OrganizeLayout failed", err);
            return `Error triggering AI organization: ${err}`;
        }
    }

    // ─── AI Organization Snapshot ─────────────────────────────────────────────

    /**
     * Capture current table positions and fill colors before applying an organization plan.
     * Called immediately before ApplyOrganizationPlan to enable one-shot Revert.
     */
    CaptureCurrentPositions(): void {
        const bridge = this.GetActiveBridge();
        if (!bridge) return;
        try {
            const modelData = bridge.GetModelData();
            this._OrganizationSnapshot = (modelData.Tables ?? []).map((t: ITableData) => ({
                id: t.ID,
                x: t.X,
                y: t.Y,
                fill: t.FillProp ?? ""
            }));
        }
        catch (err) {
            GetLogService().Error("AgentBridge.CaptureCurrentPositions failed", err);
            this._OrganizationSnapshot = null;
        }
    }

    /**
     * Restore table positions and colors from the last captured snapshot.
     * Clears the snapshot after use.
     */
    RevertOrganization(): IOrganizationResult {
        const bridge = this.GetActiveBridge();
        const snapshot = this._OrganizationSnapshot;
        if (!bridge || !snapshot)
            return { success: false, message: "No snapshot available to revert.", tablesOrganized: 0, groupCount: 0 };

        try {
            const reverted = snapshot.length;
            for (const snap of snapshot) {
                bridge.MoveElement(snap.id, snap.x, snap.y);
                if (snap.fill)
                    bridge.UpdateProperty(snap.id, "Fill", this.CssToTfxColor(snap.fill));
            }
            bridge.AlignLines();

            if (this._Provider) {
                const state = this._Provider.GetActiveState();
                const panel = this._Provider.GetActivePanel();
                if (state && panel) {
                    state.IsDirty = true;
                    panel.webview.postMessage({ Type: "LoadModel", Payload: state.GetModelData() });
                }
            }

            this._OrganizationSnapshot = null;
            return { success: true, message: "Reverted successfully.", tablesOrganized: reverted, groupCount: 0 };
        }
        catch (err) {
            GetLogService().Error("AgentBridge.RevertOrganization failed", err);
            return { success: false, message: String(err), tablesOrganized: 0, groupCount: 0 };
        }
    }

    // ─── AI Organization Methods ────────────────────────────────────────────

    /**
     * Build a structured context payload for the AI table organization feature.
     * Contains table names, fields, dimensions, and reference topology.
     */
    GetOrganizationContext(): IOrganizationContext | null {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return null;

        try {
            const modelData = bridge.GetModelData();
            if (!modelData.Tables || modelData.Tables.length === 0)
                return null;

            const tables: IOrganizationTableInfo[] = modelData.Tables.map((t: ITableData) => ({
                id: t.ID,
                name: t.Name,
                width: t.Width || 200,
                height: t.Height || (60 + (t.Fields?.length ?? 0) * 24),
                fieldCount: t.Fields?.length ?? 0,
                fields: t.Fields?.map((f: any) => f.Name) ?? [],
                isShadow: !!t.IsShadow
            }));

            const references: IOrganizationReferenceInfo[] = (modelData.References ?? []).map((r: any) => {
                // Resolve source field to table name
                const sourceFieldInfo = bridge.GetElementInfo(r.SourceFieldID);
                const sourceTable = modelData.Tables.find(t =>
                    t.Fields?.some((f: any) => f.ID === r.SourceFieldID)
                );
                const targetTable = modelData.Tables.find(t => t.ID === r.TargetTableID);

                return {
                    sourceTable: sourceTable?.Name ?? "Unknown",
                    sourceField: sourceFieldInfo?.Name ?? r.SourceFieldID,
                    targetTable: targetTable?.Name ?? "Unknown"
                };
            });

            // Estimate canvas dimensions based on table count
            const tableCount = tables.length;
            const cols = Math.ceil(Math.sqrt(tableCount));
            const rows = Math.ceil(tableCount / cols);
            const canvasWidth = Math.max(2000, cols * 350);
            const canvasHeight = Math.max(1500, rows * 350);

            return { tables, references, canvasWidth, canvasHeight };
        }
        catch (err) {
            GetLogService().Error("AgentBridge.GetOrganizationContext failed", err);
            return null;
        }
    }

    /**
     * Apply an AI-generated organization plan: batch update table positions and colors,
     * then re-route all lines and refresh the webview.
     */
    ApplyOrganizationPlan(pPlan: IAIOrganizationPlan): IOrganizationResult {
        const bridge = this.GetActiveBridge();
        if (!bridge)
            return { success: false, message: "No active designer.", tablesOrganized: 0, groupCount: 0 };

        try {
            let tablesOrganized = 0;

            for (const group of pPlan.groups) {
                const tfxColor = this.CssToTfxColor(group.color);

                for (const tablePlacement of group.tables) {
                    // Move the table
                    const moveResult = bridge.MoveElement(tablePlacement.id, tablePlacement.x, tablePlacement.y);
                    if (!moveResult?.Success)
                        continue;

                    // Set the table color (TFX ARGB format)
                    bridge.UpdateProperty(tablePlacement.id, "Fill", tfxColor);

                    tablesOrganized++;
                }
            }

            // Re-route all lines after batch repositioning
            bridge.AlignLines();

            // Refresh the webview via the provider
            if (this._Provider) {
                const state = this._Provider.GetActiveState();
                const panel = this._Provider.GetActivePanel();
                if (state && panel) {
                    state.IsDirty = true;
                    const modelData = state.GetModelData();
                    panel.webview.postMessage({
                        Type: "LoadModel",
                        Payload: modelData
                    });
                }
            }

            return {
                success: true,
                message: "Organization applied successfully.",
                tablesOrganized,
                groupCount: pPlan.groups.length
            };
        }
        catch (err) {
            GetLogService().Error("AgentBridge.ApplyOrganizationPlan failed", err);
            return { success: false, message: String(err), tablesOrganized: 0, groupCount: 0 };
        }
    }
}

// ─── Interfaces for AI Organization ────────────────────────────────────────────

export interface IOrganizationTableInfo {
    id: string;
    name: string;
    width: number;
    height: number;
    fieldCount: number;
    fields: string[];
    isShadow: boolean;
}

export interface IOrganizationReferenceInfo {
    sourceTable: string;
    sourceField: string;
    targetTable: string;
}

export interface IOrganizationContext {
    tables: IOrganizationTableInfo[];
    references: IOrganizationReferenceInfo[];
    canvasWidth: number;
    canvasHeight: number;
}

export interface IAITablePlacement {
    id: string;
    x: number;
    y: number;
}

export interface IAIGroup {
    name: string;
    color: string;
    tables: IAITablePlacement[];
}

export interface IAIOrganizationPlan {
    groups: IAIGroup[];
}

export interface IOrganizationResult {
    success: boolean;
    message: string;
    tablesOrganized: number;
    groupCount: number;
}

interface ITableSnapshot {
    id: string;
    x: number;
    y: number;
    fill: string;
}
