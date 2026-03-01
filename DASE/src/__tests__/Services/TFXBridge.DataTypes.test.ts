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

    describe('GetAllDataTypes', () => {
        it('should return empty array before loading', () => {
            const types = bridge.GetAllDataTypes();
            expect(types).toEqual([]);
        });
    });

    describe('GetPKDataTypes', () => {
        it('should return empty array before loading', () => {
            const types = bridge.GetPKDataTypes();
            expect(types).toEqual([]);
        });
    });

    describe('LoadDataTypes', () => {
        it('should use fallback types on error', async () => {
            bridge.SetContextPath('/nonexistent/path/file.dsorm');
            await bridge.LoadDataTypes();
            
            const allTypes = bridge.GetAllDataTypes();
            const pkTypes = bridge.GetPKDataTypes();
            
            // Should have fallback types
            expect(allTypes.length).toBeGreaterThan(0);
            expect(pkTypes.length).toBeGreaterThan(0);
        });

        it('should not reload if already loaded', async () => {
            bridge.SetContextPath('/test/path/file.dsorm');
            await bridge.LoadDataTypes();
            const types1 = bridge.GetAllDataTypes();
            
            await bridge.LoadDataTypes();
            const types2 = bridge.GetAllDataTypes();
            
            expect(types1).toEqual(types2);
        });
    });

    describe('ReloadDataTypes', () => {
        it('should clear cache and reload types', async () => {
            bridge.SetContextPath('/test/path/file.dsorm');
            await bridge.LoadDataTypes();
            
            await bridge.ReloadDataTypes();
            
            // Should have types after reload
            const allTypes = bridge.GetAllDataTypes();
            expect(allTypes.length).toBeGreaterThan(0);
        });
    });

    describe('LoadAvailableOrmFiles', () => {
        it('should do nothing when no context path is set', async () => {
            await bridge.LoadAvailableOrmFiles();
            expect((bridge as any)._AvailableOrmFiles).toEqual([]);
        });

        it('should load .dsorm files from directory excluding the current file, sorted alphabetically', async () => {
            bridge.SetContextPath('/test/dir/Current.dsorm');
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue([
                ['Zebra.dsorm', vscode.FileType.File],
                ['Auth.dsorm', vscode.FileType.File],
                ['Current.dsorm', vscode.FileType.File],
                ['readme.txt', vscode.FileType.File],
                ['subfolder', vscode.FileType.Directory]
            ]);

            await bridge.LoadAvailableOrmFiles();

            const files = (bridge as any)._AvailableOrmFiles as string[];
            expect(files).toEqual(['Auth.dsorm', 'Zebra.dsorm']);
            expect(files).not.toContain('Current.dsorm');
        });

        it('should clear the list and log an error when readDirectory fails', async () => {
            bridge.SetContextPath('/test/dir/file.dsorm');
            (bridge as any)._AvailableOrmFiles = ['stale.dsorm'];
            (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('Permission denied'));

            await bridge.LoadAvailableOrmFiles();

            expect((bridge as any)._AvailableOrmFiles).toEqual([]);
        });
    });

    describe('LoadParentModelTables', () => {
        it('should do nothing when no context path is set', async () => {
            await bridge.LoadParentModelTables(['Auth.dsorm']);
            expect((bridge as any)._ParentModelTables).toEqual([]);
        });

        it('should do nothing when parent models array is empty', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');
            await bridge.LoadParentModelTables([]);
            expect((bridge as any)._ParentModelTables).toEqual([]);
        });

        it('should skip empty string model name entries', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');
            bridge.Initialize();
            await bridge.LoadParentModelTables(['']);
            expect((bridge as any)._ParentModelTables).toEqual([]);
        });

        it('should load table names from a valid serialized parent model file', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const bridge2 = new XTFXBridge();
            bridge2.LoadOrmModelFromText(JSON.stringify({ Name: 'Auth', Tables: [
                { ID: 'tbl1', Name: 'AppUser', X: 0, Y: 0, Width: 200, Height: 60 },
                { ID: 'tbl2', Name: 'AppRole', X: 250, Y: 0, Width: 200, Height: 60 }
            ]}));
            const xml = bridge2.SaveOrmModelToText();

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(xml));

            bridge.Initialize();
            await bridge.LoadParentModelTables(['Auth.dsorm']);

            const tables = (bridge as any)._ParentModelTables as string[];
            expect(tables).toContain('AppUser');
            expect(tables).toContain('AppRole');
        });

        it('should deduplicate table names from multiple parent model files', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const b1 = new XTFXBridge();
            b1.LoadOrmModelFromText(JSON.stringify({ Name: 'M1', Tables: [
                { ID: 't1', Name: 'SharedTable', X: 0, Y: 0, Width: 200, Height: 60 }
            ]}));

            const b2 = new XTFXBridge();
            b2.LoadOrmModelFromText(JSON.stringify({ Name: 'M2', Tables: [
                { ID: 't2', Name: 'SharedTable', X: 0, Y: 0, Width: 200, Height: 60 },
                { ID: 't3', Name: 'UniqueTable', X: 250, Y: 0, Width: 200, Height: 60 }
            ]}));

            (vscode.workspace.fs.readFile as jest.Mock)
                .mockResolvedValueOnce(Buffer.from(b1.SaveOrmModelToText()))
                .mockResolvedValueOnce(Buffer.from(b2.SaveOrmModelToText()));

            bridge.Initialize();
            await bridge.LoadParentModelTables(['Model1.dsorm', 'Model2.dsorm']);

            const tables = (bridge as any)._ParentModelTables as string[];
            expect(tables.filter((t: string) => t === 'SharedTable').length).toBe(1);
            expect(tables).toContain('UniqueTable');
        });

        it('should log error and continue when a parent file cannot be read', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');
            bridge.Initialize();
            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

            await bridge.LoadParentModelTables(['Missing.dsorm']);

            expect((bridge as any)._ParentModelTables).toEqual([]);
        });
    });

});
