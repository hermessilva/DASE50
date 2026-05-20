import * as vscode from "vscode";
import { spawn, ChildProcess } from "child_process";
import { XClaudeCliDiscovery, IClaudeCliInfo, SpawnCliSafe } from "./XClaudeCliDiscovery";
import { XClaudeCliStreamParser } from "./XClaudeCliStreamParser";
import { GetLogService } from "../../Services/LogService";

export const CLAUDE_CLI_VENDOR = "claude-code";

export interface IClaudeCliModelSpec {
    Id: string;
    Family: string;
    Name: string;
    MaxInputTokens: number;
    MaxOutputTokens: number;
    CostLabel: string;
}

export const CLAUDE_CLI_MODELS: IClaudeCliModelSpec[] = [
    {
        Id: "claude-code-opus-4",
        Family: "claude-opus-4-20250514",
        Name: "Claude Code · Opus 4",
        MaxInputTokens: 200_000,
        MaxOutputTokens: 32_000,
        CostLabel: "Opus"
    },
    {
        Id: "claude-code-sonnet-4",
        Family: "claude-sonnet-4-20250514",
        Name: "Claude Code · Sonnet 4",
        MaxInputTokens: 200_000,
        MaxOutputTokens: 32_000,
        CostLabel: "Sonnet"
    },
    {
        Id: "claude-code-haiku-4",
        Family: "claude-haiku-4-5-20251001",
        Name: "Claude Code · Haiku 4.5",
        MaxInputTokens: 200_000,
        MaxOutputTokens: 16_000,
        CostLabel: "Haiku"
    }
];

const KILL_GRACE_MS = 2000;

export class XClaudeCliProvider implements vscode.LanguageModelChatProvider {
    private _Info: IClaudeCliInfo | null = null;
    private readonly _ResolveInfo: () => Promise<IClaudeCliInfo | null>;
    private readonly _Spawn: typeof spawn;

    constructor(pOptions?: {
        ResolveInfo?: () => Promise<IClaudeCliInfo | null>;
        Spawn?: typeof spawn;
    }) {
        this._ResolveInfo = pOptions?.ResolveInfo ?? XClaudeCliProvider.DefaultResolveInfo;
        this._Spawn = pOptions?.Spawn ?? (SpawnCliSafe as unknown as typeof spawn);
    }

    private static DefaultResolveInfo(): Promise<IClaudeCliInfo | null> {
        return XClaudeCliDiscovery.Resolve();
    }

    async provideLanguageModelChatInformation(
        _pOptions: vscode.PrepareLanguageModelChatModelOptions,
        _pToken: vscode.CancellationToken
    ): Promise<vscode.LanguageModelChatInformation[]> {
        const log = GetLogService();
        log.Info("Claude Code provider: provideLanguageModelChatInformation called");
        const info = await this._ResolveInfo();
        if (!info) {
            log.Warn("Claude Code provider: CLI binary not found on PATH or known install locations. Install Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code/setup");
            return [];
        }
        this._Info = info;
        log.Info(`Claude Code provider: CLI found at ${info.BinaryPath} version ${info.Version} authenticated=${info.Authenticated}`);

        if (!info.Authenticated) {
            log.Warn("Claude Code CLI not authenticated. Run 'claude login' in a terminal.");
            return [];
        }

        log.Info(`Claude Code provider: exposing ${CLAUDE_CLI_MODELS.length} models`);
        return CLAUDE_CLI_MODELS.map<vscode.LanguageModelChatInformation>(spec => ({
            id: spec.Id,
            name: spec.Name,
            family: spec.Family,
            version: info.Version,
            maxInputTokens: spec.MaxInputTokens,
            maxOutputTokens: spec.MaxOutputTokens,
            tooltip: `${spec.Name} via local Claude Code CLI (${info.Version})`,
            detail: spec.CostLabel,
            capabilities: { imageInput: false, toolCalling: false }
        }));
    }

