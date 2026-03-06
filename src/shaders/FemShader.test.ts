import { describe, it, expect } from 'vitest';
import { FemShader } from './FemShader';
import * as THREE from 'three';

describe('FemShader', () => {
    it('should have the correct default uniforms', () => {
        const uniforms = FemShader.uniforms;

        expect(uniforms.uShowStress.value).toBe(1.0);
        expect(uniforms.uColor.value).toBeInstanceOf(THREE.Color);
        expect(uniforms.uColor.value.getHex()).toBe(0x2563eb);
        expect(uniforms.uHighlight.value).toBe(0.0);
        expect(uniforms.uVisMode.value).toBe(0.0);
        expect(uniforms.uLightPos.value).toBeInstanceOf(THREE.Vector3);
        expect(uniforms.uUseVertexColor.value).toBe(0.0);
    });

    it('should have valid vertex shader string', () => {
        expect(typeof FemShader.vertexShader).toBe('string');
        expect(FemShader.vertexShader).toContain('attribute float stress');
        expect(FemShader.vertexShader).toContain('varying float vStress');
        expect(FemShader.vertexShader).toContain('void main()');
    });

    it('should have valid fragment shader string', () => {
        expect(typeof FemShader.fragmentShader).toBe('string');
        expect(FemShader.fragmentShader).toContain('uniform float uVisMode');
        expect(FemShader.fragmentShader).toContain('varying float vStress');
        expect(FemShader.fragmentShader).toContain('vec3 colormap(float t)');
        expect(FemShader.fragmentShader).toContain('gl_FragColor');
    });

    it('should include the colormap function in fragment shader', () => {
        expect(FemShader.fragmentShader).toMatch(/vec3 colormap\(float t\)\s*\{/);
    });

    it('should handle different visualization modes in fragment shader logic', () => {
        // Mode 3: Free Edge (uVisMode > 2.5)
        expect(FemShader.fragmentShader).toContain('uVisMode > 2.5');
        // Mode 2: Hidden (uVisMode > 1.5)
        expect(FemShader.fragmentShader).toContain('uVisMode > 1.5');
        // Mode 1: Shaded (uVisMode > 0.5)
        expect(FemShader.fragmentShader).toContain('uVisMode > 0.5');
    });
});
