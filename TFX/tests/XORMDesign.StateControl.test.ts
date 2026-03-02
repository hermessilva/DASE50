import { describe, it, expect } from "vitest";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XORMTable } from "../src/Designers/ORM/XORMTable.js";
import { XORMStateField } from "../src/Designers/ORM/XORMStateField.js";
import { XORMStateReference } from "../src/Designers/ORM/XORMStateReference.js";
import { XGuid } from "../src/Core/XGuid.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDesign(stateControlTable = "StatusTable"): XORMDesign
{
    const design = new XORMDesign();
    design.StateControlTable = stateControlTable;
    return design;
}

function makeTable(design: XORMDesign, name = "Orders"): XORMTable
{
    return design.CreateTable({ Name: name, X: 10, Y: 10 });
}

// ---------------------------------------------------------------------------
// XORMTable — new state-control helpers
// ---------------------------------------------------------------------------

describe("XORMTable — UseStateControl property and state-field helpers", () =>
{
    it("should default UseStateControl to false", () =>
    {
        const table = new XORMTable();
        expect(table.UseStateControl).toBe(false);
    });

    it("should get and set UseStateControl", () =>
    {
        const table = new XORMTable();
        table.UseStateControl = true;
        expect(table.UseStateControl).toBe(true);
        table.UseStateControl = false;
        expect(table.UseStateControl).toBe(false);
    });

    it("GetStateField should return null when no state field exists", () =>
    {
        const table = new XORMTable();
        expect(table.GetStateField()).toBeNull();
    });

    it("GetStateField should return the XORMStateField when present", () =>
    {
        const design = makeDesign();
        const table = makeTable(design);
        const stateField = table.CreateStateField("Int32", "StatusTableID");
        expect(table.GetStateField()).toBe(stateField);
        expect(table.GetStateField()).toBeInstanceOf(XORMStateField);
    });

    it("CreateStateField should append an XORMStateField child with correct properties", () =>
    {
        const design = makeDesign();
        const table = makeTable(design);
        const field = table.CreateStateField("Guid", "StatusTableID");

        expect(field).toBeInstanceOf(XORMStateField);
        expect(field.Name).toBe("StatusTableID");
        expect(field.DataType).toBe("Guid");
        expect(field.IsRequired).toBe(true);
        expect(XGuid.IsFullValue(field.ID)).toBe(true);
        expect(table.ChildNodes).toContain(field);
    });

    it("CreateStateField should update field indexes", () =>
    {
        const design = makeDesign();
        const table = makeTable(design);
        table.CreatePKField();
        const stateField = table.CreateStateField("Int32", "StatusTableID");
        // PK at index 0, state field at index 1
        expect(stateField.Index).toBe(1);
    });

    it("DeleteStateField should return false when no state field exists", () =>
    {
        const design = makeDesign();
        const table = makeTable(design);
        expect(table.DeleteStateField()).toBe(false);
    });

    it("DeleteStateField should remove the state field and return true", () =>
    {
        const design = makeDesign();
        const table = makeTable(design);
        table.CreateStateField("Int32", "StatusTableID");
        expect(table.GetStateField()).not.toBeNull();

        const result = table.DeleteStateField();
        expect(result).toBe(true);
        expect(table.GetStateField()).toBeNull();
    });

    it("DeleteStateField should update field indexes after removal", () =>
    {
        const design = makeDesign();
        const table = makeTable(design);
        table.CreatePKField();
        table.CreateField({ Name: "Name" });
        table.CreateStateField("Int32", "StatusTableID");

        table.DeleteStateField();
        // After removal the remaining fields should be re-indexed
        const fields = table.GetFields();
        for (let i = 0; i < fields.length; i++)
            expect(fields[i].Index).toBe(i);
    });
});

// ---------------------------------------------------------------------------
// XORMDesign — EnableStateControl
// ---------------------------------------------------------------------------

