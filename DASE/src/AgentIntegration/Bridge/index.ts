import * as vscode from "vscode";
import { createHash } from "crypto";
import { XAgentBridgeServer, BRIDGE_PROTOCOL } from "./XAgentBridgeServer";
import { GetLogService } from "../../Services/LogService";

// NOTE: this is DASE's only agent-integration surface: a plain loopback HTTP
// bridge (see XAgentBridgeServer). DASE does NOT load, install, or configure any
// MCP server — the standalone DASE-MCP product discovers this endpoint through
// the files written below and translates MCP tool calls into bridge calls.

const CONFIG_SECTION = "dase.agentBridge";
// Porta 0 = efêmera: o SO escolhe uma porta livre a cada janela do VS Code, então
// múltiplas instâncias nunca colidem (EADDRINUSE). A porta real vai no discovery.
const DEFAULT_PORT = 0;
// Arquivo de descoberta compartilhado: último a escrever vence. Para clientes que
// só conhecem este nome fixo.
const DISCOVERY_FILE = "bridge-endpoint.json";
// Prefixo do discovery POR JANELA. Cada janela grava
// `bridge-endpoint.<hash-do-workspace>.json` com url + workspacePath + pid, para
// que um cliente (ex.: DASE-MCP) case o endpoint com a própria janela.
const DISCOVERY_PREFIX = "bridge-endpoint.";
const DISCOVERY_SUFFIX = ".json";

let _Server: XAgentBridgeServer | null = null;
// Nome do arquivo de descoberta desta janela (definido no WriteDiscoveryFile),
// para limpar exatamente o nosso ao desligar/parar.
let _WindowDiscoveryFile: string | null = null;

/**
 * Register and (optionally) start the DASE agent bridge server.
 *
 * Activation is gated by the `dase.agentBridge.enabled` setting. When enabled, the
 * server binds to a loopback port (`dase.agentBridge.port`) and writes a
 * `bridge-endpoint.json` discovery file (URL) into the extension's global storage,
 * so an external agent (e.g. the standalone DASE-MCP server) can locate it.
 *
 * Best-effort: any failure degrades silently — the bridge is an enhancement, not a
 * requirement for the extension to work.
 */
export function RegisterAgentBridgeServer(pContext: vscode.ExtensionContext): void {
    const log = GetLogService();

    pContext.subscriptions.push({ dispose: () => { void StopServer(); } });

    pContext.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(CONFIG_SECTION))
                void Reconcile(pContext);
        })
    );

    void Reconcile(pContext);

    log.Info("DASE agent bridge integration registered");
}

