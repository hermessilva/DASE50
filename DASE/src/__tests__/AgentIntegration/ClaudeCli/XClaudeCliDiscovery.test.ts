/* eslint-disable @typescript-eslint/no-explicit-any */
import { EventEmitter } from 'events';

jest.mock('fs');
jest.mock('os');
jest.mock('child_process');

import * as fs from 'fs';
import * as os from 'os';
import * as child_process from 'child_process';
import { XClaudeCliDiscovery, SpawnCliSafe } from '../../../AgentIntegration/ClaudeCli/XClaudeCliDiscovery';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const mockSpawn = child_process.spawn as jest.Mock;

function makeChildEmitter(opts: { stdout?: string; stderr?: string; exitCode?: number; emitError?: Error; timeout?: boolean } = {}) {
    const child: any = new EventEmitter();
    const stdout: any = new EventEmitter();
    const stderr: any = new EventEmitter();
    child.stdout = stdout;
    child.stderr = stderr;
    child.stdin = { end: jest.fn() };
    child.kill = jest.fn();

    setImmediate(() => {
        if (opts.emitError) {
            child.emit('error', opts.emitError);
            return;
        }
        if (opts.stdout) stdout.emit('data', Buffer.from(opts.stdout));
        if (opts.stderr) stderr.emit('data', Buffer.from(opts.stderr));
        if (!opts.timeout) {
            child.emit('close', opts.exitCode ?? 0);
        }
    });
    return child;
}

