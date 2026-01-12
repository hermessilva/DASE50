import { describe, it, expect } from "vitest";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XLine } from "../src/Design/XLine.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";

describe("XORMReference", () => {
    it("should be instantiable", () => {
        const reference = new XORMReference();
        expect(reference).toBeDefined();
        expect(reference).toBeInstanceOf(XORMReference);
        expect(reference).toBeInstanceOf(XLine);
    });

    it("should deserialize Source/Target and Points from XML and validate all values", () => {
        RegisterORMElements();

        const expectedId = "4e51fbb0-7077-4373-aa19-91bb6073cf2a";
        const expectedName = "FK_NewTable";
        const expectedSource = "11111111-1111-1111-1111-111111111111";
        const expectedTarget = "22222222-2222-2222-2222-222222222222";

        const expectedPoints = [
            { X: 572, Y: 101 },
            { X: 708.5, Y: 101 },
            { X: 708.5, Y: 134 },
            { X: 845, Y: 134 }
        ];

        const xml = `<?xml version="1.0" encoding="utf-8"?>
<XORMReference ID="${expectedId}" Name="${expectedName}">
  <XValues>
    <XData Name="ID" ID="00000001-0001-0001-0001-000000000000" Type="String">${expectedId}</XData>
    <XData Name="Name" ID="00000001-0001-0001-0001-000000000006" Type="String">${expectedName}</XData>
    <XLinkData Name="Source" ID="00000001-0001-0001-0004-000000000010" Type="String" ElementID="${expectedSource}" Text="" DocumentID="" DocumentName="" ModuleID="" ModuleName="" DataEx="">${expectedSource}</XLinkData>
    <XLinkData Name="Target" ID="00000001-0001-0001-0004-000000000011" Type="String" ElementID="${expectedTarget}" Text="" DocumentID="" DocumentName="" ModuleID="" ModuleName="" DataEx="">${expectedTarget}</XLinkData>
    <XData Name="Points" ID="00000001-0001-0001-0004-000000000001" Type="Point[]">{X=572;Y=101}|{X=708.5;Y=101}|{X=708.5;Y=134}|{X=845;Y=134}</XData>
  </XValues>
</XORMReference>`;

        const engine = XSerializationEngine.Instance;
        const result = engine.Deserialize<XORMReference>(xml);

        expect(result.Success).toBe(true);
        expect(result.Data).toBeDefined();

        const reference = result.Data!;
        expect(reference).toBeInstanceOf(XORMReference);
        expect(reference).toBeInstanceOf(XLine);

        expect(reference.ID).toBe(expectedId);
        expect(reference.Name).toBe(expectedName);

        expect(reference.Source).toBe(expectedSource);
        expect(reference.Target).toBe(expectedTarget);

        expect(reference.Points).toBeDefined();
        expect(reference.Points.length).toBe(expectedPoints.length);

        for (let i = 0; i < expectedPoints.length; i++)
        {
            expect(reference.Points[i].X).toBe(expectedPoints[i].X);
            expect(reference.Points[i].Y).toBe(expectedPoints[i].Y);
        }
    });
});
