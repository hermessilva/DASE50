import { describe, it, expect } from "vitest";
import { XORMFKField } from "../src/Designers/ORM/XORMFKField.js";
import { XORMStateField } from "../src/Designers/ORM/XORMStateField.js";
import { XORMField } from "../src/Designers/ORM/XORMField.js";

describe("XORMFKField", () =>
{
    it("should be instantiable and extend XORMField", () =>
    {
        const field = new XORMFKField();
        expect(field).toBeDefined();
        expect(field).toBeInstanceOf(XORMFKField);
        expect(field).toBeInstanceOf(XORMField);
    });

    it("should always return true for IsFK regardless of parent value", () =>
    {
        const field = new XORMFKField();
        expect(field.IsFK).toBe(true);
    });

    it("should ignore attempts to set IsFK to false", () =>
    {
        const field = new XORMFKField();
        field.IsFK = false;
        expect(field.IsFK).toBe(true);
    });

    it("should always return true for IsForeignKey", () =>
    {
        const field = new XORMFKField();
        expect(field.IsForeignKey).toBe(true);
    });

    it("should have IsPrimaryKey = false", () =>
    {
        const field = new XORMFKField();
        expect(field.IsPrimaryKey).toBe(false);
    });

    it("should allow DataType to be set and read", () =>
    {
        const field = new XORMFKField();
        field.DataType = "Guid";
        expect(field.DataType).toBe("Guid");
        field.DataType = "Int32";
        expect(field.DataType).toBe("Int32");
    });

    it("should have a default Name from XElement", () =>
    {
        const field = new XORMFKField();
        expect(typeof field.Name).toBe("string");
    });
});

describe("XORMStateField", () =>
{
    it("should be instantiable and extend XORMFKField", () =>
    {
        const field = new XORMStateField();
        expect(field).toBeDefined();
        expect(field).toBeInstanceOf(XORMStateField);
        expect(field).toBeInstanceOf(XORMFKField);
        expect(field).toBeInstanceOf(XORMField);
    });

    it("should always have IsVisible = false", () =>
    {
        const field = new XORMStateField();
        expect(field.IsVisible).toBe(false);
    });

    it("should inherit IsFK = true from XORMFKField", () =>
    {
        const field = new XORMStateField();
        expect(field.IsFK).toBe(true);
    });

    it("should inherit IsForeignKey = true from XORMFKField", () =>
    {
        const field = new XORMStateField();
        expect(field.IsForeignKey).toBe(true);
    });

    it("should have IsPrimaryKey = false", () =>
    {
        const field = new XORMStateField();
        expect(field.IsPrimaryKey).toBe(false);
    });

    it("should allow DataType and Name properties", () =>
    {
        const field = new XORMStateField();
        field.Name = "StatusID";
        field.DataType = "Int16";
        expect(field.Name).toBe("StatusID");
        expect(field.DataType).toBe("Int16");
    });
});
