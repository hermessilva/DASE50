import { XPersistableElement } from "../../Core/XPersistableElement.js";
import { XORMDataTuple } from "./XORMDataTuple.js";

/**
 * XORMDataSet — Seed/fixture data container for an ORM table.
 *
 * Holds a named collection of XORMDataTuple rows that represent pre-loaded
 * data for the owning table.  In the designer, datasets are non-visual: they
 * carry structured data but do not appear on the canvas.
 *
 * ClassID matches C# XORMDataSet: E91EE232-7BCE-4D6A-A206-3AB57EA85C88
 */
export class XORMDataSet extends XPersistableElement
{
    public constructor()
    {
        super();
    }

    /**
     * Returns the XORMDataTuple children of this dataset.
     */
    public GetTuples(): XORMDataTuple[]
    {
        return this.GetChildrenOfType(XORMDataTuple);
    }
}
