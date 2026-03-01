jest.mock('vscode');

import * as vscode from 'vscode';
import { XORMDesignerState } from '../../../Designers/ORM/ORMDesignerState';
import { Uri, createMockTextDocument } from '../../__mocks__/vscode';

describe('XORMDesignerState — Shadow & ParentModel coverage', () => {
    let state: XORMDesignerState;
    let mockDocument: vscode.TextDocument;

    beforeEach(() => {
        jest.clearAllMocks();
        const uri = Uri.file('/test/model.dsorm');
        mockDocument = createMockTextDocument(uri, '{}') as unknown as vscode.TextDocument;
        state = new XORMDesignerState(mockDocument);
    });

    afterEach(() => {
        state.Dispose();
    });

    describe('Load with ParentModel pre-loading', () => {
        it('should pre-load parent model tables when ParentModel is set in the design', async () => {
            // Build an XML document that has ParentModel set on the design
            const { XTFXBridge: BridgeClass } = await import('../../../Services/TFXBridge');
            const tempBridge = new BridgeClass();
            tempBridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Table1', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            // Set ParentModel directly on the design object
            const design = tempBridge.Controller?.Design;
            if (design) design.ParentModel = 'Auth.dsorm|Core.dsorm';
            const serialized = tempBridge.SaveOrmModelToText();

            (vscode.workspace.fs.readFile as jest.Mock)
                .mockResolvedValueOnce(Buffer.from(serialized))
                .mockResolvedValue(Buffer.from(''));

            const loadParentSpy = jest.spyOn(state.Bridge, 'LoadParentModelTables').mockResolvedValue(undefined);

            await state.Load();

            expect(loadParentSpy).toHaveBeenCalled();
            const args = loadParentSpy.mock.calls[0][0] as string[];
            expect(args.length).toBeGreaterThan(0);

            loadParentSpy.mockRestore();
        });

        it('should not pre-load parent model tables when ParentModel is empty', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            const loadParentSpy = jest.spyOn(state.Bridge, 'LoadParentModelTables').mockResolvedValue(undefined);

            await state.Load();

            expect(loadParentSpy).not.toHaveBeenCalled();

            loadParentSpy.mockRestore();
        });

        it('should not pre-load when ParentModel contains only separators', async () => {
            const { XTFXBridge: BridgeClass } = await import('../../../Services/TFXBridge');
            const tempBridge = new BridgeClass();
            tempBridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: []
            }));
            const design = tempBridge.Controller?.Design;
            if (design) design.ParentModel = '||';
            const serialized = tempBridge.SaveOrmModelToText();

            (vscode.workspace.fs.readFile as jest.Mock)
                .mockResolvedValueOnce(Buffer.from(serialized))
                .mockResolvedValue(Buffer.from(''));

            const loadParentSpy = jest.spyOn(state.Bridge, 'LoadParentModelTables').mockResolvedValue(undefined);

            await state.Load();

            expect(loadParentSpy).not.toHaveBeenCalled();

            loadParentSpy.mockRestore();
        });
    });

    describe('LoadParentModelTables', () => {
        it('should delegate to Bridge.LoadParentModelTables', async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();

            const loadParentSpy = jest.spyOn(state.Bridge, 'LoadParentModelTables').mockResolvedValue(undefined);

            await state.LoadParentModelTables(['Auth.dsorm']);

            expect(loadParentSpy).toHaveBeenCalledWith(['Auth.dsorm']);

            loadParentSpy.mockRestore();
        });
    });

    describe('AddShadowTable', () => {
        beforeEach(async () => {
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await state.Load();
        });

        it('should mark dirty when AddShadowTable succeeds', () => {
            state.Bridge.AddShadowTable = jest.fn().mockReturnValue({ Success: true, ElementID: 'shadow-1' });

            const result = state.AddShadowTable({
                X: 100, Y: 200,
                ModelName: 'Auth.dsorm',
                DocumentID: 'doc-1',
                DocumentName: 'Auth',
                ModuleID: '',
                ModuleName: '',
                TableID: 'tbl-1',
                TableName: 'AppUser'
            });

            expect(result.Success).toBe(true);
            expect(state.IsDirty).toBe(true);
        });

        it('should not mark dirty when AddShadowTable fails', () => {
            state.Bridge.AddShadowTable = jest.fn().mockReturnValue({ Success: false, Message: 'Not found' });

            const result = state.AddShadowTable({
                X: 100, Y: 200,
                ModelName: 'Auth.dsorm',
                DocumentID: 'doc-1',
                DocumentName: 'Auth',
                ModuleID: '',
                ModuleName: '',
                TableID: 'tbl-1',
                TableName: 'AppUser'
            });

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });

        it('should handle null result from Bridge.AddShadowTable', () => {
            state.Bridge.AddShadowTable = jest.fn().mockReturnValue(null);

            const result = state.AddShadowTable({
                X: 100, Y: 200,
                ModelName: 'Auth.dsorm',
                DocumentID: 'doc-1',
                DocumentName: 'Auth',
                ModuleID: '',
                ModuleName: '',
                TableID: 'tbl-1',
                TableName: 'AppUser'
            });

            expect(result.Success).toBe(false);
            expect(state.IsDirty).toBe(false);
        });
    });
});
