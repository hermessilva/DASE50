/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import * as path from "path";
import type { XORMDesignerEditorProvider } from "../ORMDesignerEditorProvider";
import { GetLogService } from "../../../Services/LogService";
import { XDesignerMessageType } from "../ORMDesignerMessages";

// ── ORM target definitions ────────────────────────────────────────────────────

export const ORM_TARGETS: Array<{
    id: string;
    language: string;
    orm: string;
    ext: string;
    icon: string;
    contextLabel: string;
    contextFilters: Record<string, string[]>;
}> = [
    {
        id: "efcore",
        language: "C#",
        orm: "EF Core",
        ext: ".cs",
        icon: "⚙️",
        contextLabel: "DbContext file (.cs)",
        contextFilters: { "C# Files": ["cs"] }
    },
    {
        id: "prisma",
        language: "JS / TS",
        orm: "Prisma",
        ext: ".prisma",
        icon: "🔺",
        contextLabel: "Prisma schema (.prisma)",
        contextFilters: { "Prisma Schema": ["prisma"] }
    },
    {
        id: "sqlalchemy",
        language: "Python",
        orm: "SQLAlchemy",
        ext: ".py",
        icon: "🐍",
        contextLabel: "Models file (.py)",
        contextFilters: { "Python Files": ["py"] }
    },
    {
        id: "hibernate",
        language: "Java",
        orm: "Hibernate / JPA",
        ext: ".java",
        icon: "☕",
        contextLabel: "Entity or persistence file (.java, .xml)",
        contextFilters: { "Java / XML Files": ["java", "xml"] }
    },
    {
        id: "gorm",
        language: "Go",
        orm: "GORM",
        ext: ".go",
        icon: "🐹",
        contextLabel: "Go model file (.go)",
        contextFilters: { "Go Files": ["go"] }
    }
];

// ── DB type map: DBML generic → ORM-specific ─────────────────────────────────

const TYPE_HINTS: Record<string, Record<string, string>> = {
    efcore: {
        hint: "string→string, int→int, bigint→long, boolean→bool, datetime→DateTime, decimal→decimal, guid→Guid, text→string, float→double"
    },
    prisma: {
        hint: "string→String, int→Int, bigint→BigInt, boolean→Boolean, datetime→DateTime, decimal→Decimal, float→Float, text→String"
    },
    sqlalchemy: {
        hint: "string→String(n), int→Integer, bigint→BigInteger, boolean→Boolean, datetime→DateTime, decimal→Numeric(p,s), float→Float, text→Text, guid→String(36)"
    },
    hibernate: {
        hint: "string→String/@Column(length=n), int→Integer/int, bigint→Long/long, boolean→Boolean/boolean, datetime→LocalDateTime, decimal→BigDecimal, float→Double/double, guid→String(36)"
    },
    gorm: {
        hint: "string→string `gorm:\"type:varchar(n)\"`, int→int `gorm:\"type:int\"`, bigint→int64, boolean→bool, datetime→time.Time, decimal→float64, uuid→string `gorm:\"type:uuid\"`"
    }
};

// ── Command class ─────────────────────────────────────────────────────────────

export class XGenerateORMCodeCommand {
    private static _PendingModels: vscode.LanguageModelChat[] = [];

    static Register(pContext: vscode.ExtensionContext, pProvider: XORMDesignerEditorProvider): void {
        const cmdShow = vscode.commands.registerCommand("Dase.GenerateORMCode", async () => {
            await XGenerateORMCodeCommand.ShowPicker(pProvider);
        });

        const cmdExec = vscode.commands.registerCommand(
            "Dase.GenerateORMCodeExecute",
            async (pModelIndex: number, pOrmId: string, pContextContent: string) => {
                await XGenerateORMCodeCommand.Execute(pModelIndex, pOrmId, pContextContent, pProvider);
            }
        );

        const cmdBrowse = vscode.commands.registerCommand(
            "Dase.ORMGenBrowseContext",
            async (pOrmId: string) => {
                await XGenerateORMCodeCommand.BrowseContext(pOrmId, pProvider);
            }
        );

        pContext.subscriptions.push(cmdShow, cmdExec, cmdBrowse);
    }

