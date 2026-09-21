import * as THREE from 'three';

export class Sun {
    constructor(radius = 12) {
        this.radius = radius;
        this.container = new THREE.Group();

        const textureLoader = new THREE.TextureLoader();
        const sunTexture = textureLoader.load('assets/sun.jpg');
        sunTexture.colorSpace = THREE.SRGBColorSpace;

        // Malla Principal del Sol con emisión brillante y textura real
        const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            map: sunTexture,
            emissive: 0xffdd66,
            emissiveMap: sunTexture,
            emissiveIntensity: 2.2,
            roughness: 0.9,
            metalness: 0.1
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.container.add(this.mesh);

        // Corona / Resplandor solar volumétrico (Capa exterior con Fresnel aditivo)
        const coronaGeometry = new THREE.SphereGeometry(this.radius * 1.15, 48, 48);
        const coronaMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
                    gl_FragColor = vec4(1.0, 0.6, 0.15, 1.0) * intensity * 1.6;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
        const coronaMesh = new THREE.Mesh(coronaGeometry, coronaMaterial);
        this.container.add(coronaMesh);

        // Halo exterior difuso
        const haloGeometry = new THREE.SphereGeometry(this.radius * 1.35, 32, 32);
        const haloMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.55 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
                    gl_FragColor = vec4(1.0, 0.35, 0.05, 0.5) * intensity;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
        const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
        this.container.add(haloMesh);

        // Fuente de Luz Solar Principal
        this.light = new THREE.PointLight(0xfff8ee, 4500, 400, 1.0);
        this.light.castShadow = true;
        this.light.shadow.mapSize.width = 2048;
        this.light.shadow.mapSize.height = 2048;
        this.light.shadow.bias = -0.001;
        this.container.add(this.light);

        this.rotationSpeed = 0.002;
    }

    update(time) {
        if (this.mesh) {
            this.mesh.rotation.y += this.rotationSpeed;
        }
    }

    getPosition() {
        const pos = new THREE.Vector3();
        this.container.getWorldPosition(pos);
        return pos;
    }
}
