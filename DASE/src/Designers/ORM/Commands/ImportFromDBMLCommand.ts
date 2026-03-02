/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "@dbml/core";
import { XGuid, XORMStateReference, XPoint } from "@tootega/tfx";
import * as tfx from "@tootega/tfx";
import { XTFXBridge, ITableData } from "../../../Services/TFXBridge";

// ─── Color palette for table groups (ARGB hex strings for XColor) ───────────
// Each group gets a distinct, visually appealing color.
const GROUP_COLORS: string[] = [
    "{A=255;R=52;G=152;B=219}",   // Blue (default/primary)
    "{A=255;R=46;G=204;B=113}",   // Green
    "{A=255;R=231;G=76;B=60}",    // Red
    "{A=255;R=155;G=89;B=182}",   // Purple
    "{A=255;R=243;G=156;B=18}",   // Orange
    "{A=255;R=26;G=188;B=156}",   // Teal
    "{A=255;R=241;G=196;B=15}",   // Yellow
    "{A=255;R=230;G=126;B=34}",   // Dark Orange
    "{A=255;R=52;G=73;B=94}",     // Dark Blue-Gray
    "{A=255;R=192;G=57;B=43}",    // Dark Red
    "{A=255;R=142;G=68;B=173}",   // Dark Purple
    "{A=255;R=44;G=62;B=80}",     // Midnight Blue
];
const STATE_TABLE_COLOR = "{A=255;R=165;G=42;B=42}"; // Brown — state/status tables

// ─── Layout constants ───────────────────────────────────────────────────────
const TABLE_WIDTH = 200;
const TABLE_MIN_H = 80;
const ROW_H = 20;
const GAP_X = 80;
const GAP_Y = 60;
const LAYER_BASE_X = 50;
const LAYER_BASE_Y = 50;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Maps a SQL/DBML type string to the closest TFX DataType. */
function mapDataType(pType: string): string {
    const lower = pType.toLowerCase();
    if (lower === "byte" || lower === "tinyint") return "Int8";
    if (lower === "smallint" || lower === "int16") return "Int16";
    if (lower.includes("bigint") || lower === "int64" || lower === "long") return "Int64";
    if (lower.includes("int")) return "Int32";
    if (lower === "bit" || lower.includes("bool")) return "Boolean";
    if (lower.includes("datetime") || lower.includes("timestamp") ||
        lower.includes("datetimeoffset")) return "DateTime";
    if (lower === "date") return "DateTime";
    if (lower.includes("char") || lower.includes("text") ||
        lower.includes("nvarchar") || lower.includes("varchar")) return "String";
    if (lower.includes("numeric") || lower.includes("decimal") ||
        lower.includes("money") || lower.includes("float") ||
        lower.includes("real") || lower.includes("double")) return "Numeric";
    if (lower.includes("uniqueidentifier") || lower.includes("uuid") ||
        lower.includes("guid")) return "Guid";
    if (lower.includes("binary") || lower.includes("blob") ||
        lower.includes("image") || lower.includes("varbinary")) return "Binary";
    return "String";
}

/** Parse length from DBML type_name, e.g. "nvarchar(256)" → 256. */
function extractLength(pTypeName: string): number | undefined {
    const m = /\((\d+)\)/.exec(pTypeName);
    return m ? parseInt(m[1], 10) : undefined;
}

/** Detect if a table name represents a state/status lookup table. */
function isStateTable(pName: string): boolean {
    const lower = pName.toLowerCase();
    return (
        lower.endsWith("state") || lower.endsWith("status") ||
        lower.endsWith("states") || lower.endsWith("statuses") ||
        // Module prefixed: SYSxState, CORxStatus, etc.
        /x?stat(e|us)(es)?$/i.test(pName)
    );
}

/** Extract a "module prefix" from a table name so tables can be grouped/colored.
 *  Examples:  SYSxUser → "SYSx",  OrderItem → "Order",  SYSxState → "SYSx"
 */
