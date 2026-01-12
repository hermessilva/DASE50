import { describe, it, expect } from "vitest";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XGuid } from "../src/Core/XGuid.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";

describe("XORMDocument Integration Tests", () => {
    it("should save and load document with tables preserving coordinates", () => {
        RegisterORMElements();
        
        // Create a new document
        const doc = new XORMDocument();
        doc.ID = XGuid.NewValue();
        doc.Name = "Integration Test Model";

        // Add tables with specific coordinates
        const table1 = doc.Design!.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Users" });
        const table2 = doc.Design!.CreateTable({ X: 400, Y: 300, Width: 200, Height: 150, Name: "Orders" });

        // Verify coordinates before save
        expect(table1.Bounds.Left).toBe(100);
        expect(table1.Bounds.Top).toBe(200);
        expect(table2.Bounds.Left).toBe(400);
        expect(table2.Bounds.Top).toBe(300);

        // Serialize
        const engine = XSerializationEngine.Instance;
        const saveResult = engine.Serialize(doc);

        expect(saveResult.Success).toBe(true);
        expect(saveResult.XmlOutput).toBeDefined();

        // Verify XML doesn't contain undefined
        expect(saveResult.XmlOutput).not.toContain("undefined");
        expect(saveResult.XmlOutput).toContain("X=100");
        expect(saveResult.XmlOutput).toContain("Y=200");
        expect(saveResult.XmlOutput).toContain("X=400");
        expect(saveResult.XmlOutput).toContain("Y=300");

        // Deserialize
        const loadResult = engine.Deserialize<XORMDocument>(saveResult.XmlOutput!);

        expect(loadResult.Success).toBe(true);
        expect(loadResult.Data).toBeDefined();

        const loadedDoc = loadResult.Data!;
        loadedDoc.Initialize();

        // Verify document structure
        expect(loadedDoc.Design).toBeDefined();
        expect(loadedDoc.Name).toBe("Integration Test Model");

        // Get tables
        const loadedTables = loadedDoc.Design!.GetTables();
        expect(loadedTables.length).toBe(2);

        // Verify coordinates were preserved
        const loadedTable1 = loadedTables.find(t => t.Name === "Users");
        const loadedTable2 = loadedTables.find(t => t.Name === "Orders");

        expect(loadedTable1).toBeDefined();
        expect(loadedTable2).toBeDefined();

        expect(loadedTable1!.Bounds.Left).toBe(100);
        expect(loadedTable1!.Bounds.Top).toBe(200);
        expect(loadedTable2!.Bounds.Left).toBe(400);
        expect(loadedTable2!.Bounds.Top).toBe(300);
    });

    it("should save and load document with tables and fields", () => {
        RegisterORMElements();
        
        const doc = new XORMDocument();
        doc.ID = XGuid.NewValue();
        doc.Name = "Test with Fields";

        const table = doc.Design!.CreateTable({ X: 150, Y: 250, Width: 200, Height: 150, Name: "Products" });
        const field1 = table.CreateField({ Name: "ProductID" });
        const field2 = table.CreateField({ Name: "ProductName" });

        // Serialize and deserialize
        const engine = XSerializationEngine.Instance;
        const xml = engine.Serialize(doc).XmlOutput!;
        
        expect(xml).not.toContain("undefined");

        const loadedDoc = engine.Deserialize<XORMDocument>(xml).Data!;
        loadedDoc.Initialize();

        const loadedTables = loadedDoc.Design!.GetTables();
        expect(loadedTables.length).toBe(1);

        const loadedTable = loadedTables[0];
        expect(loadedTable.Name).toBe("Products");
        expect(loadedTable.Bounds.Left).toBe(150);
        expect(loadedTable.Bounds.Top).toBe(250);

        const loadedFields = loadedTable.GetChildrenOfType(XORMField);
        expect(loadedFields.length).toBe(2);
        expect(loadedFields.map(f => f.Name)).toContain("ProductID");
        expect(loadedFields.map(f => f.Name)).toContain("ProductName");
    });

    it("should save and load document with references", () => {
        RegisterORMElements();
        
        const doc = new XORMDocument();
        doc.ID = XGuid.NewValue();

        const table1 = doc.Design!.CreateTable({ X: 50, Y: 100, Width: 200, Height: 150, Name: "Customers" });
        const table2 = doc.Design!.CreateTable({ X: 250, Y: 150, Width: 200, Height: 150, Name: "Orders" });

        const ref = doc.Design!.CreateReference({ 
            SourceID: table1.ID, 
            TargetID: table2.ID, 
            Name: "FK_Orders_Customers" 
        });

        // Serialize and deserialize
        const engine = XSerializationEngine.Instance;
        const xml = engine.Serialize(doc).XmlOutput!;

        expect(xml).not.toContain("undefined");

        const loadedDoc = engine.Deserialize<XORMDocument>(xml).Data!;
        loadedDoc.Initialize();

        const loadedRefs = loadedDoc.Design!.GetChildrenOfType(XORMReference);
        expect(loadedRefs.length).toBe(1);
        expect(loadedRefs[0].Name).toBe("FK_Orders_Customers");
    });

    it("should handle document with only one XORMDesign after deserialization", () => {
        RegisterORMElements();
        
        const doc = new XORMDocument();
        doc.ID = XGuid.NewValue();
        doc.Design!.CreateTable({ X: 75, Y: 125, Width: 200, Height: 150, Name: "TestTable" });

        const engine = XSerializationEngine.Instance;
        const xml = engine.Serialize(doc).XmlOutput!;

        const loadedDoc = engine.Deserialize<XORMDocument>(xml).Data!;
        loadedDoc.Initialize();

        // Should have only ONE XORMDesign after Initialize
        const designs = loadedDoc.ChildNodes.filter((node: any) => 
            node.constructor.name === "XORMDesign"
        );

        expect(designs.length).toBe(1);
        expect(loadedDoc.Design).toBeDefined();
        expect(loadedDoc.Design!.GetTables().length).toBe(1);
    });
});
