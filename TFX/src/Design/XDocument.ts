import type { XDesign } from "./XDesign.js";
import { XDesignElement } from "./XDesignElement.js";

export abstract class XDocument<T extends XDesign> extends XDesignElement
{
    public constructor()
    {
        super();
    }

    protected PDesign: T | null = null;

    public get Design(): T | null
    {
        return this.PDesign;
    }
}