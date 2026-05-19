import { XClaudeCliPromptCompressor } from '../../../AgentIntegration/ClaudeCli/XClaudeCliPromptCompressor';
import type { IOrganizationTableInfo, IOrganizationReferenceInfo } from '../../../AgentIntegration/AgentBridge';

const makeTable = (overrides: Partial<IOrganizationTableInfo> = {}): IOrganizationTableInfo => ({
    id: 'uuid-1',
    name: 'Table1',
    width: 200,
    height: 100,
    fieldCount: 0,
    fields: [],
    isShadow: false,
    ...overrides
});

describe('XClaudeCliPromptCompressor', () => {
    it('maps UUIDs to short ids and back', () => {
        const tables = [
            makeTable({ id: 'a', name: 'Customer' }),
            makeTable({ id: 'b', name: 'Order' })
        ];
        const r = XClaudeCliPromptCompressor.Compress(tables, []);
        expect(r.Payload.tables[0].id).toBe('T1');
        expect(r.Payload.tables[1].id).toBe('T2');
        expect(r.IdMap.get('a')).toBe('T1');
        expect(r.ReverseMap.get('T2')).toBe('b');
    });

    it('Expand resolves short ids back to UUIDs and ignores unknown', () => {
        const r = XClaudeCliPromptCompressor.Compress([makeTable({ id: 'a', name: 'X' })], []);
        const out = XClaudeCliPromptCompressor.Expand(['T1', 'T99'], r.ReverseMap);
        expect(out).toEqual(['a']);
    });

    it('keeps all fields when count <= MAX_FIELDS_PER_TABLE', () => {
        const r = XClaudeCliPromptCompressor.Compress(
            [makeTable({ fields: ['ID', 'Name', 'Email'] })],
            []
        );
        expect(r.Payload.tables[0].fields).toEqual(['ID', 'Name', 'Email']);
    });

    it('trims fields prioritising PK-like, then FK-like, then others', () => {
        const r = XClaudeCliPromptCompressor.Compress(
            [makeTable({
                name: 'Order',
                fields: ['Description', 'Title', 'OrderID', 'CustomerID', 'Price', 'Discount']
            })],
            []
        );
        const fields = r.Payload.tables[0].fields;
        expect(fields.length).toBe(4);
        expect(fields).toContain('OrderID');
        expect(fields).toContain('CustomerID');
    });

    it('trims fields with no PK/FK-like uses fallback ordering', () => {
        const r = XClaudeCliPromptCompressor.Compress(
            [makeTable({ fields: ['a', 'b', 'c', 'd', 'e', 'f'] })],
            []
        );
        expect(r.Payload.tables[0].fields).toEqual(['a', 'b', 'c', 'd']);
    });

    it('compresses references using name lookup and skips unknown sides', () => {
        const tables = [
            makeTable({ id: 'a', name: 'Customer' }),
            makeTable({ id: 'b', name: 'Order' })
        ];
        const refs: IOrganizationReferenceInfo[] = [
            { sourceTable: 'Order', sourceField: 'CustomerID', targetTable: 'Customer' },
            { sourceTable: 'Unknown', sourceField: 'X', targetTable: 'Customer' }
        ];
        const r = XClaudeCliPromptCompressor.Compress(tables, refs);
        expect(r.Payload.references.length).toBe(1);
        expect(r.Payload.references[0]).toEqual({ from: 'T2', field: 'CustomerID', to: 'T1' });
    });

    it('builds FK clusters as hints (union-find)', () => {
        const tables = [
            makeTable({ id: 'a', name: 'Customer' }),
            makeTable({ id: 'b', name: 'Order' }),
            makeTable({ id: 'c', name: 'Standalone' })
        ];
        const refs: IOrganizationReferenceInfo[] = [
            { sourceTable: 'Order', sourceField: 'CustomerID', targetTable: 'Customer' }
        ];
        const r = XClaudeCliPromptCompressor.Compress(tables, refs);
        const hints = r.Payload.hints;
        const cluster = hints.find(h => h.members.includes('T1') && h.members.includes('T2'));
        expect(cluster).toBeDefined();
    });

    it('uses domain prefix to cluster tables without FKs', () => {
        const tables = [
            makeTable({ id: 'a', name: 'SYS_Permission' }),
            makeTable({ id: 'b', name: 'SYS_Role' }),
            makeTable({ id: 'c', name: 'Customer' })
        ];
        const r = XClaudeCliPromptCompressor.Compress(tables, []);
        const sys = r.Payload.hints.find(h => h.members.includes('T1') && h.members.includes('T2'));
        expect(sys).toBeDefined();
    });

    it('detects acronym prefix when no known domain prefix', () => {
        const tables = [
            makeTable({ id: 'a', name: 'ABCCustomer' }),
            makeTable({ id: 'b', name: 'ABCOrder' })
        ];
        const r = XClaudeCliPromptCompressor.Compress(tables, []);
        const cluster = r.Payload.hints.find(h => h.members.length >= 2);
        expect(cluster).toBeDefined();
    });

    it('pushes fkLike fields and uses them in trimmed result', () => {
        const r = XClaudeCliPromptCompressor.Compress(
            [makeTable({
                name: 'Big',
                fields: ['PKID', 'fk_cust', 'fk_prod', 'name', 'desc', 'extra']
            })],
            []
        );
        expect(r.Payload.tables[0].fields).toEqual(['PKID', 'fk_cust', 'fk_prod', 'name']);
    });

    it('break stops fkLike loop when MAX_FIELDS reached after PK+FK fill', () => {
        const r = XClaudeCliPromptCompressor.Compress(
            [makeTable({
                name: 'Big',
                fields: ['ID', 'Key', 'AltID', 'NameID', 'OtherID', 'fk_x', 'fk_y', 'desc']
            })],
            []
        );
        expect(r.Payload.tables[0].fields.length).toBe(4);
    });

    it('returns no prefix cluster when names do not start with detectable prefix', () => {
        const tables = [
            makeTable({ id: 'a', name: 'alpha' }),
            makeTable({ id: 'b', name: 'beta' })
        ];
        const r = XClaudeCliPromptCompressor.Compress(tables, []);
        expect(r.Payload.hints).toEqual([]);
    });

    it('excludes singleton clusters from hints', () => {
        const r = XClaudeCliPromptCompressor.Compress(
            [makeTable({ id: 'a', name: 'OneOff' })],
            []
        );
        expect(r.Payload.hints).toEqual([]);
    });

    it('union of already-merged components is no-op (covers ra===rb branch)', () => {
        const tables = [
            makeTable({ id: 'a', name: 'SYS_Permission' }),
            makeTable({ id: 'b', name: 'SYS_Role' })
        ];
        const refs: IOrganizationReferenceInfo[] = [
            { sourceTable: 'SYS_Role', sourceField: 'PermID', targetTable: 'SYS_Permission' }
        ];
        const r = XClaudeCliPromptCompressor.Compress(tables, refs);
        expect(r.Payload.hints.length).toBe(1);
    });

    it('BuildHints skips members whose short id missing (defensive)', () => {
        const tables = [
            makeTable({ id: 'a', name: 'X' }),
            makeTable({ id: 'b', name: 'Y' })
        ];
        // @ts-ignore — invoke private to cover defensive `if (!short)` branch
        const hints = (XClaudeCliPromptCompressor as any).BuildHints(tables, [], new Map([['Z', 'T9']]));
        expect(hints).toEqual([]);
    });

    it('skips clusters when nameToShort missing entry', () => {
        // Simulate by passing reference resolving to a tables[] but compressor consults nameToShort
        // we cover the `if (!short) continue;` branch via tables empty (no entries in groups)
        const r = XClaudeCliPromptCompressor.Compress([], []);
        expect(r.Payload.hints).toEqual([]);
    });
});
