// Routes a .dsorm model and reports quality metrics.
// Usage: node bench-model.mjs <path-to-dsorm> [--reroute]
import fs from "node:fs";
import { XSerializationEngine } from "./dist/Data/XSerializationEngine.js";
import { RegisterORMElements } from "./dist/Designers/ORM/XORMRegistry.js";

const file = process.argv[2];
RegisterORMElements();
const xml = fs.readFileSync(file, "utf8");
const engine = new XSerializationEngine();
const result = engine.Deserialize(xml);
if (!result.Success) {
    console.error("deserialize failed:", result.Message);
    process.exit(1);
}
const doc = result.Data;
doc.Initialize();
const design = doc.Design;
console.log(`model=${file} tables=${design.GetTables().length} refs=${design.GetReferences().length}`);

console.log("AS-LOADED metrics:", JSON.stringify(design.GetRoutingMetrics()));

const t0 = performance.now();
design.RouteAllLines();
const dt = performance.now() - t0;
console.log(`REROUTED in ${dt.toFixed(1)}ms:`, JSON.stringify(design.GetRoutingMetrics()));

// Per-route quality: bends and length vs Manhattan distance of endpoints.
let worstBends = 0, worstRatio = 0, over4 = 0, ratioOver = 0;
for (const ref of design.GetReferences()) {
    const pts = ref.Points;
    if (!pts || pts.length < 2) continue;
    let len = 0;
    for (let i = 1; i < pts.length; i++)
        len += Math.abs(pts[i].X - pts[i - 1].X) + Math.abs(pts[i].Y - pts[i - 1].Y);
    const manhattan = Math.abs(pts[pts.length - 1].X - pts[0].X) + Math.abs(pts[pts.length - 1].Y - pts[0].Y);
    const bends = pts.length - 2;
    const ratio = manhattan > 1 ? len / manhattan : 1;
    if (bends > worstBends) worstBends = bends;
    if (ratio > worstRatio) worstRatio = ratio;
    if (bends > 4) over4++;
    if (ratio > 1.3) ratioOver++;
}
console.log(`per-route: worstBends=${worstBends} routesOver4Bends=${over4} worstLenRatio=${worstRatio.toFixed(2)} routesOverRatio1.3=${ratioOver}`);

// Name the offenders
const tableName = id => design.GetTables().find(t => t.ID === id)?.Name ?? id;
const refDesc = ref => {
    const tgt = tableName(ref.Target);
    let srcTable = design.GetTables().find(t => t.GetFields().some(f => f.ID === ref.Source));
    return `${srcTable?.Name ?? ref.Source} -> ${tgt}`;
};
for (const ref of design.GetReferences()) {
    const pts = ref.Points;
    if (!pts || pts.length < 2) continue;
    let len = 0;
    for (let i = 1; i < pts.length; i++)
        len += Math.abs(pts[i].X - pts[i - 1].X) + Math.abs(pts[i].Y - pts[i - 1].Y);
    const manhattan = Math.abs(pts[pts.length - 1].X - pts[0].X) + Math.abs(pts[pts.length - 1].Y - pts[0].Y);
    const bends = pts.length - 2;
    const ratio = manhattan > 1 ? len / manhattan : 1;
    if (bends > 4 || ratio > 1.3)
        console.log(`  OFFENDER ${refDesc(ref)}: bends=${bends} ratio=${ratio.toFixed(2)} len=${len.toFixed(0)}`);
}
