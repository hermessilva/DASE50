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

    public override Initialize(): void
    {
        super.Initialize();
        
        // After deserialization, there may be multiple XORMDesign children:
        // 1. The auto-created empty one from the constructor
        // 2. The deserialized one(s) with actual content
        // We need to find the deserialized one and use it as the active design
        
        const allDesigns = this.ChildNodes.filter(
            child => child instanceof XORMDesign
        ) as XORMDesign[];
        
        if (allDesigns.length > 1)
        {
            // Find the deserialized design (the one that has content or is loaded)
            // The deserialized design will have _IsLoaded = true after Initialize is called
            // But at this point during Initialize, we need another way to distinguish
            // The deserialized one typically has tables or was marked as loaded
            const deserializedDesign = allDesigns.find(d => d !== this.PDesign && d.ChildNodes.length > 0)
                || allDesigns.find(d => d !== this.PDesign);
            
            if (deserializedDesign && deserializedDesign !== this.PDesign)
            {
                // Remove the auto-created empty design
                const emptyDesignIndex = this.ChildNodes.indexOf(this.PDesign!);
                if (emptyDesignIndex >= 0)
                    this.ChildNodes.splice(emptyDesignIndex, 1);
                
                this.PDesign = deserializedDesign;
            }
        }
    }
}