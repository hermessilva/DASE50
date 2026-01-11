import { describe, it, expect } from "vitest";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XField } from "../src/Design/XField.js";

describe("XORMField", () => {
    it("should be instantiable", () => {
        const field = new XORMField();
        expect(field).toBeDefined();
        expect(field).toBeInstanceOf(XORMField);
        expect(field).toBeInstanceOf(XField);
    });
});
