import { XError } from "./XError.js";
import { XConvert } from "./XConvert.js";

export enum XAlignment
{
    None = 0,
    Left = 1,
    Top = 2,
    Right = 4,
    Bottom = 8,
    Client = 16,
    LeftTop = Left | Top,
    RightTop = Right | Top,
    BottomLeft = Bottom | Left,
    BottomRight = Bottom | Right,
    LeftTopBottom = Left | Top | Bottom,
    RightTopBottom = Right | Top | Bottom,
    TopLeftRight = Top | Left | Right,
    BottomLeftRight = Bottom | Left | Right,
    LeftRight = Left | Right,
    TopBottom = Top | Bottom
}

export enum XRectValue
{
    All = 0,
    Height = 1,
    Width = 2,
    Left = 3,
    Right = 4,
    Top = 5,
    Bottom = 6
}

export enum XTextAlignment
{
    TopLeft = 0,
    TopCenter = 1,
    TopRight = 2,
    MiddleLeft = 3,
    MiddleCenter = 4,
    MiddleRight = 5,
    BottomLeft = 6,
    BottomCenter = 7,
    BottomRight = 8,
    Center = 9
}

export enum XFontStyle
{
    Normal = 0,
    Bold = 1,
    Italic = 2,
    BoldItalic = 3
}

export class XSize
{
    public Width: number;
    public Height: number;

    public constructor(pWidth: number = 0, pHeight: number = 0)
    {
        this.Width = pWidth;
        this.Height = pHeight;
    }

    public static Parse(pValue: string): XSize
    {
        const parts = pValue.split("|");
        if (parts.length !== 2)
            throw new XError(`The value [${pValue}] does not represent an [XSize]`);

        return new XSize(
            XConvert.ToNumber(parts[0]),
            XConvert.ToNumber(parts[1])
        );
    }

    public Shrink(pWidth: number, pHeight: number): XSize
    {
        return new XSize(this.Width - pWidth, this.Height - pHeight);
    }

    public ToString(): string
    {
        return `${this.Width}|${this.Height}`;
    }

    public CompareTo(pOther: unknown): number
    {
        const otherText = pOther === null || pOther === undefined ? "" : String(pOther);
        return this.ToString().localeCompare(otherText);
    }

    public Equals(pOther: XSize): boolean
    {
        return this.Width === pOther.Width && this.Height === pOther.Height;
    }
}

export class XPoint
{
    public X: number;
    public Y: number;

    public constructor(pX: number = 0, pY: number = 0)
    {
        this.X = pX;
        this.Y = pY;
    }

    public static Parse(pValue: string): XPoint
    {
        const parts = pValue.split("|");
        if (parts.length !== 2)
            throw new XError(`The value [${pValue}] does not represent an XPoint.`);

        return new XPoint(
            XConvert.ToNumber(parts[0]),
            XConvert.ToNumber(parts[1])
        );
    }

    public Move(pX: number, pY: number): XPoint
    {
        return new XPoint(this.X + pX, this.Y + pY);
    }

    public ToString(): string
    {
        return `${XConvert.ToString(this.X)}|${XConvert.ToString(this.Y)}`;
    }

    public CompareTo(pOther: unknown): number
    {
        const otherText = pOther === null || pOther === undefined ? "" : String(pOther);
        return this.ToString().localeCompare(otherText);
    }

    public Equals(pOther: XPoint): boolean
    {
        return this.X === pOther.X && this.Y === pOther.Y;
    }
}

export class XThickness
{
    public Left: number;
    public Top: number;
    public Right: number;
    public Bottom: number;

    public constructor(pAll: number);
    public constructor(pLeft: number, pTop: number, pRight: number, pBottom: number);
    public constructor(pA: number = 0, pB?: number, pC?: number, pD?: number)
    {
        if (pB === undefined || pC === undefined || pD === undefined)
        {
            this.Left = pA;
            this.Top = pA;
            this.Right = pA;
            this.Bottom = pA;
            return;
        }

        this.Left = pA;
        this.Top = pB;
        this.Right = pC;
        this.Bottom = pD;
    }

