import { describe, it, expect } from "vitest";
import { XSize } from "../src/Core/XGeometry.js";

describe("XSize", () =>
{
    describe("constructor", () =>
    {
        it("should create with default values", () =>
        {
            const size = new XSize();
            expect(size.Width).toBe(0);
            expect(size.Height).toBe(0);
        });

        it("should create with specified values", () =>
        {
            const size = new XSize(100, 200);
            expect(size.Width).toBe(100);
            expect(size.Height).toBe(200);
        });
    });

    describe("Parse", () =>
    {
        it("should parse valid string", () =>
        {
            const size = XSize.Parse("150|250");
            expect(size.Width).toBe(150);
            expect(size.Height).toBe(250);
        });

        it("should throw on invalid string", () =>
        {
            expect(() => XSize.Parse("invalid")).toThrow();
            expect(() => XSize.Parse("100")).toThrow();
            expect(() => XSize.Parse("100|200|300")).toThrow();
        });
    });

    describe("Shrink", () =>
    {
        it("should return shrunk size", () =>
        {
            const size = new XSize(100, 200);
            const shrunk = size.Shrink(20, 40);
            expect(shrunk.Width).toBe(80);
            expect(shrunk.Height).toBe(160);
        });

        it("should not modify original", () =>
        {
            const size = new XSize(100, 200);
            size.Shrink(20, 40);
            expect(size.Width).toBe(100);
            expect(size.Height).toBe(200);
        });
    });

    describe("ToString", () =>
    {
        it("should return pipe-separated values", () =>
        {
            const size = new XSize(100, 200);
            expect(size.ToString()).toBe("100|200");
        });
    });

    describe("Equals", () =>
    {
        it("should return true for equal sizes", () =>
        {
            const a = new XSize(100, 200);
            const b = new XSize(100, 200);
            expect(a.Equals(b)).toBe(true);
        });

        it("should return false for different sizes", () =>
        {
            const a = new XSize(100, 200);
            const b = new XSize(100, 300);
            expect(a.Equals(b)).toBe(false);
        });
    });

    describe("CompareTo", () =>
    {
        it("should compare with string representation", () =>
        {
            const size = new XSize(100, 200);
            expect(size.CompareTo("100|200")).toBe(0);
            expect(size.CompareTo("100|100")).toBeGreaterThan(0);
            expect(size.CompareTo("100|300")).toBeLessThan(0);
        });

        it("should handle null/undefined", () =>
        {
            const size = new XSize(100, 200);
            expect(size.CompareTo(null)).toBeGreaterThan(0);
            expect(size.CompareTo(undefined)).toBeGreaterThan(0);
        });
    });
});
