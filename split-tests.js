// Script to split large test files into smaller ones
const fs = require('fs');
const path = require('path');

// ============================================================
// PART 1: Split TFXBridge.test.ts
// ============================================================
const tfxBridgePath = path.join(__dirname, 'DASE/src/__tests__/Services/TFXBridge.test.ts');
const tfxBridgeContent = fs.readFileSync(tfxBridgePath, 'utf-8');
const tfxLines = tfxBridgeContent.split('\n');

// Find all top-level describe blocks (indent level = 4 spaces inside outer describe)
function findDescribeBlocks(lines) {
    const blocks = [];
    let i = 0;
    // Skip to first inner describe
    while (i < lines.length) {
        const line = lines[i];
        // Match "    describe('...'," at exactly 4 spaces indent (inner describe)
        const match = line.match(/^    describe\(['"`](.+?)['"`]/);
        if (match) {
            const name = match[1];
            const startLine = i;
            // Find the closing of this describe block by tracking braces
            let braceCount = 0;
            let foundOpen = false;
            let j = i;
            while (j < lines.length) {
                for (const ch of lines[j]) {
                    if (ch === '{') { braceCount++; foundOpen = true; }
                    if (ch === '}') braceCount--;
                }
                if (foundOpen && braceCount === 0) {
                    // Check if next line is ");", "}); // end", etc.
                    // The closing line is j, but we might have a trailing ");" on j or j+1
                    let endLine = j;
                    // Check if the next non-empty line after j starts with "    });" which is the describe closer
                    // Actually the brace tracking should handle it - when braceCount returns to 0 at j, that's the close of the describe callback
                    // But we also need the ");" that follows
                    if (j + 1 < lines.length && lines[j + 1].trim().startsWith('});')) {
                        // This is still part of the same block if it's the describe(... => { ... }); closing
                        // Actually no - the braces already closed at j. The });  on j itself should be the close.
                        // Let me reconsider...
                    }
                    blocks.push({ name, startLine, endLine: j });
                    break;
                }
                j++;
            }
            i = j + 1;
        } else {
            i++;
        }
    }
    return blocks;
}

const blocks = findDescribeBlocks(tfxLines);

console.log(`Found ${blocks.length} describe blocks in TFXBridge.test.ts:`);
blocks.forEach((b, idx) => {
    console.log(`  ${idx + 1}. "${b.name}" (lines ${b.startLine + 1}-${b.endLine + 1})`);
});

// Group blocks by target file
const groups = {
    'TFXBridge.Core.test.ts': [
        'constructor',
        'Initialize',
        'SetContextPath',
        'LoadOrmModelFromText',
        'SaveOrmModelToText',
        'SaveOrmModelToText error handling',
        'SaveOrmModelToText serialization branches',
        'LoadOrmModelFromText XML handling',
        'ApplyOperation',
        'ValidateOrmModel',
        'NormalizeFieldValues and XmlEscape (private methods)',
    ],
    'TFXBridge.Operations.test.ts': [
        'AddTable',
        'AddTable fallback',
        'AddReference',
        'AddReference FK field creation',
        'AddReference 1:1 (IsOneToOne)',
        'AddReference returns falsy result coverage (line 272)',
        'AddField fallback',
        'AlignLines',
        'DeleteElement',
        'DeleteElement fallback',
        'RenameElement',
        'RenameElement fallback',
        'MoveElement',
        'MoveElement fallback',
        'ReorderField',
    ],
    'TFXBridge.Properties.test.ts': [
        'UpdateProperty',
        'UpdateProperty fallback',
        'UpdateProperty for XORMDesign (new properties)',
        'GetProperties',
        'GetProperties for different element types',
        'GetProperties for XORMDesign (new properties)',
        'GetGroupOrder',
        'GetEffectiveTypeInfo',
        'ResolveFieldFriendlyName',
        'ResolveTableFriendlyName',
    ],
    'TFXBridge.ModelData.test.ts': [
        'GetModelData',
        'GetModelData table Fields fallback',
        'GetModelData with table having no GetChildrenOfType and no Fields (line 382)',
        'GetModelData simplifyRoutePoints coverage',
        'GetElementInfo',
    ],
    'TFXBridge.Serialization.test.ts': [
        'LoadFromJson',
        'LoadFromJson reference error handling',
        'SaveToJson',
        'SaveToJson Fields fallback',
        'SaveToJson reference using Source/Target',
        'SaveToJson with table having no GetChildrenOfType and no Fields (lines 510-512)',
    ],
    'TFXBridge.DataTypes.test.ts': [
        'GetAllDataTypes',
        'GetPKDataTypes',
        'LoadDataTypes',
        'ReloadDataTypes',
        'LoadAvailableOrmFiles',
        'LoadParentModelTables',
    ],
    'TFXBridge.SeedData.test.ts': [
        'GetSeedData',
        'SaveSeedData',
    ],
};

const HEADER = `// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

import * as vscode from 'vscode';
import { XTFXBridge } from '../../Services/TFXBridge';
import { XIssueItem } from '../../Models/IssueItem';
import { XPropertyItem, XPropertyType } from '../../Models/PropertyItem';

// Import real TFX library
import * as tfx from '@tootega/tfx';

`;

const outDir = path.join(__dirname, 'DASE/src/__tests__/Services');

let assignedBlocks = new Set();

for (const [fileName, descNames] of Object.entries(groups)) {
    const matchedBlocks = [];
    for (const name of descNames) {
        const block = blocks.find(b => b.name === name);
        if (block) {
            matchedBlocks.push(block);
            assignedBlocks.add(block.name);
        } else {
            console.warn(`WARNING: Block "${name}" not found for ${fileName}`);
        }
    }
    
    if (matchedBlocks.length === 0) {
        console.warn(`WARNING: No blocks matched for ${fileName}, skipping.`);
        continue;
    }
    
    // Sort by original line order
    matchedBlocks.sort((a, b) => a.startLine - b.startLine);
    
    // Build file content
    let content = HEADER;
    content += `describe('XTFXBridge', () => {\n`;
    content += `    let bridge: XTFXBridge;\n\n`;
    content += `    beforeEach(() => {\n`;
    content += `        jest.clearAllMocks();\n`;
    content += `        bridge = new XTFXBridge();\n`;
    content += `    });\n\n`;
    
    for (const block of matchedBlocks) {
        // Extract lines from startLine to endLine (inclusive)
        const blockLines = tfxLines.slice(block.startLine, block.endLine + 1);
        content += blockLines.join('\n') + '\n\n';
    }
    
    content += '});\n';
    
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, content, 'utf-8');
    console.log(`Created ${fileName} (${matchedBlocks.length} blocks, ${content.split('\n').length} lines)`);
}

// Check for unassigned blocks
const unassigned = blocks.filter(b => !assignedBlocks.has(b.name));
if (unassigned.length > 0) {
    console.log('\nUnassigned blocks:');
    unassigned.forEach(b => console.log(`  - "${b.name}" (lines ${b.startLine + 1}-${b.endLine + 1})`));
}

// ============================================================
// PART 2: Split ORMDesignerEditorProvider.test.ts
// ============================================================
const providerPath = path.join(__dirname, 'DASE/src/__tests__/Designers/ORM/ORMDesignerEditorProvider.test.ts');
const providerContent = fs.readFileSync(providerPath, 'utf-8');
const providerLines = providerContent.split('\n');

const providerBlocks = findDescribeBlocks(providerLines);
console.log(`\nFound ${providerBlocks.length} describe blocks in ORMDesignerEditorProvider.test.ts:`);
providerBlocks.forEach((b, idx) => {
    console.log(`  ${idx + 1}. "${b.name}" (lines ${b.startLine + 1}-${b.endLine + 1})`);
});

const PROVIDER_HEADER = `// Mock vscode API (required because vscode is not available in test environment)
jest.mock('vscode');

// Mock do SelectionService para evitar chamadas ao GetProperties
jest.mock('../../../Services/SelectionService', () => ({
    GetSelectionService: jest.fn(() => ({
        OnSelectionChanged: jest.fn((_callback) => ({ dispose: jest.fn() })),
        Clear: jest.fn(),
        Select: jest.fn(),
        ToggleSelection: jest.fn(),
        AddToSelection: jest.fn(),
        HasSelection: false,
        PrimaryID: null,
        SelectedIDs: []
    }))
}));

import * as vscode from 'vscode';
import { XORMDesignerEditorProvider } from '../../../Designers/ORM/ORMDesignerEditorProvider';
import { createMockExtensionContext, Uri, createMockWebviewPanel } from '../../__mocks__/vscode';
import { GetSelectionService } from '../../../Services/SelectionService';

`;

const providerGroups = {
    'ORMDesignerEditorProvider.Core.test.ts': [
        'ViewType',
        'Register',
        'openCustomDocument',
        'resolveCustomEditor',
        'GetActiveState',
        'GetActivePanel',
        'GetActiveUri',
        'GetWebviewContent',
        'Document lifecycle methods',
    ],
    'ORMDesignerEditorProvider.Persistence.test.ts': [
        'saveCustomDocument',
        'saveCustomDocumentAs',
        'revertCustomDocument',
        'backupCustomDocument',
        'revertCustomDocument when state not found',
    ],
    'ORMDesignerEditorProvider.Actions.test.ts': [
        'AddTableToActiveDesigner',
        'DeleteSelected',
        'RenameSelected',
        'AddFieldToSelectedTable',
        'ValidateModel',
        'AlignLinesInActiveDesigner',
        'ReloadDataTypes',
        'State changes and document notifications',
        'NotifyDocumentChanged (via OnAddTable)',
    ],
    'ORMDesignerEditorProvider.Messages.test.ts': [
        'HandleMessage',
        'SetupMessageHandling',
        'HandleMessage AlignLines',
        'HandleMessage AddField with tableID from payload',
        'OnAddField tableID from selection',
        'HandleMessage ReloadDataTypes',
    ],
};

const providerOutDir = path.join(__dirname, 'DASE/src/__tests__/Designers/ORM');

const PROVIDER_BEFOREEACH = `describe('XORMDesignerEditorProvider', () => {
    let provider: XORMDesignerEditorProvider;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset SelectionService mock to default state
        (GetSelectionService as jest.Mock).mockReturnValue({
            OnSelectionChanged: jest.fn((_callback) => ({ dispose: jest.fn() })),
            Clear: jest.fn(),
            Select: jest.fn(),
            ToggleSelection: jest.fn(),
            AddToSelection: jest.fn(),
            HasSelection: false,
            PrimaryID: null,
            SelectedIDs: []
        });
        mockContext = createMockExtensionContext() as unknown as vscode.ExtensionContext;
        provider = new XORMDesignerEditorProvider(mockContext as any);
    });

`;

let providerAssigned = new Set();

for (const [fileName, descNames] of Object.entries(providerGroups)) {
    const matchedBlocks = [];
    for (const name of descNames) {
        const block = providerBlocks.find(b => b.name === name);
        if (block) {
            matchedBlocks.push(block);
            providerAssigned.add(block.name);
        } else {
            console.warn(`WARNING: Block "${name}" not found for ${fileName}`);
        }
    }
    
    if (matchedBlocks.length === 0) {
        console.warn(`WARNING: No blocks matched for ${fileName}, skipping.`);
        continue;
    }
    
    matchedBlocks.sort((a, b) => a.startLine - b.startLine);
    
    let content = PROVIDER_HEADER;
    content += PROVIDER_BEFOREEACH;
    
    for (const block of matchedBlocks) {
        const blockLines = providerLines.slice(block.startLine, block.endLine + 1);
        content += blockLines.join('\n') + '\n\n';
    }
    
    content += '});\n';
    
    const outPath = path.join(providerOutDir, fileName);
    fs.writeFileSync(outPath, content, 'utf-8');
    console.log(`Created ${fileName} (${matchedBlocks.length} blocks, ${content.split('\n').length} lines)`);
}

const providerUnassigned = providerBlocks.filter(b => !providerAssigned.has(b.name));
if (providerUnassigned.length > 0) {
    console.log('\nUnassigned provider blocks:');
    providerUnassigned.forEach(b => console.log(`  - "${b.name}" (lines ${b.startLine + 1}-${b.endLine + 1})`));
}

console.log('\nDone!');
