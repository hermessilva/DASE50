(function() {
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
        DragDropAddRelation: "DragDropAddRelation",
        DeleteSelected: "DeleteSelected",
        RenameSelected: "RenameSelected",
        UpdateProperty: "UpdateProperty",
        PropertiesChanged: "PropertiesChanged",
        ValidateModel: "ValidateModel",
        IssuesChanged: "IssuesChanged",
        RequestRename: "RequestRename",
        RenameCompleted: "RenameCompleted",
        AlignLines: "AlignLines"
    };

    let _Model = { DesignID: null, Tables: [], References: [] };
    let _SelectedIDs = [];
    let _DragState = null;
    let _RelationDragState = null;
    let _ContextMenuPosition = { X: 0, Y: 0 };
    let _ContextMenuTarget = null;

    const _Canvas = document.getElementById("canvas");
    const _TablesLayer = document.getElementById("tables-layer");
    const _RelationsLayer = document.getElementById("relations-layer");
    const _CanvasContainer = document.getElementById("canvas-container");
    const _ContextMenu = document.getElementById("context-menu");
    const _TableContextMenu = document.getElementById("table-context-menu");

    function Initialize()
    {
        SetupCanvasEvents();
        SetupContextMenu();
        SetupMessageHandler();
        SendMessage(XMessageType.DesignerReady, {});
    }

    function SendMessage(pType, pPayload)
    {
        vscode.postMessage({ Type: pType, Payload: pPayload });
    }

    function SetupMessageHandler()
    {
        window.addEventListener("message", function(pEvent) {
            const msg = pEvent.data;
            HandleMessage(msg);
        });
    }

    function HandleMessage(pMsg)
    {
        switch (pMsg.Type)
        {
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
                break;
        }
    }

    function SetupContextMenu()
    {
        _ContextMenu.addEventListener("click", function(e) {
            const item = e.target.closest(".context-menu-item");
            if (!item)
                return;

            const action = item.getAttribute("data-action");
            HideContextMenu();

            switch (action)
            {
                case "add-table":
                    SendMessage(XMessageType.AddTable, { X: _ContextMenuPosition.X, Y: _ContextMenuPosition.Y });
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
            }
        });

        _TableContextMenu.addEventListener("click", function(e) {
            const item = e.target.closest(".context-menu-item");
            if (!item)
                return;

            const action = item.getAttribute("data-action");
            const tableID = _ContextMenuTarget;
            HideContextMenu();

            switch (action)
            {
                case "add-field":
                    if (tableID)
                        SendMessage(XMessageType.AddField, { TableID: tableID, Name: "NewField", DataType: "String" });
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

        document.addEventListener("click", function(e) {
            if (!_ContextMenu.contains(e.target) && !_TableContextMenu.contains(e.target))
                HideContextMenu();
        });
    }

    function ShowContextMenu(pX, pY, pCanvasX, pCanvasY)
    {
        _ContextMenuPosition.X = pCanvasX;
        _ContextMenuPosition.Y = pCanvasY;
        _ContextMenuTarget = null;

        // Update menu items based on selection
        const deleteItem = _ContextMenu.querySelector('[data-action="delete-selected"]');
        const renameItem = _ContextMenu.querySelector('[data-action="rename-selected"]');
        
        if (_SelectedIDs.length === 0)
        {
            deleteItem.classList.add("disabled");
            renameItem.classList.add("disabled");
        }
        else
        {
            deleteItem.classList.remove("disabled");
            renameItem.classList.remove("disabled");
        }

        _TableContextMenu.classList.remove("visible");
        _ContextMenu.style.left = pX + "px";
        _ContextMenu.style.top = pY + "px";
        _ContextMenu.classList.add("visible");
    }

    function ShowTableContextMenu(pX, pY, pTableID)
    {
        _ContextMenuTarget = pTableID;
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.style.left = pX + "px";
        _TableContextMenu.style.top = pY + "px";
        _TableContextMenu.classList.add("visible");
    }

    function HideContextMenu()
    {
        _ContextMenu.classList.remove("visible");
        _TableContextMenu.classList.remove("visible");
        _ContextMenuTarget = null;
    }

    function SetupCanvasEvents()
    {
        _Canvas.addEventListener("click", function(e) {
            if (e.target === _Canvas || e.target.id === "relations-layer" || e.target.id === "tables-layer")
            {
                // Select the Design when clicking on the background
                if (_Model.DesignID)
                    SendMessage(XMessageType.SelectElement, { ElementID: _Model.DesignID });
                else
                    SendMessage(XMessageType.SelectElement, { Clear: true });
            }
        });

        _CanvasContainer.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            
            const rect = _CanvasContainer.getBoundingClientRect();
            const canvasX = e.clientX - rect.left + _CanvasContainer.scrollLeft;
            const canvasY = e.clientY - rect.top + _CanvasContainer.scrollTop;
            
            ShowContextMenu(e.clientX, e.clientY, canvasX, canvasY);
        });
    }

    function RenderModel()
    {
        RenderRelations();
        RenderTables();
        UpdateSelectionVisuals();
    }

    function RenderTables()
    {
        _TablesLayer.innerHTML = "";
        
        for (const table of _Model.Tables)
        {
            const g = CreateTableElement(table);
            _TablesLayer.appendChild(g);
        }
    }

    function CreateTableElement(pTable)
    {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "orm-table");
        g.setAttribute("data-id", pTable.ID);
        g.setAttribute("transform", "translate(" + pTable.X + "," + pTable.Y + ")");

        const width = pTable.Width || 200;
        const headerHeight = 28;
        const fieldHeight = 16;
        
        // Calculate height based on number of fields
        // Empty table = only header height (just the title bar)
        // Table with fields = header + (fieldCount * fieldHeight) + padding
        // ALWAYS calculate - never use pTable.Height to ensure consistency
        const fieldCount = (pTable.Fields && pTable.Fields.length) || 0;
        const bodyHeight = fieldCount > 0 ? fieldCount * fieldHeight + 12 : 0;
        const height = headerHeight + bodyHeight;

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("class", "orm-table-rect");
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("rx", 4);
        rect.setAttribute("ry", 4);
        // Border color matches header color
        if (pTable.FillProp)
            rect.style.stroke = pTable.FillProp;
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
        if (pTable.FillProp)
            headerMask.style.fill = pTable.FillProp;
        g.appendChild(headerMask);

        // Apply FillProp to header if defined
        if (pTable.FillProp)
            header.style.fill = pTable.FillProp;

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
        icon.setAttribute("class", "orm-table-icon");
        icon.setAttribute("x", 8);
        icon.setAttribute("y", 18);
        icon.textContent = "ID";
        g.appendChild(icon);

        const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
        title.setAttribute("class", "orm-table-title");
        title.setAttribute("x", 28);
        title.setAttribute("y", 18);
        title.textContent = pTable.Name || "Unnamed";
        g.appendChild(title);

        if (pTable.Fields && pTable.Fields.length > 0)
        {
            let y = headerHeight + 16;
            for (const field of pTable.Fields)
            {
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

                const fieldText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                fieldText.setAttribute("class", "orm-table-field" + (field.IsPrimaryKey ? " orm-table-field-pk" : ""));
                fieldText.setAttribute("x", 10);
                fieldText.setAttribute("y", y);
                
                const prefix = field.IsPrimaryKey ? "🔑 " : "";
                const nullable = field.IsNullable ? "" : "*";
                fieldText.textContent = prefix + (field.Name || field.FieldName || "field") + nullable;
                fieldGroup.appendChild(fieldText);

                SetupFieldEvents(fieldGroup, field);
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
            { x: -hoverPadding - anchorSize/2, y: -hoverPadding - anchorSize/2, anchor: "top-left" },
            { x: width + hoverPadding - anchorSize/2, y: -hoverPadding - anchorSize/2, anchor: "top-right" },
            { x: -hoverPadding - anchorSize/2, y: height + hoverPadding - anchorSize/2, anchor: "bottom-left" },
            { x: width + hoverPadding - anchorSize/2, y: height + hoverPadding - anchorSize/2, anchor: "bottom-right" },
            // Edge centers - centered on hover border edges
            { x: width/2 - anchorSize/2, y: -hoverPadding - anchorSize/2, anchor: "top" },
            { x: width/2 - anchorSize/2, y: height + hoverPadding - anchorSize/2, anchor: "bottom" },
            { x: -hoverPadding - anchorSize/2, y: height/2 - anchorSize/2, anchor: "left" },
            { x: width + hoverPadding - anchorSize/2, y: height/2 - anchorSize/2, anchor: "right" }
        ];

        for (const pos of anchorPositions)
        {
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

    function SetupTableEvents(pElement, pTable)
    {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let elementStartX = pTable.X;
        let elementStartY = pTable.Y;

        pElement.addEventListener("mousedown", function(e) {
            if (e.target.classList.contains("orm-table-anchor"))
            {
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

            const onMouseMove = function(e) {
                if (!isDragging)
                    return;

                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;
                const newX = Math.max(0, elementStartX + dx);
                const newY = Math.max(0, elementStartY + dy);

                pElement.setAttribute("transform", "translate(" + newX + "," + newY + ")");
                pTable.X = newX;
                pTable.Y = newY;
            };

            const onMouseUp = function(e) {
                if (isDragging && (pTable.X !== elementStartX || pTable.Y !== elementStartY))
                {
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

        pElement.addEventListener("dblclick", function(e) {
            ShowRenameInput(pTable.ID);
        });

        pElement.addEventListener("contextmenu", function(e) {
            e.preventDefault();
            e.stopPropagation();
            SendMessage(XMessageType.SelectElement, { ElementID: pTable.ID });
            ShowTableContextMenu(e.clientX, e.clientY, pTable.ID);
        });
    }

    function SetupFieldEvents(pElement, pField)
    {
        pElement.addEventListener("mousedown", function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pField.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pField.ID, Toggle: true });
        });

        pElement.addEventListener("dblclick", function(e) {
            e.preventDefault();
            e.stopPropagation();
            ShowRenameInput(pField.ID);
        });
    }

    function StartRelationDrag(pSourceTable, pEvent)
    {
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
        switch (anchorType)
        {
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
            StartY: startY
        };

        const onMouseMove = function(e) {
            if (!_RelationDragState)
                return;

            const rect = _CanvasContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + _CanvasContainer.scrollLeft;
            const y = e.clientY - rect.top + _CanvasContainer.scrollTop;

            _RelationDragState.Line.setAttribute("x2", x);
            _RelationDragState.Line.setAttribute("y2", y);
        };

        const onMouseUp = function(e) {
            if (!_RelationDragState)
                return;

            const rect = _CanvasContainer.getBoundingClientRect();
            const x = e.clientX - rect.left + _CanvasContainer.scrollLeft;
            const y = e.clientY - rect.top + _CanvasContainer.scrollTop;

            const targetTable = FindTableAtPoint(x, y);

            if (targetTable && targetTable.ID !== _RelationDragState.SourceTable.ID)
            {
                SendMessage(XMessageType.DragDropAddRelation, {
                    SourceID: _RelationDragState.SourceTable.ID,
                    TargetID: targetTable.ID
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

    function FindTableAtPoint(pX, pY)
    {
        const headerHeight = 28;
        const fieldHeight = 16;
        const padding = 12;
        
        for (const table of _Model.Tables)
        {
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

    function BuildPathFromPoints(pPoints)
    {
        if (!pPoints || pPoints.length < 2)
            return "";

        const CORNER_RADIUS = 15;

        // Helper: arredondar valor
        function round(v) { return Math.round(v * 10) / 10; }

        // Helper: calcula ponto no círculo (mesmo algoritmo do XMath.PointCircle)
        function pointCircle(pCenter, pPoint, pRadius)
        {
            const dx = pPoint.X - pCenter.X;
            const dy = pPoint.Y - pCenter.Y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.001) return { X: pCenter.X, Y: pCenter.Y };
            const ratio = pRadius / dist;
            return { X: pCenter.X + dx * ratio, Y: pCenter.Y + dy * ratio };
        }

        // Helper: calcula os pontos do canto arredondado (mesmo algoritmo do XMath.AddCorner)
        function addCorner(pCorner, pMaxRadius, pBefore, pAfter)
        {
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

        for (let i = 1; i < pPoints.length; i++)
        {
            const prev = pPoints[i - 1];
            const curr = pPoints[i];
            const next = i < pPoints.length - 1 ? pPoints[i + 1] : null;

            if (next)
            {
                // Tenta criar canto arredondado
                const corner = addCorner(curr, CORNER_RADIUS, prev, next);
                if (corner)
                {
                    // Linha até o ponto antes da curva
                    path += ` L ${corner.before.X} ${corner.before.Y}`;
                    // Curva Bezier quadrática (Q) usando o canto como ponto de controle
                    path += ` Q ${corner.corner.X} ${corner.corner.Y} ${corner.after.X} ${corner.after.Y}`;
                }
                else
                {
                    // Sem canto válido, linha reta normal
                    path += ` L ${curr.X} ${curr.Y}`;
                }
            }
            else
            {
                // Último ponto, linha reta
                path += ` L ${curr.X} ${curr.Y}`;
            }
        }

        return path;
    }

    function SimplifyReferencePoints(pPoints, pSourceTable, pTargetTable)
    {
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
        for (let i = 1; i < valid.length; i++)
        {
            const prev = cleaned[cleaned.length - 1];
            if (Math.abs(valid[i].X - prev.X) > 1 || Math.abs(valid[i].Y - prev.Y) > 1)
                cleaned.push(valid[i]);
        }

        // Remover pontos colineares intermediários
        if (cleaned.length > 2)
        {
            const final = [cleaned[0]];
            for (let i = 1; i < cleaned.length - 1; i++)
            {
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

    function RenderRelations()
    {
        _RelationsLayer.innerHTML = "";
        
        for (const ref of _Model.References)
        {
            const g = CreateRelationElement(ref);
            if (g)
                _RelationsLayer.appendChild(g);
        }
    }

    function GetTableColor(pTableID)
    {
        const table = _Model.Tables.find(t => t.ID === pTableID);
        if (table && table.FillProp)
            return table.FillProp;
        return "#2d8a4e";
    }

    function CreateRelationElement(pRef)
    {
        // Source is a field ID - find the table that contains this field
        const sourceTable = _Model.Tables.find(t => 
            t.Fields && t.Fields.some(f => f.ID === pRef.SourceFieldID)
        );
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
        
        if (points.length >= 2)
        {
            // Renderiza linha roteada com múltiplos segmentos
            const pathData = BuildPathFromPoints(points);
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("class", "orm-fk-line");
            path.setAttribute("d", pathData);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", GetTableColor(pRef.TargetTableID));
            g.appendChild(path);


        }
        else
        {
            // Fallback: linha reta simples
            const x1 = sourceTable.X + (sourceTable.Width || 200);
            const y1 = sourceTable.Y + (sourceTable.Height || 150) / 2;
            const x2 = targetTable.X;
            const y2 = targetTable.Y + (targetTable.Height || 150) / 2;

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "orm-fk-line");
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", GetTableColor(pRef.TargetTableID));
            g.appendChild(line);
        }

        g.addEventListener("click", function(e) {
            e.stopPropagation();
            if (!e.ctrlKey)
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID });
            else
                SendMessage(XMessageType.SelectElement, { ElementID: pRef.ID, Toggle: true });
        });

        return g;
    }

    function UpdateSelectionVisuals()
    {
        const tables = _TablesLayer.querySelectorAll(".orm-table");
        tables.forEach(function(t) {
            const id = t.getAttribute("data-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                t.classList.add("selected");
            else
                t.classList.remove("selected");
        });

        const refs = _RelationsLayer.querySelectorAll(".orm-reference");
        refs.forEach(function(r) {
            const id = r.getAttribute("data-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                r.classList.add("selected");
            else
                r.classList.remove("selected");
        });

        const fields = _TablesLayer.querySelectorAll(".orm-field-group");
        fields.forEach(function(f) {
            const id = f.getAttribute("data-field-id");
            if (_SelectedIDs.indexOf(id) >= 0)
                f.classList.add("selected");
            else
                f.classList.remove("selected");
        });
    }

    function ShowRenameInput(pElementID)
    {
        // Try to find table first
        let table = _Model.Tables.find(t => t.ID === pElementID);
        let field = null;
        let parentTable = null;

        // If not a table, look for a field
        if (!table)
        {
            for (const t of _Model.Tables)
            {
                if (t.Fields)
                {
                    field = t.Fields.find(f => f.ID === pElementID);
                    if (field)
                    {
                        parentTable = t;
                        break;
                    }
                }
            }
        }

        if (!table && !field)
            return;

        let g, elementX, elementY, elementWidth, currentName;

        if (table)
        {
            g = _TablesLayer.querySelector('[data-id="' + pElementID + '"]');
            if (!g)
                return;
            elementX = table.X;
            elementY = table.Y;
            elementWidth = table.Width || 200;
            currentName = table.Name || "";
        }
        else
        {
            g = _TablesLayer.querySelector('[data-field-id="' + pElementID + '"]');
            if (!g)
                return;
            const fieldRect = g.getBoundingClientRect();
            const canvasRect = _CanvasContainer.getBoundingClientRect();
            elementX = parentTable.X;
            elementY = fieldRect.top - canvasRect.top + _CanvasContainer.scrollTop;
            elementWidth = parentTable.Width || 200;
            currentName = field.Name || "";
        }

        const rect = _CanvasContainer.getBoundingClientRect();
        const scrollLeft = _CanvasContainer.scrollLeft;
        const scrollTop = _CanvasContainer.scrollTop;

        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("class", "rename-input");
        input.value = currentName;
        input.style.left = (elementX - scrollLeft + rect.left + 10) + "px";
        input.style.top = (elementY - scrollTop + rect.top + 4) + "px";
        input.style.width = (elementWidth - 20) + "px";

        document.body.appendChild(input);
        input.focus();
        input.select();

        const commit = function() {
            const newName = input.value.trim();
            if (newName && newName !== currentName)
            {
                SendMessage(XMessageType.RenameCompleted, { NewName: newName });
            }
            input.remove();
        };

        input.addEventListener("blur", commit);
        input.addEventListener("keydown", function(e) {
            if (e.key === "Enter")
            {
                e.preventDefault();
                commit();
            }
            else if (e.key === "Escape")
            {
                e.preventDefault();
                input.remove();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", Initialize);
})();
