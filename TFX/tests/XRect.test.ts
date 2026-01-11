import { describe, it, expect } from "vitest";
import { XRect, XPoint, XSize, XThickness } from "../src/Core/XGeometry.js";

describe("XRect", () =>
{
    describe("constructor", () =>
    {
        it("should create with default values", () =>
        {
            const rect = new XRect();
            expect(rect.Left).toBe(0);
            expect(rect.Top).toBe(0);
            expect(rect.Width).toBe(0);
            expect(rect.Height).toBe(0);
        });

        it("should create with specified values", () =>
        {
            const rect = new XRect(10, 20, 100, 200);
            expect(rect.Left).toBe(10);
            expect(rect.Top).toBe(20);
            expect(rect.Width).toBe(100);
            expect(rect.Height).toBe(200);
        });
    });

    describe("Parse", () =>
    {
        it("should parse valid string", () =>
        {
            const rect = XRect.Parse("10|20|100|200");
            expect(rect.Left).toBe(10);
            expect(rect.Top).toBe(20);
            expect(rect.Width).toBe(100);
            expect(rect.Height).toBe(200);
        });

        it("should throw on invalid string", () =>
        {
            expect(() => XRect.Parse("invalid")).toThrow();
            expect(() => XRect.Parse("10|20|100")).toThrow();
        });
    });

    describe("FromPoints", () =>
    {
        it("should create rect from two points", () =>
        {
            const topLeft = new XPoint(10, 20);
            const bottomRight = new XPoint(110, 220);
            const rect = XRect.FromPoints(topLeft, bottomRight);
            expect(rect.Left).toBe(10);
            expect(rect.Top).toBe(20);
            expect(rect.Width).toBe(100);
            expect(rect.Height).toBe(200);
        });
    });

    describe("FromLocationSize", () =>
    {
        it("should create rect from location and size", () =>
        {
            const location = new XPoint(10, 20);
            const size = new XSize(100, 200);
            const rect = XRect.FromLocationSize(location, size);
            expect(rect.Left).toBe(10);
            expect(rect.Top).toBe(20);
            expect(rect.Width).toBe(100);
            expect(rect.Height).toBe(200);
        });
    });

    describe("computed properties", () =>
    {
        const rect = new XRect(10, 20, 100, 200);

        it("Bottom should return Top + Height", () =>
        {
            expect(rect.Bottom).toBe(220);
        });

        it("Right should return Left + Width", () =>
        {
            expect(rect.Right).toBe(110);
        });

        it("Size should return width and height", () =>
        {
            const size = rect.Size;
            expect(size.Width).toBe(100);
            expect(size.Height).toBe(200);
        });

        it("Location should return left and top", () =>
        {
            const location = rect.Location;
            expect(location.X).toBe(10);
            expect(location.Y).toBe(20);
        });

        it("TopRight should return correct point", () =>
        {
            const point = rect.TopRight;
            expect(point.X).toBe(110);
            expect(point.Y).toBe(20);
        });

        it("BottomLeft should return correct point", () =>
        {
            const point = rect.BottomLeft;
            expect(point.X).toBe(10);
            expect(point.Y).toBe(220);
        });

        it("BottomRight should return correct point", () =>
        {
            const point = rect.BottomRight;
            expect(point.X).toBe(110);
            expect(point.Y).toBe(220);
        });
    });

    describe("IsEmpty", () =>
    {
        it("should return true when width is zero", () =>
        {
            const rect = new XRect(10, 20, 0, 200);
            expect(rect.IsEmpty).toBe(true);
        });

        it("should return true when height is zero", () =>
        {
            const rect = new XRect(10, 20, 100, 0);
            expect(rect.IsEmpty).toBe(true);
        });

        it("should return false when both dimensions are non-zero", () =>
        {
            const rect = new XRect(10, 20, 100, 200);
            expect(rect.IsEmpty).toBe(false);
        });
    });

    describe("Inflate", () =>
    {
        it("should increase size and adjust position", () =>
        {
            const rect = new XRect(100, 100, 100, 100);
            rect.Inflate(20, 40);
            expect(rect.Left).toBe(90);
            expect(rect.Top).toBe(80);
            expect(rect.Width).toBe(120);
            expect(rect.Height).toBe(140);
        });
    });

    describe("Shrink", () =>
    {
        it("should shrink with numeric values", () =>
        {
            const rect = new XRect(0, 0, 100, 100);
            rect.Shrink(20, 20);
            expect(rect.Left).toBe(10);
            expect(rect.Top).toBe(10);
            expect(rect.Width).toBe(80);
            expect(rect.Height).toBe(80);
        });

        it("should shrink with XThickness", () =>
        {
            const rect = new XRect(0, 0, 100, 100);
            const thickness = new XThickness(10, 20, 10, 20);
            rect.Shrink(thickness);
            expect(rect.Left).toBe(10);
            expect(rect.Top).toBe(20);
            expect(rect.Width).toBe(80);
            expect(rect.Height).toBe(60);
        });

        it("should throw when only one numeric value provided", () =>
        {
            const rect = new XRect(0, 0, 100, 100);
            expect(() => rect.Shrink(20)).toThrow();
        });
    });

    describe("FromPercent", () =>
    {
        it("should calculate from percent when values are negative", () =>
        {
            const baseRect = new XRect(0, 0, 200, 100);
            const percentRect = new XRect(-50, -50, -50, -50);
            const result = percentRect.FromPercent(baseRect);
            expect(result.Left).toBe(100);
            expect(result.Top).toBe(50);
            expect(result.Width).toBe(100);
            expect(result.Height).toBe(50);
        });

        it("should use direct values when positive", () =>
        {
            const baseRect = new XRect(0, 0, 200, 100);
            const rect = new XRect(10, 20, 30, 40);
            const result = rect.FromPercent(baseRect);
            expect(result.Left).toBe(10);
            expect(result.Top).toBe(20);
            expect(result.Width).toBe(30);
            expect(result.Height).toBe(40);
        });

        it("should handle mixed positive and negative", () =>
        {
            const baseRect = new XRect(0, 0, 200, 100);
            const rect = new XRect(-50, 10, 30, -50);
            const result = rect.FromPercent(baseRect);
            expect(result.Left).toBe(100);
            expect(result.Top).toBe(10);
            expect(result.Width).toBe(30);
            expect(result.Height).toBe(50);
        });
    });

    describe("CompareTo", () =>
    {
        it("should compare to another rect string", () =>
        {
            const rect = new XRect(10, 20, 100, 200);
            const str = rect.ToString();
            expect(rect.CompareTo(str)).toBe(0);
        });

        it("should handle null comparison", () =>
        {
            const rect = new XRect(10, 20, 100, 200);
            expect(typeof rect.CompareTo(null)).toBe("number");
        });

        it("should handle undefined comparison", () =>
        {
            const rect = new XRect(10, 20, 100, 200);
            expect(typeof rect.CompareTo(undefined)).toBe("number");
        });
    });

    describe("SetMethods", () =>
    {
        it("SetHeight should update height", () =>
        {
            const rect = new XRect(0, 0, 100, 100);
            rect.SetHeight(200);
            expect(rect.Height).toBe(200);
        });

        it("SetWidth should update width", () =>
        {
            const rect = new XRect(0, 0, 100, 100);
            rect.SetWidth(200);
            expect(rect.Width).toBe(200);
        });

        it("SetLeft should update left", () =>
        {
            const rect = new XRect(0, 0, 100, 100);
            rect.SetLeft(50);
            expect(rect.Left).toBe(50);
        });

        it("SetTop should update top", () =>
        {
            const rect = new XRect(0, 0, 100, 100);
            rect.SetTop(50);
            expect(rect.Top).toBe(50);
        });

        it("SetRight should update width based on left", () =>
        {
            const rect = new XRect(10, 0, 100, 100);
            rect.SetRight(200);
            expect(rect.Width).toBe(190);
        });

        it("SetBottom should update height based on top", () =>
        {
            const rect = new XRect(0, 10, 100, 100);
            rect.SetBottom(200);
            expect(rect.Height).toBe(190);
        });
    });

    describe("Equals", () =>
    {
        it("should return true for equal rects", () =>
        {
            const a = new XRect(10, 20, 100, 200);
            const b = new XRect(10, 20, 100, 200);
            expect(a.Equals(b)).toBe(true);
        });

        it("should return false for different rects", () =>
        {
            const a = new XRect(10, 20, 100, 200);
            const b = new XRect(10, 20, 100, 201);
            expect(a.Equals(b)).toBe(false);
        });
    });

    describe("ToString", () =>
    {
        it("should return formatted string", () =>
        {
            const rect = new XRect(10, 20, 100, 200);
            const str = rect.ToString();
            expect(str).toContain("10");
            expect(str).toContain("20");
            expect(str).toContain("100");
            expect(str).toContain("200");
        });
    });
});
