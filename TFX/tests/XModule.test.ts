import { describe, it, expect } from "vitest";
import { XModule } from "../src/Core/XModule.js";
import { XGuid } from "../src/Core/XGuid.js";

describe("XModule", () =>
{
    describe("constructor", () =>
    {
        it("should create with default values", () =>
        {
            const module = new XModule();

            expect(module.ID).toBe("");
            expect(module.Name).toBe("");
        });
    });

    describe("ID property", () =>
    {
        it("should allow setting ID", () =>
        {
            const module = new XModule();
            module.ID = "12345678-1234-1234-1234-123456789012";

            expect(module.ID).toBe("12345678-1234-1234-1234-123456789012");
        });

        it("should allow setting to XGuid.EmptyValue", () =>
        {
            const module = new XModule();
            module.ID = XGuid.EmptyValue;

            expect(module.ID).toBe(XGuid.EmptyValue);
        });
    });

    describe("Name property", () =>
    {
        it("should allow setting Name", () =>
        {
            const module = new XModule();
            module.Name = "TestModule";

            expect(module.Name).toBe("TestModule");
        });

        it("should allow empty string", () =>
        {
            const module = new XModule();
            module.Name = "";

            expect(module.Name).toBe("");
        });

        it("should allow special characters", () =>
        {
            const module = new XModule();
            module.Name = "Test-Module_123 áéíóú";

            expect(module.Name).toBe("Test-Module_123 áéíóú");
        });
    });

    describe("multiple instances", () =>
    {
        it("should have independent values", () =>
        {
            const module1 = new XModule();
            const module2 = new XModule();

            module1.ID = "id-1";
            module1.Name = "Module1";

            module2.ID = "id-2";
            module2.Name = "Module2";

            expect(module1.ID).toBe("id-1");
            expect(module1.Name).toBe("Module1");
            expect(module2.ID).toBe("id-2");
            expect(module2.Name).toBe("Module2");
        });
    });
});