    public static Add(pLeft: XThickness, pRight: XThickness): XThickness
    {
        return new XThickness(
            pLeft.Left + pRight.Left,
            pLeft.Top + pRight.Top,
            pLeft.Right + pRight.Right,
            pLeft.Bottom + pRight.Bottom
        );
    }

    public static Subtract(pLeft: XThickness, pRight: XThickness): XThickness
    {
        return new XThickness(
            pLeft.Left - pRight.Left,
            pLeft.Top - pRight.Top,
            pLeft.Right - pRight.Right,
            pLeft.Bottom - pRight.Bottom
        );
    }

    public static TryParse(pValue: string): { Success: boolean; Thickness: XThickness }
    {
        const parts = pValue.split("|");

        if (parts.length === 1)
        {
            const all = XConvert.ToNumber(parts[0]);
            return { Success: true, Thickness: new XThickness(all) };
        }

        if (parts.length !== 4)
            return { Success: false, Thickness: new XThickness(0) };

        return {
            Success: true,
            Thickness: new XThickness(
                XConvert.ToNumber(parts[0]),
                XConvert.ToNumber(parts[1]),
                XConvert.ToNumber(parts[2]),
                XConvert.ToNumber(parts[3])
            )
        };
    }

    public static Parse(pValue: string): XThickness
    {
        const parts = pValue.split("|");

        if (parts.length === 1)
            return new XThickness(XConvert.ToNumber(parts[0]));

        if (parts.length !== 4)
            throw new XError(`The value [${pValue}] does not represent an XThickness.`);

        return new XThickness(
            XConvert.ToNumber(parts[0]),
            XConvert.ToNumber(parts[1]),
            XConvert.ToNumber(parts[2]),
            XConvert.ToNumber(parts[3])
        );
    }

    public get IsEmpty(): boolean
    {
        return this.Bottom + this.Top + this.Right + this.Left <= 0;
    }

    public get Max(): number
    {
        return Math.max(this.Left, this.Top, this.Right, this.Bottom);
    }

    public get IsUniform(): boolean
    {
        return this.Left === this.Top && this.Right === this.Bottom && this.Right === this.Top;
    }

    public get Width(): number
    {
        return this.Left + this.Right;
    }

    public get Height(): number
    {
        return this.Top + this.Bottom;
    }

    public ToString(): string
    {
        if (this.IsUniform)
        {
            const m = XConvert.ToString(this.Max);
            return `${m}|${m}|${m}|${m}`;
        }

        return `${XConvert.ToString(this.Left)}|${XConvert.ToString(this.Top)}|${XConvert.ToString(this.Right)}|${XConvert.ToString(this.Bottom)}`;
    }

    public CompareTo(pOther: unknown): number
    {
        const otherText = pOther === null || pOther === undefined ? "" : String(pOther);
        return this.ToString().localeCompare(otherText);
    }

    public Equals(pOther: XThickness): boolean
    {
        return this.Left === pOther.Left && this.Top === pOther.Top && this.Right === pOther.Right && this.Bottom === pOther.Bottom;
    }
}

export class XRect
{
    public Left: number;
    public Top: number;
    public Width: number;
    public Height: number;

    public constructor(pLeft: number = 0, pTop: number = 0, pWidth: number = 0, pHeight: number = 0)
    {
        this.Left = pLeft;
        this.Top = pTop;
        this.Width = pWidth;
        this.Height = pHeight;
    }

    public static Parse(pValue: string): XRect
    {
        const parts = pValue.split("|");
        if (parts.length !== 4)
            throw new XError(`The value [${pValue}] does not represent an [XRect]`);

        return new XRect(
            XConvert.ToNumber(parts[0]),
            XConvert.ToNumber(parts[1]),
            XConvert.ToNumber(parts[2]),
            XConvert.ToNumber(parts[3])
        );
    }

    public static FromPoints(pTopLeft: XPoint, pBottomRight: XPoint): XRect
    {
        return new XRect(pTopLeft.X, pTopLeft.Y, pBottomRight.X - pTopLeft.X, pBottomRight.Y - pTopLeft.Y);
    }

    public static FromLocationSize(pLocation: XPoint, pSize: XSize): XRect
    {
        return new XRect(pLocation.X, pLocation.Y, pSize.Width, pSize.Height);
    }