function extractPrefix(pName: string): string {
    // Pattern: Module prefix ending with "x" followed by PascalCase entity (e.g. SYSxUser)
    const modMatch = /^([A-Z]{2,}x)/i.exec(pName);
    if (modMatch) return modMatch[1];

    // Fallback: first PascalCase word (e.g. OrderItem → Order)
    const wordMatch = /^([A-Z][a-z]+)/.exec(pName);
    return wordMatch ? wordMatch[1] : pName;
}

/** Topological sort of tables using Kahn's algorithm. Returns layers (array of arrays).
 *  Layer 0 = root tables with no FK dependencies; Layer N depends on Layer 0..N-1. */
function topologicalLayers(
    pTables: { name: string }[],
    pEdges: { from: string; to: string }[]
): string[][] {
    const inDeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const t of pTables) {
        inDeg.set(t.name, 0);
        adj.set(t.name, []);
    }
    for (const e of pEdges) {
        if (!inDeg.has(e.from) || !inDeg.has(e.to)) continue;
        adj.get(e.to)!.push(e.from);
        inDeg.set(e.from, (inDeg.get(e.from) || 0) + 1);
    }

    const layers: string[][] = [];
    let queue = [...inDeg.entries()].filter(([, d]) => d === 0).map(([n]) => n);

    while (queue.length > 0) {
        layers.push([...queue]);
        const next: string[] = [];
        for (const n of queue) {
            for (const dep of adj.get(n) || []) {
                const d = (inDeg.get(dep) || 1) - 1;
                inDeg.set(dep, d);
                if (d === 0) next.push(dep);
            }
            inDeg.delete(n);
        }
        queue = next;
    }
    // Any remaining nodes (cycles) go into a final layer
    const remaining = [...inDeg.keys()];
    if (remaining.length > 0) layers.push(remaining);

    return layers;
}

// ═══════════════════════════════════════════════════════════════════════════
// Command
// ═══════════════════════════════════════════════════════════════════════════

export class XImportFromDBMLCommand {
    constructor() { }

    static get CommandID(): string {
        return "Dase.ImportFromDBML";
    }

    static Register(pContext: vscode.ExtensionContext): XImportFromDBMLCommand {
        const command = new XImportFromDBMLCommand();
        const disposable = vscode.commands.registerCommand(
            XImportFromDBMLCommand.CommandID,
            async (pUri?: vscode.Uri) => await command.Execute(pUri)
        );
        pContext.subscriptions.push(disposable);
        return command;
    }

    async Execute(pUri?: vscode.Uri): Promise<void> {
        try {
            // ── 1. Resolve the DBML file ────────────────────────────────
            let uri = pUri;
            if (!uri) {
                const results = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    filters: { "DBML Model": ["dbml"] }
                });
                if (results && results.length > 0)
                    uri = results[0];
                else
                    return;
            }

            let dbmlText = fs.readFileSync(uri.fsPath, "utf8");

            // Strip the entire [...] constraint block from Ref lines.
            // @dbml/core rejects empty [] or unknown keys like delete:/update:,
            // and Ref lines only carry these two attributes — so removing the
            // whole bracket is safe and produces clean Ref statements.
            dbmlText = dbmlText.replace(/^(Ref:[^\[]+)\[[^\]]*\]/gm, "$1").trimEnd();

            // ── 2. Parse ────────────────────────────────────────────────
            const database: any = Parser.parse(dbmlText, "dbml");
            const modelName = database.project ? database.project.name || "ImportedModel" : "ImportedModel";

            // ── 3. Collect raw tables & inline refs ─────────────────────
            interface IRawTable {
                name: string;
                fields: any[];
                note: string;
                seedHeaders: string[];
                seedTuples: string[][];
            }
            interface IRawRef {
                from: string;
                fromField: string;
                to: string;
                toField: string;
                name: string;
                isStateRef: boolean;
            }

            const rawTables: IRawTable[] = [];
            const rawRefs: IRawRef[] = [];

