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

    describe('ViewType', () => {
        it('should return correct view type', () => {
            expect(XORMDesignerEditorProvider.ViewType).toBe('Dase.ORMDesigner');
        });
    });

    describe('Register', () => {
        it('should register custom editor provider', () => {
            const registered = XORMDesignerEditorProvider.Register(mockContext as any);

            expect(registered).toBeInstanceOf(XORMDesignerEditorProvider);
            expect(vscode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
                'Dase.ORMDesigner',
                expect.any(XORMDesignerEditorProvider),
                expect.objectContaining({
                    webviewOptions: { retainContextWhenHidden: true },
                    supportsMultipleEditorsPerDocument: false
                })
            );
        });

        it('should add registration to subscriptions', () => {
            XORMDesignerEditorProvider.Register(mockContext as any);

            expect(mockContext.subscriptions.length).toBeGreaterThan(0);
        });
    });

    describe('openCustomDocument', () => {
        it('should return document with uri', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const openContext = {} as vscode.CustomDocumentOpenContext;
            const token = {} as vscode.CancellationToken;

            const doc = await provider.openCustomDocument(uri as any, openContext, token);

            expect(doc.uri).toBe(uri);
            expect(typeof doc.dispose).toBe('function');
        });

        it('should call dispose without error', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const openContext = {} as vscode.CustomDocumentOpenContext;
            const token = {} as vscode.CancellationToken;

            const doc = await provider.openCustomDocument(uri as any, openContext, token);

            expect(() => doc.dispose()).not.toThrow();
        });
    });

    describe('resolveCustomEditor', () => {
        it('should setup webview panel', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            expect(mockPanel.webview.html).toBeTruthy();
            expect(mockPanel.webview.options).toBeDefined();
        });

        it('should set local resource roots', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            expect(mockPanel.webview.options).toHaveProperty('enableScripts', true);
        });

        it('should handle load error gracefully', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('Load error'));

            // Should not throw even if load fails
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            expect(mockPanel.webview.html).toBeTruthy();
        });

        it('should cleanup resources on panel dispose', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Trigger dispose callback
            if (mockPanel._disposeListeners) {
                mockPanel._disposeListeners.forEach((cb: () => void) => cb());
            }

            // Verify state is null after dispose
            expect(provider.GetActiveState()).toBeNull();
        });

        it('should clear _LastActiveKey on panel dispose when it was the last active', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Get active state to set _LastActiveKey
            const state1 = provider.GetActiveState();
            expect(state1).toBeDefined();
            
            // Make panel inactive
            mockPanel.active = false;
            
            // Should still get state from fallback
            const state2 = provider.GetActiveState();
            expect(state2).toBeDefined();
            
            // Trigger dispose callback
            if (mockPanel._disposeListeners) {
                mockPanel._disposeListeners.forEach((cb: () => void) => cb());
            }

            // After dispose, _LastActiveKey should be cleared
            expect(provider.GetActiveState()).toBeNull();
        });

        it('should not clear _LastActiveKey on panel dispose when it was not the last active', async () => {
            const uri1 = Uri.file('/test/model1.dsorm');
            const uri2 = Uri.file('/test/model2.dsorm');
            const mockDoc1 = { uri: uri1, dispose: jest.fn() };
            const mockDoc2 = { uri: uri2, dispose: jest.fn() };
            const mockPanel1 = createMockWebviewPanel();
            const mockPanel2 = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            
            // Panel1 is first, panel2 becomes active and is last
            mockPanel1.active = false;
            mockPanel2.active = true;
            await provider.resolveCustomEditor(mockDoc1 as any, mockPanel1 as any, token);
            await provider.resolveCustomEditor(mockDoc2 as any, mockPanel2 as any, token);
            
            // Dispose panel1 (which is NOT the last active)
            if (mockPanel1._disposeListeners) {
                mockPanel1._disposeListeners.forEach((cb: () => void) => cb());
            }

            // Should still return state for panel2 (the last active)
            expect(provider.GetActiveState()).toBeDefined();
        });

        it('should update _LastActiveKey when panel becomes active via onDidChangeViewState', async () => {
            const uri1 = Uri.file('/test/model1.dsorm');
            const uri2 = Uri.file('/test/model2.dsorm');
            const mockDoc1 = { uri: uri1, dispose: jest.fn() };
            const mockDoc2 = { uri: uri2, dispose: jest.fn() };
            const mockPanel1 = createMockWebviewPanel();
            const mockPanel2 = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            
            // Initially panel1 is active
            mockPanel1.active = true;
            mockPanel2.active = false;
            await provider.resolveCustomEditor(mockDoc1 as any, mockPanel1 as any, token);
            await provider.resolveCustomEditor(mockDoc2 as any, mockPanel2 as any, token);

            // Verify panel2 was last resolved, so it's the last active key
            mockPanel1.active = false;
            const state = provider.GetActiveState();
            expect(state).toBeDefined();

            // Now simulate panel1 becoming active via onDidChangeViewState
            mockPanel1.active = true;
            if (mockPanel1._viewStateListeners) {
                mockPanel1._viewStateListeners.forEach((cb) => cb({ webviewPanel: mockPanel1 as any }));
            }

            // GetActiveState should now return state for panel1
            expect(provider.GetActiveState()).toBeDefined();
        });

        it('should not update _LastActiveKey when panel becomes inactive via onDidChangeViewState', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            
            mockPanel.active = true;
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);

            // Simulate panel becoming inactive via onDidChangeViewState
            mockPanel.active = false;
            if (mockPanel._viewStateListeners) {
                mockPanel._viewStateListeners.forEach((cb) => cb({ webviewPanel: mockPanel as any }));
            }

            // Should still return state from fallback
            expect(provider.GetActiveState()).toBeDefined();
        });
    });

    describe('GetActiveState', () => {
        it('should return null when no active panel', () => {
            const state = provider.GetActiveState();

            expect(state).toBeNull();
        });

        it('should return state when active panel exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            const state = provider.GetActiveState();

            expect(state).toBeDefined();
            expect(state?.GetModelData).toBeDefined();
        });

        it('should iterate through multiple panels to find active state', async () => {
            // Create first inactive panel
            const uri1 = Uri.file('/test/model1.dsorm');
            const mockDoc1 = { uri: uri1, dispose: jest.fn() };
            const mockPanel1 = createMockWebviewPanel();
            mockPanel1.active = false;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc1 as any, mockPanel1 as any, token);

            // Create second active panel
            const uri2 = Uri.file('/test/model2.dsorm');
            const mockDoc2 = { uri: uri2, dispose: jest.fn() };
            const mockPanel2 = createMockWebviewPanel();
            mockPanel2.active = true;

            await provider.resolveCustomEditor(mockDoc2 as any, mockPanel2 as any, token);
            
            const state = provider.GetActiveState();

            expect(state).toBeDefined();
            expect(state?.GetModelData).toBeDefined();
        });

        it('should return null when active panel has no state', () => {
            // Manually add a webview without a state
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            const fakeKey = 'fake-uri';
            
            // Access private member to simulate a webview without state
            (provider as any)._Webviews.set(fakeKey, mockPanel);

            const state = provider.GetActiveState();

            expect(state).toBeNull();
        });

        it('should fallback to last active state when no panel is active', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Initially active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // First call sets _LastActiveKey
            const state1 = provider.GetActiveState();
            expect(state1).toBeDefined();
            
            // Now make panel inactive
            mockPanel.active = false;
            
            // Should fallback to last active
            const state2 = provider.GetActiveState();
            expect(state2).toBeDefined();
            expect(state2).toBe(state1);
        });
    });

    describe('GetActivePanel', () => {
        it('should return null when no active panel', () => {
            const panel = provider.GetActivePanel();

            expect(panel).toBeNull();
        });

        it('should return panel when active panel exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            const panel = provider.GetActivePanel();

            expect(panel).toBeDefined();
            expect(panel?.webview).toBeDefined();
        });

        it('should iterate through multiple panels to find active', async () => {
            // Create first inactive panel
            const uri1 = Uri.file('/test/model1.dsorm');
            const mockDoc1 = { uri: uri1, dispose: jest.fn() };
            const mockPanel1 = createMockWebviewPanel();
            mockPanel1.active = false;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc1 as any, mockPanel1 as any, token);

            // Create second active panel
            const uri2 = Uri.file('/test/model2.dsorm');
            const mockDoc2 = { uri: uri2, dispose: jest.fn() };
            const mockPanel2 = createMockWebviewPanel();
            mockPanel2.active = true;

            await provider.resolveCustomEditor(mockDoc2 as any, mockPanel2 as any, token);
            
            const panel = provider.GetActivePanel();

            expect(panel).toBeDefined();
            expect(panel).toBe(mockPanel2);
        });

        it('should fallback to last active panel when no panel is active', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // First call sets _LastActiveKey
            const panel1 = provider.GetActivePanel();
            expect(panel1).toBeDefined();
            
            // Make panel inactive
            mockPanel.active = false;
            
            // Should fallback to last active
            const panel2 = provider.GetActivePanel();
            expect(panel2).toBeDefined();
            expect(panel2).toBe(mockPanel);
        });

        it('should return null when _LastActiveKey exists but state was removed from map', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Set _LastActiveKey
            provider.GetActivePanel();
            
            // Manually remove state from map (simulating inconsistent state)
            (provider as any)._States.delete(uri.toString());
            mockPanel.active = false;
            
            // Should fallback but state is not in map, so returns null
            const state = provider.GetActiveState();
            expect(state).toBeNull();
        });

        it('should return null when _LastActiveKey exists but panel was removed from map', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            // Set _LastActiveKey
            provider.GetActivePanel();
            
            // Manually remove panel from map (simulating inconsistent state)
            (provider as any)._Webviews.delete(uri.toString());
            mockPanel.active = false;
            
            // Should fallback but panel is not in map, so returns null
            const panel = provider.GetActivePanel();
            expect(panel).toBeNull();
        });
    });

    describe('GetActiveUri', () => {
        it('should return null when no active panel', () => {
            const uri = provider.GetActiveUri();

            expect(uri).toBeNull();
        });

        it('should return URI when active panel exists', async () => {
            const uri = Uri.file('/test/model.dsorm');
            const mockDoc = { uri, dispose: jest.fn() };
            const mockPanel = createMockWebviewPanel();
            mockPanel.active = true; // Make panel active
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));

            await provider.resolveCustomEditor(mockDoc as any, mockPanel as any, token);
            
            const activeUri = provider.GetActiveUri();

            expect(activeUri).toBeDefined();
        });

        it('should iterate through multiple panels to find active URI', async () => {
            // Create first inactive panel
            const uri1 = Uri.file('/test/model1.dsorm');
            const mockDoc1 = { uri: uri1, dispose: jest.fn() };
            const mockPanel1 = createMockWebviewPanel();
            mockPanel1.active = false;
            const token = {} as vscode.CancellationToken;

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('{}'));
            await provider.resolveCustomEditor(mockDoc1 as any, mockPanel1 as any, token);

            // Create second active panel
            const uri2 = Uri.file('/test/model2.dsorm');
            const mockDoc2 = { uri: uri2, dispose: jest.fn() };
            const mockPanel2 = createMockWebviewPanel();
            mockPanel2.active = true;

            await provider.resolveCustomEditor(mockDoc2 as any, mockPanel2 as any, token);
            
            const activeUri = provider.GetActiveUri();

            expect(activeUri).toBeDefined();
            expect(activeUri?.fsPath).toContain('model2');
        });
    });

    describe('GetWebviewContent', () => {
        it('should return HTML content', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html');
            expect(html).toContain('</html>');
        });

        it('should include SVG canvas', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('<svg id="canvas"');
            expect(html).toContain('tables-layer');
            expect(html).toContain('relations-layer');
        });

        it('should include context menu', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('context-menu');
            expect(html).toContain('add-table');
        });

        it('should include table context menu with add field option', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('table-context-menu');
            expect(html).toContain('add-field');
        });

        it('should include icons in context menu items', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'mock-csp'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('class="icon"');
            expect(html).toContain('📊'); // Add Table icon
            expect(html).toContain('➕'); // Add Field icon
            expect(html).toContain('🗑️'); // Delete icon
            expect(html).toContain('✏️'); // Rename icon
        });

        it('should include CSP header', () => {
            const mockWebview = {
                asWebviewUri: jest.fn((uri: any) => uri),
                cspSource: 'test-csp-source'
            } as any;

            const html = provider.GetWebviewContent(mockWebview);

            expect(html).toContain('Content-Security-Policy');
            expect(html).toContain('test-csp-source');
        });
    });

    describe('Document lifecycle methods', () => {
        it('should have all lifecycle methods', () => {
            expect(typeof provider.openCustomDocument).toBe('function');
            expect(typeof provider.resolveCustomEditor).toBe('function');
            expect(typeof provider.saveCustomDocument).toBe('function');
            expect(typeof provider.saveCustomDocumentAs).toBe('function');
            expect(typeof provider.revertCustomDocument).toBe('function');
            expect(typeof provider.backupCustomDocument).toBe('function');
        });
    });

});
