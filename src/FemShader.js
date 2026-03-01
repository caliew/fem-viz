import * as THREE from 'three';

export const FemShader = {
    uniforms: {
        uShowStress: { value: 1.0 },
        uColor: { value: new THREE.Color(0x2563eb) },
        uHighlight: { value: 0.0 },
        uVisMode: { value: 0.0 }, // 0: Contour, 1: Shaded, 2: HiddenLine
        uLightPos: { value: new THREE.Vector3(10, 10, 10) },
        uUseVertexColor: { value: 0.0 } // 0: Use uColor, 1: Use vColor
    },
    vertexShader: `
        varying float vStress;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        
        attribute float stress;
        attribute vec3 color;
        
        void main() {
            vStress = stress;
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying float vStress;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vColor;
        
        uniform float uShowStress;
        uniform vec3 uColor;
        uniform float uHighlight;
        uniform float uVisMode;
        uniform float uUseVertexColor;
        
        vec3 colormap(float t) {
            float r = clamp(1.5 - abs(4.0 * t - 3.0), 0.0, 1.0);
            float g = clamp(1.5 - abs(4.0 * t - 2.0), 0.0, 1.0);
            float b = clamp(1.5 - abs(4.0 * t - 1.0), 0.0, 1.0);
            return vec3(r, g, b);
        }

        void main() {
            if (uVisMode > 1.5) {
                // Hidden Line Mode: Flat color matching background (#050505)
                gl_FragColor = vec4(0.0196, 0.0196, 0.0196, 1.0);
                return;
            }

            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            
            // Simple Lambertian Lighting
            vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
            float diff = max(dot(normal, lightDir), 0.0);
            float ambient = 0.4;
            float lighting = diff + ambient;

            vec3 baseColor;
            if (uVisMode > 0.5) {
                // Shaded Mode: Use PID vertex color or uniform color
                baseColor = (uUseVertexColor > 0.5) ? vColor : uColor;
            } else {
                // Contour Mode: Stress color
                baseColor = colormap(vStress);
            }

            vec3 finalColor = baseColor * lighting + vec3(uHighlight * 0.3);
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

