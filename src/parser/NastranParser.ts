import * as THREE from 'three';
import {
    NastranNode,
    NastranElement,
    NastranProperty,
    NastranMaterial,
    NastranLoad,
    NastranConstraint,
    NastranData
} from '../types';

export class NastranParser {
    nodes: Map<number, NastranNode> = new Map();
    elements: NastranElement[] = [];
    properties: Map<number, NastranProperty> = new Map();
    materials: Map<number, NastranMaterial> = new Map();
    loads: NastranLoad[] = [];
    constraints: NastranConstraint[] = [];
    summary: NastranData['summary'] = {
        nodes: 0,
        elements: 0,
        elemTypes: {},
        properties: 0,
        materials: 0,
        loads: 0,
        constraints: 0,
        warnings: [],
        errors: []
    };

    constructor() {
        this.clear();
    }

    clear(): void {
        this.nodes.clear();
        this.elements = [];
        this.properties.clear();
        this.materials.clear();
        this.loads = [];
        this.constraints = [];
        this.summary = {
            nodes: 0,
            elements: 0,
            elemTypes: {},
            properties: 0,
            materials: 0,
            loads: 0,
            constraints: 0,
            warnings: [],
            errors: []
        };
    }

    parse(text: string): NastranData {
        this.clear();
        console.log("NastranParser: Starting parse...");
        const lines = text.split(/\r?\n/);

        for (let line of lines) {
            // Remove comments and trim
            const commentIndex = line.indexOf('$');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex);
            }
            line = line.trimEnd();

            if (line.length === 0) continue;

            const fields = this.extractFields(line);
            if (!fields || fields.length === 0) continue;

            const cardName = fields[0].toUpperCase();

            // Geometry
            if (cardName === 'GRID') this.parseGrid(fields);
            else if (cardName === 'CQUAD4') this.parseCQuad4(fields);
            else if (cardName === 'CTRIA3') this.parseCTria3(fields);
            else if (cardName === 'CBAR') this.parseCBar(fields);
            else if (cardName === 'CHEXA') this.parseCHexa(fields);
            else if (cardName === 'CTETRA') this.parseCTetra(fields);

            // Properties
            else if (cardName === 'PSHELL') this.parsePShell(fields);
            else if (cardName === 'PROD') this.parsePRod(fields);
            else if (cardName === 'PBAR') this.parsePBar(fields);
            else if (cardName === 'PBARL') this.parsePBarL(fields);
            else if (cardName === 'PSOLID') this.parsePSolid(fields);

            // Material
            else if (cardName === 'MAT1') this.parseMat1(fields);

