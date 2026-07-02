jest.mock('vscode');

import { XTFXBridge } from '../../Services/TFXBridge';

describe('XTFXBridge — MoveReferenceTarget', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    function loadModel(): void {
        const model = JSON.stringify({
            Name: 'M',
            Tables: [
                { ID: 'src', Name: 'Order', X: 0, Y: 0, Width: 200, Height: 60 },
                { ID: 'real', Name: 'Customer', X: 400, Y: 0, Width: 200, Height: 60 },
                {
                    ID: 'shadow', Name: 'Customer', X: 800, Y: 0, Width: 200, Height: 28,
                    IsShadow: true, ShadowTableID: 'real', ShadowTableName: 'Customer',
                    ShadowDocumentName: ''
                },
                { ID: 'other', Name: 'Product', X: 0, Y: 400, Width: 200, Height: 60 }
            ]
        });
        bridge.LoadOrmModelFromText(model);
    }

    function firstReferenceID(): string {
        const design = bridge.Controller?.Design as any;
        return design.GetReferences()[0].ID;
    }

    function referenceTarget(pRefID: string): string {
        const design = bridge.Controller?.Design as any;
        return design.FindReferenceByID(pRefID).Target;
    }

    it('moves the FK target from the real table to its same-model shadow', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();

        const result = bridge.MoveReferenceTarget(refID, 'shadow');

        expect(result.Success).toBe(true);
        expect(referenceTarget(refID)).toBe('shadow');
    });

    it('moves the FK target from a shadow back to its origin real table', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();
        bridge.MoveReferenceTarget(refID, 'shadow');

        const result = bridge.MoveReferenceTarget(refID, 'real');

        expect(result.Success).toBe(true);
        expect(referenceTarget(refID)).toBe('real');
    });

    it('rejects moving to a table with a different origin', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();

        const result = bridge.MoveReferenceTarget(refID, 'other');

        expect(result.Success).toBe(false);
        expect(referenceTarget(refID)).toBe('real');
    });

    it('rejects when the reference already targets the given table', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();

        const result = bridge.MoveReferenceTarget(refID, 'real');

        expect(result.Success).toBe(false);
    });

    it('fails for an unknown reference', () => {
        loadModel();
        const result = bridge.MoveReferenceTarget('does-not-exist', 'shadow');
        expect(result.Success).toBe(false);
    });

    it('fails for an unknown target table', () => {
        loadModel();
        bridge.AddReference('src', 'real', 'FK_Customer');
        const refID = firstReferenceID();

        const result = bridge.MoveReferenceTarget(refID, 'ghost');

        expect(result.Success).toBe(false);
    });
});
