jest.mock('vscode');

import { XTFXBridge } from '../../Services/TFXBridge';
import { XPropertyType } from '../../Models/PropertyItem';
import * as tfx from '@tootega/tfx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModelWithStateControlTable(stateTableName: string, includeStateTable = false): string
{
    const tables: object[] = [
        { ID: 'table-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }
    ];
    if (includeStateTable)
        tables.push({ ID: 'state-1', Name: stateTableName, X: 300, Y: 0, Width: 200, Height: 60 });

    return JSON.stringify({
        Name: 'TestModel',
        StateControlTable: stateTableName,
        Tables: tables
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XTFXBridge — State Control', () =>
{
    let bridge: XTFXBridge;

    beforeEach(() =>
    {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    // -----------------------------------------------------------------------
    // UpdateProperty — UseStateControl = true (EnableStateControl)
    // -----------------------------------------------------------------------

    describe('UpdateProperty — UseStateControl = true', () =>
    {
        it('should return failure when StateControlTable is empty', () =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Model',
                StateControlTable: '',
                Tables: [{ ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));

            const result = bridge.UpdateProperty('tbl-1', 'UseStateControl', true);
            expect(result.Success).toBe(false);
        });

        it('should return failure when table not found', () =>
        {
            bridge.LoadOrmModelFromText(makeModelWithStateControlTable('Status'));
            const result = bridge.UpdateProperty('nonexistent', 'UseStateControl', true);
            expect(result.Success).toBe(false);
        });

        it('should succeed and create state field + reference when state table exists in design', () =>
        {
            bridge.LoadOrmModelFromText(makeModelWithStateControlTable('Status', true));

            const result = bridge.UpdateProperty('table-1', 'UseStateControl', true);

            expect(result.Success).toBe(true);

            const design = bridge.Controller?.Design as tfx.XORMDesign;
            const ordersTable = design.FindTableByID('table-1')!;
            expect(ordersTable.UseStateControl).toBe(true);
            expect(ordersTable.GetStateField()).not.toBeNull();
            expect(ordersTable.GetStateField()!.Name).toBe('StatusID');
        });

        it('should auto-create a shadow table when state table is not in design', () =>
        {
            bridge.LoadOrmModelFromText(makeModelWithStateControlTable('ExternalStatus', false));
            const tablesBefore = (bridge.Controller?.Design as tfx.XORMDesign).GetTables().length;

            const result = bridge.UpdateProperty('table-1', 'UseStateControl', true);

            expect(result.Success).toBe(true);
            const tablesAfter = (bridge.Controller?.Design as tfx.XORMDesign).GetTables().length;
            expect(tablesAfter).toBe(tablesBefore + 1);

            const shadowTable = (bridge.Controller?.Design as tfx.XORMDesign)
                .GetTables().find(t => t.IsShadow);
            expect(shadowTable).toBeDefined();
            expect(shadowTable!.ShadowTableName).toBe('ExternalStatus');
        });

        it('should return failure when called on a shadow table', () =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Model',
                StateControlTable: 'Status',
                Tables: [
                    { ID: 'tbl-1', Name: 'Status', X: 0, Y: 0, Width: 200, Height: 60,
                      IsShadow: true, ShadowTableName: 'Status', ShadowDocumentName: 'Other' }
                ]
            }));

            const result = bridge.UpdateProperty('tbl-1', 'UseStateControl', true);
            // Shadow tables are read-only — blocked before the UseStateControl switch
            expect(result.Success).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // UpdateProperty — UseStateControl = false (DisableStateControl)
    // -----------------------------------------------------------------------

    describe('UpdateProperty — UseStateControl = false', () =>
    {
        it('should disable state control and remove field + reference', () =>
        {
            bridge.LoadOrmModelFromText(makeModelWithStateControlTable('Status', true));
            bridge.UpdateProperty('table-1', 'UseStateControl', true);

            const design = bridge.Controller?.Design as tfx.XORMDesign;
            const ordersTable = design.FindTableByID('table-1')!;
            expect(ordersTable.UseStateControl).toBe(true);

            const result = bridge.UpdateProperty('table-1', 'UseStateControl', false);

            expect(result.Success).toBe(true);
            expect(ordersTable.UseStateControl).toBe(false);
            expect(ordersTable.GetStateField()).toBeNull();
        });

        it('should return failure when table not found', () =>
        {
            bridge.LoadOrmModelFromText(makeModelWithStateControlTable('Status'));
            const result = bridge.UpdateProperty('nonexistent', 'UseStateControl', false);
            expect(result.Success).toBe(false);
        });

        it('should return failure when no active design', () =>
        {
            // Bridge never loaded
            const result = bridge.UpdateProperty('any-id', 'UseStateControl', false);
            expect(result.Success).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // UpdateProperty — no design loaded
    // -----------------------------------------------------------------------

    it('should return failure for UseStateControl when design is null', () =>
    {
        // Don't load any model
        const result = bridge.UpdateProperty('tbl', 'UseStateControl', true);
        expect(result.Success).toBe(false);
    });

    // -----------------------------------------------------------------------
    // GetProperties — UseStateControl property
    // -----------------------------------------------------------------------

    describe('GetProperties — UseStateControl', () =>
    {
        it('should include UseStateControl boolean property for a non-shadow table', () =>
        {
            bridge.LoadOrmModelFromText(makeModelWithStateControlTable('Status'));
            const props = bridge.GetProperties('table-1');
            const prop = props.find(p => p.Key === 'UseStateControl');
            expect(prop).toBeDefined();
            expect(prop!.Type).toBe(XPropertyType.Boolean);
        });

        it('should mark UseStateControl as read-only when StateControlTable is empty', () =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Model',
                StateControlTable: '',
                Tables: [{ ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const props = bridge.GetProperties('tbl-1');
            const prop = props.find(p => p.Key === 'UseStateControl');
            expect(prop!.IsReadOnly).toBe(true);
        });

        it('should mark UseStateControl as editable when StateControlTable is set', () =>
        {
            bridge.LoadOrmModelFromText(makeModelWithStateControlTable('Status'));
            const props = bridge.GetProperties('table-1');
            const prop = props.find(p => p.Key === 'UseStateControl');
            expect(prop!.IsReadOnly).toBe(false);
        });

        it('should include a contextual Hint mentioning the state table name', () =>
        {
            bridge.LoadOrmModelFromText(makeModelWithStateControlTable('Status'));
            const props = bridge.GetProperties('table-1');
            const prop = props.find(p => p.Key === 'UseStateControl');
            expect(prop!.Hint).toContain('Status');
        });

        it('should include a hint suggesting to set StateControlTable when it is empty', () =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Model',
                StateControlTable: '',
                Tables: [{ ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const props = bridge.GetProperties('tbl-1');
            const prop = props.find(p => p.Key === 'UseStateControl');
            expect(prop!.Hint).toBeTruthy();
        });

        it('should not include UseStateControl for shadow tables', () =>
        {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Model',
                StateControlTable: 'Status',
                Tables: [
                    { ID: 'shadow-1', Name: 'Status', X: 0, Y: 0, Width: 200, Height: 28,
                      IsShadow: true, ShadowTableName: 'Status', ShadowDocumentName: 'Other' }
                ]
            }));
            const props = bridge.GetProperties('shadow-1');
            const prop = props.find(p => p.Key === 'UseStateControl');
            expect(prop).toBeUndefined();
        });
    });
});
