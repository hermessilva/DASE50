// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as fs from 'fs';
import * as path from 'path';

import { XTFXBridge } from '../../Services/TFXBridge';
import { XPropertyItem } from '../../Models/PropertyItem';

function expectPropValue(props: XPropertyItem[], key: string, expected: unknown): void {
    const prop = props.find(p => p.Key === key);
    expect(prop).toBeDefined();
    expect(prop!.Value).toEqual(expected);
}

describe('Modelo.dsorm', () => {
    it('should deserialize all objects and properties from XML model', async () => {
        const modeloPath = path.resolve(__dirname, '..', 'Resources', 'Modelo.dsorm');
        const xmlText = fs.readFileSync(modeloPath, 'utf8');

        const bridge = new XTFXBridge();
        const doc = await bridge.LoadOrmModelFromText(xmlText);

        expect(doc).toBeDefined();
        expect(doc.Name).toBe('ORM Model');
        // ID is stored as a GUID string in the file; ensure it survived round-trip as a string.
        expect(String((doc as any).ID)).toBe('882ed50a-b60d-4d01-99af-97c1b29331b3');

        const model = bridge.GetModelData();

        expect(model.Tables).toHaveLength(2);
        expect(model.References).toHaveLength(1);

        const table1Id = '3e3593fa-d9c2-4d3c-9fed-9e79ad88c3ad';
        const table2Id = 'ff9a6544-1f6f-4560-9b73-8143f7c49df8';
        const fieldId = '78ef0a68-638c-4b98-811f-98f2eccfb207';
        const refId = 'd77d186e-51e3-4dc8-af9c-e9694531ccff';

        const table1 = model.Tables.find(t => t.ID === table1Id);
        const table2 = model.Tables.find(t => t.ID === table2Id);
        expect(table1).toBeDefined();
        expect(table2).toBeDefined();

        expect(table1).toMatchObject({
            ID: table1Id,
            Name: 'NewTable',
            X: 472,
            Y: 95,
            Width: 200,
            Height: 150,
        });
        expect(table1!.Fields).toEqual([]);

        expect(table2).toMatchObject({
            ID: table2Id,
            Name: 'NewTable',
            X: 887,
            Y: 354,
            Width: 200,
            Height: 150,
        });
        expect(table2!.Fields).toHaveLength(1);
        expect(table2!.Fields[0]).toMatchObject({
            ID: fieldId,
            Name: 'NewTableID',
        });

        const reference = model.References.find(r => r.ID === refId);
        expect(reference).toBeDefined();
        expect(reference).toMatchObject({
            ID: refId,
            Name: 'FK_NewTable',
            SourceFieldID: fieldId,
            TargetTableID: table1Id,
        });

        // Points are explicitly defined in the file and must be deserialized.
        expect(reference!.Points).toEqual([
            { X: 887, Y: 394 },
            { X: 779.5, Y: 394 },
            { X: 779.5, Y: 170 },
            { X: 672, Y: 170 },
        ]);

        // Validate element properties exposed by the bridge.
        const table1Props = bridge.GetProperties(table1Id);
        expectPropValue(table1Props, 'ID', table1Id);
        expectPropValue(table1Props, 'Name', 'NewTable');
        expectPropValue(table1Props, 'X', 472);
        expectPropValue(table1Props, 'Y', 95);
        expectPropValue(table1Props, 'Width', 200);
        expectPropValue(table1Props, 'Height', 150);

        const fieldProps = bridge.GetProperties(fieldId);
        expectPropValue(fieldProps, 'ID', fieldId);
        expectPropValue(fieldProps, 'Name', 'NewTableID');

        const refProps = bridge.GetProperties(refId);
        expectPropValue(refProps, 'ID', refId);
        expectPropValue(refProps, 'Name', 'FK_NewTable');
        expectPropValue(refProps, 'Source', fieldId);
        expectPropValue(refProps, 'Target', table1Id);
    });
});
