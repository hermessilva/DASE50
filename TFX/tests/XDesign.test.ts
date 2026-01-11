import { describe, it, expect } from "vitest";
import { XDesign } from "../src/Design/XDesign.js";
import { XRectangle } from "../src/Design/XRectangle.js";

class XMockDesign extends XDesign { }

describe("XDesign", () => {
    it("should be instantiable via subclass", () => {
        const design = new XMockDesign();
        expect(design).toBeDefined();
        expect(design).toBeInstanceOf(XDesign);
        expect(design).toBeInstanceOf(XRectangle);
    });
});
