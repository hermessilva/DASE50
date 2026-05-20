import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, SpawnOptions, ChildProcess } from "child_process";
import { GetLogService } from "../../Services/LogService";

export function SpawnCliSafe(pBinary: string, pArgs: string[], pOptions: SpawnOptions): ChildProcess
{
    const lower = pBinary.toLowerCase();
    const isWinCmd = process.platform === "win32" && (lower.endsWith(".cmd") || lower.endsWith(".bat"));
    if (!isWinCmd)
        return spawn(pBinary, pArgs, pOptions);

    const quote = (a: string): string =>
    {
        if (a.length === 0)
            return "\"\"";
        if (!/[\s"&|<>^()%!]/.test(a))
            return a;
        return "\"" + a.replace(/(\\*)"/g, "$1$1\\\"").replace(/(\\+)$/, "$1$1") + "\"";
    };
    // cmd.exe /S strips ONE outer pair of quotes from the /C argument.
    // Wrap the full command line in extra quotes so the binary path's quotes survive.
    const cmdLine = "\"\"" + pBinary + "\" " + pArgs.map(quote).join(" ") + "\"";
    return spawn("cmd.exe", ["/d", "/s", "/c", cmdLine], { ...pOptions, windowsVerbatimArguments: true });
}

export interface IClaudeCliInfo {
    BinaryPath: string;
    Version: string;
    Authenticated: boolean;
}

interface ICachedInfo {
    BinaryPath: string;
    Version: string;
    Authenticated: boolean;
    AuthCheckedAt: number;
    BinaryMTimeMs: number;
}

const VERSION_TIMEOUT_MS = 3000;
const AUTH_TTL_MS = 60 * 60 * 1000;

export class XClaudeCliDiscovery {
    private static _Cache: ICachedInfo | null = null;
    private static _OverridePath: string | null = null;

    static SetOverridePath(pPath: string | null): void {
        XClaudeCliDiscovery._OverridePath = pPath;
        XClaudeCliDiscovery._Cache = null;
    }

    static ResetCache(): void {
        XClaudeCliDiscovery._Cache = null;
    }

    static async Resolve(): Promise<IClaudeCliInfo | null> {
        const log = GetLogService();
        const cached = XClaudeCliDiscovery._Cache;
        if (cached && XClaudeCliDiscovery.IsCacheFresh(cached)) {
            return {
                BinaryPath: cached.BinaryPath,
                Version: cached.Version,
                Authenticated: cached.Authenticated
            };
        }

        const binary = XClaudeCliDiscovery._OverridePath ?? XClaudeCliDiscovery.FindBinary();
        if (!binary) {
            log.Warn("Claude Code Discovery: binary NOT found on PATH or any known install location.");
            return null;
        }
        log.Info(`Claude Code Discovery: candidate binary = ${binary}`);

        const version = await XClaudeCliDiscovery.GetVersion(binary);
        if (!version) {
            log.Warn(`Claude Code Discovery: '${binary} --version' failed or unparseable. Assuming unavailable.`);
            return null;
        }
        log.Info(`Claude Code Discovery: version = ${version}`);

        // Skip an active auth probe (it would burn tokens and take ~8s).
        // Assume authenticated; real auth errors surface during actual Run().
        const auth = true;
        const stat = XClaudeCliDiscovery.SafeStat(binary);

        XClaudeCliDiscovery._Cache = {
            BinaryPath: binary,
            Version: version,
            Authenticated: auth,
            AuthCheckedAt: Date.now(),
            BinaryMTimeMs: stat?.mtimeMs ?? 0
        };

        return { BinaryPath: binary, Version: version, Authenticated: auth };
    }

    private static IsCacheFresh(pCached: ICachedInfo): boolean {
        const stat = XClaudeCliDiscovery.SafeStat(pCached.BinaryPath);
        if (!stat || stat.mtimeMs !== pCached.BinaryMTimeMs)
            return false;
        if (Date.now() - pCached.AuthCheckedAt > AUTH_TTL_MS)
            return false;
        return true;
    }

    private static SafeStat(pPath: string): fs.Stats | null {
        try {
            return fs.statSync(pPath);
        }
        catch {
            return null;
        }
    }

    static FindBinary(): string | null {
        const candidates = XClaudeCliDiscovery.CandidatePaths();
        for (const c of candidates) {
            if (XClaudeCliDiscovery.SafeStat(c))
                return c;
        }
        return null;
    }

    private static CandidatePaths(): string[] {
        const isWin = process.platform === "win32";
        const home = os.homedir();
        const out: string[] = [];

        const fromPath = XClaudeCliDiscovery.FindInPath(isWin ? ["claude.cmd", "claude.exe", "claude"] : ["claude"]);
        if (fromPath)
            out.push(fromPath);

        if (isWin) {
            const localAppData = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
            out.push(path.join(localAppData, "Programs", "claude-code", "claude.exe"));
            out.push(path.join(localAppData, "Programs", "claude-code", "claude.cmd"));
            out.push(path.join(localAppData, "Claude", "bin", "claude.exe"));
            out.push(path.join(localAppData, "Claude", "bin", "claude.cmd"));
            const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
            out.push(path.join(appData, "npm", "claude.cmd"));
        }
        else {
            out.push("/usr/local/bin/claude");
            out.push("/opt/homebrew/bin/claude");
            out.push(path.join(home, ".claude", "local", "bin", "claude"));
            out.push(path.join(home, ".npm-global", "bin", "claude"));
            out.push(path.join(home, ".local", "bin", "claude"));
        }

        return out;
    }

    private static FindInPath(pNames: string[]): string | null {
        const envPath = process.env.PATH ?? "";
        const sep = process.platform === "win32" ? ";" : ":";
        const dirs = envPath.split(sep).filter(d => d.length > 0);

        for (const dir of dirs) {
            for (const name of pNames) {
                const full = path.join(dir, name);
                if (XClaudeCliDiscovery.SafeStat(full))
                    return full;
            }
        }
        return null;
    }

    private static GetVersion(pBinary: string): Promise<string | null> {
        return XClaudeCliDiscovery.RunCli(pBinary, ["--version"], VERSION_TIMEOUT_MS)
            .then(result => {
                const log = GetLogService();
                log.Info(`Claude Code Discovery: version probe Ok=${result.Ok} stdout=${JSON.stringify(result.Stdout.slice(0, 200))} stderr=${JSON.stringify(result.Stderr.slice(0, 200))}`);
                if (!result.Ok)
                    return null;
                const match = /\b(\d+\.\d+\.\d+)/.exec(result.Stdout);
                return match ? match[1] : null;
            });
    }

    private static RunCli(
        pBinary: string,
        pArgs: string[],
        pTimeoutMs: number,
        pStdin?: string
    ): Promise<{ Ok: boolean; Stdout: string; Stderr: string }> {
        return new Promise((resolve) => {
            let stdout = "";
            let stderr = "";
            const child = SpawnCliSafe(pBinary, pArgs, { windowsHide: true });

            const timer = setTimeout(() => {
                try { child.kill("SIGKILL"); } catch { /* ignore */ }
                resolve({ Ok: false, Stdout: stdout, Stderr: stderr + "\n[timeout]" });
            }, pTimeoutMs);

            child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
            child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
            child.on("error", (err) => {
                clearTimeout(timer);
                resolve({ Ok: false, Stdout: stdout, Stderr: stderr + "\n" + err.message });
            });
            child.on("close", (code) => {
                clearTimeout(timer);
                resolve({ Ok: code === 0, Stdout: stdout, Stderr: stderr });
            });

            if (pStdin !== undefined && child.stdin) {
                child.stdin.end(pStdin);
            }
        });
    }
}
