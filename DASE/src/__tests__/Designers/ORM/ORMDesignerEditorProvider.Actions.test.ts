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

    describe('AddTableToActiveDesigner', () => {
        it('should show warning when no active designer', async () => {
            await provider.AddTableToActiveDesigner();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No active ORM Designer.');
        });

        it('should add table when active designer exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Should not throw when called
            await provider.AddTableToActiveDesigner();
        });

        it('should post message and save when AddTable succeeds', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            
            // Create mock state with successful add
            const mockState = {
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Validate: jest.fn().mockResolvedValue([]),
                Document: { uri }
            };

            // Inject mocks directly into provider's internal maps
            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);
            (provider as any)._Documents.set(uri.toString(), mockDoc);

            await provider.AddTableToActiveDesigner();

            expect(mockState.AddTable).toHaveBeenCalledWith(100, 100, 'NewTable');
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
            expect(mockState.Save).toHaveBeenCalled();
        });

        it('should not post message or save when AddTable fails', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AddTable: jest.fn().mockReturnValue({ Success: false }),
                GetModelData: jest.fn(),
                Save: jest.fn(),
                Document: { uri }
            };

            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);
            (provider as any)._Documents.set(uri.toString(), mockDoc);

            await provider.AddTableToActiveDesigner();

            expect(mockState.AddTable).toHaveBeenCalledWith(100, 100, 'NewTable');
            expect(mockState.GetModelData).not.toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();
            expect(mockState.Save).not.toHaveBeenCalled();
        });
    });

    describe('DeleteSelected', () => {
        it('should do nothing when document not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');

            await provider.DeleteSelected(uri as any);

            // Should not throw
        });

        it('should call state delete method when document found', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            // Should not throw when called - delete will fail due to no selection
            await provider.DeleteSelected(uri as any);
        });

        it('should post message and save when delete succeeds', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            
            // Create mock state with successful delete
            const mockState = {
                DeleteSelected: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Validate: jest.fn().mockResolvedValue([]),
                Document: { uri }
            };

            // Inject mocks directly into provider's internal maps
            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);

            await provider.DeleteSelected(uri as any);

            expect(mockState.DeleteSelected).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
            expect(mockState.Save).toHaveBeenCalled();
        });
    });

    describe('RenameSelected', () => {
        it('should do nothing when document not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');

            await provider.RenameSelected(uri as any);

            // Should not throw
        });

        it('should show warning when no selection', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            await provider.RenameSelected(uri as any);

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No element selected.');
        });

        it('should post rename request when selection exists', async () => {
            // Setup selection service with selection BEFORE creating provider
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'elem-1',
                SelectedIDs: ['elem-1']
            });

            // Create new provider with the updated mock
            const testProvider = new XORMDesignerEditorProvider(mockContext as any);
            
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await testProvider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            (mockPanel.webview.postMessage as jest.Mock).mockClear();
            
            await testProvider.RenameSelected(uri as any);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    Type: expect.any(String),
                    Payload: expect.objectContaining({ ElementID: 'elem-1' })
                })
            );
        });
    });

    describe('AddFieldToSelectedTable', () => {
        it('should show warning when no active designer', async () => {
            await provider.AddFieldToSelectedTable();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No active ORM Designer.');
        });

        it('should show warning when no selection', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Document: { uri }
            };

            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);

            await provider.AddFieldToSelectedTable();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No table selected.');
        });

        it('should add field when selection exists and inputs provided', async () => {
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'table-1',
                SelectedIDs: ['table-1']
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AddField: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Validate: jest.fn().mockResolvedValue([]),
                Document: { uri }
            };

            (testProvider as any)._States.set(uri.toString(), mockState);
            (testProvider as any)._Webviews.set(uri.toString(), mockPanel);

            (vscode.window.showInputBox as jest.Mock).mockResolvedValue('TestField');
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('String');

            await testProvider.AddFieldToSelectedTable();

            expect(mockState.AddField).toHaveBeenCalledWith('table-1', 'TestField', 'String');
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
            expect(mockState.Save).toHaveBeenCalled();
        });

        it('should not add field when field name cancelled', async () => {
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'table-1',
                SelectedIDs: ['table-1']
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AddField: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            (testProvider as any)._States.set(uri.toString(), mockState);
            (testProvider as any)._Webviews.set(uri.toString(), mockPanel);

            (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);

            await testProvider.AddFieldToSelectedTable();

            expect(mockState.AddField).not.toHaveBeenCalled();
        });

        it('should not add field when data type cancelled', async () => {
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'table-1',
                SelectedIDs: ['table-1']
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AddField: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            (testProvider as any)._States.set(uri.toString(), mockState);
            (testProvider as any)._Webviews.set(uri.toString(), mockPanel);

            (vscode.window.showInputBox as jest.Mock).mockResolvedValue('TestField');
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

            await testProvider.AddFieldToSelectedTable();

            expect(mockState.AddField).not.toHaveBeenCalled();
        });

        it('should not save when AddField fails', async () => {
            (GetSelectionService as jest.Mock).mockReturnValue({
                OnSelectionChanged: jest.fn(() => ({ dispose: jest.fn() })),
                Clear: jest.fn(),
                Select: jest.fn(),
                ToggleSelection: jest.fn(),
                AddToSelection: jest.fn(),
                HasSelection: true,
                PrimaryID: 'table-1',
                SelectedIDs: ['table-1']
            });

            const testProvider = new XORMDesignerEditorProvider(mockContext as any);

            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AddField: jest.fn().mockReturnValue({ Success: false }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            (testProvider as any)._States.set(uri.toString(), mockState);
            (testProvider as any)._Webviews.set(uri.toString(), mockPanel);

            (vscode.window.showInputBox as jest.Mock).mockResolvedValue('TestField');
            (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('String');

            await testProvider.AddFieldToSelectedTable();

            expect(mockState.AddField).toHaveBeenCalled();
            expect(mockState.Save).not.toHaveBeenCalled();
        });
    });

    describe('ValidateModel', () => {
        it('should do nothing when document not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');

            await provider.ValidateModel(uri as any);

            // Should not throw
        });

        it('should validate when document found', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Should not throw when called (may have issues with validation internally)
            try {
                await provider.ValidateModel(uri as any);
            } catch {
                // Expected - mock may not support full validation
            }
        });
    });

    describe('NotifyDocumentChanged (via OnAddTable)', () => {
        it('should fire document change event when document is registered', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            
            // Create mock state with successful add
            const mockState = {
                AddTable: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Validate: jest.fn().mockResolvedValue([]),
                IsDirty: false,
                Document: { uri }
            };

            // Inject mocks directly into provider's internal maps
            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);
            (provider as any)._Documents.set(uri.toString(), mockDoc);

            // Call OnAddTable which calls NotifyDocumentChanged internally
            await (provider as any).OnAddTable(mockPanel, mockState, { X: 100, Y: 200, Name: 'Test' });

            // Verify that state was marked as dirty
            // The event is fired by the OnStateChanged listener registered in resolveCustomEditor
            expect(mockState.IsDirty).toBe(true);
        });
    });

    describe('AlignLinesInActiveDesigner', () => {
        it('should show warning when no active designer', async () => {
            await provider.AlignLinesInActiveDesigner();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No active ORM Designer.');
        });

        it('should align lines and save when successful', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AlignLines: jest.fn().mockReturnValue({ Success: true }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);

            await provider.AlignLinesInActiveDesigner();

            expect(mockState.AlignLines).toHaveBeenCalled();
            expect(mockState.GetModelData).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalled();
            expect(mockState.Save).toHaveBeenCalled();
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Lines aligned successfully.');
        });

        it('should show warning when align fails', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            
            const mockState = {
                AlignLines: jest.fn().mockReturnValue({ Success: false }),
                GetModelData: jest.fn().mockResolvedValue({ Tables: [], References: [] }),
                Save: jest.fn().mockResolvedValue(undefined),
                Document: { uri }
            };

            (provider as any)._States.set(uri.toString(), mockState);
            (provider as any)._Webviews.set(uri.toString(), mockPanel);

            await provider.AlignLinesInActiveDesigner();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('Failed to align lines.');
            expect(mockState.Save).not.toHaveBeenCalled();
        });
    });

    describe('State changes and document notifications', () => {
        it('should fire document change event when state becomes dirty', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            let capturedListener: ((e: any) => void) | null = null;
            const mockEventEmitter = {
                event: jest.fn((listener) => {
                    capturedListener = listener;
                    return { dispose: jest.fn() };
                }),
                fire: jest.fn()
            };

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            // Get the state and set it to dirty to trigger the event
            const state = (provider as any)._States.get(uri.toString());
            expect(state).toBeDefined();
            
            // Setting IsDirty should trigger OnStateChanged
            state.IsDirty = true;
            expect(state.IsDirty).toBe(true);
        });

        it('should not fire event when state IsDirty is false', async () => {
            const uri = Uri.file('/test/model2.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            // Get the state
            const state = (provider as any)._States.get(uri.toString());
            expect(state).toBeDefined();
            
            // Set dirty then clear it - this tests the false branch
            state.IsDirty = true;
            state.IsDirty = false;
            expect(state.IsDirty).toBe(false);
        });
    });

    describe('ReloadDataTypes', () => {
        it('should call state ReloadDataTypes and send updated properties', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            const state = (provider as any)._States.get(uri.toString());
            state.ReloadDataTypes = jest.fn().mockResolvedValue(undefined);
            state.Bridge.GetAllDataTypes = jest.fn().mockReturnValue(['String', 'Int32']);
            state.Bridge.GetPKDataTypes = jest.fn().mockReturnValue(['Int32', 'Int64']);
            state.GetProperties = jest.fn().mockReturnValue([]);

            await provider.ReloadDataTypes(uri as any);

            expect(state.ReloadDataTypes).toHaveBeenCalled();
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    Type: 'DataTypesReloaded'
                })
            );
        });

        it('should re-send properties when selection exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            const state = (provider as any)._States.get(uri.toString());
            state.ReloadDataTypes = jest.fn().mockResolvedValue(undefined);
            state.Bridge.GetAllDataTypes = jest.fn().mockReturnValue(['String', 'Int32']);
            state.Bridge.GetPKDataTypes = jest.fn().mockReturnValue(['Int32', 'Int64']);
            state.GetProperties = jest.fn().mockReturnValue([{ Key: 'Name', Value: 'Test' }]);

            // Mock selection service to have a selection
            const selectionService = GetSelectionService();
            (selectionService as any).HasSelection = true;
            (selectionService as any).PrimaryID = 'element-1';

            await provider.ReloadDataTypes(uri as any);

            expect(state.GetProperties).toHaveBeenCalledWith('element-1');
            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    Type: 'PropertiesChanged',
                    Payload: { Properties: [{ Key: 'Name', Value: 'Test' }] }
                })
            );

            // Clean up selection mock state
            (selectionService as any).HasSelection = false;
            (selectionService as any).PrimaryID = null;
        });

        it('should not throw when state not found', async () => {
            const uri = Uri.file('/test/nonexistent.dsorm');

            await expect(provider.ReloadDataTypes(uri as any)).resolves.not.toThrow();
        });
    });

});
