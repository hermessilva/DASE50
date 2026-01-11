import { describe, it, expect } from "vitest";
import { XThickness } from "../src/Core/XGeometry.js";

describe("XThickness", () =>
{
    describe("constructor", () =>
    {
        it("should create uniform thickness with single value", () =>
        {
            const t = new XThickness(10);
            expect(t.Left).toBe(10);
            expect(t.Top).toBe(10);
            expect(t.Right).toBe(10);
            expect(t.Bottom).toBe(10);
        });

        it("should create with four values", () =>
        {
            const t = new XThickness(1, 2, 3, 4);
            expect(t.Left).toBe(1);
            expect(t.Top).toBe(2);
            expect(t.Right).toBe(3);
            expect(t.Bottom).toBe(4);
        });
    });

    describe("Add", () =>
    {
        it("should add two thicknesses", () =>
        {
            const a = new XThickness(1, 2, 3, 4);
            const b = new XThickness(10, 20, 30, 40);
            const result = XThickness.Add(a, b);
            expect(result.Left).toBe(11);
            expect(result.Top).toBe(22);
            expect(result.Right).toBe(33);
            expect(result.Bottom).toBe(44);
        });
    });

    describe("Subtract", () =>
    {
        it("should subtract two thicknesses", () =>
        {
            const a = new XThickness(10, 20, 30, 40);
            const b = new XThickness(1, 2, 3, 4);
            const result = XThickness.Subtract(a, b);
            expect(result.Left).toBe(9);
            expect(result.Top).toBe(18);
            expect(result.Right).toBe(27);
            expect(result.Bottom).toBe(36);
        });
    });

    describe("Parse", () =>
    {
        it("should parse uniform value", () =>
        {
            const t = XThickness.Parse("10");
            expect(t.Left).toBe(10);
            expect(t.Top).toBe(10);
            expect(t.Right).toBe(10);
            expect(t.Bottom).toBe(10);
        });

        it("should parse four values", () =>
        {
            const t = XThickness.Parse("1|2|3|4");
            expect(t.Left).toBe(1);
            expect(t.Top).toBe(2);
            expect(t.Right).toBe(3);
            expect(t.Bottom).toBe(4);
        });

        it("should throw on invalid string", () =>
        {
            expect(() => XThickness.Parse("1|2")).toThrow();
            expect(() => XThickness.Parse("1|2|3")).toThrow();
        });
    });

    describe("TryParse", () =>
    {
        it("should return success for valid uniform", () =>
        {
            const result = XThickness.TryParse("10");
            expect(result.Success).toBe(true);
            expect(result.Thickness.IsUniform).toBe(true);
        });

        it("should return success for valid four values", () =>
        {
            const result = XThickness.TryParse("1|2|3|4");
            expect(result.Success).toBe(true);
            expect(result.Thickness.Left).toBe(1);
        });

        it("should return failure for invalid string", () =>
        {
            const result = XThickness.TryParse("1|2|3");
            expect(result.Success).toBe(false);
        });
    });

    describe("properties", () =>
    {
        it("IsEmpty should return true when all zero", () =>
        {
            const t = new XThickness(0);
            expect(t.IsEmpty).toBe(true);
        });

        it("IsEmpty should return false when has values", () =>
        {
            const t = new XThickness(1, 0, 0, 0);
            expect(t.IsEmpty).toBe(false);
        });

        it("Max should return largest value", () =>
        {
            const t = new XThickness(1, 5, 3, 2);
            expect(t.Max).toBe(5);
        });

        it("IsUniform should return true when all equal", () =>
        {
            const t = new XThickness(10);
            expect(t.IsUniform).toBe(true);
        });

        it("IsUniform should return false when different", () =>
        {
            const t = new XThickness(1, 2, 3, 4);
            expect(t.IsUniform).toBe(false);
        });

        it("Width should return Left + Right", () =>
        {
            const t = new XThickness(10, 0, 20, 0);
            expect(t.Width).toBe(30);
        });

        it("Height should return Top + Bottom", () =>
        {
            const t = new XThickness(0, 10, 0, 20);
            expect(t.Height).toBe(30);
        });
    });

    describe("ToString", () =>
    {
        it("should return four values", () =>
        {
            const t = new XThickness(1, 2, 3, 4);
            expect(t.ToString()).toBe("1|2|3|4");
        });

        it("should return four same values when uniform", () =>
        {
            const t = new XThickness(5);
            expect(t.ToString()).toBe("5|5|5|5");
        });
    });

    describe("CompareTo", () =>
    {
        it("should compare to another thickness string", () =>
        {
            const t = new XThickness(1, 2, 3, 4);
            expect(t.CompareTo("1|2|3|4")).toBe(0);
        });

        it("should handle null comparison", () =>
        {
            const t = new XThickness(5);
            expect(typeof t.CompareTo(null)).toBe("number");
        });

        it("should handle undefined comparison", () =>
        {
            const t = new XThickness(5);
            expect(typeof t.CompareTo(undefined)).toBe("number");
        });
    });

    describe("Equals", () =>
    {
        it("should return true for equal thicknesses", () =>
        {
            const a = new XThickness(1, 2, 3, 4);
            const b = new XThickness(1, 2, 3, 4);
            expect(a.Equals(b)).toBe(true);
        });

        it("should return false for different thicknesses", () =>
        {
            const a = new XThickness(1, 2, 3, 4);
            const b = new XThickness(1, 2, 3, 5);
            expect(a.Equals(b)).toBe(false);
        });
    });
});
