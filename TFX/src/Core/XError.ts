export class XError extends Error
{
    public constructor(pMessage: string)
    {
        super(pMessage);
        this.name = "XError";
    }
}
