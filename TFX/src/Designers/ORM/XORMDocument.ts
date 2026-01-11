import { XDocument } from "../../Design/XDocument.js";
import { XORMDesign } from "./XORMDesign.js";

export class XORMDocument extends XDocument<XORMDesign>
{
    public constructor()
    {
        super();
        this.PDesign = new XORMDesign();
        this.AppendChild(this.PDesign);
    }
}