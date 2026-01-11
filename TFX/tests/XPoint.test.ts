import { describe, it, expect } from "vitest";
import { XPoint } from "../src/Core/XGeometry.js";

describe("XPoint", () =>
{
    describe("constructor", () =>
    {
        it("should create with default values", () =>
        {
            const point = new XPoint();
            expect(point.X).toBe(0);
            expect(point.Y).toBe(0);
        });

        it("should create with specified values", () =>
        {
            const point = new XPoint(10, 20);
            expect(point.X).toBe(10);
            expect(point.Y).toBe(20);
        });

        it("should handle negative values", () =>
        {
            const point = new XPoint(-50, -100);
            expect(point.X).toBe(-50);
            expect(point.Y).toBe(-100);
        });
    });

    describe("Parse", () =>
    {
        it("should parse valid string", () =>
        {
            const point = XPoint.Parse("100|200");
            expect(point.X).toBe(100);
            expect(point.Y).toBe(200);
        });

        it("should parse negative values", () =>
        {
            const point = XPoint.Parse("-50|-75");
            expect(point.X).toBe(-50);
            expect(point.Y).toBe(-75);
        });

        it("should throw on invalid string", () =>
        {
            expect(() => XPoint.Parse("invalid")).toThrow();
            expect(() => XPoint.Parse("100")).toThrow();
            expect(() => XPoint.Parse("100|200|300")).toThrow();
        });
    });

    describe("Move", () =>
    {
        it("should return moved point", () =>
        {
            const point = new XPoint(10, 20);
            const moved = point.Move(5, 10);
            expect(moved.X).toBe(15);
            expect(moved.Y).toBe(30);
        });

        it("should handle negative movement", () =>
        {
            const point = new XPoint(10, 20);
            const moved = point.Move(-5, -10);
            expect(moved.X).toBe(5);
            expect(moved.Y).toBe(10);
        });

        it("should not modify original", () =>
        {
            const point = new XPoint(10, 20);
            point.Move(5, 10);
            expect(point.X).toBe(10);
            expect(point.Y).toBe(20);
        });
    });

    describe("ToString", () =>
    {
        it("should return pipe-separated values", () =>
        {
            const point = new XPoint(100, 200);
            expect(point.ToString()).toBe("100|200");
        });
    });

    describe("Equals", () =>
    {
        it("should return true for equal points", () =>
        {
            const a = new XPoint(10, 20);
            const b = new XPoint(10, 20);
            expect(a.Equals(b)).toBe(true);
        });

        it("should return false for different points", () =>
        {
            const a = new XPoint(10, 20);
            const b = new XPoint(10, 30);
            expect(a.Equals(b)).toBe(false);
        });
    });

    describe("CompareTo", () =>
    {
        it("should compare with string representation", () =>
        {
            const point = new XPoint(100, 200);
            expect(point.CompareTo("100|200")).toBe(0);
            expect(point.CompareTo("100|100")).toBeGreaterThan(0);
            expect(point.CompareTo("100|300")).toBeLessThan(0);
        });

        it("should handle null/undefined", () =>
        {
            const point = new XPoint(100, 200);
            expect(point.CompareTo(null)).toBeGreaterThan(0);
            expect(point.CompareTo(undefined)).toBeGreaterThan(0);
        });
    });
});
