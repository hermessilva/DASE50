import fs from "node:fs";
import { XSerializationEngine } from "./dist/Data/XSerializationEngine.js";
import { RegisterORMElements } from "./dist/Designers/ORM/XORMRegistry.js";

RegisterORMElements();
const xml = fs.readFileSync("../DASE/samples/SYSx.dsorm", "utf8");
const engine = new XSerializationEngine();
const result = engine.Deserialize(xml);
if (!result.Success) {
    console.error("deserialize failed:", result.Message);
    process.exit(1);
}
const doc = result.Data;
doc.Initialize();
const design = doc.Design;
console.log(`tables=${design.GetTables().length} refs=${design.GetReferences().length}`);

const t0 = performance.now();
design.RouteAllLines();
const dt = performance.now() - t0;
const m = design.GetRoutingMetrics();
console.log(`route time: ${dt.toFixed(1)}ms`);
console.log("metrics:", JSON.stringify(m, null, 1));
