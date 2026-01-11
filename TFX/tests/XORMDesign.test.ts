import { describe, it, expect } from "vitest";
import { XORMDesign } from "../src/Designers/ORM/XORMDesign.js";
import { XDesign } from "../src/Design/XDesign.js";

describe("XORMDesign", () => {
    it("should be instantiable", () => {
        const design = new XORMDesign();
        expect(design).toBeDefined();
        expect(design).toBeInstanceOf(XORMDesign);
        expect(design).toBeInstanceOf(XDesign);
    });
});
