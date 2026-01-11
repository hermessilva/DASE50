export class XConvert
{
    public static ToString(pValue: unknown, _pType?: unknown): string
    {
        if (pValue === null || pValue === undefined)
            return "";
        if (typeof pValue === "string")
            return pValue;
        return String(pValue);
    }

    public static FromString<T>(pValue: string, _pType?: unknown): T
    {
        return pValue as unknown as T;
    }

    public static ToNumber(pValue: unknown): number
    {
        if (pValue === null || pValue === undefined)
            return 0;
        if (typeof pValue === "number")
            return pValue;
        const num = Number(pValue);
        return isNaN(num) ? 0 : num;
    }

    public static ToBoolean(pValue: unknown): boolean
    {
        if (pValue === null || pValue === undefined)
            return false;
        if (typeof pValue === "boolean")
            return pValue;
        if (typeof pValue === "string")
            return pValue.toLowerCase() === "true" || pValue === "1";
        return Boolean(pValue);
    }
}
