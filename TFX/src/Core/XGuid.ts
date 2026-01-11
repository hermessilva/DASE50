export enum XGuidFormat
{
    D = "D",
    N = "N",
    B = "B",
    P = "P"
}

const GuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GuidRegexNoDashes = /^[0-9a-f]{32}$/i;

export class XGuid
{
    public static readonly Empty: XGuid = new XGuid("00000000-0000-0000-0000-000000000000");
    public static readonly EmptyValue: string = "00000000-0000-0000-0000-000000000000";

    private readonly _Value: string;

    public constructor(pValue: string = XGuid.EmptyValue)
    {
        this._Value = pValue.toLowerCase();
    }

    public get Value(): string
    {
        return this._Value;
    }

    public get IsEmpty(): boolean
    {
        return this._Value === XGuid.Empty._Value;
    }

    public get IsFull(): boolean
    {
        return this._Value !== XGuid.Empty._Value;
    }

    public static New(): XGuid
    {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
            return new XGuid(crypto.randomUUID());

        return XGuid.NewFallback();
    }

    public static NewValue(): string
    {
        return XGuid.New().Value;
    }

    public static NewFallback(): XGuid
    {
        const hex = "0123456789abcdef";
        let guid = "";

        for (let i = 0; i < 36; i++)
        {
            if (i === 8 || i === 13 || i === 18 || i === 23)
            {
                guid += "-";
                continue;
            }

            if (i === 14)
            {
                guid += "4";
                continue;
            }

            if (i === 19)
            {
                guid += hex[(XGuid.GetRandomByte() & 0x3) | 0x8];
                continue;
            }

            guid += hex[XGuid.GetRandomByte() & 0xf];
        }

        return new XGuid(guid);
    }

    private static GetRandomByte(): number
    {
        if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function")
        {
            const arr = new Uint8Array(1);
            crypto.getRandomValues(arr);
            return arr[0];
        }

        return Math.floor(Math.random() * 256);
    }

    public static IsValid(pValue: string | null | undefined): boolean
    {
        if (!pValue)
            return false;

        return GuidRegex.test(pValue) || GuidRegexNoDashes.test(pValue);
    }

    public static Parse(pValue: string): XGuid
    {
        if (!pValue)
            throw new Error("Cannot parse null or empty string as XGuid");

        const normalized = pValue.replace(/[{()}]/g, "").trim();

        if (GuidRegex.test(normalized))
            return new XGuid(normalized.toLowerCase());

        if (GuidRegexNoDashes.test(normalized))
        {
            const v = normalized.toLowerCase();
            return new XGuid(`${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`);
        }

        throw new Error(`Invalid XGuid format: ${pValue}`);
    }

    public static TryParse(pValue: string | null | undefined): XGuid | null
    {
        if (!pValue)
            return null;

        try
        {
            return XGuid.Parse(pValue);
        }
        catch
        {
            return null;
        }
    }

    public static FromBytes(pBytes: Uint8Array): XGuid
    {
        if (pBytes.length !== 16)
            throw new Error("XGuid must be exactly 16 bytes");

        let hex = "";
        for (let i = 0; i < 16; i++)
            hex += pBytes[i].toString(16).padStart(2, "0");

        return new XGuid(`${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`);
    }

    public Equals(pOther: XGuid | null | undefined): boolean
    {
        if (!pOther)
            return false;

        return this._Value.toLowerCase() === pOther._Value.toLowerCase();
    }

    public CompareTo(pOther: XGuid | null | undefined): number
    {
        const otherValue = pOther?._Value ?? "";
        return this._Value.toLowerCase().localeCompare(otherValue.toLowerCase());
    }

    public ToString(pFormat: XGuidFormat = XGuidFormat.D): string
    {
        const normalized = this._Value.replace(/-/g, "").toLowerCase();

        if (normalized.length !== 32)
            return this._Value;

        const withDashes = `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;

        switch (pFormat)
        {
            case XGuidFormat.N:
                return normalized;
            case XGuidFormat.B:
                return `{${withDashes}}`;
            case XGuidFormat.P:
                return `(${withDashes})`;
            case XGuidFormat.D:
            default:
                return withDashes;
        }
    }

    public ToBytes(): Uint8Array
    {
        const hex = this._Value.replace(/-/g, "");
        const bytes = new Uint8Array(16);

        for (let i = 0; i < 16; i++)
            bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);

        return bytes;
    }

    public GetHashCode(): number
    {
        let hash = 0;
        for (let i = 0; i < this._Value.length; i++)
        {
            const chr = this._Value.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    }

    public static IsEmptyValue(pValue: string | null | undefined): boolean
    {
        if (!pValue)
            return true;
        return pValue === XGuid.EmptyValue;
    }

    public static IsFullValue(pValue: string | null | undefined): boolean
    {
        if (!pValue)
            return false;
        return pValue !== XGuid.EmptyValue;
    }

    public static EqualsValue(pA: string | null | undefined, pB: string | null | undefined): boolean
    {
        const a = pA ?? "";
        const b = pB ?? "";

        if (!a && !b)
            return true;
        if (!a || !b)
            return false;

        return a.toLowerCase() === b.toLowerCase();
    }

    public static CompareValue(pA: string | null | undefined, pB: string | null | undefined): number
    {
        const a = (pA ?? "").toLowerCase();
        const b = (pB ?? "").toLowerCase();
        return a.localeCompare(b);
    }

    public static ToStringValue(pValue: string | null | undefined, pFormat: XGuidFormat = XGuidFormat.D): string
    {
        if (!pValue)
            return XGuid.EmptyValue;

        return new XGuid(pValue).ToString(pFormat);
    }

    public static ToBytesValue(pValue: string): Uint8Array
    {
        return new XGuid(pValue).ToBytes();
    }

    public static FromBytesValue(pBytes: Uint8Array): string
    {
        return XGuid.FromBytes(pBytes).Value;
    }
}
