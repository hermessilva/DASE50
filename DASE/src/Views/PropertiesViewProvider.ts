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
        
        // Register selection listener immediately, not when webview resolves
        const selectionService = GetSelectionService();
        selectionService.OnSelectionChanged(async (pSelection: XDesignerSelection) => {
            this._ElementID = pSelection.PrimaryID;
            
            if (pSelection.PrimaryID)
            {
                const state = this._DesignerProvider.GetActiveState();
                if (state)
                    this._Properties = state.GetProperties(pSelection.PrimaryID);
                else
                    this._Properties = [];
            }
            else
                this._Properties = [];
            
            // If view is not resolved yet, try to reveal it
            if (!this._View && this._Properties.length > 0)
            {
                try
                {
                    await vscode.commands.executeCommand(`${XPropertiesViewProvider.ViewType}.focus`);
                }
                catch
                {
                    // Panel focus failed, will update on next visibility change
                }
            }
            
            this.UpdateView();
        });
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
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
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

        // Always set fresh HTML content
        const htmlContent = this.GetHtmlContent();
        pWebviewView.webview.html = htmlContent;
        
        // Handle view disposal
        pWebviewView.onDidDispose(() => {
            this._View = null;
        });
        
        // Handle visibility changes - re-send properties when view becomes visible
        pWebviewView.onDidChangeVisibility(() => {
            if (pWebviewView.visible && this._Properties.length > 0)
                this.UpdateView();
        });
        
        // Update view with current properties (in case selection happened before resolve)
        this.UpdateView();

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
            // Serialize properties to plain objects for webview transfer
            const serializedProperties = this._Properties.map(p => ({
                Key: p.Key,
                Name: p.Name,
                Value: p.Value,
                Type: p.Type,
                Options: p.Options,
                IsReadOnly: p.IsReadOnly,
                Category: p.Category,
                Group: p.Group
            }));
            
            // Force HTML refresh if webview script might not be initialized
            // This is a workaround for VS Code caching issues
            if (serializedProperties.length > 0)
                this._View.webview.html = this.GetHtmlContentWithProperties(serializedProperties);
            else
            {
                this._View.webview.postMessage({
                    Type: "UpdateProperties",
                    ElementID: this._ElementID,
                    Properties: serializedProperties
                });
            }
        }
    }
    
    GetHtmlContentWithProperties(pProperties: Array<{Key: string; Name: string; Value: unknown; Type: string; Options: string[] | null; IsReadOnly: boolean; Category: string; Group?: string}>): string
    {
        const propertiesJson = JSON.stringify(pProperties);
        const elementId = this._ElementID ? `"${this._ElementID}"` : "null";
        
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
        .color-picker-container {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .color-swatch {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            border: 1px solid var(--vscode-input-border);
            flex-shrink: 0;
        }
        .color-select {
            flex: 1;
        }
        .color-option {
            display: flex;
            align-items: center;
            gap: 8px;
        }
    </style>
</head>
<body>
    <div class="properties-container" id="properties-container">
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let currentElementID = ${elementId};
        const initialProperties = ${propertiesJson};
        
        // Web Colors - sorted by hue for better organization
        const WebColors = [
            // Reds
            { name: "IndianRed", hex: "#CD5C5C" },
            { name: "LightCoral", hex: "#F08080" },
            { name: "Salmon", hex: "#FA8072" },
            { name: "DarkSalmon", hex: "#E9967A" },
            { name: "Crimson", hex: "#DC143C" },
            { name: "Red", hex: "#FF0000" },
            { name: "FireBrick", hex: "#B22222" },
            { name: "DarkRed", hex: "#8B0000" },
            // Pinks
            { name: "Pink", hex: "#FFC0CB" },
            { name: "LightPink", hex: "#FFB6C1" },
            { name: "HotPink", hex: "#FF69B4" },
            { name: "DeepPink", hex: "#FF1493" },
            { name: "MediumVioletRed", hex: "#C71585" },
            { name: "PaleVioletRed", hex: "#DB7093" },
            // Oranges
            { name: "LightSalmon", hex: "#FFA07A" },
            { name: "Coral", hex: "#FF7F50" },
            { name: "Tomato", hex: "#FF6347" },
            { name: "OrangeRed", hex: "#FF4500" },
            { name: "DarkOrange", hex: "#FF8C00" },
            { name: "Orange", hex: "#FFA500" },
            // Yellows
            { name: "Gold", hex: "#FFD700" },
            { name: "Yellow", hex: "#FFFF00" },
            { name: "LightYellow", hex: "#FFFFE0" },
            { name: "LemonChiffon", hex: "#FFFACD" },
            { name: "PapayaWhip", hex: "#FFEFD5" },
            { name: "Moccasin", hex: "#FFE4B5" },
            { name: "PeachPuff", hex: "#FFDAB9" },
            { name: "PaleGoldenrod", hex: "#EEE8AA" },
            { name: "Khaki", hex: "#F0E68C" },
            { name: "DarkKhaki", hex: "#BDB76B" },
            // Purples
            { name: "Lavender", hex: "#E6E6FA" },
            { name: "Thistle", hex: "#D8BFD8" },
            { name: "Plum", hex: "#DDA0DD" },
            { name: "Violet", hex: "#EE82EE" },
            { name: "Orchid", hex: "#DA70D6" },
            { name: "Fuchsia", hex: "#FF00FF" },
            { name: "Magenta", hex: "#FF00FF" },
            { name: "MediumOrchid", hex: "#BA55D3" },
            { name: "MediumPurple", hex: "#9370DB" },
            { name: "BlueViolet", hex: "#8A2BE2" },
            { name: "DarkViolet", hex: "#9400D3" },
            { name: "DarkOrchid", hex: "#9932CC" },
            { name: "DarkMagenta", hex: "#8B008B" },
            { name: "Purple", hex: "#800080" },
            { name: "Indigo", hex: "#4B0082" },
            { name: "SlateBlue", hex: "#6A5ACD" },
            { name: "DarkSlateBlue", hex: "#483D8B" },
            // Greens
            { name: "GreenYellow", hex: "#ADFF2F" },
            { name: "Chartreuse", hex: "#7FFF00" },
            { name: "LawnGreen", hex: "#7CFC00" },
            { name: "Lime", hex: "#00FF00" },
            { name: "LimeGreen", hex: "#32CD32" },
            { name: "PaleGreen", hex: "#98FB98" },
            { name: "LightGreen", hex: "#90EE90" },
            { name: "MediumSpringGreen", hex: "#00FA9A" },
            { name: "SpringGreen", hex: "#00FF7F" },
            { name: "MediumSeaGreen", hex: "#3CB371" },
            { name: "SeaGreen", hex: "#2E8B57" },
            { name: "ForestGreen", hex: "#228B22" },
            { name: "Green", hex: "#008000" },
            { name: "DarkGreen", hex: "#006400" },
            { name: "YellowGreen", hex: "#9ACD32" },
            { name: "OliveDrab", hex: "#6B8E23" },
            { name: "Olive", hex: "#808000" },
            { name: "DarkOliveGreen", hex: "#556B2F" },
            { name: "MediumAquamarine", hex: "#66CDAA" },
            { name: "DarkSeaGreen", hex: "#8FBC8F" },
            { name: "LightSeaGreen", hex: "#20B2AA" },
            { name: "DarkCyan", hex: "#008B8B" },
            { name: "Teal", hex: "#008080" },
            // Blues
            { name: "Aqua", hex: "#00FFFF" },
            { name: "Cyan", hex: "#00FFFF" },
            { name: "LightCyan", hex: "#E0FFFF" },
            { name: "PaleTurquoise", hex: "#AFEEEE" },
            { name: "Aquamarine", hex: "#7FFFD4" },
            { name: "Turquoise", hex: "#40E0D0" },
            { name: "MediumTurquoise", hex: "#48D1CC" },
            { name: "DarkTurquoise", hex: "#00CED1" },
            { name: "CadetBlue", hex: "#5F9EA0" },
            { name: "SteelBlue", hex: "#4682B4" },
            { name: "LightSteelBlue", hex: "#B0C4DE" },
            { name: "PowderBlue", hex: "#B0E0E6" },
            { name: "LightBlue", hex: "#ADD8E6" },
            { name: "SkyBlue", hex: "#87CEEB" },
            { name: "LightSkyBlue", hex: "#87CEFA" },
            { name: "DeepSkyBlue", hex: "#00BFFF" },
            { name: "DodgerBlue", hex: "#1E90FF" },
            { name: "CornflowerBlue", hex: "#6495ED" },
            { name: "RoyalBlue", hex: "#4169E1" },
            { name: "Blue", hex: "#0000FF" },
            { name: "MediumBlue", hex: "#0000CD" },
            { name: "DarkBlue", hex: "#00008B" },
            { name: "Navy", hex: "#000080" },
            { name: "MidnightBlue", hex: "#191970" },
            // Browns
            { name: "Cornsilk", hex: "#FFF8DC" },
            { name: "BlanchedAlmond", hex: "#FFEBCD" },
            { name: "Bisque", hex: "#FFE4C4" },
            { name: "NavajoWhite", hex: "#FFDEAD" },
            { name: "Wheat", hex: "#F5DEB3" },
            { name: "BurlyWood", hex: "#DEB887" },
            { name: "Tan", hex: "#D2B48C" },
            { name: "RosyBrown", hex: "#BC8F8F" },
            { name: "SandyBrown", hex: "#F4A460" },
            { name: "Goldenrod", hex: "#DAA520" },
            { name: "DarkGoldenrod", hex: "#B8860B" },
            { name: "Peru", hex: "#CD853F" },
            { name: "Chocolate", hex: "#D2691E" },
            { name: "SaddleBrown", hex: "#8B4513" },
            { name: "Sienna", hex: "#A0522D" },
            { name: "Brown", hex: "#A52A2A" },
            { name: "Maroon", hex: "#800000" },
            // Whites
            { name: "White", hex: "#FFFFFF" },
            { name: "Snow", hex: "#FFFAFA" },
            { name: "Honeydew", hex: "#F0FFF0" },
            { name: "MintCream", hex: "#F5FFFA" },
            { name: "Azure", hex: "#F0FFFF" },
            { name: "AliceBlue", hex: "#F0F8FF" },
            { name: "GhostWhite", hex: "#F8F8FF" },
            { name: "WhiteSmoke", hex: "#F5F5F5" },
            { name: "Seashell", hex: "#FFF5EE" },
            { name: "Beige", hex: "#F5F5DC" },
            { name: "OldLace", hex: "#FDF5E6" },
            { name: "FloralWhite", hex: "#FFFAF0" },
            { name: "Ivory", hex: "#FFFFF0" },
            { name: "AntiqueWhite", hex: "#FAEBD7" },
            { name: "Linen", hex: "#FAF0E6" },
            { name: "LavenderBlush", hex: "#FFF0F5" },
            { name: "MistyRose", hex: "#FFE4E1" },
            // Grays
            { name: "Gainsboro", hex: "#DCDCDC" },
            { name: "LightGray", hex: "#D3D3D3" },
            { name: "Silver", hex: "#C0C0C0" },
            { name: "DarkGray", hex: "#A9A9A9" },
            { name: "Gray", hex: "#808080" },
            { name: "DimGray", hex: "#696969" },
            { name: "LightSlateGray", hex: "#778899" },
            { name: "SlateGray", hex: "#708090" },
            { name: "DarkSlateGray", hex: "#2F4F4F" },
            { name: "Black", hex: "#000000" }
        ];
        
        console.log("[PropertiesWebview] Script initialized with", initialProperties.length, "properties");
        
        // Render initial properties immediately
        RenderProperties(initialProperties);
        
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            console.log("[PropertiesWebview] Message received:", msg.Type, msg);
            if (msg.Type === "UpdateProperties")
            {
                console.log("[PropertiesWebview] UpdateProperties - ElementID:", msg.ElementID, "Properties count:", msg.Properties?.length);
                currentElementID = msg.ElementID;
                RenderProperties(msg.Properties);
            }
        });

        function RenderProperties(pProperties)
        {
            console.log("[PropertiesWebview] RenderProperties called with:", pProperties?.length || 0, "properties");
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

        function FindColorName(pHex)
        {
            const upperHex = pHex.toUpperCase();
            for (const c of WebColors)
            {
                if (c.hex.toUpperCase() === upperHex)
                    return c.name;
            }
            return pHex;
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

                case "Color":
                    const hexColor = ConvertToHtmlColor(value);
                    let colorOptions = "";
                    for (const c of WebColors)
                    {
                        const selected = c.hex.toUpperCase() === hexColor.toUpperCase() ? "selected" : "";
                        const brightness = parseInt(c.hex.slice(1,3),16) + parseInt(c.hex.slice(3,5),16) + parseInt(c.hex.slice(5,7),16);
                        const textColor = brightness > 382 ? '#000' : '#fff';
                        colorOptions += '<option value="' + c.hex + '" style="background-color:' + c.hex + ';color:' + textColor + '" ' + selected + '>' + c.name + '</option>';
                    }
                    const currentBrightness = parseInt(hexColor.slice(1,3),16) + parseInt(hexColor.slice(3,5),16) + parseInt(hexColor.slice(5,7),16);
                    const currentTextColor = currentBrightness > 382 ? '#000' : '#fff';
                    return '<div class="color-picker-container">' +
                           '<div class="color-swatch" id="swatch-' + key + '" style="background-color:' + hexColor + '"></div>' +
                           '<select data-key="' + key + '" class="color-select" style="background-color:' + hexColor + ';color:' + currentTextColor + '">' + colorOptions + '</select>' +
                           '</div>';

                default:
                    return '<input type="text" data-key="' + key + '" value="' + EscapeHtml(String(value)) + '" ' + readonly + '>';
            }
        }

        function ConvertToHtmlColor(pArgbHex)
        {
            if (!pArgbHex || pArgbHex.length !== 8)
                return "#000000";
            return "#" + pArgbHex.substring(2);
        }

        function ConvertFromHtmlColor(pHtmlColor)
        {
            if (!pHtmlColor || pHtmlColor.length !== 7)
                return "FF000000";
            return "FF" + pHtmlColor.substring(1).toUpperCase();
        }

        function AttachEventHandlers()
        {
            const inputs = document.querySelectorAll("input, select");
            inputs.forEach(function(input) {
                input.addEventListener("change", function() {
                    const key = this.getAttribute("data-key");
                    let value;
                    
                    if (this.type === "checkbox")
                        value = this.checked;
                    else if (this.type === "number")
                        value = parseFloat(this.value) || 0;
                    else if (this.classList.contains("color-select"))
                    {
                        value = ConvertFromHtmlColor(this.value);
                        const rgb = parseInt(this.value.slice(1,3),16) + parseInt(this.value.slice(3,5),16) + parseInt(this.value.slice(5,7),16);
                        this.style.backgroundColor = this.value;
                        this.style.color = rgb > 382 ? '#000' : '#fff';
                        // Update swatch
                        const swatch = document.getElementById('swatch-' + key);
                        if (swatch) swatch.style.backgroundColor = this.value;
                    }
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
        
        console.log("[PropertiesWebview] Script initialized");
        
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            console.log("[PropertiesWebview] Message received:", msg.Type, msg);
            if (msg.Type === "UpdateProperties")
            {
                console.log("[PropertiesWebview] UpdateProperties - ElementID:", msg.ElementID, "Properties count:", msg.Properties?.length);
                currentElementID = msg.ElementID;
                RenderProperties(msg.Properties);
            }
        });

        function RenderProperties(pProperties)
        {
            console.log("[PropertiesWebview] RenderProperties called with:", pProperties);
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

        function GetColorPalette256()
        {
            const colors = [];
            // Web-safe 216 colors (6x6x6 cube)
            for (let r = 0; r < 6; r++)
                for (let g = 0; g < 6; g++)
                    for (let b = 0; b < 6; b++)
                        colors.push({ r: r * 51, g: g * 51, b: b * 51 });
            
            // Add 40 grayscale colors to reach 256
            for (let i = 0; i < 40; i++)
            {
                const gray = Math.round(i * 255 / 39);
                // Avoid duplicates from web-safe palette
                if (gray % 51 !== 0)
                    colors.push({ r: gray, g: gray, b: gray });
            }
            
            // Pad to exactly 256 with more grays if needed
            while (colors.length < 256)
            {
                const gray = Math.round((colors.length - 216) * 6.375);
                colors.push({ r: gray, g: gray, b: gray });
            }
            
            return colors.slice(0, 256);
        }

        function RgbToHex(r, g, b)
        {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
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

                case "Color":
                    const hexColor = ConvertToHtmlColor(value);
                    const palette = GetColorPalette256();
                    let colorOptions = "";
                    for (const c of palette)
                    {
                        const hex = RgbToHex(c.r, c.g, c.b);
                        const selected = hex.toUpperCase() === hexColor.toUpperCase() ? "selected" : "";
                        colorOptions += '<option value="' + hex + '" style="background-color:' + hex + ';color:' + (c.r + c.g + c.b > 382 ? '#000' : '#fff') + '" ' + selected + '>' + hex + '</option>';
                    }
                    return '<select data-key="' + key + '" class="color-select" style="background-color:' + hexColor + ';color:' + (parseInt(hexColor.slice(1,3),16) + parseInt(hexColor.slice(3,5),16) + parseInt(hexColor.slice(5,7),16) > 382 ? '#000' : '#fff') + '">' + colorOptions + '</select>';

                default:
                    return '<input type="text" data-key="' + key + '" value="' + EscapeHtml(String(value)) + '" ' + readonly + '>';
            }
        }

        function ConvertToHtmlColor(pArgbHex)
        {
            // Convert AARRGGBB to #RRGGBB for HTML color input
            if (!pArgbHex || pArgbHex.length !== 8)
                return "#000000";
            return "#" + pArgbHex.substring(2);
        }

        function ConvertFromHtmlColor(pHtmlColor)
        {
            // Convert #RRGGBB to FFRRGGBB (full opacity)
            if (!pHtmlColor || pHtmlColor.length !== 7)
                return "FF000000";
            return "FF" + pHtmlColor.substring(1).toUpperCase();
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
                    else if (this.type === "color")
                        value = ConvertFromHtmlColor(this.value);
                    else if (this.classList.contains("color-select"))
                    {
                        value = ConvertFromHtmlColor(this.value);
                        // Update dropdown background color
                        const rgb = parseInt(this.value.slice(1,3),16) + parseInt(this.value.slice(3,5),16) + parseInt(this.value.slice(5,7),16);
                        this.style.backgroundColor = this.value;
                        this.style.color = rgb > 382 ? '#000' : '#fff';
                    }
                    else
                        value = this.value;

                    vscode.postMessage({
                        Type: "UpdateProperty",
                        PropertyKey: key,
                        Value: value
                    });
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
