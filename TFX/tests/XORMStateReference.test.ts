import { describe, it, expect } from "vitest";
import { XORMStateReference } from "../src/Designers/ORM/XORMStateReference.js";
import { XORMReference } from "../src/Designers/ORM/XORMReference.js";
import { XLine } from "../src/Design/XLine.js";
import { XColor } from "../src/Core/XGeometry.js";
import { XSerializationEngine } from "../src/Data/XSerializationEngine.js";
import { RegisterORMElements } from "../src/Designers/ORM/XORMRegistry.js";

describe("XORMStateReference", () => {
    it("should extend XORMReference and XLine", () => {
        const ref = new XORMStateReference();
        expect(ref).toBeInstanceOf(XORMStateReference);
        expect(ref).toBeInstanceOf(XORMReference);
        expect(ref).toBeInstanceOf(XLine);
    });

    it("should always return transparent stroke regardless of value set", () => {
        const ref = new XORMStateReference();
        expect(ref.Stroke.IsTransparent).toBe(true);
    });

    it("should always return stroke thickness 0", () => {
        const ref = new XORMStateReference();
        expect(ref.StrokeThickness).toBe(0);
    });

    it("should always return IsVisible = false", () => {
        const ref = new XORMStateReference();
        expect(ref.IsVisible).toBe(false);
    });

    it("should ignore stroke assignments and remain transparent", () => {
        const ref = new XORMStateReference();
        ref.Stroke = XColor.Black;
        expect(ref.Stroke.IsTransparent).toBe(true);

        ref.Stroke = XColor.Red;
        expect(ref.Stroke.IsTransparent).toBe(true);
    });

    it("should ignore stroke thickness assignments and remain 0", () => {
        const ref = new XORMStateReference();
        ref.StrokeThickness = 5;
        expect(ref.StrokeThickness).toBe(0);
    });

    it("should preserve Source, Target and Points independently of stroke", () => {
        const ref = new XORMStateReference();
        ref.Source = "aaaaaaaa-0000-0000-0000-000000000001";
        ref.Target = "bbbbbbbb-0000-0000-0000-000000000002";
        expect(ref.Source).toBe("aaaaaaaa-0000-0000-0000-000000000001");
        expect(ref.Target).toBe("bbbbbbbb-0000-0000-0000-000000000002");
        expect(ref.Stroke.IsTransparent).toBe(true);
        expect(ref.StrokeThickness).toBe(0);
        expect(ref.IsVisible).toBe(false);
    });

    it("should deserialize from <XORMStateReference> XML tag and produce transparent stroke", () => {
        RegisterORMElements();

        const id = "cccccccc-0000-0000-0000-000000000003";
        const source = "dddddddd-0000-0000-0000-000000000004";
        const target = "eeeeeeee-0000-0000-0000-000000000005";

        const xml = `<?xml version="1.0" encoding="utf-8"?>
<XORMStateReference ID="${id}" Name="SR_Test">
  <XValues>
    <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">${id}</XData>
    <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">SR_Test</XData>
    <XLinkData Name="Source" ID="8A8851EB-B6CA-414F-B55A-C22A6A0F3753" Type="String" ElementID="${source}" Text="" DocumentID="" DocumentName="" ModuleID="" ModuleName="" DataEx="">${source}</XLinkData>
    <XLinkData Name="Target" ID="6461BED3-F1A0-4910-985D-9F0B0058D8BF" Type="String" ElementID="${target}" Text="" DocumentID="" DocumentName="" ModuleID="" ModuleName="" DataEx="">${target}</XLinkData>
    <XData Name="Points" ID="E2378CBF-8185-465D-8215-142922E96006" Type="Point[]">{X=10;Y=20}|{X=30;Y=40}</XData>
    <XData Name="Stroke" ID="00000001-0001-0001-0004-000000000005" Type="Color">#FF000000</XData>
  </XValues>
</XORMStateReference>`;

        const result = XSerializationEngine.Instance.Deserialize<XORMStateReference>(xml);

        expect(result.Success).toBe(true);
        const ref = result.Data!;
        expect(ref).toBeInstanceOf(XORMStateReference);
        expect(ref.ID).toBe(id);
        expect(ref.Source).toBe(source);
        expect(ref.Target).toBe(target);
        expect(ref.Points).toHaveLength(2);
        expect(ref.Stroke.IsTransparent).toBe(true);
        expect(ref.StrokeThickness).toBe(0);
        expect(ref.IsVisible).toBe(false);
    });
});
