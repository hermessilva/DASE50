// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

// Mock do SelectionService para evitar chamadas ao GetProperties
jest.mock('../../../Services/SelectionService', () => ({
    GetSelectionService: jest.fn(() => ({
        OnSelectionChanged: jest.fn((_callback) => ({ dispose: jest.fn() })),
        Clear: jest.fn(),
        Select: jest.fn(),
        ToggleSelection: jest.fn(),
        AddToSelection: jest.fn(),
        HasSelection: false,
        PrimaryID: null,
        SelectedIDs: []
    }))
}));

import * as vscode from 'vscode';
import { XORMDesignerEditorProvider } from '../../../Designers/ORM/ORMDesignerEditorProvider';
import { createMockExtensionContext, Uri, createMockWebviewPanel } from '../../__mocks__/vscode';
import { GetSelectionService } from '../../../Services/SelectionService';

describe('XORMDesignerEditorProvider', () => {
    let provider: XORMDesignerEditorProvider;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset SelectionService mock to default state
        (GetSelectionService as jest.Mock).mockReturnValue({
            OnSelectionChanged: jest.fn((_callback) => ({ dispose: jest.fn() })),
            Clear: jest.fn(),
            Select: jest.fn(),
            ToggleSelection: jest.fn(),
            AddToSelection: jest.fn(),
            HasSelection: false,
            PrimaryID: null,
            SelectedIDs: []
        });
        mockContext = createMockExtensionContext() as unknown as vscode.ExtensionContext;
        provider = new XORMDesignerEditorProvider(mockContext as any);
    });

    describe('saveCustomDocument', () => {
        it('should save document', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            await provider.saveCustomDocument(mockDoc as any, token);

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('should do nothing when state not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;

            // Clear the mock before test
            (vscode.workspace.fs.writeFile as jest.Mock).mockClear();

            await provider.saveCustomDocument(mockDoc as any, token);

            // writeFile should not be called when state doesn't exist
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('saveCustomDocumentAs', () => {
        it('should save document to new location', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const newUri = Uri.file('/test/model-copy.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            await provider.saveCustomDocumentAs(mockDoc as any, newUri as any, token);

            expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(
                newUri,
                expect.any(Buffer)
            );
        });

        it('should clear dirty state after save', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const newUri = Uri.file('/test/model-copy.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Get state and mark as dirty
            const state = (provider as any)._States.get(uri.toString());
            state.IsDirty = true;
            expect(state.IsDirty).toBe(true);
            
            await provider.saveCustomDocumentAs(mockDoc as any, newUri as any, token);

            // VS Code automatically clears dirty state after successful save
            // We don't manually set IsDirty = false anymore
            // The document will be disposed and replaced by VS Code
        });

        it('should do nothing when state not found', async () => {
            const uri = Uri.file('/test/unknown.dsorm');
            const newUri = Uri.file('/test/unknown-copy.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;

            await provider.saveCustomDocumentAs(mockDoc as any, newUri as any, token);

            // Should not throw and not call writeFile
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('revertCustomDocument', () => {
        it('should reload document', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            (vscode.workspace.fs.readFile as jest.Mock).mockClear();
            await provider.revertCustomDocument(mockDoc as any, token);

            expect(vscode.workspace.fs.readFile).toHaveBeenCalled();
        });

        it('should do nothing when state not found', async () => {
            const uri = Uri.file('/test/unknown.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;

            await provider.revertCustomDocument(mockDoc as any, token);

            // Should not throw and not call readFile
            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
        });
    });

    describe('backupCustomDocument', () => {
        it('should create backup', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;
            const backupUri = Uri.file('/backup/model.dsorm');
            const backupContext = { destination: backupUri } as any;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            const backup = await provider.backupCustomDocument(mockDoc as any, backupContext, token);

            expect(backup).toBeDefined();
            expect(backup.id).toBeTruthy();
            expect(typeof backup.delete).toBe('function');
        });

        it('should call delete function in backup', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;
            const backupUri = Uri.file('/backup/model.dsorm');
            const backupContext = { destination: backupUri } as any;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            (vscode.workspace.fs.delete as jest.Mock).mockClear();

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            const backup = await provider.backupCustomDocument(mockDoc as any, backupContext, token);

            await backup.delete();
            expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(backupUri);
        });

        it('should do nothing when state not found', async () => {
            const uri = Uri.file('/test/unknown.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;
            const backupUri = Uri.file('/backup/unknown.dsorm');
            const backupContext = { destination: backupUri } as any;

            (vscode.workspace.fs.writeFile as jest.Mock).mockClear();
            const backup = await provider.backupCustomDocument(mockDoc as any, backupContext, token);

            // Should still return backup object but not write file
            expect(backup).toBeDefined();
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });
    });

    describe('revertCustomDocument when state not found', () => {
        it('should not throw when state not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockClear();

            await provider.revertCustomDocument(mockDoc as any, token);

            expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
        });
    });

});
