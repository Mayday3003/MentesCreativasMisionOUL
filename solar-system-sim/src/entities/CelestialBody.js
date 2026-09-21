import * as THREE from 'three';

export class CelestialBody {
    constructor(radius, textureUrl, distanceToParent, orbitalSpeed, rotationSpeed) {
        this.radius = radius;
        this.distanceToParent = distanceToParent;
        this.orbitalSpeed = orbitalSpeed;
        this.rotationSpeed = rotationSpeed;
        
        // El grupo contendrá la malla principal y facilitará la rotación orbital
        this.group = new THREE.Group();
        this.mesh = null;
        
        this.textureLoader = new THREE.TextureLoader();
        this.textureUrl = textureUrl;
        
        this.currentAngle = 0;
    }

    createMesh(material) {
        const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Mover la malla lejos del centro basándonos en la distancia a su padre
        this.mesh.position.x = this.distanceToParent;
        
        this.group.add(this.mesh);
    }

    update(time, parentPosition = new THREE.Vector3(0,0,0)) {
        // Rotación sobre su propio eje
        if (this.mesh) {
            this.mesh.rotation.y += this.rotationSpeed;
        }

        // Posición Orbital (Ecuaciones paramétricas circulares)
        if (this.distanceToParent > 0) {
            this.currentAngle = time * this.orbitalSpeed;
            this.mesh.position.x = Math.cos(this.currentAngle) * this.distanceToParent;
            this.mesh.position.z = Math.sin(this.currentAngle) * this.distanceToParent;
        }
    }

    getPosition() {
        if (!this.mesh) return new THREE.Vector3();
        const pos = new THREE.Vector3();
        this.mesh.getWorldPosition(pos);
        return pos;
    }
}
