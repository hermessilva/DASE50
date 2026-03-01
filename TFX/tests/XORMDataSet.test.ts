import { describe, it, expect } from "vitest";
import { XORMDataSet } from "../src/Designers/ORM/XORMDataSet.js";
import { XORMDataTuple } from "../src/Designers/ORM/XORMDataTuple.js";
import { XFieldValue } from "../src/Designers/ORM/XFieldValue.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XORMDataSet", () =>
{
    it("should be instantiable", () =>
    {
        const dataset = new XORMDataSet();
        expect(dataset).toBeDefined();
        expect(dataset).toBeInstanceOf(XORMDataSet);
    });

    it("should default ID to EmptyValue before factory initialization", () =>
    {
        const dataset = new XORMDataSet();
        expect(XGuid.IsEmptyValue(dataset.ID)).toBe(true);
    });

    it("should allow assigning an ID", () =>
    {
        const dataset = new XORMDataSet();
        const id = XGuid.NewValue();
        dataset.ID = id;
        expect(dataset.ID).toBe(id);
    });

    it("should return empty tuple list when no children are present", () =>
    {
        const dataset = new XORMDataSet();
        expect(dataset.GetTuples()).toEqual([]);
    });

    it("should return XORMDataTuple children from GetTuples", () =>
    {
        const dataset = new XORMDataSet();
        const tuple = new XORMDataTuple();
        dataset.AppendChild(tuple);
        const result = dataset.GetTuples();
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(tuple);
    });

    it("should carry a Name property", () =>
    {
        const dataset = new XORMDataSet();
        dataset.Name = "Seed";
        expect(dataset.Name).toBe("Seed");
    });
});

describe("XORMDataTuple", () =>
{
    it("should be instantiable", () =>
    {
        const tuple = new XORMDataTuple();
        expect(tuple).toBeDefined();
        expect(tuple).toBeInstanceOf(XORMDataTuple);
    });

    it("should default ID to EmptyValue before factory initialization", () =>
    {
        const tuple = new XORMDataTuple();
        expect(XGuid.IsEmptyValue(tuple.ID)).toBe(true);
    });

    it("should return empty field-value list when no children are present", () =>
    {
        const tuple = new XORMDataTuple();
        expect(tuple.GetFieldValues()).toEqual([]);
    });

    it("should return XFieldValue children from GetFieldValues", () =>
    {
        const tuple = new XORMDataTuple();
        const fv = new XFieldValue();
        tuple.AppendChild(fv);
        const result = tuple.GetFieldValues();
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(fv);
    });
});

describe("XFieldValue", () =>
{
    it("should be instantiable", () =>
    {
        const fv = new XFieldValue();
        expect(fv).toBeDefined();
        expect(fv).toBeInstanceOf(XFieldValue);
    });

    it("should have default FieldID as empty GUID", () =>
    {
        const fv = new XFieldValue();
        expect(fv.FieldID).toBe(XGuid.EmptyValue);
    });

    it("should allow setting and getting FieldID", () =>
    {
        const fv = new XFieldValue();
        const id = XGuid.NewValue();
        fv.FieldID = id;
        expect(fv.FieldID).toBe(id);
    });

    it("should have default Value as empty string", () =>
    {
        const fv = new XFieldValue();
        expect(fv.Value).toBe("");
    });

    it("should allow setting and getting Value", () =>
    {
        const fv = new XFieldValue();
        fv.Value = "Active";
        expect(fv.Value).toBe("Active");

        fv.Value = "42";
        expect(fv.Value).toBe("42");
    });

    it("should default ID to EmptyValue before factory initialization", () =>
    {
        const fv = new XFieldValue();
        expect(XGuid.IsEmptyValue(fv.ID)).toBe(true);
    });
});