describe('XClaudeCliDiscovery', () => {
    beforeEach(() => {
        mockSpawn.mockReset();
        mockFs.statSync.mockReset();
        mockOs.homedir.mockReset();
        XClaudeCliDiscovery.ResetCache();
        XClaudeCliDiscovery.SetOverridePath(null);
        process.env.PATH = '/usr/bin:/usr/local/bin';
        delete process.env.LOCALAPPDATA;
        delete process.env.APPDATA;
        mockOs.homedir.mockReturnValue('/home/user');
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    });

    it('SpawnCliSafe uses direct spawn for non-Windows .cmd binary', () => {
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
        const fake: any = { on: jest.fn(), kill: jest.fn() };
        mockSpawn.mockReturnValue(fake);
        const out = SpawnCliSafe('/usr/local/bin/claude', ['--version'], { windowsHide: true });
        expect(out).toBe(fake);
        expect(mockSpawn).toHaveBeenCalledWith('/usr/local/bin/claude', ['--version'], { windowsHide: true });
    });

    it('SpawnCliSafe wraps .cmd via cmd.exe on Windows with quoted args', () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
        const fake: any = { on: jest.fn(), kill: jest.fn() };
        mockSpawn.mockReturnValue(fake);
        SpawnCliSafe('C:\\bin\\claude.cmd', ['--print', 'hello world', '', '--system-prompt', 'a"b\\'], { windowsHide: true });
        expect(mockSpawn).toHaveBeenCalledTimes(1);
        const call = mockSpawn.mock.calls[0];
        expect(call[0]).toBe('cmd.exe');
        const args = call[1];
        expect(args[0]).toBe('/d');
        expect(args[1]).toBe('/s');
        expect(args[2]).toBe('/c');
        expect(typeof args[3]).toBe('string');
        expect(args[3]).toContain('"C:\\bin\\claude.cmd"');
        expect(args[3]).toContain('--print');
        expect(args[3]).toContain('"hello world"');
        expect(args[3]).toContain('""');
        expect(args[3].startsWith('""')).toBe(true);
        expect(args[3].endsWith('"')).toBe(true);
        expect(call[2].windowsVerbatimArguments).toBe(true);
    });

    it('SpawnCliSafe uses direct spawn for .exe on Windows', () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
        const fake: any = { on: jest.fn() };
        mockSpawn.mockReturnValue(fake);
        SpawnCliSafe('C:\\bin\\claude.exe', ['--version'], { windowsHide: true });
        expect(mockSpawn).toHaveBeenCalledWith('C:\\bin\\claude.exe', ['--version'], { windowsHide: true });
    });

    it('Resolve returns null when no binary found', async () => {
        mockFs.statSync.mockImplementation(() => { throw new Error('ENOENT'); });
        expect(await XClaudeCliDiscovery.Resolve()).toBeNull();
    });

    it('Resolve returns info when binary found in PATH and version parses', async () => {
        const path = '/usr/local/bin/claude';
        mockFs.statSync.mockImplementation((p: any) => {
            if (p === path) return { mtimeMs: 1, isFile: () => true } as any;
            throw new Error('ENOENT');
        });
        XClaudeCliDiscovery.SetOverridePath(path);
        mockSpawn
            .mockImplementationOnce(() => makeChildEmitter({ stdout: 'claude 1.2.3\n', exitCode: 0 }))
            .mockImplementationOnce(() => makeChildEmitter({ stdout: '{"ok":true}\n', exitCode: 0 }));

        const info = await XClaudeCliDiscovery.Resolve();
        expect(info?.BinaryPath).toBe(path);
        expect(info?.Version).toBe('1.2.3');
        expect(info?.Authenticated).toBe(true);
    });

    it('Resolve returns null when version output not parseable', async () => {
        const path = '/usr/local/bin/claude';
        mockFs.statSync.mockReturnValue({ mtimeMs: 1, isFile: () => true } as any);
        XClaudeCliDiscovery.SetOverridePath(path);
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: 'garbage', exitCode: 0 }));
        expect(await XClaudeCliDiscovery.Resolve()).toBeNull();
    });

    it('Resolve returns null when version exit code non-zero', async () => {
        mockFs.statSync.mockReturnValue({ mtimeMs: 1, isFile: () => true } as any);
        XClaudeCliDiscovery.SetOverridePath('/x/claude');
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0', exitCode: 1 }));
        expect(await XClaudeCliDiscovery.Resolve()).toBeNull();
    });

    it('Authenticated defaults to true (real auth surfaces during Run)', async () => {
        mockFs.statSync.mockReturnValue({ mtimeMs: 1, isFile: () => true } as any);
        XClaudeCliDiscovery.SetOverridePath('/x/claude');
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0', exitCode: 0 }));
        const info = await XClaudeCliDiscovery.Resolve();
        expect(info?.Authenticated).toBe(true);
    });

    it('caches Resolve result based on mtime + TTL', async () => {
        mockFs.statSync.mockReturnValue({ mtimeMs: 42, isFile: () => true } as any);
        XClaudeCliDiscovery.SetOverridePath('/x/claude');
        mockSpawn
            .mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0', exitCode: 0 }))
            .mockImplementationOnce(() => makeChildEmitter({ stdout: '{"ok":true}', exitCode: 0 }));
        const first = await XClaudeCliDiscovery.Resolve();
        const callsAfterFirst = mockSpawn.mock.calls.length;
        const second = await XClaudeCliDiscovery.Resolve();
        expect(second).toEqual(first);
        expect(mockSpawn.mock.calls.length).toBe(callsAfterFirst);
    });

    it('invalidates cache when binary mtime changes', async () => {
        mockFs.statSync.mockReturnValueOnce({ mtimeMs: 1 } as any);
        XClaudeCliDiscovery.SetOverridePath('/x/claude');
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0' }));
        await XClaudeCliDiscovery.Resolve();

        mockFs.statSync.mockReturnValue({ mtimeMs: 999 } as any);
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0' }));
        await XClaudeCliDiscovery.Resolve();
        expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('invalidates cache when binary stat fails on re-check', async () => {
        mockFs.statSync.mockReturnValueOnce({ mtimeMs: 1 } as any);
        XClaudeCliDiscovery.SetOverridePath('/x/claude');
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0' }));
        await XClaudeCliDiscovery.Resolve();

        mockFs.statSync.mockImplementation(() => { throw new Error('gone'); });
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0' }));
        const result = await XClaudeCliDiscovery.Resolve();
        expect(result).not.toBeNull();
    });

    it('invalidates cache when auth TTL elapsed', async () => {
        mockFs.statSync.mockReturnValue({ mtimeMs: 7 } as any);
        XClaudeCliDiscovery.SetOverridePath('/x/claude');
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0' }));
        const first = await XClaudeCliDiscovery.Resolve();
        const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000 + 5000);
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ stdout: '1.0.0' }));
        await XClaudeCliDiscovery.Resolve();
        spy.mockRestore();
        expect(first).toBeDefined();
        expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('FindBinary checks Windows candidate paths when override unset', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
        process.env.LOCALAPPDATA = 'C:\\Users\\x\\AppData\\Local';
        process.env.APPDATA = 'C:\\Users\\x\\AppData\\Roaming';
        process.env.PATH = 'C:\\Windows;C:\\Windows\\System32';
        const target = 'C:\\Users\\x\\AppData\\Local\\Programs\\claude-code\\claude.exe';
        mockFs.statSync.mockImplementation((p: any) => {
            if (p === target) return { mtimeMs: 1 } as any;
            throw new Error('ENOENT');
        });
        const path = XClaudeCliDiscovery.FindBinary();
        expect(path).toBe(target);
    });

    it('FindBinary returns binary discovered in PATH on linux', () => {
        Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
        process.env.PATH = '/usr/local/bin:/usr/bin';
        const target = '/usr/local/bin/claude';
        mockFs.statSync.mockImplementation((p: any) => {
            if (p === target) return { mtimeMs: 1 } as any;
            throw new Error('ENOENT');
        });
        expect(XClaudeCliDiscovery.FindBinary()).toBe(target);
    });

    it('FindBinary returns binary discovered in PATH on windows', () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
        process.env.PATH = 'C:\\bin;C:\\Windows';
        const target = 'C:\\bin\\claude.cmd';
        mockFs.statSync.mockImplementation((p: any) => {
            if (p === target) return { mtimeMs: 1 } as any;
            throw new Error('ENOENT');
        });
        expect(XClaudeCliDiscovery.FindBinary()).toBe(target);
    });

    it('FindBinary uses fallback LOCALAPPDATA when env missing', () => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
        mockOs.homedir.mockReturnValue('C:\\Users\\x');
        mockFs.statSync.mockImplementation(() => { throw new Error('ENOENT'); });
        expect(XClaudeCliDiscovery.FindBinary()).toBeNull();
    });

    it('FindBinary handles missing PATH gracefully', () => {
        delete process.env.PATH;
        mockFs.statSync.mockImplementation(() => { throw new Error('ENOENT'); });
        expect(XClaudeCliDiscovery.FindBinary()).toBeNull();
    });

    it('Resolve returns null when child spawn emits error', async () => {
        mockFs.statSync.mockReturnValue({ mtimeMs: 1 } as any);
        XClaudeCliDiscovery.SetOverridePath('/x/claude');
        mockSpawn.mockImplementationOnce(() => makeChildEmitter({ emitError: new Error('ENOENT') }));
        expect(await XClaudeCliDiscovery.Resolve()).toBeNull();
    });

    it('Resolve handles timeout in version probe', async () => {
        jest.useFakeTimers();
        mockFs.statSync.mockReturnValue({ mtimeMs: 1 } as any);
        XClaudeCliDiscovery.SetOverridePath('/x/claude');
        const stallChild: any = new EventEmitter();
        stallChild.stdout = new EventEmitter();
        stallChild.stderr = new EventEmitter();
        stallChild.stdin = { end: jest.fn() };
        stallChild.kill = jest.fn();
        mockSpawn.mockImplementationOnce(() => stallChild);

        const resolvePromise = XClaudeCliDiscovery.Resolve();
        jest.advanceTimersByTime(4000);
        const result = await resolvePromise;
        expect(result).toBeNull();
        expect(stallChild.kill).toHaveBeenCalledWith('SIGKILL');
        jest.useRealTimers();
    });
});
