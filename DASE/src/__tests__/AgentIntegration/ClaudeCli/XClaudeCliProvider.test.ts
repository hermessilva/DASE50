/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import { XClaudeCliProvider, CLAUDE_CLI_MODELS, RegisterClaudeCliProvider } from '../../../AgentIntegration/ClaudeCli/XClaudeCliProvider';

function makeChild(scenario: {
    onSpawn?: (child: any) => void;
    exitCode?: number;
    stdoutLines?: string[];
    stderrLines?: string[];
    emitError?: Error;
    stallOnCancel?: boolean;
} = {}) {
    const child: any = new EventEmitter();
    const stdout: any = new EventEmitter();
    const stderr: any = new EventEmitter();
    child.stdout = stdout;
    child.stderr = stderr;
    child.stdin = new EventEmitter();
    (child.stdin as any).end = jest.fn();
    child.kill = jest.fn();

    setImmediate(() => {
        scenario.onSpawn?.(child);
        if (scenario.emitError) {
            child.emit('error', scenario.emitError);
            return;
        }
        for (const line of scenario.stdoutLines ?? []) stdout.emit('data', Buffer.from(line));
        for (const line of scenario.stderrLines ?? []) stderr.emit('data', Buffer.from(line));
        if (!scenario.stallOnCancel) child.emit('close', scenario.exitCode ?? 0);
    });
    return child;
}

function makeProgress(): { calls: vscode.LanguageModelResponsePart[]; progress: vscode.Progress<vscode.LanguageModelResponsePart> } {
    const calls: vscode.LanguageModelResponsePart[] = [];
    return { calls, progress: { report: (v: vscode.LanguageModelResponsePart) => { calls.push(v); } } };
}

const cancelToken = (): vscode.CancellationToken & { _cancel: () => void } => {
    const listeners: (() => void)[] = [];
    const obj: any = {
        isCancellationRequested: false,
        onCancellationRequested: (cb: () => void) => {
            listeners.push(cb);
            return { dispose: () => { /* no-op */ } };
        },
        _cancel: () => {
            obj.isCancellationRequested = true;
            for (const cb of listeners) cb();
        }
    };
    return obj;
};