    public get Bottom(): number
    {
        return this.Top + this.Height;
    }

    public get Right(): number
    {
        return this.Left + this.Width;
    }

    public get Size(): XSize
    {
        return new XSize(this.Width, this.Height);
    }

    public get Location(): XPoint
    {
        return new XPoint(this.Left, this.Top);
    }

    public get TopRight(): XPoint
    {
        return new XPoint(this.Left + this.Width, this.Top);
    }

    public get BottomLeft(): XPoint
    {
        return new XPoint(this.Left, this.Top + this.Height);
    }

    public get BottomRight(): XPoint
    {
        return new XPoint(this.Left + this.Width, this.Top + this.Height);
    }

    public get IsEmpty(): boolean
    {
        return this.Height === 0 || this.Width === 0;
    }

    public Inflate(pWidth: number, pHeight: number): void
    {
        this.Left -= pWidth / 2;
        this.Top -= pHeight / 2;
        this.Width += pWidth;
        this.Height += pHeight;
    }

    public Shrink(pWidth: number, pHeight: number): void;
    public Shrink(pBorder: XThickness): void;
    public Shrink(pA: number | XThickness, pB?: number): void
    {
        if (pA instanceof XThickness)
        {
            this.Left += pA.Left;
            this.Top += pA.Top;
            this.Width -= pA.Width;
            this.Height -= pA.Height;
            return;
        }

        if (pB === undefined)
            throw new XError("Shrink requires 2 numeric values or XThickness.");

        this.Left += pA / 2;
        this.Top += pB / 2;
        this.Width -= pA;
        this.Height -= pB;
    }

    public FromPercent(pRect: XRect): XRect
    {
        const left = this.Left < 0 ? (pRect.Left + pRect.Width * (this.Left * -1)) / 100 : this.Left;
        const top = this.Top < 0 ? (pRect.Top + pRect.Height * (this.Top * -1)) / 100 : this.Top;
        const width = this.Width < 0 ? (pRect.Width * (this.Width * -1)) / 100 : this.Width;
        const height = this.Height < 0 ? (pRect.Height * (this.Height * -1)) / 100 : this.Height;

        return new XRect(left, top, width, height);
    }

    public Equals(pOther: XRect): boolean
    {
        return this.Left === pOther.Left
            && this.Top === pOther.Top
            && this.Width === pOther.Width
            && this.Height === pOther.Height;
    }

    public SetHeight(pValue: number): void
    {
        this.Height = pValue;
    }

    public SetWidth(pValue: number): void
    {
        this.Width = pValue;
    }

    public SetLeft(pValue: number): void
    {
        this.Left = pValue;
    }

    public SetRight(pValue: number): void
    {
        this.Width = pValue - this.Left;
    }

    public SetBottom(pValue: number): void
    {
        this.Height = pValue - this.Top;
    }

    public SetTop(pValue: number): void
    {
        this.Top = pValue;
    }

    public ToString(): string
    {
        return `${this.Location.ToString()}|${this.Size.ToString()}`;
    }

    public CompareTo(pOther: unknown): number
    {
        const otherText = pOther === null || pOther === undefined ? "" : String(pOther);
        return this.ToString().localeCompare(otherText);
    }
}

export class XHSLColor
{
    public H: number;
    public S: number;
    public L: number;

    public constructor(pH: number, pS: number, pL: number)
    {
        this.H = pH;
        this.S = pS;
        this.L = pL;
    }

    public SetLuminance(pL: number): XHSLColor
    {
        return new XHSLColor(this.H, this.S, pL);
    }

    public static FromRgb(pColor: XColor): XHSLColor
    {
        const r = pColor.Ri;
        const g = pColor.Gi;
        const b = pColor.Bi;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;

        if (max === min)
            return new XHSLColor(0, 0, l);

        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        let h = 0;
        if (max === r)
            h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g)
            h = (b - r) / d + 2;
        else
            h = (r - g) / d + 4;

        h /= 6;