    // ── Cost label (same heuristic as other commands) ─────────────────────────

    private static GetCostLabel(pModel: vscode.LanguageModelChat): string {
        const name   = pModel.name.toLowerCase();
        const family = (pModel.family ?? "").toLowerCase();
        if (family === "auto" || name === "auto")              return "10% off";
        if (name.includes("opus") && name.includes("fast"))    return "30x";
        if (name.includes("opus"))                             return "3x";
        if (name.includes("haiku"))                            return "0.33x";
        if (name.includes("grok") && name.includes("fast"))   return "0.25x";
        if (name.includes("flash") || (name.includes("mini") && name.includes("codex"))) return "0.33x";
        if (name.includes("gpt-4.1") || name.includes("gpt-4o") ||
            name.includes("raptor mini") || name.includes("gpt-5 mini")) return "0x";
        return "1x";
    }

    // ── Prompt preview ────────────────────────────────────────────────────────

    static BuildPromptPreview(
        pOrmLabel:   string,
        pTableCount: number,
        pRefCount:   number,
        pHasContext: boolean
    ): string {
        return (
            `Target ORM: ${pOrmLabel}\n\n` +
            `Model: ${pTableCount} table${pTableCount !== 1 ? "s" : ""}, ` +
            `${pRefCount} FK reference${pRefCount !== 1 ? "s" : ""}\n\n` +
            `The AI will receive the full DBML schema and generate:\n` +
            `  • Entity / model classes for every table\n` +
            `  • Primary key and identity configuration\n` +
            `  • Foreign key associations and navigation properties\n` +
            `  • ${pOrmLabel}-specific annotations and conventions\n` +
            (pHasContext ? `  • Code adapted to match your existing context file\n\n` : "\n") +
            `Output: single source file saved alongside the .dsorm model.`
        );
    }

    // ── AI prompt per ORM ─────────────────────────────────────────────────────

