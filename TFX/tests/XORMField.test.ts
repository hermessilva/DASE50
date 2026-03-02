import { describe, it, expect, vi } from "vitest";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XField } from "../src/Design/XField.js";

describe("XORMField", () => {
    it("should be instantiable", () => {
        const field = new XORMField();
        expect(field).toBeDefined();
        expect(field).toBeInstanceOf(XORMField);
        expect(field).toBeInstanceOf(XField);
    });

    it("should have default property values", () => {
        const field = new XORMField();
        expect(field.DataType).toBe("String");
        expect(field.Length).toBe(0);
        expect(field.IsPrimaryKey).toBe(false); // Regular fields are never PKs
        expect(field.IsRequired).toBe(true);
        expect(field.IsAutoIncrement).toBe(false);
        expect(field.DefaultValue).toBe("");
    });

    it("should allow getting and setting DataType", () => {
        const field = new XORMField();
        field.DataType = "Int32";
        expect(field.DataType).toBe("Int32");
        
        field.DataType = "DateTime";
        expect(field.DataType).toBe("DateTime");
    });

    it("should allow getting and setting Length", () => {
        const field = new XORMField();
        field.Length = 255;
        expect(field.Length).toBe(255);
        
        field.Length = 50;
        expect(field.Length).toBe(50);
    });

    it("should always return false for IsPrimaryKey on regular fields", () => {
        const field = new XORMField();
        // XORMField.IsPrimaryKey is now a getter-only that always returns false
        // Primary key fields must use XORMPKField class
        expect(field.IsPrimaryKey).toBe(false);
    });

    it("should allow getting and setting IsRequired", () => {
        const field = new XORMField();
        expect(field.IsRequired).toBe(true); // default is true

        field.IsRequired = false;
        expect(field.IsRequired).toBe(false);

        field.IsRequired = true;
        expect(field.IsRequired).toBe(true);
    });

    it("should allow getting and setting IsAutoIncrement", () => {
        const field = new XORMField();
        field.IsAutoIncrement = true;
        expect(field.IsAutoIncrement).toBe(true);
        
        field.IsAutoIncrement = false;
        expect(field.IsAutoIncrement).toBe(false);
    });

    it("should default IsFK to false and allow setting it to true", () => {
        const field = new XORMField();
        expect(field.IsFK).toBe(false);
        field.IsFK = true;
        expect(field.IsFK).toBe(true);
        field.IsFK = false;
        expect(field.IsFK).toBe(false);
    });

    it("should return true for IsForeignKey when IsFK is explicitly set", () => {
        const field = new XORMField();
        expect(field.IsForeignKey).toBe(false);
        field.IsFK = true;
        expect(field.IsForeignKey).toBe(true);
    });

    it("should allow getting and setting DefaultValue", () => {
        const field = new XORMField();
        field.DefaultValue = "test";
        expect(field.DefaultValue).toBe("test");
        
        field.DefaultValue = "another value";
        expect(field.DefaultValue).toBe("another value");
    });

    describe("DataType property", () => {
        it("should accept all common data type names", () => {
            const field = new XORMField();
            
            field.DataType = "String";
            expect(field.DataType).toBe("String");
            
            field.DataType = "Int32";
            expect(field.DataType).toBe("Int32");
            
            field.DataType = "Int64";
            expect(field.DataType).toBe("Int64");
            
            field.DataType = "Numeric";
            expect(field.DataType).toBe("Numeric");
            
            field.DataType = "Boolean";
            expect(field.DataType).toBe("Boolean");
            
            field.DataType = "DateTime";
            expect(field.DataType).toBe("DateTime");
            
            field.DataType = "Guid";
            expect(field.DataType).toBe("Guid");
            
            field.DataType = "Binary";
            expect(field.DataType).toBe("Binary");
            
            field.DataType = "Text";
            expect(field.DataType).toBe("Text");
        });
    });

    describe("Foreign Key detection", () => {
        it("should return null for GetReference when field has no parent", () => {
            const field = new XORMField();
            field.InitializeNew();
            
            expect(field.GetReference()).toBeNull();
            expect(field.IsForeignKey).toBe(false);
        });

        it("should return null for GetReference when field parent is not in design", () => {
            const table = new XORMTable();
            table.InitializeNew();
            
            const field = new XORMField();
            field.InitializeNew();
            table.AppendChild(field);
            
            expect(field.GetReference()).toBeNull();
            expect(field.IsForeignKey).toBe(false);
        });

        it("should return null for GetReference when field is not used in any reference", () => {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "Users" });
            const field = table.CreateField({ Name: "Email" });
            
            expect(field.GetReference()).toBeNull();
            expect(field.IsForeignKey).toBe(false);
        });

        it("should return reference when field is used as source in a reference", () => {
            const doc = new XORMDocument();
            const usersTable = doc.Design.CreateTable({ Name: "Users" });
            const ordersTable = doc.Design.CreateTable({ Name: "Orders" });
            const fkField = ordersTable.CreateField({ Name: "UserID", DataType: "Int32" });
            
            const ref = doc.Design.CreateReference({
                SourceFieldID: fkField.ID,
                TargetTableID: usersTable.ID,
                Name: "FK_Orders_Users"
            });
            
            expect(fkField.GetReference()).not.toBeNull();
            expect(fkField.GetReference()).toBe(ref);
            expect(fkField.IsForeignKey).toBe(true);
        });

        it("should return correct expected DataType from target table PKType", () => {
            const doc = new XORMDocument();
            const usersTable = doc.Design.CreateTable({ Name: "Users" });
            usersTable.PKType = "Guid";
            
            const ordersTable = doc.Design.CreateTable({ Name: "Orders" });
            const fkField = ordersTable.CreateField({ Name: "UserID", DataType: "Guid" });
            
            doc.Design.CreateReference({
                SourceFieldID: fkField.ID,
                TargetTableID: usersTable.ID
            });
            
            expect(fkField.GetExpectedDataType()).toBe("Guid");
        });

        it("should return null for GetExpectedDataType when field is not FK", () => {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "Users" });
            const field = table.CreateField({ Name: "Email" });
            
            expect(field.GetExpectedDataType()).toBeNull();
        });

        it("should return null for GetExpectedDataType when target table not found", () => {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "Orders" });
            const fkField = table.CreateField({ Name: "UserID" });
            
            // Create reference with invalid target
            const ref = doc.Design.CreateReference({
                SourceFieldID: fkField.ID,
                TargetTableID: table.ID // Self-ref for test
            });
            
            // Delete target table to simulate missing target
            doc.Design.DeleteTable(table);
            
            // Field is orphan now, GetExpectedDataType should handle gracefully
            expect(fkField.GetExpectedDataType()).toBeNull();
        });

        it("should return null for GetExpectedDataType when field parent is null (defensive)", () => {
            const field = new XORMField();
            expect(field.GetExpectedDataType()).toBeNull();
        });

        it("should return null for GetExpectedDataType when design is null (defensive)", () => {
            const table = new XORMTable();
            const field = new XORMField();
            table.AppendChild(field);
            expect(field.GetExpectedDataType()).toBeNull();
        });

        it("should cover defensive check for null table in GetExpectedDataType (line 96)", () => {
            const field = new XORMField();
            field.InitializeNew();
            
            // Create a mock reference to return
            const mockRef = new XORMReference();
            mockRef.ID = "mock-ref-id";
            
            // Mock GetReference to return a reference while ParentNode is null
            vi.spyOn(field, "GetReference").mockReturnValueOnce(mockRef);
            
            // ParentNode is null, so should hit line 96
            expect(field.GetExpectedDataType()).toBeNull();
        });

        it("should cover defensive check for null design in GetExpectedDataType (line 100)", () => {
            const table = new XORMTable();
            table.InitializeNew();
            const field = new XORMField();
            field.InitializeNew();
            table.AppendChild(field);
            
            // Create a mock reference to return
            const mockRef = new XORMReference();
            mockRef.ID = "mock-ref-id";
            
            // Mock GetReference to return a reference
            vi.spyOn(field, "GetReference").mockReturnValueOnce(mockRef);
            
            // table.ParentNode is null (not in a design), so should hit line 100
            expect(field.GetExpectedDataType()).toBeNull();
        });

        it("should cover defensive check for target table not found (line 104)", () => {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "Source" });
            const field = table.CreateField({ Name: "FK" });
            
            // Create a mock reference with non-existent target
            const mockRef = new XORMReference();
            mockRef.ID = "mock-ref-id";
            mockRef.Target = "non-existent-table-id";
            
            // Mock GetReference to return the mock reference
            vi.spyOn(field, "GetReference").mockReturnValueOnce(mockRef);
            
            // Target table doesn't exist, so should hit line 104
            expect(field.GetExpectedDataType()).toBeNull();
        });
    });

    describe("AllowedValues", () => {
        it("should default to empty string", () => {
            const field = new XORMField();
            expect(field.AllowedValues).toBe("");
            expect(field.AllowedValuesList).toEqual([]);
            expect(field.HasAllowedValues).toBe(false);
        });

        it("should store and retrieve a pipe-separated list", () => {
            const field = new XORMField();
            field.AllowedValues = "Active|Inactive|Pending";
            expect(field.AllowedValues).toBe("Active|Inactive|Pending");
        });

        it("should trim whitespace when setting AllowedValues", () => {
            const field = new XORMField();
            field.AllowedValues = "  Active|Inactive  ";
            expect(field.AllowedValues).toBe("Active|Inactive");
        });

        it("should parse AllowedValuesList correctly", () => {
            const field = new XORMField();
            field.AllowedValues = "Active|Inactive|Pending";
            expect(field.AllowedValuesList).toEqual(["Active", "Inactive", "Pending"]);
        });

        it("should trim individual entries in AllowedValuesList", () => {
            const field = new XORMField();
            field.AllowedValues = " Active | Inactive | Pending ";
            expect(field.AllowedValuesList).toEqual(["Active", "Inactive", "Pending"]);
        });

        it("should skip empty entries in AllowedValuesList", () => {
            const field = new XORMField();
            field.AllowedValues = "Active||Pending|";
            expect(field.AllowedValuesList).toEqual(["Active", "Pending"]);
        });

        it("should return empty list when AllowedValues is empty", () => {
            const field = new XORMField();
            field.AllowedValues = "";
            expect(field.AllowedValuesList).toEqual([]);
        });

        it("should report HasAllowedValues true when list is non-empty", () => {
            const field = new XORMField();
            field.AllowedValues = "A|B";
            expect(field.HasAllowedValues).toBe(true);
        });

        it("should report HasAllowedValues false when list is empty", () => {
            const field = new XORMField();
            expect(field.HasAllowedValues).toBe(false);
        });

        it("should report HasAllowedValues false when only separators remain", () => {
            const field = new XORMField();
            field.AllowedValues = "||";
            expect(field.HasAllowedValues).toBe(false);
        });

        describe("IsAllowedValue", () => {
            it("should return true for any value when no constraint is defined", () => {
                const field = new XORMField();
                expect(field.IsAllowedValue("anything")).toBe(true);
            });

            it("should return true when value is in the list", () => {
                const field = new XORMField();
                field.AllowedValues = "Active|Inactive|Pending";
                expect(field.IsAllowedValue("Active")).toBe(true);
                expect(field.IsAllowedValue("Inactive")).toBe(true);
                expect(field.IsAllowedValue("Pending")).toBe(true);
            });

            it("should return false when value is not in the list", () => {
                const field = new XORMField();
                field.AllowedValues = "Active|Inactive|Pending";
                expect(field.IsAllowedValue("Unknown")).toBe(false);
                expect(field.IsAllowedValue("active")).toBe(false); // case-sensitive
            });

            it("should be case-sensitive", () => {
                const field = new XORMField();
                field.AllowedValues = "Active";
                expect(field.IsAllowedValue("active")).toBe(false);
                expect(field.IsAllowedValue("ACTIVE")).toBe(false);
                expect(field.IsAllowedValue("Active")).toBe(true);
            });

            it("should handle numeric allowed values", () => {
                const field = new XORMField();
                field.AllowedValues = "1|2|3|4|5";
                expect(field.IsAllowedValue("3")).toBe(true);
                expect(field.IsAllowedValue("6")).toBe(false);
            });
        });

        describe("SetAllowedValuesList", () => {
            it("should set values from an array", () => {
                const field = new XORMField();
                field.SetAllowedValuesList(["Active", "Inactive", "Pending"]);
                expect(field.AllowedValues).toBe("Active|Inactive|Pending");
                expect(field.AllowedValuesList).toEqual(["Active", "Inactive", "Pending"]);
            });

            it("should de-duplicate entries", () => {
                const field = new XORMField();
                field.SetAllowedValuesList(["A", "B", "A", "C", "B"]);
                expect(field.AllowedValuesList).toEqual(["A", "B", "C"]);
            });

            it("should trim and skip empty entries", () => {
                const field = new XORMField();
                field.SetAllowedValuesList(["  Active  ", "", "  ", "Inactive"]);
                expect(field.AllowedValuesList).toEqual(["Active", "Inactive"]);
            });

            it("should clear the list when given an empty array", () => {
                const field = new XORMField();
                field.AllowedValues = "Active|Inactive";
                field.SetAllowedValuesList([]);
                expect(field.AllowedValues).toBe("");
                expect(field.HasAllowedValues).toBe(false);
            });
        });

        it("should be passed through CreateField options on XORMTable", () => {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "Status" });
            const field = table.CreateField({ Name: "State", AllowedValues: "Open|Closed|Pending" });
            expect(field.AllowedValues).toBe("Open|Closed|Pending");
            expect(field.HasAllowedValues).toBe(true);
        });

        it("should default to empty string when CreateField does not specify AllowedValues", () => {
            const doc = new XORMDocument();
            const table = doc.Design.CreateTable({ Name: "T" });
            const field = table.CreateField({ Name: "F" });
            expect(field.AllowedValues).toBe("");
            expect(field.HasAllowedValues).toBe(false);
        });
    });
});
