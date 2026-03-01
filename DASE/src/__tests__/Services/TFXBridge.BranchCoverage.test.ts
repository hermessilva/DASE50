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
                Tables: [
                    { ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 },
                    { ID: 'tbl-2', Name: 'Customers', X: 300, Y: 0, Width: 200, Height: 60 }
                ]
            }));
            const designId = bridge.Controller.Design.ID;
            (bridge as any)._ParentModelTableGroups = [
                { ModelName: 'Auth.dsorm', Tables: [{ Name: 'AppUser', Fill: '' }, { Name: 'Roles', Fill: '' }] }
            ];

            const props = bridge.GetProperties(designId);
            const sct = props.find(p => p.Key === 'StateControlTable');
            expect(sct).toBeDefined();
            expect(sct!.GroupedOptions).toBeDefined();
            expect(sct!.GroupedOptions!.length).toBeGreaterThanOrEqual(1);
        });

        it('should execute catch callback when LoadParentModelTables rejects during GetProperties', async () => {
            bridge.SetContextPath('/test/dir/model.dsorm');
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [{ ID: 'tbl-1', Name: 'Orders', X: 0, Y: 0, Width: 200, Height: 60 }]
            }));
            const designId = bridge.Controller.Design.ID;
            bridge.Controller.Design.ParentModel = 'Auth.dsorm';
            (bridge as any)._ParentModelTableGroups = [];

            (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

            bridge.GetProperties(designId);

            await new Promise(resolve => setTimeout(resolve, 50));

            expect((bridge as any)._ParentModelTableGroups).toEqual([]);
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
        it('should produce label with display field value different from PK (dispVal !== pkVal branch)', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'cat-tbl', Name: 'Category', X: 0, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'cat-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'cat-name', Name: 'CategoryName', DataType: 'String' }
                        ]
                    },
                    {
                        ID: 'prod-tbl', Name: 'Product', X: 300, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'fk-field', Name: 'CategoryID', DataType: 'Int32' }
                        ]
                    }
                ],
                References: [{ ID: 'ref1', SourceFieldID: 'fk-field', TargetTableID: 'cat-tbl' }]
            }));

            const design = bridge.Controller.Design;

            const fkField = design.GetTables().find((t: any) => t.ID === 'prod-tbl')
                ?.GetFields().find((f: any) => f.ID === 'fk-field');
            if (fkField) fkField.IsFK = true;

            const catTable = design.GetTables().find((t: any) => t.ID === 'cat-tbl')!;
            const ds = new tfx.XORMDataSet();
            ds.ID = tfx.XGuid.NewValue();
            ds.Name = 'Default';
            catTable.AppendChild(ds);

            const pkField = catTable.GetPKField();

            const tuple = new tfx.XORMDataTuple();
            tuple.ID = tfx.XGuid.NewValue();
            ds.AppendChild(tuple);

            const fvPK = new tfx.XFieldValue();
            fvPK.ID = tfx.XGuid.NewValue();
            fvPK.FieldID = pkField!.ID;
            fvPK.Value = '1';
            tuple.AppendChild(fvPK);

            const fvName = new tfx.XFieldValue();
            fvName.ID = tfx.XGuid.NewValue();
            fvName.FieldID = 'cat-name';
            fvName.Value = 'Electronics';
            tuple.AppendChild(fvName);

            const result = bridge.GetSeedData('prod-tbl');

            expect(result).not.toBeNull();
            const fkCol = result!.Columns.find(c => c.FieldID === 'fk-field');
            expect(fkCol).toBeDefined();
            expect(fkCol!.FKOptions).toBeDefined();
            expect(fkCol!.FKOptions!.length).toBe(1);
            expect(fkCol!.FKOptions![0].Label).toBe('1 \u2014 Electronics');
        });

        it('should use pkVal as label when display value matches PK value (dispVal === pkVal)', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'cat-tbl', Name: 'Category', X: 0, Y: 0, Width: 200, Height: 60,
                        Fields: [{ ID: 'cat-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                    },
                    {
                        ID: 'prod-tbl', Name: 'Product', X: 300, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'fk-field', Name: 'CategoryID', DataType: 'Int32' }
                        ]
                    }
                ],
                References: [{ ID: 'ref1', SourceFieldID: 'fk-field', TargetTableID: 'cat-tbl' }]
            }));

            const design = bridge.Controller.Design;
            const fkField = design.GetTables().find((t: any) => t.ID === 'prod-tbl')
                ?.GetFields().find((f: any) => f.ID === 'fk-field');
            if (fkField) fkField.IsFK = true;

            const catTable = design.GetTables().find((t: any) => t.ID === 'cat-tbl')!;
            const pkField = catTable.GetPKField();

            const ds = new tfx.XORMDataSet();
            ds.ID = tfx.XGuid.NewValue();
            ds.Name = 'Default';
            catTable.AppendChild(ds);

            const tuple = new tfx.XORMDataTuple();
            tuple.ID = tfx.XGuid.NewValue();
            ds.AppendChild(tuple);

            const fvPK = new tfx.XFieldValue();
            fvPK.ID = tfx.XGuid.NewValue();
            fvPK.FieldID = pkField!.ID;
            fvPK.Value = '42';
            tuple.AppendChild(fvPK);

            const result = bridge.GetSeedData('prod-tbl');

            const fkCol = result!.Columns.find(c => c.FieldID === 'fk-field');
            expect(fkCol!.FKOptions![0].Label).toBe('42');
        });

        it('should fall back to pkVal when display field value is not in tuple (dispVal ?? pkVal)', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'cat-tbl', Name: 'Category', X: 0, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'cat-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'cat-name', Name: 'CategoryName', DataType: 'String' }
                        ]
                    },
                    {
                        ID: 'prod-tbl', Name: 'Product', X: 300, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'fk-field', Name: 'CategoryID', DataType: 'Int32' }
                        ]
                    }
                ],
                References: [{ ID: 'ref1', SourceFieldID: 'fk-field', TargetTableID: 'cat-tbl' }]
            }));

            const design = bridge.Controller.Design;
            const fkField = design.GetTables().find((t: any) => t.ID === 'prod-tbl')
                ?.GetFields().find((f: any) => f.ID === 'fk-field');
            if (fkField) fkField.IsFK = true;

            const catTable = design.GetTables().find((t: any) => t.ID === 'cat-tbl')!;
            const pkField = catTable.GetPKField();

            const ds = new tfx.XORMDataSet();
            ds.ID = tfx.XGuid.NewValue();
            ds.Name = 'Default';
            catTable.AppendChild(ds);

            const tuple = new tfx.XORMDataTuple();
            tuple.ID = tfx.XGuid.NewValue();
            ds.AppendChild(tuple);

            const fvPK = new tfx.XFieldValue();
            fvPK.ID = tfx.XGuid.NewValue();
            fvPK.FieldID = pkField!.ID;
            fvPK.Value = '5';
            tuple.AppendChild(fvPK);

            const result = bridge.GetSeedData('prod-tbl');

            const fkCol = result!.Columns.find(c => c.FieldID === 'fk-field');
            expect(fkCol!.FKOptions![0].Label).toBe('5');
        });

        it('should fall back to empty string when PK value not found in tuple (pkVal ?? "")', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'cat-tbl', Name: 'Category', X: 0, Y: 0, Width: 200, Height: 60,
                        Fields: [{ ID: 'cat-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                    },
                    {
                        ID: 'prod-tbl', Name: 'Product', X: 300, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'fk-field', Name: 'CategoryID', DataType: 'Int32' }
                        ]
                    }
                ],
                References: [{ ID: 'ref1', SourceFieldID: 'fk-field', TargetTableID: 'cat-tbl' }]
            }));

            const design = bridge.Controller.Design;
            const fkField = design.GetTables().find((t: any) => t.ID === 'prod-tbl')
                ?.GetFields().find((f: any) => f.ID === 'fk-field');
            if (fkField) fkField.IsFK = true;

            const catTable = design.GetTables().find((t: any) => t.ID === 'cat-tbl')!;

            const ds = new tfx.XORMDataSet();
            ds.ID = tfx.XGuid.NewValue();
            ds.Name = 'Default';
            catTable.AppendChild(ds);

            const tuple = new tfx.XORMDataTuple();
            tuple.ID = tfx.XGuid.NewValue();
            ds.AppendChild(tuple);

            const result = bridge.GetSeedData('prod-tbl');

            const fkCol = result!.Columns.find(c => c.FieldID === 'fk-field');
            expect(fkCol!.FKOptions).toBeDefined();
            expect(fkCol!.FKOptions!.length).toBe(1);
            expect(fkCol!.FKOptions![0].Value).toBe('');
            expect(fkCol!.FKOptions![0].Label).toBe('');
        });

        it('should handle FK field with no matching reference (ref not found)', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'prod-tbl', Name: 'Product', X: 0, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'fk-field', Name: 'CategoryID', DataType: 'Int32' }
                        ]
                    }
                ]
            }));

            const fkField = bridge.Controller.Design.GetTables()
                .find((t: any) => t.ID === 'prod-tbl')
                ?.GetFields().find((f: any) => f.ID === 'fk-field');
            if (fkField) fkField.IsFK = true;

            const result = bridge.GetSeedData('prod-tbl');

            expect(result).not.toBeNull();
            const fkCol = result!.Columns.find(c => c.FieldID === 'fk-field');
            expect(fkCol!.IsForeignKey).toBe(true);
            expect(fkCol!.FKOptions).toBeUndefined();
        });

        it('should handle FK reference where target table no longer exists', () => {
            bridge.LoadOrmModelFromText(JSON.stringify({
                Name: 'TestModel',
                Tables: [
                    {
                        ID: 'cat-tbl', Name: 'Category', X: 0, Y: 0, Width: 200, Height: 60,
                        Fields: [{ ID: 'cat-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true }]
                    },
                    {
                        ID: 'prod-tbl', Name: 'Product', X: 300, Y: 0, Width: 200, Height: 60,
                        Fields: [
                            { ID: 'prod-pk', Name: 'ID', DataType: 'Int32', IsPrimaryKey: true },
                            { ID: 'fk-field', Name: 'CategoryID', DataType: 'Int32' }
                        ]
                    }
                ],
                References: [{ ID: 'ref1', SourceFieldID: 'fk-field', TargetTableID: 'cat-tbl' }]
            }));

            const design = bridge.Controller.Design;
            const fkField = design.GetTables().find((t: any) => t.ID === 'prod-tbl')
                ?.GetFields().find((f: any) => f.ID === 'fk-field');
            if (fkField) fkField.IsFK = true;

            const refs = design.GetReferences();
            if (refs.length > 0) (refs[0] as any).Target = 'nonexistent-table-id';

            const result = bridge.GetSeedData('prod-tbl');

            expect(result).not.toBeNull();
            const fkCol = result!.Columns.find(c => c.FieldID === 'fk-field');
            expect(fkCol!.IsForeignKey).toBe(true);
            expect(fkCol!.FKOptions).toBeUndefined();
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

        it('should call LoadParentModelTables when ParentModel has valid entries (line 123)', async () => {
            const b = new XTFXBridge();
            b.LoadOrmModelFromText(JSON.stringify({ Name: 'Test' }));
            const design = b.Controller?.Design as any;

            if (design) design.ParentModel = 'Auth.dsorm';

            const xml = b.SaveOrmModelToText();

            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(xml));

            const mockDoc = { uri: vscode.Uri.file('/test/file.dsorm') };
            const state = new (require('../../Designers/ORM/ORMDesignerState').XORMDesignerState)(mockDoc);

            await state.Load();

            expect(state.IsDirty).toBe(false);
        });
    });
});
