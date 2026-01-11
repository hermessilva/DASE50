import * as vscode from "vscode";
import { GetSelectionService } from "../Services/SelectionService";
import { XPropertyItem } from "../Models/PropertyItem";
import { XORMDesignerEditorProvider } from "../Designers/ORM/ORMDesignerEditorProvider";
import { XDesignerSelection } from "../Models/DesignerSelection";

export class XPropertiesViewProvider implements vscode.WebviewViewProvider
{
    // Context kept for future features (theming, storage)
    private readonly _Context: vscode.ExtensionContext;
    private _DesignerProvider: XORMDesignerEditorProvider;
    private _View: vscode.WebviewView | null;
    private _Properties: XPropertyItem[];
    private _ElementID: string | null;

    constructor(pContext: vscode.ExtensionContext, pDesignerProvider: XORMDesignerEditorProvider)
    {
        this._Context = pContext;
        this._DesignerProvider = pDesignerProvider;
        this._View = null;
        this._Properties = [];
        this._ElementID = null;
    }

    static get ViewType(): string
    {
        return "Dase.Properties";
    }

    static Register(pContext: vscode.ExtensionContext, pDesignerProvider: XORMDesignerEditorProvider): XPropertiesViewProvider
    {
        const provider = new XPropertiesViewProvider(pContext, pDesignerProvider);
        const registration = vscode.window.registerWebviewViewProvider(
            XPropertiesViewProvider.ViewType,
            provider
        );
        pContext.subscriptions.push(registration);
        return provider;
    }

    resolveWebviewView(pWebviewView: vscode.WebviewView, _pContext: vscode.WebviewViewResolveContext, _pToken: vscode.CancellationToken): void
    {
        this._View = pWebviewView;

        pWebviewView.webview.options = {
            enableScripts: true
        };

        pWebviewView.webview.html = this.GetHtmlContent();

        const selectionService = GetSelectionService();
        selectionService.OnSelectionChanged(async (pSelection: XDesignerSelection) => {
            this._ElementID = pSelection.PrimaryID;
            
            if (pSelection.PrimaryID)
            {
                const state = this._DesignerProvider.GetActiveState();
                if (state)
                    this._Properties = await state.GetProperties(pSelection.PrimaryID);
                else
                    this._Properties = [];
            }
            else
                this._Properties = [];

            this.UpdateView();
        });

        pWebviewView.webview.onDidReceiveMessage((pMsg: { Type: string; PropertyKey?: string; Value?: unknown }) => {
            if (pMsg.Type === "UpdateProperty" && pMsg.PropertyKey !== undefined)
                this.OnPropertyChanged(pMsg.PropertyKey, pMsg.Value);
        });
    }

    async OnPropertyChanged(pPropertyKey: string, pValue: unknown): Promise<void>
    {
        if (!this._ElementID)
            return;

        const panel = this._DesignerProvider.GetActivePanel();
        const state = this._DesignerProvider.GetActiveState();

        if (!panel || !state)
            return;

        state.UpdateProperty(this._ElementID, pPropertyKey, pValue);
        
        this._Properties = await state.GetProperties(this._ElementID);
        this.UpdateView();

        const modelData = await state.GetModelData();
        panel.webview.postMessage({
            Type: "LoadModel",
            Payload: modelData
        });

        state.Save();
    }

    async SetProperties(pElementID: string, pProperties: XPropertyItem[]): Promise<void>
    {
        this._ElementID = pElementID;
        this._Properties = pProperties || [];
        this.UpdateView();
    }

    UpdateView(): void
    {
        if (this._View)
        {
            this._View.webview.postMessage({
                Type: "UpdateProperties",
                ElementID: this._ElementID,
                Properties: this._Properties
            });
        }
    }

    GetHtmlContent()
    {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-panel-background);
        }
        .properties-container {
            padding: 8px;
        }
        .property-row {
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .property-name {
            flex: 0 0 40%;
            padding-right: 8px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .property-value {
            flex: 1;
        }
        .property-value input,
        .property-value select {
            width: 100%;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 6px;
            font-family: inherit;
            font-size: inherit;
        }
        .property-value input:focus,
        .property-value select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }
        .property-value input[type="checkbox"] {
            width: auto;
        }
        .no-selection {
            padding: 16px;
            text-align: center;
            opacity: 0.6;
        }
        .property-readonly {
            opacity: 0.6;
        }
    </style>
</head>
<body>
    <div class="properties-container" id="properties-container">
        <div class="no-selection">No element selected</div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let currentElementID = null;
        
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            if (msg.Type === "UpdateProperties")
            {
                currentElementID = msg.ElementID;
                RenderProperties(msg.Properties);
            }
        });

        function RenderProperties(pProperties)
        {
            const container = document.getElementById("properties-container");
            
            if (!pProperties || pProperties.length === 0)
            {
                container.innerHTML = '<div class="no-selection">No element selected</div>';
                return;
            }

            let html = "";
            for (const prop of pProperties)
            {
                html += '<div class="property-row">';
                html += '<div class="property-name" title="' + EscapeHtml(prop.Key) + '">' + EscapeHtml(prop.Name) + '</div>';
                html += '<div class="property-value">';
                html += GetPropertyEditor(prop);
                html += '</div></div>';
            }
            
            container.innerHTML = html;
            AttachEventHandlers();
        }

        function GetPropertyEditor(pProp)
        {
            const key = EscapeHtml(pProp.Key);
            const value = pProp.Value !== null && pProp.Value !== undefined ? pProp.Value : "";
            const readonly = pProp.Key === "ID" ? "readonly" : "";

            switch (pProp.Type)
            {
                case "Boolean":
                    const checked = pProp.Value ? "checked" : "";
                    return '<input type="checkbox" data-key="' + key + '" ' + checked + '>';

                case "Number":
                    return '<input type="number" data-key="' + key + '" value="' + value + '" ' + readonly + '>';

                case "Enum":
                    let options = "";
                    if (pProp.Options)
                    {
                        for (const opt of pProp.Options)
                        {
                            const selected = opt === value ? "selected" : "";
                            options += '<option value="' + EscapeHtml(opt) + '" ' + selected + '>' + EscapeHtml(opt) + '</option>';
                        }
                    }
                    return '<select data-key="' + key + '">' + options + '</select>';

                default:
                    return '<input type="text" data-key="' + key + '" value="' + EscapeHtml(String(value)) + '" ' + readonly + '>';
            }
        }

        function AttachEventHandlers()
        {
            const inputs = document.querySelectorAll("input, select");
            inputs.forEach(function(input) {
                const eventType = input.type === "checkbox" ? "change" : "change";
                input.addEventListener(eventType, function() {
                    const key = this.getAttribute("data-key");
                    let value;
                    
                    if (this.type === "checkbox")
                        value = this.checked;
                    else if (this.type === "number")
                        value = parseFloat(this.value) || 0;
                    else
                        value = this.value;

                    vscode.postMessage({
                        Type: "UpdateProperty",
                        PropertyKey: key,
                        Value: value
                    });
                });
            });
        }

        function EscapeHtml(pText)
        {
            if (pText === null || pText === undefined)
                return "";
            const div = document.createElement("div");
            div.textContent = String(pText);
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }
}
