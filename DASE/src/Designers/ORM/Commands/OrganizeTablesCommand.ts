/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import type { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";
import { XAgentBridge } from "../../../AgentIntegration/AgentBridge";
import type { IOrganizationContext, IOrganizationTableInfo, IAIOrganizationPlan, IAITablePlacement } from "../../../AgentIntegration/AgentBridge";
import { GetLogService } from "../../../Services/LogService";
import { XDesignerMessageType } from "../ORMDesignerMessages";

/**
 * Organize Tables using AI � VS Code Language Model API.
 *
 * 1. Lists ALL available VS Code LM models and shows a proper picker.
 * 2. Sends an overlay with streaming progress directly to the webview.
 * 3. AI task: GROUP tables by functional domain (not positions � those are computed by us).
 * 4. Deterministic layout engine arranges groups + tables with zero overlapping.
 * 5. Applies positions and colors in batch to the ORM model.
 */

/** Curated palette for group coloring � harmonious, distinct, accessible. */
const GROUP_COLORS: string[] = [
    "#4A90D9",   // Blue
    "#50C878",   // Emerald
    "#E8A838",   // Amber
    "#D85C8A",   // Rose
    "#7B68EE",   // Purple
    "#20B2AA",   // Teal
    "#FF7F50",   // Coral
    "#9ACD32",   // Lime
    "#DDA0DD",   // Plum
    "#87CEEB",   // Sky
    "#F0E68C",   // Khaki
    "#CD853F"    // Peru
];

// Layout constants
const TABLE_H_GAP  = 40;   // horizontal gap between tables within a group
const TABLE_V_GAP  = 40;   // vertical gap between tables within a group
const GROUP_H_GAP  = 120;  // horizontal gap between group zones
const GROUP_V_GAP  = 100;  // vertical gap between group zones
const CANVAS_PAD   = 80;   // canvas padding top-left
const DEFAULT_W    = 200;  // default table width when not known
const DEFAULT_H_BASE = 60; // default table header height
const DEFAULT_H_ROW  = 26; // height per field row

// --- Interfaces --------------------------------------------------------------

interface IAISimpleGroup {
    name: string;
    color: string;
    tableIds: string[];
}

interface IAISimpleGrouping {
    groups: IAISimpleGroup[];
}

export class XOrganizeTablesCommand {
    private static _PendingModels: vscode.LanguageModelChat[] = [];

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): void {
        const cmd = vscode.commands.registerCommand("Dase.OrganizeTablesAI", async () => {
            await XOrganizeTablesCommand.Execute(pProvider);
        });
        const cmdExec = vscode.commands.registerCommand("Dase.OrganizeTablesAIExecute", async (pModelIndex: number) => {
            await XOrganizeTablesCommand.ExecuteWithModel(pModelIndex, pProvider);
        });
        const cmdRevert = vscode.commands.registerCommand("Dase.OrganizeTablesAIRevert", () => {
            XAgentBridge.GetInstance().RevertOrganization();
        });
        pContext.subscriptions.push(cmd, cmdExec, cmdRevert);
    }

    /**
     * Builds a human-readable prompt preview (no large JSON blob).
     */
    private static BuildPromptPreview(pContext: IOrganizationContext): string {
        const tableList = pContext.tables
            .map(t => `  • ${t.name} (${t.fields.length} field${t.fields.length !== 1 ? "s" : ""})`)
            .join("\n");
        const refCount = pContext.references.length;
        const refList = pContext.references
            .map(r => `  • ${r.sourceTable}.${r.sourceField} → ${r.targetTable}`)
            .join("\n");
        return (
            `You are an expert database architect. Analyze the ORM model below and\n` +
            `group the tables into functional domain clusters.\n\n` +
            `Tables (${pContext.tables.length}):\n${tableList}\n\n` +
            `FK Relationships (${refCount}):\n${refList || "  (none)"}\n\n` +
            `Rules: group by business domain · FK-linked tables in same group ·\n` +
            `use name prefixes as hints · 2–8 tables per group\n\n` +
            `Respond with JSON only: { "groups": [ { "name", "color", "tableIds" } ] }`
        );
    }

    /**
     * Maps a model to a Copilot-style cost multiplier label for display.
     * Based on known Copilot premium-request multipliers (0x = included, 1x = standard).
     */
    private static GetCostLabel(pModel: vscode.LanguageModelChat): string {
        const name = pModel.name.toLowerCase();
        const family = (pModel.family ?? "").toLowerCase();
        if (family === "auto" || name === "auto") return "10% off";
        if (name.includes("opus") && name.includes("fast")) return "30x";
        if (name.includes("opus")) return "3x";
        if (name.includes("haiku")) return "0.33x";
        if (name.includes("grok") && name.includes("fast")) return "0.25x";
        if (name.includes("flash") || (name.includes("mini") && name.includes("codex"))) return "0.33x";
        if (name.includes("gpt-4.1") || name.includes("gpt-4o") ||
            name.includes("raptor mini") || name.includes("gpt-5 mini")) return "0x";
        return "1x";
    }

    /**
     * Phase 1: list available models and send the picker to the webview.
     * The actual AI execution starts only when the user clicks Execute in the modal.
     */
    private static async Execute(pProvider: XORMDesignerEditorProvider): Promise<void> {
        const bridge = XAgentBridge.GetInstance();

        if (!bridge.IsDesignerActive()) {
            vscode.window.showWarningMessage("No ORM Designer is open. Open a .dsorm file first.");
            return;
        }

        const context = bridge.GetOrganizationContext();
        if (!context || context.tables.length === 0) {
            vscode.window.showInformationMessage("The model has no tables to organize.");
            return;
        }

        let allModels: vscode.LanguageModelChat[];
        try {
            allModels = await vscode.lm.selectChatModels();
        }
        catch {
            allModels = [];
        }

        if (allModels.length === 0) {
            vscode.window.showWarningMessage(
                "No AI language model available. Please install GitHub Copilot or another LLM extension."
            );
            return;
        }

        const sortedModels = [...allModels].sort((a, b) => {
            const v = a.vendor.localeCompare(b.vendor);
            if (v !== 0) return v;
            return a.family.localeCompare(b.family);
        });

        XOrganizeTablesCommand._PendingModels = sortedModels;

        const panel = pProvider.GetActivePanel();
        panel?.webview.postMessage({
            Type: XDesignerMessageType.AIOrganizeShowPicker,
            Payload: {
                tableCount: context.tables.length,
                promptPreview: XOrganizeTablesCommand.BuildPromptPreview(context),
                models: sortedModels.map((m, i) => ({
                    index: i,
                    name: m.name,
                    vendor: m.vendor,
                    family: m.family,
                    maxInputTokens: m.maxInputTokens,
                    costLabel: XOrganizeTablesCommand.GetCostLabel(m)
                }))
            }
        });
    }

    /**
     * Phase 2: run AI with the model chosen by the user in the webview picker.
     */
    private static async ExecuteWithModel(pModelIndex: number, pProvider: XORMDesignerEditorProvider): Promise<void> {
        const log = GetLogService();
        const bridge = XAgentBridge.GetInstance();
        const models = XOrganizeTablesCommand._PendingModels;

        if (pModelIndex < 0 || pModelIndex >= models.length) {
            vscode.window.showWarningMessage("Invalid model selection.");
            return;
        }

        if (!bridge.IsDesignerActive()) {
            vscode.window.showWarningMessage("No ORM Designer is open.");
            return;
        }

        const context = bridge.GetOrganizationContext();
        if (!context || context.tables.length === 0) {
            vscode.window.showInformationMessage("The model has no tables to organize.");
            return;
        }

        const model = models[pModelIndex];
        const panel = pProvider.GetActivePanel();

        panel?.webview.postMessage({
            Type: XDesignerMessageType.AIOrganizeStart,
            Payload: { model: model.name, vendor: model.vendor, tableCount: context.tables.length }
        });

        const sendProgress = (pMessage: string, pPercent: number, pStep: string) => {
            panel?.webview.postMessage({
                Type: XDesignerMessageType.AIOrganizeProgress,
                Payload: { message: pMessage, percent: pPercent, step: pStep }
            });
        };

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `✨ Organizing tables with ${model.name}…`,
            cancellable: true
        }, async (progress, token) => {
            try {
                progress.report({ message: "Building model context…", increment: 5 });
                sendProgress("Building model context…", 5, "context");

                const prompt = XOrganizeTablesCommand.BuildGroupingPrompt(context);

                progress.report({ message: `Sending to ${model.name}…`, increment: 10 });
                sendProgress(`Sending model to ${model.name}…`, 15, "sending");

                const messages = [vscode.LanguageModelChatMessage.User(prompt)];
                const response = await model.sendRequest(messages, {}, token);

                progress.report({ message: "AI is working…", increment: 15 });
                sendProgress("AI is analyzing table relationships…", 30, "analyzing");

                let fullText = "";
                let charCount = 0;
                for await (const fragment of response.text) {
                    if (token.isCancellationRequested) {
                        panel?.webview.postMessage({
                            Type: XDesignerMessageType.AIOrganizeError,
                            Payload: { message: "Cancelled." }
                        });
                        return;
                    }
                    fullText += fragment;
                    charCount += fragment.length;

                    if (charCount % 60 < fragment.length) {
                        const groups = XOrganizeTablesCommand.CountPartialGroups(fullText);
                        const statusMsg = groups > 0
                            ? `Grouping tables… ${groups} group${groups > 1 ? "s" : ""} found`
                            : "AI is analyzing tables…";
                        sendProgress(statusMsg, 30 + Math.min(charCount / 40, 35), "grouping");
                    }
                }

                progress.report({ message: "Parsing AI response…", increment: 20 });
                sendProgress("Parsing AI response…", 68, "parsing");

                const grouping = XOrganizeTablesCommand.ParseGroupingResponse(fullText);
                if (!grouping) {
                    const errMsg = "The AI returned an unrecognised format. Please try again.";
                    log.Warn(`AI grouping parse failed:\n${fullText.substring(0, 600)}`);
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.AIOrganizeError,
                        Payload: { message: errMsg }
                    });
                    vscode.window.showWarningMessage(errMsg);
                    return;
                }

                const assignedIds = new Set(grouping.groups.flatMap(g => g.tableIds));
                const ungrouped = context.tables.filter(t => !assignedIds.has(t.id));
                if (ungrouped.length > 0) {
                    grouping.groups.push({
                        name: "Other",
                        color: "#AAAAAA",
                        tableIds: ungrouped.map(t => t.id)
                    });
                }

                progress.report({ message: "Computing layout…", increment: 12 });
                sendProgress(`Computing layout for ${grouping.groups.length} groups…`, 82, "layout");

                const plan = XOrganizeTablesCommand.ComputeLayout(grouping, context.tables);

                progress.report({ message: "Applying to model…", increment: 10 });
                sendProgress("Applying positions and colors…", 93, "applying");

                // Capture snapshot BEFORE applying so we can revert
                bridge.CaptureCurrentPositions();

                const result = bridge.ApplyOrganizationPlan(plan);
                if (result.success) {
                    progress.report({ message: "Done!", increment: 5 });
                    sendProgress(
                        `${result.tablesOrganized} tables organized into ${result.groupCount} groups.`,
                        100,
                        "done"
                    );
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.AIOrganizeComplete,
                        Payload: {
                            success: true,
                            tablesOrganized: result.tablesOrganized,
                            groupCount: result.groupCount,
                            canRevert: true,
                            groups: grouping.groups.map(g => ({
                                name: g.name,
                                color: g.color,
                                count: g.tableIds.length
                            }))
                        }
                    });
                    vscode.window.showInformationMessage(
                        `✅ Organized ${result.tablesOrganized} tables into ${result.groupCount} groups.`
                    );
                }
                else {
                    const warnMsg = `Layout applied with issues: ${result.message}`;
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.AIOrganizeError,
                        Payload: { message: warnMsg }
                    });
                    vscode.window.showWarningMessage(warnMsg);
                }
            }
            catch (err: any) {
                if (err?.name === "CancellationError" || token.isCancellationRequested) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.AIOrganizeError,
                        Payload: { message: "Cancelled." }
                    });
                    vscode.window.showInformationMessage("Organization cancelled.");
                    return;
                }
                log.Error("OrganizeTablesAI failed", err);
                const errMsg = err?.message ?? String(err);
                panel?.webview.postMessage({
                    Type: XDesignerMessageType.AIOrganizeError,
                    Payload: { message: `Error: ${errMsg}` }
                });
                vscode.window.showErrorMessage(`AI organization failed: ${errMsg}`);
            }
        });
    }

    // --- AI Grouping Prompt ---------------------------------------------------

    /**
     * Concise grouping-only prompt.
     * The AI's only job is to cluster tables by domain � we compute positions.
     */
    private static BuildGroupingPrompt(pContext: IOrganizationContext): string {
        const colorsJson = JSON.stringify(GROUP_COLORS);

        // Compact context payload � omit canvas dimensions (not needed for grouping)
        const compactTables = pContext.tables.map(t => ({
            id: t.id,
            name: t.name,
            fields: t.fields,
            isShadow: t.isShadow
        }));
        const compactRefs = pContext.references.map(r => ({
            from: r.sourceTable,
            field: r.sourceField,
            to: r.targetTable
        }));

        const ctxJson = JSON.stringify({ tables: compactTables, references: compactRefs }, null, 2);

        return `You are an expert database architect. Analyze the ORM model and group the tables into functional domain clusters.

## Grouping rules
- Group tables that belong to the same business domain or feature area
- Tables linked by FK references should preferably be in the same group
- Use name prefixes/suffixes as domain hints (e.g. SYS=System, USR/User=Security, ORD=Order)
- Shadow tables should stay in the same group as their main table
- Aim for 2�8 tables per group; split large domains into focused sub-groups

## Colors (assign in order � first group gets first color)
${colorsJson}

## ORM Model
\`\`\`json
${ctxJson}
\`\`\`

## Required response
Respond with ONLY the JSON object below � no markdown, no extra text.

{
  "groups": [
    { "name": "GroupName", "color": "#HEXCOLOR", "tableIds": ["exact-id"] }
  ]
}

Every table ID must appear in exactly one group. Use the EXACT IDs from the input.`;
    }

    // --- Response Parser ------------------------------------------------------

    private static ParseGroupingResponse(pText: string): IAISimpleGrouping | null {
        try {
            let jsonText = pText.trim();

            // Strip markdown code fences the AI may have added anyway
            const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(jsonText);
            if (fenceMatch)
                jsonText = fenceMatch[1].trim();

            // Extract first {} block in case there is leading/trailing prose
            const braceStart = jsonText.indexOf("{");
            const braceEnd = jsonText.lastIndexOf("}");
            if (braceStart !== -1 && braceEnd > braceStart)
                jsonText = jsonText.slice(braceStart, braceEnd + 1);

            const parsed = JSON.parse(jsonText);
            if (!parsed || !Array.isArray(parsed.groups))
                return null;

            for (const group of parsed.groups) {
                if (typeof group.name !== "string" || typeof group.color !== "string")
                    return null;
                if (!Array.isArray(group.tableIds))
                    return null;
                for (const id of group.tableIds)
                    if (typeof id !== "string")
                        return null;
            }

            return parsed as IAISimpleGrouping;
        }
        catch {
            return null;
        }
    }

    /** Count complete group objects in partially streamed JSON (for live feedback). */
    private static CountPartialGroups(pPartialText: string): number {
        const matches = pPartialText.match(/"name"\s*:/g);
        return matches ? matches.length : 0;
    }

    // --- Deterministic Layout Engine -----------------------------------------

    /**
     * Overlap-free layout engine.
     *
     * Within each group: tables are arranged in a grid (ceil(sqrt(n)) columns).
     * Group zones are tiled in a macro-grid on the canvas.
     *
     * This guarantees zero stacking and clear visual separation independent of
     * the number of tables or groups.
     */
    private static ComputeLayout(
        pGrouping: IAISimpleGrouping,
        pTables: IOrganizationTableInfo[]
    ): IAIOrganizationPlan {
        const tableMap = new Map(pTables.map(t => [t.id, t]));

        const getSize = (pId: string) => {
            const t = tableMap.get(pId);
            if (!t) return { w: DEFAULT_W, h: DEFAULT_H_BASE };
            return {
                w: t.width || DEFAULT_W,
                h: t.height || (DEFAULT_H_BASE + t.fieldCount * DEFAULT_H_ROW)
            };
        };

        // Build per-group zone layout
        interface IZone {
            group: IAISimpleGroup;
            tableIds: string[];
            cols: number;
            colWidths: number[];
            rowHeights: number[];
            zoneW: number;
            zoneH: number;
        }

        const zones: IZone[] = [];
        for (const group of pGrouping.groups) {
            const ids = group.tableIds.filter(id => tableMap.has(id));
            if (ids.length === 0)
                continue;

            const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
            const rows = Math.ceil(ids.length / cols);

            const colWidths = new Array<number>(cols).fill(0);
            const rowHeights = new Array<number>(rows).fill(0);

            for (let i = 0; i < ids.length; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const { w, h } = getSize(ids[i]);
                if (w > colWidths[col]) colWidths[col] = w;
                if (h > rowHeights[row]) rowHeights[row] = h;
            }

            const zoneW = colWidths.reduce((s, v) => s + v, 0) + Math.max(0, cols - 1) * TABLE_H_GAP;
            const zoneH = rowHeights.reduce((s, v) => s + v, 0) + Math.max(0, rows - 1) * TABLE_V_GAP;

            zones.push({ group, tableIds: ids, cols, colWidths, rowHeights, zoneW, zoneH });
        }

        // Sort zones by area descending � larger groups placed first (top-left)
        zones.sort((a, b) => (b.zoneW * b.zoneH) - (a.zoneW * a.zoneH));

        // Tile zones in a macro-grid
        const zoneCols = Math.max(1, Math.ceil(Math.sqrt(zones.length)));

        let curX = CANVAS_PAD;
        let curY = CANVAS_PAD;
        let rowMaxH = 0;
        let colInRow = 0;

        const result: IAIOrganizationPlan = { groups: [] };

        for (const zone of zones) {
            if (colInRow >= zoneCols) {
                curX = CANVAS_PAD;
                curY += rowMaxH + GROUP_V_GAP;
                rowMaxH = 0;
                colInRow = 0;
            }

            // Prefix-sum X offsets per column
            const colX: number[] = new Array(zone.cols).fill(0);
            for (let c = 1; c < zone.cols; c++)
                colX[c] = colX[c - 1] + zone.colWidths[c - 1] + TABLE_H_GAP;

            // Prefix-sum Y offsets per row
            const rows = zone.rowHeights.length;
            const rowY: number[] = new Array(rows).fill(0);
            for (let r = 1; r < rows; r++)
                rowY[r] = rowY[r - 1] + zone.rowHeights[r - 1] + TABLE_V_GAP;

            const placements: IAITablePlacement[] = [];
            for (let i = 0; i < zone.tableIds.length; i++) {
                const col = i % zone.cols;
                const row = Math.floor(i / zone.cols);
                placements.push({
                    id: zone.tableIds[i],
                    x: Math.round(curX + colX[col]),
                    y: Math.round(curY + rowY[row])
                });
            }

            result.groups.push({ name: zone.group.name, color: zone.group.color, tables: placements });

            if (zone.zoneH > rowMaxH) rowMaxH = zone.zoneH;
            curX += zone.zoneW + GROUP_H_GAP;
            colInRow++;
        }

        return result;
    }
}
