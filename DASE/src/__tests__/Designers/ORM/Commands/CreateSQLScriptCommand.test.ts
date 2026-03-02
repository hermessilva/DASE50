// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as vscode from 'vscode';
import { XCreateSQLScriptCommand } from '../../../../Designers/ORM/Commands/CreateSQLScriptCommand';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeProvider(overrides: Partial<{
    GetActiveState: () => unknown;
    GetActivePanel: () => unknown;
    GetActiveUri:   () => unknown;
}> = {}): any {
    return {
        GetActiveState: jest.fn().mockReturnValue(null),
        GetActivePanel: jest.fn().mockReturnValue(null),
        GetActiveUri:   jest.fn().mockReturnValue(null),
        ...overrides
    };
}

function makeContext(): vscode.ExtensionContext {
    return { subscriptions: [] } as any;
}

// ═════════════════════════════════════════════════════════════════════════════
// BuildPromptPreview
// ═════════════════════════════════════════════════════════════════════════════

describe('XCreateSQLScriptCommand.BuildPromptPreview', () => {
    it('includes target database label', () => {
        const result = XCreateSQLScriptCommand.BuildPromptPreview('SQL Server', 3, 2);
        expect(result).toContain('Target database: SQL Server');
    });

    it('includes table count (plural)', () => {
        const result = XCreateSQLScriptCommand.BuildPromptPreview('Oracle', 5, 0);
        expect(result).toContain('5 tables');
    });

    it('uses singular "table" for one table', () => {
        const result = XCreateSQLScriptCommand.BuildPromptPreview('PostgreSQL', 1, 0);
        expect(result).toMatch(/\b1 table\b/);
        expect(result).not.toContain('1 tables');
    });

    it('includes FK reference count (plural)', () => {
        const result = XCreateSQLScriptCommand.BuildPromptPreview('MySQL', 3, 4);
        expect(result).toContain('4 FK references');
    });

    it('uses singular "reference" for one FK', () => {
        const result = XCreateSQLScriptCommand.BuildPromptPreview('MySQL', 2, 1);
        expect(result).toMatch(/\b1 FK reference\b/);
    });

    it('mentions output .sql file', () => {
        const result = XCreateSQLScriptCommand.BuildPromptPreview('SQL Server', 2, 1);
        expect(result).toContain('.sql');
    });

    it('mentions FOREIGN KEY', () => {
        const result = XCreateSQLScriptCommand.BuildPromptPreview('PostgreSQL', 2, 1);
        expect(result).toContain('FOREIGN KEY');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// BuildAIPrompt
// ═════════════════════════════════════════════════════════════════════════════

describe('XCreateSQLScriptCommand.BuildAIPrompt', () => {
    const DBML = 'Table Users { id int [pk] \n name varchar }';

    it('SQL Server — uses square-bracket quoting', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('sqlserver', 'SQL Server', DBML, 'dbo');
        expect(result).toContain('[square brackets]');
    });

    it('SQL Server — uses IDENTITY(1,1)', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('sqlserver', 'SQL Server', DBML, 'dbo');
        expect(result).toContain('IDENTITY(1,1)');
    });

    it('SQL Server — wraps in BEGIN TRANSACTION', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('sqlserver', 'SQL Server', DBML, 'dbo');
        expect(result).toContain('BEGIN TRANSACTION');
    });

    it('Oracle — uses double-quote quoting', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('oracle', 'Oracle', DBML, 'ADMIN');
        expect(result).toContain('"double quotes"');
    });

    it('Oracle — uses SEQUENCE + TRIGGER identity', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('oracle', 'Oracle', DBML, 'ADMIN');
        expect(result).toContain('SEQUENCE');
    });

    it('Oracle — mentions VARCHAR2', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('oracle', 'Oracle', DBML, 'ADMIN');
        expect(result).toContain('VARCHAR2');
    });

    it('PostgreSQL — uses GENERATED ALWAYS AS IDENTITY', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('postgresql', 'PostgreSQL', DBML, 'public');
        expect(result).toContain('GENERATED ALWAYS AS IDENTITY');
    });

    it('PostgreSQL — wraps in BEGIN TRANSACTION', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('postgresql', 'PostgreSQL', DBML, 'public');
        expect(result).toContain('BEGIN TRANSACTION');
    });

    it('MySQL — uses AUTO_INCREMENT', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('mysql', 'MySQL', DBML, 'mydb');
        expect(result).toContain('AUTO_INCREMENT');
    });

    it('MySQL — does NOT wrap in BEGIN TRANSACTION', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('mysql', 'MySQL', DBML, 'mydb');
        expect(result).not.toContain('BEGIN TRANSACTION');
    });

    it('"another" uses custom DB name in body', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('another', 'FooDB', DBML, 'main');
        expect(result).toContain('FooDB');
    });

    it('"another" does NOT wrap in BEGIN TRANSACTION', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('another', 'Custom', DBML, 'main');
        expect(result).not.toContain('BEGIN TRANSACTION');
    });

    it('embeds the DBML content', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('sqlserver', 'SQL Server', DBML, 'dbo');
        expect(result).toContain(DBML);
    });

    it('uses provided schema name', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('sqlserver', 'SQL Server', DBML, 'sales');
        expect(result).toContain('sales');
    });

    it('falls back to "dbo" when schema is empty', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('sqlserver', 'SQL Server', DBML, '');
        expect(result).toContain('dbo');
    });

    it('instructs AI to output only SQL — no markdown fences', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('sqlserver', 'SQL Server', DBML, 'dbo');
        expect(result).toContain('Output ONLY the SQL DDL');
    });

    it('requests DROP TABLE IF EXISTS guard', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('postgresql', 'PostgreSQL', DBML, 'public');
        expect(result).toContain('DROP TABLE IF EXISTS');
    });

    it('requests FOREIGN KEY constraints', () => {
        const result = XCreateSQLScriptCommand.BuildAIPrompt('mysql', 'MySQL', DBML, 'db');
        expect(result).toContain('FOREIGN KEY');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// FindOutputPath
// ═════════════════════════════════════════════════════════════════════════════

describe('XCreateSQLScriptCommand.FindOutputPath', () => {
    const DOC_PATH = '/project/models/MyModel.dsorm';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns baseName.sql when it does not exist', async () => {
        // stat rejects  = file not found
        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

        const uri = await XCreateSQLScriptCommand.FindOutputPath(DOC_PATH);
        expect(uri.fsPath.replace(/\\/g, '/')).toBe('/project/models/MyModel.sql');
    });

    it('returns baseName_1.sql when base exists', async () => {
        // First call (base.sql) resolves = exists
        (vscode.workspace.fs.stat as jest.Mock)
            .mockResolvedValueOnce({ type: 1 })    // MyModel.sql  → exists
            .mockRejectedValueOnce(new Error('ENOENT')); // MyModel_1.sql → not found

        const uri = await XCreateSQLScriptCommand.FindOutputPath(DOC_PATH);
        expect(uri.fsPath.replace(/\\/g, '/')).toBe('/project/models/MyModel_1.sql');
    });

    it('returns baseName_2.sql when base and _1 exist', async () => {
        (vscode.workspace.fs.stat as jest.Mock)
            .mockResolvedValueOnce({ type: 1 })    // MyModel.sql   → exists
            .mockResolvedValueOnce({ type: 1 })    // MyModel_1.sql → exists
            .mockRejectedValueOnce(new Error('ENOENT')); // MyModel_2.sql → not found

        const uri = await XCreateSQLScriptCommand.FindOutputPath(DOC_PATH);
        expect(uri.fsPath.replace(/\\/g, '/')).toBe('/project/models/MyModel_2.sql');
    });

    it('strips dsorm extension from the base name', async () => {
        (vscode.workspace.fs.stat as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

        const uri = await XCreateSQLScriptCommand.FindOutputPath('/path/Schema.dsorm');
        const name = uri.fsPath.replace(/\\/g, '/').split('/').pop();
        expect(name).toBe('Schema.sql');
        expect(name).not.toContain('dsorm');
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// Register
// ═════════════════════════════════════════════════════════════════════════════

describe('XCreateSQLScriptCommand.Register', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('registers Dase.CreateSQLScript command', () => {
        XCreateSQLScriptCommand.Register(makeContext(), makeProvider());
        const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
        const ids = calls.map(([id]: [string]) => id);
        expect(ids).toContain('Dase.CreateSQLScript');
    });

    it('registers Dase.CreateSQLScriptExecute command', () => {
        XCreateSQLScriptCommand.Register(makeContext(), makeProvider());
        const calls = (vscode.commands.registerCommand as jest.Mock).mock.calls;
        const ids = calls.map(([id]: [string]) => id);
        expect(ids).toContain('Dase.CreateSQLScriptExecute');
    });

    it('adds both disposables to context subscriptions', () => {
        const ctx = makeContext();
        XCreateSQLScriptCommand.Register(ctx, makeProvider());
        expect(ctx.subscriptions.length).toBe(2);
    });

    it('shows warning when no active state on ShowPicker', async () => {
        const ctx = makeContext();
        XCreateSQLScriptCommand.Register(ctx, makeProvider({ GetActiveState: jest.fn().mockReturnValue(null) }));

        const showCmd = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .find(([id]: [string]) => id === 'Dase.CreateSQLScript');
        await showCmd[1]();   // invoke callback

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('No ORM Designer')
        );
    });

    it('shows info message when model has no tables', async () => {
        const ctx = makeContext();
        const mockState = { GetModelData: jest.fn().mockReturnValue({ Tables: [], References: [] }) };
        XCreateSQLScriptCommand.Register(ctx, makeProvider({ GetActiveState: jest.fn().mockReturnValue(mockState) }));

        const showCmd = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .find(([id]: [string]) => id === 'Dase.CreateSQLScript');
        await showCmd[1]();

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            expect.stringContaining('no tables')
        );
    });

    it('shows warning when no AI models available', async () => {
        const ctx = makeContext();
        const mockState = { GetModelData: jest.fn().mockReturnValue({ Tables: [{ ID: 't1' }], References: [] }) };
        (vscode.lm as any) = { selectChatModels: jest.fn().mockResolvedValue([]) };

        XCreateSQLScriptCommand.Register(ctx, makeProvider({ GetActiveState: jest.fn().mockReturnValue(mockState) }));

        const showCmd = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .find(([id]: [string]) => id === 'Dase.CreateSQLScript');
        await showCmd[1]();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('No AI language model')
        );
    });

    it('shows warning when Execute is called with invalid model index', async () => {
        const ctx = makeContext();
        XCreateSQLScriptCommand.Register(ctx, makeProvider());

        const execCmd = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .find(([id]: [string]) => id === 'Dase.CreateSQLScriptExecute');
        await execCmd[1](999, 'sqlserver', '');   // index 999 out of range

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('Invalid model')
        );
    });

    it('shows warning on Execute when no active state', async () => {
        const ctx = makeContext();
        XCreateSQLScriptCommand.Register(ctx, makeProvider({ GetActiveState: jest.fn().mockReturnValue(null) }));

        // Seed an empty pending models list
        const showCmd = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .find(([id]: [string]) => id === 'Dase.CreateSQLScript');

        // Inject at least one model into _PendingModels via a successful ShowPicker
        const mockState = { GetModelData: jest.fn().mockReturnValue({ Tables: [{ ID: 't1' }], References: [] }) };
        const fakeModel = { name: 'gpt-4', vendor: 'openai', family: 'gpt4', maxInputTokens: 8000, sendRequest: jest.fn() };
        (vscode.lm as any) = { selectChatModels: jest.fn().mockResolvedValue([fakeModel]) };
        const providerWithState = makeProvider({ GetActiveState: jest.fn().mockReturnValue(mockState), GetActivePanel: jest.fn().mockReturnValue({ webview: { postMessage: jest.fn() } }) });
        const ctx2 = makeContext();
        XCreateSQLScriptCommand.Register(ctx2, providerWithState);
        const showCmd2 = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .filter(([id]: [string]) => id === 'Dase.CreateSQLScript').pop();
        await showCmd2[1]();

        // Now call Execute with index 0 but no active state
        jest.clearAllMocks();
        XCreateSQLScriptCommand.Register(makeContext(), makeProvider({ GetActiveState: jest.fn().mockReturnValue(null) }));
        const execCmd2 = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .find(([id]: [string]) => id === 'Dase.CreateSQLScriptExecute');
        await execCmd2[1](0, 'sqlserver', '');

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            expect.stringContaining('No ORM Designer')
        );
    });
});
