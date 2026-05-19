/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';
import { XClaudeCliRunner } from '../../../AgentIntegration/ClaudeCli/XClaudeCliRunner';

const okInfo = { BinaryPath: '/usr/local/bin/claude', Version: '1.0.0', Authenticated: true };

function makeChild(scenario: {
    stdoutLines?: string[];
    stderrLines?: string[];
    exitCode?: number;
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

describe('XClaudeCliRunner', () => {
    it('IsAvailable returns info when authenticated', async () => {
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: jest.fn() as any });
        expect(await runner.IsAvailable()).toEqual(okInfo);
    });

    it('IsAvailable returns null when not found', async () => {
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => null, Spawn: jest.fn() as any });
        expect(await runner.IsAvailable()).toBeNull();
    });

    it('IsAvailable returns null when not authenticated', async () => {
        const runner = new XClaudeCliRunner({
            ResolveInfo: async () => ({ ...okInfo, Authenticated: false }),
            Spawn: jest.fn() as any
        });
        expect(await runner.IsAvailable()).toBeNull();
    });

    it('Run streams chunks and returns final text + usage', async () => {
        const stdoutLines = [
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'A' }] } }) + '\n',
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'AB' }] } }) + '\n',
            JSON.stringify({ type: 'result', usage: { input_tokens: 5, output_tokens: 7 } }) + '\n'
        ];
        const spawnMock = jest.fn(() => makeChild({ stdoutLines, exitCode: 0 }));
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        const chunks: string[] = [];
        const res = await runner.Run({
            Family: 'claude-fam',
            SystemPrompt: 'SYS',
            UserPayload: 'USER',
            OnChunk: (c) => chunks.push(c)
        });
        expect(res.Text).toBe('AB');
        expect(res.Usage.InputTokens).toBe(5);
        expect(chunks).toEqual(['A', 'B']);
        const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
        expect(args).toContain('--system-prompt');
        expect(args).toContain('SYS');
    });

    it('Run without system prompt omits --system-prompt flag', async () => {
        const stdoutLines = [
            JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }) + '\n'
        ];
        const spawnMock = jest.fn(() => makeChild({ stdoutLines, exitCode: 0 }));
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        await runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' });
        const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
        expect(args).not.toContain('--system-prompt');
    });

    it('Run throws when CLI binary not found', async () => {
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => null, Spawn: jest.fn() as any });
        await expect(runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' })).rejects.toThrow(/not found/i);
    });

    it('Run throws when CLI not authenticated', async () => {
        const runner = new XClaudeCliRunner({
            ResolveInfo: async () => ({ ...okInfo, Authenticated: false }),
            Spawn: jest.fn() as any
        });
        await expect(runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' })).rejects.toThrow(/not authenticated/i);
    });

    it('Run propagates result error event', async () => {
        const stdoutLines = [JSON.stringify({ type: 'result', is_error: true, error: 'bad' }) + '\n'];
        const spawnMock = jest.fn(() => makeChild({ stdoutLines, exitCode: 0 }));
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        await expect(runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' })).rejects.toThrow(/bad/);
    });

    it('Run rejects on non-zero exit code', async () => {
        const spawnMock = jest.fn(() => makeChild({ stderrLines: ['err'], exitCode: 1 }));
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        await expect(runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' })).rejects.toThrow(/exited with code 1/);
    });

    it('Run rejects when spawn throws synchronously', async () => {
        const spawnMock = jest.fn(() => { throw new Error('boom'); });
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        await expect(runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' })).rejects.toThrow('boom');
    });

    it('Run propagates child error event', async () => {
        const spawnMock = jest.fn(() => makeChild({ emitError: new Error('child') }));
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        await expect(runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' })).rejects.toThrow('child');
    });

    it('Run respects cancellation via OnCancelHook + IsCancelled', async () => {
        const spawnMock = jest.fn(() => makeChild({ stallOnCancel: true }));
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        let abortFn: (() => void) | null = null;
        let cancelled = false;
        const p = runner.Run({
            Family: 'f', SystemPrompt: '', UserPayload: 'U',
            IsCancelled: () => cancelled,
            OnCancelHook: (a) => { abortFn = a; }
        });
        await new Promise(r => setTimeout(r, 30));
        cancelled = true;
        abortFn!();
        const child = (spawnMock.mock.results[0].value as any);
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');
        child.emit('close', null);
        await expect(p).rejects.toThrow(/Cancelled/);
    });

    it('Run kill SIGTERM throw is swallowed', async () => {
        const spawnMock = jest.fn(() => {
            const child = makeChild({ stallOnCancel: true });
            child.kill = jest.fn(() => { throw new Error('refuse'); });
            return child;
        });
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        let abortFn: (() => void) | null = null;
        let cancelled = false;
        const p = runner.Run({
            Family: 'f', SystemPrompt: '', UserPayload: 'U',
            IsCancelled: () => cancelled,
            OnCancelHook: (a) => { abortFn = a; }
        });
        await new Promise(r => setTimeout(r, 30));
        cancelled = true;
        abortFn!();
        const child = (spawnMock.mock.results[0].value as any);
        child.emit('close', null);
        await expect(p).rejects.toThrow(/Cancelled/);
    });

    it('Run SIGKILL fallback fires after grace + swallows throw', async () => {
        jest.useFakeTimers();
        const killCalls: string[] = [];
        const spawnMock = jest.fn(() => {
            const child = makeChild({ stallOnCancel: true });
            child.kill = jest.fn((sig: string) => {
                killCalls.push(sig);
                if (sig === 'SIGKILL') throw new Error('boom');
            });
            return child;
        });
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        let abortFn: (() => void) | null = null;
        let cancelled = false;
        const p = runner.Run({
            Family: 'f', SystemPrompt: '', UserPayload: 'U',
            IsCancelled: () => cancelled,
            OnCancelHook: (a) => { abortFn = a; }
        });
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(50);
        await Promise.resolve();
        cancelled = true;
        abortFn!();
        jest.advanceTimersByTime(3000);
        const child = (spawnMock.mock.results[0].value as any);
        child.emit('close', null);
        jest.useRealTimers();
        await expect(p).rejects.toThrow(/Cancelled/);
        expect(killCalls).toEqual(['SIGTERM', 'SIGKILL']);
    });

    it('Run handles child without stdout / stderr / stdin', async () => {
        const spawnMock = jest.fn(() => {
            const child: any = new EventEmitter();
            child.stdout = null;
            child.stderr = null;
            child.stdin = null;
            child.kill = jest.fn();
            setImmediate(() => child.emit('close', 0));
            return child;
        });
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        const res = await runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' });
        expect(res.Text).toBe('');
    });

    it('Run ignores stdin error events (EPIPE)', async () => {
        const stdoutLines = [JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'x' }] } }) + '\n'];
        let capturedChild: any;
        const spawnMock = jest.fn(() => {
            const c = makeChild({ stdoutLines, exitCode: 0 });
            capturedChild = c;
            return c;
        });
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        const p = runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' });
        await new Promise(r => setImmediate(r));
        capturedChild.stdin.emit('error', new Error('EPIPE'));
        await p;
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
        const runner = new XClaudeCliRunner({ ResolveInfo: async () => okInfo, Spawn: spawnMock as any });
        await expect(runner.Run({ Family: 'f', SystemPrompt: '', UserPayload: 'U' })).rejects.toThrow('first');
    });

    it('constructor uses defaults when no options provided', () => {
        const runner = new XClaudeCliRunner();
        expect(runner).toBeDefined();
    });
});
