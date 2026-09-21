import * as THREE from 'three';

export class Moon {
    constructor(earthEntity, radius = 0.95, orbitRadius = 10.0, orbitalSpeed = 6.5) {
        this.earth = earthEntity;
        this.radius = radius;
        this.orbitRadius = orbitRadius;
        this.orbitalSpeed = orbitalSpeed;
        this.rotationSpeed = 0.005;

        this.container = new THREE.Group();

        const loader = new THREE.TextureLoader();
        const moonTexture = loader.load('assets/moonmap.jpg');
        const moonBump = loader.load('assets/moonbump.jpg');

        moonTexture.colorSpace = THREE.SRGBColorSpace;

        // Malla Lunar con Mapa de Relieve Fotorrealista
        const geometry = new THREE.SphereGeometry(this.radius, 48, 48);
        const material = new THREE.MeshStandardMaterial({
            map: moonTexture,
            bumpMap: moonBump,
            bumpScale: 0.06,
            roughness: 0.92,
            metalness: 0.05
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.container.add(this.mesh);

        // Línea Orbital de la Luna alrededor de la Tierra
        const orbitCurve = new THREE.EllipseCurve(0, 0, this.orbitRadius, this.orbitRadius);
        const orbitPoints = orbitCurve.getPoints(64);
        const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMat = new THREE.LineBasicMaterial({
            color: 0x8888aa,
            transparent: true,
            opacity: 0.2
        });
        this.orbitLine = new THREE.LineLoop(orbitGeom, orbitMat);
        this.orbitLine.rotation.x = Math.PI / 2;
        this.container.add(this.orbitLine);

        this.currentAngle = 0;
    }

    update(time) {
        if (!this.earth) return;

        const earthPos = this.earth.getPosition();
        
        // Posicionar el anillo de órbita alrededor de la Tierra
        this.orbitLine.position.copy(earthPos);

        // Calcular posición orbital de la Luna
        this.currentAngle = time * this.orbitalSpeed;
        const x = earthPos.x + Math.cos(this.currentAngle) * this.orbitRadius;
        const z = earthPos.z + Math.sin(this.currentAngle) * this.orbitRadius;
        const y = earthPos.y; // Puede agregarse inclinación si se desea

        this.mesh.position.set(x, y, z);

        // Rotación lunar sobre su propio eje
        this.mesh.rotation.y += this.rotationSpeed;
    }

    getPosition() {
        const pos = new THREE.Vector3();
        this.mesh.getWorldPosition(pos);
        return pos;
    }
}
