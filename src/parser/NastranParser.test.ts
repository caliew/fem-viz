import { describe, it, expect, beforeEach } from 'vitest';
import { NastranParser } from './NastranParser';

describe('NastranParser', () => {
    let parser: NastranParser;

    beforeEach(() => {
        parser = new NastranParser();
    });

    describe('extractFields', () => {
        it('should extract fields from a free field (comma separated) line', () => {
            const line = 'GRID,1,0,1.0,2.0,3.0';
            // @ts-ignore - reaching into private method for unit testing
            const fields = parser.extractFields(line);
            expect(fields).toEqual(['GRID', '1', '0', '1.0', '2.0', '3.0']);
        });

        it('should extract fields from a fixed width (small field) line', () => {
            // Each field is 8 characters
            // 123456781234567812345678123456781234567812345678
            const line = 'GRID           1               0     1.0     2.0     3.0';
            // @ts-ignore
            const fields = parser.extractFields(line);
            expect(fields[0]).toBe('GRID');
            expect(fields[1]).toBe('1');
            expect(fields[3]).toBe('0');
            expect(fields[4]).toBe('1.0');
            expect(fields[5]).toBe('2.0');
            expect(fields[6]).toBe('3.0');
        });
    });

    describe('parseNumber', () => {
        it('should parse standard numbers', () => {
            // @ts-ignore
            expect(parser.parseNumber('1.23')).toBe(1.23);
            // @ts-ignore
            expect(parser.parseNumber('-4.56')).toBe(-4.56);
        });

        it('should handle Nastran shorthand scientific notation', () => {
            // @ts-ignore
            expect(parser.parseNumber('1.2+3')).toBe(1200);
            // @ts-ignore
            expect(parser.parseNumber('1.2-3')).toBe(0.0012);
            // @ts-ignore
            expect(parser.parseNumber('1.2D+3')).toBe(1200);
            // @ts-ignore
            expect(parser.parseNumber('1.2D-3')).toBe(0.0012);
        });
    });

    describe('parse', () => {
        it('should parse a simple mesh correctly', () => {
            const bdf = `
GRID    1       0       0.0     0.0     0.0
GRID    2       0       1.0     0.0     0.0
GRID    3       0       1.0     1.0     0.0
GRID    4       0       0.0     1.0     0.0
CTRIA3  101     10      1       2       3
CQUAD4  102     10      1       2       3       4
MAT1    1       2.1+5           0.3     7.8-9
PSHELL  10      1       0.1
            `;

            const data = parser.parse(bdf);

            // Verify Summary
            expect(data.summary.nodes).toBe(4);
            expect(data.summary.elements).toBe(2);
            expect(data.summary.materials).toBe(1);
            expect(data.summary.properties).toBe(1);

            // Verify Nodes
            expect(data.nodes.get(1)).toEqual({ id: 1, x: 0, y: 0, z: 0 });
            expect(data.nodes.get(3)).toEqual({ id: 3, x: 1, y: 1, z: 0 });

            // Verify Elements
            const tri = data.elements.find(el => el.id === 101);
            expect(tri?.type).toBe('CTRIA3');
            expect(tri?.nodes).toEqual([1, 2, 3]);

            const quad = data.elements.find(el => el.id === 102);
            expect(quad?.type).toBe('CQUAD4');
            expect(quad?.nodes).toEqual([1, 2, 3, 4]);

            // Verify Material
            const mat = data.materials.get(1);
            expect(mat?.e).toBe(210000);
            expect(mat?.nu).toBe(0.3);
            expect(mat?.rho).toBe(7.8e-9);

            // Verify Property
            const prop = data.properties.get(10);
            // @ts-ignore
            expect(prop?.mid).toBe(1);
            // @ts-ignore
            expect(prop?.t).toBe(0.1);
        });

        it('should handle comments and empty lines', () => {
            const bdf = `
$ THIS IS A COMMENT
GRID    1       0       0.0     0.0     0.0

$ ANOTHER COMMENT
            `;
            const data = parser.parse(bdf);
            expect(data.summary.nodes).toBe(1);
        });

        it('should report warnings for missing nodes', () => {
            const bdf = `
CTRIA3  101     10      1       2       3
            `;
            const data = parser.parse(bdf);
            expect(data.summary.warnings.length).toBeGreaterThan(0);
            expect(data.summary.warnings[0]).toContain('missing node');
        });

        it('should parse 1D elements and properties (CBAR, PROD, PBAR, PBARL)', () => {
            const bdf = `
CBAR    201     20      1       2
PROD    20      1       0.5
PBAR    21      1       1.0
PBARL   22      1
            `;
            const data = parser.parse(bdf);

            const bar = data.elements.find(el => el.id === 201);
            expect(bar?.type).toBe('CBAR');
            expect(bar?.nodes).toEqual([1, 2]);

            expect(data.properties.get(20)?.type).toBe('PROD');
            // @ts-ignore
            expect(data.properties.get(20)?.a).toBe(0.5);
            expect(data.properties.get(21)?.type).toBe('PBAR');
            expect(data.properties.get(22)?.type).toBe('PBARL');
        });

        it('should parse 3D elements (CHEXA, CTETRA, PSOLID)', () => {
            const bdf = `
CHEXA,301,30,1,2,3,4,5,6,7,8
CTETRA,302,30,1,2,3,4
PSOLID,30,1
            `;
            const data = parser.parse(bdf);

            const hexa = data.elements.find(el => el.id === 301);
            expect(hexa?.type).toBe('CHEXA');
            expect(hexa?.nodes).toHaveLength(8);

            const tetra = data.elements.find(el => el.id === 302);
            expect(tetra?.type).toBe('CTETRA');
            expect(tetra?.nodes).toHaveLength(4);

            expect(data.properties.get(30)?.type).toBe('PSOLID');
        });

        it('should parse boundary conditions (FORCE, SPC)', () => {
            const bdf = `
FORCE   100     1       0       10.0    1.0     0.0     0.0
SPC     100     2       123456
            `;
            const data = parser.parse(bdf);

            expect(data.loads.length).toBe(1);
            expect(data.loads[0].nodeId).toBe(1);
            expect(data.loads[0].magnitude).toBe(10);
            expect(data.loads[0].direction.x).toBe(1);

            expect(data.constraints.length).toBe(1);
            expect(data.constraints[0].nodeId).toBe(2);
            expect(data.constraints[0].dof).toBe('123456');
        });

        it('should mix fixed-field and free-field lines', () => {
            const bdf = `
GRID,1,,0.0,0.0,0.0
GRID    2       0       1.0     0.0     0.0
            `;
            const data = parser.parse(bdf);
            expect(data.summary.nodes).toBe(2);
            expect(data.nodes.get(1)?.x).toBe(0);
            expect(data.nodes.get(2)?.x).toBe(1);
        });
    });
});
