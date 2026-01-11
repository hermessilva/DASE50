import { describe, it, expect } from "vitest";
import { XModelValue, XModelValueElement } from "../src/Core/XModelValue.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XModelValue", () =>
{
    function createMockOwner(): XModelValueElement
    {
        return { ID: XGuid.NewValue() } as XModelValueElement;
    }

    function createMockProperty(): { ID: string }
    {
        return { ID: XGuid.NewValue() };
    }

    describe("constructor", () =>
    {
        it("should create instance with all required parameters", () =>
        {
            const owner = createMockOwner();
            const propertyId = XGuid.NewValue();
            const value = "test value";
            const sourceId = XGuid.NewValue();

            const modelValue = new XModelValue(owner, propertyId, value, sourceId);

            expect(modelValue.Owner).toBe(owner);
            expect(modelValue.PropertyId).toBe(propertyId);
            expect(modelValue.Value).toBe(value);
            expect(modelValue.SourceId).toBe(sourceId);
            expect(modelValue.TargetId).toBe(XGuid.EmptyValue);
        });

        it("should create instance with optional targetId", () =>
        {
            const owner = createMockOwner();
            const propertyId = XGuid.NewValue();
            const value = 42;
            const sourceId = XGuid.NewValue();
            const targetId = XGuid.NewValue();

            const modelValue = new XModelValue(owner, propertyId, value, sourceId, targetId);

            expect(modelValue.TargetId).toBe(targetId);
        });

        it("should handle null value", () =>
        {
            const owner = createMockOwner();
            const propertyId = XGuid.NewValue();
            const sourceId = XGuid.NewValue();

            const modelValue = new XModelValue(owner, propertyId, null, sourceId);

            expect(modelValue.Value).toBeNull();
        });

        it("should handle undefined value", () =>
        {
            const owner = createMockOwner();
            const propertyId = XGuid.NewValue();
            const sourceId = XGuid.NewValue();

            const modelValue = new XModelValue(owner, propertyId, undefined, sourceId);

            expect(modelValue.Value).toBeUndefined();
        });

        it("should handle object value", () =>
        {
            const owner = createMockOwner();
            const propertyId = XGuid.NewValue();
            const sourceId = XGuid.NewValue();
            const objValue = { name: "test", count: 5 };

            const modelValue = new XModelValue(owner, propertyId, objValue, sourceId);

            expect(modelValue.Value).toBe(objValue);
        });

        it("should handle array value", () =>
        {
            const owner = createMockOwner();
            const propertyId = XGuid.NewValue();
            const sourceId = XGuid.NewValue();
            const arrValue = [1, 2, 3];

            const modelValue = new XModelValue(owner, propertyId, arrValue, sourceId);

            expect(modelValue.Value).toBe(arrValue);
        });

        it("should handle boolean value", () =>
        {
            const owner = createMockOwner();
            const propertyId = XGuid.NewValue();
            const sourceId = XGuid.NewValue();

            const modelValueTrue = new XModelValue(owner, propertyId, true, sourceId);
            const modelValueFalse = new XModelValue(owner, propertyId, false, sourceId);

            expect(modelValueTrue.Value).toBe(true);
            expect(modelValueFalse.Value).toBe(false);
        });

        it("should handle XGuid.EmptyValue as sourceId", () =>
        {
            const owner = createMockOwner();
            const propertyId = XGuid.NewValue();
            const value = "test";

            const modelValue = new XModelValue(owner, propertyId, value, XGuid.EmptyValue);

            expect(modelValue.SourceId).toBe(XGuid.EmptyValue);
        });
    });

    describe("Element property", () =>
    {
        it("should be null initially", () =>
        {
            const owner = createMockOwner();
            const modelValue = new XModelValue(owner, XGuid.NewValue(), "test", XGuid.NewValue());

            expect(modelValue.Element).toBeNull();
        });

        it("should be settable", () =>
        {
            const owner = createMockOwner();
            const element: XModelValueElement = { ID: XGuid.NewValue() } as XModelValueElement;
            const modelValue = new XModelValue(owner, XGuid.NewValue(), "test", XGuid.NewValue());

            modelValue.Element = element;

            expect(modelValue.Element).toBe(element);
        });

        it("should be settable to null", () =>
        {
            const owner = createMockOwner();
            const element: XModelValueElement = { ID: XGuid.NewValue() } as XModelValueElement;
            const modelValue = new XModelValue(owner, XGuid.NewValue(), "test", XGuid.NewValue());

            modelValue.Element = element;
            modelValue.Element = null;

            expect(modelValue.Element).toBeNull();
        });
    });

    describe("readonly properties", () =>
    {
        it("should have readonly Owner", () =>
        {
            const owner = createMockOwner();
            const modelValue = new XModelValue(owner, XGuid.NewValue(), "test", XGuid.NewValue());
            expect(modelValue.Owner).toBe(owner);
        });

        it("should have readonly PropertyId", () =>
        {
            const propertyId = XGuid.NewValue();
            const modelValue = new XModelValue(createMockOwner(), propertyId, "test", XGuid.NewValue());
            expect(modelValue.PropertyId).toBe(propertyId);
        });

        it("should have readonly Value", () =>
        {
            const value = { data: 123 };
            const modelValue = new XModelValue(createMockOwner(), XGuid.NewValue(), value, XGuid.NewValue());
            expect(modelValue.Value).toBe(value);
        });

        it("should have readonly SourceId", () =>
        {
            const sourceId = XGuid.NewValue();
            const modelValue = new XModelValue(createMockOwner(), XGuid.NewValue(), "test", sourceId);
            expect(modelValue.SourceId).toBe(sourceId);
        });

        it("should have readonly TargetId", () =>
        {
            const targetId = XGuid.NewValue();
            const modelValue = new XModelValue(createMockOwner(), XGuid.NewValue(), "test", XGuid.NewValue(), targetId);
            expect(modelValue.TargetId).toBe(targetId);
        });
    });

    describe("FromProperty static method", () =>
    {
        it("should create XModelValue from property", () =>
        {
            const owner = createMockOwner();
            const property = createMockProperty();
            const value = "property value";
            const sourceId = XGuid.NewValue();

            const modelValue = XModelValue.FromProperty(owner, property as any, value, sourceId);

            expect(modelValue).toBeInstanceOf(XModelValue);
            expect(modelValue.Owner).toBe(owner);
            expect(modelValue.PropertyId).toBe(property.ID);
            expect(modelValue.Value).toBe(value);
            expect(modelValue.SourceId).toBe(sourceId);
            expect(modelValue.TargetId).toBe(XGuid.EmptyValue);
        });

        it("should create XModelValue with targetId", () =>
        {
            const owner = createMockOwner();
            const property = createMockProperty();
            const value = 100;
            const sourceId = XGuid.NewValue();
            const targetId = XGuid.NewValue();

            const modelValue = XModelValue.FromProperty(owner, property as any, value, sourceId, targetId);

            expect(modelValue.TargetId).toBe(targetId);
        });

        it("should use property ID as PropertyId", () =>
        {
            const owner = createMockOwner();
            const property = createMockProperty();
            const sourceId = XGuid.NewValue();

            const modelValue = XModelValue.FromProperty(owner, property as any, "test", sourceId);

            expect(modelValue.PropertyId).toBe(property.ID);
        });

        it("should handle complex value types", () =>
        {
            const owner = createMockOwner();
            const property = createMockProperty();
            const complexValue = { nested: { deep: { value: 42 } }, arr: [1, 2, 3] };

            const modelValue = XModelValue.FromProperty(owner, property as any, complexValue, XGuid.NewValue());

            expect(modelValue.Value).toBe(complexValue);
        });

        it("should handle function value", () =>
        {
            const owner = createMockOwner();
            const property = createMockProperty();
            const fn = () => "result";

            const modelValue = XModelValue.FromProperty(owner, property as any, fn, XGuid.NewValue());

            expect(modelValue.Value).toBe(fn);
        });
    });
});
