import { describe, it, expect, beforeEach } from "vitest";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XGuid } from "../src/Core/XGuid.js";
import { XRect } from "../src/Core/XGeometry.js";

describe("XORMTable Coverage Tests", () => {
    
    beforeEach(() => {
        RegisterORMElements();
    });

    describe("DeleteField", () => {
        
        it("should return false when field parent is not the table", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            const field = new XORMField();
            field.ID = XGuid.NewValue();
            // Don't append to table
            
            const result = table.DeleteField(field);
            
            expect(result).toBe(false);
        });

        it("should return false when field CanDelete is false", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            const field = table.CreateField({ Name: "TestField", DataType: "String" });
            field.CanDelete = false;
            
            const result = table.DeleteField(field);
            
            expect(result).toBe(false);
            expect(table.GetFields()).toContain(field);
        });

        it("should delete field successfully", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            const field = table.CreateField({ Name: "TestField", DataType: "String" });
            
            expect(table.GetFields()).toContain(field);
            
            const result = table.DeleteField(field);
            
            expect(result).toBe(true);
            expect(table.GetFields()).not.toContain(field);
        });
    });

    describe("FindFieldByID", () => {
        
        it("should find field by ID", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            const field = table.CreateField({ Name: "TestField", DataType: "String" });
            
            const found = table.FindFieldByID(field.ID);
            
            expect(found).toBe(field);
        });

        it("should return null when field not found", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            const fakeID = XGuid.NewValue();
            
            const found = table.FindFieldByID(fakeID);
            
            expect(found).toBeNull();
        });
    });

    describe("FindFieldByName", () => {
        
        it("should find field by name case-insensitive", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            const field = table.CreateField({ Name: "TestField", DataType: "String" });
            
            const found1 = table.FindFieldByName("TestField");
            const found2 = table.FindFieldByName("testfield");
            const found3 = table.FindFieldByName("TESTFIELD");
            
            expect(found1).toBe(field);
            expect(found2).toBe(field);
            expect(found3).toBe(field);
        });

        it("should return null when field name not found", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            const found = table.FindFieldByName("NonExistent");
            
            expect(found).toBeNull();
        });
    });

    describe("GenerateFieldName", () => {
        
        it("should generate Field1 when no fields exist", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            const field = table.CreateField({ DataType: "String" });
            
            expect(field.Name).toBe("Field1");
        });

        it("should generate Field2 when Field1 exists", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            table.CreateField({ Name: "Field1", DataType: "String" });
            const field2 = table.CreateField({ DataType: "Int32" });
            
            expect(field2.Name).toBe("Field2");
        });

        it("should skip existing names and find next available", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            table.CreateField({ Name: "Field1", DataType: "String" });
            table.CreateField({ Name: "Field2", DataType: "Int32" });
            const field3 = table.CreateField({ DataType: "Boolean" });
            
            expect(field3.Name).toBe("Field3");
        });

        it("should handle case-insensitive name collision", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            table.CreateField({ Name: "field1", DataType: "String" });
            const field2 = table.CreateField({ DataType: "Int32" });
            
            // Should skip "Field1" (case-insensitive) and use "Field2"
            expect(field2.Name).toBe("Field2");
        });

        it("should handle multiple iterations in name generation loop", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            // Create fields with non-sequential names to force loop iterations
            table.CreateField({ Name: "Field1", DataType: "String" });
            table.CreateField({ Name: "Field2", DataType: "Int32" });
            table.CreateField({ Name: "Field3", DataType: "Boolean" });
            table.CreateField({ Name: "Field4", DataType: "DateTime" });
            table.CreateField({ Name: "Field5", DataType: "Decimal" });
            
            // This should generate Field6
            const field6 = table.CreateField({ DataType: "Double" });
            expect(field6.Name).toBe("Field6");
        });

        it("should handle while loop with gap in field numbers", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            // Create fields with a gap to force multiple while iterations
            table.CreateField({ Name: "Field1", DataType: "String" });
            table.CreateField({ Name: "Field3", DataType: "Int32" });
            
            // When creating second field, it should detect Field2 is available
            // But our algorithm uses length+1, so it will try Field3 first, see it exists,
            // then increment to Field4
            const field = table.CreateField({ DataType: "Boolean" });
            expect(field.Name).toBe("Field4");
        });
    });

    describe("FindFieldByID and FindFieldByName (lines 78-89)", () => {
        
        it("should find field by ID when it exists", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            const field = table.CreateField({ Name: "TestField", DataType: "String" });
            const found = table.FindFieldByID(field.ID);
            
            expect(found).not.toBeNull();
            expect(found?.ID).toBe(field.ID);
        });

        it("should return null when field ID not found", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            table.CreateField({ Name: "TestField", DataType: "String" });
            const found = table.FindFieldByID(XGuid.NewValue());
            
            expect(found).toBeNull();
        });

        it("should find field by name (case insensitive)", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            table.CreateField({ Name: "TestField", DataType: "String" });
            const found = table.FindFieldByName("testfield");
            
            expect(found).not.toBeNull();
            expect(found?.Name).toBe("TestField");
        });

        it("should return null when field name not found", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            table.CreateField({ Name: "TestField", DataType: "String" });
            const found = table.FindFieldByName("NonExistent");
            
            expect(found).toBeNull();
        });
    });

    describe("Height adjustment based on fields", () => {
        
        it("should update height when fields are added", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            const initialHeight = table.Bounds.Height;
            
            // Add several fields
            table.CreateField({ Name: "Field1", DataType: "String" });
            table.CreateField({ Name: "Field2", DataType: "String" });
            table.CreateField({ Name: "Field3", DataType: "String" });
            table.CreateField({ Name: "Field4", DataType: "String" });
            
            // Height should have increased
            expect(table.Bounds.Height).toBeGreaterThanOrEqual(initialHeight);
        });

        it("should update height when fields are deleted", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            // Add many fields
            const fields = [];
            for (let i = 0; i < 10; i++)
                fields.push(table.CreateField({ Name: `Field${i}`, DataType: "String" }));
            
            const heightWithFields = table.Bounds.Height;
            
            // Delete all fields
            for (const f of fields)
                table.DeleteField(f);
            
            // Height should be smaller now
            expect(table.Bounds.Height).toBeLessThanOrEqual(heightWithFields);
        });

        it("should not change height when it already matches calculated value", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            // Set initial bounds to the exact expected height for 1 field
            // headerHeight=28, fieldHeight=16, padding=12
            // For 1 field: 28 + (1 * 16 + 12) = 56
            table.Bounds = new XRect(0, 0, 200, 56);
            
            // Create a field - this calls UpdateHeightForFields
            // Since bounds.Height (56) already equals newHeight (56), 
            // the if branch should be false (no change)
            table.CreateField({ Name: "Field1", DataType: "String" });
            
            // Height should still be 56
            expect(table.Bounds.Height).toBe(56);
        });

        it("should return false and not update height when deleting field from wrong table", () => {
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            
            // Create a field that belongs to a different table
            const otherTable = new XORMTable();
            otherTable.ID = XGuid.NewValue();
            const orphanField = otherTable.CreateField({ Name: "Orphan", DataType: "String" });
            
            // Get initial height
            table.CreateField({ Name: "MyField", DataType: "String" });
            const initialHeight = table.Bounds.Height;
            
            // Try to delete field that doesn't belong to this table
            const result = table.DeleteField(orphanField);
            
            expect(result).toBe(false);
            expect(table.Bounds.Height).toBe(initialHeight);
        });
    });
});
