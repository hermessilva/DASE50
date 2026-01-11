import { describe, it, expect } from "vitest";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XLine } from "../src/Design/XLine.js";

describe("XORMReference", () => {
    it("should be instantiable", () => {
        const reference = new XORMReference();
        expect(reference).toBeDefined();
        expect(reference).toBeInstanceOf(XORMReference);
        expect(reference).toBeInstanceOf(XLine);
    });
});
