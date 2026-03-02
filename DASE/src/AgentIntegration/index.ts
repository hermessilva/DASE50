import * as vscode from "vscode";
import { XAgentBridge } from "./AgentBridge";
import { RegisterDASEChatParticipant } from "./DASEChatParticipant";
import { RegisterDASETools } from "./DASETools";
import { GetLogService } from "../Services/LogService";
import type { XORMDesignerEditorProvider } from "../Designers/ORM/ORMDesignerEditorProvider";

/**
 * Register all AI agent integration components.
 *
 * This function is called once during extension activation. It sets up:
 * 1. The AgentBridge singleton (adapter between AI tools and XTFXBridge)
 * 2. The @dase Chat Participant for Copilot Chat Ask Mode
 * 3. Language Model Tools for Copilot Agent Mode
 *
 * All integrations are safe — they gracefully degrade when:
 * - GitHub Copilot is not installed
 * - No ORM designer is open
 * - The Chat/Tools APIs are not available (older VS Code versions)
 */
export function RegisterAgentIntegration(
    pContext: vscode.ExtensionContext,
    pDesignerProvider: XORMDesignerEditorProvider
): void {
    const log = GetLogService();

    try {
        // Initialize the AgentBridge singleton with the designer provider
        const bridge = XAgentBridge.GetInstance();
        bridge.SetProvider(pDesignerProvider);

        // Register Chat Participant (@dase) — requires vscode.chat API
        if (typeof vscode.chat?.createChatParticipant === "function") {
            RegisterDASEChatParticipant(pContext);
        }
        else {
            log.Info("Chat Participant API not available — @dase chat participant not registered");
        }

        // Register Language Model Tools — requires vscode.lm API
        if (typeof vscode.lm?.registerTool === "function") {
            RegisterDASETools(pContext);
        }
        else {
            log.Info("Language Model Tools API not available — DASE tools not registered");
        }

        log.Info("DASE Agent Integration initialized");
    }
    catch (error) {
        // Silently degrade — AI integration is an enhancement, not a requirement
        log.Warn(`DASE Agent Integration could not be initialized: ${error}`);
    }
}
