import { describe, it, expect } from "vitest";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XRectangle } from "../src/Design/XRectangle.js";

describe("XORMTable", () => {
    it("should be instantiable", () => {
        const table = new XORMTable();
        expect(table).toBeDefined();
        expect(table).toBeInstanceOf(XORMTable);
        expect(table).toBeInstanceOf(XRectangle);
    });
});
