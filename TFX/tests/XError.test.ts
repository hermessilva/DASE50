import { describe, it, expect } from "vitest";
import { XError } from "../src/Core/XError.js";

describe("XError", () =>
{
    describe("constructor", () =>
    {
        it("should create error with message", () =>
        {
            const error = new XError("Test error message");

            expect(error.message).toBe("Test error message");
        });

        it("should set name to XError", () =>
        {
            const error = new XError("Test");

            expect(error.name).toBe("XError");
        });

        it("should extend Error", () =>
        {
            const error = new XError("Test");

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(XError);
        });
    });

    describe("throw behavior", () =>
    {
        it("should be throwable", () =>
        {
            expect(() =>
            {
                throw new XError("Thrown error");
            }).toThrow(XError);
        });

        it("should be catchable with message", () =>
        {
            try
            {
                throw new XError("Catch me");
            }
            catch (e)
            {
                expect(e).toBeInstanceOf(XError);
                expect((e as XError).message).toBe("Catch me");
            }
        });

        it("should have stack trace", () =>
        {
            const error = new XError("Stack trace test");

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain("XError");
        });
    });

    describe("different messages", () =>
    {
        it("should handle empty message", () =>
        {
            const error = new XError("");

            expect(error.message).toBe("");
            expect(error.name).toBe("XError");
        });

        it("should handle long message", () =>
        {
            const longMessage = "A".repeat(1000);
            const error = new XError(longMessage);

            expect(error.message).toBe(longMessage);
            expect(error.message.length).toBe(1000);
        });

        it("should handle message with special characters", () =>
        {
            const specialMessage = "Error: [test] 'value' \"quote\" \n\t<>&";
            const error = new XError(specialMessage);

            expect(error.message).toBe(specialMessage);
        });

        it("should handle message with unicode", () =>
        {
            const unicodeMessage = "Erro: não encontrado 你好 🚀";
            const error = new XError(unicodeMessage);

            expect(error.message).toBe(unicodeMessage);
        });
    });

    describe("toString", () =>
    {
        it("should return formatted string", () =>
        {
            const error = new XError("Test message");
            const str = error.toString();

            expect(str).toContain("XError");
            expect(str).toContain("Test message");
        });
    });
});
