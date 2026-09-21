import * as THREE from 'three';

export class Starfield {
    constructor(numStars = 5000) {
        this.group = new THREE.Group();
        
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(numStars * 3);
        const colors = new Float32Array(numStars * 3);

        for(let i = 0; i < numStars * 3; i+=3) {
            // Estrellas en una esfera gigante alrededor del sistema
            const radius = 400 + Math.random() * 400;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i+1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i+2] = radius * Math.cos(phi);

            // Color ligeramente azulado/blanco
            const color = new THREE.Color();
            color.setHSL(0.6 + Math.random() * 0.1, 0.8, Math.random());
            colors[i] = color.r;
            colors[i+1] = color.g;
            colors[i+2] = color.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        this.points = new THREE.Points(geometry, material);
        this.group.add(this.points);
    }

    toggle() {
        this.points.visible = !this.points.visible;
    }
}
