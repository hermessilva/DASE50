export interface IClaudeStreamUsage {
    InputTokens: number;
    OutputTokens: number;
    CacheCreationTokens: number;
    CacheReadTokens: number;
}

export interface IClaudeStreamResult {
    Text: string;
    Usage: IClaudeStreamUsage;
    StopReason: string | null;
    Error: string | null;
}

interface IRawEvent {
    type?: string;
    subtype?: string;
    message?: {
        content?: Array<{ type?: string; text?: string; thinking?: string }>;
        stop_reason?: string;
        usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
        };
    };
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
    };
    result?: string;
    is_error?: boolean;
    error?: string;
}

export type IClaudeTextChunkHandler = (pChunk: string) => void;
export type IClaudeRawLineHandler = (pLine: string) => void;

export class XClaudeCliStreamParser {
    private _Buffer: string = "";
    private _Text: string = "";
    private _Usage: IClaudeStreamUsage = {
        InputTokens: 0,
        OutputTokens: 0,
        CacheCreationTokens: 0,
        CacheReadTokens: 0
    };
    private _StopReason: string | null = null;
    private _Error: string | null = null;
    private readonly _OnTextChunk: IClaudeTextChunkHandler | null;
    private _OnRawLine: IClaudeRawLineHandler | null = null;
    private _EmittedLength: number = 0;

    constructor(pOnTextChunk?: IClaudeTextChunkHandler) {
        this._OnTextChunk = pOnTextChunk ?? null;
    }

    SetRawLineHandler(pHandler: IClaudeRawLineHandler | null): void {
        this._OnRawLine = pHandler;
    }

    Feed(pChunk: string): void {
        this._Buffer += pChunk;
        let nl: number;
        while ((nl = this._Buffer.indexOf("\n")) >= 0) {
            const line = this._Buffer.slice(0, nl).trim();
            this._Buffer = this._Buffer.slice(nl + 1);
            if (line.length === 0)
                continue;
            this.ConsumeLine(line);
        }
    }

    Finish(): IClaudeStreamResult {
        const tail = this._Buffer.trim();
        if (tail.length > 0)
            this.ConsumeLine(tail);
        this._Buffer = "";
        return {
            Text: this._Text,
            Usage: { ...this._Usage },
            StopReason: this._StopReason,
            Error: this._Error
        };
    }

    private ConsumeLine(pLine: string): void {
        this._OnRawLine?.(pLine);
        let event: IRawEvent;
        try {
            event = JSON.parse(pLine) as IRawEvent;
        }
        catch {
            return;
        }

        if (event.type === "assistant" && event.message?.content) {
            // Collect ALL text parts within this event (Claude may emit multiple text blocks per turn).
            const textParts: string[] = [];
            for (const part of event.message.content) {
                if (part.type === "text" && typeof part.text === "string")
                    textParts.push(part.text);
            }
            if (textParts.length > 0) {
                this._Text = textParts.join("");
                if (this._OnTextChunk && this._Text.length > this._EmittedLength) {
                    const delta = this._Text.slice(this._EmittedLength);
                    this._EmittedLength = this._Text.length;
                    this._OnTextChunk(delta);
                }
            }
            if (event.message.usage)
                this.MergeUsage(event.message.usage);
            if (event.message.stop_reason)
                this._StopReason = event.message.stop_reason;
            return;
        }

        if (event.type === "result") {
            if (event.is_error === true)
                this._Error = event.error ?? event.result ?? "Unknown error";
            else if (typeof event.result === "string" && this._Text.length === 0)
                this._Text = event.result;
            if (event.usage)
                this.MergeUsage(event.usage);
            return;
        }
    }

    private MergeUsage(pSrc: NonNullable<IRawEvent["usage"]>): void {
        if (typeof pSrc.input_tokens === "number")
            this._Usage.InputTokens = pSrc.input_tokens;
        if (typeof pSrc.output_tokens === "number")
            this._Usage.OutputTokens = pSrc.output_tokens;
        if (typeof pSrc.cache_creation_input_tokens === "number")
            this._Usage.CacheCreationTokens = pSrc.cache_creation_input_tokens;
        if (typeof pSrc.cache_read_input_tokens === "number")
            this._Usage.CacheReadTokens = pSrc.cache_read_input_tokens;
    }
}
