import * as THREE from 'three';

export class NastranParser {
    constructor() {
        this.nodes = new Map();      // ID -> {x, y, z}
        this.elements = [];          // Array of {type, id, pid, nodes: []}
        this.properties = new Map(); // PID -> {type, mid, ...}
        this.materials = new Map();  // MID -> {e, nu, rho}
        this.loads = [];             // Array of {nodeId, magnitude, direction}
        this.constraints = [];       // Array of {nodeId, dof}
        this.clear();
    }

    clear() {
        this.nodes.clear();
        this.elements = [];
        this.properties.clear();
        this.materials.clear();
        this.loads = [];
        this.constraints = [];
    }

    parse(text) {
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
            else if (cardName === 'PSOLID') this.parsePSolid(fields);

            // Material
            else if (cardName === 'MAT1') this.parseMat1(fields);

            // Loads & Constraints
            else if (cardName === 'FORCE') this.parseForce(fields);
            else if (cardName === 'SPC' || cardName === 'SPC1') this.parseSPC(fields);
        }

        console.log(`NastranParser: Parse complete. Nodes: ${this.nodes.size}, Elements: ${this.elements.length}, Loads: ${this.loads.length}`);

        return {
            nodes: this.nodes,
            elements: this.elements,
            properties: this.properties,
            materials: this.materials,
            loads: this.loads,
            constraints: this.constraints
        };
    }

    /**
     * Nastran has two main field formats:
     * 1. Fixed width (Small Field): 8 characters per field
     * 2. Free field: comma-separated
     */
    extractFields(line) {
        if (line.includes(',')) {
            // Free field
            return line.split(',').map(f => f.trim());
        } else {
            // Fixed width (Small Field) - up to 10 fields (80 chars)
            const fields = [];
            // Basic support for 80-char small field lines
            for (let i = 0; i < 10; i++) {
                const start = i * 8;
                if (start >= line.length) {
                    fields.push(""); // Add empty fields to reach expected count
                    continue;
                }
                const field = line.substring(start, start + 8).trim();
                fields.push(field);
            }
            return fields;
        }
    }

    /**
     * Handles Nastran specific number formats like:
     * - "2.1+11" (Scientific without E)
     * - "1.5D-4" (Double precision D instead of E)
     */
    parseNumber(val) {
        if (!val || val.trim() === "") return 0;
        let s = val.trim().toUpperCase();

        // Replace D with E for standard JS parsing
        s = s.replace('D', 'E');

        // Handle shorthand scientific notation: "1.2+3" -> "1.2E+3" or "-1.2-3" -> "-1.2E-3"
        // We look for a sign (+ or -) that is preceded by a digit and not by 'E'
        s = s.replace(/(\d)([+-])(\d)/g, '$1E$2$3');

        const num = parseFloat(s);
        if (isNaN(num)) {
            console.warn(`NastranParser: Failed to parse number "${val}"`);
            return 0;
        }
        return num;
    }

    parseGrid(fields) {
        // GRID ID CP X1 X2 X3 CD PS SEID
        // Fields: [GRID, ID, CP, X1, X2, X3, ...]
        const id = parseInt(fields[1]);
        const x = this.parseNumber(fields[3]);
        const y = this.parseNumber(fields[4]);
        const z = this.parseNumber(fields[5]);

        if (!isNaN(id)) {
            this.nodes.set(id, { x, y, z });
        }
    }

    parseCQuad4(fields) {
        // CQUAD4 EID PID G1 G2 G3 G4
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

    parseCTria3(fields) {
        // CTRIA3 EID PID G1 G2 G3
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = [
            parseInt(fields[3]),
            parseInt(fields[4]),
            parseInt(fields[5])
        ];

        this.elements.push({ type: 'CTRIA3', id, pid, nodes });
    }

    parseCBar(fields) {
        // CBAR EID PID G1 G2
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = [parseInt(fields[3]), parseInt(fields[4])];
        this.elements.push({ type: 'CBAR', id, pid, nodes });
    }

    parseCHexa(fields) {
        // CHEXA EID PID G1 G2 G3 G4 G5 G6 G7 G8
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = fields.slice(3, 11).map(f => parseInt(f));
        this.elements.push({ type: 'CHEXA', id, pid, nodes });
    }

    parseCTetra(fields) {
        // CTETRA EID PID G1 G2 G3 G4
        const id = parseInt(fields[1]);
        const pid = parseInt(fields[2]);
        const nodes = fields.slice(3, 7).map(f => parseInt(f));
        this.elements.push({ type: 'CTETRA', id, pid, nodes });
    }

    parsePShell(fields) {
        // PSHELL PID MID1 T
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        const t = this.parseNumber(fields[3]);
        this.properties.set(pid, { type: 'PSHELL', mid, t });
    }

    parsePRod(fields) {
        // PROD PID MID A
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        const a = this.parseNumber(fields[3]);
        this.properties.set(pid, { type: 'PROD', mid, a });
    }

    parsePBar(fields) {
        // PBAR PID MID A I1 I2 J
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        const a = this.parseNumber(fields[3]);
        this.properties.set(pid, { type: 'PBAR', mid, a });
    }

    parsePSolid(fields) {
        // PSOLID PID MID
        const pid = parseInt(fields[1]);
        const mid = parseInt(fields[2]);
        this.properties.set(pid, { type: 'PSOLID', mid });
    }

    parseMat1(fields) {
        // MAT1 MID E G NU RHO
        const mid = parseInt(fields[1]);
        const e = this.parseNumber(fields[2]);
        const nu = this.parseNumber(fields[4]);
        const rho = this.parseNumber(fields[5]);
        this.materials.set(mid, { e, nu, rho });
    }

    parseForce(fields) {
        // FORCE SID G CID F N1 N2 N3
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

    parseSPC(fields) {
        // SPC SID G C D
        const nodeId = parseInt(fields[2]);
        const dof = fields[3]; // e.g. "123"
        this.constraints.push({ nodeId, dof });
    }
}
