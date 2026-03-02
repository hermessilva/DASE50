import * as vscode from "vscode";
import { XAgentBridge } from "./AgentBridge";
import { GetLogService } from "../Services/LogService";

/**
 * DASEChatParticipant — Chat participant for GitHub Copilot Chat integration.
 *
 * Registers as `@dase` in the VS Code Chat UI, providing a domain-specific
 * ORM design assistant. Users can invoke it with `@dase` followed by natural
 * language queries or slash commands.
 *
 * Slash Commands:
 *   /model   — Show current ORM model overview
 *   /table   — Describe a specific table or list all tables
 *   /validate — Run model validation and show issues
 *   /export  — Export the model to DBML format
 *   /types   — Show available data types
 *   /help    — Show usage instructions
 */

const PARTICIPANT_ID = "dase.ormAssistant";

interface IDASEChatResult extends vscode.ChatResult {
    metadata: {
        command?: string;
    };
}

/**
 * Register the DASE chat participant with VS Code.
 * Called once during extension activation.
 */
export function RegisterDASEChatParticipant(pContext: vscode.ExtensionContext): void {
    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<IDASEChatResult> => {
        const bridge = XAgentBridge.GetInstance();

        try {
            if (request.command === "model") {
                return await HandleModelCommand(bridge, request, stream, token);
            }
            else if (request.command === "table") {
                return await HandleTableCommand(bridge, request, stream, token);
            }
            else if (request.command === "validate") {
                return await HandleValidateCommand(bridge, stream, token);
            }
            else if (request.command === "export") {
                return await HandleExportCommand(bridge, stream, token);
            }
            else if (request.command === "types") {
                return await HandleTypesCommand(bridge, stream, token);
            }
            else if (request.command === "help") {
                return await HandleHelpCommand(stream);
            }
            else {
                // Free-form prompt — use the LLM with ORM context
                return await HandleFreeFormPrompt(bridge, request, context, stream, token);
            }
        }
        catch (err) {
            GetLogService().Error("DASEChatParticipant error", err);
            stream.markdown("❌ An error occurred while processing your request. Please try again.");
            return { metadata: { command: request.command } };
        }
    };

    const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
    participant.iconPath = new vscode.ThemeIcon("database");

    // Register follow-up provider
    participant.followupProvider = {
        provideFollowups(
            result: IDASEChatResult,
            _context: vscode.ChatContext,
            _token: vscode.CancellationToken
        ): vscode.ChatFollowup[] {
            const followups: vscode.ChatFollowup[] = [];

            switch (result.metadata.command) {
                case "model":
                    followups.push(
                        { prompt: "validate the model", label: "Validate Model", participant: PARTICIPANT_ID, command: "validate" },
                        { prompt: "export to DBML", label: "Export to DBML", participant: PARTICIPANT_ID, command: "export" }
                    );
                    break;
                case "table":
                    followups.push(
                        { prompt: "show the full model", label: "Show Model Overview", participant: PARTICIPANT_ID, command: "model" },
                        { prompt: "validate", label: "Validate Model", participant: PARTICIPANT_ID, command: "validate" }
                    );
                    break;
                case "validate":
                    followups.push(
                        { prompt: "show model overview", label: "Show Model", participant: PARTICIPANT_ID, command: "model" },
                        { prompt: "export to DBML", label: "Export to DBML", participant: PARTICIPANT_ID, command: "export" }
                    );
                    break;
                case "export":
                    followups.push(
                        { prompt: "validate the model", label: "Validate Model", participant: PARTICIPANT_ID, command: "validate" }
                    );
                    break;
                default:
                    followups.push(
                        { prompt: "show model overview", label: "Show Model", participant: PARTICIPANT_ID, command: "model" },
                        { prompt: "how do I use DASE?", label: "Show Help", participant: PARTICIPANT_ID, command: "help" }
                    );
                    break;
            }

            return followups;
        }
    };

    pContext.subscriptions.push(participant);
    GetLogService().Info("DASE Chat Participant registered (@dase)");
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

async function HandleModelCommand(
    pBridge: XAgentBridge,
    _pRequest: vscode.ChatRequest,
    pStream: vscode.ChatResponseStream,
    _pToken: vscode.CancellationToken
): Promise<IDASEChatResult> {
    pStream.progress("Loading ORM model information...");
    const info = pBridge.GetModelInfo();
    pStream.markdown(info);
    return { metadata: { command: "model" } };
}

async function HandleTableCommand(
    pBridge: XAgentBridge,
    pRequest: vscode.ChatRequest,
    pStream: vscode.ChatResponseStream,
    _pToken: vscode.CancellationToken
): Promise<IDASEChatResult> {
    const tableName = pRequest.prompt.trim();

    if (tableName.length > 0) {
        pStream.progress(`Looking up table "${tableName}"...`);
        const details = pBridge.GetTableDetails(tableName);
        pStream.markdown(details);
    }
    else {
        pStream.progress("Listing all tables...");
        const list = pBridge.ListTables();
        pStream.markdown(list);
    }

    return { metadata: { command: "table" } };
}

async function HandleValidateCommand(
    pBridge: XAgentBridge,
    pStream: vscode.ChatResponseStream,
    _pToken: vscode.CancellationToken
): Promise<IDASEChatResult> {
    pStream.progress("Running ORM model validation...");
    const result = pBridge.ValidateModel();
    pStream.markdown(result);
    return { metadata: { command: "validate" } };
}

async function HandleExportCommand(
    pBridge: XAgentBridge,
    pStream: vscode.ChatResponseStream,
    _pToken: vscode.CancellationToken
): Promise<IDASEChatResult> {
    pStream.progress("Exporting model to DBML...");
    const dbml = pBridge.ExportToDBML();

    if (dbml.startsWith("No ORM") || dbml.startsWith("The model") || dbml.startsWith("Error")) {
        pStream.markdown(dbml);
    }
    else {
        pStream.markdown("### DBML Export\n\n```dbml\n" + dbml + "\n```");
    }

    return { metadata: { command: "export" } };
}

async function HandleTypesCommand(
    pBridge: XAgentBridge,
    pStream: vscode.ChatResponseStream,
    _pToken: vscode.CancellationToken
): Promise<IDASEChatResult> {
    pStream.progress("Loading available data types...");
    const types = pBridge.GetAvailableDataTypes();
    pStream.markdown(types);
    return { metadata: { command: "types" } };
}

async function HandleHelpCommand(
    pStream: vscode.ChatResponseStream
): Promise<IDASEChatResult> {
    pStream.markdown(`## DASE — ORM Design Assistant

I'm **@dase**, your ORM design assistant for the DASE extension. I can help you understand, query, and work with your ORM models.

### Slash Commands

| Command | Description |
|---------|-------------|
| \`/model\` | Show current ORM model overview (tables, references, stats) |
| \`/table [name]\` | Show details of a specific table, or list all tables if no name given |
| \`/validate\` | Run model validation and report errors/warnings |
| \`/export\` | Export the current model to DBML format |
| \`/types\` | Show available data types from configuration |
| \`/help\` | Show this help message |

### Free-Form Questions

You can also ask me questions in natural language about:
- ORM design best practices
- How to structure your database tables
- Understanding relationships and foreign keys
- DASE extension features and workflows

### Requirements

Make sure you have a \`.dsorm\` file open in the ORM Designer for commands that read or modify the model.
`);

    return { metadata: { command: "help" } };
}

// ─── Free-Form Prompt Handler ──────────────────────────────────────────────────

async function HandleFreeFormPrompt(
    pBridge: XAgentBridge,
    pRequest: vscode.ChatRequest,
    _pContext: vscode.ChatContext,
    pStream: vscode.ChatResponseStream,
    pToken: vscode.CancellationToken
): Promise<IDASEChatResult> {
    pStream.progress("Thinking...");

    // Build context with current model information
    let modelContext = "";
    if (pBridge.IsDesignerActive()) {
        modelContext = pBridge.GetModelInfo();
    }

    // Construct the system prompt with domain-specific context
    const systemPrompt = `You are DASE Assistant, an expert in ORM (Object-Relational Mapping) design and the DASE (Design-Aided Software Engineering) VS Code extension.

Your knowledge includes:
- Database design best practices (normalization, indexing, relationships)
- ORM modeling patterns (tables, fields, primary keys, foreign keys, references)
- The DASE extension architecture and features
- DBML (Database Markup Language) format
- .dsorm file format (XML-serialized ORM documents)

${modelContext ? "Here is the current ORM model the user is working with:\n\n" + modelContext : "No ORM model is currently open."}

Answer the user's question helpfully and concisely. If their question relates to modifying the model, suggest using the appropriate DASE command or @dase slash command. Use markdown formatting.`;

    try {
        // Use the language model from the request to generate a response
        const messages = [
            vscode.LanguageModelChatMessage.User(systemPrompt),
            vscode.LanguageModelChatMessage.User(pRequest.prompt)
        ];

        const chatResponse = await pRequest.model.sendRequest(messages, {}, pToken);

        for await (const fragment of chatResponse.text) {
            pStream.markdown(fragment);
        }
    }
    catch (err) {
        // If LLM access fails, provide a basic response
        if (pBridge.IsDesignerActive()) {
            pStream.markdown("I can help you with your ORM model. Here's what I can see:\n\n");
            pStream.markdown(modelContext);
            pStream.markdown("\n\nUse `/help` to see all available commands.");
        }
        else {
            pStream.markdown("Please open a `.dsorm` file in the ORM Designer to get started. Use `/help` to see available commands.");
        }
    }

    return { metadata: { command: "" } };
}
