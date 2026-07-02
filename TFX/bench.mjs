// Routing benchmark: 100 tables / 300 random references (adversarial density).
// Usage: npm run build && node bench.mjs
import { XORMDesign } from "./dist/Designers/ORM/XORMDesign.js";

function buildGrid(cols, rows, fieldCount) {
    const design = new XORMDesign();
    const tables = [];
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
            const t = design.CreateTable({ Name: `T${r}_${c}`, X: c * 320, Y: r * 220, Width: 200, Height: 120 });
            for (let f = 0; f < fieldCount; f++) t.CreateField({ Name: `F${f}` });
            tables.push(t);
        }
    return { design, tables };
}

const { design, tables } = buildGrid(10, 10, 6);
let seed = 42, refCount = 0;
const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
while (refCount < 300) {
    const a = tables[next() % tables.length];
    const b = tables[next() % tables.length];
    if (a === b) continue;
    const field = a.GetFields()[refCount % 6];
    design.CreateReference({ SourceFieldID: field.ID, TargetTableID: b.ID });
    refCount++;
}

const start = performance.now();
design.RouteAllLines();
const total = performance.now() - start;

console.log(`total=${total.toFixed(1)}ms for ${tables.length} tables / ${refCount} refs`);
console.log("metrics:", JSON.stringify(design.GetRoutingMetrics()));
