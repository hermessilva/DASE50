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

    it("should have default Schema value", () => {
        const table = new XORMTable();
        expect(table.Schema).toBe("dbo");
    });

    it("should allow getting and setting Schema", () => {
        const table = new XORMTable();
        table.Schema = "custom";
        expect(table.Schema).toBe("custom");
        
        table.Schema = "admin";
        expect(table.Schema).toBe("admin");
    });
});
