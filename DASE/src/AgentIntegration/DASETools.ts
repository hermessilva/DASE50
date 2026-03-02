/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { XAgentBridge } from "./AgentBridge";
import { GetLogService } from "../Services/LogService";

/**
 * DASETools — Language Model Tools for GitHub Copilot Agent Mode.
 *
 * These tools are automatically discovered and invoked by Copilot Agent Mode
 * when the user asks questions or gives instructions about ORM models.
 * Each tool implements `vscode.LanguageModelTool<T>` and is registered
 * via `vscode.lm.registerTool()`.
 *
 * Tool naming follows VS Code convention: `dase_{verb}_{noun}`
 */

// ─── Tool Parameter Interfaces ─────────────────────────────────────────────────

interface IGetModelInfoParams { }

interface IListTablesParams {
    filter?: string;
}

interface IGetTableDetailsParams {
    tableName: string;
}

interface IAddTableParams {
    name: string;
    x?: number;
    y?: number;
}

interface IAddFieldParams {
    tableName: string;
    fieldName: string;
    dataType: string;
}

interface IAddReferenceParams {
    sourceTable: string;
    targetTable: string;
    name?: string;
}

interface IValidateModelParams { }

interface IExportDBMLParams { }

interface IGetPropertiesParams {
    elementId: string;
}

interface IUpdatePropertyParams {
    elementId: string;
    propertyKey: string;
    value: any;
}

// ─── Tool Implementations ──────────────────────────────────────────────────────

class GetModelInfoTool implements vscode.LanguageModelTool<IGetModelInfoParams> {
    async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<IGetModelInfoParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.GetModelInfo();
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<IGetModelInfoParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: "Reading ORM model information..."
        };
    }
}

class ListTablesTool implements vscode.LanguageModelTool<IListTablesParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IListTablesParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.ListTables(options.input.filter);
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IListTablesParams>,
        _token: vscode.CancellationToken
    ) {
        const filter = options.input.filter;
        return {
            invocationMessage: filter
                ? `Listing tables matching "${filter}"...`
                : "Listing all tables in the ORM model..."
        };
    }
}

class GetTableDetailsTool implements vscode.LanguageModelTool<IGetTableDetailsParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetTableDetailsParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.GetTableDetails(options.input.tableName);
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IGetTableDetailsParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Getting details for table "${options.input.tableName}"...`
        };
    }
}

class AddTableTool implements vscode.LanguageModelTool<IAddTableParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IAddTableParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.AddTable(options.input.name, options.input.x, options.input.y);
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IAddTableParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Adding table "${options.input.name}"...`,
            confirmationMessages: {
                title: "Add Table",
                message: new vscode.MarkdownString(
                    `Add a new table named **${options.input.name}** to the ORM model?`
                )
            }
        };
    }
}

class AddFieldTool implements vscode.LanguageModelTool<IAddFieldParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IAddFieldParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.AddField(
            options.input.tableName,
            options.input.fieldName,
            options.input.dataType
        );
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IAddFieldParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Adding field "${options.input.fieldName}" to "${options.input.tableName}"...`,
            confirmationMessages: {
                title: "Add Field",
                message: new vscode.MarkdownString(
                    `Add field **${options.input.fieldName}** (${options.input.dataType}) to table **${options.input.tableName}**?`
                )
            }
        };
    }
}

class AddReferenceTool implements vscode.LanguageModelTool<IAddReferenceParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IAddReferenceParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.AddReference(
            options.input.sourceTable,
            options.input.targetTable,
            options.input.name
        );
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IAddReferenceParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Creating FK reference from "${options.input.sourceTable}" to "${options.input.targetTable}"...`,
            confirmationMessages: {
                title: "Add FK Reference",
                message: new vscode.MarkdownString(
                    `Create a foreign key reference from **${options.input.sourceTable}** to **${options.input.targetTable}**?`
                )
            }
        };
    }
}

class ValidateModelTool implements vscode.LanguageModelTool<IValidateModelParams> {
    async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<IValidateModelParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.ValidateModel();
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<IValidateModelParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: "Validating the ORM model..."
        };
    }
}

class ExportDBMLTool implements vscode.LanguageModelTool<IExportDBMLParams> {
    async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<IExportDBMLParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.ExportToDBML();
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<IExportDBMLParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: "Exporting ORM model to DBML..."
        };
    }
}

