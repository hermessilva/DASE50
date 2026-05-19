import { XClaudeCliStreamParser } from '../../../AgentIntegration/ClaudeCli/XClaudeCliStreamParser';

describe('XClaudeCliStreamParser', () => {
    it('aggregates text from assistant events', () => {
        const chunks: string[] = [];
        const parser = new XClaudeCliStreamParser(c => chunks.push(c));
        parser.Feed(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } }) + '\n');
        parser.Feed(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello world' }] } }) + '\n');
        const res = parser.Finish();
        expect(res.Text).toBe('Hello world');
        expect(chunks).toEqual(['Hello', ' world']);
    });

    it('emits no chunk when text shrinks (defensive)', () => {
        const chunks: string[] = [];
        const parser = new XClaudeCliStreamParser(c => chunks.push(c));
        parser.Feed(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'AB' }] } }) + '\n');
        parser.Feed(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'A' }] } }) + '\n');
        expect(chunks).toEqual(['AB']);
    });

    it('skips malformed JSON lines silently', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed('not json\n');
        parser.Feed(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }) + '\n');
        expect(parser.Finish().Text).toBe('ok');
    });

    it('handles split chunks across feeds', () => {
        const parser = new XClaudeCliStreamParser();
        const line = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'partial' }] } });
        parser.Feed(line.slice(0, 10));
        parser.Feed(line.slice(10) + '\n');
        expect(parser.Finish().Text).toBe('partial');
    });

    it('captures usage from result event', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({
            type: 'result',
            usage: {
                input_tokens: 100,
                output_tokens: 50,
                cache_creation_input_tokens: 30,
                cache_read_input_tokens: 70
            }
        }) + '\n');
        const r = parser.Finish();
        expect(r.Usage.InputTokens).toBe(100);
        expect(r.Usage.OutputTokens).toBe(50);
        expect(r.Usage.CacheCreationTokens).toBe(30);
        expect(r.Usage.CacheReadTokens).toBe(70);
    });

    it('captures usage from assistant message and stop_reason', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({
            type: 'assistant',
            message: {
                content: [{ type: 'text', text: 'done' }],
                stop_reason: 'end_turn',
                usage: { input_tokens: 5 }
            }
        }) + '\n');
        const r = parser.Finish();
        expect(r.StopReason).toBe('end_turn');
        expect(r.Usage.InputTokens).toBe(5);
    });

    it('captures error from result is_error event', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({ type: 'result', is_error: true, error: 'auth failed' }) + '\n');
        expect(parser.Finish().Error).toBe('auth failed');
    });

    it('falls back to result.result when error message absent', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({ type: 'result', is_error: true, result: 'oops' }) + '\n');
        expect(parser.Finish().Error).toBe('oops');
    });

    it('uses default message when both error/result missing on error', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({ type: 'result', is_error: true }) + '\n');
        expect(parser.Finish().Error).toBe('Unknown error');
    });

    it('uses result.result as fallback text when no assistant event seen', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({ type: 'result', result: 'plain text' }) + '\n');
        expect(parser.Finish().Text).toBe('plain text');
    });

    it('ignores other event types', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({ type: 'system', subtype: 'init' }) + '\n');
        const r = parser.Finish();
        expect(r.Text).toBe('');
    });

    it('processes trailing line in Finish when no newline', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'tail' }] } }));
        expect(parser.Finish().Text).toBe('tail');
    });

    it('skips non-text content parts in assistant message', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({
            type: 'assistant',
            message: { content: [{ type: 'tool_use', text: 'ignored' }, { type: 'text', text: 'kept' }] }
        }) + '\n');
        expect(parser.Finish().Text).toBe('kept');
    });

    it('handles empty buffer Finish call', () => {
        const parser = new XClaudeCliStreamParser();
        const r = parser.Finish();
        expect(r.Text).toBe('');
        expect(r.Error).toBe(null);
    });

    it('merges usage with missing fields (defensive)', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed(JSON.stringify({ type: 'result', usage: {} }) + '\n');
        const r = parser.Finish();
        expect(r.Usage.InputTokens).toBe(0);
        expect(r.Usage.OutputTokens).toBe(0);
    });

    it('skips empty lines between events', () => {
        const parser = new XClaudeCliStreamParser();
        parser.Feed('\n\n');
        parser.Feed(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'a' }] } }) + '\n\n');
        expect(parser.Finish().Text).toBe('a');
    });
});
