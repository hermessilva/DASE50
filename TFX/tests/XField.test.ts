import { describe, it, expect } from "vitest";
import { XField } from "../src/Design/XField.js";
import { XRectangle } from "../src/Design/XRectangle.js";

class XMockField extends XField { }

describe("XField", () => {
    it("should be instantiable via subclass", () => {
        const field = new XMockField();
        expect(field).toBeDefined();
        expect(field).toBeInstanceOf(XField);
        expect(field).toBeInstanceOf(XRectangle);
    });
});