    static BuildAIPrompt(
        pOrmId:          string,
        pOrmLabel:       string,
        pDbml:           string,
        pSchema:         string,
        pContextContent: string
    ): string {
        const schema  = pSchema || "dbo";
        const typeMap = TYPE_HINTS[pOrmId]?.hint ?? "";
        const ctx     = pContextContent?.trim()
            ? `\n\nExisting context file (use this as reference for naming, namespaces, base classes, configuration):\n\`\`\`\n${pContextContent.trim()}\n\`\`\`\n`
            : "";

        const orm_instructions: Record<string, string> = {
            efcore:
                `Generate complete C# 12 / .NET 8 EF Core source code:\n` +
                `- One class per table, using [Table("{name}", Schema="{schema}")] attribute.\n` +
                `- [Key] on the primary key property; [DatabaseGenerated(DatabaseGeneratedOption.Identity)] for auto-increment PK.\n` +
                `- [Required] for NOT NULL columns; [StringLength(n)] for string columns with length defined.\n` +
                `- [Column("{colName}")] when the property name differs from the column name.\n` +
                `- [ForeignKey] + virtual navigation properties (ICollection<T> and T) for FK relationships.\n` +
                `- One DbContext class (use existing class name if context file provided, else "{Schema}DbContext").\n` +
                `- DbSet<T> for each entity; override OnModelCreating for fluent API where needed.\n` +
                `- Namespace: deduce from context file if provided, otherwise use "{Schema}".\n` +
                `- Add a // File: {ClassName}.cs comment above each class to help the user split to separate files.\n` +
                `- Type mapping: ${typeMap}.`,

            prisma:
                `Generate a complete Prisma schema file:\n` +
                `- datasource db block with provider placeholder (\"postgresql\") and env(\"DATABASE_URL\").\n` +
                `- generator client block with provider = \"prisma-client-js\".\n` +
                `- One model block per table with @id, @default(autoincrement()), @map, @@map, @@schema.\n` +
                `- @relation(fields: [...], references: [...]) for FK associations with back-references.\n` +
                `- Use @unique for fields that should be unique.\n` +
                `- Respect the schema name "${schema}" using @@schema.\n` +
                `- If an existing schema is provided, update/merge it preserving existing configuration.\n` +
                `- Type mapping: ${typeMap}.`,

            sqlalchemy:
                `Generate complete Python SQLAlchemy 2.x ORM models:\n` +
                `- Use DeclarativeBase subclass as Base; import Column, Integer, String, etc. from sqlalchemy.orm.\n` +
                `- One class per table with __tablename__ = "{name}" and __table_args__ = {\"schema\": \"${schema}\"}.\n` +
                `- Mapped[T] annotation style (SQLAlchemy 2.x): id: Mapped[int] = mapped_column(primary_key=True)\n` +
                `- ForeignKey constraints and relationship() with back_populates for bi-directional navigation.\n` +
                `- Optional[T] for nullable columns, enforce non-nullable with nullable=False.\n` +
                `- If a context/base file is provided, extend the same Base class and match import style.\n` +
                `- Type mapping: ${typeMap}.`,

            hibernate:
                `Generate complete Java 17 JPA / Hibernate entity classes:\n` +
                `- @Entity, @Table(name=\"{name}\", schema=\"${schema}\") on each class.\n` +
                `- @Id + @GeneratedValue(strategy = GenerationType.IDENTITY) on the PK field.\n` +
                `- @Column(name=\"{col}\", nullable=false, length=n) on all fields.\n` +
                `- @ManyToOne(fetch = FetchType.LAZY) + @JoinColumn for FK fields; \n` +
                `  @OneToMany(mappedBy = \"{field}\", cascade = CascadeType.ALL) on the owning side.\n` +
                `- Add Lombok annotations: @Data, @Builder, @NoArgsConstructor, @AllArgsConstructor.\n` +
                `- Package: deduce from context file if provided, otherwise use "com.${schema.toLowerCase()}.model".\n` +
                `- Add // File: {ClassName}.java comment above each class.\n` +
                `- Type mapping: ${typeMap}.`,

            gorm:
                `Generate complete Go GORM (v2) model structs:\n` +
                `- Package name: models (or deduce from context file if provided).\n` +
                `- One exported struct per table.\n` +
                `- Use gorm:\"column:x;primaryKey;autoIncrement\" tags; also add json:\"x\" tags.\n` +
                `- Embed gorm.Model for tables that have id, created_at, updated_at, deleted_at (otherwise define fields manually).\n` +
                `- FK associations: BelongsTo with foreign key field + struct pointer; HasMany with slice pointer.\n` +
                `- Use TableName() method to return the schema-qualified table name ("${schema}.{tableName}").\n` +
                `- Type mapping: ${typeMap}.`
        };

        const instructions = orm_instructions[pOrmId] ??
            `Generate ${pOrmLabel} ORM model code for all tables and relationships.`;

        return (
            `You are a senior software engineer. Generate complete, production-ready ${pOrmLabel} ORM source code.\n\n` +
            `DBML model:\n\`\`\`dbml\n${pDbml}\n\`\`\`\n` +
            ctx +
            `\nInstructions:\n${instructions}\n\n` +
            `- Emit clean, well-formatted code with appropriate spacing.\n` +
            `- Do NOT include any explanation or markdown — output ONLY source code.\n` +
            `- Ensure referential integrity: all FK relationships are represented in both directions.\n`
        );
    }

    // ── Sequential output path ────────────────────────────────────────────────

    static async FindOutputPath(pDocFsPath: string, pExt: string): Promise<vscode.Uri> {
        const dir      = path.dirname(pDocFsPath);
        const baseName = path.basename(pDocFsPath, path.extname(pDocFsPath));

        const firstUri = vscode.Uri.file(path.join(dir, `${baseName}${pExt}`));
        try { await vscode.workspace.fs.stat(firstUri); }
        catch { return firstUri; }

        for (let seq = 1; seq <= 999; seq++) {
            const seqUri = vscode.Uri.file(path.join(dir, `${baseName}_${seq}${pExt}`));
            try { await vscode.workspace.fs.stat(seqUri); }
            catch { return seqUri; }
        }

        return vscode.Uri.file(path.join(dir, `${baseName}_${Date.now()}${pExt}`));
    }

    // ── Phase 1: browse context file ──────────────────────────────────────────