            for (const table of database.schemas[0].tables) {
                const fields: any[] = [];
                for (const col of table.fields) {
                    const isPk = col.pk || false;
                    const isAutoIncrement = col.increment || false;
                    const isRequired = col.not_null || false;
                    const typeName = mapDataType(col.type.type_name);
                    const length = extractLength(col.type.type_name);

                    let desc = col.note;
                    let defValue: string | undefined;
                    if (col.dbdefault && col.dbdefault.value)
                        defValue = String(col.dbdefault.value);

                    fields.push({
                        ID: XGuid.NewValue(),
                        Name: col.name,
                        DataType: typeName,
                        Length: length,
                        IsPrimaryKey: isPk,
                        IsAutoIncrement: isAutoIncrement,
                        IsRequired: isRequired,
                        DefaultValue: defValue,
                        Description: desc
                    });
                }

                // Parse Note + @seed
                let seedHeaders: string[] = [];
                let seedTuples: string[][] = [];
                let tblDesc = table.note || "";
                if (tblDesc.includes("@seed")) {
                    const parts = tblDesc.split("@seed");
                    tblDesc = parts[0].trim();
                    const seedStr = parts[1].trim();
                    if (seedStr) {
                        const lines = seedStr.split("\n").filter((l: string) => l.includes("|"));
                        if (lines.length >= 2) {
                            seedHeaders = lines[0].split("|").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                            // skip separator line if it looks like |---|---|
                            const dataStart = /^[\s|:-]+$/.test(lines[1]) ? 2 : 1;
                            seedTuples = lines.slice(dataStart).map((l: string) =>
                                l.split("|").map((s: string) => s.trim()).filter((s: string) => s.length > 0)
                            );
                        }
                    }
                }

                rawTables.push({
                    name: table.name,
                    fields,
                    note: tblDesc,
                    seedHeaders,
                    seedTuples
                });
            }

            // Collect refs from both schema-level Ref blocks AND inline ref: > on columns.
            //
            // @dbml/core endpoint direction semantics:
            //   relation="*"  → the FK (many) side — the table that owns the foreign key column
            //   relation="1"  → the PK (one) side  — the table being referenced
            //   For ref: >  → ep0 is PK side ("1"), ep1 is FK side ("*")
            //   For ref: <  → ep0 is FK side ("*"), ep1 is PK side ("1")
            //   For ref: -  → both are "1" (one-to-one); use ep1 as FK source by convention
            for (const ref of (database.schemas[0].refs || [])) {
                const ep0 = ref.endpoints[0];
                const ep1 = ref.endpoints[1];

                // FK endpoint = the one with relation="*"; fallback to ep1 for 1:1
                const fkEp = ep0.relation === "*" ? ep0
                    : ep1.relation === "*" ? ep1
                    : ep1; // one-to-one: both "1", ep1 is the inline-ref owner
                const pkEp = fkEp === ep0 ? ep1 : ep0;

                rawRefs.push({
                    from: fkEp.tableName,
                    fromField: fkEp.fieldNames[0],
                    to: pkEp.tableName,
                    toField: pkEp.fieldNames?.[0] || "ID",
                    name: ref.name || `FK_${pkEp.tableName}`,
                    isStateRef: false
                });
            }

            // ── 4. Detect state table ───────────────────────────────────
            let stateTableName: string | null = null;
            for (const rt of rawTables) {
                if (isStateTable(rt.name)) {
                    stateTableName = rt.name;
                    break;
                }
            }

            // Mark refs that point to the state table
            if (stateTableName) {
                for (const r of rawRefs) {
                    if (r.to === stateTableName) r.isStateRef = true;
                }
            }

            // ── 5. Group by prefix + assign colors ──────────────────────
            const prefixColorMap = new Map<string, string>();
            let colorIdx = 0;
            for (const rt of rawTables) {
                const prefix = extractPrefix(rt.name);
                if (!prefixColorMap.has(prefix)) {
                    if (isStateTable(rt.name)) {
                        prefixColorMap.set(prefix, STATE_TABLE_COLOR);
                    } else {
                        prefixColorMap.set(prefix, GROUP_COLORS[colorIdx % GROUP_COLORS.length]);
                        colorIdx++;
                    }
                }
            }

            // ── 6. Topological layout ───────────────────────────────────
            const edges = rawRefs.map(r => ({ from: r.from, to: r.to }));
            const layers = topologicalLayers(rawTables.map(t => ({ name: t.name })), edges);

