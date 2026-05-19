/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import type { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";
import { XAgentBridge } from "../../../AgentIntegration/AgentBridge";
import type { IOrganizationContext, IOrganizationTableInfo, IAIOrganizationPlan, IAITablePlacement } from "../../../AgentIntegration/AgentBridge";
import { GetLogService } from "../../../Services/LogService";
import { XDesignerMessageType } from "../ORMDesignerMessages";
import {
    XClaudeCliPromptCompressor,
    ICompressionResult,
    XClaudeCliRunner,
    CLAUDE_CLI_MODELS,
    IClaudeCliModelSpec
} from "../../../AgentIntegration/ClaudeCli";

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

// Layout constants — must mirror XORMMetrics on the TFX side.
const TABLE_H_GAP   = 60;
const TABLE_V_GAP   = 30;
const GROUP_H_GAP   = 140;
const GROUP_V_GAP   = 120;
const CANVAS_PAD    = 80;
const DEFAULT_W     = 200;
const HEADER_HEIGHT = 28;
const ROW_HEIGHT    = 16;
const ROWS_PADDING  = 12;

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
    private static _PendingClaudeModels: IClaudeCliModelSpec[] = [];
    private static _ClaudeRunner: XClaudeCliRunner = new XClaudeCliRunner();

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
        const log = GetLogService();
        log.Info("OrganizeTablesAI: Execute() entered");

        const bridge = XAgentBridge.GetInstance();

        if (!bridge.IsDesignerActive()) {
            log.Warn("OrganizeTablesAI: no active designer");
            vscode.window.showWarningMessage("No ORM Designer is open. Open a .dsorm file first.");
            return;
        }

        const context = bridge.GetOrganizationContext();
        if (!context || context.tables.length === 0) {
            log.Warn("OrganizeTablesAI: empty context");
            vscode.window.showInformationMessage("The model has no tables to organize.");
            return;
        }

        let allModels: vscode.LanguageModelChat[];
        try {
            allModels = await vscode.lm.selectChatModels();
            log.Info(`OrganizeTablesAI: selectChatModels returned ${allModels.length} models`);
        }
        catch (err) {
            log.Error("OrganizeTablesAI: selectChatModels threw", err);
            allModels = [];
        }

        const sortedModels = [...allModels].sort((a, b) => {
            const v = a.vendor.localeCompare(b.vendor);
            if (v !== 0) return v;
            return a.family.localeCompare(b.family);
        });

        const claudeAvailable = await XOrganizeTablesCommand._ClaudeRunner.IsAvailable();
        const claudeModels: IClaudeCliModelSpec[] = claudeAvailable ? CLAUDE_CLI_MODELS : [];
        log.Info(`OrganizeTablesAI: Claude Code CLI available=${claudeAvailable !== null}, models=${claudeModels.length}`);

        if (sortedModels.length === 0 && claudeModels.length === 0) {
            log.Warn("OrganizeTablesAI: no LM models available");
            vscode.window.showWarningMessage(
                "No AI language model available. Install GitHub Copilot, Claude Code CLI (`claude login`), or another LLM extension."
            );
            return;
        }

        XOrganizeTablesCommand._PendingModels = sortedModels;
        XOrganizeTablesCommand._PendingClaudeModels = claudeModels;

        const panel = pProvider.GetActivePanel();
        if (!panel) {
            log.Warn("OrganizeTablesAI: no active panel — cannot show picker");
            vscode.window.showWarningMessage("Cannot show model picker: no active designer panel.");
            return;
        }
        const lmEntries = sortedModels.map((m, i) => ({
            index: i,
            name: m.name,
            vendor: m.vendor,
            family: m.family,
            maxInputTokens: m.maxInputTokens,
            costLabel: XOrganizeTablesCommand.GetCostLabel(m)
        }));
        const claudeEntries = claudeModels.map((spec, j) => ({
            index: sortedModels.length + j,
            name: spec.Name,
            vendor: "claude-code",
            family: spec.Family,
            maxInputTokens: spec.MaxInputTokens,
            costLabel: spec.CostLabel
        }));

        log.Info(`OrganizeTablesAI: posting AIOrganizeShowPicker with ${lmEntries.length + claudeEntries.length} models`);
        panel.webview.postMessage({
            Type: XDesignerMessageType.AIOrganizeShowPicker,
            Payload: {
                tableCount: context.tables.length,
                promptPreview: XOrganizeTablesCommand.BuildPromptPreview(context),
                models: [...lmEntries, ...claudeEntries]
            }
        });
    }

    /**
     * Phase 2: run AI with the model chosen by the user in the webview picker.
     */
    private static async ExecuteWithModel(pModelIndex: number, pProvider: XORMDesignerEditorProvider): Promise<void> {
        const log = GetLogService();
        const bridge = XAgentBridge.GetInstance();
        const lmModels = XOrganizeTablesCommand._PendingModels;
        const claudeModels = XOrganizeTablesCommand._PendingClaudeModels;
        const total = lmModels.length + claudeModels.length;

        if (pModelIndex < 0 || pModelIndex >= total) {
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

        const useClaude = pModelIndex >= lmModels.length;
        const claudeSpec = useClaude ? claudeModels[pModelIndex - lmModels.length] : null;
        const model: { name: string; vendor: string; family: string } = useClaude
            ? { name: claudeSpec!.Name, vendor: "claude-code", family: claudeSpec!.Family }
            : lmModels[pModelIndex];
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

                const compression = XClaudeCliPromptCompressor.Compress(context.tables, context.references);
                const systemPrompt = XOrganizeTablesCommand.BuildSystemPrompt();
                const userPayload = XOrganizeTablesCommand.BuildUserPayload(compression);

                progress.report({ message: `Sending to ${model.name}…`, increment: 10 });
                sendProgress(`Sending model to ${model.name}…`, 15, "sending");

                let fullText = "";
                const onChunk = (delta: string) => {
                    fullText += delta;
                    const groups = XOrganizeTablesCommand.CountPartialGroups(fullText);
                    const statusMsg = groups > 0
                        ? `Grouping tables… ${groups} group${groups > 1 ? "s" : ""} found`
                        : "AI is analyzing tables…";
                    sendProgress(statusMsg, 30 + Math.min(fullText.length / 40, 35), "grouping");
                };

                if (useClaude) {
                    log.Info(`OrganizeTablesAI: dispatching via Claude Code CLI runner (${claudeSpec!.Family})`);
                    const result = await XOrganizeTablesCommand._ClaudeRunner.Run({
                        Family: claudeSpec!.Family,
                        SystemPrompt: systemPrompt,
                        UserPayload: userPayload,
                        OnChunk: onChunk,
                        IsCancelled: () => token.isCancellationRequested,
                        OnCancelHook: (abort) => token.onCancellationRequested(abort)
                    });
                    fullText = result.Text;
                    log.Info(`Claude Code usage — in:${result.Usage.InputTokens} out:${result.Usage.OutputTokens} cacheRead:${result.Usage.CacheReadTokens} cacheWrite:${result.Usage.CacheCreationTokens}`);
                }
                else {
                    const lmModel = lmModels[pModelIndex];
                    const messages = [
                        vscode.LanguageModelChatMessage.User(systemPrompt, "system"),
                        vscode.LanguageModelChatMessage.User(userPayload)
                    ];
                    const response = await lmModel.sendRequest(messages, {}, token);

                    progress.report({ message: "AI is working…", increment: 15 });
                    sendProgress("AI is analyzing table relationships…", 30, "analyzing");

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
                        if (charCount % 60 < fragment.length)
                            onChunk("");
                    }
                }

                progress.report({ message: "Parsing AI response…", increment: 20 });
                sendProgress("Parsing AI response…", 68, "parsing");

                const grouping = XOrganizeTablesCommand.ParseGroupingResponse(fullText, compression);
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

                const plan = XOrganizeTablesCommand.ComputeLayout(grouping, context.tables, context.references);

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
     * Static system prompt — stable across runs so Anthropic prompt-cache can
     * hit on repeat invocations within the cache TTL.
     */
    private static BuildSystemPrompt(): string {
        const colorsJson = JSON.stringify(GROUP_COLORS);
        return `You are an expert database architect. Group the ORM tables into functional domain clusters.

Grouping rules:
- Group tables that share a business domain or feature area.
- Tables linked by FK should preferably belong to the same group.
- Use name prefixes/suffixes as domain hints (SYS=System, USR/User=Security, ORD=Order, etc.).
- Shadow tables stay with their main table.
- Aim for 2-8 tables per group; split large domains.

Colors (assign in order — first group gets first color):
${colorsJson}

Output:
Respond with ONLY a JSON object (no markdown fences, no commentary):
{
  "groups": [
    { "name": "GroupName", "color": "#HEXCOLOR", "tableIds": ["T1", "T2"] }
  ]
}
Use the SHORT ids (T1, T2, ...) supplied in the payload. Each table id must appear in exactly one group.
The payload includes "hints" — pre-computed FK-connected clusters. Treat them as a strong prior; refine, don't ignore.`;
    }

    /**
     * Per-invocation user payload — only the dynamic content varies.
     */
    private static BuildUserPayload(pCompression: ICompressionResult): string {
        return JSON.stringify(pCompression.Payload, null, 2);
    }

    // --- Response Parser ------------------------------------------------------

    private static ParseGroupingResponse(pText: string, pCompression?: ICompressionResult): IAISimpleGrouping | null {
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

            if (pCompression) {
                for (const group of parsed.groups) {
                    group.tableIds = XClaudeCliPromptCompressor.Expand(group.tableIds, pCompression.ReverseMap);
                }
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

    // --- Sugiyama Layout Engine ----------------------------------------------

    /**
     * Overlap-free layout engine.
     *
     * Within each group: tables are arranged in a grid (ceil(sqrt(n)) columns).
     * Group zones are tiled in a macro-grid on the canvas.
     *
     * This guarantees zero stacking and clear visual separation independent of
     * the number of tables or groups.
     */
    private static GetTableSize(pTable: IOrganizationTableInfo | undefined): { w: number; h: number } {
        if (!pTable)
            return { w: DEFAULT_W, h: HEADER_HEIGHT };
        const w = pTable.width || DEFAULT_W;
        const h = pTable.height || (pTable.fieldCount > 0
            ? HEADER_HEIGHT + pTable.fieldCount * ROW_HEIGHT + ROWS_PADDING
            : HEADER_HEIGHT);
        return { w, h };
    }

    private static ComputeLayout(
        pGrouping: IAISimpleGrouping,
        pTables: IOrganizationTableInfo[],
        pReferences: { sourceTable: string; targetTable: string }[] = []
    ): IAIOrganizationPlan {
        const tableMap = new Map(pTables.map(t => [t.id, t]));
        const nameToId = new Map<string, string>();
        for (const t of pTables) nameToId.set(t.name, t.id);

        const edges: Array<{ from: string; to: string }> = [];
        for (const r of pReferences) {
            const from = nameToId.get(r.sourceTable);
            const to = nameToId.get(r.targetTable);
            if (from && to && from !== to)
                edges.push({ from, to });
        }

        const getSize = (pId: string) => XOrganizeTablesCommand.GetTableSize(tableMap.get(pId));

        interface IZoneLayout {
            group: IAISimpleGroup;
            tableIds: string[];
            placements: Map<string, { x: number; y: number }>;
            width: number;
            height: number;
        }

        const zones: IZoneLayout[] = [];
        const groupOfTable = new Map<string, number>();

        for (let gi = 0; gi < pGrouping.groups.length; gi++) {
            const group = pGrouping.groups[gi];
            const ids = group.tableIds.filter(id => tableMap.has(id));
            if (ids.length === 0)
                continue;
            for (const id of ids) groupOfTable.set(id, gi);

            const intraEdges = edges.filter(e => ids.indexOf(e.from) >= 0 && ids.indexOf(e.to) >= 0);
            const ranked = XOrganizeTablesCommand.ComputeRanks(ids, intraEdges);
            const ordered = XOrganizeTablesCommand.OrderByBarycenter(ranked, intraEdges);

            const placements = new Map<string, { x: number; y: number }>();
            let zoneH = 0;
            let x = 0;
            for (const col of ordered) {
                let colMaxW = 0;
                let y = 0;
                for (const id of col) {
                    const { w, h } = getSize(id);
                    placements.set(id, { x, y });
                    if (w > colMaxW) colMaxW = w;
                    y += h + TABLE_V_GAP;
                }
                if (y - TABLE_V_GAP > zoneH) zoneH = y - TABLE_V_GAP;
                x += colMaxW + TABLE_H_GAP;
            }
            const zoneW = Math.max(0, x - TABLE_H_GAP);

            zones.push({ group, tableIds: ids, placements, width: zoneW, height: zoneH });
        }

        const interEdges = new Map<string, number>();
        const keyOf = (a: number, b: number) => a < b ? `${a}|${b}` : `${b}|${a}`;
        for (const e of edges) {
            const ga = groupOfTable.get(e.from);
            const gb = groupOfTable.get(e.to);
            if (ga === undefined || gb === undefined || ga === gb)
                continue;
            const k = keyOf(ga, gb);
            interEdges.set(k, (interEdges.get(k) ?? 0) + 1);
        }

        const placedZones = XOrganizeTablesCommand.PackZones(zones, interEdges);

        const result: IAIOrganizationPlan = { groups: [] };
        for (const pz of placedZones) {
            const placements: IAITablePlacement[] = [];
            for (const id of pz.zone.tableIds) {
                const local = pz.zone.placements.get(id)!;
                placements.push({
                    id,
                    x: Math.round(pz.x + local.x),
                    y: Math.round(pz.y + local.y)
                });
            }
            result.groups.push({ name: pz.zone.group.name, color: pz.zone.group.color, tables: placements });
        }

        return result;
    }

    private static ComputeRanks(
        pIds: string[],
        pEdges: Array<{ from: string; to: string }>
    ): string[][] {
        const incoming = new Map<string, Set<string>>();
        for (const id of pIds) incoming.set(id, new Set());
        for (const e of pEdges) {
            if (!incoming.has(e.from) || !incoming.has(e.to))
                continue;
            incoming.get(e.to)!.add(e.from);
        }

        const rank = new Map<string, number>();
        const visiting = new Set<string>();

        const dfs = (pId: string): number => {
            if (rank.has(pId))
                return rank.get(pId)!;
            if (visiting.has(pId)) {
                rank.set(pId, 0);
                return 0;
            }
            visiting.add(pId);
            let maxParent = -1;
            for (const parent of incoming.get(pId)!) {
                const r = dfs(parent);
                if (r > maxParent) maxParent = r;
            }
            const r = maxParent + 1;
            rank.set(pId, r);
            visiting.delete(pId);
            return r;
        };

        for (const id of pIds)
            dfs(id);

        const maxR = Math.max(0, ...Array.from(rank.values()));
        const cols: string[][] = [];
        for (let i = 0; i <= maxR; i++) cols.push([]);
        for (const id of pIds)
            cols[rank.get(id) ?? 0].push(id);

        return cols.filter(c => c.length > 0);
    }

    private static OrderByBarycenter(
        pCols: string[][],
        pEdges: Array<{ from: string; to: string }>
    ): string[][] {
        if (pCols.length <= 1)
            return pCols;

        const ordered = pCols.map(c => [...c]);

        for (let pass = 0; pass < 8; pass++) {
            let changed = false;
            for (let c = 1; c < ordered.length; c++) {
                const prev = ordered[c - 1];
                const idx = new Map(prev.map((id, i) => [id, i]));
                const scored = ordered[c].map((id, i) => {
                    let sum = 0;
                    let cnt = 0;
                    for (const e of pEdges) {
                        if (e.to === id && idx.has(e.from)) { sum += idx.get(e.from)!; cnt++; }
                    }
                    return { id, score: cnt > 0 ? sum / cnt : i };
                });
                scored.sort((a, b) => a.score - b.score);
                const newOrder = scored.map(s => s.id);
                for (let i = 0; i < newOrder.length; i++) {
                    if (newOrder[i] !== ordered[c][i]) {
                        changed = true;
                        break;
                    }
                }
                ordered[c] = newOrder;
            }
            if (!changed) break;
        }

        return ordered;
    }

    private static PackZones(
        pZones: Array<{ group: IAISimpleGroup; tableIds: string[]; placements: Map<string, { x: number; y: number }>; width: number; height: number }>,
        pInter: Map<string, number>
    ): Array<{ zone: typeof pZones[number]; x: number; y: number }> {
        if (pZones.length === 0) return [];

        const placedIdx = new Set<number>();
        const order: number[] = [];

        const startIdx = pZones
            .map((z, i) => ({ i, area: z.width * z.height }))
            .sort((a, b) => b.area - a.area)[0].i;
        order.push(startIdx);
        placedIdx.add(startIdx);

        while (placedIdx.size < pZones.length) {
            let bestNext = -1;
            let bestScore = -1;
            for (let i = 0; i < pZones.length; i++) {
                if (placedIdx.has(i)) continue;
                let score = 0;
                for (const p of placedIdx) {
                    const k = i < p ? `${i}|${p}` : `${p}|${i}`;
                    score += pInter.get(k) ?? 0;
                }
                if (score > bestScore || (score === bestScore && bestNext === -1)) {
                    bestScore = score;
                    bestNext = i;
                }
            }
            if (bestNext < 0)
                bestNext = pZones.findIndex((_, i) => !placedIdx.has(i));
            order.push(bestNext);
            placedIdx.add(bestNext);
        }

        const totalArea = pZones.reduce((s, z) => s + z.width * z.height, 0);
        const rowBudget = Math.max(
            ...pZones.map(z => z.width),
            Math.sqrt(totalArea) * 1.6
        );

        const placed: Array<{ zone: typeof pZones[number]; x: number; y: number }> = [];
        let curX = CANVAS_PAD;
        let curY = CANVAS_PAD;
        let rowMaxH = 0;

        for (const idx of order) {
            const zone = pZones[idx];
            if (curX > CANVAS_PAD && curX + zone.width > CANVAS_PAD + rowBudget) {
                curX = CANVAS_PAD;
                curY += rowMaxH + GROUP_V_GAP;
                rowMaxH = 0;
            }
            placed.push({ zone, x: curX, y: curY });
            if (zone.height > rowMaxH) rowMaxH = zone.height;
            curX += zone.width + GROUP_H_GAP;
        }

        return placed;
    }
}
