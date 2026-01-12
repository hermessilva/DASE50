import { describe, it, expect } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XDocument } from "../src/Design/XDocument.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";

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

    it("should use deserialized Design after Initialize", () => {
        RegisterORMElements();
        
        // Create and serialize a document with a table
        const originalDoc = new XORMDocument();
        originalDoc.ID = "test-doc-id";
        originalDoc.Name = "Test Document";
        originalDoc.Design!.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Users" });
        
        const engine = XSerializationEngine.Instance;
        const serialized = engine.Serialize(originalDoc);
        expect(serialized.Success).toBe(true);
        
        // Deserialize and verify
        const result = engine.Deserialize<XORMDocument>(serialized.XmlOutput!);
        expect(result.Success).toBe(true);
        expect(result.Data).toBeDefined();
        
        const loadedDoc = result.Data!;
        expect(loadedDoc.Design).toBeDefined();
        expect(loadedDoc.Design!.GetTables().length).toBe(1);
        expect(loadedDoc.Design!.GetTables()[0].Name).toBe("Users");
    });
});