        return new XHSLColor(h, s, l);
    }

    public static ToRgb(pH: number, pS: number, pL: number): XColor
    {
        const hue2rgb = (pP: number, pQ: number, pT: number) =>
        {
            let t = pT;
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return pP + (pQ - pP) * 6 * t;
            if (t < 1 / 2) return pQ;
            if (t < 2 / 3) return pP + (pQ - pP) * (2 / 3 - t) * 6;
            return pP;
        };

        let r: number;
        let g: number;
        let b: number;

        if (pS === 0)
        {
            r = g = b = pL;
        }
        else
        {
            const q = pL < 0.5 ? pL * (1 + pS) : pL + pS - pL * pS;
            const p = 2 * pL - q;
            r = hue2rgb(p, q, pH + 1 / 3);
            g = hue2rgb(p, q, pH);
            b = hue2rgb(p, q, pH - 1 / 3);
        }

        return new XColor(255, Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
    }
}

export class XColor
{
    public static readonly Transparent: XColor = new XColor(0, 0, 0, 0);
    public static readonly Black: XColor = new XColor(255, 0, 0, 0);
    public static readonly White: XColor = new XColor(255, 255, 255, 255);
    public static readonly Red: XColor = new XColor(255, 255, 0, 0);
    public static readonly Green: XColor = new XColor(255, 0, 255, 0);
    public static readonly Blue: XColor = new XColor(255, 0, 0, 255);

    public A: number;
    public R: number;
    public G: number;
    public B: number;

    public constructor(pR: number, pG: number, pB: number);
    public constructor(pA: number, pR: number, pG: number, pB: number);
    public constructor(pA: number, pR: number, pG?: number, pB?: number)
    {
        if (pG === undefined || pB === undefined)
        {
            this.A = 255;
            this.R = pA;
            this.G = pR;
            this.B = pG ?? 0;
            return;
        }

        this.A = pA;
        this.R = pR;
        this.G = pG;
        this.B = pB;
    }

    public static Parse(pValue: string): XColor
    {
        if (pValue.length !== 8)
            throw new XError(`The value [${pValue}] does not represent an [XColor]`);

        const bytes = XColor.DecodeHex(pValue);
        return new XColor(bytes[0], bytes[1], bytes[2], bytes[3]);
    }

    private static DecodeHex(pValue: string): number[]
    {
        if (pValue.length % 2 !== 0)
            throw new XError(`Invalid hex: ${pValue}`);

        const bytes: number[] = [];
        for (let i = 0; i < pValue.length; i += 2)
            bytes.push(parseInt(pValue.substring(i, i + 2), 16));
        return bytes;
    }

    private static EncodeHex(pBytes: number[]): string
    {
        return pBytes.map(b => (b & 0xff).toString(16).padStart(2, "0")).join("").toUpperCase();
    }

    public get Ri(): number
    {
        return this.R / 255.0;
    }

    public get Gi(): number
    {
        return this.G / 255.0;
    }

    public get Bi(): number
    {
        return this.B / 255.0;
    }

    public get IsTransparent(): boolean
    {
        return this.A === 0;
    }

    public get Darkness(): number
    {
        const hsl = XHSLColor.FromRgb(this);
        return hsl.L;
    }

    public get Inverse(): XColor
    {
        let hsl = XHSLColor.FromRgb(this);
        if (hsl.L < 0.5)
            hsl = hsl.SetLuminance(1);
        else
            hsl = hsl.SetLuminance(0);

        return XHSLColor.ToRgb(hsl.H, hsl.S, hsl.L);
    }

    public ToString(): string
    {
        return XColor.EncodeHex([this.A, this.R, this.G, this.B]);
    }

    public Equals(pOther: XColor): boolean
    {
        return this.A === pOther.A && this.R === pOther.R && this.G === pOther.G && this.B === pOther.B;
    }

    public GetHashCode(): number
    {
        return ((this.A | (this.R << 8)) | (this.G << 0x10)) | (this.B << 0x18);
    }
}

export class XBorderColor
{
    public Left: XColor;
    public Top: XColor;
    public Right: XColor;
    public Bottom: XColor;

