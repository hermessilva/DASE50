import { describe, it, expect } from "vitest";
import {
    XDesignerErrorSeverity,
    XConcurrentBag,
    XDataValidateError,
    XValidatableElement
} from "../src/Core/XValidation.js";
import { XGuid } from "../src/Core/XGuid.js";

function createMockElement(pName: string = "TestElement"): XValidatableElement
{
    return {
        ID: XGuid.NewValue(),
        Name: pName,
        ClassName: "TestClass",
        TreeDisplayText: "Test Display"
    } as XValidatableElement;
}

function createMockProperty(pName: string = "TestProperty"): { ID: string; Name: string }
{
    return { ID: XGuid.NewValue(), Name: pName };
}

describe("XDesignerErrorSeverity", () =>
{
    it("should have Warning value as 1", () =>
    {
        expect(XDesignerErrorSeverity.Warning).toBe(1);
    });

    it("should have Error value as 2", () =>
    {
        expect(XDesignerErrorSeverity.Error).toBe(2);
    });

    it("should only have two values (no None)", () =>
    {
        expect(XDesignerErrorSeverity[0]).toBeUndefined();
    });
});

describe("XConcurrentBag", () =>
{
    describe("constructor", () =>
    {
        it("should create empty bag", () =>
        {
            const bag = new XConcurrentBag<number>();
            expect(bag.Count).toBe(0);
        });
    });

    describe("Add", () =>
    {
        it("should add single item", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(42);
            expect(bag.Count).toBe(1);
        });

        it("should add multiple items", () =>
        {
            const bag = new XConcurrentBag<string>();
            bag.Add("one");
            bag.Add("two");
            bag.Add("three");
            expect(bag.Count).toBe(3);
        });

        it("should allow duplicate items", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(1);
            bag.Add(1);
            bag.Add(1);
            expect(bag.Count).toBe(3);
        });

        it("should add different types of items", () =>
        {
            const bagNum = new XConcurrentBag<number>();
            bagNum.Add(0);
            bagNum.Add(-1);
            bagNum.Add(Number.MAX_VALUE);
            expect(bagNum.Count).toBe(3);

            const bagObj = new XConcurrentBag<{ id: number }>();
            bagObj.Add({ id: 1 });
            bagObj.Add({ id: 2 });
            expect(bagObj.Count).toBe(2);
        });
    });

    describe("Count", () =>
    {
        it("should return 0 for empty bag", () =>
        {
            const bag = new XConcurrentBag<number>();
            expect(bag.Count).toBe(0);
        });

        it("should return correct count after additions", () =>
        {
            const bag = new XConcurrentBag<number>();
            expect(bag.Count).toBe(0);
            bag.Add(1);
            expect(bag.Count).toBe(1);
            bag.Add(2);
            expect(bag.Count).toBe(2);
            bag.Add(3);
            expect(bag.Count).toBe(3);
        });

        it("should return 0 after clear", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(1);
            bag.Add(2);
            bag.Clear();
            expect(bag.Count).toBe(0);
        });
    });

    describe("ToArray", () =>
    {
        it("should return empty array for empty bag", () =>
        {
            const bag = new XConcurrentBag<number>();
            const arr = bag.ToArray();
            expect(arr).toEqual([]);
            expect(arr.length).toBe(0);
        });

        it("should return array with all items", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(1);
            bag.Add(2);
            bag.Add(3);
            const arr = bag.ToArray();
            expect(arr).toContain(1);
            expect(arr).toContain(2);
            expect(arr).toContain(3);
            expect(arr.length).toBe(3);
        });

        it("should return a copy (not reference to internal array)", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(1);
            const arr1 = bag.ToArray();
            arr1.push(99);
            const arr2 = bag.ToArray();
            expect(arr2).not.toContain(99);
            expect(bag.Count).toBe(1);
        });

        it("should preserve order of insertion", () =>
        {
            const bag = new XConcurrentBag<string>();
            bag.Add("first");
            bag.Add("second");
            bag.Add("third");
            const arr = bag.ToArray();
            expect(arr[0]).toBe("first");
            expect(arr[1]).toBe("second");
            expect(arr[2]).toBe("third");
        });
    });

    describe("Clear", () =>
    {
        it("should clear all items", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(1);
            bag.Add(2);
            bag.Add(3);
            expect(bag.Count).toBe(3);
            bag.Clear();
            expect(bag.Count).toBe(0);
            expect(bag.ToArray()).toEqual([]);
        });

        it("should work on empty bag", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Clear();
            expect(bag.Count).toBe(0);
        });

        it("should allow adding items after clear", () =>
        {
            const bag = new XConcurrentBag<string>();
            bag.Add("one");
            bag.Clear();
            bag.Add("two");
            expect(bag.Count).toBe(1);
            expect(bag.ToArray()).toEqual(["two"]);
        });
    });

    describe("Symbol.iterator", () =>
    {
        it("should be iterable with for...of", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(1);
            bag.Add(2);
            bag.Add(3);
            const result: number[] = [];
            for (const item of bag)
            {
                result.push(item);
            }
            expect(result).toEqual([1, 2, 3]);
        });

        it("should iterate in insertion order", () =>
        {
            const bag = new XConcurrentBag<string>();
            bag.Add("a");
            bag.Add("b");
            bag.Add("c");
            const result: string[] = [];
            for (const item of bag)
            {
                result.push(item);
            }
            expect(result).toEqual(["a", "b", "c"]);
        });

        it("should work with spread operator", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(10);
            bag.Add(20);
            bag.Add(30);
            const arr = [...bag];
            expect(arr).toEqual([10, 20, 30]);
        });

        it("should work with Array.from", () =>
        {
            const bag = new XConcurrentBag<number>();
            bag.Add(5);
            bag.Add(10);
            const arr = Array.from(bag);
            expect(arr).toEqual([5, 10]);
        });

        it("should iterate empty bag without error", () =>
        {
            const bag = new XConcurrentBag<number>();
            const result: number[] = [];
            for (const item of bag)
            {
                result.push(item);
            }
            expect(result).toEqual([]);
        });
    });
});

