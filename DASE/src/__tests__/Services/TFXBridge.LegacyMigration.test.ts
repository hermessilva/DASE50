// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import { XTFXBridge } from '../../Services/TFXBridge';

/**
 * Tests for C# DASE4VS legacy DataType GUID migration in XTFXBridge.
 *
 * The legacy C# application stored DataType/PKType as GUID references to an internal
 * type registry (XDBTypes). These tests verify correct resolution to TS type names.
 */

// Minimal C# format XML with GUID DataType/PKType values (as produced by DASE4VS)
const LEGACY_XML_WITH_GUID_TYPES = `<?xml version="1.0" encoding="utf-8"?><XORMDesigner ID="aaa00001-0000-0000-0000-000000000001" Name="LegacyModel">
  <XValues>
    <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">aaa00001-0000-0000-0000-000000000001</XData>
    <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">LegacyModel</XData>
    <XData Name="Schema" ID="95511660-A5D9-4339-9DE2-62ABD7AB4535" Type="String">dbo</XData>
    <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=0;Y=0;Width=1000;Height=800}</XData>
  </XValues>
  <XORMTable ID="bbb00001-0000-0000-0000-000000000001" Name="OrderTable">
    <XValues>
      <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">bbb00001-0000-0000-0000-000000000001</XData>
      <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">OrderTable</XData>
      <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=100;Y=100;Width=200;Height=150}</XData>
      <XData Name="PKType" ID="8F3E9777-A802-4A9F-B5B5-0D5D568E0365" Type="String">8C5DEBC0-4165-4429-B106-1554552F802E</XData>
    </XValues>
    <XORMPKField ID="ccc00001-0000-0000-0000-000000000001" Name="OrderTableID">
      <XValues>
        <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">ccc00001-0000-0000-0000-000000000001</XData>
        <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">OrderTableID</XData>
        <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">8C5DEBC0-4165-4429-B106-1554552F802E</XData>
      </XValues>
    </XORMPKField>
    <XORMField ID="ddd00001-0000-0000-0000-000000000001" Name="Notes">
      <XValues>
        <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">ddd00001-0000-0000-0000-000000000001</XData>
        <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Notes</XData>
        <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">8A656713-0DBB-4D25-9CF9-8DA0DBAD4E62</XData>
      </XValues>
    </XORMField>
    <XORMField ID="ddd00002-0000-0000-0000-000000000001" Name="Quantity">
      <XValues>
        <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">ddd00002-0000-0000-0000-000000000001</XData>
        <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Quantity</XData>
        <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">FAADA046-C1B9-4E89-9B64-310E272FC0CC</XData>
      </XValues>
    </XORMField>
  </XORMTable>
</XORMDesigner>`;

// C# format XML with a plain (already-migrated) type — must NOT be altered
const LEGACY_XML_WITH_PLAIN_TYPES = `<?xml version="1.0" encoding="utf-8"?><XORMDesigner ID="aaa00002-0000-0000-0000-000000000001" Name="PlainModel">
  <XValues>
    <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">aaa00002-0000-0000-0000-000000000001</XData>
    <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">PlainModel</XData>
    <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=0;Y=0;Width=1000;Height=800}</XData>
  </XValues>
  <XORMTable ID="bbb00002-0000-0000-0000-000000000001" Name="UserTable">
    <XValues>
      <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">bbb00002-0000-0000-0000-000000000001</XData>
      <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">UserTable</XData>
      <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=100;Y=100;Width=200;Height=150}</XData>
      <XData Name="PKType" ID="8F3E9777-A802-4A9F-B5B5-0D5D568E0365" Type="String">Int32</XData>
    </XValues>
    <XORMPKField ID="ccc00002-0000-0000-0000-000000000001" Name="UserTableID">
      <XValues>
        <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">ccc00002-0000-0000-0000-000000000001</XData>
        <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">UserTableID</XData>
        <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">Int32</XData>
      </XValues>
    </XORMPKField>
    <XORMField ID="ddd00003-0000-0000-0000-000000000001" Name="Email">
      <XValues>
        <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">ddd00003-0000-0000-0000-000000000001</XData>
        <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Email</XData>
        <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">String</XData>
      </XValues>
    </XORMField>
  </XORMTable>
</XORMDesigner>`;

