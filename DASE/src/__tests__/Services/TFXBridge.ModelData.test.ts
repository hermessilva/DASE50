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

    describe('GetModelData', () => {
        it('should return empty data when not initialized', async () => {
            // Cria bridge mas mocka Controller.Document para ser null
            const newBridge = new XTFXBridge();
            await newBridge.LoadOrmModelFromText('{}');
            // Força Document para null para testar o branch
            (newBridge as any)._Controller.Document = null;
            
            const data = await newBridge.GetModelData();


            expect(data).toEqual({ Tables: [], References: [] });
        });

        it('should return tables and references', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);
            // Garante que Document.Design existe
            bridge.Controller.Document = { Design: {} };

            const data = await bridge.GetModelData();

            expect(data).toHaveProperty('Tables');
            expect(data).toHaveProperty('References');
            expect(Array.isArray(data.Tables)).toBe(true);
            expect(Array.isArray(data.References)).toBe(true);
        });

        it('should return empty data when Design is null', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.Document = { Design: null };

            const data = await bridge.GetModelData();

            expect(data).toEqual({ Tables: [], References: [] });
        });

        it('should map table data correctly with fields', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockField = {
                ID: 'field-1',
                Name: 'UserID',
                DataType: 'Integer',
                IsPrimaryKey: true,
                IsRequired: true
            };
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([mockField])
            };
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Orders_Users',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 100, Y: 200 }, { X: 300, Y: 400 }]
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.Tables.length).toBe(1);
            expect(data.Tables[0].ID).toBe('table-1');
            expect(data.Tables[0].Name).toBe('Users');
            expect(data.Tables[0].Fields.length).toBe(1);
            expect(data.References.length).toBe(1);
            expect(data.References[0].Points.length).toBe(2);
        });

        it('should include FillProp when table has Fill color', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: { ToString: () => 'FF00FF00' },  // Green color
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#00FF00');
        });

        it('should not include FillProp when table has no Fill', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: null,
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBeUndefined();
        });

        it('should handle Fill as string starting with #', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: '#FF0000',
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#FF0000');
        });

        it('should handle Fill as string not starting with #', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: 'FFFF0000',
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#FF0000');
        });

        it('should handle Fill with ToString function (XColor object)', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockColor = {
                ToString: jest.fn().mockReturnValue('FFFF0000')
            };
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: mockColor,
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#FF0000');
            expect(mockColor.ToString).toHaveBeenCalled();
        });

        it('should handle Fill as plain string in GetModelData (edge case - line 586)', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Create object without ToString method to test String() conversion
            const fillObj = Object.create(null);
            Object.assign(fillObj, { value: '#FF0000' });
            
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: '#FF0000', // Plain string (not starting with #) to test else branch
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].FillProp).toBe('#FF0000');
        });

        it('should not set FillProp when Fill is object without ToString and not string (line 586 false branch)', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Fill is an object without ToString method and not a string
            // This tests when typeof t.Fill === 'string' returns false
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 100, Top: 200, Width: 200, Height: 150 },
                Fill: 12345, // Number, not a string, no ToString as function
                GetChildrenOfType: jest.fn().mockReturnValue([])
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            // Fill should not be processed since it's neither XColor nor string
            expect(data.Tables[0].FillProp).toBeUndefined();
        });

        it('should handle references with Source/Target properties', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_Test',
                Source: 'src-field',
                Target: 'tgt-table',
                Points: null
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.References[0].SourceFieldID).toBe('src-field');
            expect(data.References[0].TargetTableID).toBe('tgt-table');
            expect(data.References[0].Points).toEqual([]);
        });

        it('should set IsOneToOne=true when source field is PK', async () => {
            await bridge.LoadOrmModelFromText('{}');

            const mockPKField = { ID: 'pk-field', Name: 'ID', IsPrimaryKey: true };
            const mockTable = {
                ID: 'table-1',
                Name: 'Orders',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([mockPKField])
            };
            const mockReference = {
                ID: 'ref-1',
                Name: 'FK_1to1',
                Source: 'pk-field',
                Target: 'table-2',
                Points: []
            };

            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.References[0].IsOneToOne).toBe(true);
        });

        it('should set IsOneToOne=false when source field is not PK', async () => {
            await bridge.LoadOrmModelFromText('{}');

            const mockFKField = { ID: 'fk-field', Name: 'OrdersID', IsPrimaryKey: false };
            const mockTable = {
                ID: 'table-1',
                Name: 'Users',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([mockFKField])
            };
            const mockReference = {
                ID: 'ref-2',
                Name: 'FK_normal',
                Source: 'fk-field',
                Target: 'table-2',
                Points: []
            };

            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.References[0].IsOneToOne).toBe(false);
        });

        it('should set IsOneToOne=false when source table not found', async () => {
            await bridge.LoadOrmModelFromText('{}');

            const mockReference = {
                ID: 'ref-3',
                Name: 'FK_orphan',
                Source: 'unknown-field',
                Target: 'table-2',
                Points: []
            };

            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.References[0].IsOneToOne).toBe(false);
        });

        it('should detect IsOneToOne using Fields fallback when GetChildrenOfType is null', async () => {
            await bridge.LoadOrmModelFromText('{}');

            const mockPKField = { ID: 'pk-field-id', Name: 'ID', IsPrimaryKey: true };
            const mockTable = {
                ID: 'table-1',
                Name: 'Orders',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: null,   // No GetChildrenOfType — falls back to Fields
                Fields: [mockPKField]
            };
            const mockReference = {
                ID: 'ref-4',
                Name: 'FK_1to1_fallback',
                Source: 'pk-field-id',
                Target: 'table-2',
                Points: []
            };

            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockReference]);

            const data = await bridge.GetModelData();

            expect(data.References[0].IsOneToOne).toBe(true);
        });
    }); // end describe('GetModelData')

    describe('GetElementInfo', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return null for non-existent element', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(null);

            const info = bridge.GetElementInfo('non-existent');

            expect(info).toBeNull();
        });

        it('should return info for XORMDesign element', () => {
            const mockDesign = new tfx.XORMDesign();
            mockDesign.ID = 'design-1';
            mockDesign.Name = 'TestDesign';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockDesign);

            const info = bridge.GetElementInfo('design-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('design-1');
            expect(info?.Name).toBe('TestDesign');
            expect(info?.Type).toBe('XORMDesign');
        });

        it('should return info for XORMTable element', () => {
            const mockTable = new tfx.XORMTable();
            mockTable.ID = 'table-1';
            mockTable.Name = 'Users';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTable);

            const info = bridge.GetElementInfo('table-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('table-1');
            expect(info?.Name).toBe('Users');
            expect(info?.Type).toBe('XORMTable');
        });

        it('should return info for XORMReference element', () => {
            const mockRef = new tfx.XORMReference();
            mockRef.ID = 'ref-1';
            mockRef.Name = 'FK_Test';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockRef);

            const info = bridge.GetElementInfo('ref-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('ref-1');
            expect(info?.Name).toBe('FK_Test');
            expect(info?.Type).toBe('XORMReference');
        });

        it('should return info for XORMField element', () => {
            const mockField = new tfx.XORMField();
            mockField.ID = 'field-1';
            mockField.Name = 'UserID';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockField);

            const info = bridge.GetElementInfo('field-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('field-1');
            expect(info?.Name).toBe('UserID');
            expect(info?.Type).toBe('XORMField');
        });

        it('should return info for XORMPKField element', () => {
            const mockPKField = new tfx.XORMPKField();
            mockPKField.ID = 'pk-1';
            mockPKField.Name = 'ID';

            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockPKField);

            const info = bridge.GetElementInfo('pk-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('pk-1');
            expect(info?.Name).toBe('ID');
            expect(info?.Type).toBe('XORMPKField');
        });

        it('should return "Unknown" type for unknown element type', () => {
            const mockElement = { ID: 'unknown-1', Name: 'Unknown' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockElement);

            const info = bridge.GetElementInfo('unknown-1');

            expect(info).not.toBeNull();
            expect(info?.ID).toBe('unknown-1');
            expect(info?.Name).toBe('Unknown');
            expect(info?.Type).toBe('Unknown');
        });
    });

    describe('GetModelData table Fields fallback', () => {
        it('should use table.Fields when GetChildrenOfType is null', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockField = { ID: 'field-1', Name: 'FieldFromArray', DataType: 'String', IsPrimaryKey: false, IsRequired: false };
            const mockTable = {
                ID: 'table-1',
                Name: 'TestTable',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: null,
                Fields: [mockField]
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].Fields.length).toBe(1);
            expect(data.Tables[0].Fields[0].Name).toBe('FieldFromArray');
        });

        it('should use empty array when both GetChildrenOfType is undefined and Fields is undefined', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Create plain object without GetChildrenOfType method
            const mockTable = {
                ID: 'table-1',
                Name: 'TestTable',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 }
                // No GetChildrenOfType property at all
                // No Fields property at all
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].Fields).toEqual([]);
        });

        it('should use empty array when GetChildrenOfType returns null', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            const mockTable = {
                ID: 'table-1',
                Name: 'TestTable',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue(null)
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const data = await bridge.GetModelData();

            expect(data.Tables[0].Fields).toEqual([]);
        });
    });

    describe('GetModelData with table having no GetChildrenOfType and no Fields (line 382)', () => {
        it('should use empty array when table has neither GetChildrenOfType nor Fields property', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            // Create a table mock without GetChildrenOfType and without Fields
            const mockTableWithoutMethods = {
                ID: 'table-no-methods',
                Name: 'NoMethodsTable',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                // No GetChildrenOfType method
                // No Fields property
            };
            
            bridge.Controller.Document = { Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTableWithoutMethods]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const result = bridge.GetModelData();

            expect(result.Tables).toHaveLength(1);
            expect(result.Tables[0].ID).toBe('table-no-methods');
            expect(result.Tables[0].Fields).toEqual([]); // Should be empty array from else branch
        });
    });

    describe('GetModelData simplifyRoutePoints coverage', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return empty array when valid points < 2', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 100, Y: 100 }]  // Only one valid point
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // With only 1 point, should return the original (no simplification possible)
            expect(result.References[0].Points).toEqual([{ X: 100, Y: 100 }]);
        });

        it('should return empty array when unique points < 2 after dedup', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 100, Y: 100 }, { X: 100, Y: 100 }]  // Duplicate points
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            expect(result.References[0].Points).toEqual([]);
        });

        it('should simplify collinear points in vertical line', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 100, Y: 0 }, { X: 100, Y: 50 }, { X: 100, Y: 100 }]  // Collinear vertical
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Middle point should be removed
            expect(result.References[0].Points).toHaveLength(2);
        });

        it('should simplify collinear points in horizontal line', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [{ X: 0, Y: 100 }, { X: 50, Y: 100 }, { X: 100, Y: 100 }]  // Collinear horizontal
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Middle point should be removed
            expect(result.References[0].Points).toHaveLength(2);
        });

        it('should preserve orthogonal route points (perpendicular exits)', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            // Orthogonal route with no colinear points - should be preserved
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 200, Y: 75 },   // Start
                    { X: 350, Y: 75 },   // Turn
                    { X: 350, Y: 200 }   // End
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should preserve the 3 points (no colineares to remove)
            expect(result.References[0].Points).toHaveLength(3);
        });

        it('should preserve orthogonal route with multiple turns', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            // Route with turns but no colinear points
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 100, Y: 150 },  // Start
                    { X: 100, Y: 275 },  // Turn 1
                    { X: 300, Y: 275 }   // End
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should preserve the 3 points
            expect(result.References[0].Points).toHaveLength(3);
        });

        it('should preserve Z-shaped routes from server', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 400, Top: 100, Width: 200, Height: 150 }
            };
            // Z-shape route (4 essential points, no colineares)
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 200, Y: 75 },   // Start (right edge)
                    { X: 300, Y: 75 },   // Mid-turn 1
                    { X: 300, Y: 175 },  // Mid-turn 2
                    { X: 400, Y: 175 }   // End (left edge)
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should preserve all 4 points of Z-shape
            expect(result.References[0].Points).toHaveLength(4);
        });

        it('should preserve C-shaped routes from server', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 100, Top: 300, Width: 200, Height: 150 }
            };
            // C-shape route (no colinear points)
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 100, Y: 150 },  // Start
                    { X: 100, Y: 225 },  // Mid
                    { X: 200, Y: 225 },  // Mid
                    { X: 200, Y: 300 }   // End
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should preserve all 4 points of C-shape
            expect(result.References[0].Points).toHaveLength(4);
        });

        it('should return simplified points when no side detected', async () => {
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            // Points not on any edge - detectSide returns null
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 50, Y: 50 },    // Inside src table (not on edge)
                    { X: 150, Y: 50 },   // Extra
                    { X: 150, Y: 150 },  // Extra
                    { X: 250, Y: 150 },  // Extra
                    { X: 250, Y: 250 }   // Inside tgt area (not on edge)
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Without side detection, should return simplified points (collinear removed)
            expect(result.References[0].Points.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle null/undefined points gracefully', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: null
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            expect(result.References[0].Points).toEqual([]);
        });

        it('should simplify when sourceTable or targetTable not found for reference', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            // Reference points to non-existent target table
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'non-existent-table',
                Points: [
                    { X: 200, Y: 75 },
                    { X: 250, Y: 75 },
                    { X: 250, Y: 150 }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should return simplified points (collinear removal only, no L/Z optimization)
            expect(result.References[0].Points.length).toBeGreaterThanOrEqual(2);
        });

        it('should return empty array when multiple points but all invalid (line 504)', async () => {
            const mockTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                GetChildrenOfType: jest.fn().mockReturnValue([{ ID: 'field-1', Name: 'ID' }])
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                // Multiple points but all have NaN - only 1 valid after filter
                Points: [
                    { X: NaN, Y: 100 },
                    { X: 100, Y: 100 },
                    { X: NaN, Y: NaN },
                    { X: Infinity, Y: 200 }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // With only 1 valid point after filter, should return empty array
            expect(result.References[0].Points).toEqual([]);
        });

        it('should use Fields fallback when GetChildrenOfType is missing in find sourceTable', async () => {
            // Source table without GetChildrenOfType but with Fields
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 },
                Fields: [{ ID: 'field-1', Name: 'ID' }]
                // No GetChildrenOfType
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',
                Target: 'table-2',
                Points: [
                    { X: 200, Y: 75 },
                    { X: 300, Y: 275 }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should find sourceTable using Fields fallback
            expect(result.References[0].Points.length).toBeGreaterThanOrEqual(2);
        });

        it('should handle table with no GetChildrenOfType and no Fields in find sourceTable', async () => {
            // Source table without GetChildrenOfType AND without Fields
            const srcTable = {
                ID: 'table-1',
                Name: 'Table1',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 150 }
                // No GetChildrenOfType, no Fields
            };
            const tgtTable = {
                ID: 'table-2',
                Name: 'Table2',
                Bounds: { Left: 300, Top: 200, Width: 200, Height: 150 }
            };
            const mockRef = {
                ID: 'ref-1',
                Name: 'Ref1',
                Source: 'field-1',  // Won't find this field
                Target: 'table-2',
                Points: [
                    { X: 200, Y: 75 },
                    { X: 300, Y: 275 }
                ]
            };
            
            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([srcTable, tgtTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([mockRef]);

            const result = bridge.GetModelData();

            // Should still produce valid points (sourceTable will be undefined)
            expect(result.References[0].Points.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('GetModelData seed data Children fallbacks (lines 1770, 1777, 1796)', () => {
        it('should use t.Children to find XORMDataSet when GetChildrenOfType is absent, and cover || branches in tuple extraction', async () => {
            await bridge.LoadOrmModelFromText('{}');

            // f1 has empty Name → headersMap['f1'] = '' (falsy) → covers `headersMap[id] || id` branch
            // f2 has a Name → it will have no matching fieldValue → covers `rowMap[id] || ""` branch
            const mockTuple = {
                Class: 'XORMDataTuple',
                GetChildrenOfType: undefined,
                Children: [
                    { Class: 'XFieldValue', FieldID: 'f1', Value: '' }  // empty Value → covers `fv.Value || ""`
                ]
            };
            const mockDataSet = {
                Class: 'XORMDataSet',
                GetTuples: undefined,
                Children: [mockTuple]
            };
            const mockTable = {
                ID: 'tbl-1',
                Name: 'Users',
                PKType: 'Int32',
                Bounds: { Left: 0, Top: 0, Width: 200, Height: 100 },
                // f1 empty name → headersMap fallback; f2 not in tuple → rowMap fallback
                Fields: [
                    { ID: 'f1', Name: '', IsPrimaryKey: false },
                    { ID: 'f2', Name: 'Email', IsPrimaryKey: false }
                ],
                // No GetChildrenOfType — forces all three Children fallbacks
                Children: [mockDataSet]
            };

            bridge.Controller.Document = { Name: 'Test', Design: {} };
            bridge.Controller.GetTables = jest.fn().mockReturnValue([mockTable]);
            bridge.Controller.GetReferences = jest.fn().mockReturnValue([]);

            const result = bridge.GetModelData();

            expect(result.Tables).toHaveLength(1);
            const tbl = result.Tables[0];
            expect(tbl.SeedData).toBeDefined();
            // f1 has empty Name → header falls back to 'f1'; f2 has Name 'Email'
            expect(tbl.SeedData!.Headers).toEqual(['f1', 'Email']);
            // f1 value is '' (empty) → rowMap['f1'] || "" == ""; f2 has no entry → rowMap['f2'] || "" == ""
            expect(tbl.SeedData!.Tuples).toEqual([['', '']]);
        });
    });

});
