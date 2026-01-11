import * as vscode from "vscode";

class XLogService
{
    private static _Instance: XLogService | null = null;
    private _OutputChannel: vscode.OutputChannel;

    private constructor()
    {
        this._OutputChannel = vscode.window.createOutputChannel("DASE");
    }

    static Get(): XLogService
    {
        if (!XLogService._Instance)
            XLogService._Instance = new XLogService();
        return XLogService._Instance;
    }

    static Initialize(pContext: vscode.ExtensionContext): XLogService
    {
        const instance = XLogService.Get();
        pContext.subscriptions.push(instance._OutputChannel);
        return instance;
    }

    Info(pMessage: string): void
    {
        this.Log("INFO", pMessage);
    }

    Warn(pMessage: string): void
    {
        this.Log("WARN", pMessage);
    }

    Error(pMessage: string, pError?: unknown): void
    {
        let message = pMessage;
        if (pError)
        {
            if (pError instanceof Error)
                message += `: ${pError.message}\n${pError.stack || ""}`;
            else
                message += `: ${String(pError)}`;
        }
        this.Log("ERROR", message);
    }

    Debug(pMessage: string): void
    {
        this.Log("DEBUG", pMessage);
    }

    private Log(pLevel: string, pMessage: string): void
    {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${pLevel}] ${pMessage}`;
        this._OutputChannel.appendLine(formattedMessage);
        
        // Also log to console for debugging
        if (pLevel === "ERROR")
            console.error(formattedMessage);
        else if (pLevel === "WARN")
            console.warn(formattedMessage);
        else
            console.log(formattedMessage);
    }

    Show(): void
    {
        this._OutputChannel.show();
    }

    Clear(): void
    {
        this._OutputChannel.clear();
    }
}

export function GetLogService(): XLogService
{
    return XLogService.Get();
}

export function InitializeLogService(pContext: vscode.ExtensionContext): XLogService
{
    return XLogService.Initialize(pContext);
}
