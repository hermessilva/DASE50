import * as vscode from "vscode";
import type { XDaseMcpServer } from "./XDaseMcpServer";
import { GetLogService } from "../../Services/LogService";

// NOTE: XDaseMcpServer (and the @modelcontextprotocol/sdk + zod it pulls in) is
// imported lazily via dynamic import() inside Reconcile — never at module load.
// This keeps extension activation working even if the MCP SDK is not packaged in
// the .vsix; MCP simply stays unavailable until enabled and the SDK is present.

const CONFIG_SECTION = "dase.mcp";
const DEFAULT_PORT = 39100;
const DISCOVERY_FILE = "mcp-endpoint.json";

let _Server: XDaseMcpServer | null = null;

/**
 * Register and (optionally) start the embedded DASE MCP server.
 *
 * Activation is gated by the `dase.mcp.enabled` setting. When enabled, the server
 * binds to a loopback port (`dase.mcp.port`) and writes an `mcp-endpoint.json`
 * discovery file (URL) into the extension's global storage, so an
 * external MCP client can locate the endpoint.
 *
 * Best-effort: any failure degrades silently — MCP is an enhancement, not a
 * requirement for the extension to work.
 */
export function RegisterDaseMcpServer(pContext: vscode.ExtensionContext): void {
    const log = GetLogService();

    pContext.subscriptions.push({ dispose: () => { void StopServer(); } });

    pContext.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(CONFIG_SECTION))
                void Reconcile(pContext);
        })
    );

    void Reconcile(pContext);

    log.Info("DASE MCP integration registered");
}

async function Reconcile(pContext: vscode.ExtensionContext): Promise<void> {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const enabled = cfg.get<boolean>("enabled", false);

    if (!enabled) {
        await StopServer();
        await ClearDiscoveryFile(pContext);
        return;
    }

    if (_Server)
        return; // already running

    const port = cfg.get<number>("port", DEFAULT_PORT);

    try {
        // Lazy-load the server module (and the MCP SDK) only when actually enabling.
        const mod = await import("./XDaseMcpServer");
        const server = new mod.XDaseMcpServer(port);
        await server.Start();
        _Server = server;
        await WriteDiscoveryFile(pContext, server);

        GetLogService().Info(
            `DASE MCP server ready — URL: ${server.Url}  (endpoint written to ${DISCOVERY_FILE} in global storage)`
        );
    }
    catch (err) {
        GetLogService().Error("Failed to start DASE MCP server", err);
        vscode.window.showWarningMessage(
            `DASE MCP server could not start on port ${port}. Check the DASE output log.`
        );
        _Server = null;
    }
}

async function StopServer(): Promise<void> {
    if (!_Server)
        return;
    const server = _Server;
    _Server = null;
    await server.Stop();
}

// ─── Discovery file ─────────────────────────────────────────────────────────

async function WriteDiscoveryFile(pContext: vscode.ExtensionContext, pServer: XDaseMcpServer): Promise<void> {
    try {
        const uri = vscode.Uri.joinPath(pContext.globalStorageUri, DISCOVERY_FILE);
        await vscode.workspace.fs.createDirectory(pContext.globalStorageUri);
        const payload = JSON.stringify({ url: pServer.Url }, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(payload, "utf8"));
    }
    catch (err) {
        GetLogService().Warn(`Could not write MCP discovery file: ${err}`);
    }
}

async function ClearDiscoveryFile(pContext: vscode.ExtensionContext): Promise<void> {
    try {
        const uri = vscode.Uri.joinPath(pContext.globalStorageUri, DISCOVERY_FILE);
        await vscode.workspace.fs.delete(uri);
    }
    catch { /* file may not exist — ignore */ }
}
