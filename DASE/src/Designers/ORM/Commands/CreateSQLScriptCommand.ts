/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import * as path from "path";
import type { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";
import { GetLogService } from "../../../Services/LogService";
import { XDesignerMessageType } from "../ORMDesignerMessages";

// ── Database target catalogue ────────────────────────────────────────────────

const SQL_DATABASES: Array<{ id: string; label: string }> = [
    { id: "sqlserver",  label: "SQL Server"  },
    { id: "oracle",     label: "Oracle"      },
    { id: "postgresql", label: "PostgreSQL"  },
    { id: "mysql",      label: "MySQL"       },
    { id: "another",    label: "Another…"    }
];

const DB_HINTS: Record<string, string> = {
    sqlserver:  "SQL Server / T-SQL — IDENTITY(1,1), [bracket] quoting, NVARCHAR",
    oracle:     "Oracle — SEQUENCE + TRIGGER, \"double-quote\" quoting, VARCHAR2, NUMBER",
    postgresql: "PostgreSQL — GENERATED ALWAYS AS IDENTITY, \"double-quote\" quoting, TEXT/VARCHAR",
    mysql:      "MySQL / MariaDB — AUTO_INCREMENT, `backtick` quoting, INT/BIGINT"
};

const DB_QUOTING: Record<string, string> = {
    sqlserver: "[square brackets]",
    oracle:    '"double quotes"',
    postgresql: '"double quotes"',
    mysql:     "`backticks`"
};

const DB_IDENTITY: Record<string, string> = {
    sqlserver:  "IDENTITY(1,1)",
    oracle:     "a dedicated SEQUENCE (seq_{table}_id) with a BEFORE INSERT TRIGGER",
    postgresql: "GENERATED ALWAYS AS IDENTITY",
    mysql:      "AUTO_INCREMENT",
    another:    "an auto-increment mechanism appropriate for the target database"
};

// ── Command class ────────────────────────────────────────────────────────────

export class XCreateSQLScriptCommand {
    private static _PendingModels: vscode.LanguageModelChat[] = [];

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): void {
        const cmdShow = vscode.commands.registerCommand("Dase.CreateSQLScript", async () => {
            await XCreateSQLScriptCommand.ShowPicker(pProvider);
        });

        const cmdExec = vscode.commands.registerCommand(
            "Dase.CreateSQLScriptExecute",
            async (pModelIndex: number, pDatabase: string, pCustomDB: string) => {
                await XCreateSQLScriptCommand.Execute(pModelIndex, pDatabase, pCustomDB, pProvider);
            }
        );

        pContext.subscriptions.push(cmdShow, cmdExec);
    }

    // ── Cost label (same heuristic as OrganizeTables) ────────────────────────

    private static GetCostLabel(pModel: vscode.LanguageModelChat): string {
        const name   = pModel.name.toLowerCase();
        const family = (pModel.family ?? "").toLowerCase();
        if (family === "auto" || name === "auto") return "10% off";
        if (name.includes("opus") && name.includes("fast")) return "30x";
        if (name.includes("opus"))                           return "3x";
        if (name.includes("haiku"))                          return "0.33x";
        if (name.includes("grok") && name.includes("fast")) return "0.25x";
        if (name.includes("flash") ||
            (name.includes("mini") && name.includes("codex"))) return "0.33x";
        if (name.includes("gpt-4.1") || name.includes("gpt-4o") ||
            name.includes("raptor mini") || name.includes("gpt-5 mini")) return "0x";
        return "1x";
    }

    // ── Prompt preview (shown read-only in the picker) ───────────────────────

    static BuildPromptPreview(pDbLabel: string, pTableCount: number, pRefCount: number): string {
        return (
            `Target database: ${pDbLabel}\n\n` +
            `Model: ${pTableCount} table${pTableCount !== 1 ? "s" : ""}, ` +
            `${pRefCount} FK reference${pRefCount !== 1 ? "s" : ""}\n\n` +
            `The AI will receive the full DBML schema and generate:\n` +
            `  • CREATE TABLE with ${pDbLabel}-specific data types\n` +
            `  • PRIMARY KEY constraints and auto-increment identities\n` +
            `  • FOREIGN KEY constraints (ON DELETE NO ACTION)\n` +
            `  • CREATE INDEX for every FK column\n` +
            `  • DROP / IF NOT EXISTS safety guards\n` +
            `  • Schema-prefixed identifiers\n` +
            `  • Descriptive SQL comments per table\n\n` +
            `Output: .sql file saved alongside the .dsorm model.`
        );
    }

    // ── AI prompt (full DBML + instructions) ─────────────────────────────────

    static BuildAIPrompt(
        pDbType:  string,
        pDbLabel: string,
        pDbml:    string,
        pSchema:  string
    ): string {
        const hint     = DB_HINTS[pDbType] ?? `${pDbLabel} (ANSI SQL)`;
        const quoting  = DB_QUOTING[pDbType]  ?? '"double quotes"';
        const identity = DB_IDENTITY[pDbType] ?? DB_IDENTITY.another;
        const oracleTip = pDbType === "oracle"
            ? "- Use VARCHAR2 instead of VARCHAR. Use NUMBER instead of INT/BIGINT.\n"
            : "";
        const txOpen   = (pDbType === "sqlserver" || pDbType === "postgresql")
            ? "BEGIN TRANSACTION;\n" : "";
        const txClose  = (pDbType === "sqlserver" || pDbType === "postgresql")
            ? "COMMIT;\n" : "";
        const schema   = pSchema || "dbo";

        return (
            `You are a senior database architect. Generate a complete, production-ready DDL SQL script.\n\n` +
            `Target database: ${hint}\n` +
            `Schema: ${schema}\n\n` +
            `DBML model:\n` +
            `\`\`\`dbml\n${pDbml}\n\`\`\`\n\n` +
            `Requirements:\n` +
            `- Use only ${pDbLabel}-native data types (map generic DBML types accordingly).\n` +
            `- Quote all identifiers with ${quoting}.\n` +
            `- Use ${identity} for every PK column flagged [pk, increment] in DBML.\n` +
            `- Prefix every object name with the schema (${schema}.TableName etc.).\n` +
            `- Emit a DROP TABLE IF EXISTS guard before each CREATE TABLE.\n` +
            `- Define PRIMARY KEY as an inline column or table-level CONSTRAINT.\n` +
            `- Define FOREIGN KEY constraints with ON DELETE NO ACTION ON UPDATE CASCADE.\n` +
            `- Add a CREATE INDEX (idx_{table}_{col}) for every FK column.\n` +
            `- Add a single-line SQL comment (--) describing each table.\n` +
            oracleTip +
            `- ${txOpen ? "Wrap the entire script in a transaction (" + txOpen.trim() + " / " + txClose.trim() + ").\n" : "Add GO (batch separator) between object creations.\n"}` +
            `- Output ONLY the SQL DDL — no explanations, no markdown code fences.\n`
        );
    }

    // ── Sequential output file path ──────────────────────────────────────────

    static async FindOutputPath(pDocFsPath: string): Promise<vscode.Uri> {
        const dir      = path.dirname(pDocFsPath);
        const baseName = path.basename(pDocFsPath, path.extname(pDocFsPath));

        const firstUri = vscode.Uri.file(path.join(dir, `${baseName}.sql`));
        try {
            await vscode.workspace.fs.stat(firstUri);
        }
        catch {
            return firstUri;   // Does not exist → safe to use
        }

        // Name taken — find first available sequenced slot
        for (let seq = 1; seq <= 999; seq++) {
            const seqUri = vscode.Uri.file(path.join(dir, `${baseName}_${seq}.sql`));
            try {
                await vscode.workspace.fs.stat(seqUri);
            }
            catch {
                return seqUri;
            }
        }

        // Fallback: timestamp-stamped name (should never happen in practice)
        return vscode.Uri.file(path.join(dir, `${baseName}_${Date.now()}.sql`));
    }

    // ── Phase 1: show picker ─────────────────────────────────────────────────

    private static async ShowPicker(pProvider: XORMDesignerEditorProvider): Promise<void> {
        const state = pProvider.GetActiveState();
        if (!state) {
            vscode.window.showWarningMessage("No ORM Designer is open. Open a .dsorm file first.");
            return;
        }

        const modelData = state.GetModelData();
        const tableCount = modelData?.Tables?.length ?? 0;
        if (tableCount === 0) {
            vscode.window.showInformationMessage("The model has no tables to generate SQL for.");
            return;
        }
        const refCount = modelData?.References?.length ?? 0;

        let allModels: vscode.LanguageModelChat[];
        try {
            allModels = await vscode.lm.selectChatModels();
        }
        catch {
            allModels = [];
        }

        if (!allModels || allModels.length === 0) {
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

        XCreateSQLScriptCommand._PendingModels = sortedModels;

        const panel = pProvider.GetActivePanel();
        panel?.webview.postMessage({
            Type: XDesignerMessageType.SQLScriptShowPicker,
            Payload: {
                tableCount,
                refCount,
                databases: SQL_DATABASES,
                promptPreview: XCreateSQLScriptCommand.BuildPromptPreview(
                    "SQL Server", tableCount, refCount
                ),
                models: sortedModels.map((m, i) => ({
                    index: i,
                    name: m.name,
                    vendor: m.vendor,
                    family: m.family,
                    maxInputTokens: m.maxInputTokens,
                    costLabel: XCreateSQLScriptCommand.GetCostLabel(m)
                }))
            }
        });
    }

    // ── Phase 2: execute ─────────────────────────────────────────────────────

    private static async Execute(
        pModelIndex: number,
        pDatabase:   string,
        pCustomDB:   string,
        pProvider:   XORMDesignerEditorProvider
    ): Promise<void> {
        const log    = GetLogService();
        const models = XCreateSQLScriptCommand._PendingModels;

        if (pModelIndex < 0 || pModelIndex >= models.length) {
            vscode.window.showWarningMessage("Invalid model selection.");
            return;
        }

        const state = pProvider.GetActiveState();
        if (!state) {
            vscode.window.showWarningMessage("No ORM Designer is open.");
            return;
        }

        const modelData  = state.GetModelData();
        const tableCount = modelData?.Tables?.length ?? 0;
        if (tableCount === 0) {
            vscode.window.showInformationMessage("The model has no tables.");
            return;
        }

        const model  = models[pModelIndex];
        const panel  = pProvider.GetActivePanel();

        const DB_LABELS: Record<string, string> = {
            sqlserver:  "SQL Server",
            oracle:     "Oracle",
            postgresql: "PostgreSQL",
            mysql:      "MySQL",
            another:    "Generic SQL"
        };
        const dbLabel = (pDatabase === "another" && pCustomDB?.trim())
            ? pCustomDB.trim()
            : (DB_LABELS[pDatabase] ?? pDatabase);

        panel?.webview.postMessage({
            Type: XDesignerMessageType.SQLScriptStart,
            Payload: { model: model.name, vendor: model.vendor, database: dbLabel }
        });

        const sendProgress = (pMsg: string, pPct: number, pStep: string) => {
            panel?.webview.postMessage({
                Type: XDesignerMessageType.SQLScriptProgress,
                Payload: { message: pMsg, percent: pPct, step: pStep }
            });
        };

        const docUri  = pProvider.GetActiveUri();
        const docPath = docUri?.fsPath ?? "";

        await vscode.window.withProgress({
            location:    vscode.ProgressLocation.Notification,
            title:       `🗄️ Generating ${dbLabel} SQL with ${model.name}…`,
            cancellable: true
        }, async (progress, token) => {
            try {
                progress.report({ message: "Exporting model to DBML…", increment: 5 });
                sendProgress("Exporting model to DBML…", 5, "export");

                const dbml = state.ExportToDBML();
                if (!dbml || dbml.trim().length < 10) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.SQLScriptError,
                        Payload: { message: "DBML export returned empty content." }
                    });
                    return;
                }

                const schema = (modelData as any)?.Schema ?? "dbo";
                const prompt = XCreateSQLScriptCommand.BuildAIPrompt(pDatabase, dbLabel, dbml, schema);

                progress.report({ message: `Sending to ${model.name}…`, increment: 10 });
                sendProgress(`Sending schema to ${model.name}…`, 15, "sending");

                const messages  = [vscode.LanguageModelChatMessage.User(prompt)];
                const response  = await model.sendRequest(messages, {}, token);

                progress.report({ message: "AI is generating SQL…", increment: 15 });
                sendProgress("AI is generating DDL statements…", 30, "generating");

                let sqlText   = "";
                let charCount = 0;

                for await (const fragment of response.text) {
                    if (token.isCancellationRequested) {
                        panel?.webview.postMessage({
                            Type: XDesignerMessageType.SQLScriptError,
                            Payload: { message: "Cancelled." }
                        });
                        return;
                    }

                    sqlText   += fragment;
                    charCount += fragment.length;

                    if (charCount % 80 < fragment.length) {
                        const lines = sqlText.split("\n").length;
                        const pct = 30 + Math.min(Math.floor(charCount / 30), 50);
                        sendProgress(`Generating SQL… ${lines} lines`, pct, "streaming");
                    }
                }

                // Strip markdown fences if AI wrapped the answer
                sqlText = sqlText
                    .replace(/^```[a-z]*\n?/m, "")
                    .replace(/```\s*$/m, "")
                    .trim();

                if (!sqlText || sqlText.length < 20) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.SQLScriptError,
                        Payload: { message: "AI returned an empty or too-short SQL script." }
                    });
                    return;
                }

                progress.report({ message: "Saving file…", increment: 10 });
                sendProgress("Saving SQL file…", 85, "saving");

                if (!docPath) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.SQLScriptError,
                        Payload: { message: "Cannot determine model file path." }
                    });
                    return;
                }

                const outputUri  = await XCreateSQLScriptCommand.FindOutputPath(docPath);
                const sqlBytes   = Buffer.from(sqlText, "utf-8");
                await vscode.workspace.fs.writeFile(outputUri, sqlBytes);

                const fileName  = path.basename(outputUri.fsPath);
                const lineCount = sqlText.split("\n").length;

                progress.report({ message: "Done!", increment: 5 });
                sendProgress(`Saved ${fileName} (${lineCount} lines).`, 100, "done");

                panel?.webview.postMessage({
                    Type: XDesignerMessageType.SQLScriptComplete,
                    Payload: {
                        success:   true,
                        filePath:  outputUri.fsPath,
                        fileName,
                        lineCount,
                        database:  dbLabel
                    }
                });

                vscode.window.showInformationMessage(
                    `✅ SQL script saved: ${fileName} (${lineCount} lines)`,
                    "Open File"
                ).then(action => {
                    if (action === "Open File")
                        vscode.window.showTextDocument(outputUri);
                });
            }
            catch (err: any) {
                if (err?.name === "CancellationError" || token.isCancellationRequested) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.SQLScriptError,
                        Payload: { message: "Cancelled." }
                    });
                    vscode.window.showInformationMessage("SQL generation cancelled.");
                    return;
                }

                log.Error("CreateSQLScript failed", err);
                const errMsg = err?.message ?? String(err);
                panel?.webview.postMessage({
                    Type: XDesignerMessageType.SQLScriptError,
                    Payload: { message: `Error: ${errMsg}` }
                });
                vscode.window.showErrorMessage(`SQL script generation failed: ${errMsg}`);
            }
        });
    }
}
