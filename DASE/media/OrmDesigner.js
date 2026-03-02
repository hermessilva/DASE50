(function () {
    "use strict";

    const vscode = acquireVsCodeApi();

    const XMessageType = {
        DesignerReady: "DesignerReady",
        LoadModel: "LoadModel",
        ModelLoaded: "ModelLoaded",
        SaveModel: "SaveModel",
        SelectElement: "SelectElement",
        SelectionChanged: "SelectionChanged",
        AddTable: "AddTable",
        AddField: "AddField",
        MoveElement: "MoveElement",
        ReorderField: "ReorderField",
        DragDropAddRelation: "DragDropAddRelation",
        DeleteSelected: "DeleteSelected",
        RenameSelected: "RenameSelected",
        UpdateProperty: "UpdateProperty",
        PropertiesChanged: "PropertiesChanged",
        ValidateModel: "ValidateModel",
        IssuesChanged: "IssuesChanged",
        RequestRename: "RequestRename",
        RenameCompleted: "RenameCompleted",
        AlignLines: "AlignLines",
        // Seed editor
        OpenSeedEditor: "OpenSeedEditor",
        RequestSeedData: "RequestSeedData",
        SeedDataLoaded: "SeedDataLoaded",
        SaveSeedData: "SaveSeedData",
        SeedDataSaved: "SeedDataSaved",
        // Shadow table picker
        RequestShadowTablePicker: "RequestShadowTablePicker",
        ShadowTablePickerData: "ShadowTablePickerData",
        AddShadowTable: "AddShadowTable",
        // AI Organization
        OrganizeTablesAI: "OrganizeTablesAI",
        AIOrganizeShowPicker: "AIOrganizeShowPicker",
        OrganizeTablesAIExecute: "OrganizeTablesAIExecute",
        AIOrganizeStart: "AIOrganizeStart",
        AIOrganizeProgress: "AIOrganizeProgress",
        AIOrganizeComplete: "AIOrganizeComplete",
        AIOrganizeError: "AIOrganizeError",
        AIOrganizeRevert: "AIOrganizeRevert",
        // AI SQL Script
        CreateSQLScript: "CreateSQLScript",
        SQLScriptShowPicker: "SQLScriptShowPicker",
        CreateSQLScriptExecute: "CreateSQLScriptExecute",
        SQLScriptStart: "SQLScriptStart",
        SQLScriptProgress: "SQLScriptProgress",
        SQLScriptComplete: "SQLScriptComplete",
        SQLScriptError: "SQLScriptError",
        // AI ORM Code Generation
        GenerateORMCode: "GenerateORMCode",
        ORMGenShowPicker: "ORMGenShowPicker",
        GenerateORMCodeExecute: "GenerateORMCodeExecute",
        ORMGenBrowseContext: "ORMGenBrowseContext",
        ORMGenContextLoaded: "ORMGenContextLoaded",
        ORMGenStart: "ORMGenStart",
        ORMGenProgress: "ORMGenProgress",
        ORMGenComplete: "ORMGenComplete",
        ORMGenError: "ORMGenError"
    };

    let _Model = { DesignID: null, Tables: [], References: [] };
    let _SelectedIDs = [];
    let _DragState = null;
    let _RelationDragState = null;
    let _FieldDragState = null;
    let _ContextMenuPosition = { X: 0, Y: 0 };
    let _ContextMenuTarget = null;
    let _FieldContextMenuTarget = null;
    let _Issues = [];

    // ── Viewport state (zoom + pan) ─────────────────────────────────────────
    let _Zoom = 1.0;
    let _PanX = 0;
    let _PanY = 0;
    let _SpaceDown = false;
    let _SpacePan = null; // { startClientX, startClientY, startPanX, startPanY }

    // Seed editor state
    let _SeedEditor = null; // { TableID, Columns, Rows, OriginalRows, SelectedRows: Set<number> }
    let _SeedNextNewId = 0;
    let _GuidSeq = 0;
    let _ShadowPickerData = null;

    // Data type icons mapping - returns SVG path or emoji
    const DataTypeIcons = {
        "String": "Abc",
        "Int16": "16",
        "Int32": "32",
        "Int64": "64",
        "Decimal": "0.0",
        "Float": "1.5",
        "Double": "2.0",
        "Boolean": "✓✗",
        "DateTime": "📅",
        "Date": "📅",
        "Time": "🕐",
        "Guid": "ID",
        "Byte": "B",
        "Binary": "01",
        "Text": "Txt"
    };

    function GetDataTypeIcon(pDataType) {
        return DataTypeIcons[pDataType] || pDataType?.substring(0, 3) || "?";
    }

    function GetLuminance(pHexColor) {
        if (!pHexColor) return 0;
        // TFX stores colors as ARGB hex (8 chars, no #): AARRGGBB
        // HTML #RRGGBB has 7 chars. Normalise to plain RRGGBB in both cases.
        let hex = pHexColor.startsWith("#") ? pHexColor.slice(1) : pHexColor;
        if (hex.length === 8) hex = hex.slice(2); // strip alpha byte
        if (hex.length !== 6) return 0;
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function ArgbToCssColor(pArgb) {
        // Convert TFX ARGB hex (AARRGGBB) to CSS #RRGGBB.
        // If already #RRGGBB pass through unchanged.
        if (!pArgb) return null;
        if (pArgb.startsWith("#")) return pArgb;
        if (pArgb.length === 8) return "#" + pArgb.slice(2);
        return "#" + pArgb;
    }

    const FKIcon = "🔗";

    const _Canvas = document.getElementById("canvas");
    const _TablesLayer = document.getElementById("tables-layer");
    const _RelationsLayer = document.getElementById("relations-layer");
    const _CanvasContainer = document.getElementById("canvas-container");
    const _ContextMenu = document.getElementById("context-menu");
    const _TableContextMenu = document.getElementById("table-context-menu");
    const _FieldContextMenu = document.getElementById("field-context-menu");

    function Initialize() {
        SetupCanvasEvents();
        SetupContextMenu();
        SetupZoomPan();
        SetupMessageHandler();
        SendMessage(XMessageType.DesignerReady, {});
    }

    function SendMessage(pType, pPayload) {
        vscode.postMessage({ Type: pType, Payload: pPayload });
    }

    function SetupMessageHandler() {
        window.addEventListener("message", function (pEvent) {
            const msg = pEvent.data;
            HandleMessage(msg);
        });
    }

    function HandleMessage(pMsg) {
        switch (pMsg.Type) {
            case XMessageType.LoadModel:
                _Model = pMsg.Payload || { DesignID: null, Tables: [], References: [] };
                RenderModel();
                break;

            case XMessageType.SelectionChanged:
                _SelectedIDs = pMsg.Payload.SelectedIDs || [];
                UpdateSelectionVisuals();
                break;

            case XMessageType.RequestRename:
                ShowRenameInput(pMsg.Payload.ElementID);
                break;

            case XMessageType.IssuesChanged:
                _Issues = (pMsg.Payload && pMsg.Payload.Issues) ? pMsg.Payload.Issues : [];
                UpdateIssueVisuals();
                break;

            case XMessageType.SeedDataLoaded:
                OpenSeedEditorModal(pMsg.Payload);
                break;

            case XMessageType.SeedDataSaved:
                OnSeedDataSaved(pMsg.Payload);
                break;

            case XMessageType.ShadowTablePickerData:
                OpenShadowPickerModal(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeShowPicker:
                OpenAIPickerOverlay(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeStart:
                OpenAIOrganizeOverlay(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeProgress:
                UpdateAIOrganizeProgress(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeComplete:
                CompleteAIOrganize(pMsg.Payload);
                break;

            case XMessageType.AIOrganizeError:
                ErrorAIOrganize(pMsg.Payload);
                break;

            case XMessageType.SQLScriptShowPicker:
                OpenSQLScriptPickerOverlay(pMsg.Payload);
                break;

            case XMessageType.SQLScriptStart:
                StartSQLScriptProgress(pMsg.Payload);
                break;

            case XMessageType.SQLScriptProgress:
                UpdateSQLScriptProgress(pMsg.Payload);
                break;

            case XMessageType.SQLScriptComplete:
                CompleteSQLScript(pMsg.Payload);
                break;

            case XMessageType.SQLScriptError:
                ErrorSQLScript(pMsg.Payload);
                break;

            case XMessageType.ORMGenShowPicker:
                OpenORMGenPickerOverlay(pMsg.Payload);
                break;

            case XMessageType.ORMGenStart:
                StartORMGenProgress(pMsg.Payload);
                break;

            case XMessageType.ORMGenProgress:
                UpdateORMGenProgress(pMsg.Payload);
                break;

            case XMessageType.ORMGenComplete:
                CompleteORMGen(pMsg.Payload);
                break;

            case XMessageType.ORMGenError:
                ErrorORMGen(pMsg.Payload);
                break;

            case XMessageType.ORMGenContextLoaded:
                ORMGenContextFileLoaded(pMsg.Payload);
                break;
        }
    }

    function SetupContextMenu() {
        _ContextMenu.addEventListener("click", function (e) {
            const item = e.target.closest(".context-menu-item");
            if (!item)
                return;

            const action = item.getAttribute("data-action");
            HideContextMenu();

            switch (action) {
                case "add-table":
                    SendMessage(XMessageType.AddTable, { X: _ContextMenuPosition.X, Y: _ContextMenuPosition.Y });
                    break;
                case "add-shadow-table":
                    SendMessage(XMessageType.RequestShadowTablePicker, { X: _ContextMenuPosition.X, Y: _ContextMenuPosition.Y });
                    break;
                case "delete-selected":
                    SendMessage(XMessageType.DeleteSelected, {});
                    break;
                case "rename-selected":
                    if (_SelectedIDs.length > 0)
                        ShowRenameInput(_SelectedIDs[0]);
                    break;
                case "validate-model":
                    SendMessage(XMessageType.ValidateModel, {});
                    break;
                case "align-lines":
                    SendMessage(XMessageType.AlignLines, {});
                    break;
                case "export-dbml":
                    SendMessage("ExportToDBML", {});
                    break;
                case "organize-tables-ai":
                    SendMessage(XMessageType.OrganizeTablesAI, {});
                    break;
                case "create-sql-script":
                    SendMessage(XMessageType.CreateSQLScript, {});
                    break;
                case "generate-orm-code":
                    SendMessage(XMessageType.GenerateORMCode, {});
                    break;
            }
        });

        _TableContextMenu.addEventListener("click", function (e) {
            const item = e.target.closest(".context-menu-item");
            if (!item)
                return;

            const action = item.getAttribute("data-action");
            const tableID = _ContextMenuTarget;
            HideContextMenu();

            switch (action) {
                case "add-field":
                    if (tableID)
                        SendMessage(XMessageType.AddField, { TableID: tableID, Name: "NewField", DataType: "String" });
                    break;
                case "edit-seed-data":
                    if (tableID)
                        SendMessage(XMessageType.RequestSeedData, { TableID: tableID });
                    break;
                case "delete-table":
                    SendMessage(XMessageType.DeleteSelected, {});
                    break;
                case "rename-table":
                    if (tableID)
                        ShowRenameInput(tableID);
                    break;
            }
        });

        if (_FieldContextMenu) {
            _FieldContextMenu.addEventListener("click", function (e) {
                const item = e.target.closest(".context-menu-item");
                if (!item)
                    return;

                const action = item.getAttribute("data-action");
                const fieldID = _FieldContextMenuTarget;
                HideContextMenu();

                switch (action) {
                    case "delete-field":
                        if (fieldID) {
                            SendMessage(XMessageType.SelectElement, { ElementID: fieldID });
                            SendMessage(XMessageType.DeleteSelected, {});
                        }
                        break;
                    case "rename-field":
                        if (fieldID)
                            ShowRenameInput(fieldID);
                        break;
                }
            });
        }

        document.addEventListener("click", function (e) {
            if (!_ContextMenu.contains(e.target) && !_TableContextMenu.contains(e.target) &&
                (!_FieldContextMenu || !_FieldContextMenu.contains(e.target)))
                HideContextMenu();
        });
    }

    function ShowFieldContextMenu(pX, pY, pFieldID) {
        _FieldContextMenuTarget = pFieldID;
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.classList.remove("visible");
        if (_FieldContextMenu) {
            _FieldContextMenu.style.left = pX + "px";
            _FieldContextMenu.style.top = pY + "px";
            _FieldContextMenu.classList.add("visible");
        }
    }

    function UpdateIssueVisuals() {
        const fieldGroups = _TablesLayer.querySelectorAll(".orm-field-group");
        fieldGroups.forEach(function (fg) {
            const fieldID = fg.getAttribute("data-field-id");
            const hasError = _Issues.some(function (issue) {
                return issue.ElementID === fieldID && issue.Severity >= 2;
            });
            const hasWarning = _Issues.some(function (issue) {
                return issue.ElementID === fieldID;
            });
            fg.classList.toggle("has-error", hasError);
            fg.classList.toggle("has-warning", !hasError && hasWarning);
        });

        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function (t) {
            const tableID = t.getAttribute("data-id");
            const hasError = _Issues.some(function (issue) {
                return issue.ElementID === tableID && issue.Severity >= 2;
            });
            const hasWarning = _Issues.some(function (issue) {
                return issue.ElementID === tableID;
            });
            t.classList.toggle("has-error", hasError);
            t.classList.toggle("has-warning", !hasError && hasWarning);
        });
    }

    function ShowContextMenu(pX, pY, pCanvasX, pCanvasY) {
        _ContextMenuPosition.X = pCanvasX;
        _ContextMenuPosition.Y = pCanvasY;
        _ContextMenuTarget = null;

        // Update menu items based on selection
        const deleteItem = _ContextMenu.querySelector('[data-action="delete-selected"]');
        const renameItem = _ContextMenu.querySelector('[data-action="rename-selected"]');

        if (_SelectedIDs.length === 0) {
            deleteItem.classList.add("disabled");
            renameItem.classList.add("disabled");
        }
        else {
            deleteItem.classList.remove("disabled");
            renameItem.classList.remove("disabled");
        }

        _TableContextMenu.classList.remove("visible");
        _ContextMenu.style.left = pX + "px";
        _ContextMenu.style.top = pY + "px";
        _ContextMenu.classList.add("visible");
    }

    function ShowTableContextMenu(pX, pY, pTableID) {
        _ContextMenuTarget = pTableID;
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.style.left = pX + "px";
        _TableContextMenu.style.top = pY + "px";

        const table = _Model.Tables.find(function (t) { return t.ID === pTableID; });
        const isShadow = table && table.IsShadow;
        const shadowRestricted = ["add-field", "edit-seed-data", "rename-table"];
        const items = _TableContextMenu.querySelectorAll(".context-menu-item");
        for (const item of items) {
            const action = item.getAttribute("data-action");
            item.style.display = (isShadow && shadowRestricted.indexOf(action) >= 0) ? "none" : "";
        }
        const seps = _TableContextMenu.querySelectorAll(".context-menu-separator");
        for (const sep of seps)
            sep.style.display = isShadow ? "none" : "";

        _TableContextMenu.classList.add("visible");
    }

    function HideContextMenu() {
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.classList.remove("visible");
        if (_FieldContextMenu)
            _FieldContextMenu.classList.remove("visible");
        _ContextMenuTarget = null;
        _FieldContextMenuTarget = null;
    }

    // ── Viewport helpers ─────────────────────────────────────────────────────

    /** Convert client (screen) coordinates to canvas (SVG world) coordinates. */
    function ClientToCanvas(pClientX, pClientY) {
        const r = _CanvasContainer.getBoundingClientRect();
        return {
            x: (pClientX - r.left - _PanX) / _Zoom,
            y: (pClientY - r.top  - _PanY) / _Zoom
        };
    }

    /** Apply current _Pan + _Zoom to the canvas element. */
    function ApplyViewport() {
        _Canvas.style.transform = `translate(${_PanX}px,${_PanY}px) scale(${_Zoom})`;
        const indicator = document.getElementById("zoom-indicator");
        if (indicator) indicator.textContent = Math.round(_Zoom * 100) + "%";
    }

    /** Zoom centred on a client-coordinate point, scaling by pFactor. */
    function ZoomAtPoint(pClientX, pClientY, pFactor) {
        const r   = _CanvasContainer.getBoundingClientRect();
        const wx  = (pClientX - r.left - _PanX) / _Zoom;
        const wy  = (pClientY - r.top  - _PanY) / _Zoom;
        _Zoom = Math.max(0.1, Math.min(4.0, _Zoom * pFactor));
        _PanX = pClientX - r.left - wx * _Zoom;
        _PanY = pClientY - r.top  - wy * _Zoom;
        ApplyViewport();
    }

    /** Reset zoom to 100 % and pan to origin. */
    function ZoomReset() {
        _Zoom = 1.0;
        _PanX = 0;
        _PanY = 0;
        ApplyViewport();
    }

    function SetupZoomPan() {
        const ZOOM_FACTOR = 1.1;
        const PAN_STEP    = 40;

        // ── Ctrl+Wheel → zoom; plain Wheel → pan ─────────────────────────
        _CanvasContainer.addEventListener("wheel", function (e) {
            e.preventDefault();

            if (e.ctrlKey) {
                const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
                ZoomAtPoint(e.clientX, e.clientY, factor);
                return;
            }

            // Plain scroll → pan
            const dx = e.shiftKey ? -(e.deltaY || PAN_STEP) : -(e.deltaX || 0);
            const dy = e.shiftKey ? 0 : -(e.deltaY || PAN_STEP);
            _PanX += dx;
            _PanY += dy;
            ApplyViewport();
        }, { passive: false });

        // ── Space-bar held → hand-tool pan (Photoshop style) ─────────────
        document.addEventListener("keydown", function (e) {
            if (e.code === "Space" && !e.repeat &&
                !e.ctrlKey && document.activeElement === document.body) {
                e.preventDefault();
                _SpaceDown = true;
                _CanvasContainer.classList.add("space-pan");
            }

            // Ctrl+0 → reset to 100 %
            if (e.code === "Digit0" && e.ctrlKey) {
                e.preventDefault();
                ZoomReset();
            }

            // Ctrl+= / Ctrl++ → zoom in
            if ((e.code === "Equal" || e.code === "NumpadAdd") && e.ctrlKey) {
                e.preventDefault();
                const r = _CanvasContainer.getBoundingClientRect();
                ZoomAtPoint(r.left + r.width / 2, r.top + r.height / 2, ZOOM_FACTOR);
            }

            // Ctrl+- → zoom out
            if ((e.code === "Minus" || e.code === "NumpadSubtract") && e.ctrlKey) {
                e.preventDefault();
                const r = _CanvasContainer.getBoundingClientRect();
                ZoomAtPoint(r.left + r.width / 2, r.top + r.height / 2, 1 / ZOOM_FACTOR);
            }
        });

        document.addEventListener("keyup", function (e) {
            if (e.code === "Space") {
                _SpaceDown = false;
                _SpacePan = null;
                _CanvasContainer.classList.remove("space-pan", "space-pan-dragging");
            }
        });

        // ── Space-pan drag ────────────────────────────────────────────────
        _CanvasContainer.addEventListener("mousedown", function (e) {
            if (!_SpaceDown) return;
            e.preventDefault();
            _SpacePan = {
                startClientX: e.clientX,
                startClientY: e.clientY,
                startPanX:   _PanX,
                startPanY:   _PanY
            };
            _CanvasContainer.classList.add("space-pan-dragging");
        });

        document.addEventListener("mousemove", function (e) {
            if (!_SpacePan) return;
            _PanX = _SpacePan.startPanX + (e.clientX - _SpacePan.startClientX);
            _PanY = _SpacePan.startPanY + (e.clientY - _SpacePan.startClientY);
            ApplyViewport();
        });

        document.addEventListener("mouseup", function () {
            if (_SpacePan) {
                _SpacePan = null;
                _CanvasContainer.classList.remove("space-pan-dragging");
            }
        });

        // ── Middle-mouse-button drag → pan (bonus, matches Photoshop) ────
        _CanvasContainer.addEventListener("mousedown", function (e) {
            if (e.button !== 1) return;
            e.preventDefault();
            const start = { x: e.clientX, y: e.clientY, px: _PanX, py: _PanY };
            _CanvasContainer.style.cursor = "grabbing";

            const onMove = function (me) {
                _PanX = start.px + (me.clientX - start.x);
                _PanY = start.py + (me.clientY - start.y);
                ApplyViewport();
            };
            const onUp = function () {
                _CanvasContainer.style.cursor = "";
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        });
    }

    function SetupCanvasEvents() {
        _Canvas.addEventListener("click", function (e) {
            if (e.target === _Canvas || e.target.id === "relations-layer" || e.target.id === "tables-layer") {
                // Select the Design when clicking on the background
                if (_Model.DesignID)
                    SendMessage(XMessageType.SelectElement, { ElementID: _Model.DesignID });
                else
                    SendMessage(XMessageType.SelectElement, { Clear: true });
            }
        });

        _CanvasContainer.addEventListener("contextmenu", function (e) {
            e.preventDefault();

            const cPos = ClientToCanvas(e.clientX, e.clientY);
            ShowContextMenu(e.clientX, e.clientY, cPos.x, cPos.y);
        });
    }

    function RenderModel() {
        RenderRelations();
        RenderTables();
        UpdateSelectionVisuals();
    }

    function RenderTables() {
        _TablesLayer.innerHTML = "";

        for (const table of _Model.Tables) {
            const g = CreateTableElement(table);
            _TablesLayer.appendChild(g);
        }
    }

    function CreateTableElement(pTable) {
        const isShadow = !!pTable.IsShadow;
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "orm-table" + (isShadow ? " shadow-table" : ""));
        g.setAttribute("data-id", pTable.ID);
        g.setAttribute("transform", "translate(" + pTable.X + "," + pTable.Y + ")");

        const width = pTable.Width || 200;
        const headerHeight = 28;
        const fieldHeight = 16;

        // Shadow tables render header only — no body or fields
        // ALWAYS calculate - never use pTable.Height to ensure consistency
        const fieldCount = isShadow ? 0 : ((pTable.Fields && pTable.Fields.length) || 0);
        const bodyHeight = fieldCount > 0 ? fieldCount * fieldHeight + 12 : 0;
        const height = headerHeight + bodyHeight;

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("class", "orm-table-rect");
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("rx", 5);
        rect.setAttribute("ry", 5);
        g.appendChild(rect);

        const header = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        header.setAttribute("class", "orm-table-header");
        header.setAttribute("width", width);
        header.setAttribute("height", headerHeight);
        header.setAttribute("rx", 4);
        header.setAttribute("ry", 4);
        g.appendChild(header);

        const headerMask = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        headerMask.setAttribute("class", "orm-table-header");
        headerMask.setAttribute("y", headerHeight - 4);
        headerMask.setAttribute("width", width);
        headerMask.setAttribute("height", 4);
        g.appendChild(headerMask);

        // Subtle body background
        if (fieldCount > 0) {
            const body = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            body.setAttribute("class", "orm-table-body");
            body.setAttribute("y", headerHeight);
            body.setAttribute("width", width);
            body.setAttribute("height", bodyHeight);
            g.appendChild(body);
        }

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("class", "orm-table-icon");
        icon.setAttribute("x", 8);
        icon.setAttribute("y", 18);
        icon.textContent = GetDataTypeIcon(pTable.PKType || "Int32");
        g.appendChild(icon);

        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("class", "orm-table-title");
        title.setAttribute("x", 28);
        title.setAttribute("y", 18);
        title.textContent = pTable.Name || "Unnamed";
        g.appendChild(title);

        // Apply FillProp to header if defined (shadow tables inherit the original's colour)
        if (pTable.FillProp) {
            const cssColor = ArgbToCssColor(pTable.FillProp);
            header.style.fill = cssColor;
            headerMask.style.fill = cssColor;
            // Auto-contrast: use dark text on light backgrounds, white on dark backgrounds
            const luminance = GetLuminance(pTable.FillProp);
            const textColor = luminance > 0.35 ? "#1a1a1a" : "white";
            const iconColor = luminance > 0.35 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.8)";
            title.style.fill = textColor;
            icon.style.fill = iconColor;
        }

        // Shadow table: ghost styling + source document badge
        if (isShadow) {
            // Only apply grey header when no colour was inherited from the original
            if (!pTable.FillProp) {
                header.style.fill = "#555";
                headerMask.style.fill = "#555";
                title.style.fill = "#bbb";
                icon.style.fill = "rgba(180,180,180,0.7)";
            }
            title.style.fontStyle = "italic";
            rect.style.strokeDasharray = "6 3";
            rect.style.stroke = "#666";
            rect.style.fill = "rgba(60,60,60,0.4)";
            if (pTable.ShadowDocumentName) {
                const badge = document.createElementNS("http://www.w3.org/2000/svg", "text");
                badge.setAttribute("class", "orm-shadow-badge");
                badge.setAttribute("x", width - 5);
                badge.setAttribute("y", 11);
                badge.setAttribute("text-anchor", "end");
                badge.textContent = "\u2197 " + pTable.ShadowDocumentName;
                // Adapt badge colour to match the header contrast
                if (pTable.FillProp) {
                    const luminance = GetLuminance(pTable.FillProp);
                    badge.style.fill = luminance > 0.35 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)";
                }
                g.appendChild(badge);
            }
        }

        if (pTable.Fields && pTable.Fields.length > 0) {
            let y = headerHeight + 16;
            for (const field of pTable.Fields) {
                const fieldGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                fieldGroup.setAttribute("class", "orm-field-group");
                fieldGroup.setAttribute("data-field-id", field.ID);
                fieldGroup.style.cursor = "pointer";

                const fieldBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                fieldBg.setAttribute("class", "orm-field-bg");
                fieldBg.setAttribute("x", 2);
                fieldBg.setAttribute("y", y - 12);
                fieldBg.setAttribute("width", width - 4);
                fieldBg.setAttribute("height", 16);
                fieldBg.setAttribute("fill", "transparent");
                fieldGroup.appendChild(fieldBg);

                // Field icon (PK key, FK link, or DataType)
                const fieldIcon = document.createElementNS("http://www.w3.org/2000/svg", "text");
                fieldIcon.setAttribute("class", "orm-field-icon");
                fieldIcon.setAttribute("x", 10);
                fieldIcon.setAttribute("y", y);
                if (field.IsPrimaryKey)
                    fieldIcon.textContent = "🔑";
                else if (field.IsForeignKey)
                    fieldIcon.textContent = FKIcon;
                else
                    fieldIcon.textContent = GetDataTypeIcon(field.DataType);
                fieldGroup.appendChild(fieldIcon);

                // Field name
                const fieldText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                fieldText.setAttribute("class", "orm-table-field" + (field.IsPrimaryKey ? " orm-table-field-pk" : ""));
                fieldText.setAttribute("x", 30);
                fieldText.setAttribute("y", y);

                fieldText.textContent = field.Name || field.FieldName || "field";
                fieldGroup.appendChild(fieldText);

                // IsRequired checkbox on the right
                // PK fields are always required and checkbox is disabled
                const isRequired = field.IsPrimaryKey ? true : field.IsRequired;
                const checkboxGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                checkboxGroup.setAttribute("class", "orm-field-checkbox" + (field.IsPrimaryKey ? " orm-checkbox-disabled" : ""));
                checkboxGroup.setAttribute("transform", "translate(" + (width - 20) + "," + (y - 8) + ")");

                const checkboxBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                checkboxBg.setAttribute("width", 10);
                checkboxBg.setAttribute("height", 10);
                checkboxBg.setAttribute("rx", 2);
                checkboxBg.setAttribute("ry", 2);
                checkboxBg.setAttribute("class", "orm-checkbox-bg");
                checkboxGroup.appendChild(checkboxBg);

                if (isRequired) {
                    const checkMark = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    checkMark.setAttribute("d", "M2,5 L4,7 L8,3");
                    checkMark.setAttribute("class", "orm-checkbox-check");
                    checkboxGroup.appendChild(checkMark);
                }

                // Only enable click for non-PK fields
                if (!field.IsPrimaryKey) {
                    checkboxGroup.style.cursor = "pointer";
                    checkboxGroup.addEventListener("click", function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        SendMessage(XMessageType.UpdateProperty, {
                            ElementID: field.ID,
                            PropertyKey: "IsRequired",
                            Value: !field.IsRequired
                        });
                    });
                }
                fieldGroup.appendChild(checkboxGroup);

                SetupFieldEvents(fieldGroup, field, pTable);
                g.appendChild(fieldGroup);

                y += 16;
            }
        }

        // Hover border (dashed rectangle around table)
        const hoverPadding = 10;
        const hoverBorder = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        hoverBorder.setAttribute("class", "orm-table-hover-border");
        hoverBorder.setAttribute("x", -hoverPadding);
        hoverBorder.setAttribute("y", -hoverPadding);
        hoverBorder.setAttribute("width", width + hoverPadding * 2);
        hoverBorder.setAttribute("height", height + hoverPadding * 2);
        g.appendChild(hoverBorder);

        // Anchor points - 8 points: 4 corners + 4 edge centers
        // Anchors are centered on the hover border line
        const anchorSize = 12;
        const anchorPositions = [
            // Corners - centered on hover border corners
            { x: -hoverPadding - anchorSize / 2, y: -hoverPadding - anchorSize / 2, anchor: "top-left" },
            { x: width + hoverPadding - anchorSize / 2, y: -hoverPadding - anchorSize / 2, anchor: "top-right" },
            { x: -hoverPadding - anchorSize / 2, y: height + hoverPadding - anchorSize / 2, anchor: "bottom-left" },
            { x: width + hoverPadding - anchorSize / 2, y: height + hoverPadding - anchorSize / 2, anchor: "bottom-right" },
            // Edge centers - centered on hover border edges
            { x: width / 2 - anchorSize / 2, y: -hoverPadding - anchorSize / 2, anchor: "top" },
            { x: width / 2 - anchorSize / 2, y: height + hoverPadding - anchorSize / 2, anchor: "bottom" },
            { x: -hoverPadding - anchorSize / 2, y: height / 2 - anchorSize / 2, anchor: "left" },
            { x: width + hoverPadding - anchorSize / 2, y: height / 2 - anchorSize / 2, anchor: "right" }
        ];

        for (const pos of anchorPositions) {
            const anchor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            anchor.setAttribute("class", "orm-table-anchor");
            anchor.setAttribute("x", pos.x);
            anchor.setAttribute("y", pos.y);
            anchor.setAttribute("width", anchorSize);
            anchor.setAttribute("height", anchorSize);
            anchor.setAttribute("data-anchor", pos.anchor);
            g.appendChild(anchor);
        }

        SetupTableEvents(g, pTable);

        return g;
    }

    function SetupTableEvents(pElement, pTable) {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let elementStartX = pTable.X;
        let elementStartY = pTable.Y;

        pElement.addEventListener("mousedown", function (e) {
            if (e.button !== 0) return;

            // Let space-pan take over when Space is held
            if (_SpaceDown) return;

            if (e.target.classList.contains("orm-table-anchor")) {
                StartRelationDrag(pTable, e);
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID, Toggle: true });

            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            elementStartX = pTable.X;
            elementStartY = pTable.Y;

            const onMouseMove = function (e) {
                if (!isDragging)
                    return;

                const dx = (e.clientX - dragStartX) / _Zoom;
                const dy = (e.clientY - dragStartY) / _Zoom;
                const newX = Math.max(0, elementStartX + dx);
                const newY = Math.max(0, elementStartY + dy);

                pElement.setAttribute("transform", "translate(" + newX + "," + newY + ")");
                pTable.X = newX;
                pTable.Y = newY;
            };

            const onMouseUp = function (e) {
                if (isDragging && (pTable.X !== elementStartX || pTable.Y !== elementStartY)) {
                    SendMessage(XMessageType.MoveElement, {
                        ElementID: pTable.ID,
                        X: pTable.X,
                        Y: pTable.Y
                    });
                }

                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        pElement.addEventListener("dblclick", function (e) {
            if (!pTable.IsShadow)
                ShowRenameInput(pTable.ID);
        });

        pElement.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            e.stopPropagation();
            SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID });
            ShowTableContextMenu(e.clientX, e.clientY, pTable.ID);
        });
    }

    function SetupFieldEvents(pElement, pField, pTable) {
        let isDragging = false;
        let dragStartY = 0;
        let dragThreshold = 5;

        pElement.addEventListener("mousedown", function (e) {
            e.preventDefault();
            e.stopPropagation();

            // PKFields cannot be reordered
            if (pField.IsPrimaryKey) {
                if (!e.ctrlKey)
                    SendMessage(XMessageType.SelectElement, { ElementID: pField.ID });
                else
                    SendMessage(XMessageType.SelectElement, { ElementID: pField.ID, Toggle: true });
                return;
            }

            dragStartY = e.clientY;
            isDragging = false;

            const onMouseMove = function (me) {
                const dy = Math.abs(me.clientY - dragStartY);

                if (!isDragging && dy > dragThreshold) {
                    isDragging = true;
                    StartFieldDrag(pField, pTable, pElement, me);
                }

                if (isDragging && _FieldDragState)
                    UpdateFieldDrag(me);
            };

            const onMouseUp = function (me) {
                if (isDragging && _FieldDragState)
                    EndFieldDrag();
                else {
                    // Simple click - select field
                    if (!e.ctrlKey)
                        SendMessage(XMessageType.SelectElement, { ElementID: pField.ID });
                    else
                        SendMessage(XMessageType.SelectElement, { ElementID: pField.ID, Toggle: true });
                }

                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });

        pElement.addEventListener("dblclick", function (e) {
            e.preventDefault();
            e.stopPropagation();
            ShowRenameInput(pField.ID);
        });

        pElement.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (!pField.IsPrimaryKey) {
                SendMessage(XMessageType.SelectElement, { ElementID: pField.ID });
                ShowFieldContextMenu(e.clientX, e.clientY, pField.ID);
            }
        });
    }

    function StartFieldDrag(pField, pTable, pElement, pEvent) {
        // Find field index within the table
        const fieldIndex = pTable.Fields.findIndex(f => f.ID === pField.ID);
        if (fieldIndex < 0)
            return;

        // Create drag ghost as a separate group that follows mouse
        const ghost = document.createElementNS("http://www.w3.org/2000/svg", "g");
        ghost.classList.add("orm-field-drag-ghost");
        ghost.setAttribute("data-drag-ghost", "true");

        // Get the original field's bounding box in screen coordinates
        const bbox = pElement.getBBox();
        const fieldWidth = bbox.width;
        const fieldHeight = bbox.height;

        // Create background for visibility (positioned at 0,0 in ghost's local coords)
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute("x", -2);
        bg.setAttribute("y", -1);
        bg.setAttribute("width", fieldWidth + 4);
        bg.setAttribute("height", fieldHeight + 2);
        bg.setAttribute("class", "orm-field-drag-ghost-bg");
        ghost.appendChild(bg);

        // Clone the field content and reset its position to (0,0)
        const fieldClone = pElement.cloneNode(true);
        fieldClone.classList.remove("orm-field-drag-source");
        // Remove the original transform/position - set to origin
        fieldClone.setAttribute("transform", `translate(${-bbox.x}, ${-bbox.y})`);
        ghost.appendChild(fieldClone);

        // Calculate mouse offset from field's top-left for stable dragging
        const _ccStart = ClientToCanvas(pEvent.clientX, pEvent.clientY);
        const mouseX = _ccStart.x;
        const mouseY = _ccStart.y;

        // Calculate offset relative to field's top-left corner on canvas
        const dragOffsetX = mouseX - (pTable.X + bbox.x);
        const dragOffsetY = mouseY - (pTable.Y + bbox.y);

        // Position ghost at original field position
        ghost.setAttribute("transform", `translate(${mouseX - dragOffsetX}, ${mouseY - dragOffsetY})`);

        _TablesLayer.appendChild(ghost);

        // Add dragging class to original
        pElement.classList.add("orm-field-drag-source");

        _FieldDragState = {
            Field: pField,
            Table: pTable,
            OriginalElement: pElement,
            Ghost: ghost,
            OriginalIndex: fieldIndex,
            CurrentIndex: fieldIndex,
            TableElement: pElement.closest(".orm-table"),
            GhostWidth: fieldWidth,
            GhostHeight: fieldHeight,
            DragOffsetX: dragOffsetX,
            DragOffsetY: dragOffsetY
        };

        // Show drop indicators
        UpdateFieldDropIndicators();
    }

    function UpdateFieldDrag(pEvent) {
        if (!_FieldDragState)
            return;

        const table = _FieldDragState.Table;
        const tableElement = _FieldDragState.TableElement;
        if (!tableElement)
            return;

        // Get mouse position relative to canvas
        const _ccMove = ClientToCanvas(pEvent.clientX, pEvent.clientY);
        const mouseX = _ccMove.x;
        const mouseY = _ccMove.y;

        // Update ghost position to follow mouse maintaining initial offset
        if (_FieldDragState.Ghost) {
            const ghostX = mouseX - (_FieldDragState.DragOffsetX || 0);
            const ghostY = mouseY - (_FieldDragState.DragOffsetY || 0);
            _FieldDragState.Ghost.setAttribute("transform", `translate(${ghostX}, ${ghostY})`);
        }

        // Calculate which field slot the mouse is over
        const headerHeight = 28;
        const fieldHeight = 16;
        const tableY = table.Y;

        // Calculate relative Y within the table's field area
        const relY = mouseY - tableY - headerHeight - 4;
        let targetIndex = Math.floor(relY / fieldHeight);

        // Skip PK field (index 0 if present)
        const hasPK = table.Fields.some(f => f.IsPrimaryKey);
        const minIndex = hasPK ? 1 : 0;
        const maxIndex = table.Fields.length - 1;

        targetIndex = Math.max(minIndex, Math.min(targetIndex, maxIndex));

        if (targetIndex !== _FieldDragState.CurrentIndex) {
            _FieldDragState.CurrentIndex = targetIndex;
            UpdateFieldDropIndicators();
        }
    }

    function UpdateFieldDropIndicators() {
        if (!_FieldDragState)
            return;

        const tableElement = _FieldDragState.TableElement;
        if (!tableElement)
            return;

        // Remove existing indicators
        const existing = tableElement.querySelectorAll(".orm-field-drop-indicator");
        existing.forEach(el => el.remove());

        // Don't show indicator if we're at the original position
        if (_FieldDragState.CurrentIndex === _FieldDragState.OriginalIndex)
            return;

        // Create drop indicator line
        const headerHeight = 28;
        const fieldHeight = 16;
        const table = _FieldDragState.Table;
        const width = table.Width || 200;

        // Calculate Y position for the indicator
        const indicatorY = headerHeight + 4 + (_FieldDragState.CurrentIndex * fieldHeight);

        const indicator = document.createElementNS("http://www.w3.org/2000/svg", "line");
        indicator.setAttribute("class", "orm-field-drop-indicator");
        indicator.setAttribute("x1", 4);
        indicator.setAttribute("y1", indicatorY);
        indicator.setAttribute("x2", width - 4);
        indicator.setAttribute("y2", indicatorY);
        tableElement.appendChild(indicator);
    }

    function EndFieldDrag() {
        if (!_FieldDragState)
            return;

        const origIndex = _FieldDragState.OriginalIndex;
        const newIndex = _FieldDragState.CurrentIndex;
        const fieldID = _FieldDragState.Field.ID;
        const tableElement = _FieldDragState.TableElement;

        // Clean up ghost and indicators
        if (_FieldDragState.Ghost)
            _FieldDragState.Ghost.remove();

        if (_FieldDragState.OriginalElement)
            _FieldDragState.OriginalElement.classList.remove("orm-field-drag-source");

        if (tableElement) {
            const indicators = tableElement.querySelectorAll(".orm-field-drop-indicator");
            indicators.forEach(el => el.remove());
        }

        // If position changed, send reorder message
        if (newIndex !== origIndex) {
            SendMessage(XMessageType.ReorderField, {
                FieldID: fieldID,
                NewIndex: newIndex
            });
        }

        _FieldDragState = null;
    }

    function StartRelationDrag(pSourceTable, pEvent) {
        pEvent.preventDefault();
        pEvent.stopPropagation();

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("class", "relation-drag-line");

        // Get anchor position from clicked element
        const anchor = pEvent.target;
        const anchorType = anchor.getAttribute("data-anchor");

        // Calculate visual height (same as CreateTableElement)
        const headerHeight = 28;
        const fieldHeight = 16;
        const padding = 12;
        const fieldCount = pSourceTable.Fields ? pSourceTable.Fields.length : 0;
        const visualHeight = fieldCount > 0
            ? headerHeight + (fieldCount * fieldHeight) + padding
            : headerHeight;
        const width = pSourceTable.Width || 200;

        // Calculate start position based on anchor type
        let startX, startY;
        switch (anchorType) {
            case "right":
                startX = pSourceTable.X + width;
                startY = pSourceTable.Y + visualHeight / 2;
                break;
            case "left":
                startX = pSourceTable.X;
                startY = pSourceTable.Y + visualHeight / 2;
                break;
            case "top":
                startX = pSourceTable.X + width / 2;
                startY = pSourceTable.Y;
                break;
            case "bottom":
                startX = pSourceTable.X + width / 2;
                startY = pSourceTable.Y + visualHeight;
                break;
            case "top-left":
                startX = pSourceTable.X;
                startY = pSourceTable.Y;
                break;
            case "top-right":
                startX = pSourceTable.X + width;
                startY = pSourceTable.Y;
                break;
            case "bottom-left":
                startX = pSourceTable.X;
                startY = pSourceTable.Y + visualHeight;
                break;
            case "bottom-right":
                startX = pSourceTable.X + width;
                startY = pSourceTable.Y + visualHeight;
                break;
            default:
                // Fallback to right side
                startX = pSourceTable.X + width;
                startY = pSourceTable.Y + visualHeight / 2;
                break;
        }

        line.setAttribute("x1", startX);
        line.setAttribute("y1", startY);
        line.setAttribute("x2", startX);
        line.setAttribute("y2", startY);

        _RelationsLayer.appendChild(line);

        _RelationDragState = {
            SourceTable: pSourceTable,
            Line: line,
            StartX: startX,
            StartY: startY,
            IsCtrl: pEvent.ctrlKey
        };

        // Visual feedback: dashed drag line for 1:1 (Ctrl held)
        if (pEvent.ctrlKey)
            line.setAttribute("stroke-dasharray", "6 4");

        const onMouseMove = function (e) {
            if (!_RelationDragState)
                return;

            const _ccRm = ClientToCanvas(e.clientX, e.clientY);
            const x = _ccRm.x;
            const y = _ccRm.y;

            _RelationDragState.Line.setAttribute("x2", x);
            _RelationDragState.Line.setAttribute("y2", y);
        };

        const onMouseUp = function (e) {
            if (!_RelationDragState)
                return;

            const _ccRu = ClientToCanvas(e.clientX, e.clientY);
            const x = _ccRu.x;
            const y = _ccRu.y;

            const targetTable = FindTableAtPoint(x, y);

            if (targetTable && targetTable.ID !== _RelationDragState.SourceTable.ID) {
                SendMessage(XMessageType.DragDropAddRelation, {
                    SourceID: _RelationDragState.SourceTable.ID,
                    TargetID: targetTable.ID,
                    IsOneToOne: !!_RelationDragState.IsCtrl
                });
            }

            _RelationDragState.Line.remove();
            _RelationDragState = null;

            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }

    function FindTableAtPoint(pX, pY) {
        const headerHeight = 28;
        const fieldHeight = 16;
        const padding = 12;

        for (const table of _Model.Tables) {
            const x = table.X;
            const y = table.Y;
            const w = table.Width || 200;

            // Calculate visual height based on field count
            const fieldCount = table.Fields ? table.Fields.length : 0;
            const h = fieldCount > 0
                ? headerHeight + (fieldCount * fieldHeight) + padding
                : headerHeight;

            if (pX >= x && pX <= x + w && pY >= y && pY <= y + h)
                return table;
        }
        return null;
    }

    function BuildPathFromPoints(pPoints) {
        if (!pPoints || pPoints.length < 2)
            return "";

        const CORNER_RADIUS = 15;

        // Helper: arredondar valor
        function round(v) { return Math.round(v * 10) / 10; }

        // Helper: calcula ponto no círculo (mesmo algoritmo do XMath.PointCircle)
        function pointCircle(pCenter, pPoint, pRadius) {
            const dx = pPoint.X - pCenter.X;
            const dy = pPoint.Y - pCenter.Y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.001) return { X: pCenter.X, Y: pCenter.Y };
            const ratio = pRadius / dist;
            return { X: pCenter.X + dx * ratio, Y: pCenter.Y + dy * ratio };
        }

        // Helper: calcula os pontos do canto arredondado (mesmo algoritmo do XMath.AddCorner)
        function addCorner(pCorner, pMaxRadius, pBefore, pAfter) {
            const p1 = { X: round(pBefore.X), Y: round(pBefore.Y) };
            const p2 = { X: round(pAfter.X), Y: round(pAfter.Y) };
            const c = { X: round(pCorner.X), Y: round(pCorner.Y) };

            if (c.X === p1.X && c.Y === p1.Y) return null;
            if (c.X === p2.X && c.Y === p2.Y) return null;

            const isOrthogonal = (p1.Y === c.Y && c.X === p2.X) || (p1.X === c.X && c.Y === p2.Y);
            if (!isOrthogonal) return null;

            // Calculate distance to previous and next points
            const distBefore = Math.sqrt(Math.pow(c.X - p1.X, 2) + Math.pow(c.Y - p1.Y, 2));
            const distAfter = Math.sqrt(Math.pow(c.X - p2.X, 2) + Math.pow(c.Y - p2.Y, 2));

            // Radius must not exceed half of the shortest adjacent segment
            const maxBySegments = Math.min(distBefore, distAfter) / 2;
            const radius = Math.min(pMaxRadius, maxBySegments);

            if (radius < 1) return null;

            const before = pointCircle(pCorner, pBefore, radius);
            const after = pointCircle(pCorner, pAfter, radius);

            return { before, after, corner: pCorner };
        }

        let path = `M ${pPoints[0].X} ${pPoints[0].Y}`;

        for (let i = 1; i < pPoints.length; i++) {
            const prev = pPoints[i - 1];
            const curr = pPoints[i];
            const next = i < pPoints.length - 1 ? pPoints[i + 1] : null;

            if (next) {
                // Tenta criar canto arredondado
                const corner = addCorner(curr, CORNER_RADIUS, prev, next);
                if (corner) {
                    // Linha até o ponto antes da curva
                    path += ` L ${corner.before.X} ${corner.before.Y}`;
                    // Curva Bezier quadrática (Q) usando o canto como ponto de controle
                    path += ` Q ${corner.corner.X} ${corner.corner.Y} ${corner.after.X} ${corner.after.Y}`;
                }
                else {
                    // Sem canto válido, linha reta normal
                    path += ` L ${curr.X} ${curr.Y}`;
                }
            }
            else {
                // Último ponto, linha reta
                path += ` L ${curr.X} ${curr.Y}`;
            }
        }

        return path;
    }

    function SimplifyReferencePoints(pPoints, pSourceTable, pTargetTable) {
        // ══════════════════════════════════════════════════════════════════════════════
        // ROTEAMENTO É FEITO PELO TFX (XORMDesign.ts)
        // Esta função apenas valida e limpa os pontos recebidos
        // NÃO recalcular rotas - respeitar os pontos enviados pelo backend
        // ══════════════════════════════════════════════════════════════════════════════

        if (!pPoints || pPoints.length < 2)
            return [];

        // Filtrar pontos inválidos
        const valid = pPoints.filter(p => p && Number.isFinite(p.X) && Number.isFinite(p.Y));
        if (valid.length < 2)
            return [];

        // Remover pontos duplicados consecutivos
        const cleaned = [valid[0]];
        for (let i = 1; i < valid.length; i++) {
            const prev = cleaned[cleaned.length - 1];
            if (Math.abs(valid[i].X - prev.X) > 1 || Math.abs(valid[i].Y - prev.Y) > 1)
                cleaned.push(valid[i]);
        }

        // Remover pontos colineares intermediários
        if (cleaned.length > 2) {
            const final = [cleaned[0]];
            for (let i = 1; i < cleaned.length - 1; i++) {
                const a = final[final.length - 1];
                const b = cleaned[i];
                const c = cleaned[i + 1];
                const sameX = Math.abs(a.X - b.X) < 2 && Math.abs(b.X - c.X) < 2;
                const sameY = Math.abs(a.Y - b.Y) < 2 && Math.abs(b.Y - c.Y) < 2;
                if (!sameX && !sameY)
                    final.push(b);
            }
            final.push(cleaned[cleaned.length - 1]);
            return final;
        }

        return cleaned;
    }

    function RenderRelations() {
        _RelationsLayer.innerHTML = "";

        for (const ref of _Model.References) {
            const g = CreateRelationElement(ref);
            if (g)
                _RelationsLayer.appendChild(g);
        }
    }

    function GetTableColor(pTableID) {
        const table = _Model.Tables.find(t => t.ID === pTableID);
        if (table && table.FillProp)
            return ArgbToCssColor(table.FillProp);
        return "#2d8a4e";
    }

    function CreateRelationElement(pRef) {
        // Source is normally a field ID - find the table that contains this field.
        // Fallback: legacy 1:1 Table→Table references use the source table ID directly.
        let sourceTable = _Model.Tables.find(t =>
            t.Fields && t.Fields.some(f => f.ID === pRef.SourceFieldID)
        );
        if (!sourceTable)
            sourceTable = _Model.Tables.find(t => t.ID === pRef.SourceFieldID);
        // Target is a table ID
        const targetTable = _Model.Tables.find(t => t.ID === pRef.TargetTableID);

        if (!sourceTable || !targetTable)
            return null;

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "orm-reference");
        g.setAttribute("data-id", pRef.ID);

        // Se há pontos de roteamento, use-os; caso contrário, calcule um caminho simples
        const pointsRaw = pRef.Points && pRef.Points.length >= 2 ? pRef.Points : [];
        const points = SimplifyReferencePoints(pointsRaw, sourceTable, targetTable);

        const lineColor = GetTableColor(pRef.TargetTableID);

        if (points.length >= 2) {
            // Hit-area path (wide, transparent) — makes the thin line easy to click
            const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            hitPath.setAttribute("class", "orm-reference-hit");
            hitPath.setAttribute("d", BuildPathFromPoints(points));
            g.appendChild(hitPath);

            // Visible routed path
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "orm-fk-line" + (pRef.IsOneToOne ? " orm-fk-line-one-to-one" : ""));
            path.setAttribute("d", BuildPathFromPoints(points));
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", lineColor);
            if (pRef.IsOneToOne)
                path.setAttribute("stroke-dasharray", "6 4");
            path.setAttribute("marker-end", "url(#arrowhead)");
            g.appendChild(path);
        }
        else {
            // Fallback: straight line
            const x1 = sourceTable.X + (sourceTable.Width || 200);
            const y1 = sourceTable.Y + (sourceTable.Height || 150) / 2;
            const x2 = targetTable.X;
            const y2 = targetTable.Y + (targetTable.Height || 150) / 2;

            const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hitLine.setAttribute("class", "orm-reference-hit");
            hitLine.setAttribute("x1", x1); hitLine.setAttribute("y1", y1);
            hitLine.setAttribute("x2", x2); hitLine.setAttribute("y2", y2);
            g.appendChild(hitLine);

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "orm-fk-line" + (pRef.IsOneToOne ? " orm-fk-line-one-to-one" : ""));
            line.setAttribute("x1", x1); line.setAttribute("y1", y1);
            line.setAttribute("x2", x2); line.setAttribute("y2", y2);
            line.setAttribute("stroke", lineColor);
            if (pRef.IsOneToOne)
                line.setAttribute("stroke-dasharray", "6 4");
            line.setAttribute("marker-end", "url(#arrowhead)");
            g.appendChild(line);
        }

        g.addEventListener("click", function (e) {
            e.stopPropagation();
            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID, Toggle: true });
        });

        return g;
    }

    function UpdateSelectionVisuals() {
        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function (t) {
            const id = t.getAttribute("data-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                t.classList.add("selected");
            else
                t.classList.remove("selected");
        });

        const refs = _RelationsLayer.querySelectorAll(".orm-reference");
        refs.forEach(function (r) {
            const id = r.getAttribute("data-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                r.classList.add("selected");
            else
                r.classList.remove("selected");
        });

        const fields = _TablesLayer.querySelectorAll(".orm-field-group");
        fields.forEach(function (f) {
            const id = f.getAttribute("data-field-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                f.classList.add("selected");
            else
                f.classList.remove("selected");
        });
    }

    function ShowRenameInput(pElementID) {
        // Try to find table first
        let table = _Model.Tables.find(t => t.ID === pElementID);
        let field = null;
        let parentTable = null;

        // If not a table, look for a field
        if (!table) {
            for (const t of _Model.Tables) {
                if (t.Fields) {
                    field = t.Fields.find(f => f.ID === pElementID);
                    if (field) {
                        parentTable = t;
                        break;
                    }
                }
            }
        }

        if (!table && !field)
            return;

        let g, screenX, screenY, inputWidth, currentName;
        const cRect = _CanvasContainer.getBoundingClientRect();

        if (table) {
            g = _TablesLayer.querySelector('[data-id="' + pElementID + '"]');
            if (!g) return;
            // Canvas → screen using current viewport transform
            screenX  = table.X * _Zoom + _PanX + cRect.left;
            screenY  = table.Y * _Zoom + _PanY + cRect.top;
            inputWidth = (table.Width || 200) * _Zoom;
            currentName = table.Name || "";
        }
        else {
            g = _TablesLayer.querySelector('[data-field-id="' + pElementID + '"]');
            if (!g) return;
            // DOM element already positioned by CSS transform → getBoundingClientRect is correct
            const fieldRect = g.getBoundingClientRect();
            screenX  = fieldRect.left;
            screenY  = fieldRect.top;
            inputWidth = (parentTable.Width || 200) * _Zoom;
            currentName = field.Name || "";
        }

        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("class", "rename-input");
        input.value = currentName;
        input.style.left  = (screenX + 10) + "px";
        input.style.top   = (screenY  + 4) + "px";
        input.style.width = (inputWidth - 20) + "px";

        document.body.appendChild(input);
        input.focus();
        input.select();

        const commit = function () {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                SendMessage(XMessageType.RenameCompleted, { NewName: newName });
            }
            input.remove();
        };

        input.addEventListener("blur", commit);
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                commit();
            }
            else if (e.key === "Escape") {
                e.preventDefault();
                input.remove();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", Initialize);

    // ═══════════════════════════════════════════════════════════════════════
    // SHADOW TABLE PICKER
    // ═══════════════════════════════════════════════════════════════════════

    function OpenShadowPickerModal(pPayload) {
        if (!pPayload || !pPayload.Models)
            return;

        _ShadowPickerData = pPayload;

        const overlay = document.getElementById("shadow-picker-overlay");
        const searchInput = document.getElementById("shadow-search");
        const status = document.getElementById("shadow-status");

        searchInput.value = "";
        status.textContent = "";
        BuildShadowTree(pPayload.Models, "");

        overlay.style.display = "flex";

        document.getElementById("shadow-picker-close").onclick = CloseShadowPickerModal;
        document.getElementById("shadow-btn-cancel").onclick = CloseShadowPickerModal;

        const addBtn = document.getElementById("shadow-btn-add");
        if (addBtn) {
            addBtn.onclick = function () {
                const selectedItems = document.querySelectorAll(".shadow-table-item.selected");
                if (selectedItems.length === 0)
                    return;

                for (const item of selectedItems) {
                    const m = JSON.parse(item.getAttribute("data-model"));
                    const t = JSON.parse(item.getAttribute("data-table"));
                    SendMessage(XMessageType.AddShadowTable, {
                        X: _ShadowPickerData.X,
                        Y: _ShadowPickerData.Y,
                        ModelName: m.ModelName,
                        DocumentID: m.DocumentID,
                        DocumentName: m.DocumentName,
                        ModuleID: m.ModuleID,
                        ModuleName: m.ModuleName,
                        TableID: t.ID,
                        TableName: t.Name
                    });
                }
                CloseShadowPickerModal();
            };
        }

        searchInput.oninput = function () {
            BuildShadowTree(pPayload.Models, searchInput.value);
        };

        searchInput.onkeydown = function (e) {
            if (e.key === "Escape")
                CloseShadowPickerModal();
        };

        overlay.focus();
        searchInput.focus();
    }

    function CloseShadowPickerModal() {
        const overlay = document.getElementById("shadow-picker-overlay");
        if (overlay)
            overlay.style.display = "none";
        _ShadowPickerData = null;
    }

    function BuildShadowTree(pModels, pFilter) {
        const tree = document.getElementById("shadow-tree");
        tree.innerHTML = "";

        const filter = (pFilter || "").toLowerCase().trim();
        let visibleCount = 0;
        let totalCount = 0;

        for (const model of pModels) {
            const matchingTables = model.Tables.filter(function (t) {
                totalCount++;
                return !filter || t.Name.toLowerCase().indexOf(filter) >= 0;
            });

            if (matchingTables.length === 0)
                continue;

            visibleCount += matchingTables.length;

            const groupEl = document.createElement("div");
            groupEl.className = "shadow-group";
            groupEl.textContent = model.ModelName || model.DocumentName;
            tree.appendChild(groupEl);

            for (const tbl of matchingTables) {
                const itemEl = document.createElement("div");
                itemEl.className = "shadow-table-item";
                itemEl.textContent = tbl.Name;
                itemEl.title = model.DocumentName + " \u203a " + tbl.Name;

                itemEl.setAttribute("data-model", JSON.stringify(model));
                itemEl.setAttribute("data-table", JSON.stringify(tbl));

                itemEl.addEventListener("click", function (e) {
                    if (e.ctrlKey || e.metaKey) {
                        itemEl.classList.toggle("selected");
                    }
                    else {
                        const items = tree.querySelectorAll(".shadow-table-item");
                        for (const it of items)
                            it.classList.remove("selected");
                        itemEl.classList.add("selected");
                    }
                });

                itemEl.addEventListener("dblclick", (function (m, t) {
                    return function () {
                        if (!_ShadowPickerData)
                            return;
                        SendMessage(XMessageType.AddShadowTable, {
                            X: _ShadowPickerData.X,
                            Y: _ShadowPickerData.Y,
                            ModelName: m.ModelName,
                            DocumentID: m.DocumentID,
                            DocumentName: m.DocumentName,
                            ModuleID: m.ModuleID,
                            ModuleName: m.ModuleName,
                            TableID: t.ID,
                            TableName: t.Name
                        });
                        CloseShadowPickerModal();
                    };
                })(model, tbl));

                tree.appendChild(itemEl);
            }
        }

        const statusEl = document.getElementById("shadow-status");
        if (statusEl)
            statusEl.textContent = visibleCount + " of " + totalCount + " tables";
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SEED DATA EDITOR
    // ═══════════════════════════════════════════════════════════════════════

    function OpenSeedEditorModal(pPayload) {
        if (!pPayload || !pPayload.TableID)
            return;

        _SeedEditor = {
            TableID: pPayload.TableID,
            TableName: pPayload.TableName || "Table",
            Columns: pPayload.Columns || [],
            Rows: (pPayload.Rows || []).map(function (r) {
                return { TupleID: r.TupleID, Values: Object.assign({}, r.Values), IsNew: false };
            }),
            SelectedRows: new Set()
        };
        _SeedNextNewId = 0;

        const overlay = document.getElementById("seed-editor-overlay");
        const title = document.getElementById("seed-modal-title");

        title.textContent = "Seed Data — " + _SeedEditor.TableName;

        BuildSeedGrid();
        UpdateSeedRowCount();
        SetSeedStatusMessage("");
        SetSeedValidationBadge(null);
        document.getElementById("seed-btn-save").disabled = false;

        overlay.style.display = "flex";

        // Close handlers
        document.getElementById("seed-modal-close").onclick = CloseSeedEditorModal;
        document.getElementById("seed-btn-cancel").onclick = CloseSeedEditorModal;
        overlay.addEventListener("mousedown", function (e) {
            if (e.target === overlay)
                CloseSeedEditorModal();
        }, { once: true });

        document.getElementById("seed-add-row").onclick = AddSeedRow;
        document.getElementById("seed-delete-rows").onclick = DeleteSelectedSeedRows;
        document.getElementById("seed-btn-save").onclick = SaveSeedEditorData;

        // Keyboard shortcuts — attach to document, guarded by modal open state
        document.addEventListener("keydown", HandleSeedKeydown);

        overlay.focus();
    }

    function CloseSeedEditorModal() {
        const overlay = document.getElementById("seed-editor-overlay");
        overlay.style.display = "none";
        document.removeEventListener("keydown", HandleSeedKeydown);
        _SeedEditor = null;
    }

    function HandleSeedKeydown(pEvent) {
        if (pEvent.key === "Escape") {
            pEvent.preventDefault();
            CloseSeedEditorModal();
        }
        else if (pEvent.key === "Enter" && (pEvent.ctrlKey || pEvent.metaKey)) {
            pEvent.preventDefault();
            SaveSeedEditorData();
        }
        else if (pEvent.key === "Delete" && !IsEditableTarget(pEvent.target)) {
            DeleteSelectedSeedRows();
        }
    }

    function IsEditableTarget(pTarget) {
        return pTarget && (pTarget.tagName === "INPUT" || pTarget.tagName === "SELECT" || pTarget.tagName === "TEXTAREA");
    }

    // ── Grid rendering ───────────────────────────────────────────────────

    function BuildSeedGrid() {
        if (!_SeedEditor)
            return;

        const columns = _SeedEditor.Columns;
        const rows = _SeedEditor.Rows;

        // Build header
        const thead = document.getElementById("seed-grid-head");
        thead.innerHTML = "";
        const headerRow = document.createElement("tr");

        // Select-all column
        const thSelect = document.createElement("th");
        thSelect.className = "col-select";
        const selectAllChk = document.createElement("input");
        selectAllChk.type = "checkbox";
        selectAllChk.className = "seed-row-checkbox";
        selectAllChk.title = "Select all";
        selectAllChk.addEventListener("change", function () {
            if (this.checked) {
                for (let i = 0; i < _SeedEditor.Rows.length; i++)
                    _SeedEditor.SelectedRows.add(i);
            }
            else {
                _SeedEditor.SelectedRows.clear();
            }
            UpdateRowSelectionVisuals();
        });
        thSelect.appendChild(selectAllChk);
        headerRow.appendChild(thSelect);

        for (const col of columns) {
            const th = document.createElement("th");
            const inner = document.createElement("div");
            inner.className = "th-inner";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = col.Name;
            inner.appendChild(nameSpan);

            if (col.IsPrimaryKey) {
                const badge = document.createElement("span");
                badge.className = "seed-col-badge seed-col-pk";
                badge.textContent = "PK";
                inner.appendChild(badge);
            }
            else if (col.IsForeignKey) {
                const badge = document.createElement("span");
                badge.className = "seed-col-badge seed-col-fk";
                badge.textContent = "FK";
                inner.appendChild(badge);
            }

            if (col.IsRequired && !col.IsPrimaryKey) {
                const req = document.createElement("span");
                req.className = "seed-col-req";
                req.textContent = "*";
                req.title = "Required";
                inner.appendChild(req);
            }

            // DataType hint
            const typeSpan = document.createElement("span");
            typeSpan.style.cssText = "font-size:9px;opacity:0.5;font-weight:400;text-transform:none;";
            typeSpan.textContent = " " + GetShortTypeName(col.DataType);
            inner.appendChild(typeSpan);

            th.appendChild(inner);
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);

        // Build body
        const tbody = document.getElementById("seed-grid-body");
        tbody.innerHTML = "";

        if (rows.length === 0) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = columns.length + 1;
            td.innerHTML = "<div class='seed-empty-state'><span class='seed-empty-icon'>🗂️</span>No rows yet. Click <b>Add Row</b> to begin.</div>";
            tr.appendChild(td);
            tbody.appendChild(tr);
        }
        else {
            for (let i = 0; i < rows.length; i++)
                tbody.appendChild(BuildSeedGridRow(rows[i], columns, i));
        }
    }

    function BuildSeedGridRow(pRow, pColumns, pRowIndex) {
        const tr = document.createElement("tr");
        tr.setAttribute("data-row-index", pRowIndex);
        if (pRow.IsNew)
            tr.classList.add("seed-row-new");
        if (_SeedEditor.SelectedRows.has(pRowIndex))
            tr.classList.add("seed-row-selected");

        // Selection checkbox
        const tdSelect = document.createElement("td");
        tdSelect.className = "col-select";
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "seed-row-checkbox";
        chk.checked = _SeedEditor.SelectedRows.has(pRowIndex);
        chk.addEventListener("change", function () {
            if (this.checked)
                _SeedEditor.SelectedRows.add(pRowIndex);
            else
                _SeedEditor.SelectedRows.delete(pRowIndex);
            tr.classList.toggle("seed-row-selected", this.checked);
            SyncSelectAllCheckbox();
        });
        tdSelect.appendChild(chk);
        tr.appendChild(tdSelect);

        // Data cells
        for (const col of pColumns) {
            const td = document.createElement("td");
            const currentValue = pRow.Values[col.FieldID] !== undefined ? pRow.Values[col.FieldID] : "";

            const widget = BuildCellWidget(col, currentValue, pRow, pColumns);
            td.appendChild(widget);
            tr.appendChild(td);
        }

        // Row click for selection (not on input/select)
        tr.addEventListener("click", function (e) {
            if (IsEditableTarget(e.target) || e.target.type === "checkbox")
                return;
            const isSelected = _SeedEditor.SelectedRows.has(pRowIndex);
            if (e.ctrlKey || e.metaKey) {
                if (isSelected)
                    _SeedEditor.SelectedRows.delete(pRowIndex);
                else
                    _SeedEditor.SelectedRows.add(pRowIndex);
            }
            else {
                _SeedEditor.SelectedRows.clear();
                _SeedEditor.SelectedRows.add(pRowIndex);
            }
            UpdateRowSelectionVisuals();
        });

        return tr;
    }

    function BuildCellWidget(pCol, pCurrentValue, pRow, pAllColumns) {
        // Boolean type → checkbox
        if (pCol.DataType === "Boolean") {
            const chk = document.createElement("input");
            chk.type = "checkbox";
            chk.className = "seed-cell-checkbox";
            chk.checked = pCurrentValue === "true" || pCurrentValue === "1";
            chk.addEventListener("change", function () {
                pRow.Values[pCol.FieldID] = this.checked ? "true" : "false";
                ClearCellError(this.parentElement);
            });
            return chk;
        }

        // FK field with options → select
        if (pCol.IsForeignKey && pCol.FKOptions && pCol.FKOptions.length > 0) {
            const sel = document.createElement("select");
            sel.className = "seed-cell-select";
            sel.title = pCol.FKTableName ? "References: " + pCol.FKTableName : "";

            // Blank option for non-required
            if (!pCol.IsRequired) {
                const blankOpt = document.createElement("option");
                blankOpt.value = "";
                blankOpt.textContent = "— none —";
                sel.appendChild(blankOpt);
            }

            for (const opt of pCol.FKOptions) {
                const option = document.createElement("option");
                option.value = opt.Value;
                option.textContent = opt.Label || opt.Value;
                if (opt.Value === pCurrentValue)
                    option.selected = true;
                sel.appendChild(option);
            }

            // If current value not in options, add it (data from C#)
            if (pCurrentValue && !pCol.FKOptions.some(function (o) { return o.Value === pCurrentValue; })) {
                const orphan = document.createElement("option");
                orphan.value = pCurrentValue;
                orphan.textContent = pCurrentValue + " ⚠";
                orphan.selected = true;
                sel.appendChild(orphan);
            }

            sel.addEventListener("change", function () {
                pRow.Values[pCol.FieldID] = this.value;
                ClearCellError(this.parentElement);
            });

            return sel;
        }

        // Date/DateTime → date input
        if (pCol.DataType === "Date" || pCol.DataType === "DateTime") {
            const inp = document.createElement("input");
            inp.type = pCol.DataType === "Date" ? "date" : "datetime-local";
            inp.className = "seed-cell-input";
            inp.value = FormatDateForInput(pCurrentValue, pCol.DataType);

            inp.addEventListener("input", function () {
                pRow.Values[pCol.FieldID] = this.value;
                ClearCellError(this.parentElement);
            });
            inp.addEventListener("change", function () {
                pRow.Values[pCol.FieldID] = this.value;
            });

            return inp;
        }

        // Number types → numeric input
        if (IsNumericType(pCol.DataType)) {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.inputMode = "numeric";
            inp.className = "seed-cell-input" + (pCol.IsPrimaryKey ? " seed-cell-pk" : "");
            inp.value = pCurrentValue;
            inp.placeholder = pCol.DataType === "Guid" ? "GUID" : "0";
            if (pCol.IsPrimaryKey && pCurrentValue === "")
                inp.value = SuggestNextPKValue(pAllColumns, pCol);

            inp.addEventListener("input", function () {
                pRow.Values[pCol.FieldID] = this.value;
                ClearCellError(this.parentElement);
            });
            inp.addEventListener("blur", function () {
                const err = ValidateCellValue(pCol, this.value);
                if (err)
                    ShowCellError(this.parentElement, err);
            });

            return inp;
        }

        // Guid type → text with pattern
        if (pCol.DataType === "Guid") {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.className = "seed-cell-input" + (pCol.IsPrimaryKey ? " seed-cell-pk" : "");
            inp.value = pCurrentValue;
            inp.placeholder = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
            inp.maxLength = 36;

            inp.addEventListener("input", function () {
                pRow.Values[pCol.FieldID] = this.value;
                ClearCellError(this.parentElement);
            });
            inp.addEventListener("blur", function () {
                const err = ValidateCellValue(pCol, this.value);
                if (err)
                    ShowCellError(this.parentElement, err);
            });

            return inp;
        }
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "seed-cell-input" + (pCol.IsPrimaryKey ? " seed-cell-pk" : "");
        inp.value = pCurrentValue;

        if (pCol.DataType === "Text")
            inp.title = "Text (unlimited length)";
        else if (pCol.Length && pCol.Length > 0) {
            inp.maxLength = pCol.Length;
            inp.title = "Max length: " + pCol.Length;
        }

        inp.addEventListener("input", function () {
            pRow.Values[pCol.FieldID] = this.value;
            ClearCellError(this.parentElement);
        });
        inp.addEventListener("blur", function () {
            const err = ValidateCellValue(pCol, this.value);
            if (err)
                ShowCellError(this.parentElement, err);
        });

        return inp;
    }

    function SuggestNextPKValue(pAllColumns, pPKColumn) {
        if (!_SeedEditor)
            return "";

        if (pPKColumn.DataType === "Guid")
            return GenerateSequentialGuid();

        // Find max existing PK value and return max+1
        let max = -1;
        for (const row of _SeedEditor.Rows) {
            const val = row.Values[pPKColumn.FieldID];
            if (val !== undefined && val !== "") {
                const n = parseInt(val, 10);
                if (!isNaN(n) && n > max)
                    max = n;
            }
        }

        return String(max + 1);
    }

    /**
     * Generates a time-ordered UUID (UUID v7 style).
     * The first 48 bits are the current timestamp in ms, making values
     * naturally sortable by creation order while remaining unique.
     */
    function GenerateSequentialGuid() {
        const now = Date.now();
        _GuidSeq = (_GuidSeq + 1) & 0xFFF;

        // p1 + p2: 48-bit ms timestamp (sortable prefix)
        const tsHex = now.toString(16).padStart(12, "0");
        const p1 = tsHex.substring(0, 8);
        const p2 = tsHex.substring(8, 12);

        // p3: version nibble (7) + 12-bit sequence counter
        const p3 = "7" + _GuidSeq.toString(16).padStart(3, "0");

        // p4: variant bits (10xx) + 14 random bits
        const varNibble = (0x8 | (Math.random() * 4 | 0)).toString(16);
        const randA = (Math.random() * 0xFFF | 0).toString(16).padStart(3, "0");
        const p4 = varNibble + randA;

        // p5: 48 random bits
        const p5 = (Math.random() * 0xFFFFFFFF | 0).toString(16).padStart(8, "0") +
            (Math.random() * 0xFFFF | 0).toString(16).padStart(4, "0");

        return p1 + "-" + p2 + "-" + p3 + "-" + p4 + "-" + p5;
    }

    // ── Row operations ────────────────────────────────────────────────────

    function AddSeedRow() {
        if (!_SeedEditor)
            return;

        const newRow = { TupleID: "NEW_" + (_SeedNextNewId++), Values: {}, IsNew: true };

        // Pre-populate defaults
        for (const col of _SeedEditor.Columns) {
            if (col.DataType === "Boolean")
                newRow.Values[col.FieldID] = "false";
            else if (col.IsPrimaryKey)
                newRow.Values[col.FieldID] = SuggestNextPKValue(_SeedEditor.Columns, col);
            else if (col.IsForeignKey && col.FKOptions && col.FKOptions.length > 0 && col.IsRequired)
                newRow.Values[col.FieldID] = col.FKOptions[0].Value;
            else
                newRow.Values[col.FieldID] = "";
        }

        _SeedEditor.Rows.push(newRow);
        _SeedEditor.SelectedRows.clear();

        // Re-render the grid
        BuildSeedGrid();
        UpdateSeedRowCount();
        SetSeedValidationBadge(null);

        // Focus first editable cell of the new row
        const tbody = document.getElementById("seed-grid-body");
        const newTR = tbody.lastElementChild;
        if (newTR) {
            const firstInput = newTR.querySelector("input:not([type=checkbox]), select");
            if (firstInput) {
                firstInput.focus();
                if (firstInput.type === "text")
                    firstInput.select();
                newTR.scrollIntoView({ block: "nearest" });
            }
        }
    }

    function DeleteSelectedSeedRows() {
        if (!_SeedEditor || _SeedEditor.SelectedRows.size === 0)
            return;

        const indices = Array.from(_SeedEditor.SelectedRows).sort(function (a, b) { return b - a; });
        for (const idx of indices)
            _SeedEditor.Rows.splice(idx, 1);

        _SeedEditor.SelectedRows.clear();
        BuildSeedGrid();
        UpdateSeedRowCount();
        SetSeedValidationBadge(null);
        SetSeedStatusMessage(indices.length + " row(s) deleted.", "");
    }

    // ── Selection visuals ─────────────────────────────────────────────────

    function UpdateRowSelectionVisuals() {
        if (!_SeedEditor)
            return;

        const tbody = document.getElementById("seed-grid-body");
        const rows = tbody.querySelectorAll("tr[data-row-index]");

        rows.forEach(function (tr) {
            const idx = parseInt(tr.getAttribute("data-row-index"), 10);
            const selected = _SeedEditor.SelectedRows.has(idx);
            tr.classList.toggle("seed-row-selected", selected);
            const chk = tr.querySelector(".seed-row-checkbox");
            if (chk)
                chk.checked = selected;
        });

        SyncSelectAllCheckbox();
    }

    function SyncSelectAllCheckbox() {
        if (!_SeedEditor)
            return;
        const selectAll = document.querySelector("#seed-grid-head .seed-row-checkbox");
        if (!selectAll)
            return;
        const total = _SeedEditor.Rows.length;
        const selectedCount = _SeedEditor.SelectedRows.size;
        selectAll.checked = total > 0 && selectedCount === total;
        selectAll.indeterminate = selectedCount > 0 && selectedCount < total;
    }

    function UpdateSeedRowCount() {
        if (!_SeedEditor)
            return;
        const badge = document.getElementById("seed-row-count");
        const n = _SeedEditor.Rows.length;
        badge.textContent = n + (n === 1 ? " row" : " rows");
    }

    // ── Validation ────────────────────────────────────────────────────────

    const NumericTypes = ["Int8", "Int16", "Int32", "Int64", "Decimal", "Float", "Double", "Numeric", "Byte"];

    function IsNumericType(pDataType) {
        return NumericTypes.indexOf(pDataType) >= 0;
    }

    function GetShortTypeName(pDataType) {
        const map = {
            "String": "str", "Text": "txt", "Int8": "i8", "Int16": "i16",
            "Int32": "i32", "Int64": "i64", "Decimal": "dec", "Numeric": "num",
            "Float": "f32", "Double": "f64", "Boolean": "bool",
            "Date": "date", "DateTime": "dt", "Guid": "guid", "Binary": "bin", "Byte": "byte"
        };
        return map[pDataType] || pDataType.toLowerCase().substring(0, 4);
    }

    function FormatDateForInput(pValue, pDataType) {
        if (!pValue)
            return "";
        // Try to parse and reformat for date/datetime-local inputs
        try {
            const d = new Date(pValue);
            if (isNaN(d.getTime()))
                return pValue;
            if (pDataType === "Date")
                return d.toISOString().substring(0, 10);
            // datetime-local: YYYY-MM-DDTHH:MM
            return d.toISOString().substring(0, 16);
        }
        catch {
            return pValue;
        }
    }

    function ValidateCellValue(pCol, pValue) {
        if (!pValue && pValue !== "0" && pValue !== "false") {
            if (pCol.IsRequired || pCol.IsPrimaryKey)
                return pCol.Name + " is required.";
            return null;
        }

        if (IsNumericType(pCol.DataType)) {
            const n = Number(pValue);
            if (isNaN(n))
                return pCol.Name + ": expected a number.";
            if ((pCol.DataType === "Int8" || pCol.DataType === "Int16" ||
                pCol.DataType === "Int32" || pCol.DataType === "Int64") && !Number.isInteger(n))
                return pCol.Name + ": expected an integer.";
        }

        if (pCol.DataType === "Guid") {
            const guidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            if (!guidRe.test(pValue))
                return pCol.Name + ": invalid GUID format.";
        }

        if (pCol.IsForeignKey && pCol.FKOptions && pCol.FKOptions.length > 0) {
            const valid = pCol.FKOptions.some(function (o) { return o.Value === pValue; });
            if (!valid)
                return pCol.Name + ": value not found in " + (pCol.FKTableName || "referenced table") + ".";
        }

        if (pCol.Length && pCol.Length > 0 && pValue.length > pCol.Length)
            return pCol.Name + ": max length is " + pCol.Length + " (current: " + pValue.length + ").";

        return null;
    }

    function ValidateAllSeedRows() {
        if (!_SeedEditor)
            return [];

        const errors = [];
        const pkColumn = _SeedEditor.Columns.find(function (c) { return c.IsPrimaryKey; });
        const pkValues = new Set();

        for (let i = 0; i < _SeedEditor.Rows.length; i++) {
            const row = _SeedEditor.Rows[i];

            for (const col of _SeedEditor.Columns) {
                const value = row.Values[col.FieldID] !== undefined ? row.Values[col.FieldID] : "";
                const err = ValidateCellValue(col, value);
                if (err)
                    errors.push({ Row: i, FieldID: col.FieldID, Message: err });
            }

            // PK uniqueness
            if (pkColumn) {
                const pkVal = row.Values[pkColumn.FieldID];
                if (pkVal !== undefined && pkVal !== "") {
                    if (pkValues.has(pkVal))
                        errors.push({ Row: i, FieldID: pkColumn.FieldID, Message: "Duplicate PK value: " + pkVal });
                    else
                        pkValues.add(pkVal);
                }
            }
        }

        return errors;
    }

    function ShowCellError(pTD, pMessage) {
        if (!pTD)
            return;
        const widget = pTD.querySelector("input, select");
        if (widget)
            widget.classList.add("cell-error");

        let errSpan = pTD.querySelector(".seed-cell-error-msg");
        if (!errSpan) {
            errSpan = document.createElement("span");
            errSpan.className = "seed-cell-error-msg";
            pTD.appendChild(errSpan);
        }
        errSpan.textContent = pMessage;
        pTD.closest("tr").classList.add("seed-row-error");
    }

    function ClearCellError(pTD) {
        if (!pTD)
            return;
        const widget = pTD.querySelector("input, select");
        if (widget)
            widget.classList.remove("cell-error");
        const errSpan = pTD.querySelector(".seed-cell-error-msg");
        if (errSpan)
            errSpan.remove();

        // Only remove row-error class if no other errors remain
        const tr = pTD.closest("tr");
        if (tr && tr.querySelectorAll(".seed-cell-error-msg").length === 0)
            tr.classList.remove("seed-row-error");
    }

    function HighlightValidationErrors(pErrors) {
        if (!_SeedEditor)
            return;

        // Clear existing errors first
        const tbody = document.getElementById("seed-grid-body");
        tbody.querySelectorAll(".cell-error").forEach(function (el) { el.classList.remove("cell-error"); });
        tbody.querySelectorAll(".seed-cell-error-msg").forEach(function (el) { el.remove(); });
        tbody.querySelectorAll(".seed-row-error").forEach(function (tr) { tr.classList.remove("seed-row-error"); });

        const columns = _SeedEditor.Columns;

        for (const err of pErrors) {
            const tr = tbody.querySelector("tr[data-row-index='" + err.Row + "']");
            if (!tr)
                continue;

            // Column index: +1 because of select column
            const colIdx = columns.findIndex(function (c) { return c.FieldID === err.FieldID; });
            if (colIdx < 0)
                continue;

            const td = tr.querySelectorAll("td")[colIdx + 1];
            if (td)
                ShowCellError(td, err.Message);

            tr.scrollIntoView({ block: "nearest" });
        }
    }

    function SetSeedValidationBadge(pErrors) {
        const badge = document.getElementById("seed-validation-badge");
        if (!pErrors || pErrors.length === 0) {
            badge.style.display = "none";
            badge.textContent = "";
        }
        else {
            badge.style.display = "flex";
            badge.textContent = "⚠ " + pErrors.length + " validation error" + (pErrors.length > 1 ? "s" : "");
        }
    }

    // ── Save / Collect ────────────────────────────────────────────────────

    function CollectSeedData() {
        if (!_SeedEditor)
            return [];

        return _SeedEditor.Rows.map(function (row) {
            return {
                TupleID: row.TupleID.startsWith("NEW_") ? "NEW" : row.TupleID,
                Values: Object.assign({}, row.Values)
            };
        });
    }

    function SaveSeedEditorData() {
        if (!_SeedEditor)
            return;

        // Flush any focused input values
        const focused = document.activeElement;
        if (focused && IsEditableTarget(focused))
            focused.blur();

        // Validate
        const errors = ValidateAllSeedRows();
        if (errors.length > 0) {
            HighlightValidationErrors(errors);
            SetSeedValidationBadge(errors);
            SetSeedStatusMessage("Please fix validation errors before saving.", "err");
            return;
        }

        SetSeedValidationBadge(null);
        document.getElementById("seed-btn-save").disabled = true;
        SetSeedStatusMessage("Saving...", "");

        const rows = CollectSeedData();

        SendMessage(XMessageType.SaveSeedData, {
            TableID: _SeedEditor.TableID,
            Rows: rows
        });
    }

    function OnSeedDataSaved(pPayload) {
        if (!_SeedEditor)
            return;

        const btnSave = document.getElementById("seed-btn-save");
        if (!btnSave)
            return;

        if (pPayload && pPayload.Success) {
            SetSeedStatusMessage("✓ Saved successfully.", "ok");
            btnSave.disabled = false;
            // Update internal row IDs so any "NEW" rows get proper IDs on next refresh
            // Close after brief confirmation
            setTimeout(CloseSeedEditorModal, 900);
        }
        else {
            const msg = (pPayload && pPayload.Message) ? pPayload.Message : "Failed to save.";
            SetSeedStatusMessage("✕ " + msg, "err");
            btnSave.disabled = false;
        }
    }

    // ── Status helpers ────────────────────────────────────────────────────

    function SetSeedStatusMessage(pMsg, pType) {
        const el = document.getElementById("seed-status-msg");
        if (!el)
            return;
        el.textContent = pMsg;
        el.className = "seed-status-msg" + (pType ? " status-" + pType : "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  AI ORGANIZER OVERLAY
    // ═══════════════════════════════════════════════════════════════════════════

    const _AI_STEP_LABELS = {
        context:   "Building model context",
        sending:   "Sending to AI model",
        analyzing: "AI analyzing table relationships",
        grouping:  "Grouping tables by domain",
        parsing:   "Parsing AI response",
        layout:    "Computing layout",
        applying:  "Applying positions & colors",
        done:      "Complete"
    };

    let _AICompletedSteps = [];
    let _AISelectedModelIndex = 0;
    let _AIPickerModels = [];

    // ── Picker Phase ─────────────────────────────────────────────────────────

    function _AISetSelectorLabel(pIndex) {
        const m = _AIPickerModels[pIndex];
        if (!m) return;
        document.getElementById("ai-model-selector-name").textContent = m.name;
        const costEl = document.getElementById("ai-model-selector-cost");
        costEl.textContent = m.costLabel || "";
        costEl.style.display = m.costLabel ? "" : "none";
    }

    function _AIBuildDropdown() {
        const dropdown = document.getElementById("ai-model-dropdown");
        dropdown.innerHTML = "";
        for (let i = 0; i < _AIPickerModels.length; i++) {
            const m = _AIPickerModels[i];
            const row = document.createElement("div");
            row.className = "ai-model-row" + (i === _AISelectedModelIndex ? " ai-model-row--selected" : "");
            row.setAttribute("data-index", String(i));
            const costLabel = m.costLabel || "";
            row.innerHTML =
                '<span class="ai-model-check">\u2713</span>' +
                '<span class="ai-model-name">' + EscapeHtml(m.name) + '</span>' +
                (costLabel ? '<span class="ai-model-cost">' + EscapeHtml(costLabel) + '</span>' : "");
            row.addEventListener("click", function (e) {
                e.stopPropagation();
                const rows = dropdown.querySelectorAll(".ai-model-row");
                rows.forEach(function (r) { r.classList.remove("ai-model-row--selected"); });
                row.classList.add("ai-model-row--selected");
                _AISelectedModelIndex = parseInt(row.getAttribute("data-index"), 10);
                _AISetSelectorLabel(_AISelectedModelIndex);
                dropdown.style.display = "none";
            });
            dropdown.appendChild(row);
        }
        // Scroll to selected
        const sel = dropdown.querySelector(".ai-model-row--selected");
        if (sel) setTimeout(function () { sel.scrollIntoView({ block: "nearest" }); }, 0);
    }

    function OpenAIPickerOverlay(pPayload) {
        const overlay = document.getElementById("ai-organize-overlay");
        if (!overlay) return;

        _AIPickerModels = (pPayload && pPayload.models) ? pPayload.models : [];
        _AICompletedSteps = [];

        // Reset all sections
        document.getElementById("ai-picker-section").style.display = "block";
        document.getElementById("ai-progress-section").style.display = "none";
        document.getElementById("ai-steps-list").style.display = "none";
        document.getElementById("ai-result-section").style.display = "none";
        document.getElementById("ai-model-dropdown").style.display = "none";

        document.getElementById("ai-modal-icon").textContent = "\u2728";
        document.getElementById("ai-modal-title").textContent = "Organize Tables with AI";
        document.getElementById("ai-model-badge").textContent =
            pPayload && pPayload.tableCount ? pPayload.tableCount + " tables" : "";

        const statusDot = document.getElementById("ai-status-dot");
        statusDot.className = "ai-status-dot ai-status-dot--idle";

        // Pre-select last used model
        const lastModelName = _AIGetLastModelName();
        _AISelectedModelIndex = 0;
        for (let i = 0; i < _AIPickerModels.length; i++) {
            if (lastModelName && _AIPickerModels[i].name === lastModelName) {
                _AISelectedModelIndex = i;
                break;
            }
        }
        _AISetSelectorLabel(_AISelectedModelIndex);

        // Prompt preview
        const promptEl = document.getElementById("ai-prompt-preview");
        if (promptEl) promptEl.value = (pPayload && pPayload.promptPreview) ? pPayload.promptPreview : "";

        // Wire model selector button
        const selectorBtn = document.getElementById("ai-model-selector-btn");
        selectorBtn.onclick = function (e) {
            e.stopPropagation();
            const dropdown = document.getElementById("ai-model-dropdown");
            if (dropdown.style.display === "none") {
                const rect = selectorBtn.getBoundingClientRect();
                dropdown.style.top = (rect.bottom + 4) + "px";
                dropdown.style.left = rect.left + "px";
                dropdown.style.width = rect.width + "px";
                _AIBuildDropdown();
                dropdown.style.display = "block";
            } else {
                dropdown.style.display = "none";
            }
        };

        // Close dropdown on outside click
        document.addEventListener("click", function _closeDropdown() {
            const dropdown = document.getElementById("ai-model-dropdown");
            if (dropdown) dropdown.style.display = "none";
            document.removeEventListener("click", _closeDropdown);
        });

        // Footer: Cancel + Execute
        const footer = document.getElementById("ai-modal-footer");
        footer.innerHTML =
            '<button id="ai-cancel-btn" class="seed-btn seed-btn-secondary">Cancel</button>' +
            '<button id="ai-execute-btn" class="seed-btn seed-btn-primary">Execute</button>';

        document.getElementById("ai-cancel-btn").onclick = CloseAIOrganizeOverlay;
        document.getElementById("ai-execute-btn").onclick = function () {
            SendMessage(XMessageType.OrganizeTablesAIExecute, { ModelIndex: _AISelectedModelIndex });
        };

        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden", "false");
    }

    // ── Running Phase ─────────────────────────────────────────────────────────

    function OpenAIOrganizeOverlay(pPayload) {
        const overlay = document.getElementById("ai-organize-overlay");
        if (!overlay) return;

        _AICompletedSteps = [];

        // Switch to progress phase
        document.getElementById("ai-picker-section").style.display = "none";
        document.getElementById("ai-progress-section").style.display = "block";
        document.getElementById("ai-steps-list").style.display = "block";
        document.getElementById("ai-steps-list").innerHTML = "";
        document.getElementById("ai-result-section").style.display = "none";

        document.getElementById("ai-progress-fill").style.width = "0%";
        document.getElementById("ai-progress-fill").className = "ai-progress-bar-fill";
        document.getElementById("ai-progress-label").textContent = "Initializing\u2026";
        document.getElementById("ai-modal-icon").textContent = "\u2728";

        const statusDot = document.getElementById("ai-status-dot");
        statusDot.className = "ai-status-dot ai-status-dot--running";

        const badge = document.getElementById("ai-model-badge");
        if (pPayload && pPayload.model) {
            const vendor = pPayload.vendor ? " \u00B7 " + pPayload.vendor : "";
            badge.textContent = pPayload.model + vendor;
        } else {
            badge.textContent = "";
        }

        const title = document.getElementById("ai-modal-title");
        const tableCount = pPayload && pPayload.tableCount ? pPayload.tableCount : 0;
        title.textContent = "Organizing " + (tableCount > 0 ? tableCount + " tables" : "Tables") + " with AI";

        // Footer: empty during run (no buttons while AI works)
        const footer = document.getElementById("ai-modal-footer");
        footer.innerHTML = "";

        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden", "false");
    }

    function UpdateAIOrganizeProgress(pPayload) {
        if (!pPayload) return;

        const fill = document.getElementById("ai-progress-fill");
        const label = document.getElementById("ai-progress-label");
        const stepsList = document.getElementById("ai-steps-list");

        if (fill && typeof pPayload.percent === "number")
            fill.style.width = Math.min(100, pPayload.percent) + "%";

        if (label && pPayload.message)
            label.textContent = pPayload.message;

        const stepKey = pPayload.step;
        if (stepKey && stepKey !== "done" && !_AICompletedSteps.includes(stepKey)) {
            _AICompletedSteps.push(stepKey);
            const stepLabel = _AI_STEP_LABELS[stepKey] || stepKey;
            const item = document.createElement("div");
            item.className = "ai-step-item ai-step-item--running";
            item.setAttribute("data-step", stepKey);
            item.innerHTML =
                '<span class="ai-step-spinner"></span>' +
                '<span class="ai-step-text">' + EscapeHtml(stepLabel) + '</span>';
            stepsList.appendChild(item);

            const prev = stepsList.querySelectorAll(".ai-step-item--running");
            for (let i = 0; i < prev.length - 1; i++) {
                prev[i].className = "ai-step-item ai-step-item--done";
                prev[i].innerHTML =
                    '<span class="ai-step-check">\u2713</span>' +
                    '<span class="ai-step-text">' + prev[i].querySelector(".ai-step-text").textContent + '</span>';
            }

            stepsList.scrollTop = stepsList.scrollHeight;
        }
    }

    // ── Complete Phase ────────────────────────────────────────────────────────

    function CompleteAIOrganize(pPayload) {
        const fill = document.getElementById("ai-progress-fill");
        const label = document.getElementById("ai-progress-label");
        const stepsList = document.getElementById("ai-steps-list");
        const resultSection = document.getElementById("ai-result-section");
        const footer = document.getElementById("ai-modal-footer");
        const icon = document.getElementById("ai-modal-icon");
        const statusDot = document.getElementById("ai-status-dot");

        if (fill) fill.style.width = "100%";
        if (fill) fill.classList.add("ai-progress-bar-fill--done");
        if (label) label.textContent = pPayload && pPayload.tablesOrganized
            ? pPayload.tablesOrganized + " tables organized into " + pPayload.groupCount + " groups"
            : "Done!";

        if (icon) icon.textContent = "\u2705";
        if (statusDot) statusDot.className = "ai-status-dot ai-status-dot--done";

        // Save the last used model name to localStorage
        if (_AIPickerModels.length > 0 && _AISelectedModelIndex < _AIPickerModels.length)
            _AISaveLastModelName(_AIPickerModels[_AISelectedModelIndex].name);

        if (stepsList) {
            const pending = stepsList.querySelectorAll(".ai-step-item--running");
            pending.forEach(function (item) {
                item.className = "ai-step-item ai-step-item--done";
                const txt = item.querySelector(".ai-step-text");
                const textContent = txt ? txt.textContent : "";
                item.innerHTML =
                    '<span class="ai-step-check">\u2713</span>' +
                    '<span class="ai-step-text">' + EscapeHtml(textContent) + '</span>';
            });
        }

        if (resultSection && pPayload && pPayload.groups && pPayload.groups.length > 0) {
            const chips = document.getElementById("ai-group-chips");
            chips.innerHTML = "";
            for (const group of pPayload.groups) {
                const chip = document.createElement("div");
                chip.className = "ai-group-chip";
                chip.style.setProperty("--chip-color", group.color || "#888888");
                chip.innerHTML =
                    '<span class="ai-chip-swatch"></span>' +
                    '<span class="ai-chip-label">' + EscapeHtml(group.name) + '</span>' +
                    '<span class="ai-chip-count">' + (group.count || 0) + '</span>';
                chips.appendChild(chip);
            }
            resultSection.style.display = "block";
        }

        // Footer: Revert (if canRevert) + Close
        if (footer) {
            footer.innerHTML = "";
            if (pPayload && pPayload.canRevert) {
                const revertBtn = document.createElement("button");
                revertBtn.id = "ai-revert-btn";
                revertBtn.className = "seed-btn seed-btn-secondary";
                revertBtn.textContent = "Revert";
                revertBtn.onclick = function () {
                    SendMessage(XMessageType.AIOrganizeRevert, {});
                    CloseAIOrganizeOverlay();
                };
                footer.appendChild(revertBtn);
            }
            const closeBtn = document.createElement("button");
            closeBtn.id = "ai-close-btn";
            closeBtn.className = "seed-btn seed-btn-primary";
            closeBtn.textContent = "Close";
            closeBtn.onclick = CloseAIOrganizeOverlay;
            footer.appendChild(closeBtn);
            closeBtn.focus();
        }
    }

    function ErrorAIOrganize(pPayload) {
        const fill = document.getElementById("ai-progress-fill");
        const label = document.getElementById("ai-progress-label");
        const icon = document.getElementById("ai-modal-icon");
        const statusDot = document.getElementById("ai-status-dot");
        const footer = document.getElementById("ai-modal-footer");
        const stepsList = document.getElementById("ai-steps-list");

        if (fill) { fill.style.width = "100%"; fill.classList.add("ai-progress-bar-fill--error"); }
        if (label) label.textContent = (pPayload && pPayload.message) ? pPayload.message : "An error occurred.";
        if (icon) icon.textContent = "\u274C";
        if (statusDot) statusDot.className = "ai-status-dot ai-status-dot--error";

        if (stepsList) {
            const pending = stepsList.querySelectorAll(".ai-step-item--running");
            pending.forEach(function (item) {
                item.className = "ai-step-item ai-step-item--error";
                const txt = item.querySelector(".ai-step-text");
                const textContent = txt ? txt.textContent : "";
                item.innerHTML =
                    '<span class="ai-step-err">\u2715</span>' +
                    '<span class="ai-step-text">' + EscapeHtml(textContent) + '</span>';
            });
        }

        if (footer) {
            footer.innerHTML =
                '<button id="ai-close-btn" class="seed-btn seed-btn-primary">Close</button>';
            document.getElementById("ai-close-btn").onclick = CloseAIOrganizeOverlay;
        }
    }

    function CloseAIOrganizeOverlay() {
        const overlay = document.getElementById("ai-organize-overlay");
        if (overlay) {
            overlay.style.display = "none";
            overlay.setAttribute("aria-hidden", "true");
        }
        _AICompletedSteps = [];
    }

    // ── Persistence helpers ───────────────────────────────────────────────────

    function _AIGetLastModelName() {
        try { return localStorage.getItem("dase.ai.lastModel") || ""; }
        catch { return ""; }
    }

    function _AISaveLastModelName(pName) {
        try { localStorage.setItem("dase.ai.lastModel", pName || ""); }
        catch { /* storage unavailable */ }
    }

    function EscapeHtml(pStr) {
        if (!pStr) return "";
        return String(pStr)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    // ── ORM Code Generation overlay ────────────────────────────────────────────

    const _ORM_TARGETS = [
        { id: "efcore",     language: "C#",      orm: "EF Core",       ext: ".cs",     icon: "⚙️",  contextLabel: "DbContext file (.cs)" },
        { id: "prisma",     language: "JS / TS", orm: "Prisma",        ext: ".prisma", icon: "🔺",  contextLabel: "Prisma schema (.prisma)" },
        { id: "sqlalchemy", language: "Python",  orm: "SQLAlchemy",    ext: ".py",    icon: "🐍",  contextLabel: "Models file (.py)" },
        { id: "hibernate",  language: "Java",    orm: "Hibernate / JPA", ext: ".java", icon: "☕", contextLabel: "Entity or persistence file (.java, .xml)" },
        { id: "gorm",       language: "Go",      orm: "GORM",          ext: ".go",    icon: "🐹",  contextLabel: "Go model file (.go)" }
    ];

    let _ORMGenPickerModels  = [];
    let _ORMGenSelectedModel = 0;
    let _ORMGenSelectedORM   = "efcore";
    let _ORMGenContextContent = "";

    function _ORMGenGetLastModel() {
        try { return localStorage.getItem("dase.ormgen.lastModel") || ""; }
        catch { return ""; }
    }
    function _ORMGenSaveLastModel(pName) {
        try { localStorage.setItem("dase.ormgen.lastModel", pName || ""); }
        catch { /* storage unavailable */ }
    }
    function _ORMGenGetLastORM() {
        try { return localStorage.getItem("dase.ormgen.lastORM") || "efcore"; }
        catch { return "efcore"; }
    }
    function _ORMGenSaveLastORM(pId) {
        try { localStorage.setItem("dase.ormgen.lastORM", pId || "efcore"); }
        catch { /* storage unavailable */ }
    }

    function _ORMGenSetModelLabel(pIndex) {
        const nameEl = document.getElementById("orm-gen-model-selector-name");
        const costEl = document.getElementById("orm-gen-model-selector-cost");
        const m = _ORMGenPickerModels[pIndex];
        if (!m || !nameEl) return;
        nameEl.textContent = m.name;
        if (costEl) costEl.textContent = m.costLabel || "";
        _ORMGenSaveLastModel(m.name);
    }

    function _ORMGenBuildModelDropdown(pPayload) {
        const dd   = document.getElementById("orm-gen-model-dropdown");
        const btn  = document.getElementById("orm-gen-model-selector-btn");
        const models = pPayload.models || [];
        _ORMGenPickerModels = models;
        if (!dd || models.length === 0) return;

        const lastModel = _ORMGenGetLastModel();
        let best = 0;
        for (let i = 0; i < models.length; i++) {
            if (models[i].name === lastModel) { best = i; break; }
        }
        _ORMGenSelectedModel = best;
        _ORMGenSetModelLabel(best);

        let grouped = {};
        for (let i = 0; i < models.length; i++) {
            const v = models[i].vendor || "Other";
            if (!grouped[v]) grouped[v] = [];
            grouped[v].push({ idx: i, m: models[i] });
        }

        let html = "";
        for (const vendor in grouped) {
            html += "<div class=\"ai-model-group-label\">" + EscapeHtml(vendor) + "</div>";
            for (const item of grouped[vendor]) {
                const costLabel = item.m.costLabel || "";
                html += "<div class=\"ai-model-option\" data-idx=\"" + item.idx + "\">" +
                    "<span class=\"ai-model-name\">" + EscapeHtml(item.m.name) + "</span>" +
                    (costLabel ? "<span class=\"ai-model-cost\">" + EscapeHtml(costLabel) + "</span>" : "") +
                    "</div>";
            }
        }
        dd.innerHTML = html;

        dd.querySelectorAll(".ai-model-option").forEach(function (el) {
            el.addEventListener("click", function () {
                _ORMGenSelectedModel = parseInt(el.getAttribute("data-idx"), 10);
                _ORMGenSetModelLabel(_ORMGenSelectedModel);
                dd.style.display = "none";
                _ORMGenUpdatePromptPreview(pPayload);
            });
        });

        btn.onclick = function () {
            dd.style.display = (dd.style.display === "none") ? "block" : "none";
        };
    }

    function _ORMGenSetTargetLabel(pId) {
        const t = _ORM_TARGETS.find(function (x) { return x.id === pId; }) || _ORM_TARGETS[0];
        const nameEl = document.getElementById("orm-gen-target-name");
        if (nameEl) nameEl.textContent = t.icon + " " + t.language + " / " + t.orm;
        const ctxLabel = document.getElementById("orm-gen-context-label");
        if (ctxLabel) ctxLabel.textContent = t.contextLabel;
        _ORMGenSaveLastORM(pId);
    }

    function _ORMGenBuildTargetDropdown(pPayload) {
        const dd  = document.getElementById("orm-gen-target-dropdown");
        const btn = document.getElementById("orm-gen-target-btn");
        if (!dd) return;

        const lastORM = _ORMGenGetLastORM();
        const found   = _ORM_TARGETS.find(function (t) { return t.id === lastORM; });
        _ORMGenSelectedORM = found ? found.id : "efcore";
        _ORMGenSetTargetLabel(_ORMGenSelectedORM);

        let html = "";
        for (const t of _ORM_TARGETS) {
            html += "<div class=\"ai-model-option\" data-ormid=\"" + t.id + "\">" +
                "<span class=\"ai-model-name\">" + EscapeHtml(t.icon + " " + t.language + " / " + t.orm) + "</span>" +
                "<span class=\"ai-model-cost\">" + EscapeHtml(t.ext) + "</span>" +
                "</div>";
        }
        dd.innerHTML = html;

        dd.querySelectorAll(".ai-model-option").forEach(function (el) {
            el.addEventListener("click", function () {
                _ORMGenSelectedORM = el.getAttribute("data-ormid");
                _ORMGenSetTargetLabel(_ORMGenSelectedORM);
                dd.style.display = "none";
                _ORMGenContextContent = "";
                const fileEl = document.getElementById("orm-gen-context-file");
                if (fileEl) fileEl.textContent = "None selected";
                _ORMGenUpdatePromptPreview(pPayload);
            });
        });

        btn.onclick = function () {
            dd.style.display = (dd.style.display === "none") ? "block" : "none";
        };
    }

    function _ORMGenUpdatePromptPreview(pPayload) {
        const el = document.getElementById("orm-gen-prompt-preview");
        if (!el) return;
        const t    = _ORM_TARGETS.find(function (x) { return x.id === _ORMGenSelectedORM; }) || _ORM_TARGETS[0];
        const ormLabel = t.language + " / " + t.orm;
        const tc       = pPayload && pPayload.tableCount ? pPayload.tableCount : 0;
        const rc       = pPayload && pPayload.refCount   ? pPayload.refCount   : 0;
        const hc       = !!_ORMGenContextContent;
        el.value =
            "Target ORM: " + ormLabel + "\n\n" +
            "Model: " + tc + " table" + (tc !== 1 ? "s" : "") + ", " +
            rc + " FK reference" + (rc !== 1 ? "s" : "") + "\n\n" +
            "The AI will receive the full DBML schema and generate:\n" +
            "  • Entity / model classes for every table\n" +
            "  • Primary key and identity configuration\n" +
            "  • Foreign key associations and navigation properties\n" +
            "  • " + ormLabel + "-specific annotations and conventions\n" +
            (hc ? "  • Code adapted to match your existing context file\n\n" : "\n") +
            "Output: single source file saved alongside the .dsorm model.";
    }

    function OpenORMGenPickerOverlay(pPayload) {
        if (!pPayload) return;
        const overlay = document.getElementById("orm-gen-overlay");
        const modal   = document.getElementById("orm-gen-modal");
        if (!overlay || !modal) return;

        _ORMGenContextContent = "";
        const fileEl = document.getElementById("orm-gen-context-file");
        if (fileEl) fileEl.textContent = "None selected";

        overlay.style.display = "flex";
        overlay.removeAttribute("aria-hidden");

        const badge = document.getElementById("orm-gen-model-badge");
        if (badge) badge.textContent = "";
        document.getElementById("orm-gen-status-dot").className = "ai-status-dot ai-status-dot--idle";
        document.getElementById("orm-gen-picker-section").style.display  = "block";
        document.getElementById("orm-gen-progress-section").style.display = "none";
        document.getElementById("orm-gen-steps-list").style.display       = "none";
        document.getElementById("orm-gen-result-section").style.display   = "none";
        const footer = document.getElementById("orm-gen-modal-footer");
        footer.innerHTML = "<button id=\"orm-gen-cancel-btn\" class=\"seed-btn seed-btn-secondary\">Cancel</button>" +
            "<button id=\"orm-gen-execute-btn\" class=\"seed-btn seed-btn-primary\">Generate</button>";
        document.getElementById("orm-gen-cancel-btn").onclick  = CloseORMGenOverlay;
        document.getElementById("orm-gen-execute-btn").onclick = function () {
            SendMessage(XMessageType.GenerateORMCodeExecute, {
                ModelIndex:     _ORMGenSelectedModel,
                OrmId:          _ORMGenSelectedORM,
                ContextContent: _ORMGenContextContent
            });
        };

        const browseBtn = document.getElementById("orm-gen-browse-btn");
        if (browseBtn) {
            browseBtn.onclick = function () {
                SendMessage(XMessageType.ORMGenBrowseContext, { OrmId: _ORMGenSelectedORM });
            };
        }

        _ORMGenBuildModelDropdown(pPayload);
        _ORMGenBuildTargetDropdown(pPayload);
        _ORMGenUpdatePromptPreview(pPayload);

        document.addEventListener("keydown", _ORMGenKeyHandler);
        overlay.addEventListener("click",   _ORMGenOverlayClickHandler);
    }

    function _ORMGenKeyHandler(e) {
        if (e.key === "Escape") CloseORMGenOverlay();
    }
    function _ORMGenOverlayClickHandler(e) {
        if (e.target.id === "orm-gen-overlay") CloseORMGenOverlay();
    }

    function ORMGenContextFileLoaded(pPayload) {
        if (!pPayload) return;
        _ORMGenContextContent = pPayload.content || "";
        const fileEl = document.getElementById("orm-gen-context-file");
        if (fileEl) fileEl.textContent = pPayload.fileName || "Unknown";
    }

    function StartORMGenProgress(pPayload) {
        document.getElementById("orm-gen-picker-section").style.display   = "none";
        document.getElementById("orm-gen-progress-section").style.display = "block";
        document.getElementById("orm-gen-steps-list").style.display       = "block";
        document.getElementById("orm-gen-status-dot").className = "ai-status-dot ai-status-dot--running";

        const badge = document.getElementById("orm-gen-model-badge");
        if (badge && pPayload) badge.textContent = (pPayload.vendor || "") + " " + (pPayload.model || "");

        const fill  = document.getElementById("orm-gen-progress-fill");
        const label = document.getElementById("orm-gen-progress-label");
        if (fill)  fill.style.width = "5%";
        if (label) label.textContent = "Starting…";

        const footer = document.getElementById("orm-gen-modal-footer");
        footer.innerHTML = "<button id=\"orm-gen-cancel-btn\" class=\"seed-btn seed-btn-secondary\">Cancel</button>";
        document.getElementById("orm-gen-cancel-btn").onclick = CloseORMGenOverlay;
    }

    function UpdateORMGenProgress(pPayload) {
        if (!pPayload) return;
        const fill   = document.getElementById("orm-gen-progress-fill");
        const label  = document.getElementById("orm-gen-progress-label");
        const steps  = document.getElementById("orm-gen-steps-list");
        if (fill)  fill.style.width = (pPayload.percent || 0) + "%";
        if (label) label.textContent = pPayload.message || "";
        if (steps && pPayload.step && pPayload.step !== "streaming") {
            const li = document.createElement("div");
            li.className = "ai-step-item";
            li.innerHTML = "<span class=\"ai-step-text\">" + EscapeHtml(pPayload.message || "") + "</span>";
            steps.appendChild(li);
        }
    }

    function CompleteORMGen(pPayload) {
        const fill   = document.getElementById("orm-gen-progress-fill");
        const label  = document.getElementById("orm-gen-progress-label");
        const result = document.getElementById("orm-gen-result-section");
        const info   = document.getElementById("orm-gen-result-info");

        if (fill)  { fill.style.width = "100%"; fill.className = "ai-progress-bar-fill ai-progress-bar-fill--done"; }
        if (label) label.textContent = "Done!";
        document.getElementById("orm-gen-status-dot").className = "ai-status-dot ai-status-dot--done";

        if (result && info && pPayload && pPayload.success) {
            result.style.display = "block";
            info.innerHTML =
                "<div><span class=\"sql-result-label\">File</span><span class=\"sql-result-value\">" +
                EscapeHtml(pPayload.fileName || "") + "</span></div>" +
                "<div><span class=\"sql-result-label\">ORM</span><span class=\"sql-result-value\">" +
                EscapeHtml(pPayload.orm || "") + "</span></div>" +
                "<div><span class=\"sql-result-label\">Lines</span><span class=\"sql-result-value\">" +
                EscapeHtml(String(pPayload.lineCount || 0)) + "</span></div>";
        }

        const footer = document.getElementById("orm-gen-modal-footer");
        footer.innerHTML = "<button id=\"orm-gen-close-btn\" class=\"seed-btn seed-btn-primary\">Close</button>";
        document.getElementById("orm-gen-close-btn").onclick = CloseORMGenOverlay;
    }

    function ErrorORMGen(pPayload) {
        const fill  = document.getElementById("orm-gen-progress-fill");
        const label = document.getElementById("orm-gen-progress-label");
        if (fill)  { fill.className = "ai-progress-bar-fill ai-progress-bar-fill--error"; }
        if (label) label.textContent = (pPayload && pPayload.message) ? pPayload.message : "Error";
        document.getElementById("orm-gen-status-dot").className = "ai-status-dot ai-status-dot--error";

        const footer = document.getElementById("orm-gen-modal-footer");
        footer.innerHTML = "<button id=\"orm-gen-close-btn\" class=\"seed-btn seed-btn-secondary\">Close</button>";
        document.getElementById("orm-gen-close-btn").onclick = CloseORMGenOverlay;
    }

    function CloseORMGenOverlay() {
        const overlay = document.getElementById("orm-gen-overlay");
        if (overlay) {
            overlay.style.display = "none";
            overlay.setAttribute("aria-hidden", "true");
        }
        document.removeEventListener("keydown", _ORMGenKeyHandler);
    }


    // ── SQL Script Generation overlay ─────────────────────────────────────────

    let _SQLPickerModels   = [];
    let _SQLSelectedModel  = 0;
    let _SQLSelectedDB     = "sqlserver";
    let _SQLCustomDB       = "";

    const _SQL_DATABASES = [
        { id: "sqlserver",  label: "SQL Server"  },
        { id: "oracle",     label: "Oracle"      },
        { id: "postgresql", label: "PostgreSQL"  },
        { id: "mysql",      label: "MySQL"        },
        { id: "another",    label: "Another\u2026" }
    ];

    // --- persistence helpers ---

    function _SQLGetLastModel() {
        try { return localStorage.getItem("dase.sql.lastModel") || ""; }
        catch { return ""; }
    }
    function _SQLSaveLastModel(pName) {
        try { localStorage.setItem("dase.sql.lastModel", pName || ""); }
        catch { /* storage unavailable */ }
    }
    function _SQLGetLastDB() {
        try { return localStorage.getItem("dase.sql.lastDB") || "sqlserver"; }
        catch { return "sqlserver"; }
    }
    function _SQLSaveLastDB(pId) {
        try { localStorage.setItem("dase.sql.lastDB", pId || "sqlserver"); }
        catch { /* storage unavailable */ }
    }

    // --- label helpers ---

    function _SQLSetModelLabel(pIndex) {
        const m = _SQLPickerModels[pIndex];
        if (!m) return;
        document.getElementById("sql-model-selector-name").textContent = m.name;
        const costEl = document.getElementById("sql-model-selector-cost");
        if (costEl) {
            costEl.textContent   = m.costLabel || "";
            costEl.style.display = m.costLabel ? "" : "none";
        }
    }

    function _SQLSetDBLabel(pId) {
        const db = _SQL_DATABASES.find(function (d) { return d.id === pId; });
        const label = db ? db.label : pId;
        const nameEl = document.getElementById("sql-db-selector-name");
        if (nameEl) nameEl.textContent = label;
        // Show / hide custom-DB text field
        const customRow = document.getElementById("sql-custom-db-row");
        if (customRow) customRow.style.display = (pId === "another") ? "flex" : "none";
    }

    // --- dropdown builders ---

    function _SQLBuildModelDropdown() {
        const dropdown = document.getElementById("sql-model-dropdown");
        dropdown.innerHTML = "";
        for (let i = 0; i < _SQLPickerModels.length; i++) {
            const m   = _SQLPickerModels[i];
            const row = document.createElement("div");
            row.className = "ai-model-row" + (i === _SQLSelectedModel ? " ai-model-row--selected" : "");
            row.setAttribute("data-index", String(i));
            const costLabel = m.costLabel || "";
            row.innerHTML =
                "<span class=\"ai-model-check\">\u2713</span>" +
                "<span class=\"ai-model-name\">" + EscapeHtml(m.name) + "</span>" +
                (costLabel ? "<span class=\"ai-model-cost\">" + EscapeHtml(costLabel) + "</span>" : "");
            row.addEventListener("click", function (e) {
                e.stopPropagation();
                const rows = dropdown.querySelectorAll(".ai-model-row");
                rows.forEach(function (r) { r.classList.remove("ai-model-row--selected"); });
                row.classList.add("ai-model-row--selected");
                _SQLSelectedModel = parseInt(row.getAttribute("data-index"), 10);
                _SQLSetModelLabel(_SQLSelectedModel);
                _SQLSaveLastModel(_SQLPickerModels[_SQLSelectedModel]?.name || "");
                dropdown.style.display = "none";
            });
            dropdown.appendChild(row);
        }
        const sel = dropdown.querySelector(".ai-model-row--selected");
        if (sel) setTimeout(function () { sel.scrollIntoView({ block: "nearest" }); }, 0);
    }

    function _SQLBuildDBDropdown() {
        const dropdown = document.getElementById("sql-db-dropdown");
        dropdown.innerHTML = "";
        for (let i = 0; i < _SQL_DATABASES.length; i++) {
            const db  = _SQL_DATABASES[i];
            const row = document.createElement("div");
            row.className = "ai-model-row" + (db.id === _SQLSelectedDB ? " ai-model-row--selected" : "");
            row.setAttribute("data-id", db.id);
            row.innerHTML =
                "<span class=\"ai-model-check\">\u2713</span>" +
                "<span class=\"ai-model-name\">" + EscapeHtml(db.label) + "</span>";
            row.addEventListener("click", function (e) {
                e.stopPropagation();
                const rows = dropdown.querySelectorAll(".ai-model-row");
                rows.forEach(function (r) { r.classList.remove("ai-model-row--selected"); });
                row.classList.add("ai-model-row--selected");
                _SQLSelectedDB = row.getAttribute("data-id");
                _SQLSetDBLabel(_SQLSelectedDB);
                _SQLSaveLastDB(_SQLSelectedDB);
                dropdown.style.display = "none";
                // Update prompt preview
                _SQLUpdatePromptPreview();
            });
            dropdown.appendChild(row);
        }
    }

    function _SQLUpdatePromptPreview() {
        const previewEl  = document.getElementById("sql-prompt-preview");
        const dbNameEl   = document.getElementById("sql-db-selector-name");
        const customEl   = document.getElementById("sql-custom-db-input");
        if (!previewEl) return;
        let dbLabel = (dbNameEl ? dbNameEl.textContent : "SQL Server") || "SQL Server";
        if (_SQLSelectedDB === "another" && customEl && customEl.value.trim())
            dbLabel = customEl.value.trim();
        previewEl.value = _SQLBuildLocalPreview(dbLabel);
    }

    function _SQLBuildLocalPreview(pDbLabel) {
        const count = _SQLPickerModels.length > 0 ? document.getElementById("sql-model-badge")?.textContent || "" : "";
        return (
            "Target database: " + pDbLabel + "\n\n" +
            (count ? count + "\n\n" : "") +
            "The AI will receive the full DBML schema and generate:\n" +
            "  \u2022 CREATE TABLE with " + pDbLabel + "-specific data types\n" +
            "  \u2022 PRIMARY KEY constraints and auto-increment identities\n" +
            "  \u2022 FOREIGN KEY constraints (ON DELETE NO ACTION)\n" +
            "  \u2022 CREATE INDEX for every FK column\n" +
            "  \u2022 DROP / IF NOT EXISTS safety guards\n" +
            "  \u2022 Schema-prefixed identifiers\n" +
            "  \u2022 Descriptive SQL comments per table\n\n" +
            "Output: .sql file saved alongside the .dsorm model."
        );
    }

    // --- phase 1: open picker ---

    function OpenSQLScriptPickerOverlay(pPayload) {
        const overlay = document.getElementById("sql-overlay");
        if (!overlay) return;

        _SQLPickerModels  = (pPayload && pPayload.models) ? pPayload.models : [];
        _SQLSelectedDB    = _SQLGetLastDB();
        _SQLCustomDB      = "";

        // Reset sections
        document.getElementById("sql-picker-section").style.display   = "block";
        document.getElementById("sql-progress-section").style.display = "none";
        document.getElementById("sql-steps-list").style.display        = "none";
        document.getElementById("sql-result-section").style.display   = "none";
        document.getElementById("sql-model-dropdown").style.display   = "none";
        document.getElementById("sql-db-dropdown").style.display      = "none";

        document.getElementById("sql-modal-icon").textContent  = "\uD83D\uDDC4\uFE0F";
        document.getElementById("sql-modal-title").textContent = "Create SQL Script";
        const badgeEl = document.getElementById("sql-model-badge");
        if (badgeEl) {
            const tbl = pPayload?.tableCount ?? 0;
            const ref = pPayload?.refCount   ?? 0;
            badgeEl.textContent = tbl + " table" + (tbl !== 1 ? "s" : "") +
                                  " \u00B7 " + ref + " FK" + (ref !== 1 ? "s" : "");
        }

        // Pre-select model
        const lastModel = _SQLGetLastModel();
        _SQLSelectedModel = 0;
        for (let i = 0; i < _SQLPickerModels.length; i++) {
            if (lastModel && _SQLPickerModels[i].name === lastModel) {
                _SQLSelectedModel = i;
                break;
            }
        }
        _SQLSetModelLabel(_SQLSelectedModel);

        // DB selector
        _SQLSetDBLabel(_SQLSelectedDB);

        // Prompt preview
        const promptEl = document.getElementById("sql-prompt-preview");
        if (promptEl) promptEl.value = (pPayload && pPayload.promptPreview) ? pPayload.promptPreview : _SQLBuildLocalPreview("SQL Server");

        // Custom DB input change
        const customEl = document.getElementById("sql-custom-db-input");
        if (customEl) {
            customEl.value = "";
            customEl.oninput = function () {
                _SQLCustomDB = customEl.value;
                _SQLUpdatePromptPreview();
            };
        }

        // Wire model selector
        const modelBtn = document.getElementById("sql-model-selector-btn");
        modelBtn.onclick = function (e) {
            e.stopPropagation();
            const dd = document.getElementById("sql-model-dropdown");
            if (dd.style.display === "none") {
                const rect = modelBtn.getBoundingClientRect();
                dd.style.top   = (rect.bottom + 4) + "px";
                dd.style.left  = rect.left + "px";
                dd.style.width = rect.width + "px";
                _SQLBuildModelDropdown();
                dd.style.display = "block";
                document.addEventListener("click", function _closeSQLModelDD() {
                    dd.style.display = "none";
                    document.removeEventListener("click", _closeSQLModelDD);
                });
            } else {
                dd.style.display = "none";
            }
        };

        // Wire DB selector
        const dbBtn = document.getElementById("sql-db-selector-btn");
        dbBtn.onclick = function (e) {
            e.stopPropagation();
            const dd = document.getElementById("sql-db-dropdown");
            if (dd.style.display === "none") {
                const rect = dbBtn.getBoundingClientRect();
                dd.style.top   = (rect.bottom + 4) + "px";
                dd.style.left  = rect.left + "px";
                dd.style.width = rect.width + "px";
                _SQLBuildDBDropdown();
                dd.style.display = "block";
                document.addEventListener("click", function _closeSQLDBDD() {
                    dd.style.display = "none";
                    document.removeEventListener("click", _closeSQLDBDD);
                });
            } else {
                dd.style.display = "none";
            }
        };

        // Wire status dot
        const statusDot = document.getElementById("sql-status-dot");
        statusDot.className = "ai-status-dot ai-status-dot--idle";

        // Footer: Cancel + Generate
        const footer = document.getElementById("sql-modal-footer");
        footer.innerHTML =
            "<button id=\"sql-cancel-btn\" class=\"seed-btn seed-btn-secondary\">Cancel</button>" +
            "<button id=\"sql-execute-btn\" class=\"seed-btn seed-btn-primary\">Generate</button>";

        document.getElementById("sql-cancel-btn").onclick  = CloseSQLScriptOverlay;
        document.getElementById("sql-execute-btn").onclick = function () {
            const customDB = (document.getElementById("sql-custom-db-input")?.value || "").trim();
            SendMessage(XMessageType.CreateSQLScriptExecute, {
                ModelIndex: _SQLSelectedModel,
                Database:   _SQLSelectedDB,
                CustomDB:   customDB
            });
        };

        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden", "false");
    }

    // --- phase 2: progress ---

    function StartSQLScriptProgress(pPayload) {
        document.getElementById("sql-picker-section").style.display   = "none";
        document.getElementById("sql-progress-section").style.display = "block";
        document.getElementById("sql-steps-list").style.display        = "block";
        document.getElementById("sql-steps-list").innerHTML            = "";
        document.getElementById("sql-result-section").style.display   = "none";

        document.getElementById("sql-progress-fill").style.width    = "0%";
        document.getElementById("sql-progress-fill").className      = "ai-progress-bar-fill";
        document.getElementById("sql-progress-label").textContent   = "Initializing\u2026";
        document.getElementById("sql-modal-icon").textContent       = "\uD83D\uDDC4\uFE0F";
        document.getElementById("sql-status-dot").className         = "ai-status-dot ai-status-dot--running";

        const badge = document.getElementById("sql-model-badge");
        if (badge && pPayload) {
            const vendor = pPayload.vendor ? " \u00B7 " + pPayload.vendor : "";
            badge.textContent = (pPayload.model || "") + vendor +
                (pPayload.database ? " \u00B7 " + pPayload.database : "");
        }

        // Footer: only Cancel while running
        const footer = document.getElementById("sql-modal-footer");
        footer.innerHTML = "<button id=\"sql-cancel-btn\" class=\"seed-btn seed-btn-secondary\">Cancel</button>";
        document.getElementById("sql-cancel-btn").onclick = CloseSQLScriptOverlay;
    }

    function UpdateSQLScriptProgress(pPayload) {
        if (!pPayload) return;
        const fill  = document.getElementById("sql-progress-fill");
        const label = document.getElementById("sql-progress-label");
        if (fill  && pPayload.percent !== undefined) fill.style.width = Math.min(pPayload.percent, 100) + "%";
        if (label && pPayload.message)               label.textContent = pPayload.message;

        if (pPayload.step && pPayload.step !== "streaming") {
            const list = document.getElementById("sql-steps-list");
            const item = document.createElement("div");
            item.className = "ai-step-item";
            item.innerHTML = "<span class=\"ai-step-check\">\u2713</span><span class=\"ai-step-text\">" +
                EscapeHtml(pPayload.message) + "</span>";
            list.appendChild(item);
            list.scrollTop = list.scrollHeight;
        }
    }

    // --- phase 3: complete ---

    function CompleteSQLScript(pPayload) {
        const fill  = document.getElementById("sql-progress-fill");
        const label = document.getElementById("sql-progress-label");
        if (fill)  { fill.style.width = "100%"; fill.className = "ai-progress-bar-fill ai-progress-bar-fill--done"; }
        if (label && pPayload?.fileName) label.textContent = "Saved \u2014 " + pPayload.fileName;

        document.getElementById("sql-status-dot").className = "ai-status-dot ai-status-dot--done";
        document.getElementById("sql-modal-icon").textContent = "\u2705";

        const resultSect = document.getElementById("sql-result-section");
        const info       = document.getElementById("sql-result-info");
        if (resultSect) resultSect.style.display = "block";
        if (info && pPayload) {
            info.innerHTML =
                "<div class=\"sql-result-row\"><span class=\"sql-result-label\">File</span><span class=\"sql-result-value\">" +
                EscapeHtml(pPayload.fileName || "") + "</span></div>" +
                "<div class=\"sql-result-row\"><span class=\"sql-result-label\">Database</span><span class=\"sql-result-value\">" +
                EscapeHtml(pPayload.database || "") + "</span></div>" +
                "<div class=\"sql-result-row\"><span class=\"sql-result-label\">Lines</span><span class=\"sql-result-value\">" +
                (pPayload.lineCount || 0) + "</span></div>";
        }

        const footer = document.getElementById("sql-modal-footer");
        footer.innerHTML = "<button id=\"sql-close-btn\" class=\"seed-btn seed-btn-primary\">Close</button>";
        document.getElementById("sql-close-btn").onclick = CloseSQLScriptOverlay;
    }

    // --- error ---

    function ErrorSQLScript(pPayload) {
        const fill  = document.getElementById("sql-progress-fill");
        const label = document.getElementById("sql-progress-label");
        if (fill)  { fill.className = "ai-progress-bar-fill ai-progress-bar-fill--error"; }
        if (label) label.textContent = (pPayload && pPayload.message) ? pPayload.message : "Error";
        document.getElementById("sql-status-dot").className = "ai-status-dot ai-status-dot--error";

        const footer = document.getElementById("sql-modal-footer");
        footer.innerHTML = "<button id=\"sql-close-btn\" class=\"seed-btn seed-btn-secondary\">Close</button>";
        document.getElementById("sql-close-btn").onclick = CloseSQLScriptOverlay;
    }

    function CloseSQLScriptOverlay() {
        const overlay = document.getElementById("sql-overlay");
        if (overlay) {
            overlay.style.display = "none";
            overlay.setAttribute("aria-hidden", "true");
        }
    }

})();
