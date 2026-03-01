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

    describe('AddTable', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should add table with coordinates and name', async () => {
            const mockAddTable = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddTable = mockAddTable;

            const result = await bridge.AddTable(100, 200, 'NewTable');

            expect(mockAddTable).toHaveBeenCalledWith({
                X: 100,
                Y: 200,
                Name: 'NewTable'
            });
        });
    });

    describe('AddReference', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should add reference between tables (creates FK field first)', () => {
            const mockAddField = jest.fn().mockReturnValue({ Success: true, ElementID: 'new-fk-field-id' });
            const mockAddReference = jest.fn().mockReturnValue({ Success: true });
            const mockGetElementByID = jest.fn().mockReturnValue({ Name: 'TargetTable' });
            bridge.Controller.AddField = mockAddField;
            bridge.Controller.AddReference = mockAddReference;
            bridge.Controller.GetElementByID = mockGetElementByID;

            const result = bridge.AddReference('source-table-id', 'target-table-id', 'RefName');

            // First creates FK field
            expect(mockAddField).toHaveBeenCalledWith({
                TableID: 'source-table-id',
                Name: 'TargetTableID'
            });
            // Then creates reference using field ID
            expect(mockAddReference).toHaveBeenCalledWith({
                SourceFieldID: 'new-fk-field-id',
                TargetTableID: 'target-table-id',
                Name: 'RefName'
            });
        });
    });

    describe('DeleteElement', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should delete element by ID', () => {
            const mockRemoveElement = jest.fn().mockReturnValue(true);
            bridge.Controller.RemoveElement = mockRemoveElement;

            const result = bridge.DeleteElement('elem-1');

            expect(mockRemoveElement).toHaveBeenCalledWith('elem-1');
        });
    });

    describe('RenameElement', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should rename element', () => {
            const mockRenameElement = jest.fn().mockReturnValue(true);
            bridge.Controller.RenameElement = mockRenameElement;

            const result = bridge.RenameElement('elem-1', 'NewName');

            expect(mockRenameElement).toHaveBeenCalledWith({
                ElementID: 'elem-1',
                NewName: 'NewName'
            });
        });
    });

    describe('MoveElement', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should move element to new position', () => {
            const mockMoveElement = jest.fn().mockReturnValue(true);
            bridge.Controller.MoveElement = mockMoveElement;

            const result = bridge.MoveElement('elem-1', 300, 400);

            expect(mockMoveElement).toHaveBeenCalledWith({
                ElementID: 'elem-1',
                X: 300,
                Y: 400
            });
        });
    });

    describe('ReorderField', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should reorder field to new index', () => {
            const mockReorderField = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.ReorderField = mockReorderField;

            const result = bridge.ReorderField('field-1', 2);

            expect(mockReorderField).toHaveBeenCalledWith({
                FieldID: 'field-1',
                NewIndex: 2
            });
            expect(result.Success).toBe(true);
        });

        it('should return false when Controller is null', () => {
            const newBridge = new XTFXBridge();
            const result = newBridge.ReorderField('field-1', 2);

            expect(result).toEqual({ Success: false });
        });
    });

    describe('AddReference FK field creation', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should use "Target" as default name when target table not found', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(null);
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true });

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(bridge.Controller.AddField).toHaveBeenCalledWith(expect.objectContaining({
                TableID: 'source-id',
                Name: 'TargetID'
            }));
        });

        it('should use target table name for FK field when target table found', () => {
            const mockTargetTable = { Name: 'Users' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTargetTable);
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true });

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(bridge.Controller.AddField).toHaveBeenCalledWith(expect.objectContaining({
                TableID: 'source-id',
                Name: 'UsersID'
            }));
        });

        it('should generate default reference name when name is empty', () => {
            const mockTargetTable = { Name: 'Orders' };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockTargetTable);
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true, ElementID: 'field-id' });
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });

            bridge.AddReference('source-id', 'target-id', '');

            expect(bridge.Controller.AddReference).toHaveBeenCalledWith(expect.objectContaining({
                Name: 'FK_Orders'
            }));
        });

        it('should not create reference when AddField fails', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Users' });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: false });
            bridge.Controller.AddReference = jest.fn();

            bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(bridge.Controller.AddReference).not.toHaveBeenCalled();
        });

        it('should return fallback when AddField returns null', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Users' });
            bridge.Controller.AddField = jest.fn().mockReturnValue(null);
            bridge.Controller.AddReference = jest.fn();

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(result).toEqual({ Success: false, Message: 'Failed to create FK field.' });
            expect(bridge.Controller.AddReference).not.toHaveBeenCalled();
        });
    });

    describe('AddReference 1:1 (IsOneToOne)', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should use PK field directly for 1:1 reference', () => {
            const mockPKField = { ID: 'pk-field-id', IsPrimaryKey: true };
            const mockSourceTable = { Name: 'Orders', GetPKField: jest.fn().mockReturnValue(mockPKField) };
            const mockTargetTable = { Name: 'Users' };
            bridge.Controller.GetElementByID = jest.fn()
                .mockReturnValueOnce(mockSourceTable)
                .mockReturnValueOnce(mockTargetTable);
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.AddField = jest.fn();

            const result = bridge.AddReference('source-id', 'target-id', '', true);

            expect(bridge.Controller.AddField).not.toHaveBeenCalled();
            expect(bridge.Controller.AddReference).toHaveBeenCalledWith({
                SourceFieldID: 'pk-field-id',
                TargetTableID: 'target-id',
                Name: 'FK_Orders_Users'
            });
            expect(result.Success).toBe(true);
        });

        it('should return failure when source table has no PK field', () => {
            const mockSourceTable = { Name: 'Orders', GetPKField: jest.fn().mockReturnValue(null) };
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue(mockSourceTable);
            bridge.Controller.AddReference = jest.fn();
            bridge.Controller.AddField = jest.fn();

            const result = bridge.AddReference('source-id', 'target-id', '', true);

            expect(result).toEqual({ Success: false, Message: 'Source table has no PK field.' });
            expect(bridge.Controller.AddReference).not.toHaveBeenCalled();
        });

        it('should use provided name for 1:1 reference when given', () => {
            const mockPKField = { ID: 'pk-field-id', IsPrimaryKey: true };
            const mockSourceTable = { Name: 'Orders', GetPKField: jest.fn().mockReturnValue(mockPKField) };
            const mockTargetTable = { Name: 'Users' };
            bridge.Controller.GetElementByID = jest.fn()
                .mockReturnValueOnce(mockSourceTable)
                .mockReturnValueOnce(mockTargetTable);
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });

            bridge.AddReference('source-id', 'target-id', 'MyRef', true);

            expect(bridge.Controller.AddReference).toHaveBeenCalledWith(expect.objectContaining({
                Name: 'MyRef'
            }));
        });

        it('should use fallback name when source table is null for 1:1', () => {
            const mockPKField = { ID: 'pk-field-id', IsPrimaryKey: true };
            const mockSourceTable = { Name: null, GetPKField: jest.fn().mockReturnValue(mockPKField) };
            const mockTargetTable = { Name: 'Users' };
            bridge.Controller.GetElementByID = jest.fn()
                .mockReturnValueOnce(mockSourceTable)
                .mockReturnValueOnce(mockTargetTable);
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });

            bridge.AddReference('source-id', 'target-id', '', true);

            expect(bridge.Controller.AddReference).toHaveBeenCalledWith(expect.objectContaining({
                Name: 'FK_OneToOne_Users'
            }));
        });

        it('should use "Target" when target table is null for 1:1', () => {
            const mockPKField = { ID: 'pk-field-id', IsPrimaryKey: true };
            const mockSourceTable = { Name: 'Orders', GetPKField: jest.fn().mockReturnValue(mockPKField) };
            bridge.Controller.GetElementByID = jest.fn()
                .mockReturnValueOnce(mockSourceTable)
                .mockReturnValueOnce(null);
            bridge.Controller.AddReference = jest.fn().mockReturnValue({ Success: true });

            bridge.AddReference('source-id', 'target-id', '', true);

            expect(bridge.Controller.AddReference).toHaveBeenCalledWith(expect.objectContaining({
                Name: 'FK_Orders_Target'
            }));
        });

        it('should return fallback when Controller.AddReference returns null for 1:1', () => {
            const mockPKField = { ID: 'pk-field-id', IsPrimaryKey: true };
            const mockSourceTable = { Name: 'Orders', GetPKField: jest.fn().mockReturnValue(mockPKField) };
            const mockTargetTable = { Name: 'Users' };
            bridge.Controller.GetElementByID = jest.fn()
                .mockReturnValueOnce(mockSourceTable)
                .mockReturnValueOnce(mockTargetTable);
            bridge.Controller.AddReference = jest.fn().mockReturnValue(null);

            const result = bridge.AddReference('source-id', 'target-id', '', true);

            expect(result).toEqual({ Success: false });
        });
    }); // end describe('AddReference 1:1')

    describe('AlignLines', () => {
        it('should return false when RouteAllLines is undefined', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.RouteAllLines = undefined;

            const result = bridge.AlignLines();

            expect(result).toBe(false);
        });

        it('should return false when RouteAllLines returns undefined', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.RouteAllLines = jest.fn().mockReturnValue(undefined);

            const result = bridge.AlignLines();

            expect(result).toBe(false);
        });

        it('should return true when RouteAllLines succeeds', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.RouteAllLines = jest.fn().mockReturnValue(true);

            const result = bridge.AlignLines();

            expect(result).toBe(true);
        });
    });

    describe('DeleteElement fallback', () => {
        it('should return { Success: false } when Controller is null', () => {
            const result = bridge.DeleteElement('elem-1');

            expect(result).toEqual({ Success: false });
        });
    });

    describe('RenameElement fallback', () => {
        it('should return { Success: false } when Controller is null', () => {
            const result = bridge.RenameElement('elem-1', 'NewName');

            expect(result).toEqual({ Success: false });
        });
    });

    describe('MoveElement fallback', () => {
        it('should return { Success: false } when Controller is null', () => {
            const result = bridge.MoveElement('elem-1', 100, 200);

            expect(result).toEqual({ Success: false });
        });
    });

    describe('AddField fallback', () => {
        it('should return { Success: false } when Controller is null', () => {
            const result = bridge.AddField('table-1', 'NewField', 'String');

            expect(result).toEqual({ Success: false });
        });
    });

    describe('AddTable fallback', () => {
        it('should return { Success: false } when Controller AddTable returns null', async () => {
            await bridge.LoadOrmModelFromText('{}');
            bridge.Controller.AddTable = jest.fn().mockReturnValue(null);

            const result = bridge.AddTable(100, 200, 'NewTable');

            expect(result).toEqual({ Success: false, Message: "Failed to add table." });
        });
    });

    describe('AddReference returns falsy result coverage (line 272)', () => {
        beforeEach(async () => {
            await bridge.LoadOrmModelFromText('{}');
        });

        it('should return fallback when Controller.AddReference returns null', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Users' });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true, ElementID: 'field-id' });
            bridge.Controller.AddReference = jest.fn().mockReturnValue(null);

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(result).toEqual({ Success: false });
        });

        it('should return fallback when Controller.AddReference returns undefined', () => {
            bridge.Controller.GetElementByID = jest.fn().mockReturnValue({ Name: 'Users' });
            bridge.Controller.AddField = jest.fn().mockReturnValue({ Success: true, ElementID: 'field-id' });
            bridge.Controller.AddReference = jest.fn().mockReturnValue(undefined);

            const result = bridge.AddReference('source-id', 'target-id', 'FK_Test');

            expect(result).toEqual({ Success: false });
        });
    });

});
