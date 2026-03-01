import sys
import os

def format_field(value):
    """Formats a value into an 8-character NASTRAN field."""
    if value is None or value.strip() == "":
        return " " * 8
    
    val = value.strip()
    # If it's already a small enough string
    if len(val) <= 8:
        return val.ljust(8)
    
    # Try to convert to float and format
    try:
        fval = float(val)
        # Check if it fits in 8 chars
        s = f"{fval:8g}"
        if len(s) > 8:
            # Try scientific notation
            s = f"{fval:8.2e}"
            if len(s) > 8:
                # Last resort: trim or error
                s = s[:8]
        return s.ljust(8)
    except ValueError:
        return val[:8].ljust(8)

def convert_bdf(input_file, output_file):
    with open(input_file, 'r') as f:
        lines = f.readlines()

    output_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        
        if line.startswith('GRID*'):
            # Long format GRID entry spans 2 lines
            # Line 1: GRID*   ID      CP      X1      X2
            # Line 2: *       X3      CD      PS      SEID
            
            # Extract fields from line 1
            # Fields in long format are 16 chars wide (except the first 8)
            # 0-8: GRID* plus spacing
            # 8-24: ID
            # 24-40: CP
            # 40-56: X1 (X)
            # 56-72: X2 (Y)
            
            field_id = line[8:24].strip()
            field_cp = line[24:40].strip()
            field_x = line[40:56].strip()
            field_y = line[56:72].strip()
            
            i += 1
            if i < len(lines):
                line2 = lines[i]
                # Extract fields from line 2
                # 0-8: * plus spacing
                # 8-24: X3 (Z)
                # 24-40: CD
                # 40-56: PS
                # 56-72: SEID
                
                field_z = line2[8:24].strip()
                field_cd = line2[24:40].strip()
                field_ps = line2[40:56].strip()
                # SEID usually not needed for simple short format but we can keep if it exists
                
                # Format into short format:
                # GRID ID CP X1 X2 X3 CD PS
                # Fields are 8 characters wide
                
                new_line = "GRID".ljust(8)
                new_line += format_field(field_id)
                new_line += format_field(field_cp)
                new_line += format_field(field_x)
                new_line += format_field(field_y)
                new_line += format_field(field_z)
                new_line += format_field(field_cd)
                new_line += format_field(field_ps)
                output_lines.append(new_line.rstrip() + '\n')
            else:
                # Unexpected EOF after GRID*
                output_lines.append(line)
        else:
            output_lines.append(line)
        
        i += 1

    with open(output_file, 'w') as f:
        f.writelines(output_lines)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_bdf.py <input_file> <output_file>")
    else:
        convert_bdf(sys.argv[1], sys.argv[2])
