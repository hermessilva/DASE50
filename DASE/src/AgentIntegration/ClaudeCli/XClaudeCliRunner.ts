import { spawn, ChildProcess } from "child_process";
import { XClaudeCliDiscovery, IClaudeCliInfo } from "./XClaudeCliDiscovery";
import { XClaudeCliStreamParser, IClaudeStreamUsage } from "./XClaudeCliStreamParser";

export interface IClaudeRunRequest {
    Family: string;
    SystemPrompt: string;
    UserPayload: string;
    OnChunk?: (pDelta: string) => void;
    IsCancelled?: () => boolean;
    OnCancelHook?: (pAbort: () => void) => void;
}

export interface IClaudeRunResult {
    Text: string;
    Usage: IClaudeStreamUsage;
    Error: string | null;
}

const KILL_GRACE_MS = 2000;

export interface IClaudeCliRunnerOptions {
    ResolveInfo?: () => Promise<IClaudeCliInfo | null>;
    Spawn?: typeof spawn;
}

export class XClaudeCliRunner {
    private readonly _ResolveInfo: () => Promise<IClaudeCliInfo | null>;
    private readonly _Spawn: typeof spawn;

    constructor(pOptions?: IClaudeCliRunnerOptions) {
        this._ResolveInfo = pOptions?.ResolveInfo ?? (() => XClaudeCliDiscovery.Resolve());
        this._Spawn = pOptions?.Spawn ?? spawn;
    }

    async IsAvailable(): Promise<IClaudeCliInfo | null> {
        const info = await this._ResolveInfo();
        if (!info || !info.Authenticated)
            return null;
        return info;
    }

    async Run(pRequest: IClaudeRunRequest): Promise<IClaudeRunResult> {
        const info = await this._ResolveInfo();
        if (!info)
            throw new Error("Claude Code CLI not found on PATH or known install locations.");
        if (!info.Authenticated)
            throw new Error("Claude Code CLI is not authenticated. Run `claude login` in a terminal first.");

        const args: string[] = [
            "--print",
            "--output-format", "stream-json",
            "--verbose",
            "--max-turns", "1",
            "--model", pRequest.Family
        ];
        if (pRequest.SystemPrompt.length > 0) {
            args.push("--system-prompt");
            args.push(pRequest.SystemPrompt);
        }

        const parser = new XClaudeCliStreamParser(pRequest.OnChunk);

        await this.RunStreaming(info.BinaryPath, args, pRequest.UserPayload, parser, pRequest);
        const final = parser.Finish();
        if (final.Error)
            throw new Error(`Claude Code CLI error: ${final.Error}`);
        return final;
    }

    private RunStreaming(
        pBinary: string,
        pArgs: string[],
        pStdin: string,
        pParser: XClaudeCliStreamParser,
        pRequest: IClaudeRunRequest
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

            const abort = () => {
                try { child.kill("SIGTERM"); } catch { /* ignore */ }
                killTimer = setTimeout(() => {
                    try { child.kill("SIGKILL"); } catch { /* ignore */ }
                }, KILL_GRACE_MS);
            };

            pRequest.OnCancelHook?.(abort);

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
                if (killTimer) clearTimeout(killTimer);
                if (pErr) reject(pErr);
                else resolve();
            };

            child.on("error", (err) => done(err));
            child.on("close", (code) => {
                if (pRequest.IsCancelled?.()) {
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
