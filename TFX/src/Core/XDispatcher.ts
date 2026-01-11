export class XDispatcher
{
    public static Execute(pAction: () => void): void
    {
        pAction();
    }

    public static ExecuteAsync(pAction: () => void): void
    {
        queueMicrotask(pAction);
    }
}
