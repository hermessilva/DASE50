import { describe, it, expect } from "vitest";
import { XDocument } from "../src/Design/XDocument.js";
import { XDesignElement } from "../src/Design/XDesignElement.js";
import { XDesign } from "../src/Design/XDesign.js";

class XMockDesign extends XDesign { }
class XMockDocument extends XDocument<XMockDesign> { }

describe("XDocument", () => {
    it("should be instantiable via subclass", () => {
        const doc = new XMockDocument();
        expect(doc).toBeDefined();
        expect(doc).toBeInstanceOf(XDocument);
        expect(doc).toBeInstanceOf(XDesignElement);
    });
});
