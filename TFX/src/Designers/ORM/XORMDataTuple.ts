import { XPersistableElement } from "../../Core/XPersistableElement.js";
import { XFieldValue } from "./XFieldValue.js";

/**
 * XORMDataTuple — A single data row inside an XORMDataSet.
 *
 * Contains one XFieldValue per field in the owning table, representing a
 * complete row of seed/fixture data (e.g. a status enum row).
 * Inherits ParentID from XPersistableElement for cross-document link support.
 *
 * ClassID matches C# XORMDataTuple: A853318D-7D3C-48B9-8279-BAF404C0344C
 */
export class XORMDataTuple extends XPersistableElement
{
    public constructor()
    {
        super();
    }

    /**
     * Returns all XFieldValue children for this tuple.
     */
    public GetFieldValues(): XFieldValue[]
    {
        return this.GetChildrenOfType(XFieldValue);
    }
}
