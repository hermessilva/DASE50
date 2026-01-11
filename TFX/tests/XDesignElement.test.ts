import { describe, it, expect } from "vitest";
import { XDesignElement } from "../src/Design/XDesignElement.js";
import { XPersistableElement } from "../src/Core/XPersistableElement.js";

class XMockDesignElement extends XDesignElement { }

describe("XDesignElement", () => {
    it("should be instantiable via subclass", () => {
        const element = new XMockDesignElement();
        expect(element).toBeDefined();
        expect(element).toBeInstanceOf(XDesignElement);
        expect(element).toBeInstanceOf(XPersistableElement);
    });
});
