import { describe, it, expect } from "vitest";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";
import { XGuid } from "../src/Core/XGuid.js";

class TestElement extends XPersistableElement
{
    public constructor()
    {
        super();
    }
}

describe("XPersistableElement", () =>
{
    describe("GetValue and SetValue", () =>
    {
        it("should write and read property value", () =>
        {
            const elem = new TestElement();

            elem.SetValue(XPersistableElement.NameProp, "TestName");
            const result = elem.GetValue(XPersistableElement.NameProp);

            expect(result).toBe("TestName");
        });
    });

    describe("HasValue", () =>
    {
        it("should return true for ID property always", () =>
        {
            const elem = new TestElement();

            const result = elem.HasValue(XPersistableElement.IDProp);

            expect(result).toBe(true);
        });

        it("should return false for Name when empty", () =>
        {
            const elem = new TestElement();

            const result = elem.HasValue(XPersistableElement.NameProp);

            expect(result).toBe(false);
        });

        it("should return true for Name when set", () =>
        {
            const elem = new TestElement();
            elem.Name = "TestName";

            const result = elem.HasValue(XPersistableElement.NameProp);

            expect(result).toBe(true);
        });

        it("should return false for ParentID when empty", () =>
        {
            const elem = new TestElement();

            const result = elem.HasValue(XPersistableElement.ParentIDProp);

            expect(result).toBe(false);
        });

        it("should return true for ParentID when set", () =>
        {
            const elem = new TestElement();
            elem.ParentID = XGuid.NewValue();

            const result = elem.HasValue(XPersistableElement.ParentIDProp);

            expect(result).toBe(true);
        });

        it("should return false when property has no data", () =>
        {
            const elem = new TestElement();

            const result = elem.HasValue(XPersistableElement.SequenceProp);

            expect(result).toBe(false);
        });

        it("should return true when property has data", () =>
        {
            const elem = new TestElement();
            elem.Sequence = 42;

            const result = elem.HasValue(XPersistableElement.SequenceProp);

            expect(result).toBe(true);
        });
    });
});
