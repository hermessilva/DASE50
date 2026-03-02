jest.mock('vscode');

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

describe('XORMDesignerEditorProvider — Shadow & SeedData messages', () => {
    let provider: XORMDesignerEditorProvider;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
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

    describe('HandleMessage RequestSeedData', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Load: jest.fn(),
                Save: jest.fn().mockResolvedValue(undefined),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                AddReference: jest.fn().mockReturnValue({ Success: true }),
                DeleteSelected: jest.fn().mockReturnValue({ Success: true }),
                RenameSelected: jest.fn().mockReturnValue({ Success: true }),
                MoveElement: jest.fn().mockReturnValue({ Success: true }),
                UpdateProperty: jest.fn().mockReturnValue({ Success: true }),
                AlignLines: jest.fn().mockReturnValue({ Success: true }),
                GetProperties: jest.fn().mockResolvedValue([]),
                AddShadowTable: jest.fn().mockReturnValue({ Success: true }),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn(), OnIssuesChanged: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null },
                Bridge: {
                    LastSyncMutated: false,
                    GetSeedData: jest.fn(),
                    SaveSeedData: jest.fn(),
                    GetShadowTablePickerData: jest.fn()
                }
            };
        });

        it('should return early when payload has no TableID', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestSeedData',
                Payload: {}
            });

            expect(mockState.Bridge.GetSeedData).not.toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });

        it('should return early when payload is null', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestSeedData',
                Payload: null
            });

            expect(mockState.Bridge.GetSeedData).not.toHaveBeenCalled();
        });

        it('should post SeedDataLoaded when seed data found', async () => {
            const seedData = { TableID: 'tbl-1', TableName: 'Test', Columns: [], Rows: [] };
            mockState.Bridge.GetSeedData.mockReturnValue(seedData);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestSeedData',
                Payload: { TableID: 'tbl-1' }
            });

            expect(mockState.Bridge.GetSeedData).toHaveBeenCalledWith('tbl-1');
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                Type: 'SeedDataLoaded',
                Payload: seedData
            });
        });

        it('should warn and not post when seed data is null', async () => {
            mockState.Bridge.GetSeedData.mockReturnValue(null);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestSeedData',
                Payload: { TableID: 'nonexistent' }
            });

            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });
    });

    describe('HandleMessage SaveSeedData', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Load: jest.fn(),
                Save: jest.fn().mockResolvedValue(undefined),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                AddReference: jest.fn().mockReturnValue({ Success: true }),
                DeleteSelected: jest.fn().mockReturnValue({ Success: true }),
                RenameSelected: jest.fn().mockReturnValue({ Success: true }),
                MoveElement: jest.fn().mockReturnValue({ Success: true }),
                UpdateProperty: jest.fn().mockReturnValue({ Success: true }),
                AlignLines: jest.fn().mockReturnValue({ Success: true }),
                GetProperties: jest.fn().mockResolvedValue([]),
                AddShadowTable: jest.fn().mockReturnValue({ Success: true }),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn(), OnIssuesChanged: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null },
                Bridge: {
                    LastSyncMutated: false,
                    GetSeedData: jest.fn(),
                    SaveSeedData: jest.fn(),
                    GetShadowTablePickerData: jest.fn()
                }
            };
        });

        it('should return early when payload has no TableID', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: { Rows: [] }
            });

            expect(mockState.Bridge.SaveSeedData).not.toHaveBeenCalled();
        });

        it('should return early when Rows is not an array', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: { TableID: 'tbl-1', Rows: 'invalid' }
            });

            expect(mockState.Bridge.SaveSeedData).not.toHaveBeenCalled();
        });

        it('should return early when payload is null', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: null
            });

            expect(mockState.Bridge.SaveSeedData).not.toHaveBeenCalled();
        });

        it('should post SeedDataSaved on success', async () => {
            mockState.Bridge.SaveSeedData.mockReturnValue({ Success: true, Message: '' });

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: { TableID: 'tbl-1', Rows: [{ TupleID: 'r1', Values: { Name: 'A' } }] }
            });

            expect(mockState.Bridge.SaveSeedData).toHaveBeenCalledWith('tbl-1', [{ TupleID: 'r1', Values: { Name: 'A' } }]);
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                Type: 'SeedDataSaved',
                Payload: { TableID: 'tbl-1', Success: true, Message: '' }
            });
        });

        it('should post SeedDataSaved on failure without notifying document changed', async () => {
            mockState.Bridge.SaveSeedData.mockReturnValue({ Success: false, Message: 'Not found' });

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'SaveSeedData',
                Payload: { TableID: 'tbl-1', Rows: [] }
            });

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                Type: 'SeedDataSaved',
                Payload: { TableID: 'tbl-1', Success: false, Message: 'Not found' }
            });
        });
    });

    describe('HandleMessage RequestShadowTablePicker', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Load: jest.fn(),
                Save: jest.fn().mockResolvedValue(undefined),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                AddReference: jest.fn().mockReturnValue({ Success: true }),
                DeleteSelected: jest.fn().mockReturnValue({ Success: true }),
                RenameSelected: jest.fn().mockReturnValue({ Success: true }),
                MoveElement: jest.fn().mockReturnValue({ Success: true }),
                UpdateProperty: jest.fn().mockReturnValue({ Success: true }),
                AlignLines: jest.fn().mockReturnValue({ Success: true }),
                GetProperties: jest.fn().mockResolvedValue([]),
                AddShadowTable: jest.fn().mockReturnValue({ Success: true }),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn(), OnIssuesChanged: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null },
                Bridge: {
                    LastSyncMutated: false,
                    GetSeedData: jest.fn(),
                    SaveSeedData: jest.fn(),
                    GetShadowTablePickerData: jest.fn()
                }
            };
        });

        it('should return early when X is not a number', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestShadowTablePicker',
                Payload: { X: 'invalid', Y: 100 }
            });

            expect(mockState.Bridge.GetShadowTablePickerData).not.toHaveBeenCalled();
        });

        it('should return early when Y is not a number', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestShadowTablePicker',
                Payload: { X: 100, Y: undefined }
            });

            expect(mockState.Bridge.GetShadowTablePickerData).not.toHaveBeenCalled();
        });

        it('should return early when payload is null', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestShadowTablePicker',
                Payload: null
            });

            expect(mockState.Bridge.GetShadowTablePickerData).not.toHaveBeenCalled();
        });

        it('should post ShadowTablePickerData when valid coordinates', async () => {
            const pickerData = { X: 200, Y: 300, Models: [] };
            mockState.Bridge.GetShadowTablePickerData.mockReturnValue(pickerData);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'RequestShadowTablePicker',
                Payload: { X: 200, Y: 300 }
            });

            expect(mockState.Bridge.GetShadowTablePickerData).toHaveBeenCalledWith(200, 300);
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith({
                Type: 'ShadowTablePickerData',
                Payload: pickerData
            });
        });
    });

    describe('HandleMessage AddShadowTable', () => {
        let mockPanel: any;
        let mockState: any;

        beforeEach(() => {
            mockPanel = createMockWebviewPanel();
            mockState = {
                Load: jest.fn(),
                Save: jest.fn().mockResolvedValue(undefined),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                AddReference: jest.fn().mockReturnValue({ Success: true }),
                DeleteSelected: jest.fn().mockReturnValue({ Success: true }),
                RenameSelected: jest.fn().mockReturnValue({ Success: true }),
                MoveElement: jest.fn().mockReturnValue({ Success: true }),
                UpdateProperty: jest.fn().mockReturnValue({ Success: true }),
                AlignLines: jest.fn().mockReturnValue({ Success: true }),
                GetProperties: jest.fn().mockResolvedValue([]),
                AddShadowTable: jest.fn().mockReturnValue({ Success: true }),
                IsDirty: false,
                Document: { uri: Uri.file('/test/model.dsorm') },
                IssueService: { SetIssues: jest.fn(), OnIssuesChanged: jest.fn() },
                SelectionService: { HasSelection: false, PrimaryID: null },
                Bridge: {
                    LastSyncMutated: false,
                    GetSeedData: jest.fn(),
                    SaveSeedData: jest.fn(),
                    GetShadowTablePickerData: jest.fn()
                }
            };
        });

        it('should call AddShadowTable even when payload has no TableID', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: { TableName: 'Test' }
            });

            expect(mockState.AddShadowTable).toHaveBeenCalledWith({ TableName: 'Test' });
        });

        it('should return early when payload has no TableName', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: { TableID: 'tbl-1' }
            });

            expect(mockState.AddShadowTable).not.toHaveBeenCalled();
        });

        it('should return early when payload is null', async () => {
            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: null
            });

            expect(mockState.AddShadowTable).not.toHaveBeenCalled();
        });

        it('should post LoadModel on success', async () => {
            mockState.AddShadowTable.mockReturnValue({ Success: true });
            mockState.Validate.mockReturnValue([]);

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: { TableID: 'tbl-1', TableName: 'AppUser', X: 100, Y: 200, DocumentName: 'Auth', DocumentID: 'doc-1', ModelName: 'Auth.dsorm', ModuleID: '', ModuleName: '' }
            });

            expect(mockState.AddShadowTable).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
        });

        it('should not post LoadModel on failure', async () => {
            mockState.AddShadowTable.mockReturnValue({ Success: false });
            mockPanel.webview.postMessage.mockClear();

            await provider.HandleMessage(mockPanel, mockState, {
                Type: 'AddShadowTable',
                Payload: { TableID: 'tbl-1', TableName: 'AppUser' }
            });

            expect(mockState.GetModelData).not.toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
        });
    });
});