    private static async BrowseContext(
        pOrmId:    string,
        pProvider: XORMDesignerEditorProvider
    ): Promise<void> {
        const target  = ORM_TARGETS.find(t => t.id === pOrmId) ?? ORM_TARGETS[0];
        const filters: Record<string, string[]> = {
            ...target.contextFilters,
            "All Files": ["*"]
        };

        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: "Select context file",
            filters
        });

        if (!uris || uris.length === 0) return;

        const uri = uris[0];
        let content = "";
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            content = Buffer.from(bytes).toString("utf-8");
        }
        catch {
            vscode.window.showWarningMessage("Could not read context file.");
            return;
        }

        const panel = pProvider.GetActivePanel();
        panel?.webview.postMessage({
            Type: XDesignerMessageType.ORMGenContextLoaded,
            Payload: {
                fileName: path.basename(uri.fsPath),
                content
            }
        });
    }

    // ── Phase 1: show picker ──────────────────────────────────────────────────

    private static async ShowPicker(pProvider: XORMDesignerEditorProvider): Promise<void> {
        const state = pProvider.GetActiveState();
        if (!state) {
            vscode.window.showWarningMessage("No ORM Designer is open. Open a .dsorm file first.");
            return;
        }

        const modelData  = state.GetModelData();
        const tableCount = modelData?.Tables?.length ?? 0;
        if (tableCount === 0) {
            vscode.window.showInformationMessage("The model has no tables to generate ORM code from.");
            return;
        }
        const refCount = modelData?.References?.length ?? 0;

        let allModels: vscode.LanguageModelChat[];
        try { allModels = await vscode.lm.selectChatModels(); }
        catch { allModels = []; }

        if (!allModels || allModels.length === 0) {
            vscode.window.showWarningMessage(
                "No AI language model available. Please install GitHub Copilot or another LLM extension."
            );
            return;
        }

        const sorted = [...allModels].sort((a, b) => {
            const v = a.vendor.localeCompare(b.vendor);
            return v !== 0 ? v : a.family.localeCompare(b.family);
        });

        XGenerateORMCodeCommand._PendingModels = sorted;

        const panel = pProvider.GetActivePanel();
        panel?.webview.postMessage({
            Type: XDesignerMessageType.ORMGenShowPicker,
            Payload: {
                tableCount,
                refCount,
                ormTargets: ORM_TARGETS.map(t => ({
                    id:       t.id,
                    language: t.language,
                    orm:      t.orm,
                    ext:      t.ext,
                    icon:     t.icon,
                    contextLabel: t.contextLabel
                })),
                promptPreview: XGenerateORMCodeCommand.BuildPromptPreview(
                    "C# / EF Core", tableCount, refCount, false
                ),
                models: sorted.map((m, i) => ({
                    index:       i,
                    name:        m.name,
                    vendor:      m.vendor,
                    family:      m.family,
                    costLabel:   XGenerateORMCodeCommand.GetCostLabel(m)
                }))
            }
        });
    }

    // ── Phase 2: execute ──────────────────────────────────────────────────────

    private static async Execute(
        pModelIndex:     number,
        pOrmId:          string,
        pContextContent: string,
        pProvider:       XORMDesignerEditorProvider
    ): Promise<void> {
        const log    = GetLogService();
        const models = XGenerateORMCodeCommand._PendingModels;

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

        const target  = ORM_TARGETS.find(t => t.id === pOrmId) ?? ORM_TARGETS[0];
        const model   = models[pModelIndex];
        const panel   = pProvider.GetActivePanel();
        const ormLabel = `${target.language} / ${target.orm}`;

        panel?.webview.postMessage({
            Type: XDesignerMessageType.ORMGenStart,
            Payload: { model: model.name, vendor: model.vendor, orm: ormLabel }
        });

        const sendProgress = (pMsg: string, pPct: number, pStep: string) => {
            panel?.webview.postMessage({
                Type: XDesignerMessageType.ORMGenProgress,
                Payload: { message: pMsg, percent: pPct, step: pStep }
            });
        };

        const docUri  = pProvider.GetActiveUri();
        const docPath = docUri?.fsPath ?? "";

        await vscode.window.withProgress({
            location:    vscode.ProgressLocation.Notification,
            title:       `⚙️ Generating ${ormLabel} code with ${model.name}…`,
            cancellable: true
        }, async (progress, token) => {
            try {
                progress.report({ message: "Exporting model to DBML…", increment: 5 });
                sendProgress("Exporting model to DBML…", 5, "export");

                const dbml = state.ExportToDBML();
                if (!dbml || dbml.trim().length < 10) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.ORMGenError,
                        Payload: { message: "DBML export returned empty content." }
                    });
                    return;
                }

                const schema = (modelData as any)?.Schema ?? "dbo";
                const prompt = XGenerateORMCodeCommand.BuildAIPrompt(
                    pOrmId, ormLabel, dbml, schema, pContextContent ?? ""
                );

                progress.report({ message: `Sending to ${model.name}…`, increment: 10 });
                sendProgress(`Sending schema to ${model.name}…`, 15, "sending");

                const messages = [vscode.LanguageModelChatMessage.User(prompt)];
                const response = await model.sendRequest(messages, {}, token);

                progress.report({ message: "AI is generating ORM code…", increment: 15 });
                sendProgress("Generating ORM classes…", 30, "generating");

                let codeText  = "";
                let charCount = 0;

                for await (const fragment of response.text) {
                    if (token.isCancellationRequested) {
                        panel?.webview.postMessage({
                            Type: XDesignerMessageType.ORMGenError,
                            Payload: { message: "Cancelled." }
                        });
                        return;
                    }
                    codeText  += fragment;
                    charCount += fragment.length;
                    if (charCount % 100 < fragment.length) {
                        const lines = codeText.split("\n").length;
                        const pct   = 30 + Math.min(Math.floor(charCount / 30), 55);
                        sendProgress(`Generating… ${lines} lines`, pct, "streaming");
                    }
                }

                // Strip markdown fences if the AI wrapped the response
                codeText = codeText
                    .replace(/^```[a-z]*\n?/m, "")
                    .replace(/```\s*$/m, "")
                    .trim();

                if (!codeText || codeText.length < 20) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.ORMGenError,
                        Payload: { message: "AI returned empty or too-short code." }
                    });
                    return;
                }

                progress.report({ message: "Saving file…", increment: 10 });
                sendProgress("Saving generated file…", 88, "saving");

                if (!docPath) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.ORMGenError,
                        Payload: { message: "Cannot determine model file path." }
                    });
                    return;
                }

                const outputUri  = await XGenerateORMCodeCommand.FindOutputPath(docPath, target.ext);
                await vscode.workspace.fs.writeFile(outputUri, Buffer.from(codeText, "utf-8"));

                const fileName  = path.basename(outputUri.fsPath);
                const lineCount = codeText.split("\n").length;

                progress.report({ message: "Done!", increment: 5 });
                sendProgress(`Saved ${fileName} (${lineCount} lines).`, 100, "done");

                panel?.webview.postMessage({
                    Type: XDesignerMessageType.ORMGenComplete,
                    Payload: {
                        success:   true,
                        filePath:  outputUri.fsPath,
                        fileName,
                        lineCount,
                        orm:       ormLabel
                    }
                });

                vscode.window.showInformationMessage(
                    `✅ ORM code saved: ${fileName} (${lineCount} lines)`,
                    "Open File"
                ).then(action => {
                    if (action === "Open File")
                        vscode.window.showTextDocument(outputUri);
                });
            }
            catch (err: any) {
                if (err?.name === "CancellationError" || token.isCancellationRequested) {
                    panel?.webview.postMessage({
                        Type: XDesignerMessageType.ORMGenError,
                        Payload: { message: "Cancelled." }
                    });
                    vscode.window.showInformationMessage("ORM code generation cancelled.");
                    return;
                }
                log.Error("GenerateORMCode failed", err);
                const errMsg = err?.message ?? String(err);
                panel?.webview.postMessage({
                    Type: XDesignerMessageType.ORMGenError,
                    Payload: { message: `Error: ${errMsg}` }
                });
                vscode.window.showErrorMessage(`ORM code generation failed: ${errMsg}`);
            }
        });
    }
}
