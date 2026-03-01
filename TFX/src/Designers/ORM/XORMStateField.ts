import { XORMFKField } from "./XORMFKField.js";

/**
 * XORMStateField — State/status foreign key field in an ORM table.
 *
 * A specialised FK field that references a cached "status" or "state" table
 * (e.g. a lookup/enum table such as CORxStatus).  It is identical to XORMFKField
 * in terms of data but carries additional semantic meaning:
 *
 * - The referenced table is expected to be a small, cached, read-only dataset.
 * - The field has no independent visual representation in the designer canvas
 *   (IsVisible = false), because its relationship is shown with a XORMStateReference.
 *
 * ClassID matches C# XORMStateField: 04723469-0FAC-4244-8E26-D883EE1A7099
 */
export class XORMStateField extends XORMFKField
{
    /**
     * State fields have no independent visual representation in the canvas.
     * Their relationship is rendered through a XORMStateReference instead.
     */
    public override get IsVisible(): boolean
    {
        return false;
    }
}