            // Position tables layer-by-layer (left → right), stacked vertically
            const tablePositions = new Map<string, { x: number; y: number; h: number }>();
            let layerX = LAYER_BASE_X;
            for (const layer of layers) {
                let layerY = LAYER_BASE_Y;
                let maxWidth = TABLE_WIDTH;
                for (const name of layer) {
                    const rt = rawTables.find(t => t.name === name)!;
                    const h = TABLE_MIN_H + rt.fields.length * ROW_H;
                    tablePositions.set(name, { x: layerX, y: layerY, h });
                    layerY += h + GAP_Y;
                    maxWidth = Math.max(maxWidth, TABLE_WIDTH);
                }
                layerX += maxWidth + GAP_X;
            }

            // ── 7. Build ITableData[] ───────────────────────────────────
            const tables: ITableData[] = [];
            for (const rt of rawTables) {
                const pos = tablePositions.get(rt.name) || { x: LAYER_BASE_X, y: LAYER_BASE_Y, h: TABLE_MIN_H };
                const prefix = extractPrefix(rt.name);
                const fill = prefixColorMap.get(prefix) || GROUP_COLORS[0];

                tables.push({
                    ID: XGuid.NewValue(),
                    Name: rt.name,
                    Description: rt.note || undefined,
                    X: pos.x,
                    Y: pos.y,
                    Width: TABLE_WIDTH,
                    Height: pos.h,
                    FillProp: fill,
                    Fields: rt.fields,
                    SeedData: rt.seedTuples.length > 0 ? { Headers: rt.seedHeaders, Tuples: rt.seedTuples } : undefined
                });
            }

            // ── 8. Build regular references (excluding state refs) ──────
            const regularRefs: any[] = [];
            const stateRefs: { srcFieldID: string; tgtTableID: string; srcTableName: string }[] = [];

            for (const r of rawRefs) {
                const srcTable = tables.find(t => t.Name === r.from);
                const tgtTable = tables.find(t => t.Name === r.to);
                if (!srcTable || !tgtTable) continue;

                const srcField = srcTable.Fields.find(f => f.Name === r.fromField);
                if (!srcField) continue;

                if (r.isStateRef) {
                    stateRefs.push({
                        srcFieldID: srcField.ID,
                        tgtTableID: tgtTable.ID,
                        srcTableName: srcTable.Name
                    });
                } else {
                    regularRefs.push({
                        ID: XGuid.NewValue(),
                        Name: r.name,
                        SourceFieldID: srcField.ID,
                        TargetTableID: tgtTable.ID,
                        Points: []
                    });
                }
            }

            // ── 9. Assemble TFX document via bridge ─────────────────────
            const bridge = new XTFXBridge();
            bridge.Initialize();

            const doc = new tfx.XORMDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "ORM Model";
            doc.Initialize();

            const design = new tfx.XORMDesign();
            design.Name = modelName;
            doc.AppendChild(design);

            // Set StateControlTable on the design level
            if (stateTableName)
                design.StateControlTable = stateTableName;

            (bridge as any)._Controller.Document = doc;

            // Load normal tables + normal references through bridge
            bridge.LoadFromJson(
                { Design: design },
                { Name: modelName, Tables: tables, References: regularRefs }
            );

            // Apply Fill color to each created table
            const createdTables = design.GetTables?.() ?? [];
            for (const ct of createdTables) {
                const tData = tables.find(t => t.Name === ct.Name);
                if (tData && tData.FillProp) {
                    const colorMatch = /A=(\d+);R=(\d+);G=(\d+);B=(\d+)/.exec(tData.FillProp);
                    if (colorMatch) {
                        ct.Fill = new tfx.XColor(
                            parseInt(colorMatch[1]),
                            parseInt(colorMatch[2]),
                            parseInt(colorMatch[3]),
                            parseInt(colorMatch[4])
                        );
                    }
                }
            }

