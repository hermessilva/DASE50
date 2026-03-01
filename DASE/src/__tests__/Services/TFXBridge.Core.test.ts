// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as vscode from 'vscode';
import { XTFXBridge } from '../../Services/TFXBridge';
import { XIssueItem } from '../../Models/IssueItem';
import { XPropertyItem, XPropertyType } from '../../Models/PropertyItem';

// Import real TFX library
import * as tfx from '@tootega/tfx';

describe('XTFXBridge', () => {
    let bridge: XTFXBridge;

    beforeEach(() => {
        jest.clearAllMocks();
        bridge = new XTFXBridge();
    });

    describe('constructor', () => {
        it('should create uninitialized bridge', () => {
            expect(bridge.Controller).toBeNull();
            expect(bridge.Document).toBeUndefined();
        });
    });

    describe('Initialize', () => {
        it('should initialize TFX components', async () => {
            await bridge.Initialize();

            expect(bridge.Controller).toBeDefined();
        });

        it('should not reinitialize if already initialized', async () => {
            await bridge.Initialize();
            const controller1 = bridge.Controller;

            await bridge.Initialize();
            const controller2 = bridge.Controller;

            expect(controller1).toBe(controller2);
        });
    });

    describe('LoadOrmModelFromText', () => {
        it('should load empty model from empty string', async () => {
            const doc = await bridge.LoadOrmModelFromText('');

            expect(doc).toBeDefined();
            expect(doc.Name).toBe('ORM Model');
        });

        it('should load empty model from empty JSON', async () => {
            const doc = await bridge.LoadOrmModelFromText('{}');

            expect(doc).toBeDefined();
        });

        it('should handle invalid JSON gracefully', async () => {
            const doc = await bridge.LoadOrmModelFromText('invalid json');

            expect(doc).toBeDefined();
            expect(doc.Name).toBe('ORM Model');
        });

        it('should load model with tables', async () => {
            const jsonData = JSON.stringify({
                Name: 'Test Model',
                Tables: [
                    {
                        ID: 'table-1',
                        Name: 'Users',
                        X: 100,
                        Y: 200,
                        Width: 200,
                        Height: 150,
                        Fields: [
                            { ID: 'field-1', Name: 'ID', DataType: 'Integer', IsPrimaryKey: true }
                        ]
                    }
                ]
            });

            const doc = await bridge.LoadOrmModelFromText(jsonData);

            expect(doc).toBeDefined();
        });
    });

    describe('SaveOrmModelToText', () => {
        it('should return empty XML when no document', () => {
            const text = bridge.SaveOrmModelToText();

            expect(text).toContain('<?xml');
            expect(text).toContain('XORMDocument');
        });

        it('should save model to XML after loading', async () => {
            await bridge.LoadOrmModelFromText('{}');
            const text = bridge.SaveOrmModelToText();

            expect(text).toContain('<?xml');
        });
    });

    describe('ValidateOrmModel', () => {
        it('should return empty array when Document is null', async () => {
            await bridge.Initialize();
            
            // Set Document to null
            bridge.Controller.Document = null;
            
            const issues = await bridge.ValidateOrmModel();

            expect(issues).toEqual([]);
        });

        it('should return array of issues', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            bridge['_Validator'] = {
                Validate: jest.fn().mockReturnValue([])
            } as any;
            
            const issues = await bridge.ValidateOrmModel();

            expect(Array.isArray(issues)).toBe(true);
        });

        it('should convert TFX issues to XIssueItem', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            bridge['_Validator'] = {
                Validate: jest.fn().mockReturnValue([
                    {
                        ElementID: 'elem-1',
                        ElementName: 'Table1',
                        Severity: 2, // Error
                        Message: 'Test error',
                        PropertyID: 'prop-1'
                    }
                ])
            } as any;
            
            const issues = await bridge.ValidateOrmModel();

            expect(issues.length).toBe(1);
            expect(issues[0].ElementID).toBe('elem-1');
            expect(issues[0].Message).toBe('Test error');
        });

        it('should convert warning severity', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            bridge['_Validator'] = {
                Validate: jest.fn().mockReturnValue([
                    {
                        ElementID: 'elem-1',
                        ElementName: 'Table1',
                        Severity: 1, // Warning (not Error)
                        Message: 'Test warning',
                        PropertyID: 'prop-1'
                    }
                ])
            } as any;
            
            const issues = await bridge.ValidateOrmModel();

            expect(issues.length).toBe(1);
            expect(issues[0].Severity).toBe(1); // Warning
        });
    });

    describe('SaveOrmModelToText error handling', () => {
        it('should return empty XML when Document is null', () => {
            (bridge as any)._Controller = { Document: null };
            
            const result = bridge.SaveOrmModelToText();
            
            expect(result).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />');
        });

        it('should return empty XML on error', async () => {
            await bridge.LoadOrmModelFromText('{}');
            // Force SaveToXml to throw by setting Engine to null
            (bridge as any)._Engine = { SaveToXml: () => { throw new Error('Test error'); } };

            const result = bridge.SaveOrmModelToText();
            
            expect(result).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />');
        });
    });

    describe('ApplyOperation', () => {
        it('should apply operation through controller', async () => {
            await bridge.LoadOrmModelFromText('{}');
            const mockApplyOperation = jest.fn().mockReturnValue({ Success: true });
            bridge.Controller.ApplyOperation = mockApplyOperation;

            const result = bridge.ApplyOperation({ type: 'test' });

            expect(mockApplyOperation).toHaveBeenCalledWith({ type: 'test' });
        });

        it('should return undefined when controller is null', () => {
            const result = bridge.ApplyOperation({ type: 'test' });

            expect(result).toBeUndefined();
        });
    });

    describe('LoadOrmModelFromText XML handling', () => {
        it('should load XML format when text starts with <?xml', async () => {
            const xmlText = '<?xml version="1.0"?><XORMDocument><Name>Test</Name></XORMDocument>';
            
            // Mock the Engine.Deserialize to return success with data
            const mockDoc = {
                ID: 'mock-id',
                Name: 'Test Doc',
                ChildNodes: [],
                Design: { ChildNodes: [] },
                Initialize: jest.fn()
            };
            
            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            expect(mockDoc.Initialize).toHaveBeenCalled();
            expect(doc).toBe(mockDoc);
        });

                it('should recover invalid reference points from XML and avoid routing', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-1" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=887;Y=394}|{X=779.5;Y=394}|{X=779.5;Y=170}|{X=672;Y=170}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const pointsArray = [{ X: 887, Y: 394 }, { X: Number.NaN, Y: 394 }];
                        const ref = { ID: 'ref-1', Points: pointsArray };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(mockDoc.Initialize).toHaveBeenCalled();
                        expect(Array.isArray(ref.Points)).toBe(true);
                        expect(ref.Points).toHaveLength(4);
                        expect(ref.Points[1].X).toBe(779.5);
                        expect(ref.Points[3].X).toBe(672);
                        expect(routeAllLines).not.toHaveBeenCalled();
                });

                it('should route lines when reference points are missing and not recoverable', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-2" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">not-a-point-list</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const ref: any = { ID: 'ref-2', Points: [] };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(routeAllLines).toHaveBeenCalledTimes(1);
                });

                it('should not override valid reference points', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-3" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=1;Y=2}|{X=3;Y=4}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const pointsArray = [{ X: 1, Y: 2 }, { X: 3, Y: 4 }];
                        const ref: any = { ID: 'ref-3', Points: pointsArray };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(ref.Points).toBe(pointsArray);
                        expect(routeAllLines).not.toHaveBeenCalled();
                });

                it('should ignore references without Points XData in XML', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-4" Name="FK_Test">
            <XValues>
                <XData Name="ID" Type="String">ref-4</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([]),
                                        RouteAllLines: jest.fn(),
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        const doc = await bridge.LoadOrmModelFromText(xmlText);
                        expect(doc).toBe(mockDoc);
                });

                it('should ignore empty Points and non-finite point coordinates in XML', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-5" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">   </XData>
            </XValues>
        </XORMReference>
        <XORMReference ID="ref-6" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=abc;Y=1}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([]),
                                        RouteAllLines: jest.fn(),
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        const doc = await bridge.LoadOrmModelFromText(xmlText);
                        expect(doc).toBe(mockDoc);
                });

                it('should skip fallback when reference ID is not found in XML points map', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-7" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=1;Y=2}|{X=3;Y=4}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const ref: any = { ID: 'ref-other', Points: [] };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(routeAllLines).toHaveBeenCalledTimes(1);
                });

                it('should handle an empty <XData Name="Points"></XData> in XML', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-8" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]"></XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([]),
                                        RouteAllLines: jest.fn(),
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        const doc = await bridge.LoadOrmModelFromText(xmlText);
                        expect(doc).toBe(mockDoc);
                });

                it('should treat non-array reference Points as invalid and replace from XML', async () => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<XORMDocument>
    <XORMDesign>
        <XORMReference ID="ref-9" Name="FK_Test">
            <XValues>
                <XData Name="Points" Type="Point[]">{X=10;Y=20}|{X=30;Y=40}</XData>
            </XValues>
        </XORMReference>
    </XORMDesign>
</XORMDocument>`;

                        const routeAllLines = jest.fn();
                        const ref: any = { ID: 'ref-9', Points: null };

                        const mockDoc: any = {
                                ID: 'mock-id',
                                Name: 'Test Doc',
                                ChildNodes: [],
                                Initialize: jest.fn(),
                                Design: {
                                        ChildNodes: [],
                                        GetReferences: jest.fn().mockReturnValue([ref]),
                                        RouteAllLines: routeAllLines,
                                },
                        };

                        bridge.Initialize();
                        (bridge as any)._Engine = {
                                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' }),
                        };

                        await bridge.LoadOrmModelFromText(xmlText);

                        expect(Array.isArray(ref.Points)).toBe(true);
                        expect(ref.Points).toHaveLength(2);
                        expect(ref.Points[0].X).toBe(10);
                        expect(ref.Points[1].Y).toBe(40);
                        expect(routeAllLines).not.toHaveBeenCalled();
                });

        it('should load XML format when text starts with <', async () => {
            const xmlText = '<XORMDocument><Name>Test</Name></XORMDocument>';
            
            const mockDoc = {
                ID: 'mock-id',
                Name: 'Test Doc',
                ChildNodes: [],
                Design: { ChildNodes: [] },
                Initialize: jest.fn()
            };
            
            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            expect(mockDoc.Initialize).toHaveBeenCalled();
        });

        it('should fallback to new doc when XML deserialization fails', async () => {
            const xmlText = '<?xml version="1.0"?><XORMDocument></XORMDocument>';
            
            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: false, Data: null }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            expect(doc).toBeDefined();
            expect(doc.Name).toBe('ORM Model');
        });

        it('should fallback to new doc when XML deserialization returns null data', async () => {
            const xmlText = '<?xml version="1.0"?><XORMDocument></XORMDocument>';
            
            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: null }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            expect(doc).toBeDefined();
            expect(doc.Name).toBe('ORM Model');
        });

        it('should normalize C# format XML with XORMDesigner root (with XML declaration)', async () => {
            const xmlText = '<?xml version="1.0" encoding="utf-8"?><XORMDesigner ID="design-id" Name="TestModel"></XORMDesigner>';

            const mockDoc: any = {
                ID: 'mock-id',
                Name: 'ORM Model',
                ChildNodes: [],
                Initialize: jest.fn(),
                Design: { ChildNodes: [], GetReferences: jest.fn().mockReturnValue([]) }
            };

            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            const deserializeSpy = (bridge as any)._Engine.Deserialize;
            expect(deserializeSpy).toHaveBeenCalledWith(expect.stringContaining('<XORMDocument'));
            expect(deserializeSpy).toHaveBeenCalledWith(expect.stringContaining('<XORMDesigner'));
            expect(mockDoc.Initialize).toHaveBeenCalled();
            expect(doc).toBe(mockDoc);
        });

        it('should normalize C# format XML with XORMDesigner root (without XML declaration)', async () => {
            const xmlText = '<XORMDesigner ID="design-id" Name="TestModel"></XORMDesigner>';

            const mockDoc: any = {
                ID: 'mock-id',
                Name: 'ORM Model',
                ChildNodes: [],
                Initialize: jest.fn(),
                Design: { ChildNodes: [], GetReferences: jest.fn().mockReturnValue([]) }
            };

            bridge.Initialize();
            (bridge as any)._Engine = {
                Deserialize: jest.fn().mockReturnValue({ Success: true, Data: mockDoc }),
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const doc = await bridge.LoadOrmModelFromText(xmlText);

            const deserializeSpy = (bridge as any)._Engine.Deserialize;
            expect(deserializeSpy).toHaveBeenCalledWith(expect.stringContaining('<XORMDocument'));
            expect(deserializeSpy).toHaveBeenCalledWith(expect.stringContaining('<XORMDesigner'));
            expect(mockDoc.Initialize).toHaveBeenCalled();
            expect(doc).toBe(mockDoc);
        });
    });

    describe('SaveOrmModelToText serialization branches', () => {
        it('should return XML when serialization succeeds with XmlOutput', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            (bridge as any)._Engine = {
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '<TestXml/>' })
            };

            const result = bridge.SaveOrmModelToText();

            expect(result).toBe('<TestXml/>');
        });

        it('should return empty XML when serialization succeeds but XmlOutput is empty', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            (bridge as any)._Engine = {
                Serialize: jest.fn().mockReturnValue({ Success: true, XmlOutput: '' })
            };

            const result = bridge.SaveOrmModelToText();

            expect(result).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />');
        });

        it('should return empty XML when serialization returns Success: false', async () => {
            await bridge.LoadOrmModelFromText('{}');
            
            (bridge as any)._Engine = {
                Serialize: jest.fn().mockReturnValue({ Success: false, XmlOutput: '<SomeXml/>' })
            };

            const result = bridge.SaveOrmModelToText();

            expect(result).toBe('<?xml version="1.0" encoding="utf-8"?>\n<XORMDocument />');
        });
    });

    describe('SetContextPath', () => {
        it('should set context path', () => {
            bridge.SetContextPath('/path/to/file.dsorm');
            expect(bridge.ContextPath).toBe('/path/to/file.dsorm');
        });

        it('should reset types loaded when path changes', () => {
            bridge.SetContextPath('/path/to/file1.dsorm');
            bridge.SetContextPath('/path/to/file2.dsorm');
            expect(bridge.ContextPath).toBe('/path/to/file2.dsorm');
        });

        it('should not reset types loaded when path is same', () => {
            bridge.SetContextPath('/path/to/file.dsorm');
            bridge.SetContextPath('/path/to/file.dsorm');
            expect(bridge.ContextPath).toBe('/path/to/file.dsorm');
        });
    });

    describe('NormalizeFieldValues and XmlEscape (private methods)', () => {
        it('should escape & < > " characters in XmlEscape', () => {
            const result = (bridge as any).XmlEscape('a & b < c > d "e"');

            expect(result).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;');
        });

        it('should leave plain text unchanged in XmlEscape', () => {
            expect((bridge as any).XmlEscape('hello world')).toBe('hello world');
        });

        it('should leave XFieldValue as-is when it has no ID attribute', () => {
            const input = '<XFieldValue SomeProp="value">content</XFieldValue>';
            const result = (bridge as any).NormalizeFieldValues(input);

            expect(result).toBe(input);
        });

        it('should convert self-closing XFieldValue with ID and FieldID into expanded form', () => {
            const input = '<XFieldValue ID="elem-1" FieldID="field-1" />';
            const result = (bridge as any).NormalizeFieldValues(input) as string;

            expect(result).toContain('<XFieldValue ID="elem-1">');
            expect(result).toContain('field-1');
            expect(result).not.toContain('/>');
        });

        it('should convert open/close XFieldValue and include value in output', () => {
            const input = '<XFieldValue ID="elem-2" FieldID="field-2">myValue</XFieldValue>';
            const result = (bridge as any).NormalizeFieldValues(input) as string;

            expect(result).toContain('<XFieldValue ID="elem-2">');
            expect(result).toContain('field-2');
            expect(result).toContain('myValue');
        });

        it('should use EmptyGuid as FieldID when FieldID attribute is absent', () => {
            const input = '<XFieldValue ID="elem-3">content</XFieldValue>';
            const result = (bridge as any).NormalizeFieldValues(input) as string;

            expect(result).toContain('elem-3');
            expect(result).toContain('00000000-0000-0000-0000-000000000000');
        });
    });

});