    public constructor(pAll?: XColor);
    public constructor(pLeft: XColor, pTop: XColor, pRight: XColor, pBottom: XColor);
    public constructor(pA?: XColor, pB?: XColor, pC?: XColor, pD?: XColor)
    {
        const def = XColor.Black;
        if (pB === undefined || pC === undefined || pD === undefined)
        {
            this.Left = pA ?? def;
            this.Top = pA ?? def;
            this.Right = pA ?? def;
            this.Bottom = pA ?? def;
            return;
        }

        this.Left = pA ?? def;
        this.Top = pB;
        this.Right = pC;
        this.Bottom = pD;
    }

    public static Parse(pValue: string): XBorderColor
    {
        const parts = pValue.split("|");

        if (parts.length === 1)
            return new XBorderColor(XColor.Parse(parts[0]));

        if (parts.length !== 4)
            throw new XError(`The value [${pValue}] does not represent an XBorderColor.`);

        return new XBorderColor(
            XColor.Parse(parts[0]),
            XColor.Parse(parts[1]),
            XColor.Parse(parts[2]),
            XColor.Parse(parts[3])
        );
    }

    public get IsOne(): boolean
    {
        return this.Left.Equals(this.Top) && this.Right.Equals(this.Bottom) && this.Right.Equals(this.Top);
    }

    public ToString(): string
    {
        if (this.IsOne)
            return this.Bottom.ToString();

        return `${this.Left.ToString()}|${this.Top.ToString()}|${this.Right.ToString()}|${this.Bottom.ToString()}`;
    }

    public CompareTo(pOther: unknown): number
    {
        const otherText = pOther === null || pOther === undefined ? "" : String(pOther);
        return this.ToString().localeCompare(otherText);
    }
}

export class XFont
{
    private _Family: string;
    private _Size: number;
    private _Color: XColor;
    private _Alignment: XTextAlignment;
    private _FontStyle: XFontStyle;

    public constructor(
        pFamily: string = "Verdana",
        pSize: number = 8,
        pColor: XColor | null = null,
        pAlignment: XTextAlignment = XTextAlignment.TopLeft,
        pFontStyle: XFontStyle = XFontStyle.Normal
    )
    {
        this._Family = pFamily;
        this._Size = Math.max(8, pSize);
        this._Color = pColor ?? XColor.Black;
        this._Alignment = pAlignment;
        this._FontStyle = pFontStyle;
    }

    public static Parse(pValue: string): XFont
    {
        const parts = pValue.split("|");
        if (parts.length !== 5)
            throw new XError(`The value [${pValue}] does not represent an [XFont]`);

        return new XFont(
            parts[0],
            XConvert.ToNumber(parts[1]),
            XColor.Parse(parts[2]),
            XConvert.ToNumber(parts[3]) as XTextAlignment,
            XConvert.ToNumber(parts[4]) as XFontStyle
        );
    }

    public get Family(): string
    {
        return this._Family || "Arial";
    }

    public set Family(pValue: string)
    {
        this._Family = pValue;
    }

    public get Size(): number
    {
        if (this._Size === 0)
            return 10;
        return Math.max(6, this._Size);
    }

    public set Size(pValue: number)
    {
        this._Size = pValue;
    }

    public get Color(): XColor
    {
        return this._Color ?? XColor.Black;
    }

    public set Color(pValue: XColor)
    {
        this._Color = pValue;
    }

    public get Alignment(): XTextAlignment
    {
        return this._Alignment ?? XTextAlignment.TopLeft;
    }

    public set Alignment(pValue: XTextAlignment)
    {
        this._Alignment = pValue;
    }

    public get FontStyle(): XFontStyle
    {
        return this._FontStyle ?? XFontStyle.Normal;
    }

    public set FontStyle(pValue: XFontStyle)
    {
        this._FontStyle = pValue;
    }

    public get IsValid(): boolean
    {
        return !!this.Family && this.Family.length > 0 && this.Size > 3;
    }

    public ToString(): string
    {
        return `${this.Family}|${XConvert.ToString(this.Size)}|${this.Color.ToString()}|${this.Alignment}|${this.FontStyle}`;
    }

    public CompareTo(pOther: unknown): number
    {
        const otherText = pOther === null || pOther === undefined ? "" : String(pOther);
        return this.ToString().localeCompare(otherText);
    }
}