async function Reconcile(pContext: vscode.ExtensionContext): Promise<void> {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const enabled = cfg.get<boolean>("enabled", true);

    if (!enabled) {
        await StopServer();
        await ClearDiscoveryFile(pContext);
        return;
    }

    if (_Server)
        return; // already running

    const port = cfg.get<number>("port", DEFAULT_PORT);

    try {
        const server = new XAgentBridgeServer(port);
        await server.Start();
        _Server = server;
        await WriteDiscoveryFile(pContext, server);

        GetLogService().Info(
            `DASE agent bridge ready — URL: ${server.Url}  (endpoint written to ${DISCOVERY_FILE} in global storage)`
        );
    }
    catch (err) {
        GetLogService().Error("Failed to start DASE agent bridge", err);
        vscode.window.showWarningMessage(
            `DASE agent bridge could not start on port ${port}. Check the DASE output log.`
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

/** Caminho do workspace desta janela (1ª pasta), ou "" quando sem workspace. */
function WorkspacePath(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
}

/** Nome do arquivo de descoberta por janela, derivado do workspace. */
function WindowDiscoveryFileName(pWorkspacePath: string): string {
    // No Windows os caminhos são case-insensitive; normaliza p/ o hash bater entre
    // escritas da mesma janela. Sem workspace, usa uma chave estável ("noworkspace").
    const key = pWorkspacePath
        ? (process.platform === "win32" ? pWorkspacePath.toLowerCase() : pWorkspacePath)
        : "noworkspace";
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
    return `${DISCOVERY_PREFIX}${hash}${DISCOVERY_SUFFIX}`;
}

async function WriteDiscoveryFile(pContext: vscode.ExtensionContext, pServer: XAgentBridgeServer): Promise<void> {
    try {
        await vscode.workspace.fs.createDirectory(pContext.globalStorageUri);
        // Remove arquivos por janela de instâncias que já morreram (crash sem
        // limpar), para não deixar endpoints apontando p/ portas mortas.
        await PurgeDeadWindowFiles(pContext);

        const workspacePath = WorkspacePath();
        const payload = JSON.stringify(
            { url: pServer.Url, protocol: BRIDGE_PROTOCOL, workspacePath, pid: process.pid },
            null,
            2
        );
        const buf = Buffer.from(payload, "utf8");

        // (a) arquivo por janela — clientes casam pelo workspacePath.
        _WindowDiscoveryFile = WindowDiscoveryFileName(workspacePath);
        const windowUri = vscode.Uri.joinPath(pContext.globalStorageUri, _WindowDiscoveryFile);
        await vscode.workspace.fs.writeFile(windowUri, buf);

        // (b) arquivo compartilhado — p/ clientes que só sabem o nome fixo.
        // Último a escrever vence (limitação conhecida).
        const sharedUri = vscode.Uri.joinPath(pContext.globalStorageUri, DISCOVERY_FILE);
        await vscode.workspace.fs.writeFile(sharedUri, buf);
    }
    catch (err) {
        GetLogService().Warn(`Could not write agent bridge discovery file: ${err}`);
    }
}

async function ClearDiscoveryFile(pContext: vscode.ExtensionContext): Promise<void> {
    // Remove o arquivo por janela desta instância. NÃO removemos o compartilhado:
    // ele pode pertencer a outra janela que ainda está no ar.
    const names = new Set<string>();
    if (_WindowDiscoveryFile) names.add(_WindowDiscoveryFile);
    names.add(WindowDiscoveryFileName(WorkspacePath()));
    for (const name of names) {
        try {
            const uri = vscode.Uri.joinPath(pContext.globalStorageUri, name);
            await vscode.workspace.fs.delete(uri);
        }
        catch { /* file may not exist — ignore */ }
    }
    _WindowDiscoveryFile = null;
}

/**
 * Remove arquivos `bridge-endpoint.<hash>.json` cujo `pid` não está mais vivo —
 * sobras de janelas que fecharam sem limpar. Best-effort: nunca lança.
 */
async function PurgeDeadWindowFiles(pContext: vscode.ExtensionContext): Promise<void> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(pContext.globalStorageUri);
        for (const [name, type] of entries) {
            if (type !== vscode.FileType.File) continue;
            if (name === DISCOVERY_FILE) continue; // compartilhado não tem pid confiável
            if (!name.startsWith(DISCOVERY_PREFIX) || !name.endsWith(DISCOVERY_SUFFIX)) continue;
            const uri = vscode.Uri.joinPath(pContext.globalStorageUri, name);
            let pid: number | undefined;
            try {
                const raw = await vscode.workspace.fs.readFile(uri);
                const j = JSON.parse(Buffer.from(raw).toString("utf8")) as { pid?: number };
                pid = typeof j.pid === "number" ? j.pid : undefined;
            }
            catch { continue; /* ilegível/parcial: deixa quieto */ }
            if (pid === undefined || pid === process.pid) continue;
            if (IsPidAlive(pid)) continue;
            try { await vscode.workspace.fs.delete(uri); }
            catch { /* corrida com outra janela — ignora */ }
        }
    }
    catch { /* diretório ausente/inacessível — ignora */ }
}

/** true se o processo `pPid` ainda existe (sinal 0 não mata, só testa). */
function IsPidAlive(pPid: number): boolean {
    try {
        process.kill(pPid, 0);
        return true;
    }
    catch (err) {
        // EPERM = existe mas sem permissão de sinalizar → vivo. ESRCH = morto.
        return (err as NodeJS.ErrnoException)?.code === "EPERM";
    }
}
