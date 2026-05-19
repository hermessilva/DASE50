import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

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
const AUTH_CHECK_TIMEOUT_MS = 8000;
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
        const cached = XClaudeCliDiscovery._Cache;
        if (cached && XClaudeCliDiscovery.IsCacheFresh(cached)) {
            return {
                BinaryPath: cached.BinaryPath,
                Version: cached.Version,
                Authenticated: cached.Authenticated
            };
        }

        const binary = XClaudeCliDiscovery._OverridePath ?? XClaudeCliDiscovery.FindBinary();
        if (!binary)
            return null;

        const version = await XClaudeCliDiscovery.GetVersion(binary);
        if (!version)
            return null;

        const auth = await XClaudeCliDiscovery.CheckAuth(binary);
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
                if (!result.Ok)
                    return null;
                const match = /\b(\d+\.\d+\.\d+)/.exec(result.Stdout);
                return match ? match[1] : null;
            });
    }

    private static CheckAuth(pBinary: string): Promise<boolean> {
        return XClaudeCliDiscovery.RunCli(
            pBinary,
            ["--print", "--output-format", "json", "--max-turns", "1", "ping"],
            AUTH_CHECK_TIMEOUT_MS,
            "ping"
        ).then(result => {
            if (!result.Ok)
                return false;
            const lower = (result.Stdout + result.Stderr).toLowerCase();
            if (lower.includes("not authenticated") || lower.includes("please run") || lower.includes("login"))
                return false;
            return true;
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
            const child = spawn(pBinary, pArgs, { windowsHide: true });

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