class GetPropertiesTool implements vscode.LanguageModelTool<IGetPropertiesParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IGetPropertiesParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.GetProperties(options.input.elementId);
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<IGetPropertiesParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: "Reading element properties..."
        };
    }
}

class UpdatePropertyTool implements vscode.LanguageModelTool<IUpdatePropertyParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IUpdatePropertyParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.UpdateProperty(
            options.input.elementId,
            options.input.propertyKey,
            options.input.value
        );
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IUpdatePropertyParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Updating property "${options.input.propertyKey}"...`,
            confirmationMessages: {
                title: "Update Property",
                message: new vscode.MarkdownString(
                    `Update property **${options.input.propertyKey}** to **${String(options.input.value)}**?`
                )
            }
        };
    }
}

// ─── New Table Positioning/Coloring Tools ──────────────────────────────────────

interface IMoveTableParams {
    tableName: string;
    x: number;
    y: number;
}

interface ISetColorParams {
    tableName: string;
    color: string;
}

interface IOrganizeLayoutParams { }

class MoveTableTool implements vscode.LanguageModelTool<IMoveTableParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IMoveTableParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.MoveTable(
            options.input.tableName,
            options.input.x,
            options.input.y
        );
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<IMoveTableParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Moving table "${options.input.tableName}" to (${options.input.x}, ${options.input.y})...`,
            confirmationMessages: {
                title: "Move Table",
                message: new vscode.MarkdownString(
                    `Move table **${options.input.tableName}** to position **(${options.input.x}, ${options.input.y})**?`
                )
            }
        };
    }
}

class SetColorTool implements vscode.LanguageModelTool<ISetColorParams> {
    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<ISetColorParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = bridge.SetTableColor(options.input.tableName, options.input.color);
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        options: vscode.LanguageModelToolInvocationPrepareOptions<ISetColorParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: `Setting color of "${options.input.tableName}" to ${options.input.color}...`,
            confirmationMessages: {
                title: "Set Table Color",
                message: new vscode.MarkdownString(
                    `Set the fill color of table **${options.input.tableName}** to **${options.input.color}**?`
                )
            }
        };
    }
}

class OrganizeLayoutTool implements vscode.LanguageModelTool<IOrganizeLayoutParams> {
    async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<IOrganizeLayoutParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const bridge = XAgentBridge.GetInstance();
        const result = await bridge.OrganizeLayout();
        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(result)
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<IOrganizeLayoutParams>,
        _token: vscode.CancellationToken
    ) {
        return {
            invocationMessage: "Organizing tables using AI...",
            confirmationMessages: {
                title: "AI Table Organization",
                message: new vscode.MarkdownString(
                    "Use AI to **analyze table names and relationships**, group tables by functional domain, reposition them in clusters, and color-code each group?\n\nThis will modify table positions and colors across the entire model."
                )
            }
        };
    }
}

// ─── Registration ──────────────────────────────────────────────────────────────

/**
 * Register all DASE Language Model Tools with VS Code.
 * Called once during extension activation.
 */
export function RegisterDASETools(pContext: vscode.ExtensionContext): void {
    const registrations = [
        vscode.lm.registerTool("dase_get_model", new GetModelInfoTool()),
        vscode.lm.registerTool("dase_list_tables", new ListTablesTool()),
        vscode.lm.registerTool("dase_get_table", new GetTableDetailsTool()),
        vscode.lm.registerTool("dase_add_table", new AddTableTool()),
        vscode.lm.registerTool("dase_add_field", new AddFieldTool()),
        vscode.lm.registerTool("dase_add_reference", new AddReferenceTool()),
        vscode.lm.registerTool("dase_validate", new ValidateModelTool()),
        vscode.lm.registerTool("dase_export_dbml", new ExportDBMLTool()),
        vscode.lm.registerTool("dase_get_properties", new GetPropertiesTool()),
        vscode.lm.registerTool("dase_update_property", new UpdatePropertyTool()),
        vscode.lm.registerTool("dase_move_table", new MoveTableTool()),
        vscode.lm.registerTool("dase_set_color", new SetColorTool()),
        vscode.lm.registerTool("dase_organize_layout", new OrganizeLayoutTool())
    ];

    for (const reg of registrations)
        pContext.subscriptions.push(reg);

    GetLogService().Info(`DASE Language Model Tools registered (${registrations.length} tools)`);
}
