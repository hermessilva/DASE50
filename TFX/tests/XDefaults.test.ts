import { describe, it, expect, beforeEach } from "vitest";
import {
    XDefault,
    XDesignerDefault,
    XDefaultIds,
    XPropertyBinding,
    XPropertyBindingList
} from "../src/Core/XDefaults.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XDefault", () =>
{
    beforeEach(() =>
    {
        XDefault.StopCheck = false;
        XDefault.SetNewID = false;
    });

    describe("StopCheck", () =>
    {
        it("should be false by default", () =>
        {
            expect(XDefault.StopCheck).toBe(false);
        });

        it("should be settable to true", () =>
        {
            XDefault.StopCheck = true;
            expect(XDefault.StopCheck).toBe(true);
        });

        it("should be settable back to false", () =>
        {
            XDefault.StopCheck = true;
            XDefault.StopCheck = false;
            expect(XDefault.StopCheck).toBe(false);
        });
    });

    describe("SetNewID", () =>
    {
        it("should be false by default", () =>
        {
            expect(XDefault.SetNewID).toBe(false);
        });

        it("should be settable to true", () =>
        {
            XDefault.SetNewID = true;
            expect(XDefault.SetNewID).toBe(true);
        });

        it("should be settable back to false", () =>
        {
            XDefault.SetNewID = true;
            XDefault.SetNewID = false;
            expect(XDefault.SetNewID).toBe(false);
        });
    });
});

describe("XDesignerDefault", () =>
{
    beforeEach(() =>
    {
        XDesignerDefault.CurrentCulture = "pt-BR";
        XDesignerDefault.DefaultCulture = "pt-BR";
    });

    describe("CurrentCulture", () =>
    {
        it("should be pt-BR by default", () =>
        {
            expect(XDesignerDefault.CurrentCulture).toBe("pt-BR");
        });

        it("should be settable to other cultures", () =>
        {
            XDesignerDefault.CurrentCulture = "en-US";
            expect(XDesignerDefault.CurrentCulture).toBe("en-US");
        });

        it("should accept any string", () =>
        {
            XDesignerDefault.CurrentCulture = "fr-FR";
            expect(XDesignerDefault.CurrentCulture).toBe("fr-FR");

            XDesignerDefault.CurrentCulture = "";
            expect(XDesignerDefault.CurrentCulture).toBe("");
        });
    });

    describe("DefaultCulture", () =>
    {
        it("should be pt-BR by default", () =>
        {
            expect(XDesignerDefault.DefaultCulture).toBe("pt-BR");
        });

        it("should be settable to other cultures", () =>
        {
            XDesignerDefault.DefaultCulture = "de-DE";
            expect(XDesignerDefault.DefaultCulture).toBe("de-DE");
        });

        it("should accept any string", () =>
        {
            XDesignerDefault.DefaultCulture = "es-ES";
            expect(XDesignerDefault.DefaultCulture).toBe("es-ES");
        });
    });
});

describe("XDefaultIds", () =>
{
    describe("XFormulaBoxCID", () =>
    {
        it("should be a readonly GUID", () =>
        {
            expect(XDefaultIds.XFormulaBoxCID).toBe("00000000-0000-0000-0000-000000000001");
        });

        it("should not be empty GUID", () =>
        {
            expect(XGuid.IsEmptyValue(XDefaultIds.XFormulaBoxCID)).toBe(false);
        });

        it("should be a valid GUID format", () =>
        {
            const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            expect(XDefaultIds.XFormulaBoxCID).toMatch(guidPattern);
        });
    });
});

describe("XPropertyBinding", () =>
{
    describe("constructor", () =>
    {
        it("should create instance with default values", () =>
        {
            const binding = new XPropertyBinding();
            expect(binding).toBeInstanceOf(XPropertyBinding);
        });
    });

    describe("ID", () =>
    {
        it("should be XGuid.EmptyValue by default", () =>
        {
            const binding = new XPropertyBinding();
            expect(binding.ID).toBe(XGuid.EmptyValue);
        });

        it("should be settable", () =>
        {
            const binding = new XPropertyBinding();
            const newId = XGuid.NewValue();
            binding.ID = newId;
            expect(binding.ID).toBe(newId);
        });
    });

    describe("OnlyExplicit", () =>
    {
        it("should be false by default", () =>
        {
            const binding = new XPropertyBinding();
            expect(binding.OnlyExplicit).toBe(false);
        });

        it("should be settable to true", () =>
        {
            const binding = new XPropertyBinding();
            binding.OnlyExplicit = true;
            expect(binding.OnlyExplicit).toBe(true);
        });

        it("should be settable back to false", () =>
        {
            const binding = new XPropertyBinding();
            binding.OnlyExplicit = true;
            binding.OnlyExplicit = false;
            expect(binding.OnlyExplicit).toBe(false);
        });
    });

    describe("Property", () =>
    {
        it("should be null by default", () =>
        {
            const binding = new XPropertyBinding();
            expect(binding.Property).toBeNull();
        });

        it("should be settable to any value", () =>
        {
            const binding = new XPropertyBinding();

            binding.Property = "test";
            expect(binding.Property).toBe("test");

            binding.Property = 42;
            expect(binding.Property).toBe(42);

            const obj = { name: "property" };
            binding.Property = obj;
            expect(binding.Property).toBe(obj);
        });

        it("should be settable back to null", () =>
        {
            const binding = new XPropertyBinding();
            binding.Property = "something";
            binding.Property = null;
            expect(binding.Property).toBeNull();
        });
    });
});