    async provideLanguageModelChatResponse(
        pModel: vscode.LanguageModelChatInformation,
        pMessages: readonly vscode.LanguageModelChatRequestMessage[],
        _pOptions: vscode.ProvideLanguageModelChatResponseOptions,
        pProgress: vscode.Progress<vscode.LanguageModelResponsePart>,
        pToken: vscode.CancellationToken
    ): Promise<void> {
        const info = this._Info ?? await this._ResolveInfo();
        if (!info)
            throw new Error("Claude Code CLI not found on PATH or known install locations.");
        if (!info.Authenticated)
            throw new Error("Claude Code CLI is not authenticated. Run `claude login` in a terminal first.");

        const { SystemPrompt, UserPayload } = this.ExtractMessages(pMessages);

        const args: string[] = [
            "--print",
            "--output-format", "stream-json",
            "--verbose",
            "--max-turns", "1",
            "--model", pModel.family
        ];
        if (SystemPrompt.length > 0) {
            args.push("--system-prompt");
            args.push(SystemPrompt);
        }

        const parser = new XClaudeCliStreamParser((pDelta) => {
            pProgress.report(new vscode.LanguageModelTextPart(pDelta));
        });

        await this.RunStreaming(info.BinaryPath, args, UserPayload, parser, pToken);

        const final = parser.Finish();
        if (final.Error)
            throw new Error(`Claude Code CLI error: ${final.Error}`);
        if (final.Text.length === 0)
            throw new Error("Claude Code CLI returned an empty response.");

        const usage = final.Usage;
        GetLogService().Info(
            `Claude Code usage — in:${usage.InputTokens} out:${usage.OutputTokens} cacheRead:${usage.CacheReadTokens} cacheWrite:${usage.CacheCreationTokens}`
        );
    }

    async provideTokenCount(
        _pModel: vscode.LanguageModelChatInformation,
        pText: string | vscode.LanguageModelChatRequestMessage,
        _pToken: vscode.CancellationToken
    ): Promise<number> {
        const text = typeof pText === "string" ? pText : this.StringifyMessage(pText);
        return Math.ceil(text.length / 4);
    }

    private ExtractMessages(
        pMessages: readonly vscode.LanguageModelChatRequestMessage[]
    ): { SystemPrompt: string; UserPayload: string } {
        const systemParts: string[] = [];
        const userParts: string[] = [];
        for (const m of pMessages) {
            const text = this.StringifyMessage(m);
            if (m.name === "system") {
                systemParts.push(text);
                continue;
            }
            if (m.role === vscode.LanguageModelChatMessageRole.Assistant) {
                userParts.push("[previous-assistant]\n" + text);
                continue;
            }
            userParts.push(text);
        }
        return { SystemPrompt: systemParts.join("\n\n"), UserPayload: userParts.join("\n\n") };
    }

    private StringifyMessage(pMsg: vscode.LanguageModelChatRequestMessage): string {
        const out: string[] = [];
        for (const part of pMsg.content) {
            if (part instanceof vscode.LanguageModelTextPart)
                out.push(part.value);
        }
        return out.join("");
    }

    private RunStreaming(
        pBinary: string,
        pArgs: string[],
        pStdin: string,
        pParser: XClaudeCliStreamParser,
        pToken: vscode.CancellationToken
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let settled = false;
            let killTimer: NodeJS.Timeout | null = null;
            let child: ChildProcess;
            try {
                child = this._Spawn(pBinary, pArgs, { windowsHide: true });
            }
            catch (err) {
                reject(err);
                return;
            }

            const cancelSub = pToken.onCancellationRequested(() => {
                try { child.kill("SIGTERM"); } catch { /* ignore */ }
                killTimer = setTimeout(() => {
                    try { child.kill("SIGKILL"); } catch { /* ignore */ }
                }, KILL_GRACE_MS);
            });

            child.stdout?.on("data", (chunk: Buffer) => {
                pParser.Feed(chunk.toString("utf8"));
            });

            let stderr = "";
            child.stderr?.on("data", (chunk: Buffer) => {
                stderr += chunk.toString("utf8");
            });

            const done = (pErr: Error | null) => {
                if (settled) return;
                settled = true;
                cancelSub.dispose();
                if (killTimer) clearTimeout(killTimer);
                if (pErr) reject(pErr);
                else resolve();
            };

            child.on("error", (err) => done(err));
            child.on("close", (code) => {
                if (pToken.isCancellationRequested) {
                    done(new Error("Cancelled"));
                    return;
                }
                if (code !== 0 && code !== null) {
                    done(new Error(`Claude Code CLI exited with code ${code}: ${stderr.trim()}`));
                    return;
                }
                done(null);
            });

            if (child.stdin) {
                child.stdin.on("error", () => { /* swallow EPIPE on cancel */ });
                child.stdin.end(pStdin);
            }
        });
    }
}

export function RegisterClaudeCliProvider(pContext: vscode.ExtensionContext): vscode.Disposable | null {
    const log = GetLogService();
    if (typeof vscode.lm?.registerLanguageModelChatProvider !== "function") {
        log.Warn("Claude Code provider: vscode.lm.registerLanguageModelChatProvider unavailable");
        return null;
    }
    try {
        const provider = new XClaudeCliProvider();
        const disposable = vscode.lm.registerLanguageModelChatProvider(CLAUDE_CLI_VENDOR, provider);
        pContext.subscriptions.push(disposable);
        log.Info("Claude Code CLI provider registered");
        return disposable;
    }
    catch (err) {
        log.Error("Claude Code CLI provider registration failed", err);
        return null;
    }
}
