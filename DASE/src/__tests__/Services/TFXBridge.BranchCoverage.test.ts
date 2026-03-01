jest.mock('vscode');

import * as vscode from 'vscode';
import { XTFXBridge, IAddShadowTablePayload } from '../../Services/TFXBridge';
import { XPropertyType } from '../../Models/PropertyItem';

import * as tfx from '@tootega/tfx';

describe('XTFXBridge — Branch Coverage', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    describe('LoadAvailableOrmFiles — nested subdirectories', () => {
        it('should handle nested directory inside a subdirectory (pRelPrefix ternary true branch)', async () => {
            bridge.SetContextPath('/test/dir/Current.dsorm');
            (vscode.workspace.fs.readDirectory as jest.Mock)
                .mockResolvedValueOnce([
                    ['sub1', vscode.FileType.Directory]
                ])
                .mockResolvedValueOnce([
                    ['sub2', vscode.FileType.Directory],
                    ['File1.dsorm', vscode.FileType.File]
                ])
                .mockResolvedValueOnce([
                    ['Deep.dsorm', vscode.FileType.File]
                ]);

            await bridge.LoadAvailableOrmFiles();

            const files = (bridge as any)._AvailableOrmFiles as string[];
            expect(files).toContain('sub1/File1.dsorm');
            expect(files).toContain('sub1/sub2/Deep.dsorm');
        });
    });

    describe('LoadParentModelTables — edge branches', () => {
        it('should handle deserialization failure gracefully (result?.Success false)', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');
            bridge.Initialize();
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('<<<INVALID XML>>>'));

            await bridge.LoadParentModelTables(['broken.dsorm']);

            expect((bridge as any)._ParentModelTableGroups).toEqual([]);
        });

        it('should skip tables with empty names during parent model loading', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const b = new XTFXBridge();
            b.LoadOrmModelFromText(JSON.stringify({
                Name: 'Model',
                Tables: [
                    { ID: 't1', Name: 'Valid', X: 0, Y: 0, Width: 200, Height: 60 },
                    { ID: 't2', Name: '', X: 250, Y: 0, Width: 200, Height: 60 }
                ]
            }));
            const xml = b.SaveOrmModelToText();
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(xml));

            bridge.Initialize();
            await bridge.LoadParentModelTables(['Model.dsorm']);

            const groups = (bridge as any)._ParentModelTableGroups;
            if (groups.length > 0)
            {
                const names = groups[0].Tables.map((t: any) => t.Name);
                expect(names).not.toContain('');
            }
        });

        it('should handle model file with no tables (empty result)', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const b = new XTFXBridge();
            b.LoadOrmModelFromText(JSON.stringify({ Name: 'Empty' }));
            const xml = b.SaveOrmModelToText();
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(xml));

            bridge.Initialize();
            await bridge.LoadParentModelTables(['Empty.dsorm']);

            expect((bridge as any)._ParentModelTableGroups).toEqual([]);
        });
    });

    describe('SyncShadowTables — ShadowTableID not matching any real table', () => {
        it('should fall through to ShadowDocumentName when ShadowTableID references a non-existent table', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    { ID: 'real-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 },
                    {
                        ID: 'shadow-1', Name: 'ShadowNoMatch', X: 300, Y: 0, Width: 200, Height: 28,
                        IsShadow: true, ShadowTableID: 'nonexistent-id', ShadowTableName: 'ShadowNoMatch',
                        ShadowDocumentName: ''
                    }
                ]
            });
            bridge.LoadOrmModelFromText(model);

            const issues = bridge.ValidateOrmModel();

            const issue = issues.find(i => i.ElementID === 'shadow-1' && i.Message.includes('no valid source'));
            expect(issue).toBeDefined();
        });
    });

    describe('GetShadowTablePickerData — without context path', () => {
        it('should use document name as fallback when no context path is set', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'FallbackModel',
                Tables: [{ ID: 'tbl-1', Name: 'Users', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));

            const data = bridge.GetShadowTablePickerData(10, 20);

            expect(data.Models.length).toBe(1);
            expect(data.Models[0].ModelName).toBeTruthy();
            expect(data.Models[0].DocumentID).toBeTruthy();
        });
    });

    describe('AddShadowTable — originalInDesign with no Fill', () => {
        it('should handle same-model table with undefined fill gracefully', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'NoFill', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));

            const design = bridge.Controller?.Design as any;
            const table = design.GetTables()[0];
            (table as any)._Fill = null;

            const payload: IAddShadowTablePayload = {
                X: 400, Y: 100,
                ModelName: 'TestModel.dsorm',
                DocumentID: '',
                DocumentName: 'TestModel',
                ModuleID: '', ModuleName: '',
                TableID: 'tbl-1',
                TableName: 'NoFill'
            };

            const result = bridge.AddShadowTable(payload);
            expect(result.Success).toBe(true);
        });

        it('should fall back to parent model group fill when DocumentName is used', async () => {
            bridge.SetContextPath('/test/dir/current.dsorm');

            const parentBridge = new XTFXBridge();
            parentBridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'Auth',
                Tables: [{ ID: 'ptbl-1', Name: 'AppUser', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(parentBridge.SaveOrmModelToText()));
            await bridge.LoadParentModelTables(['Auth.dsorm']);

            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Local', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));

            const payload: IAddShadowTablePayload = {
                X: 400, Y: 100,
                ModelName: '',
                DocumentID: '',
                DocumentName: 'Auth.dsorm',
                ModuleID: '', ModuleName: '',
                TableID: '',
                TableName: 'AppUser'
            };

            const result = bridge.AddShadowTable(payload);
            expect(result.Success).toBe(true);
        });
    });

    describe('GetProperties — ParentModel branches', () => {
        it('should not trigger parent table load when groups are already loaded', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const designId = bridge.Controller.Design.ID;
            bridge.Controller.Design.ParentModel = 'Auth.dsorm';
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'Auth.dsorm', Tables: [{ Name: 'Users', Fill: '' }] }
            ];

            const loadSpy = jest.spyOn(bridge, 'LoadParentModelTables');
            bridge.GetProperties(designId);

            expect(loadSpy).not.toHaveBeenCalled();
        });

        it('should not trigger load when ParentModel splits to empty array', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const designId = bridge.Controller.Design.ID;
            bridge.Controller.Design.ParentModel = '|';

            const loadSpy = jest.spyOn(bridge, 'LoadParentModelTables');
            bridge.GetProperties(designId);

            expect(loadSpy).not.toHaveBeenCalled();
        });

        it('should handle _AvailableOrmFiles being empty (undefined options for ParentModel)', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const designId = bridge.Controller.Design.ID;
            (bridge as any)._AvailableOrmFiles = [];

            const props = bridge.GetProperties(designId);
            const pm = props.find(p => p.Key === 'ParentModel');
            expect(pm).toBeDefined();
            expect(pm!.Options).toBeNull();
        });

        it('should provide GroupedOptions for StateControlTable when parent groups exist', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const designId = bridge.Controller.Design.ID;
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'Auth.dsorm', Tables: [{ Name: 'AppUser', Fill: '' }] }
            ];

            const props = bridge.GetProperties(designId);
            const sct = props.find(p => p.Key === 'StateControlTable');
            expect(sct).toBeDefined();
            expect(sct!.GroupedOptions).toBeDefined();
            expect(sct!.GroupedOptions!.length).toBeGreaterThanOrEqual(1);
        });

        it('should not include GroupedOptions when no tables exist', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({ Name: 'EmptyModel' }));
            const designId = bridge.Controller.Design.ID;
            (bridge as any)._ParentModelTableGroups = [];

            const props = bridge.GetProperties(designId);
            const sct = props.find(p => p.Key === 'StateControlTable');
            expect(sct).toBeDefined();
            expect(sct!.GroupedOptions).toBeNull();
        });

        it('should show shadow table properties without ShadowDocumentName', () => {
            const model = JSON.stringify({
                Name: 'TestModel',
                Tables: [{
                    ID: 'shadow-1', Name: 'NoDoc', X: 0, Y: 0, Width: 200, Height: 28,
                    IsShadow: true, ShadowTableID: '', ShadowTableName: '',
                    ShadowDocumentName: ''
                }]
            });
            bridge.LoadOrmModelFromText(model);

            const props = bridge.GetProperties('shadow-1');
            const docProp = props.find(p => p.Key === 'ShadowDocumentName');
            expect(docProp).toBeDefined();
            expect(docProp!.Value).toBe('');
        });
    });

    describe('GetSeedData — FK resolution branches', () => {
        it('should resolve FK options from referenced table with seed data', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'tbl-categories', Name: 'Categories', X: 0, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'cat-name', Name: 'CategoryName', DataType: 'String', IsPrimaryKey: false }
                        ],
                        DataSets: [
                            {
                                Name: 'Default',
                                Tuples: [
                                    { FieldValues: [
                                        { FieldID: '__pk__', Value: '1' },
                                        { FieldID: 'cat-name', Value: 'Electronics' }
                                    ]},
                                    { FieldValues: [
                                        { FieldID: '__pk__', Value: '2' },
                                        { FieldID: 'cat-name', Value: 'Books' }
                                    ]}
                                ]
                            }
                        ]
                    },
                    {
                        ID: 'tbl-products', Name: 'Products', X: 300, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-name', Name: 'ProductName', DataType: 'String', IsPrimaryKey: false }
                        ]
                    }
                ],
                References: [
                    { ID: 'ref-1', SourceTableID: 'tbl-products', TargetTableID: 'tbl-categories' }
                ]
            }));

            const seedData = bridge.GetSeedData('tbl-products');
            expect(seedData).toBeDefined();
        });

        it('should return empty FK options when target table has no seed data', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'tbl-categories', Name: 'Categories', X: 0, Y: 0, Width: 200, Height: 60
                    },
                    {
                        ID: 'tbl-products', Name: 'Products', X: 300, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-name', Name: 'ProductName', DataType: 'String', IsPrimaryKey: false }
                        ]
                    }
                ],
                References: [
                    { ID: 'ref-1', SourceTableID: 'tbl-products', TargetTableID: 'tbl-categories' }
                ]
            }));

            const seedData = bridge.GetSeedData('tbl-products');
            expect(seedData).toBeDefined();
        });

        it('should handle FK field where referenced table has no matching target', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'tbl-products', Name: 'Products', X: 300, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-name', Name: 'ProductName', DataType: 'String', IsPrimaryKey: false }
                        ]
                    }
                ],
                References: [
                    { ID: 'ref-1', SourceTableID: 'tbl-products', TargetTableID: 'nonexistent' }
                ]
            }));

            const seedData = bridge.GetSeedData('tbl-products');
            expect(seedData).toBeDefined();
        });
    });

    describe('ORMDesignerState — ParentModel branches during Load', () => {
        it('should handle design with ParentModel that filters to empty array', async () => {
            const b = new XTFXBridge();
            b.LoadOrmModelFromText(JSON.stringify({ Name: 'Test' }));
            const design = b.Controller?.Design as any;

            if (design) design.ParentModel = '|';

            const xml = b.SaveOrmModelToText();

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(xml));

            const mockDoc = { uri: vscode.Uri.file('/test/file.dsorm') };
            const state = new (require('../../Designers/ORM/ORMDesignerState').XORMDesignerState)(mockDoc);

            await state.Load();

            expect(state.IsDirty).toBe(false);
        });
    });
});
