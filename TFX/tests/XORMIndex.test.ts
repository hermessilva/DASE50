import { describe, it, expect } from "vitest";
import { XORMIndex } from "../src/Designers/ORM/XORMIndex.js";
import { XORMIndexField } from "../src/Designers/ORM/XORMIndexField.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XORMIndex", () =>
{
    it("should be instantiable", () =>
    {
        const index = new XORMIndex();
        expect(index).toBeDefined();
        expect(index).toBeInstanceOf(XORMIndex);
    });

    it("should default ID to EmptyValue before factory initialization", () =>
    {
        const index = new XORMIndex();
        expect(XGuid.IsEmptyValue(index.ID)).toBe(true);
    });

    it("should default IsUnique to false", () =>
    {
        const index = new XORMIndex();
        expect(index.IsUnique).toBe(false);
    });

    it("should allow setting IsUnique to true", () =>
    {
        const index = new XORMIndex();
        index.IsUnique = true;
        expect(index.IsUnique).toBe(true);
    });

    it("should allow setting IsUnique back to false", () =>
    {
        const index = new XORMIndex();
        index.IsUnique = true;
        index.IsUnique = false;
        expect(index.IsUnique).toBe(false);
    });

    it("should return empty list from GetIndexFields when no children", () =>
    {
        const index = new XORMIndex();
        expect(index.GetIndexFields()).toEqual([]);
    });

    it("should return XORMIndexField children from GetIndexFields", () =>
    {
        const index = new XORMIndex();
        const field = new XORMIndexField();
        index.AppendChild(field);
        const result = index.GetIndexFields();
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(field);
    });

    it("should carry a Name property", () =>
    {
        const index = new XORMIndex();
        index.Name = "IX_Customer_Email";
        expect(index.Name).toBe("IX_Customer_Email");
    });

    it("should expose IsUniqueProp with correct GUID", () =>
    {
        expect(XORMIndex.IsUniqueProp.ID).toBe("93ADA328-E1D2-4B42-A86B-A3C442070D3E");
    });
});

describe("XORMIndexField", () =>
{
    it("should be instantiable", () =>
    {
        const indexField = new XORMIndexField();
        expect(indexField).toBeDefined();
        expect(indexField).toBeInstanceOf(XORMIndexField);
    });

    it("should default ID to EmptyValue before factory initialization", () =>
    {
        const indexField = new XORMIndexField();
        expect(XGuid.IsEmptyValue(indexField.ID)).toBe(true);
    });

    it("should default IsDescending to false", () =>
    {
        const indexField = new XORMIndexField();
        expect(indexField.IsDescending).toBe(false);
    });

    it("should allow setting IsDescending to true", () =>
    {
        const indexField = new XORMIndexField();
        indexField.IsDescending = true;
        expect(indexField.IsDescending).toBe(true);
    });

    it("should default AllowDuplicate to false", () =>
    {
        const indexField = new XORMIndexField();
        expect(indexField.AllowDuplicate).toBe(false);
    });

    it("should allow setting AllowDuplicate to true", () =>
    {
        const indexField = new XORMIndexField();
        indexField.AllowDuplicate = true;
        expect(indexField.AllowDuplicate).toBe(true);
    });

    it("should carry a Name property", () =>
    {
        const indexField = new XORMIndexField();
        indexField.Name = "CustomerEmail";
        expect(indexField.Name).toBe("CustomerEmail");
    });

    it("should expose IsDescendingProp with correct GUID", () =>
    {
        expect(XORMIndexField.IsDescendingProp.ID).toBe("2FDDA839-31AD-4EC6-B2D7-F3D0EB94BC81");
    });

    it("should expose AllowDuplicateProp with correct GUID", () =>
    {
        expect(XORMIndexField.AllowDuplicateProp.ID).toBe("B2A239B4-6DEC-4AC9-98E5-4E60152CCD6A");
    });
});
