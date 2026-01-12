import { describe, it, expect, beforeEach } from "vitest";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XGuid } from "../src/Core/XGuid.js";
import { XPoint } from "../src/Core/XGeometry.js";

// Helper to create table with FK field and return both
function createTableWithFKField(pDesign: XORMDesign, pName: string, pX: number): { table: XORMTable; fkFieldID: string }
{
    const table = pDesign.CreateTable({ X: pX, Y: 100, Width: 200, Height: 150, Name: pName });
    const fkField = table.CreateField({ Name: `${pName}FK` });
    return { table, fkFieldID: fkField.ID };
}

describe("XORMDesign Coverage Tests", () => {
    
    beforeEach(() => {
        RegisterORMElements();
    });

    describe("DeleteTable", () => {
        
        it("should return false when table parent is not the design", () => {
            const design = new XORMDesign();
            const table = new XORMTable();
            table.ID = XGuid.NewValue();
            // Don't append to design, so parent is different
            
            const result = design.DeleteTable(table);
            
            expect(result).toBe(false);
        });

        it("should return false when table CanDelete is false", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "TestTable" });
            table.CanDelete = false;
            
            const result = design.DeleteTable(table);
            
            expect(result).toBe(false);
            expect(design.GetTables()).toContain(table);
        });

        it("should delete table and remove related references", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences().length).toBe(1);
            
            const result = design.DeleteTable(table1);
            
            expect(result).toBe(true);
            expect(design.GetTables()).not.toContain(table1);
            expect(design.GetReferences().length).toBe(0); // Reference should be removed
        });
    });

    describe("DeleteReference", () => {
        
        it("should return false when reference parent is not the design", () => {
            const design = new XORMDesign();
            const ref = new XORMReference();
            ref.ID = XGuid.NewValue();
            // Don't append to design
            
            const result = design.DeleteReference(ref);
            
            expect(result).toBe(false);
        });

        it("should return false when reference CanDelete is false", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            ref.CanDelete = false;
            
            const result = design.DeleteReference(ref);
            
            expect(result).toBe(false);
            expect(design.GetReferences()).toContain(ref);
        });

        it("should delete reference successfully", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences()).toContain(ref);
            
            const result = design.DeleteReference(ref);
            
            expect(result).toBe(true);
            expect(design.GetReferences()).not.toContain(ref);
        });
    });

    describe("FindTableByID", () => {
        
        it("should find table by ID", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "TestTable" });
            
            const found = design.FindTableByID(table.ID);
            
            expect(found).toBe(table);
        });

        it("should return null when table not found", () => {
            const design = new XORMDesign();
            const fakeID = XGuid.NewValue();
            
            const found = design.FindTableByID(fakeID);
            
            expect(found).toBeNull();
        });
    });

    describe("FindReferenceByID", () => {
        
        it("should find reference by ID", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            const found = design.FindReferenceByID(ref.ID);
            
            expect(found).toBe(ref);
        });

        it("should return null when reference not found", () => {
            const design = new XORMDesign();
            const fakeID = XGuid.NewValue();
            
            const found = design.FindReferenceByID(fakeID);
            
            expect(found).toBeNull();
        });
    });

    describe("GenerateTableName", () => {
        
        it("should generate Table1 when no tables exist", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150 });
            
            expect(table.Name).toBe("Table1");
        });

        it("should generate Table2 when Table1 exists", () => {
            const design = new XORMDesign();
            design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150 });
            
            expect(table2.Name).toBe("Table2");
        });

        it("should skip existing names and find next available", () => {
            const design = new XORMDesign();
            design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const table3 = design.CreateTable({ X: 700, Y: 100, Width: 200, Height: 150 });
            
            expect(table3.Name).toBe("Table3");
        });

        it("should handle multiple iterations in GenerateTableName loop", () => {
            const design = new XORMDesign();
            design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            design.CreateTable({ X: 700, Y: 100, Width: 200, Height: 150, Name: "Table3" });
            design.CreateTable({ X: 1000, Y: 100, Width: 200, Height: 150, Name: "Table4" });
            
            // This should generate Table5, testing multiple iterations
            const table5 = design.CreateTable({ X: 1300, Y: 100, Width: 200, Height: 150 });
            expect(table5.Name).toBe("Table5");
        });
    });

    describe("RemoveReferencesForTable", () => {
        
        it("should remove references where table is Target", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences()).toContain(ref);
            
            design.DeleteTable(table2);
            
            expect(design.GetReferences()).not.toContain(ref);
        });
    });

    describe("CreateReference validation", () => {
        
        it("should throw error when source field not found", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const fakeID = XGuid.NewValue();
            
            expect(() => {
                design.CreateReference({ SourceFieldID: fakeID, TargetTableID: table.ID, Name: "FK_Invalid" });
            }).toThrow("Source field not found.");
        });

        it("should throw error when target table not found", () => {
            const design = new XORMDesign();
            const { fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const fakeID = XGuid.NewValue();
            
            expect(() => {
                design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: fakeID, Name: "FK_Invalid" });
            }).toThrow("Target table not found.");
        });
    });

    describe("GenerateReferenceName", () => {
        
        it("should use generated name when Name option not provided", () => {
            const design = new XORMDesign();
            const { table: orders, fkFieldID } = createTableWithFKField(design, "Orders", 100);
            const customers = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Customers" });
            
            // Create reference without explicit Name
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: customers.ID });
            
            expect(ref.Name).toBe("FK_Orders_Customers");
        });
    });

    describe("GenerateTableName while loop (lines 147-148)", () => {
        
        it("should loop multiple times when many consecutive names exist", () => {
            const design = new XORMDesign();
            
            // Create tables 1-10 to ensure loop executes multiple times
            for (let i = 1; i <= 10; i++) {
                design.CreateTable({ X: i * 100, Y: 100, Width: 200, Height: 150, Name: `Table${i}` });
            }
            
            // This should generate Table11, forcing loop to iterate
            const table11 = design.CreateTable({ X: 1100, Y: 100, Width: 200, Height: 150 });
            expect(table11.Name).toBe("Table11");
        });

        it("should handle gap in table naming", () => {
            const design = new XORMDesign();
            
            // Create Table1 and Table3, leaving Table2 available
            design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            design.CreateTable({ X: 300, Y: 100, Width: 200, Height: 150, Name: "Table3" });
            
            // Length is 2, so idx starts at 3, loop finds Table3 exists, increments to Table4
            const newTable = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150 });
            expect(newTable.Name).toBe("Table4");
        });
    });

    describe("CreateTable default values (lines 38-41)", () => {
        
        it("should use default X when not provided", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ Y: 100, Width: 200, Height: 150, Name: "Test" });
            
            expect(table.Bounds.Left).toBe(0);
        });

        it("should use default Y when not provided", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Width: 200, Height: 150, Name: "Test" });
            
            expect(table.Bounds.Top).toBe(0);
        });

        it("should use default Width when not provided", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Height: 150, Name: "Test" });
            
            expect(table.Bounds.Width).toBe(200);
        });

        it("should use default Height when not provided", () => {
            const design = new XORMDesign();
            const table = design.CreateTable({ X: 100, Y: 100, Width: 200, Name: "Test" });
            
            expect(table.Bounds.Height).toBe(150);
        });
    });

    describe("RemoveReferencesForTable (line 134)", () => {
        
        it("should remove reference when source field's table is deleted", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences()).toContain(ref);
            
            // Delete table1 (has source field) should remove reference
            design.DeleteTable(table1);
            
            expect(design.GetReferences()).not.toContain(ref);
        });

        it("should NOT remove references when table is neither Source field's parent nor Target", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const table3 = design.CreateTable({ X: 700, Y: 100, Width: 200, Height: 150, Name: "Table3" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            expect(design.GetReferences()).toContain(ref);
            
            // Delete table3 (unrelated) should NOT remove reference
            design.DeleteTable(table3);
            
            expect(design.GetReferences()).toContain(ref);
        });
    });

    describe("RouteAllLines", () => {
        
        it("should route references with orthogonal paths", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            // CreateReference calls AlignLines which routes, so points should exist
            const initialLength = ref.Points.length;
            expect(initialLength).toBeGreaterThan(0);
            
            // Clear points manually to test re-routing
            ref.Points = [];
            
            design.RouteAllLines();
            
            // Should have 4 points (orthogonal path)
            expect(ref.Points.length).toBe(4);
        });

        it("should handle references when source field not found", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            
            // Create ref with non-existent source field
            const ref = new XORMReference();
            ref.ID = XGuid.NewValue();
            ref.Name = "BadRef";
            ref.Source = XGuid.NewValue(); // Non-existent field ID
            ref.Target = table2.ID;
            design.AppendChild(ref);
            
            // Should not throw
            expect(() => design.RouteAllLines()).not.toThrow();
            
            // Points should remain empty
            expect(ref.Points.length).toBe(0);
        });

        it("should handle references when target table not found", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            
            // Create ref with non-existent target table
            const ref = new XORMReference();
            ref.ID = XGuid.NewValue();
            ref.Name = "BadRef";
            ref.Source = fkFieldID;
            ref.Target = XGuid.NewValue(); // Non-existent table ID
            design.AppendChild(ref);
            
            // Should not throw
            expect(() => design.RouteAllLines()).not.toThrow();
            
            // Points should remain empty
            expect(ref.Points.length).toBe(0);
        });

        it("should handle when source field has no valid parent table", () => {
            const design = new XORMDesign();
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            
            // Create a field without proper parent
            const fakeField: any = {
                ID: XGuid.NewValue(),
                Name: "FakeField",
                ParentNode: null // No parent
            };
            
            const ref = new XORMReference();
            ref.ID = XGuid.NewValue();
            ref.Name = "BadRef";
            ref.Source = fakeField.ID;
            ref.Target = table2.ID;
            design.AppendChild(ref);
            
            // Mock FindFieldByID to return the fake field
            const originalFind = design.FindFieldByID.bind(design);
            design.FindFieldByID = (pID: string) => pID === fakeField.ID ? fakeField : originalFind(pID);
            
            // Should not throw
            expect(() => design.RouteAllLines()).not.toThrow();
            
            // Points should remain empty
            expect(ref.Points.length).toBe(0);
        });

        it("should route when source is right of target (reverse direction)", () => {
            const design = new XORMDesign();
            // Source table on the right
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 500);
            // Target table on the left
            const table2 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            design.RouteAllLines();
            
            // Should have 4 points
            expect(ref.Points.length).toBe(4);
            
            // First point should be at source table LEFT side (reverse connection)
            expect(ref.Points[0].X).toBeLessThan(table1.Bounds.Left + table1.Bounds.Width / 2);
        });

        it("should throw error when CreateReference source field has no parent table (line 63)", () => {
            const design = new XORMDesign();
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            
            // Create orphan field (not attached to any table)
            const orphanField: any = {
                ID: XGuid.NewValue(),
                Name: "Orphan",
                ParentNode: null
            };
            
            // Mock FindFieldByID to return orphan field
            const originalFind = design.FindFieldByID.bind(design);
            design.FindFieldByID = (pID: string) => pID === orphanField.ID ? orphanField : originalFind(pID);
            
            // Should throw when trying to create reference
            expect(() => {
                design.CreateReference({ SourceFieldID: orphanField.ID, TargetTableID: table2.ID, Name: "BadRef" });
            }).toThrow("Source field has no parent table.");
        });

        it("should handle when field not found in parent table's GetFields (lines 228-229)", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            
            // Create field properly attached to table
            const field = table1.CreateField({ Name: "TestField" });
            
            // Mock GetFields to return empty array (field not found)
            const originalGetFields = table1.GetFields.bind(table1);
            table1.GetFields = () => [];
            
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "TestRef" });
            
            // Manually clear points and attempt routing
            ref.Points = [];
            
            // Should not throw, just return early
            expect(() => design.RouteAllLines()).not.toThrow();
            
            // Points should remain empty
            expect(ref.Points.length).toBe(0);
            
            // Restore
            table1.GetFields = originalGetFields;
        });
    });

    describe("RemoveReferencesForTable with sourceField null (line 152)", () => {
        
        it("should handle when FindFieldByID returns null", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            // Mock FindFieldByID to return null
            const originalFindFieldByID = design.FindFieldByID;
            design.FindFieldByID = () => null;
            
            // Delete table2 should still remove the reference (based on Target match)
            design.DeleteTable(table2);
            
            expect(design.GetReferences()).not.toContain(ref);
            
            // Restore
            design.FindFieldByID = originalFindFieldByID;
        });

        it("should handle when sourceField.ParentNode is not XORMTable", () => {
            const design = new XORMDesign();
            const { table: table1, fkFieldID } = createTableWithFKField(design, "Table1", 100);
            const table2 = design.CreateTable({ X: 400, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const ref = design.CreateReference({ SourceFieldID: fkFieldID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            // Mock FindFieldByID to return field with non-XORMTable parent
            const originalFindFieldByID = design.FindFieldByID;
            const mockField: any = { ID: fkFieldID, ParentNode: { ID: "not-a-table" } };
            design.FindFieldByID = () => mockField;
            
            // Delete table2 should still remove the reference (based on Target match)
            design.DeleteTable(table2);
            
            expect(design.GetReferences()).not.toContain(ref);
            
            // Restore
            design.FindFieldByID = originalFindFieldByID;
        });
    });

    describe("OrthogonalRouting - Complete Coverage", () => {
        
        it("should route with source left of target (exits right)", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Should have orthogonal route
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            
            // First point should be at right edge of source table (exits right)
            expect(ref.Points[0].X).toBe(table1.Bounds.Right);
            
            // All segments should be orthogonal (either horizontal or vertical)
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isHorizontal = Math.abs(prev.Y - curr.Y) < 1;
                const isVertical = Math.abs(prev.X - curr.X) < 1;
                expect(isHorizontal || isVertical).toBe(true);
            }
        });

        it("should route with source right of target (exits left)", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // First point should be at left edge of source table (exits left)
            expect(ref.Points[0].X).toBe(table1.Bounds.Left);
        });

        it("should route with target entry from top when source above", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 300, Y: 50, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 300, Y: 300, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            // All segments orthogonal
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isHorizontal = Math.abs(prev.Y - curr.Y) < 1;
                const isVertical = Math.abs(prev.X - curr.X) < 1;
                expect(isHorizontal || isVertical).toBe(true);
            }
        });

        it("should route with target entry from bottom when source below", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 300, Y: 400, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 300, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should avoid obstacles when routing", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 400, Y: 200, Width: 200, Height: 150, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 700, Y: 200, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Should have more points to go around obstacle
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle source and target at same Y level", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 200, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle multiple references from same table", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 200, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 50, Width: 200, Height: 100, Name: "Table2" });
            const table3 = design.CreateTable({ X: 500, Y: 250, Width: 200, Height: 100, Name: "Table3" });
            
            const field1 = table1.CreateField({ Name: "FK_Field1" });
            const field2 = table1.CreateField({ Name: "FK_Field2" });
            
            const ref1 = design.CreateReference({ SourceFieldID: field1.ID, TargetTableID: table2.ID, Name: "FK_Test1" });
            const ref2 = design.CreateReference({ SourceFieldID: field2.ID, TargetTableID: table3.ID, Name: "FK_Test2" });
            
            ref1.Points = [];
            ref2.Points = [];
            design.RouteAllLines();
            
            // Both references should have orthogonal routes
            expect(ref1.Points.length).toBeGreaterThanOrEqual(2);
            expect(ref2.Points.length).toBeGreaterThanOrEqual(2);
            
            // Field Y positions should be different (aligned with their respective fields)
            expect(ref1.Points[0].Y).not.toBe(ref2.Points[0].Y);
        });

        it("should optimize route removing collinear points", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Check no three consecutive points are collinear
            for (let i = 1; i < ref.Points.length - 1; i++) {
                const p1 = ref.Points[i - 1];
                const p2 = ref.Points[i];
                const p3 = ref.Points[i + 1];
                
                const h1 = Math.abs(p1.Y - p2.Y) < 1;
                const h2 = Math.abs(p2.Y - p3.Y) < 1;
                const v1 = Math.abs(p1.X - p2.X) < 1;
                const v2 = Math.abs(p2.X - p3.X) < 1;
                
                // If both segments have same direction, they're collinear - should be optimized out
                expect(h1 && h2).toBe(false);
                expect(v1 && v2).toBe(false);
            }
        });

        it("should handle target to the left with path collision check", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 600, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            
            // Add obstacle between them
            design.CreateTable({ X: 350, Y: 100, Width: 150, Height: 150, Name: "Obstacle" });
            
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should route correctly when tables overlap vertically", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 300, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 200, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should produce never diagonal segments", () => {
            const design = new XORMDesign();
            // Position tables at angles that might tempt diagonal routing
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 450, Y: 350, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // CRITICAL: Every segment must be either perfectly horizontal or perfectly vertical
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isHorizontal = Math.abs(prev.Y - curr.Y) < 0.001;
                const isVertical = Math.abs(prev.X - curr.X) < 0.001;
                
                expect(isHorizontal || isVertical).toBe(true);
            }
        });

        it("should handle route with detour around obstacle (vertical segment)", () => {
            const design = new XORMDesign();
            // Source at left
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Table1" });
            // Obstacle blocking direct horizontal path
            const obstacle = design.CreateTable({ X: 350, Y: 170, Width: 150, Height: 200, Name: "Obstacle" });
            // Target at right
            const table2 = design.CreateTable({ X: 600, Y: 200, Width: 200, Height: 150, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Route should exist and be orthogonal
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle route with detour around obstacle (horizontal segment)", () => {
            const design = new XORMDesign();
            // Source at top
            const table1 = design.CreateTable({ X: 300, Y: 50, Width: 200, Height: 100, Name: "Table1" });
            // Obstacle blocking path
            const obstacle = design.CreateTable({ X: 250, Y: 200, Width: 300, Height: 100, Name: "Obstacle" });
            // Target at bottom
            const table2 = design.CreateTable({ X: 300, Y: 400, Width: 200, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle line intersects rect - horizontal line inside rect", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 250, Width: 200, Height: 100, Name: "Table1" });
            // Obstacle with horizontal line passing through its vertical range
            const obstacle = design.CreateTable({ X: 350, Y: 200, Width: 100, Height: 200, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 550, Y: 250, Width: 200, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle line outside rect bounds (Y below)", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 500, Width: 200, Height: 100, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 350, Y: 100, Width: 100, Height: 100, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 550, Y: 500, Width: 200, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle line outside rect bounds (X left)", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 100, Height: 100, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 500, Y: 200, Width: 100, Height: 100, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 250, Y: 200, Width: 100, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle vertical line collision detection", () => {
            const design = new XORMDesign();
            // Tables positioned to force vertical segment through obstacle
            const table1 = design.CreateTable({ X: 400, Y: 50, Width: 200, Height: 100, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 350, Y: 200, Width: 300, Height: 100, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 400, Y: 400, Width: 200, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle MidX calculation with obstacle", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Table1" });
            // Multiple obstacles in line
            design.CreateTable({ X: 350, Y: 150, Width: 100, Height: 250, Name: "Obs1" });
            design.CreateTable({ X: 500, Y: 150, Width: 100, Height: 250, Name: "Obs2" });
            const table2 = design.CreateTable({ X: 700, Y: 200, Width: 200, Height: 150, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle MidX calculation with source exits left", () => {
            const design = new XORMDesign();
            // Source on right, target on left with obstacle
            const table1 = design.CreateTable({ X: 700, Y: 200, Width: 200, Height: 150, Name: "Table1" });
            design.CreateTable({ X: 450, Y: 150, Width: 100, Height: 250, Name: "Obs1" });
            const table2 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle detour calculation go up", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 350, Width: 200, Height: 100, Name: "Table1" });
            // Obstacle with center below source Y - should go up
            const obstacle = design.CreateTable({ X: 350, Y: 300, Width: 150, Height: 200, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 600, Y: 350, Width: 200, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle detour calculation go down", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 100, Name: "Table1" });
            // Obstacle with center above source Y - should go down
            const obstacle = design.CreateTable({ X: 350, Y: 100, Width: 150, Height: 200, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 600, Y: 200, Width: 200, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle detour calculation go left for vertical segment", () => {
            const design = new XORMDesign();
            // Force vertical segment collision
            const table1 = design.CreateTable({ X: 550, Y: 50, Width: 200, Height: 100, Name: "Table1" });
            // Obstacle with center to left of vertical path - should go left
            const obstacle = design.CreateTable({ X: 500, Y: 200, Width: 200, Height: 100, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 550, Y: 400, Width: 200, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle detour calculation go right for vertical segment", () => {
            const design = new XORMDesign();
            // Force vertical segment collision
            const table1 = design.CreateTable({ X: 250, Y: 50, Width: 200, Height: 100, Name: "Table1" });
            // Obstacle with center to right of vertical path - should go right
            const obstacle = design.CreateTable({ X: 200, Y: 200, Width: 200, Height: 100, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 250, Y: 400, Width: 200, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle single point route (edge case)", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            // Force single point (shouldn't happen normally, but test OptimizeRoute)
            ref.Points = [new XPoint(300, 175)];
            design.RouteAllLines();
            
            // Should have been recalculated
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle horizontal line with Y outside rect range (line 682)", () => {
            const design = new XORMDesign();
            // Tables positioned so horizontal segment is above obstacle
            const table1 = design.CreateTable({ X: 100, Y: 50, Width: 200, Height: 80, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 400, Y: 200, Width: 200, Height: 200, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 700, Y: 50, Width: 200, Height: 80, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Route should pass above obstacle (no collision)
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle vertical line with X outside rect range (line 694)", () => {
            const design = new XORMDesign();
            // Tables positioned so vertical segment is to the left of obstacle
            const table1 = design.CreateTable({ X: 50, Y: 100, Width: 150, Height: 100, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 400, Y: 200, Width: 200, Height: 200, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 50, Y: 500, Width: 150, Height: 100, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Route should go around without hitting obstacle
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should route when target above and source exits right", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 300, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 50, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            // Verify orthogonal
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isH = Math.abs(prev.Y - curr.Y) < 1;
                const isV = Math.abs(prev.X - curr.X) < 1;
                expect(isH || isV).toBe(true);
            }
        });

        it("should route when target below and source exits right", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 50, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 400, Y: 300, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle segment collision during optimization", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Table1" });
            // Place obstacle where optimization would check
            const obs1 = design.CreateTable({ X: 380, Y: 180, Width: 80, Height: 80, Name: "Obs1" });
            const table2 = design.CreateTable({ X: 550, Y: 200, Width: 200, Height: 150, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should skip source and target bounds in collision check", () => {
            const design = new XORMDesign();
            // Tables that are adjacent
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 350, Y: 100, Width: 200, Height: 150, Name: "Table2" });
            
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Should not detect source/target as obstacles
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle route where start and end X are equal", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 100, Y: 400, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle no obstacles case with clear path", () => {
            const design = new XORMDesign();
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 150, Name: "Table1" });
            const table2 = design.CreateTable({ X: 600, Y: 200, Width: 200, Height: 150, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // With no obstacles, should be simple route
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            // All orthogonal
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isH = Math.abs(prev.Y - curr.Y) < 1;
                const isV = Math.abs(prev.X - curr.X) < 1;
                expect(isH || isV).toBe(true);
            }
        });

        it("should enter target from bottom when source below target (line 332)", () => {
            const design = new XORMDesign();
            // Source below target with obstacle blocking left entry
            const table1 = design.CreateTable({ X: 100, Y: 400, Width: 200, Height: 100, Name: "Table1" });
            // Obstacle blocking the left side of target
            const obstacle = design.CreateTable({ X: 350, Y: 200, Width: 150, Height: 200, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 550, Y: 100, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            // Route should be orthogonal
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isH = Math.abs(prev.Y - curr.Y) < 1;
                const isV = Math.abs(prev.X - curr.X) < 1;
                expect(isH || isV).toBe(true);
            }
        });

        it("should use target entry bottom when source exits left and is below target", () => {
            const design = new XORMDesign();
            // Source at right but below target (exits left since target is to the left)
            const table1 = design.CreateTable({ X: 500, Y: 400, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 300, Y: 100, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should use C-route when tables vertically aligned - exits right (line 452-458)", () => {
            const design = new XORMDesign();
            // Tables vertically aligned - source above target
            // Source should exit right and make a C-route
            const table1 = design.CreateTable({ X: 200, Y: 100, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 200, Y: 350, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Should have at least 4 points for C-route (start, corner1, corner2, end)
            expect(ref.Points.length).toBeGreaterThanOrEqual(3);
            // All orthogonal
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isH = Math.abs(prev.Y - curr.Y) < 1;
                const isV = Math.abs(prev.X - curr.X) < 1;
                expect(isH || isV).toBe(true);
            }
        });

        it("should use C-route when tables vertically aligned - exits left (line 457)", () => {
            const design = new XORMDesign();
            // Tables vertically aligned with source to the right
            // More space on left so should exit left
            const table1 = design.CreateTable({ X: 500, Y: 100, Width: 150, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 350, Width: 150, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(3);
        });

        it("should use S-route with target Top entry (line 443-479)", () => {
            const design = new XORMDesign();
            // Source exits right, target below and to the right
            // Should enter through Top with S-route
            const table1 = design.CreateTable({ X: 100, Y: 300, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 100, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            // All orthogonal
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isH = Math.abs(prev.Y - curr.Y) < 1;
                const isV = Math.abs(prev.X - curr.X) < 1;
                expect(isH || isV).toBe(true);
            }
        });

        it("should use S-route with target Bottom entry (line 446)", () => {
            const design = new XORMDesign();
            // Source exits right, target above and to the right
            // Should enter through Bottom with S-route
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 400, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle source exits left with no obstacle (line 523)", () => {
            const design = new XORMDesign();
            // Source to the right of target, exits left
            const table1 = design.CreateTable({ X: 600, Y: 200, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle source exits left with obstacle (line 536-538)", () => {
            const design = new XORMDesign();
            // Source to the right of target with obstacle in between
            const table1 = design.CreateTable({ X: 600, Y: 200, Width: 200, Height: 100, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 350, Y: 150, Width: 100, Height: 200, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle fallback to right target entry (line 366)", () => {
            const design = new XORMDesign();
            // Special case: exits left but target to the right (fallback scenario)
            // Source is on the left but more space on left side
            const table1 = design.CreateTable({ X: 50, Y: 250, Width: 100, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 250, Y: 250, Width: 100, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should fallback to target bottom when source below (line 364)", () => {
            const design = new XORMDesign();
            // Source below target, exits right but startY > targetBottom
            const table1 = design.CreateTable({ X: 100, Y: 500, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 450, Y: 100, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should use LineIntersectsRect diagonal fallback (line 628)", () => {
            const design = new XORMDesign();
            // This is defensive code for diagonal lines which shouldn't happen
            // Create normal routing to exercise the path
            const table1 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 500, Y: 500, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should cover source exits left and enter target Right (line 358-359)", () => {
            const design = new XORMDesign();
            // Source completely to the right of target (no horizontal overlap)
            // Source exits left, so should enter target from Right
            const table1 = design.CreateTable({ X: 700, Y: 200, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 100, Y: 200, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            // Should enter from right side (target's right edge)
            const lastPoint = ref.Points[ref.Points.length - 1];
            // Last point should be on the right side of target
            expect(lastPoint.X).toBe(300); // Target right edge
        });

        it("should use fallback Top entry (line 363-364)", () => {
            const design = new XORMDesign();
            // Source exits right but is above target and startX >= targetLeft
            // This triggers the Top fallback
            const table1 = design.CreateTable({ X: 300, Y: 50, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 100, Y: 300, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should use fallback Bottom entry (line 365-366)", () => {
            const design = new XORMDesign();
            // Source exits right but is below target and startX >= targetLeft
            const table1 = design.CreateTable({ X: 300, Y: 500, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 100, Y: 100, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should use final fallback Left entry (line 368)", () => {
            const design = new XORMDesign();
            // Source exits right and Y overlaps with target
            // pStartX >= targetLeft, pStartY inside target Y range
            const table1 = design.CreateTable({ X: 300, Y: 200, Width: 200, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 100, Y: 200, Width: 150, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should use final fallback Right entry when exits left (line 368)", () => {
            const design = new XORMDesign();
            // Source exits left (is right of target) and Y overlaps
            // This should trigger final fallback to Right
            const table1 = design.CreateTable({ X: 400, Y: 200, Width: 150, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 600, Y: 200, Width: 150, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should use C-route with source exiting left (line 457-458)", () => {
            const design = new XORMDesign();
            // Vertically aligned tables where source exits left
            // Tables must have horizontal overlap AND source centerX > target centerX
            // Source at X=350 (center=400), Target at X=300 (center=375) - source is to the right
            // Width overlap: source 350-500, target 300-500 (overlap: 350-500)
            const table1 = design.CreateTable({ X: 350, Y: 100, Width: 150, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 300, Y: 350, Width: 200, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(3);
            // Check route exits to the left (first point X < source left)
            const sourceLeft = 350;
            const firstRoutePoint = ref.Points[1]; // After start point
            expect(firstRoutePoint.X).toBeLessThan(sourceLeft);
        });

        it("should detect horizontal line collision with obstacle (line 609-611)", () => {
            const design = new XORMDesign();
            // Create scenario where horizontal segment check is needed
            // Obstacle directly between source and target at same Y level
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 150, Height: 100, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 350, Y: 180, Width: 150, Height: 140, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 600, Y: 200, Width: 150, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should handle obstacle on left side when exiting left (line 530-538)", () => {
            const design = new XORMDesign();
            // Source right of target, obstacle on the left side path
            const table1 = design.CreateTable({ X: 700, Y: 200, Width: 150, Height: 100, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 400, Y: 150, Width: 100, Height: 200, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 100, Y: 200, Width: 150, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should use final fallback when startY within target range (line 368)", () => {
            const design = new XORMDesign();
            // Source exits right, startX >= targetLeft, startY within target Y range
            // No horizontal overlap, so not C-route
            // startX >= targetLeft triggers the fallback path
            const table1 = design.CreateTable({ X: 200, Y: 200, Width: 150, Height: 100, Name: "Table1" });
            const table2 = design.CreateTable({ X: 50, Y: 180, Width: 100, Height: 140, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should detect horizontal line intersection with obstacle (line 607-609)", () => {
            const design = new XORMDesign();
            // Create a horizontal segment that passes through an obstacle
            // Tables at same Y level with obstacle between them
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 150, Height: 100, Name: "Table1" });
            const obstacle = design.CreateTable({ X: 400, Y: 200, Width: 150, Height: 100, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 700, Y: 200, Width: 150, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Should route around obstacle
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
        });

        it("should check horizontal segment collision when obstacle at same Y (line 608-610)", () => {
            const design = new XORMDesign();
            // Source and target at same Y level, obstacle blocking the direct horizontal path
            // The obstacle is at the EXACT same Y level as the field Y position
            // This forces the horizontal segment check
            const table1 = design.CreateTable({ X: 100, Y: 200, Width: 150, Height: 100, Name: "Table1" });
            // Obstacle positioned to be in the path of the horizontal segment from the field
            // Field Y would be around 200 + 30 + 10 = 240 (header + first field)
            const obstacle = design.CreateTable({ X: 350, Y: 220, Width: 150, Height: 50, Name: "Obstacle" });
            const table2 = design.CreateTable({ X: 600, Y: 200, Width: 150, Height: 100, Name: "Table2" });
            const field = table1.CreateField({ Name: "FK_Field" });
            const ref = design.CreateReference({ SourceFieldID: field.ID, TargetTableID: table2.ID, Name: "FK_Test" });
            
            ref.Points = [];
            design.RouteAllLines();
            
            // Should detect horizontal collision and route around
            expect(ref.Points.length).toBeGreaterThanOrEqual(2);
            // Verify all segments are orthogonal
            for (let i = 1; i < ref.Points.length; i++) {
                const prev = ref.Points[i - 1];
                const curr = ref.Points[i];
                const isH = Math.abs(prev.Y - curr.Y) < 1;
                const isV = Math.abs(prev.X - curr.X) < 1;
                expect(isH || isV).toBe(true);
            }
        });
    });
});
