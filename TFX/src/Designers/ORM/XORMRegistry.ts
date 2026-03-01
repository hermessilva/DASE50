import { XElementRegistry } from "../../Data/XElementRegistry.js";
import { XORMDocument } from "./XORMDocument.js";
import { XORMDesign } from "./XORMDesign.js";
import { XORMTable } from "./XORMTable.js";
import { XORMField } from "./XORMField.js";
import { XORMPKField } from "./XORMPKField.js";
import { XORMReference } from "./XORMReference.js";

let _Registered = false;

export function RegisterORMElements(): void
{
    if (_Registered)
        return;

    const registry = XElementRegistry.Instance;

    // ClassIDs match the C# [XRegister] CIDs for cross-version file compatibility.
    // C# source: TFX.DASE.Designer.Core.ORM / TFX.DASE.Core.Objects
    registry.Register({
        TagName: "XORMDocument",
        Constructor: XORMDocument,
        ClassID: "98349501-8203-4A11-AE2B-D8BDEEAA3405"
    });

    // C# serializes the design canvas as <XORMDesigner>. Registering the alias first
    // ensures the canonical TS TagName "XORMDesign" wins the constructor-lookup map.
    registry.Register({
        TagName: "XORMDesigner",
        Constructor: XORMDesign,
        ClassID: "44EFB296-D6D3-4685-AB0D-65C0424E5C1A"
    });

    // Canonical TS TagName registered last — overwrites _ByConstructor so serialization
    // always emits <XORMDesign> while deserialization still accepts <XORMDesigner>.
    registry.Register({
        TagName: "XORMDesign",
        Constructor: XORMDesign,
        ClassID: "44EFB296-D6D3-4685-AB0D-65C0424E5C1A"
    });

    registry.Register({
        TagName: "XORMTable",
        Constructor: XORMTable,
        ClassID: "1B77140B-34E5-4651-B734-66F614BB1F6A"
    });

    registry.Register({
        TagName: "XORMField",
        Constructor: XORMField,
        ClassID: "13BBF0C8-ECED-4C9C-B877-F77D59430CF4"
    });

    registry.Register({
        TagName: "XORMPKField",
        Constructor: XORMPKField,
        ClassID: "2C6EBAEC-2425-4A2E-8E5F-DD1784D2964C"
    });

    registry.Register({
        TagName: "XORMReference",
        Constructor: XORMReference,
        ClassID: "404E9B2A-C6F9-4B3D-88A1-DB30DB965259"
    });

    // C# types not yet implemented in TS — reserved ClassIDs for future migration.
    // XORMFKField:   ECECC3B6-FA88-4B38-ACCF-912A3CA55547
    // XORMIndex:     22F0A974-7CE7-41E5-AE23-3EE6B49FC848
    // XORMView:      84F31F62-6445-4DB3-A80E-D7CE61643345
    // XORMStateField:      (see XORMStateField.cs — read CID on demand)
    // XORMStateReference:  (see XORMStateReference.cs — read CID on demand)

    registry.RegisterChildTag("XORMDocument", "XORMDesign");
    registry.RegisterChildTag("XORMDocument", "XORMDesigner");
    registry.RegisterChildTag("XORMDesign", "XORMTable");
    registry.RegisterChildTag("XORMDesign", "XORMReference");
    registry.RegisterChildTag("XORMDesigner", "XORMTable");
    registry.RegisterChildTag("XORMDesigner", "XORMReference");
    registry.RegisterChildTag("XORMTable", "XORMField");
    registry.RegisterChildTag("XORMTable", "XORMPKField");

    _Registered = true;
}