            // ── 10. Create XORMStateReferences for state FK fields ──────
            if (stateTableName && stateRefs.length > 0) {
                const stateTarget = createdTables.find(t => t.Name === stateTableName);
                if (stateTarget) {
                    for (const sr of stateRefs) {
                        // Find the tables that own the source field
                        const srcTable = createdTables.find(t => t.Name === sr.srcTableName);
                        if (!srcTable) continue;

                        // Find the field inside the created table by name
                        const srcFieldData = tables.find(t => t.Name === sr.srcTableName)?.Fields.find(f => f.ID === sr.srcFieldID);
                        if (!srcFieldData) continue;

                        const createdFields = srcTable.GetFields?.() ?? [];
                        const createdField = createdFields.find((f: any) => f.Name === srcFieldData.Name);
                        if (!createdField) continue;

                        const stateRef = new XORMStateReference();
                        stateRef.ID = XGuid.NewValue();
                        stateRef.Name = `FK_${srcTable.Name}_${stateTableName}`;
                        stateRef.Source = createdField.ID;
                        stateRef.Target = stateTarget.ID;
                        stateRef.Points = [
                            new XPoint(
                                srcTable.Bounds.Left + srcTable.Bounds.Width,
                                srcTable.Bounds.Top + srcTable.Bounds.Height / 2
                            ),
                            new XPoint(
                                stateTarget.Bounds.Left,
                                stateTarget.Bounds.Top + stateTarget.Bounds.Height / 2
                            )
                        ];
                        design.AppendChild(stateRef);

                        // Mark UseStateControl on the source table
                        srcTable.UseStateControl = true;
                    }
                }
            }

            // ── 11. Inject Seed Data into XORMDataSet/Tuples ────────────
            for (const tblData of tables) {
                if (!tblData.SeedData) continue;
                const dbTable = (bridge as any)._Controller.GetElementByID(tblData.ID) as tfx.XORMTable;
                if (!dbTable) continue;

                const ds = new tfx.XORMDataSet();
                ds.Name = tblData.Name + "Records";
                ds.ID = XGuid.NewValue();

                for (const row of tblData.SeedData.Tuples) {
                    const tuple = new tfx.XORMDataTuple();
                    tuple.ID = XGuid.NewValue();

                    tblData.SeedData.Headers.forEach((h: string, i: number) => {
                        const fld = tblData.Fields.find(f => f.Name === h);
                        if (fld) {
                            const mappedField = (dbTable.GetFields() as tfx.XORMField[]).find(
                                (f: tfx.XORMField) => f.Name === fld.Name
                            );
                            if (mappedField) {
                                const fv = new tfx.XFieldValue();
                                fv.FieldID = mappedField.ID;
                                fv.Value = row[i] || "";
                                tuple.AppendChild(fv);
                            }
                        }
                    });
                    ds.AppendChild(tuple);
                }
                dbTable.AppendChild(ds);
            }

            // ── 12. Serialize & save ────────────────────────────────────
            const xmlRaw = bridge.SaveOrmModelToText();

            let destPath = uri.fsPath.replace(/\.dbml$/i, ".dsorm");
            if (fs.existsSync(destPath)) {
                const result = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(destPath),
                    filters: { "DASE ORM Tool": ["dsorm"] }
                });
                if (!result) return;
                destPath = result.fsPath;
            }

            const destUri = vscode.Uri.file(destPath);
            await vscode.workspace.fs.writeFile(destUri, Buffer.from(xmlRaw, "utf8"));

            const tableCount = tables.length;
            const refCount = regularRefs.length + stateRefs.length;
            vscode.window.showInformationMessage(
                `✅ Imported ${tableCount} tables, ${refCount} references` +
                (stateTableName ? `, state table: ${stateTableName}` : "") +
                ` → ${path.basename(destUri.fsPath)}`
            );
            await vscode.commands.executeCommand("vscode.openWith", destUri, "Dase.ORMDesigner");

        } catch (e: any) {
            let errorMsg = e && e.message ? e.message : undefined;
            if (e && e.diags && Array.isArray(e.diags) && e.diags.length > 0) {
                errorMsg = e.diags.map((d: any) => d.message || String(d)).join(" | ");
            } else if (!errorMsg) {
                errorMsg = typeof e === "object" ? JSON.stringify(e) : String(e);
            }
            vscode.window.showErrorMessage("Failed to import DBML: " + errorMsg);
            console.error(e);
        }
    }
}
