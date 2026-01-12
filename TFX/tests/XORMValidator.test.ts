import { describe, it, expect } from "vitest";
import { XORMValidator } from "../src/Designers/ORM/XORMValidator.js";
import { XORMDocument } from "../src/Designers/ORM/XORMDocument.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XDesignerErrorSeverity } from "../src/Core/XValidation.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XORMValidator", () =>
{
    describe("Basic validation", () =>
    {
        it("should validate empty document", () =>
        {
            const doc = new XORMDocument();
            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            expect(issues.length).toBeGreaterThan(0);
        });

        it("should call GetDocumentID and GetDocumentName when validating", () =>
        {
            const doc = new XORMDocument();
            doc.ID = XGuid.NewValue();
            doc.Name = "TestDoc";
            doc.Design.Name = "TestDesign";

            const table = new XORMTable();
            table.Name = "";
            doc.Design.AppendChild(table);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Table name is required"));
            expect(error).toBeDefined();
        });

        it("should not warn when design has a proper name", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "MyDatabase";
            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const nameWarning = issues.find(i => i.Message.includes("Design name is not defined"));
            expect(nameWarning).toBeUndefined();
        });
    });

    describe("Table validation", () =>
    {
        it("should error when table has empty name", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "";
            doc.Design.AppendChild(table);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Table name is required"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(error?.ElementID).toBe(table.ID);
        });

        it("should pass when table has proper name", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.ElementID === table.ID && i.Severity === XDesignerErrorSeverity.Error);
            expect(error).toBeUndefined();
        });

        it("should error on duplicate table names (case insensitive)", () =>
        {
            const doc = new XORMDocument();
            const table1 = new XORMTable();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);

            const table2 = new XORMTable();
            table2.Name = "users";
            doc.Design.AppendChild(table2);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Duplicate table name"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(error?.ElementID).toBe(table2.ID);
        });

        it("should allow different table names", () =>
        {
            const doc = new XORMDocument();
            const table1 = new XORMTable();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);

            const table2 = new XORMTable();
            table2.Name = "Products";
            doc.Design.AppendChild(table2);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Duplicate table name"));
            expect(error).toBeUndefined();
        });
    });

    describe("Field validation", () =>
    {
        it("should error when field has empty name", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            const field = new XORMField();
            field.Name = "";
            table.AppendChild(field);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Field name is required"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(error?.ElementID).toBe(field.ID);
        });

        it("should pass when field has proper name", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            const field = new XORMField();
            field.Name = "Email";
            table.AppendChild(field);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.ElementID === field.ID && i.Severity === XDesignerErrorSeverity.Error);
            expect(error).toBeUndefined();
        });

        it("should error on duplicate field names in same table (case insensitive)", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            const field1 = new XORMField();
            field1.Name = "Email";
            table.AppendChild(field1);

            const field2 = new XORMField();
            field2.Name = "email";
            table.AppendChild(field2);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Duplicate field name"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(error?.ElementID).toBe(field2.ID);
            expect(error?.Message).toContain("Users");
        });

        it("should allow same field name in different tables", () =>
        {
            const doc = new XORMDocument();
            
            const table1 = new XORMTable();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);

            const field1 = new XORMField();
            field1.Name = "ID";
            table1.AppendChild(field1);

            const table2 = new XORMTable();
            table2.Name = "Products";
            doc.Design.AppendChild(table2);

            const field2 = new XORMField();
            field2.Name = "ID";
            table2.AppendChild(field2);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const errors = issues.filter(i => i.Message.includes("Duplicate field name"));
            expect(errors.length).toBe(0);
        });
    });

    describe("Reference validation", () =>
    {
        it("should error when reference has no source field", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            const ref = new XORMReference();
            ref.Name = "Ref1";
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Reference source field is not defined"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should error when reference has no target table", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            
            const field = new XORMField();
            field.Name = "FK";
            table.AppendChild(field);

            const ref = new XORMReference();
            ref.Name = "Ref1";
            ref.Source = field.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Reference target table is not defined"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should error when reference source field does not exist", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            const ref = new XORMReference();
            ref.Name = "Ref1";
            ref.Source = XGuid.NewValue();
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Reference source field not found"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should error when reference target table does not exist", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            
            const field = new XORMField();
            field.Name = "FK";
            table.AppendChild(field);

            const ref = new XORMReference();
            ref.Name = "Ref1";
            ref.Source = field.ID;
            ref.Target = XGuid.NewValue();
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.Message.includes("Reference target table not found"));
            expect(error).toBeDefined();
            expect(error?.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should warn when reference is self-referencing", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.InitializeNew();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            
            const field = new XORMField();
            field.InitializeNew();
            field.Name = "ParentID";
            table.AppendChild(field);

            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "SelfRef";
            ref.Source = field.ID;
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const warning = issues.find(i => i.Message.includes("Self-referencing relation"));
            expect(warning).toBeDefined();
            expect(warning?.Severity).toBe(XDesignerErrorSeverity.Warning);
            expect(warning?.ElementID).toBe(ref.ID);
        });

        it("should pass when reference has valid source field and target table", () =>
        {
            const doc = new XORMDocument();
            
            const table1 = new XORMTable();
            table1.InitializeNew();
            table1.Name = "Users";
            doc.Design.AppendChild(table1);

            const table2 = new XORMTable();
            table2.InitializeNew();
            table2.Name = "Orders";
            doc.Design.AppendChild(table2);
            
            const fkField = new XORMField();
            fkField.InitializeNew();
            fkField.Name = "UserID";
            table2.AppendChild(fkField);

            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "UserOrders";
            ref.Source = fkField.ID;
            ref.Target = table1.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const error = issues.find(i => i.ElementID === ref.ID && i.Severity === XDesignerErrorSeverity.Error);
            expect(error).toBeUndefined();
        });

        it("should handle when sourceField has no ParentNode (orphan field)", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.InitializeNew();
            table.Name = "Users";
            doc.Design.AppendChild(table);
            
            // Create orphan field (not attached to any table)
            const field = new XORMField();
            field.InitializeNew();
            field.Name = "OrphanField";

            // Create reference using the orphan field
            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "TestRef";
            ref.Source = field.ID;
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            // Mock FindFieldByID to return the orphan field
            const originalFindFieldByID = doc.Design.FindFieldByID;
            doc.Design.FindFieldByID = (pID: string) => pID === field.ID ? field : originalFindFieldByID.call(doc.Design, pID);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            // Should not warn about self-referencing because ParentNode is null/not XORMTable
            const warning = issues.find(i => i.Message.includes("Self-referencing relation"));
            expect(warning).toBeUndefined();

            // Restore
            doc.Design.FindFieldByID = originalFindFieldByID;
        });

        it("should handle when FindFieldByID returns null (line 118 else branch)", () =>
        {
            const doc = new XORMDocument();
            const table = new XORMTable();
            table.InitializeNew();
            table.Name = "Users";
            doc.Design.AppendChild(table);

            // Create reference with source field ID that doesn't exist
            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "TestRef";
            ref.Source = XGuid.NewValue(); // Non-existent field
            ref.Target = table.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            // Should not warn about self-referencing because sourceField is null
            const warning = issues.find(i => i.Message.includes("Self-referencing relation"));
            expect(warning).toBeUndefined();

            // But should have error about source field not found
            const error = issues.find(i => i.Message.includes("Reference source field not found"));
            expect(error).toBeDefined();
        });
    });

    describe("Complete scenario", () =>
    {
        it("should validate complete document with multiple tables, fields and references", () =>
        {
            const doc = new XORMDocument();
            doc.Design.Name = "ECommerce";
            
            const usersTable = new XORMTable();
            usersTable.InitializeNew();
            usersTable.Name = "Users";
            doc.Design.AppendChild(usersTable);

            const idField = new XORMField();
            idField.InitializeNew();
            idField.Name = "ID";
            idField.IsPrimaryKey = true;
            usersTable.AppendChild(idField);

            const emailField = new XORMField();
            emailField.InitializeNew();
            emailField.Name = "Email";
            usersTable.AppendChild(emailField);

            const ordersTable = new XORMTable();
            ordersTable.InitializeNew();
            ordersTable.Name = "Orders";
            doc.Design.AppendChild(ordersTable);

            const orderIDField = new XORMField();
            orderIDField.InitializeNew();
            orderIDField.Name = "ID";
            orderIDField.IsPrimaryKey = true;
            ordersTable.AppendChild(orderIDField);

            const userIDField = new XORMField();
            userIDField.InitializeNew();
            userIDField.Name = "UserID";
            ordersTable.AppendChild(userIDField);

            const ref = new XORMReference();
            ref.InitializeNew();
            ref.Name = "UserOrders";
            ref.Source = userIDField.ID;
            ref.Target = usersTable.ID;
            doc.Design.AppendChild(ref);

            const validator = new XORMValidator();
            const issues = validator.Validate(doc);

            const errors = issues.filter(i => i.Severity === XDesignerErrorSeverity.Error);
            expect(errors.length).toBe(0);
        });
    });
});
