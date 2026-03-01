import { XORMField } from "./XORMField.js";

/**
 * XORMFKField — Foreign Key field in an ORM table.
 *
 * Represents a field that holds a foreign key reference to another table's PK.
 * The DataType is read-only in the UI (enforced via metadata provider) and must
 * match the target table's PKType.
 *
 * ClassID matches C# XORMFKField: ECECC3B6-FA88-4B38-ACCF-912A3CA55547
 */
export class XORMFKField extends XORMField
{
    /**
     * FK fields always have IsFK = true.
     * Overrides the stored XProperty so callers always get a reliable value.
     */
    public override get IsFK(): boolean
    {
        return true;
    }

    public override set IsFK(_pValue: boolean)
    {
        // No-op — FK fields are always FK by definition.
    }

    /**
     * FK fields are always foreign keys by definition, regardless of whether
     * a XORMReference exists in the design (C# model vs TS model difference).
     */
    public override get IsForeignKey(): boolean
    {
        return true;
    }
}
