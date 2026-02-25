import * as THREE from 'three';

export const FemShader = {
    uniforms: {
        uShowStress: { value: 1.0 },
        uColor: { value: new THREE.Color(0x2563eb) },
        uHighlight: { value: 0.0 }
    },
    vertexShader: `
        varying float vStress;
        attribute float stress;
        
        void main() {
            vStress = stress;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying float vStress;
        uniform float uShowStress;
        uniform vec3 uColor;
        uniform float uHighlight;
        
        // Simple Jet Color Map
        vec3 colormap(float t) {
            float r = clamp(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0);
            float g = clamp(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0);
            float b = clamp(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0);
            return vec3(r, g, b);
        }

        void main() {
            vec3 baseColor = mix(uColor, colormap(vStress), uShowStress);
            vec3 finalColor = baseColor + vec3(uHighlight * 0.3);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};
