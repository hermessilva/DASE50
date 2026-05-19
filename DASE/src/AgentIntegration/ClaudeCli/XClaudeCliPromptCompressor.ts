import type { IOrganizationTableInfo, IOrganizationReferenceInfo } from "../AgentBridge";

export interface ICompressedTable {
    id: string;
    name: string;
    fields: string[];
    isShadow: boolean;
}

export interface ICompressedReference {
    from: string;
    field: string;
    to: string;
}

export interface ICompressedHint {
    cluster: string;
    members: string[];
}

export interface ICompressedPayload {
    tables: ICompressedTable[];
    references: ICompressedReference[];
    hints: ICompressedHint[];
}

export interface ICompressionResult {
    Payload: ICompressedPayload;
    IdMap: Map<string, string>;
    ReverseMap: Map<string, string>;
}

const MAX_FIELDS_PER_TABLE = 4;
const DOMAIN_PREFIXES = ["SYS", "USR", "USER", "AUTH", "ORD", "ORDER", "PROD", "PRODUCT", "INV", "INVENTORY", "FIN", "FINANCE", "LOG", "AUDIT", "CFG", "CONFIG"];

export class XClaudeCliPromptCompressor {
    static Compress(
        pTables: IOrganizationTableInfo[],
        pReferences: IOrganizationReferenceInfo[]
    ): ICompressionResult {
        const idMap = new Map<string, string>();
        const reverseMap = new Map<string, string>();

        for (let i = 0; i < pTables.length; i++) {
            const shortId = `T${i + 1}`;
            idMap.set(pTables[i].id, shortId);
            reverseMap.set(shortId, pTables[i].id);
        }

        const compressedTables: ICompressedTable[] = pTables.map(t => ({
            id: idMap.get(t.id)!,
            name: t.name,
            fields: XClaudeCliPromptCompressor.TrimFields(t.fields, t.name),
            isShadow: t.isShadow
        }));

        const nameToShort = new Map<string, string>();
        for (const t of pTables)
            nameToShort.set(t.name, idMap.get(t.id)!);

        const compressedRefs: ICompressedReference[] = [];
        for (const r of pReferences) {
            const fromId = nameToShort.get(r.sourceTable);
            const toId = nameToShort.get(r.targetTable);
            if (!fromId || !toId)
                continue;
            compressedRefs.push({ from: fromId, field: r.sourceField, to: toId });
        }

        const hints = XClaudeCliPromptCompressor.BuildHints(pTables, pReferences, nameToShort);

        return {
            Payload: { tables: compressedTables, references: compressedRefs, hints },
            IdMap: idMap,
            ReverseMap: reverseMap
        };
    }

    static Expand(pShortIds: string[], pReverseMap: Map<string, string>): string[] {
        const out: string[] = [];
        for (const s of pShortIds) {
            const real = pReverseMap.get(s);
            if (real)
                out.push(real);
        }
        return out;
    }

    private static TrimFields(pFields: string[], pTableName: string): string[] {
        if (pFields.length <= MAX_FIELDS_PER_TABLE)
            return pFields;

        const pkLike = pFields.filter(f => /id$|_id$|key$/i.test(f) || f.toLowerCase() === pTableName.toLowerCase() + "id");
        const fkLike = pFields.filter(f => /id$|_id$|fk_/i.test(f) && pkLike.indexOf(f) < 0);
        const others = pFields.filter(f => pkLike.indexOf(f) < 0 && fkLike.indexOf(f) < 0);

        const out: string[] = [];
        for (const f of pkLike) {
            if (out.length >= MAX_FIELDS_PER_TABLE) break;
            out.push(f);
        }
        for (const f of fkLike) {
            if (out.length >= MAX_FIELDS_PER_TABLE) break;
            out.push(f);
        }
        for (const f of others) {
            if (out.length >= MAX_FIELDS_PER_TABLE) break;
            out.push(f);
        }
        return out;
    }

    private static BuildHints(
        pTables: IOrganizationTableInfo[],
        pReferences: IOrganizationReferenceInfo[],
        pNameToShort: Map<string, string>
    ): ICompressedHint[] {
        const parent = new Map<string, string>();
        const find = (x: string): string => {
            const p = parent.get(x);
            if (!p || p === x) {
                parent.set(x, x);
                return x;
            }
            const root = find(p);
            parent.set(x, root);
            return root;
        };
        const union = (a: string, b: string) => {
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent.set(ra, rb);
        };

        for (const t of pTables)
            parent.set(t.id, t.id);

        const idByName = new Map<string, string>();
        for (const t of pTables)
            idByName.set(t.name, t.id);

        for (const r of pReferences) {
            const a = idByName.get(r.sourceTable);
            const b = idByName.get(r.targetTable);
            if (a && b) union(a, b);
        }

        const prefixClusters = new Map<string, string>();
        for (const t of pTables) {
            const prefix = XClaudeCliPromptCompressor.DetectPrefix(t.name);
            if (!prefix) continue;
            const existing = prefixClusters.get(prefix);
            if (existing)
                union(existing, t.id);
            else
                prefixClusters.set(prefix, t.id);
        }

        const groups = new Map<string, string[]>();
        for (const t of pTables) {
            const root = find(t.id);
            const short = pNameToShort.get(t.name);
            if (!short) continue;
            if (!groups.has(root)) groups.set(root, []);
            groups.get(root)!.push(short);
        }

        const out: ICompressedHint[] = [];
        let idx = 1;
        for (const members of groups.values()) {
            if (members.length < 2) continue;
            out.push({ cluster: `H${idx++}`, members });
        }
        return out;
    }

    private static DetectPrefix(pName: string): string | null {
        const upper = pName.toUpperCase();
        for (const p of DOMAIN_PREFIXES) {
            if (upper.startsWith(p + "_") || upper.startsWith(p))
                return p;
        }
        const m = /^([A-Z]{2,5})[A-Z][a-z]/.exec(pName);
        return m ? m[1] : null;
    }
}