            // Loads & Constraints
            else if (cardName === 'FORCE') this.parseForce(fields);
            else if (cardName === 'SPC' || cardName === 'SPC1') this.parseSPC(fields);
        }

        this.updateSummary();
        console.log(`NastranParser: Parse complete. Nodes: ${this.nodes.size}, Elements: ${this.elements.length}, Loads: ${this.loads.length}`);

        return {
            nodes: this.nodes,
            elements: this.elements,
            properties: this.properties,
            materials: this.materials,
            loads: this.loads,
            constraints: this.constraints,
            summary: this.summary
        };
    }

    private updateSummary(): void {
        this.summary.nodes = this.nodes.size;
        this.summary.elements = this.elements.length;
        this.summary.properties = this.properties.size;
        this.summary.materials = this.materials.size;
        this.summary.loads = this.loads.length;
        this.summary.constraints = this.constraints.length;

        this.summary.elemTypes = {};
        const warningSet = new Set<string>();

        this.elements.forEach(el => {
            if (!el.type) return;
            this.summary.elemTypes[el.type] = (this.summary.elemTypes[el.type] || 0) + 1;

            // Validate nodes
            el.nodes.forEach(nid => {
                if (!this.nodes.has(nid)) {
                    warningSet.add(`Element ${el.id} (${el.type}) refers to missing node ${nid}`);
                }
            });
        });

        this.summary.warnings = Array.from(warningSet);

        // Basic sanity checks
        if (this.summary.nodes === 0) this.summary.warnings.push("No GRID points found.");
        if (this.summary.elements === 0) this.summary.warnings.push("No elements found.");
    }

    private extractFields(line: string): string[] {
        if (line.includes(',')) {
            // Free field
            return line.split(',').map(f => f.trim());
        } else {
            // Fixed width (Small Field) - up to 10 fields (80 chars)
            const fields: string[] = [];
            const numFields = Math.max(10, Math.ceil(line.length / 8));
            for (let i = 0; i < numFields; i++) {
                const start = i * 8;
                if (start >= line.length) {
                    fields.push("");
                    continue;
                }
                const field = line.substring(start, start + 8).trim();
                fields.push(field);
            }
            return fields;
        }
    }

    private parseNumber(val: string): number {
        if (!val || val.trim() === "") return 0;
        let s = val.trim().toUpperCase();

        // Replace D with E for standard JS parsing
        s = s.replace('D', 'E');

        // Handle shorthand scientific notation: "1.2+3" -> "1.2E+3" or "-1.2-3" -> "-1.2E-3"
        s = s.replace(/(\d)([+-])(\d)/g, '$1E$2$3');

        const num = parseFloat(s);
        if (isNaN(num)) {
            this.summary.errors.push(`Failed to parse number "${val}"`);
            console.warn(`NastranParser: Failed to parse number "${val}"`);
            return 0;
        }
        return num;
    }

    private parseGrid(fields: string[]): void {
        const id = parseInt(fields[1]);
        const x = this.parseNumber(fields[3]);
        const y = this.parseNumber(fields[4]);
        const z = this.parseNumber(fields[5]);

        if (!isNaN(id)) {
            this.nodes.set(id, { id, x, y, z });
        }
    }

    private parseCQuad4(fields: string[]): void {
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = [
            parseInt(fields[3]),
            parseInt(fields[4]),
            parseInt(fields[5]),
            parseInt(fields[6])
        ];

        this.elements.push({ type: 'CQUAD4', id, pid, nodes });
    }

    private parseCTria3(fields: string[]): void {
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = [
            parseInt(fields[3]),
            parseInt(fields[4]),
            parseInt(fields[5])
        ];

        this.elements.push({ type: 'CTRIA3', id, pid, nodes });
    }

    private parseCBar(fields: string[]): void {
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = [parseInt(fields[3]), parseInt(fields[4])];
        this.elements.push({ type: 'CBAR', id, pid, nodes });
    }

    private parseCHexa(fields: string[]): void {
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = fields.slice(3, 11).map(f => parseInt(f));
        this.elements.push({ type: 'CHEXA' as any, id, pid, nodes });
    }

    private parseCTetra(fields: string[]): void {
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = fields.slice(3, 7).map(f => parseInt(f));
        this.elements.push({ type: 'CTETRA' as any, id, pid, nodes });
    }

    private parsePShell(fields: string[]): void {
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        const t = this.parseNumber(fields[3]);
        this.properties.set(pid, { id: pid, type: 'PSHELL', mid, t });
    }

    private parsePRod(fields: string[]): void {
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        const a = this.parseNumber(fields[3]);
        this.properties.set(pid, { id: pid, type: 'PROD', mid, a });
    }

    private parsePBar(fields: string[]): void {
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        const a = this.parseNumber(fields[3]);
        this.properties.set(pid, { id: pid, type: 'PBAR', mid, a });
    }

    private parsePBarL(fields: string[]): void {
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        this.properties.set(pid, { id: pid, type: 'PBARL', mid });
    }

    private parsePSolid(fields: string[]): void {
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        this.properties.set(pid, { id: pid, type: 'PSOLID', mid });
    }

    private parseMat1(fields: string[]): void {
        const mid = parseInt(fields[1]);
        const e = this.parseNumber(fields[2]);
        const nu = this.parseNumber(fields[4]);
        const rho = this.parseNumber(fields[5]);
        this.materials.set(mid, { id: mid, e, nu, rho });
    }

    private parseForce(fields: string[]): void {
        const nodeId = parseInt(fields[2]);
        const mag = this.parseNumber(fields[4]);
        const dir = new THREE.Vector3(
            this.parseNumber(fields[5]),
            this.parseNumber(fields[6]),
            this.parseNumber(fields[7])
        );
        if (dir.lengthSq() > 0) dir.normalize();

        this.loads.push({ nodeId, magnitude: mag, direction: dir });
    }

    private parseSPC(fields: string[]): void {
        const nodeId = parseInt(fields[2]);
        const dof = fields[3];
        this.constraints.push({ nodeId, dof });
    }
}