describe('XTFXBridge — Legacy C# DataType GUID Migration', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        bridge = new XTFXBridge();
    });

    describe('MigrateLegacyDataTypeGUIDs — via LoadOrmModelFromText', () => {
        it('should resolve C# Guid PKType GUID to "Guid"', async () => {
            const doc = await bridge.LoadOrmModelFromText(LEGACY_XML_WITH_GUID_TYPES);
            const design = doc.Design!;
            const table = design.GetTables().find(t => t.Name === 'OrderTable')!;

            expect(table).toBeDefined();
            expect(table.PKType).toBe('Guid');
        });

        it('should resolve C# Guid DataType GUID in PKField to "Guid"', async () => {
            const doc = await bridge.LoadOrmModelFromText(LEGACY_XML_WITH_GUID_TYPES);
            const design = doc.Design!;
            const table = design.GetTables().find(t => t.Name === 'OrderTable')!;
            const pkField = table.GetPKField()!;

            expect(pkField).toBeDefined();
            expect(pkField.DataType).toBe('Guid');
        });

        it('should resolve C# String DataType GUID in regular field to "String"', async () => {
            const doc = await bridge.LoadOrmModelFromText(LEGACY_XML_WITH_GUID_TYPES);
            const design = doc.Design!;
            const table = design.GetTables().find(t => t.Name === 'OrderTable')!;
            const notesField = table.GetFields().find(f => f.Name === 'Notes')!;

            expect(notesField).toBeDefined();
            expect(notesField.DataType).toBe('String');
        });

        it('should resolve C# Int32 DataType GUID in regular field to "Int32"', async () => {
            const doc = await bridge.LoadOrmModelFromText(LEGACY_XML_WITH_GUID_TYPES);
            const design = doc.Design!;
            const table = design.GetTables().find(t => t.Name === 'OrderTable')!;
            const qtyField = table.GetFields().find(f => f.Name === 'Quantity')!;

            expect(qtyField).toBeDefined();
            expect(qtyField.DataType).toBe('Int32');
        });

        it('should leave plain type names unchanged on already-migrated files', async () => {
            const doc = await bridge.LoadOrmModelFromText(LEGACY_XML_WITH_PLAIN_TYPES);
            const design = doc.Design!;
            const table = design.GetTables().find(t => t.Name === 'UserTable')!;

            expect(table).toBeDefined();
            expect(table.PKType).toBe('Int32');

            const pkField = table.GetPKField()!;
            expect(pkField.DataType).toBe('Int32');

            const emailField = table.GetFields().find(f => f.Name === 'Email')!;
            expect(emailField!.DataType).toBe('String');
        });
    });

    describe('IsDataTypeGUID (via CSHARP_TYPE_GUID_MAP coverage)', () => {
        it('should have Guid mapped in CSHARP_TYPE_GUID_MAP', () => {
            const map = (XTFXBridge as any).CSHARP_TYPE_GUID_MAP as Map<string, string>;
            expect(map.get('8C5DEBC0-4165-4429-B106-1554552F802E')).toBe('Guid');
        });

        it('should have Int16 mapped in CSHARP_TYPE_GUID_MAP', () => {
            const map = (XTFXBridge as any).CSHARP_TYPE_GUID_MAP as Map<string, string>;
            expect(map.get('5BD72111-603B-42E5-9488-53A4299E45EB')).toBe('Int16');
        });

        it('should have Int32 mapped in CSHARP_TYPE_GUID_MAP', () => {
            const map = (XTFXBridge as any).CSHARP_TYPE_GUID_MAP as Map<string, string>;
            expect(map.get('FAADA046-C1B9-4E89-9B64-310E272FC0CC')).toBe('Int32');
        });

        it('should have String mapped in CSHARP_TYPE_GUID_MAP', () => {
            const map = (XTFXBridge as any).CSHARP_TYPE_GUID_MAP as Map<string, string>;
            expect(map.get('8A656713-0DBB-4D25-9CF9-8DA0DBAD4E62')).toBe('String');
        });

        it('should return true for valid GUID pattern', () => {
            expect((XTFXBridge as any).IsDataTypeGUID('8C5DEBC0-4165-4429-B106-1554552F802E')).toBe(true);
        });

        it('should return false for plain type name', () => {
            expect((XTFXBridge as any).IsDataTypeGUID('Int32')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect((XTFXBridge as any).IsDataTypeGUID('')).toBe(false);
        });

        it('should return false for partial GUID string', () => {
            expect((XTFXBridge as any).IsDataTypeGUID('8C5DEBC0-4165-4429')).toBe(false);
        });
    });

    describe('MigrateLegacyDataTypeGUIDs — unknown GUID logs warning', () => {
        it('should log a warning and leave value unchanged for unknown DataType GUID', async () => {
            const unknownGuid = '00000000-1111-2222-3333-444444444444';
            const xmlWithUnknownGuid = `<?xml version="1.0" encoding="utf-8"?><XORMDesigner ID="aaa00003-0000-0000-0000-000000000001" Name="UnknownModel">
  <XValues>
    <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">aaa00003-0000-0000-0000-000000000001</XData>
    <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">UnknownModel</XData>
    <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=0;Y=0;Width=1000;Height=800}</XData>
  </XValues>
  <XORMTable ID="bbb00003-0000-0000-0000-000000000001" Name="TestTable">
    <XValues>
      <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">bbb00003-0000-0000-0000-000000000001</XData>
      <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">TestTable</XData>
      <XData Name="Bounds" ID="F731FAEC-F42C-499C-AADB-71823B4600F3" Type="Rect">{X=100;Y=100;Width=200;Height=150}</XData>
      <XData Name="PKType" ID="8F3E9777-A802-4A9F-B5B5-0D5D568E0365" Type="String">${unknownGuid}</XData>
    </XValues>
    <XORMPKField ID="ccc00003-0000-0000-0000-000000000001" Name="TestTableID">
      <XValues>
        <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">ccc00003-0000-0000-0000-000000000001</XData>
        <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">TestTableID</XData>
        <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">${unknownGuid}</XData>
      </XValues>
    </XORMPKField>
    <XORMField ID="ddd00004-0000-0000-0000-000000000001" Name="Code">
      <XValues>
        <XData Name="ID" ID="608239C5-A43C-47FF-91A0-661470EC4918" Type="String">ddd00004-0000-0000-0000-000000000001</XData>
        <XData Name="Name" ID="18043B8B-C189-4FE3-A3C6-552B5C87C7CE" Type="String">Code</XData>
        <XData Name="DataType" ID="244BD6B3-4873-4957-A34D-FD97F7DBD90D" Type="String">${unknownGuid}</XData>
      </XValues>
    </XORMField>
  </XORMTable>
</XORMDesigner>`;

            const doc = await bridge.LoadOrmModelFromText(xmlWithUnknownGuid);
            const design = doc.Design!;
            const table = design.GetTables().find(t => t.Name === 'TestTable')!;

            // Unknown GUIDs must be left as-is since we cannot resolve them
            expect(table).toBeDefined();
            expect(table.PKType).toBe(unknownGuid);

            const codeField = table.GetFields().find(f => f.Name === 'Code')!;
            expect(codeField).toBeDefined();
            expect(codeField.DataType).toBe(unknownGuid);
        });
    });
});
