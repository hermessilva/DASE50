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
import * as dagre from "dagre";

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
const TABLE_H_GAP   = 120;
const TABLE_V_GAP   = 80;
const GROUP_H_GAP   = 240;
const GROUP_V_GAP   = 200;
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
    /** Optional per-table absolute positions provided by the AI (UUID → {x,y}). */
    positions?: Map<string, { x: number; y: number }>;
}

interface IAISimpleGrouping {
    groups: IAISimpleGroup[];
}

export interface ILayoutParams {
    RankDir?: string;
    Ranker?: string;
    RankSep?: number;
    NodeSep?: number;
}

const DEFAULT_LAYOUT: Required<ILayoutParams> = {
    RankDir: "TB",
    Ranker: "network-simplex",
    RankSep: 180,
    NodeSep: 55
};

export class XOrganizeTablesCommand {
    private static _PendingModels: vscode.LanguageModelChat[] = [];
    private static _PendingClaudeModels: IClaudeCliModelSpec[] = [];
    private static _ClaudeRunner: XClaudeCliRunner = new XClaudeCliRunner();

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): void {
        const cmd = vscode.commands.registerCommand("Dase.OrganizeTablesAI", async () => {
            await XOrganizeTablesCommand.Execute(pProvider);
        });
        const cmdExec = vscode.commands.registerCommand("Dase.OrganizeTablesAIExecute", async (pModelIndex: number, pLayout?: ILayoutParams) => {
            await XOrganizeTablesCommand.ExecuteWithModel(pModelIndex, pProvider, pLayout);
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
    private static async ExecuteWithModel(pModelIndex: number, pProvider: XORMDesignerEditorProvider, pLayout?: ILayoutParams): Promise<void> {
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

                let grouping = XOrganizeTablesCommand.ParseGroupingResponse(fullText, compression);

                if (!grouping && useClaude) {
                    log.Warn(`AI grouping parse failed on first attempt. Retrying with stricter prompt.\nRaw response start: ${fullText.substring(0, 400)}`);
                    sendProgress("Retrying with stricter JSON-only prompt…", 70, "retry");
                    const retrySystem = XOrganizeTablesCommand.BuildSystemPrompt()
                        + "\n\nIMPORTANT: Your previous response was rejected because it contained text other than JSON. Respond with ONLY the JSON object this time.";
                    const retryUser = XOrganizeTablesCommand.BuildUserPayload(compression);
                    fullText = "";
                    const retryResult = await XOrganizeTablesCommand._ClaudeRunner.Run({
                        Family: claudeSpec!.Family,
                        SystemPrompt: retrySystem,
                        UserPayload: retryUser,
                        OnChunk: onChunk,
                        IsCancelled: () => token.isCancellationRequested,
                        OnCancelHook: (abort) => token.onCancellationRequested(abort)
                    });
                    fullText = retryResult.Text;
                    log.Info(`Retry usage — in:${retryResult.Usage.InputTokens} out:${retryResult.Usage.OutputTokens}`);
                    grouping = XOrganizeTablesCommand.ParseGroupingResponse(fullText, compression);
                }

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

                const plan = XOrganizeTablesCommand.ComputeLayout(grouping, context.tables, context.references, pLayout);

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
        return `You are a JSON-only data classifier. Your single task: cluster ORM tables into functional groups and assign one color per group.

You DO NOT compute positions or coordinates. Coordinates are computed by the host application.

You MUST NOT echo, restate, or copy the input back. You MUST output a NEW JSON object whose top-level key is "groups".

Algorithm:
1. Read the input "tables" and "references" arrays.
2. Cluster tables by functional domain. Use FK references + name prefixes (SYS, USR, ORD, INV, FIN, ...).
3. Treat input "hints" as a strong prior of FK-connected clusters — refine, don't ignore.
4. Shadow tables stay with their main table.
5. Aim for 2-8 tables per group; split very large domains.
6. Assign colors IN ORDER from this palette: ${colorsJson}

OUTPUT SCHEMA — non-negotiable:
{
  "groups": [
    { "name": "GroupName", "color": "#RRGGBB", "tableIds": ["T1","T2"] }
  ]
}

CONTRACT:
- Top-level key is exactly "groups" (plural).
- Each group has exactly THREE keys: "name" (string), "color" (#RRGGBB), "tableIds" (array of string).
- NO other top-level keys (no "tables", no "clusters", no "domains").
- NO other group keys (no "id", no "description", no "members" — only "name", "color", "tableIds").
- Every table id from input appears in exactly ONE group.
- Use SHORT ids (T1, T2, ...) — never full table names.
- Response starts with "{" and ends with "}". No markdown. No prose.

Bad example: {"groups":[{"name":"X","color":"#000","tables":[{"id":"T1","x":0,"y":0}]}]}  — coordinates are forbidden.
Bad example: {"tables":[...]}  — that is the INPUT shape; you must emit "groups".`;
    }

    /**
     * Per-invocation user payload — minimal nudge plus input.
     */
    private static BuildUserPayload(pCompression: ICompressionResult): string {
        const payload = JSON.stringify(pCompression.Payload);
        return `Below is the INPUT. Produce a CLUSTERING (group names + colors + tableIds). Do NOT output coordinates.

INPUT:
${payload}

Output the clustering JSON now.`;
    }

    // --- Response Parser ------------------------------------------------------

    private static ParseGroupingResponse(pText: string, pCompression?: ICompressionResult): IAISimpleGrouping | null {
        try {
            let jsonText = pText.trim();

            // Strip markdown code fences the AI may have added anyway
            const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(jsonText);
            if (fenceMatch)
                jsonText = fenceMatch[1].trim();

            // Extract first balanced {...} block in case there is leading/trailing prose
            const balanced = XOrganizeTablesCommand.ExtractFirstJsonObject(jsonText);
            if (balanced)
                jsonText = balanced;

            const parsed = JSON.parse(jsonText);
            if (!parsed)
                return null;

            // Accept the canonical shape OR common AI deviations.
            // Top-level: "groups" preferred, fall back to "clusters" / "domains" / "categories".
            const rawGroups: unknown[] = Array.isArray(parsed.groups) ? parsed.groups
                : Array.isArray(parsed.clusters) ? parsed.clusters
                : Array.isArray(parsed.domains) ? parsed.domains
                : Array.isArray(parsed.categories) ? parsed.categories
                : [];
            if (rawGroups.length === 0)
                return null;

            const normalized: IAISimpleGroup[] = [];
            for (let i = 0; i < rawGroups.length; i++) {
                const g = rawGroups[i] as Record<string, unknown>;
                if (!g || typeof g !== "object")
                    return null;
                const name = typeof g.name === "string" ? g.name
                    : typeof g.label === "string" ? g.label
                    : typeof g.title === "string" ? g.title
                    : `Group${i + 1}`;
                const color = typeof g.color === "string" ? g.color
                    : typeof g.fill === "string" ? g.fill
                    : GROUP_COLORS[i % GROUP_COLORS.length];
                const idsRaw = Array.isArray(g.tableIds) ? g.tableIds
                    : Array.isArray(g.members) ? g.members
                    : Array.isArray(g.tables) ? g.tables
                    : Array.isArray(g.items) ? g.items
                    : Array.isArray(g.ids) ? g.ids
                    : null;
                if (!idsRaw)
                    return null;
                const tableIds: string[] = [];
                const shortPositions = new Map<string, { x: number; y: number }>();
                for (const entry of idsRaw) {
                    if (typeof entry === "string") {
                        tableIds.push(entry);
                        continue;
                    }
                    if (!entry || typeof entry !== "object")
                        return null;
                    const rec = entry as Record<string, unknown>;
                    const id = typeof rec.id === "string" ? rec.id : null;
                    if (!id)
                        return null;
                    tableIds.push(id);
                    if (typeof rec.x === "number" && typeof rec.y === "number") {
                        shortPositions.set(id, { x: rec.x, y: rec.y });
                    }
                }
                normalized.push({
                    name,
                    color,
                    tableIds,
                    positions: shortPositions.size > 0 ? shortPositions : undefined
                });
            }

            if (pCompression) {
                for (const group of normalized) {
                    const newPositions = group.positions
                        ? new Map<string, { x: number; y: number }>()
                        : undefined;
                    if (group.positions && newPositions) {
                        for (const [shortId, pos] of group.positions) {
                            const realId = pCompression.ReverseMap.get(shortId);
                            if (realId) newPositions.set(realId, pos);
                        }
                    }
                    group.tableIds = XClaudeCliPromptCompressor.Expand(group.tableIds, pCompression.ReverseMap);
                    group.positions = newPositions;
                }
            }

            return { groups: normalized };
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

    /** Extract the first balanced {...} JSON object from a string that may contain prose. */
    private static ExtractFirstJsonObject(pText: string): string | null {
        const start = pText.indexOf("{");
        if (start < 0) return null;
        let depth = 0;
        let inStr = false;
        let escape = false;
        for (let i = start; i < pText.length; i++) {
            const ch = pText[i];
            if (escape) { escape = false; continue; }
            if (ch === "\\" && inStr) { escape = true; continue; }
            if (ch === "\"") { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === "{") depth++;
            else if (ch === "}") {
                depth--;
                if (depth === 0) return pText.slice(start, i + 1);
            }
        }
        return null;
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
        // Always compute visual height from fieldCount — the stored t.height is often
        // just the header-only bounds and does not reflect actual rendered height.
        const h = pTable.fieldCount > 0
            ? HEADER_HEIGHT + pTable.fieldCount * ROW_HEIGHT + ROWS_PADDING
            : HEADER_HEIGHT;
        return { w, h };
    }

    /**
     * Layout via dagre — production-grade Sugiyama implementation.
     *
     * dagre handles: cycle break, longest-path/network-simplex ranking,
     * crossing minimization (24-pass median+barycenter), and Brandes-Köpf
     * coordinate assignment. Produces elegant left-to-right ORM diagrams.
     */
    private static ComputeLayout(
        pGrouping: IAISimpleGrouping,
        pTables: IOrganizationTableInfo[],
        pReferences: { sourceTable: string; targetTable: string }[] = [],
        pLayout?: ILayoutParams
    ): IAIOrganizationPlan {
        const tableMap = new Map(pTables.map(t => [t.id, t]));
        const nameToId = new Map<string, string>();
        for (const t of pTables) nameToId.set(t.name, t.id);

        const sizeOf = (id: string) => XOrganizeTablesCommand.GetTableSize(tableMap.get(id));

        const lp = {
            rankdir: pLayout?.RankDir ?? DEFAULT_LAYOUT.RankDir,
            ranker: pLayout?.Ranker ?? DEFAULT_LAYOUT.Ranker,
            ranksep: pLayout?.RankSep ?? DEFAULT_LAYOUT.RankSep,
            nodesep: pLayout?.NodeSep ?? DEFAULT_LAYOUT.NodeSep
        };

        const g = new dagre.graphlib.Graph({ directed: true, multigraph: false, compound: false });
        g.setGraph({
            rankdir: lp.rankdir,
            ranker: lp.ranker,
            nodesep: lp.nodesep,
            edgesep: 20,
            ranksep: lp.ranksep,
            marginx: CANVAS_PAD,
            marginy: CANVAS_PAD,
            acyclicer: "greedy"
        });
        g.setDefaultEdgeLabel(() => ({}));

        for (const t of pTables) {
            const sz = sizeOf(t.id);
            g.setNode(t.id, { width: sz.w, height: sz.h });
        }

        for (const r of pReferences) {
            const from = nameToId.get(r.sourceTable);
            const to = nameToId.get(r.targetTable);
            if (from && to && from !== to && g.hasNode(from) && g.hasNode(to))
                g.setEdge(from, to);
        }

        dagre.layout(g);

        const positions = new Map<string, { x: number; y: number }>();
        for (const t of pTables) {
            const node = g.node(t.id) as { x: number; y: number; width: number; height: number } | undefined;
            if (!node) {
                positions.set(t.id, { x: CANVAS_PAD, y: CANVAS_PAD });
                continue;
            }
            // dagre returns CENTER coordinates; convert to top-left
            positions.set(t.id, { x: Math.round(node.x - node.width / 2), y: Math.round(node.y - node.height / 2) });
        }

        // Snap to grid 20
        const gridStep = 20;
        for (const t of pTables) {
            const p = positions.get(t.id)!;
            p.x = Math.round(p.x / gridStep) * gridStep;
            p.y = Math.round(p.y / gridStep) * gridStep;
        }

        const ids = pTables.map(t => t.id);
        // Offset so layout starts at CANVAS_PAD
        let minX = Infinity;
        let minY = Infinity;
        for (const id of ids) {
            const p = positions.get(id)!;
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
        }
        const dx = CANVAS_PAD - minX;
        const dy = CANVAS_PAD - minY;
        for (const id of ids) {
            const p = positions.get(id)!;
            p.x += dx;
            p.y += dy;
        }

        const groupOfTable = new Map<string, { name: string; color: string }>();
        for (const g of pGrouping.groups) {
            for (const id of g.tableIds) {
                if (!tableMap.has(id)) continue;
                groupOfTable.set(id, { name: g.name, color: g.color });
            }
        }
        const fallbackColor = GROUP_COLORS[GROUP_COLORS.length - 1];
        const byGroup = new Map<string, { color: string; tables: IAITablePlacement[] }>();
        for (const id of ids) {
            const meta = groupOfTable.get(id) ?? { name: "Other", color: fallbackColor };
            if (!byGroup.has(meta.name))
                byGroup.set(meta.name, { color: meta.color, tables: [] });
            const p = positions.get(id)!;
            byGroup.get(meta.name)!.tables.push({ id, x: Math.round(p.x), y: Math.round(p.y) });
        }

        const result: IAIOrganizationPlan = { groups: [] };
        for (const [name, grp] of byGroup)
            result.groups.push({ name, color: grp.color, tables: grp.tables });
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

}
