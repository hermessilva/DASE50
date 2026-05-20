jest.mock('vscode');

import { Parser } from '@dbml/core';
import { XImportFromDBMLCommand } from '../../../../Designers/ORM/Commands/ImportFromDBMLCommand';

describe('XImportFromDBMLCommand.SanitizeDbml', () => {
    it('strips [delete:/update:] from Ref lines', () => {
        const input = 'Ref: Order.CustomerID > Customer.ID [delete: cascade, update: cascade]';
        const out = XImportFromDBMLCommand.SanitizeDbml(input);
        expect(out).toBe('Ref: Order.CustomerID > Customer.ID');
    });

    it('strips named Ref attributes too', () => {
        const input = 'Ref FK_Order_Customer: Order.CustomerID > Customer.ID [delete: cascade]';
        const out = XImportFromDBMLCommand.SanitizeDbml(input);
        expect(out).toBe('Ref FK_Order_Customer: Order.CustomerID > Customer.ID');
    });

    it('strips delete:/update: from column-level inline refs while keeping pk/not null/ref:', () => {
        const input = [
            'Table Order {',
            '  ID int [pk, increment]',
            '  CustomerID int [not null, ref: > Customer.ID, delete: cascade, update: cascade]',
            '}'
        ].join('\n');
        const out = XImportFromDBMLCommand.SanitizeDbml(input);
        expect(out).toContain('[not null, ref: > Customer.ID]');
        expect(out).not.toMatch(/delete\s*:/i);
        expect(out).not.toMatch(/update\s*:/i);
    });

    it('leaves untouched a column block with no delete:/update:', () => {
        const input = 'ID int [pk, increment, note: "primary key"]';
        const out = XImportFromDBMLCommand.SanitizeDbml(input);
        expect(out).toBe('ID int [pk, increment, note: "primary key"]');
    });

    it('drops the bracket entirely when the only attrs were delete:/update:', () => {
        const input = 'CustomerID int [delete: cascade]';
        const out = XImportFromDBMLCommand.SanitizeDbml(input);
        expect(out).toBe('CustomerID int');
    });

    it('reproduces the user-reported error and produces parser-valid output', () => {
        const failing = [
            'Table Cliente {',
            '  ID int [pk, increment]',
            '  Nome varchar(120) [not null]',
            '}',
            'Table Contrato {',
            '  ID int [pk, increment]',
            '  ClienteID int [not null, ref: > Cliente.ID, delete: cascade, update: cascade]',
            '}'
        ].join('\n');

        expect(() => Parser.parse(failing, 'dbml')).toThrow();

        const cleaned = XImportFromDBMLCommand.SanitizeDbml(failing);
        const db: any = Parser.parse(cleaned, 'dbml');
        expect(db.schemas[0].tables.length).toBe(2);
        expect(db.schemas[0].refs.length).toBe(1);
    });

    it('handles top-level Ref + inline column ref in same file', () => {
        const input = [
            'Table A {',
            '  ID int [pk]',
            '}',
            'Table B {',
            '  ID int [pk]',
            '  AID int [ref: > A.ID, delete: cascade]',
            '}',
            'Table C {',
            '  ID int [pk]',
            '  BID int',
            '}',
            'Ref: C.BID > B.ID [delete: cascade]'
        ].join('\n');

        const cleaned = XImportFromDBMLCommand.SanitizeDbml(input);
        const db: any = Parser.parse(cleaned, 'dbml');
        expect(db.schemas[0].tables.length).toBe(3);
        expect(db.schemas[0].refs.length).toBe(2);
    });

    it('preserves case of identifiers exactly', () => {
        const input = 'Ref: Order.X > Customer.Y [delete: cascade]';
        const out = XImportFromDBMLCommand.SanitizeDbml(input);
        expect(out).toContain('Order.X');
        expect(out).toContain('Customer.Y');
    });
});