describe('XClaudeCliProvider', () => {
    const info = { BinaryPath: '/usr/local/bin/claude', Version: '1.0.0', Authenticated: true };

    it('provideLanguageModelChatInformation returns models when CLI available + auth', async () => {
        const spawnMock = jest.fn();
        const provider = new XClaudeCliProvider({
            ResolveInfo: async () => info,
            Spawn: spawnMock as any
        });
        const models = await provider.provideLanguageModelChatInformation({ silent: true }, cancelToken());
        expect(models.length).toBe(CLAUDE_CLI_MODELS.length);
        expect(models[0].id).toBe(CLAUDE_CLI_MODELS[0].Id);
    });

    it('returns empty list when CLI not found', async () => {
        const provider = new XClaudeCliProvider({
            ResolveInfo: async () => null,
            Spawn: jest.fn() as any
        });
        expect(await provider.provideLanguageModelChatInformation({ silent: true }, cancelToken())).toEqual([]);
    });

    it('returns empty list when not authenticated', async () => {
        const provider = new XClaudeCliProvider({
            ResolveInfo: async () => ({ ...info, Authenticated: false }),
            Spawn: jest.fn() as any
        });
        expect(await provider.provideLanguageModelChatInformation({ silent: true }, cancelToken())).toEqual([]);
    });

    it('provideTokenCount approximates length / 4', async () => {
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: jest.fn() as any });
        const count = await provider.provideTokenCount({ family: 'x' } as any, 'abcdefgh', cancelToken());
        expect(count).toBe(2);
    });

    it('provideTokenCount accepts a message object', async () => {
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: jest.fn() as any });
        const msg = new (vscode as any).LanguageModelChatMessage(
            (vscode as any).LanguageModelChatMessageRole.User,
            'hello'
        );
        const count = await provider.provideTokenCount({} as any, msg, cancelToken());
        expect(count).toBeGreaterThan(0);
    });

    it('provideLanguageModelChatResponse streams text via progress', async () => {
        const stdoutLines = [
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }] } }) + '\n',
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi there' }] } }) + '\n',
            JSON.stringify({ type: 'result', usage: { input_tokens: 1, output_tokens: 2 } }) + '\n'
        ];
        const spawnMock = jest.fn(() => makeChild({ stdoutLines, exitCode: 0 }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });

        const { calls, progress } = makeProgress();
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('SYS')], name: 'system' },
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('USER')], name: undefined }
        ];
        await provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any,
            messages,
            {} as any,
            progress,
            cancelToken()
        );
        expect(calls.map((c: any) => c.value).join('')).toBe('Hi there');
        const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
        expect(args).toContain('--system-prompt');
        expect(args).toContain('SYS');
    });

    it('prefixes Assistant role messages as conversation history', async () => {
        const stdoutLines = [
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hi' }] } }) + '\n'
        ];
        const spawnMock = jest.fn(() => makeChild({ stdoutLines }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.Assistant, content: [new (vscode as any).LanguageModelTextPart('PRIOR')], name: undefined },
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        const { progress } = makeProgress();
        await provider.provideLanguageModelChatResponse({ id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, progress, cancelToken());
        const stdinEnd = (spawnMock.mock.results[0].value as any).stdin.end as jest.Mock;
        expect(stdinEnd).toHaveBeenCalled();
        expect((stdinEnd.mock.calls[0][0] as string)).toContain('[previous-assistant]');
    });

    it('skips --system-prompt when no system parts', async () => {
        const stdoutLines = [
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }) + '\n'
        ];
        const spawnMock = jest.fn(() => makeChild({ stdoutLines }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        const { progress } = makeProgress();
        await provider.provideLanguageModelChatResponse(CLAUDE_CLI_MODELS[0] as any, messages, {} as any, progress, cancelToken());
        const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
        expect(args).not.toContain('--system-prompt');
    });

    it('throws when CLI binary not resolved at request time', async () => {
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => null, Spawn: jest.fn() as any });
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, [], {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow(/not found/i);
    });

    it('throws when CLI not authenticated at request time', async () => {
        const provider = new XClaudeCliProvider({
            ResolveInfo: async () => ({ ...info, Authenticated: false }),
            Spawn: jest.fn() as any
        });
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, [], {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow(/not authenticated/i);
    });

    it('throws when CLI exits non-zero', async () => {
        const spawnMock = jest.fn(() => makeChild({ stderrLines: ['bad'], exitCode: 1 }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow(/exited with code 1/);
    });

    it('throws when CLI returns empty text on exit 0', async () => {
        const spawnMock = jest.fn(() => makeChild({ stdoutLines: [], exitCode: 0 }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow(/empty response/);
    });

    it('reports stream parser error from result event', async () => {
        const stdoutLines = [
            JSON.stringify({ type: 'result', is_error: true, error: 'rate limited' }) + '\n'
        ];
        const spawnMock = jest.fn(() => makeChild({ stdoutLines, exitCode: 0 }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow(/rate limited/);
    });

    it('throws when spawn itself throws synchronously', async () => {
        const spawnMock = jest.fn(() => { throw new Error('spawn failed'); });
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow(/spawn failed/);
    });

    it('propagates child error event', async () => {
        const spawnMock = jest.fn(() => makeChild({ emitError: new Error('boom') }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow('boom');
    });

    it('kills child on cancellation and rejects', async () => {
        const spawnMock = jest.fn(() => makeChild({ stallOnCancel: true }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        const tok = cancelToken();
        const p = provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, tok
        );
        await new Promise(r => setTimeout(r, 30));
        const child = (spawnMock.mock.results[0].value as any);
        tok._cancel();
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');
        child.emit('close', null);
        await expect(p).rejects.toThrow(/Cancelled/);
    });

    it('kill SIGTERM throw is swallowed during cancellation', async () => {
        const spawnMock = jest.fn(() => {
            const child = makeChild({ stallOnCancel: true });
            child.kill = jest.fn(() => { throw new Error('kill fail'); });
            return child;
        });
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        const tok = cancelToken();
        const p = provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, tok
        );
        await new Promise(r => setTimeout(r, 30));
        const child = (spawnMock.mock.results[0].value as any);
        tok._cancel();
        child.emit('close', null);
        await expect(p).rejects.toThrow(/Cancelled/);
    });

    it('SIGKILL fallback runs after grace period and swallows throw', async () => {
        jest.useFakeTimers();
        let sigkillSeen = false;
        const spawnMock = jest.fn(() => {
            const child = makeChild({ stallOnCancel: true });
            child.kill = jest.fn((sig: string) => {
                if (sig === 'SIGKILL') { sigkillSeen = true; throw new Error('boom'); }
            });
            return child;
        });
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        const tok = cancelToken();
        const p = provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, tok
        );
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(50);
        await Promise.resolve();
        tok._cancel();
        jest.advanceTimersByTime(3000);
        const child = (spawnMock.mock.results[0].value as any);
        child.emit('close', null);
        jest.useRealTimers();
        await expect(p).rejects.toThrow(/Cancelled/);
        expect(sigkillSeen).toBe(true);
    });

    it('ignores stdin error events (EPIPE on cancel)', async () => {
        const stdoutLines = [JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'x' }] } }) + '\n'];
        let capturedChild: any;
        const spawnMock = jest.fn(() => {
            const c = makeChild({ stdoutLines, exitCode: 0 });
            capturedChild = c;
            return c;
        });
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        const p = provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any, messages, {} as any, makeProgress().progress, cancelToken()
        );
        await new Promise(r => setImmediate(r));
        capturedChild.stdin.emit('error', new Error('EPIPE'));
        await p;
    });

    it('SIGKILL fires after KILL_GRACE_MS and swallows throw', async () => {
        jest.useFakeTimers();
        const killCalls: string[] = [];
        const spawnMock = jest.fn(() => {
            const child = makeChild({ stallOnCancel: true });
            child.kill = jest.fn((sig: string) => {
                killCalls.push(sig);
                if (sig === 'SIGKILL') throw new Error('refuse');
            });
            return child;
        });
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        const tok = cancelToken();
        const p = provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any,
            messages, {} as any, makeProgress().progress, tok
        );
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(50);
        await Promise.resolve();
        tok._cancel();
        jest.advanceTimersByTime(3000);
        const child = spawnMock.mock.results[0].value as any;
        child.emit('close', null);
        jest.useRealTimers();
        await expect(p).rejects.toThrow(/Cancelled/);
        expect(killCalls).toEqual(['SIGTERM', 'SIGKILL']);
    });

    it('done() second invocation is a no-op (settled guard)', async () => {
        const spawnMock = jest.fn(() => {
            const child: any = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            child.stdin = { end: jest.fn(), on: jest.fn() };
            child.kill = jest.fn();
            setImmediate(() => {
                child.emit('error', new Error('first'));
                child.emit('close', 0);
            });
            return child;
        });
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any,
            messages, {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow('first');
    });

    it('handles child without stdin / stdout / stderr gracefully', async () => {
        const spawnMock = jest.fn(() => {
            const child: any = new EventEmitter();
            child.stdout = null;
            child.stderr = null;
            child.stdin = null;
            child.kill = jest.fn();
            setImmediate(() => {
                child.emit('close', 0);
            });
            return child;
        });
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            { role: (vscode as any).LanguageModelChatMessageRole.User, content: [new (vscode as any).LanguageModelTextPart('U')], name: undefined }
        ];
        await expect(provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any,
            messages, {} as any, makeProgress().progress, cancelToken()
        )).rejects.toThrow(/empty response/);
    });

    it('skips non-text content parts when stringifying', async () => {
        const stdoutLines = [
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }) + '\n'
        ];
        const spawnMock = jest.fn(() => makeChild({ stdoutLines }));
        const provider = new XClaudeCliProvider({ ResolveInfo: async () => info, Spawn: spawnMock as any });
        const messages: vscode.LanguageModelChatRequestMessage[] = [
            {
                role: (vscode as any).LanguageModelChatMessageRole.User,
                content: [
                    new (vscode as any).LanguageModelTextPart('U1'),
                    new (vscode as any).LanguageModelToolCallPart('id', 'name', {}),
                    new (vscode as any).LanguageModelTextPart('U2')
                ],
                name: undefined
            }
        ];
        await provider.provideLanguageModelChatResponse(
            { id: 'm1', name: 'm1', family: 'claude-fam', version: '1', maxInputTokens: 1000, maxOutputTokens: 100, capabilities: {} } as any,
            messages, {} as any, makeProgress().progress, cancelToken()
        );
        const stdin = (spawnMock.mock.results[0].value as any).stdin.end as jest.Mock;
        expect(stdin.mock.calls[0][0]).toContain('U1');
        expect(stdin.mock.calls[0][0]).toContain('U2');
    });

    it('default ResolveInfo invokes XClaudeCliDiscovery.Resolve when no override given', async () => {
        const mod = jest.requireMock('../../../AgentIntegration/ClaudeCli/XClaudeCliDiscovery');
        const real = jest.requireActual('../../../AgentIntegration/ClaudeCli/XClaudeCliDiscovery');
        const provider = new XClaudeCliProvider();
        const spy = jest.spyOn(real.XClaudeCliDiscovery, 'Resolve').mockResolvedValue(null);
        const out = await provider.provideLanguageModelChatInformation({ silent: true }, cancelToken());
        expect(out).toEqual([]);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
        expect(mod).toBeDefined();
    });

    it('RegisterClaudeCliProvider returns disposable when vscode.lm available', () => {
        const ctx: any = { subscriptions: [] };
        const d = RegisterClaudeCliProvider(ctx);
        expect(d).not.toBeNull();
        expect(ctx.subscriptions.length).toBe(1);
    });

    it('RegisterClaudeCliProvider returns null when registration throws', () => {
        const ctx: any = { subscriptions: [] };
        const original = (vscode as any).lm.registerLanguageModelChatProvider;
        (vscode as any).lm.registerLanguageModelChatProvider = jest.fn(() => { throw new Error('blocked'); });
        try {
            expect(RegisterClaudeCliProvider(ctx)).toBeNull();
            expect(ctx.subscriptions.length).toBe(0);
        }
        finally {
            (vscode as any).lm.registerLanguageModelChatProvider = original;
        }
    });

    it('RegisterClaudeCliProvider returns null when API missing', () => {
        const ctx: any = { subscriptions: [] };
        const original = (vscode as any).lm.registerLanguageModelChatProvider;
        (vscode as any).lm.registerLanguageModelChatProvider = undefined;
        try {
            expect(RegisterClaudeCliProvider(ctx)).toBeNull();
            expect(ctx.subscriptions.length).toBe(0);
        }
        finally {
            (vscode as any).lm.registerLanguageModelChatProvider = original;
        }
    });
});
