
import { XGuid } from "./XGuid.js";

export class XDefault
{
    public static StopCheck: boolean = false;
    public static SetNewID: boolean = false;
}

export class XDesignerDefault
{
    public static CurrentCulture: string = "pt-BR";
    public static DefaultCulture: string = "pt-BR";
}

export class XDefaultIds
{
    public static readonly XFormulaBoxCID: string = "00000000-0000-0000-0000-000000000001";
}

export class XPropertyBinding
{
    public ID: string = XGuid.EmptyValue;
    public OnlyExplicit: boolean = false;
    public Property: unknown = null;
}

export class XPropertyBindingList
{
    private readonly _Bindings: XPropertyBinding[] = [];

    public get Count(): number
    {
        return this._Bindings.length;
    }

    public GetBindings(): XPropertyBinding[]
    {
        return this._Bindings.slice();
    }

    public Add(pBinding: XPropertyBinding): void
    {
        this._Bindings.push(pBinding);
    }

    public Clear(): void
    {
        this._Bindings.length = 0;
    }
}
