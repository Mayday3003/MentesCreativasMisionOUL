import * as THREE from 'three';
import { MagnetoVertexShader, MagnetoFragmentShader } from '../shaders/MagnetoShader.js';

export class Magnetosphere {
    constructor(earthEntity) {
        this.earth = earthEntity;
        this.container = new THREE.Group();

        // 1. Geometría Parabólica de la Magnetopausa y Magnetocola (LatheGeometry)
        // Crea una silueta matemáticamente correcta: nariz curvada (Bow Shock) frente al Sol
        // y un cilindro cónico expandido (Magnetocola) extendiéndose hacia la noche.
        const profilePoints = [
            new THREE.Vector2(0.001, -5.0), // Vértice frontal (Bow Shock frente al Sol)
            new THREE.Vector2(2.5, -4.5),
            new THREE.Vector2(4.8, -3.0),
            new THREE.Vector2(6.5, -1.0),
            new THREE.Vector2(7.8, 2.0),   // Altura de la Tierra
            new THREE.Vector2(8.8, 8.0),
            new THREE.Vector2(9.8, 16.0),
            new THREE.Vector2(10.5, 26.0),
            new THREE.Vector2(11.0, 36.0)  // Extremo de la cola (desvanecido)
        ];

        const sheathGeometry = new THREE.LatheGeometry(profilePoints, 48);

        this.sheathMaterial = new THREE.ShaderMaterial({
            vertexShader: MagnetoVertexShader,
            fragmentShader: MagnetoFragmentShader,
            uniforms: {
                uTime: { value: 0.0 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.sheathMesh = new THREE.Mesh(sheathGeometry, this.sheathMaterial);
        this.container.add(this.sheathMesh);

        // 2. Líneas de Campo Magnético Dipolar 3D (Física de Van Allen)
        this.fieldLinesGroup = new THREE.Group();
        this.createMagneticFieldLines();
        this.container.add(this.fieldLinesGroup);

        this.visible = true;
    }

    createMagneticFieldLines() {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x44ddff,
            transparent: true,
            opacity: 0.38,
            blending: THREE.AdditiveBlending
        });

        const numPlanes = 8; // Líneas distribuidas radialmente alrededor del eje
        const L_shells = [4.2, 5.8, 7.5]; // Escalas radiales del dipolo

        for (let p = 0; p < numPlanes; p++) {
            const phi = (p / numPlanes) * Math.PI * 2;
            const cosPhi = Math.cos(phi);
            const sinPhi = Math.sin(phi);

            L_shells.forEach(L => {
                const points = [];
                const steps = 60;
                
                for (let i = 0; i <= steps; i++) {
                    // Ángulo colatitud theta (desde polo norte a sur)
                    const theta = (i / steps) * Math.PI;
                    if (theta === 0 || theta === Math.PI) continue;

                    // Ecuación dipolar estándar: r = L * sin^2(theta)
                    let r = L * Math.sin(theta) * Math.sin(theta);
                    
                    // Coordenadas esféricas dipolares
                    let x = r * Math.sin(theta) * cosPhi;
                    let y = r * Math.cos(theta);
                    let z = r * Math.sin(theta) * sinPhi;

                    // Deformación física provocada por el viento solar:
                    // Si z > 0 (lado noche), el campo se estira hacia la cola (+z)
                    // Si z < 0 (lado día), el campo se comprime contra el sol (-z)
                    if (z > 0) {
                        z += Math.pow(z / L, 1.8) * 3.5;
                    } else {
                        z *= 0.75;
                    }

                    points.push(new THREE.Vector3(x, y, z));
                }

                if (points.length > 2) {
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geometry, lineMaterial);
                    this.fieldLinesGroup.add(line);
                }
            });
        }
    }

    update(time) {
        if (!this.earth) return;

        // Actualizar uniforme de tiempo para la ondulación del plasma
        if (this.sheathMaterial.uniforms.uTime) {
            this.sheathMaterial.uniforms.uTime.value = time;
        }

        // Posición: Centrada de manera exacta en la Tierra
        const earthPos = this.earth.getPosition();
        this.container.position.copy(earthPos);

        // Orientación: La cola debe apuntar en sentido opuesto al Sol (0,0,0)
        // Dado que nuestra malla tiene la nariz en -Z y la cola en +Z:
        // El vector del Sol a la Tierra apunta hacia la cola (+Z).
        const tailDirection = earthPos.clone().normalize();
        const lookTarget = earthPos.clone().add(tailDirection.clone().multiplyScalar(20));
        
        this.container.lookAt(lookTarget);
    }

    toggle() {
        this.visible = !this.visible;
        this.container.visible = this.visible;
        return this.visible;
    }
}
