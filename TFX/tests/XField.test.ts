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
        it("should have default value false", () =>
        {
            const field = new XMockField();
            expect(field.IsRequired).toBe(false);
        });

        it("should get and set IsRequired", () =>
        {
            const field = new XMockField();
            field.IsRequired = true;
            expect(field.IsRequired).toBe(true);
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
    });
});
