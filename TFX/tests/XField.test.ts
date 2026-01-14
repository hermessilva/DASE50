import { describe, it, expect } from "vitest";
import { XField } from "../src/Design/XField.js";
import { XRectangle } from "../src/Design/XRectangle.js";

class XMockField extends XField { }

describe("XField", () =>
{
    it("should be instantiable via subclass", () =>
    {
        const field = new XMockField();
        expect(field).toBeDefined();
        expect(field).toBeInstanceOf(XField);
        expect(field).toBeInstanceOf(XRectangle);
    });

    describe("Index property", () =>
    {
        it("should have default value 0", () =>
        {
            const field = new XMockField();
            expect(field.Index).toBe(0);
        });

        it("should get and set Index", () =>
        {
            const field = new XMockField();
            field.Index = 5;
            expect(field.Index).toBe(5);
        });
    });

    describe("DataType property", () =>
    {
        it("should have default value String", () =>
        {
            const field = new XMockField();
            expect(field.DataType).toBe("String");
        });

        it("should get and set DataType", () =>
        {
            const field = new XMockField();
            field.DataType = "Int32";
            expect(field.DataType).toBe("Int32");
        });
    });

    describe("IsRequired property", () =>
    {
        it("should have default value true", () =>
        {
            const field = new XMockField();
            expect(field.IsRequired).toBe(true);
        });

        it("should get and set IsRequired", () =>
        {
            const field = new XMockField();
            field.IsRequired = false;
            expect(field.IsRequired).toBe(false);
        });
    });

    describe("DefaultValue property", () =>
    {
        it("should have default value empty string", () =>
        {
            const field = new XMockField();
            expect(field.DefaultValue).toBe("");
        });

        it("should get and set DefaultValue", () =>
        {
            const field = new XMockField();
            field.DefaultValue = "default";
            expect(field.DefaultValue).toBe("default");
        });
    });

    describe("Length property", () =>
    {
        it("should have default value 0", () =>
        {
            const field = new XMockField();
            expect(field.Length).toBe(0);
        });

        it("should get and set Length", () =>
        {
            const field = new XMockField();
            field.Length = 255;
            expect(field.Length).toBe(255);
        });

        it("should clamp negative Length to 0", () =>
        {
            const field = new XMockField();
            field.Length = -1;
            expect(field.Length).toBe(0);
        });
    });

    describe("Scale property", () =>
    {
        it("should have default value 0", () =>
        {
            const field = new XMockField();
            expect(field.Scale).toBe(0);
        });

        it("should get and set Scale", () =>
        {
            const field = new XMockField();
            field.Scale = 2;
            expect(field.Scale).toBe(2);
        });

        it("should clamp negative Scale to 0", () =>
        {
            const field = new XMockField();
            field.Scale = -1;
            expect(field.Scale).toBe(0);
        });
    });
});