describe("XPropertyBindingList", () =>
{
    describe("constructor", () =>
    {
        it("should create empty list", () =>
        {
            const list = new XPropertyBindingList();
            expect(list).toBeInstanceOf(XPropertyBindingList);
            expect(list.Count).toBe(0);
        });
    });

    describe("Count", () =>
    {
        it("should return 0 for empty list", () =>
        {
            const list = new XPropertyBindingList();
            expect(list.Count).toBe(0);
        });

        it("should return correct count after additions", () =>
        {
            const list = new XPropertyBindingList();
            list.Add(new XPropertyBinding());
            expect(list.Count).toBe(1);
            list.Add(new XPropertyBinding());
            expect(list.Count).toBe(2);
            list.Add(new XPropertyBinding());
            expect(list.Count).toBe(3);
        });

        it("should return 0 after clear", () =>
        {
            const list = new XPropertyBindingList();
            list.Add(new XPropertyBinding());
            list.Add(new XPropertyBinding());
            list.Clear();
            expect(list.Count).toBe(0);
        });
    });

    describe("Add", () =>
    {
        it("should add single binding", () =>
        {
            const list = new XPropertyBindingList();
            const binding = new XPropertyBinding();
            list.Add(binding);
            expect(list.Count).toBe(1);
        });

        it("should add multiple bindings", () =>
        {
            const list = new XPropertyBindingList();
            list.Add(new XPropertyBinding());
            list.Add(new XPropertyBinding());
            list.Add(new XPropertyBinding());
            expect(list.Count).toBe(3);
        });

        it("should allow adding same binding multiple times", () =>
        {
            const list = new XPropertyBindingList();
            const binding = new XPropertyBinding();
            list.Add(binding);
            list.Add(binding);
            expect(list.Count).toBe(2);
        });

        it("should preserve binding properties", () =>
        {
            const list = new XPropertyBindingList();
            const binding = new XPropertyBinding();
            binding.ID = XGuid.NewValue();
            binding.OnlyExplicit = true;
            binding.Property = "testProp";

            list.Add(binding);
            const bindings = list.GetBindings();

            expect(bindings[0].ID).toBe(binding.ID);
            expect(bindings[0].OnlyExplicit).toBe(true);
            expect(bindings[0].Property).toBe("testProp");
        });
    });

    describe("GetBindings", () =>
    {
        it("should return empty array for empty list", () =>
        {
            const list = new XPropertyBindingList();
            const bindings = list.GetBindings();
            expect(bindings).toEqual([]);
            expect(bindings.length).toBe(0);
        });

        it("should return all bindings", () =>
        {
            const list = new XPropertyBindingList();
            const b1 = new XPropertyBinding();
            const b2 = new XPropertyBinding();
            const b3 = new XPropertyBinding();

            b1.Property = "first";
            b2.Property = "second";
            b3.Property = "third";

            list.Add(b1);
            list.Add(b2);
            list.Add(b3);

            const bindings = list.GetBindings();
            expect(bindings.length).toBe(3);
            expect(bindings[0].Property).toBe("first");
            expect(bindings[1].Property).toBe("second");
            expect(bindings[2].Property).toBe("third");
        });

        it("should return a copy (not reference to internal array)", () =>
        {
            const list = new XPropertyBindingList();
            list.Add(new XPropertyBinding());

            const bindings1 = list.GetBindings();
            bindings1.push(new XPropertyBinding());

            const bindings2 = list.GetBindings();
            expect(bindings2.length).toBe(1);
            expect(list.Count).toBe(1);
        });

        it("should preserve insertion order", () =>
        {
            const list = new XPropertyBindingList();
            const ids: string[] = [];

            for (let i = 0; i < 5; i++)
            {
                const binding = new XPropertyBinding();
                binding.ID = XGuid.NewValue();
                ids.push(binding.ID);
                list.Add(binding);
            }

            const bindings = list.GetBindings();
            for (let i = 0; i < 5; i++)
            {
                expect(bindings[i].ID).toBe(ids[i]);
            }
        });
    });

    describe("Clear", () =>
    {
        it("should clear all bindings", () =>
        {
            const list = new XPropertyBindingList();
            list.Add(new XPropertyBinding());
            list.Add(new XPropertyBinding());
            list.Add(new XPropertyBinding());

            list.Clear();

            expect(list.Count).toBe(0);
            expect(list.GetBindings()).toEqual([]);
        });

        it("should work on empty list", () =>
        {
            const list = new XPropertyBindingList();
            list.Clear();
            expect(list.Count).toBe(0);
        });

        it("should allow adding after clear", () =>
        {
            const list = new XPropertyBindingList();
            const b1 = new XPropertyBinding();
            b1.Property = "first";
            list.Add(b1);

            list.Clear();

            const b2 = new XPropertyBinding();
            b2.Property = "second";
            list.Add(b2);

            expect(list.Count).toBe(1);
            expect(list.GetBindings()[0].Property).toBe("second");
        });

        it("should be callable multiple times", () =>
        {
            const list = new XPropertyBindingList();
            list.Add(new XPropertyBinding());
            list.Clear();
            list.Clear();
            list.Clear();
            expect(list.Count).toBe(0);
        });
    });
});
