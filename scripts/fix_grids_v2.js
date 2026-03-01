// node scripts/fix_grids_v2.js original_grids.bdf R5610_GLBMDL.bdf
const fs = require('fs');
const path = require('path');

/**
 * Formats a number to fit into a NASTRAN 8-character field.
 * Handles scientific notation and precision limitations.
 */
function formatField(val) {
    if (val === undefined || val === null || val.trim() === "") return " ".repeat(8);
    let s = val.trim();

    // Normalize shorthand scientific: 7.-15 -> 7E-15, .5-3 -> .5E-3
    s = s.replace(/(\d)\.?([+-]\d+)/, (m, p1, p2) => {
        if (!s.toUpperCase().includes('E')) return p1 + 'E' + p2;
        return m;
    });

    let num = parseFloat(s);
    if (isNaN(num)) return s.substring(0, 8).padEnd(8);

    // If it fits as-is
    let raw = num.toString();
    if (raw.length <= 8 && !raw.includes('e')) return raw.padEnd(8);

    // Try fixed precision for decimals
    let fixed = num.toFixed(6).replace(/\.?0+$/, "");
    if (fixed.length <= 8) return fixed.padEnd(8);

    // Try precision
    let prec = num.toPrecision(6);
    if (prec.length <= 8) return prec.padEnd(8);

    // Scientific notation (Nastran style: 1.23-4 instead of 1.23E-04 if needed)
    let expo = num.toExponential(2).replace('e', '');
    if (expo.length <= 8) return expo.padEnd(8);

    return s.substring(0, 8).padEnd(8);
}

function processBdf(inputPath, outputPath) {
    console.log(`Reading ${inputPath}...`);
    const content = fs.readFileSync(inputPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const newLines = [];

    let i = 0;
    while (i < lines.length) {
        let line = lines[i];

        if (line.startsWith('GRID*')) {
            // 16-char fields start at index 8
            const id = line.substring(8, 24).trim();
            const cp = line.substring(24, 40).trim();
            const x = line.substring(40, 56).trim();
            const y = line.substring(56, 72).trim();

            i++;
            let nextLine = lines[i];
            if (nextLine && nextLine.startsWith('*')) {
                const z = nextLine.substring(8, 24).trim();
                const cd = nextLine.substring(24, 40).trim();
                const ps = nextLine.substring(40, 56).trim();

                // Assemble short format GRID
                // Field 1: GRID (8)
                // Field 2: ID (8)
                // Field 3: CP (8)
                // Field 4: X  (8)
                // Field 5: Y  (8)
                // Field 6: Z  (8)
                // Field 7: CD (8)
                // Field 8: PS (8)
                let short = "GRID".padEnd(8);
                short += id.padEnd(8);
                short += (cp || "0").padEnd(8);
                short += formatField(x);
                short += formatField(y);
                short += formatField(z);
                short += (cd || "0").padEnd(8);
                short += (ps || "0").padEnd(8);

                newLines.push(short);
            } else {
                newLines.push(line);
                if (nextLine) i--; // Re-process next line
            }
        } else {
            newLines.push(line);
        }
        i++;
    }

    fs.writeFileSync(outputPath, newLines.join('\n'));
    console.log(`Writing ${outputPath}... Done.`);
}

// Run if called directly
const args = process.argv.slice(2);
const source = args[0] || 'R5610_GLBMDL.bdf';
const target = args[1] || 'R5610_GLBMDL_FIXED.bdf';

processBdf(source, target);
