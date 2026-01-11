import { describe, it, expect } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XDocument } from "../src/Design/XDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";

describe("XORMDocument", () => {
    it("should be instantiable and initialize PDesign", () => {
        const doc = new XORMDocument();
        expect(doc).toBeDefined();
        expect(doc).toBeInstanceOf(XORMDocument);
        expect(doc).toBeInstanceOf(XDocument);
        expect(doc.Design).toBeDefined();
        expect(doc.Design).toBeInstanceOf(XORMDesign);
    });

    it("should append Design as a child", () => {
        const doc = new XORMDocument();
        expect(doc.ChildNodes.includes(doc.Design!)).toBe(true);
    });
});
