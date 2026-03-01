// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as vscode from 'vscode';
import { XTFXBridge } from '../../Services/TFXBridge';
import { XIssueItem } from '../../Models/IssueItem';
import { XPropertyItem, XPropertyType } from '../../Models/PropertyItem';

// Import real TFX library
import * as tfx from '@tootega/tfx';

describe('XTFXBridge', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    describe('GetSeedData', () => {
        it('should return null when element ID does not exist', () => {
            bridge.Initialize();

            const result = bridge.GetSeedData('nonexistent-id');

            expect(result).toBeNull();
        });

        it('should return null when element is not an XORMTable', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M' }));
            const designId = bridge.Controller.Design.ID;

            const result = bridge.GetSeedData(designId);

            expect(result).toBeNull();
        });

        it('should return seed payload with columns and empty rows for a table with no dataset', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [
                { ID: 'tbl1', Name: 'Products', X: 0, Y: 0, Width: 200, Height: 60,
                  Fields: [
                    { ID: 'f1', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                    { ID: 'f2', Name: 'ProductName', DataType: 'String' }
                  ]
                }
            ]}));

            const result = bridge.GetSeedData('tbl1');

            expect(result).not.toBeNull();
            expect(result!.TableID).toBe('tbl1');
            expect(result!.TableName).toBe('Products');
            expect(result!.Columns.length).toBeGreaterThan(0);
            expect(result!.Rows).toEqual([]);
        });

        it('should resolve FK options for a FK field when the referenced table has a dataset', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [
                { ID: 'cat-tbl', Name: 'Category', X: 0, Y: 0, Width: 200, Height: 60,
                  Fields: [{ ID: 'cat-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                },
                { ID: 'prod-tbl', Name: 'Product', X: 300, Y: 0, Width: 200, Height: 60,
                  Fields: [
                    { ID: 'prod-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                    { ID: 'fk-field', Name: 'CategoryID', DataType: 'Int32' }
                  ]
                }
            ], References: [{ ID: 'ref1', SourceFieldID: 'fk-field', TargetTableID: 'cat-tbl' }]}));

            // Mark the FK field as foreign key and add a dataset to the category table
            const design = bridge.Controller.Design;
            const fkField = design.GetTables().find((t: any) => t.ID === 'prod-tbl')
                ?.GetFields().find((f: any) => f.ID === 'fk-field');
            if (fkField)
                fkField.IsFK = true;

            const catTable = design.GetTables().find((t: any) => t.ID === 'cat-tbl');
            const ds = new tfx.XORMDataSet();
            ds.ID = tfx.XGuid.NewValue();
            ds.Name = 'T';
            catTable.AppendChild(ds);

            const tuple = new tfx.XORMDataTuple();
            tuple.ID = tfx.XGuid.NewValue();
            const fv = new tfx.XFieldValue();
            fv.ID = tfx.XGuid.NewValue();
            fv.FieldID = 'cat-pk';
            fv.Value = '1';
            tuple.AppendChild(fv);
            ds.AppendChild(tuple);

            const result = bridge.GetSeedData('prod-tbl');

            expect(result).not.toBeNull();
            const fkCol = result!.Columns.find(c => c.FieldID === 'fk-field');
            expect(fkCol).toBeDefined();
            expect(fkCol!.IsForeignKey).toBe(true);
            expect(fkCol!.FKOptions).toBeDefined();
            expect(fkCol!.FKOptions!.length).toBe(1);
            expect(fkCol!.FKOptions![0].Value).toBe('1');
        });

        it('should set empty FKOptions when the FK target table has no dataset', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [
                { ID: 'cat-tbl', Name: 'Category', X: 0, Y: 0, Width: 200, Height: 60,
                  Fields: [{ ID: 'cat-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                },
                { ID: 'prod-tbl', Name: 'Product', X: 300, Y: 0, Width: 200, Height: 60,
                  Fields: [
                    { ID: 'prod-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                    { ID: 'fk-field', Name: 'CategoryID', DataType: 'Int32' }
                  ]
                }
            ], References: [{ ID: 'ref1', SourceFieldID: 'fk-field', TargetTableID: 'cat-tbl' }]}));

            const fkField = bridge.Controller.Design.GetTables()
                .find((t: any) => t.ID === 'prod-tbl')
                ?.GetFields().find((f: any) => f.ID === 'fk-field');
            if (fkField)
                fkField.IsFK = true;

            const result = bridge.GetSeedData('prod-tbl');

            const fkCol = result!.Columns.find(c => c.FieldID === 'fk-field');
            expect(fkCol!.FKOptions).toEqual([]);
        });

        it('should return existing rows from the table dataset', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [
                { ID: 'tbl1', Name: 'Items', X: 0, Y: 0, Width: 200, Height: 60,
                  Fields: [{ ID: 'f1', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                }
            ]}));

            const table = bridge.Controller.Design.GetTables()[0];
            const ds = new tfx.XORMDataSet();
            ds.ID = tfx.XGuid.NewValue();
            ds.Name = 'T';
            table.AppendChild(ds);

            const tuple = new tfx.XORMDataTuple();
            tuple.ID = 'row-1';
            const fv = new tfx.XFieldValue();
            fv.ID = tfx.XGuid.NewValue();
            fv.FieldID = 'f1';
            fv.Value = '42';
            tuple.AppendChild(fv);
            ds.AppendChild(tuple);

            const result = bridge.GetSeedData('tbl1');

            expect(result!.Rows.length).toBe(1);
            expect(result!.Rows[0].TupleID).toBe('row-1');
            expect(result!.Rows[0].Values['f1']).toBe('42');
        });
    });

    describe('SaveSeedData', () => {
        it('should return error result when table is not found', () => {
            bridge.Initialize();

            const result = bridge.SaveSeedData('nonexistent-id', []);

            expect(result.Success).toBe(false);
            expect(result.Message).toContain('Table not found');
        });

        it('should create a new dataset and persist rows', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [
                { ID: 'tbl1', Name: 'Items', X: 0, Y: 0, Width: 200, Height: 60,
                  Fields: [{ ID: 'f1', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                }
            ]}));

            const result = bridge.SaveSeedData('tbl1', [{ TupleID: 'NEW', Values: { 'f1': '10' } }]);

            expect(result.Success).toBe(true);
            const payload = bridge.GetSeedData('tbl1');
            expect(payload!.Rows.length).toBe(1);
            expect(payload!.Rows[0].Values['f1']).toBe('10');
        });

        it('should replace existing rows when saving new rows', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [
                { ID: 'tbl1', Name: 'Items', X: 0, Y: 0, Width: 200, Height: 60,
                  Fields: [{ ID: 'f1', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                }
            ]}));

            bridge.SaveSeedData('tbl1', [
                { TupleID: 'NEW', Values: { 'f1': '1' } },
                { TupleID: 'NEW', Values: { 'f1': '2' } }
            ]);

            const result = bridge.SaveSeedData('tbl1', [{ TupleID: 'row-x', Values: { 'f1': '99' } }]);

            expect(result.Success).toBe(true);
            const payload = bridge.GetSeedData('tbl1');
            expect(payload!.Rows.length).toBe(1);
            expect(payload!.Rows[0].Values['f1']).toBe('99');
        });

        it('should clear all rows when saving an empty array', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'M', Tables: [
                { ID: 'tbl1', Name: 'Items', X: 0, Y: 0, Width: 200, Height: 60,
                  Fields: [{ ID: 'f1', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                }
            ]}));

            bridge.SaveSeedData('tbl1', [{ TupleID: 'NEW', Values: { 'f1': '1' } }]);

            const clearResult = bridge.SaveSeedData('tbl1', []);

            expect(clearResult.Success).toBe(true);
            expect(bridge.GetSeedData('tbl1')!.Rows).toEqual([]);
        });
    });

});
