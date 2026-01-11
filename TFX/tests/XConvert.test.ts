import { describe, it, expect } from "vitest";
import { XConvert } from "../src/Core/XConvert.js";

describe("XConvert", () =>
{
    describe("ToString", () =>
    {
        it("should return empty string for null", () =>
        {
            expect(XConvert.ToString(null)).toBe("");
        });

        it("should return empty string for undefined", () =>
        {
            expect(XConvert.ToString(undefined)).toBe("");
        });

        it("should return string as-is", () =>
        {
            expect(XConvert.ToString("hello")).toBe("hello");
            expect(XConvert.ToString("")).toBe("");
            expect(XConvert.ToString("  spaces  ")).toBe("  spaces  ");
        });

        it("should convert number to string", () =>
        {
            expect(XConvert.ToString(42)).toBe("42");
            expect(XConvert.ToString(3.14)).toBe("3.14");
            expect(XConvert.ToString(0)).toBe("0");
            expect(XConvert.ToString(-100)).toBe("-100");
        });

        it("should convert boolean to string", () =>
        {
            expect(XConvert.ToString(true)).toBe("true");
            expect(XConvert.ToString(false)).toBe("false");
        });

        it("should convert object to string", () =>
        {
            expect(XConvert.ToString({})).toBe("[object Object]");
            expect(XConvert.ToString({ toString: () => "custom" })).toBe("custom");
        });

        it("should convert array to string", () =>
        {
            expect(XConvert.ToString([1, 2, 3])).toBe("1,2,3");
            expect(XConvert.ToString([])).toBe("");
        });

        it("should handle NaN and Infinity", () =>
        {
            expect(XConvert.ToString(NaN)).toBe("NaN");
            expect(XConvert.ToString(Infinity)).toBe("Infinity");
            expect(XConvert.ToString(-Infinity)).toBe("-Infinity");
        });

        it("should accept optional type parameter", () =>
        {
            expect(XConvert.ToString(42, "number")).toBe("42");
        });
    });

    describe("FromString", () =>
    {
        it("should return string as typed value", () =>
        {
            const result = XConvert.FromString<string>("test");
            expect(result).toBe("test");
        });

        it("should work with type parameter", () =>
        {
            const numStr = XConvert.FromString<number>("42");
            expect(numStr).toBe("42");
        });

        it("should handle empty string", () =>
        {
            const result = XConvert.FromString<string>("");
            expect(result).toBe("");
        });

        it("should accept optional type parameter", () =>
        {
            const result = XConvert.FromString<number>("123", "number");
            expect(result).toBe("123");
        });
    });

    describe("ToNumber", () =>
    {
        it("should return 0 for null", () =>
        {
            expect(XConvert.ToNumber(null)).toBe(0);
        });

        it("should return 0 for undefined", () =>
        {
            expect(XConvert.ToNumber(undefined)).toBe(0);
        });

        it("should return number as-is", () =>
        {
            expect(XConvert.ToNumber(42)).toBe(42);
            expect(XConvert.ToNumber(3.14)).toBe(3.14);
            expect(XConvert.ToNumber(0)).toBe(0);
            expect(XConvert.ToNumber(-100)).toBe(-100);
        });

        it("should convert string to number", () =>
        {
            expect(XConvert.ToNumber("42")).toBe(42);
            expect(XConvert.ToNumber("3.14")).toBe(3.14);
            expect(XConvert.ToNumber("-100")).toBe(-100);
            expect(XConvert.ToNumber("0")).toBe(0);
        });

        it("should return 0 for non-numeric string", () =>
        {
            expect(XConvert.ToNumber("hello")).toBe(0);
            expect(XConvert.ToNumber("")).toBe(0);
            expect(XConvert.ToNumber("abc123")).toBe(0);
        });

        it("should handle string with spaces", () =>
        {
            expect(XConvert.ToNumber("  42  ")).toBe(42);
        });

        it("should convert boolean to number", () =>
        {
            expect(XConvert.ToNumber(true)).toBe(1);
            expect(XConvert.ToNumber(false)).toBe(0);
        });

        it("should return 0 for NaN result", () =>
        {
            expect(XConvert.ToNumber({})).toBe(0);
            expect(XConvert.ToNumber([])).toBe(0);
        });

        it("should handle Infinity", () =>
        {
            expect(XConvert.ToNumber(Infinity)).toBe(Infinity);
            expect(XConvert.ToNumber(-Infinity)).toBe(-Infinity);
            expect(XConvert.ToNumber("Infinity")).toBe(Infinity);
        });
    });

    describe("ToBoolean", () =>
    {
        it("should return false for null", () =>
        {
            expect(XConvert.ToBoolean(null)).toBe(false);
        });

        it("should return false for undefined", () =>
        {
            expect(XConvert.ToBoolean(undefined)).toBe(false);
        });

        it("should return boolean as-is", () =>
        {
            expect(XConvert.ToBoolean(true)).toBe(true);
            expect(XConvert.ToBoolean(false)).toBe(false);
        });

        it("should convert string 'true' to true (case insensitive)", () =>
        {
            expect(XConvert.ToBoolean("true")).toBe(true);
            expect(XConvert.ToBoolean("TRUE")).toBe(true);
            expect(XConvert.ToBoolean("True")).toBe(true);
            expect(XConvert.ToBoolean("TrUe")).toBe(true);
        });

        it("should convert string '1' to true", () =>
        {
            expect(XConvert.ToBoolean("1")).toBe(true);
        });

        it("should convert string 'false' to false", () =>
        {
            expect(XConvert.ToBoolean("false")).toBe(false);
            expect(XConvert.ToBoolean("FALSE")).toBe(false);
        });

        it("should convert string '0' to false", () =>
        {
            expect(XConvert.ToBoolean("0")).toBe(false);
        });

        it("should convert other strings to false", () =>
        {
            expect(XConvert.ToBoolean("")).toBe(false);
            expect(XConvert.ToBoolean("hello")).toBe(false);
            expect(XConvert.ToBoolean("yes")).toBe(false);
            expect(XConvert.ToBoolean("no")).toBe(false);
        });

        it("should convert number to boolean", () =>
        {
            expect(XConvert.ToBoolean(1)).toBe(true);
            expect(XConvert.ToBoolean(0)).toBe(false);
            expect(XConvert.ToBoolean(-1)).toBe(true);
            expect(XConvert.ToBoolean(42)).toBe(true);
        });

        it("should convert object to boolean", () =>
        {
            expect(XConvert.ToBoolean({})).toBe(true);
            expect(XConvert.ToBoolean([])).toBe(true);
        });
    });
});