describe("XORMDesign.EnableStateControl", () =>
{
    it("should return failure when StateControlTable is empty", () =>
    {
        const design = makeDesign("");
        const table = makeTable(design);
        const result = design.EnableStateControl(table);

        expect(result.Success).toBe(false);
        expect(result.Message).toBeTruthy();
    });

    it("should return failure when table does not belong to the design", () =>
    {
        const design = makeDesign("Status");
        const orphanTable = new XORMTable();
        orphanTable.ID = XGuid.NewValue();

        const result = design.EnableStateControl(orphanTable);
        expect(result.Success).toBe(false);
        expect(result.Message).toBeTruthy();
    });

    it("should succeed when the state table already exists in the design (same-model)", () =>
    {
        const design = makeDesign("Status");
        const statusTable = makeTable(design, "Status");
        statusTable.CreatePKField({ DataType: "Int32" });
        const ordersTable = makeTable(design, "Orders");

        const result = design.EnableStateControl(ordersTable);

        expect(result.Success).toBe(true);
        expect(result.ShadowTableCreated).toBeFalsy();
        expect(result.StateFieldID).toBeTruthy();
        expect(result.StateReferenceID).toBeTruthy();
    });

    it("should create a shadow table when the state table is not in the design (cross-model)", () =>
    {
        const design = makeDesign("ExternalStatus");
        const ordersTable = makeTable(design, "Orders");

        const result = design.EnableStateControl(ordersTable);

        expect(result.Success).toBe(true);
        expect(result.ShadowTableCreated).toBe(true);
        expect(result.ShadowTableID).toBeTruthy();

        const shadowTable = design.FindTableByID(result.ShadowTableID!);
        expect(shadowTable).not.toBeNull();
        expect(shadowTable!.IsShadow).toBe(true);
        expect(shadowTable!.ShadowTableName).toBe("ExternalStatus");
    });

    it("should create an XORMStateField with name {StateTableName}ID", () =>
    {
        const design = makeDesign("Status");
        makeTable(design, "Status");
        const ordersTable = makeTable(design, "Orders");

        const result = design.EnableStateControl(ordersTable);

        const stateField = ordersTable.GetStateField();
        expect(stateField).not.toBeNull();
        expect(stateField!.Name).toBe("StatusID");
        expect(stateField!.ID).toBe(result.StateFieldID);
    });

    it("should create an XORMStateField whose DataType matches the target table PKType", () =>
    {
        const design = makeDesign("Status");
        const statusTable = makeTable(design, "Status");
        statusTable.CreatePKField({ DataType: "Guid" });
        const ordersTable = makeTable(design, "Orders");

        design.EnableStateControl(ordersTable);

        const stateField = ordersTable.GetStateField();
        expect(stateField!.DataType).toBe("Guid");
    });

    it("should default field DataType to Int32 when target table has no PKType", () =>
    {
        const design = makeDesign("Status");
        makeTable(design, "Status"); // no PK created → PKType defaults to "Int32"
        const ordersTable = makeTable(design, "Orders");

        design.EnableStateControl(ordersTable);

        const stateField = ordersTable.GetStateField();
        expect(stateField!.DataType).toBe("Int32");
    });

    it("should create an invisible XORMStateReference", () =>
    {
        const design = makeDesign("Status");
        makeTable(design, "Status");
        const ordersTable = makeTable(design, "Orders");

        const result = design.EnableStateControl(ordersTable);

        const stateRef = design.FindReferenceByID(result.StateReferenceID!);
        expect(stateRef).not.toBeNull();
        expect(stateRef).toBeInstanceOf(XORMStateReference);
        expect(stateRef!.IsVisible).toBe(false);
    });

    it("should set XORMStateReference Source to the state field and Target to the state table", () =>
    {
        const design = makeDesign("Status");
        const statusTable = makeTable(design, "Status");
        const ordersTable = makeTable(design, "Orders");

        const result = design.EnableStateControl(ordersTable);

        const stateRef = design.FindReferenceByID(result.StateReferenceID!);
        expect(stateRef!.Source).toBe(result.StateFieldID);
        expect(stateRef!.Target).toBe(statusTable.ID);
    });

    it("should set table.UseStateControl = true on success", () =>
    {
        const design = makeDesign("Status");
        makeTable(design, "Status");
        const ordersTable = makeTable(design, "Orders");
        expect(ordersTable.UseStateControl).toBe(false);

        design.EnableStateControl(ordersTable);

        expect(ordersTable.UseStateControl).toBe(true);
    });

    it("should be idempotent: calling again returns success with existing IDs", () =>
    {
        const design = makeDesign("Status");
        makeTable(design, "Status");
        const ordersTable = makeTable(design, "Orders");

        const first = design.EnableStateControl(ordersTable);
        const second = design.EnableStateControl(ordersTable);

        expect(second.Success).toBe(true);
        expect(second.StateFieldID).toBe(first.StateFieldID);
    });
});

