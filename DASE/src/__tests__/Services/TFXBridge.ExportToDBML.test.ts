import { XTFXBridge } from '../../Services/TFXBridge';
import * as tfx from '@tootega/tfx';

describe('XTFXBridge — ExportToDBML', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        bridge = new XTFXBridge();
        bridge.Initialize();
    });

    it('should return empty string when no tables are populated', () => {
        const result = bridge.ExportToDBML();
        expect(result).toBe('');
    });

    it('should generate DBML for tables with varied field properties', () => {
        const model = JSON.stringify({
            Name: 'ECommerce',
            Tables: [
                {
                    ID: 'tbl1',
                    Name: 'Users',
                    X: 0, Y: 0, Width: 100, Height: 100,
                    Description: 'System users',
                    Fields: [
                        { ID: 'f1', Name: 'ID', DataType: 'int', IsPrimaryKey: true, IsAutoIncrement: true },
                        { ID: 'f2', Name: 'Email', DataType: 'varchar', IsRequired: true, AllowedValues: 'a|b' },
                        { ID: 'f3', Name: 'Status', DataType: 'int', DefaultValue: '1', Description: 'Active=1' }
                    ]
                },
                {
                    ID: 'tbl2',
                    Name: 'Orders',
                    X: 200, Y: 0, Width: 100, Height: 100,
                    Fields: [
                        { ID: 'f4', Name: 'ID', DataType: 'int', IsPrimaryKey: true },
                        { ID: 'f5', Name: 'UserID', DataType: 'int', IsRequired: true }
                    ]
                }
            ],
            References: [
                { ID: 'ref1', SourceFieldID: 'f5', TargetTableID: 'tbl1' }
            ]
        });

        bridge.LoadOrmModelFromText(model);
        const dbml = bridge.ExportToDBML();

        // Project
        expect(dbml).toContain('Project "DASE_Project" {');

        // Tables
        expect(dbml).toContain('Table "Users" {');
        expect(dbml).toContain('Table "Orders" {');

        // Field Details
        expect(dbml).toContain('"ID" Int32 [pk, increment]');
        expect(dbml).toContain('"Email" varchar [not null, note: \'Values: a|b\']');
        expect(dbml).toContain('"Status" int [default: 1, note: \'Active=1\']');

        expect(dbml).toContain(`  Note: '`);
        expect(dbml).toContain(`    System users`);
        expect(dbml).toContain(`  '`);

        // Relationships
        expect(dbml).toContain('Ref "FK": "Orders"."UserID" > "Users"."ID"');
    });

    it('should generate 1-to-1 relationship when source field is a PK', () => {
        const model = JSON.stringify({
            Name: 'Profiles',
            Tables: [
                {
                    ID: 't1', Name: 'Users',
                    Fields: [{ ID: 'pk1', Name: 'ID', DataType: 'int', IsPrimaryKey: true }]
                },
                {
                    ID: 't2', Name: 'UserSettings',
                    Fields: [{ ID: 'pk2', Name: 'UserID', DataType: 'int', IsPrimaryKey: true }]
                }
            ],
            References: [
                { ID: 'r1', SourceFieldID: 'pk2', TargetTableID: 't1' }
            ]
        });

        bridge.LoadOrmModelFromText(model);
        const dbml = bridge.ExportToDBML();

        expect(dbml).toContain('Ref "FK": "UserSettings"."UserID" - "Users"."ID"');
    });

    it('should ignore shadow tables from DBML generation', () => {
        const model = JSON.stringify({
            Name: 'WithShadows',
            Tables: [
                {
                    ID: 't1', Name: 'LocalTable',
                    Fields: [{ ID: 'f1', Name: 'ID', DataType: 'int', IsPrimaryKey: true }]
                },
                {
                    ID: 't2', Name: 'ShadowTable', IsShadow: true,
                    Fields: [{ ID: 'f2', Name: 'RemoteID', DataType: 'int', IsPrimaryKey: true }]
                }
            ]
        });

        bridge.LoadOrmModelFromText(model);
        const dbml = bridge.ExportToDBML();

        expect(dbml).toContain('Table "LocalTable" {');
        expect(dbml).not.toContain('Table "ShadowTable" {');
    });

    it('should extract XORMDataSet tuples as DBML @seed markdown tables', () => {
        const model = JSON.stringify({
            Name: 'SeedProj',
            Tables: [
                {
                    ID: 't1', Name: 'StatusTypes',
                    Description: 'Table with status values',
                    Fields: [
                        { ID: 'f1', Name: 'ID', DataType: 'int', IsPrimaryKey: true },
                        { ID: 'f2', Name: 'Name', DataType: 'varchar' }
                    ]
                }
            ]
        });

        bridge.LoadOrmModelFromText(model);

        // Manually inject XORMDataSet and tuples to bypass JSON loader limitations
        const table = (bridge as any)._Controller.GetElementByID('t1') as tfx.XORMTable;
        if (table) {
            const ds = new tfx.XORMDataSet();
            ds.ID = 'ds1';
            ds.Name = 'T';

            const tuple1 = new tfx.XORMDataTuple();
            tuple1.ID = 'tuple1';
            const fv1_1 = new tfx.XFieldValue(); fv1_1.FieldID = 'f1'; fv1_1.Value = '1';
            const fv1_2 = new tfx.XFieldValue(); fv1_2.FieldID = 'f2'; fv1_2.Value = 'Active';
            tuple1.AppendChild(fv1_1);
            tuple1.AppendChild(fv1_2);
            ds.AppendChild(tuple1);

            const tuple2 = new tfx.XORMDataTuple();
            tuple2.ID = 'tuple2';
            const fv2_1 = new tfx.XFieldValue(); fv2_1.FieldID = 'f1'; fv2_1.Value = '2';
            const fv2_2 = new tfx.XFieldValue(); fv2_2.FieldID = 'f2'; fv2_2.Value = 'Inactive';
            tuple2.AppendChild(fv2_1);
            tuple2.AppendChild(fv2_2);
            ds.AppendChild(tuple2);

            table.AppendChild(ds);
        }

        const dbml = bridge.ExportToDBML();

        // 1. Should have the Note block
        expect(dbml).toContain(`  Note: '`);
        expect(dbml).toContain(`    Table with status values`);
        // 2. Should have a blank line separation
        // 3. Should have @seed block
        expect(dbml).toContain(`    @seed`);
        expect(dbml).toContain(`    | ID | Name |`);
        expect(dbml).toContain(`    | 1 | Active |`);
        expect(dbml).toContain(`    | 2 | Inactive |`);
        expect(dbml).toContain(`  '`);
    });
});
