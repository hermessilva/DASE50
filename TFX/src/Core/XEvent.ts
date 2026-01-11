export class XEvent<THandler extends (...pArgs: any[]) => any>
{
    private readonly _Handlers: Set<THandler> = new Set<THandler>();

    public Add(pHandler: THandler): void
    {
        this._Handlers.add(pHandler);
    }

    public Remove(pHandler: THandler): void
    {
        this._Handlers.delete(pHandler);
    }

    public Invoke(...pArgs: Parameters<THandler>): void
    {
        for (const handler of this._Handlers)
            handler(...pArgs);
    }

    public Raise(...pArgs: Parameters<THandler>): void
    {
        this.Invoke(...pArgs);
    }

    public get HasHandlers(): boolean
    {
        return this._Handlers.size > 0;
    }

    public Clear(): void
    {
        this._Handlers.clear();
    }
}