// ---------------------------------------------------------------------------
// XORMDesign — DisableStateControl
// ---------------------------------------------------------------------------

describe("XORMDesign.DisableStateControl", () =>
{
    it("should return false when table does not belong to the design", () =>
    {
        const design = makeDesign("Status");
        const orphan = new XORMTable();
        orphan.ID = XGuid.NewValue();

        expect(design.DisableStateControl(orphan)).toBe(false);
    });

    it("should remove the state field and state reference, then return true", () =>
    {
        const design = makeDesign("Status");
        makeTable(design, "Status");
        const ordersTable = makeTable(design, "Orders");
        const enableResult = design.EnableStateControl(ordersTable);

        const ok = design.DisableStateControl(ordersTable);

        expect(ok).toBe(true);
        expect(ordersTable.GetStateField()).toBeNull();
        expect(design.FindReferenceByID(enableResult.StateReferenceID!)).toBeNull();
    });

    it("should set table.UseStateControl = false", () =>
    {
        const design = makeDesign("Status");
        makeTable(design, "Status");
        const ordersTable = makeTable(design, "Orders");
        design.EnableStateControl(ordersTable);
        expect(ordersTable.UseStateControl).toBe(true);

        design.DisableStateControl(ordersTable);

        expect(ordersTable.UseStateControl).toBe(false);
    });

    it("should still return true even when there is no state field (already clean state)", () =>
    {
        const design = makeDesign("Status");
        const table = makeTable(design, "Orders");
        // No EnableStateControl called — table is clean
        expect(design.DisableStateControl(table)).toBe(true);
        expect(table.UseStateControl).toBe(false);
    });

    it("should not remove a regular XORMReference when disabling state control", () =>
    {
        const design = makeDesign("Status");
        makeTable(design, "Status");
        const ordersTable = makeTable(design, "Orders");
        const otherTable = makeTable(design, "Products");

        // Enable state control
        design.EnableStateControl(ordersTable);
        // Add a regular reference from Products to Orders
        const pkField = ordersTable.CreatePKField();
        design.CreateReference({ SourceFieldID: pkField.ID, TargetTableID: otherTable.ID });

        const refCountBefore = design.GetReferences().length;
        design.DisableStateControl(ordersTable);
        const refCountAfter = design.GetReferences().length;

        // Only the XORMStateReference was removed
        expect(refCountAfter).toBe(refCountBefore - 1);
    });

    it("should not match a XORMStateReference whose source ID does not resolve to any field", () =>
    {
        const design = makeDesign("Status");
        const table = makeTable(design, "Orders");

        // Manually inject a XORMStateReference with a non-existent source field ID
        const orphanRef = new XORMStateReference();
        orphanRef.ID = XGuid.NewValue();
        orphanRef.Source = "non-existent-field-id";
        orphanRef.Target = table.ID;
        design.AppendChild(orphanRef);

        // DisableStateControl calls GetStateReferenceForTable; it must iterate the orphan
        // and exercise the sourceField = null branch without crashing
        const result = design.DisableStateControl(table);

        expect(result).toBe(true);
        // The orphan reference was not matched and remains in the design
        const remaining = design.ChildNodes.filter(c => c instanceof XORMStateReference);
        expect(remaining).toHaveLength(1);
    });
});
