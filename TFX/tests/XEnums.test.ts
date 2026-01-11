import { describe, it, expect } from "vitest";
import {
    XConstraintType,
    XPropertyGroup,
    XPropertyGroupDescription,
    XElementType
} from "../src/Core/XEnums.js";

describe("XConstraintType", () =>
{
    it("should have Dependence value as 1", () =>
    {
        expect(XConstraintType.Dependence).toBe(1);
    });

    it("should have Reference value as 2", () =>
    {
        expect(XConstraintType.Reference).toBe(2);
    });

    it("should have Child value as 4", () =>
    {
        expect(XConstraintType.Child).toBe(4);
    });

    it("should support bitwise operations", () =>
    {
        const combined = XConstraintType.Dependence | XConstraintType.Reference;
        expect(combined).toBe(3);

        const all = XConstraintType.Dependence | XConstraintType.Reference | XConstraintType.Child;
        expect(all).toBe(7);
    });

    it("should allow checking individual flags", () =>
    {
        const combined = XConstraintType.Dependence | XConstraintType.Child;

        expect((combined & XConstraintType.Dependence) !== 0).toBe(true);
        expect((combined & XConstraintType.Reference) !== 0).toBe(false);
        expect((combined & XConstraintType.Child) !== 0).toBe(true);
    });
});

describe("XPropertyGroup", () =>
{
    it("should have None value as 0", () =>
    {
        expect(XPropertyGroup.None).toBe(0);
    });

    it("should have Tenanttity value as 1", () =>
    {
        expect(XPropertyGroup.Tenanttity).toBe(1);
    });

    it("should have Behaviour value as 2", () =>
    {
        expect(XPropertyGroup.Behaviour).toBe(2);
    });

    it("should have Control value as 3", () =>
    {
        expect(XPropertyGroup.Control).toBe(3);
    });

    it("should have Appearance value as 4", () =>
    {
        expect(XPropertyGroup.Appearance).toBe(4);
    });

    it("should have Test value as 5", () =>
    {
        expect(XPropertyGroup.Test).toBe(5);
    });

    it("should have Design value as 6", () =>
    {
        expect(XPropertyGroup.Design).toBe(6);
    });

    it("should have Data value as 7", () =>
    {
        expect(XPropertyGroup.Data).toBe(7);
    });

    it("should have 8 distinct values", () =>
    {
        const values = new Set([
            XPropertyGroup.None,
            XPropertyGroup.Tenanttity,
            XPropertyGroup.Behaviour,
            XPropertyGroup.Control,
            XPropertyGroup.Appearance,
            XPropertyGroup.Test,
            XPropertyGroup.Design,
            XPropertyGroup.Data
        ]);
        expect(values.size).toBe(8);
    });
});

describe("XPropertyGroupDescription", () =>
{
    it("should have description for Tenanttity", () =>
    {
        expect(XPropertyGroupDescription[XPropertyGroup.Tenanttity]).toBe("Tenanttity");
    });

    it("should have description for Behaviour", () =>
    {
        expect(XPropertyGroupDescription[XPropertyGroup.Behaviour]).toBe("Behaviour");
    });

    it("should have description for Control", () =>
    {
        expect(XPropertyGroupDescription[XPropertyGroup.Control]).toBe("Control");
    });

    it("should have description for Appearance", () =>
    {
        expect(XPropertyGroupDescription[XPropertyGroup.Appearance]).toBe("Appearance");
    });

    it("should have description for Test", () =>
    {
        expect(XPropertyGroupDescription[XPropertyGroup.Test]).toBe("Test");
    });

    it("should have description for Design", () =>
    {
        expect(XPropertyGroupDescription[XPropertyGroup.Design]).toBe("Design");
    });

    it("should have description for Data", () =>
    {
        expect(XPropertyGroupDescription[XPropertyGroup.Data]).toBe("Data");
    });

    it("should not have description for None", () =>
    {
        expect(XPropertyGroupDescription[XPropertyGroup.None]).toBeUndefined();
    });

    it("should be accessible by numeric key", () =>
    {
        expect(XPropertyGroupDescription[1]).toBe("Tenanttity");
        expect(XPropertyGroupDescription[2]).toBe("Behaviour");
        expect(XPropertyGroupDescription[3]).toBe("Control");
        expect(XPropertyGroupDescription[4]).toBe("Appearance");
        expect(XPropertyGroupDescription[5]).toBe("Test");
        expect(XPropertyGroupDescription[6]).toBe("Design");
        expect(XPropertyGroupDescription[7]).toBe("Data");
    });

    it("should have 7 descriptions (excluding None)", () =>
    {
        const keys = Object.keys(XPropertyGroupDescription);
        expect(keys.length).toBe(7);
    });
});

describe("XElementType", () =>
{
    it("should have None value as 0", () =>
    {
        expect(XElementType.None).toBe(0);
    });

    it("should have OTRMTable value as 10", () =>
    {
        expect(XElementType.OTRMTable).toBe(10);
    });

    it("should have distinct values", () =>
    {
        expect(XElementType.None).not.toBe(XElementType.OTRMTable);
    });

    it("should be usable in switch statements", () =>
    {
        function getTypeName(pType: XElementType): string
        {
            switch (pType)
            {
                case XElementType.None: return "none";
                case XElementType.OTRMTable: return "otrm-table";
                default: return "unknown";
            }
        }

        expect(getTypeName(XElementType.None)).toBe("none");
        expect(getTypeName(XElementType.OTRMTable)).toBe("otrm-table");
    });

    it("should be comparable", () =>
    {
        expect(XElementType.None < XElementType.OTRMTable).toBe(true);
        expect(XElementType.OTRMTable > XElementType.None).toBe(true);
    });
});