describe("XDataValidateError", () =>
{
    describe("constructor", () =>
    {
        it("should create error with element, severity and message", () =>
        {
            const element = createMockElement();
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Error, "Test error");
            expect(error.Element).toBe(element);
            expect(error.Message).toBe("Test error");
            expect(error.Severity).toBe(XDesignerErrorSeverity.Error);
            expect(error.Property).toBeUndefined();
        });

        it("should create error with Warning severity", () =>
        {
            const element = createMockElement();
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Warning, "Warning message");
            expect(error.Message).toBe("Warning message");
            expect(error.Severity).toBe(XDesignerErrorSeverity.Warning);
        });

        it("should create error with optional property", () =>
        {
            const element = createMockElement();
            const property = createMockProperty();
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Error, "Error with property", property as any);
            expect(error.Property).toBe(property);
        });

        it("should handle empty message", () =>
        {
            const element = createMockElement();
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Error, "");
            expect(error.Message).toBe("");
        });

        it("should handle long message", () =>
        {
            const element = createMockElement();
            const longMsg = "A".repeat(1000);
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Error, longMsg);
            expect(error.Message).toBe(longMsg);
        });

        it("should preserve element properties", () =>
        {
            const element = createMockElement("MyElement");
            element.TreeDisplayText = null;
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Error, "Test");
            expect(error.Element.Name).toBe("MyElement");
            expect(error.Element.ClassName).toBe("TestClass");
            expect(error.Element.TreeDisplayText).toBeNull();
        });
    });

    describe("Required static method", () =>
    {
        it("should create required field error", () =>
        {
            const element = createMockElement();
            const property = createMockProperty("username");
            const error = XDataValidateError.Required(element, property as any);
            expect(error).toBeInstanceOf(XDataValidateError);
            expect(error.Severity).toBe(XDesignerErrorSeverity.Error);
        });

        it("should include property name in message", () =>
        {
            const element = createMockElement();
            const property = createMockProperty("email");
            const error = XDataValidateError.Required(element, property as any);
            expect(error.Message).toContain("email");
            expect(error.Message).toContain("required");
        });

        it("should create unique errors for different properties", () =>
        {
            const element = createMockElement();
            const property1 = createMockProperty("field1");
            const property2 = createMockProperty("field2");
            const error1 = XDataValidateError.Required(element, property1 as any);
            const error2 = XDataValidateError.Required(element, property2 as any);
            expect(error1.Message).not.toBe(error2.Message);
        });

        it("should set element on error", () =>
        {
            const element = createMockElement("TestEl");
            const property = createMockProperty();
            const error = XDataValidateError.Required(element, property as any);
            expect(error.Element).toBe(element);
        });

        it("should set property on error", () =>
        {
            const element = createMockElement();
            const property = createMockProperty("myProp");
            const error = XDataValidateError.Required(element, property as any);
            expect(error.Property).toBe(property);
        });

        it("should handle property name with special characters", () =>
        {
            const element = createMockElement();
            const property = createMockProperty("user.name");
            const error = XDataValidateError.Required(element, property as any);
            expect(error.Message).toContain("user.name");
        });
    });

    describe("readonly properties", () =>
    {
        it("should have readonly Element", () =>
        {
            const element = createMockElement();
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Error, "Test");
            expect(error.Element).toBe(element);
        });

        it("should have readonly Message", () =>
        {
            const element = createMockElement();
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Error, "Test Message");
            expect(error.Message).toBe("Test Message");
        });

        it("should have readonly Severity", () =>
        {
            const element = createMockElement();
            const error = new XDataValidateError(element, XDesignerErrorSeverity.Warning, "Test");
            expect(error.Severity).toBe(XDesignerErrorSeverity.Warning);
        });

        it("should have optional readonly Property", () =>
        {
            const element = createMockElement();
            const property = createMockProperty();
            const errorWithProp = new XDataValidateError(element, XDesignerErrorSeverity.Error, "Test", property as any);
            const errorWithoutProp = new XDataValidateError(element, XDesignerErrorSeverity.Error, "Test");
            expect(errorWithProp.Property).toBe(property);
            expect(errorWithoutProp.Property).toBeUndefined();
        });
    });
});
