import * as THREE from 'three';

export class Earth {
    constructor(radius = 3.5, orbitRadius = 65, orbitalSpeed = 0.5) {
        this.radius = radius;
        this.orbitRadius = orbitRadius;
        this.orbitalSpeed = orbitalSpeed;
        this.rotationSpeed = 0.015;

        this.container = new THREE.Group();

        // Grupo para el planeta y su atmósfera que se moverá a lo largo de la órbita
        this.earthSystem = new THREE.Group();
        this.container.add(this.earthSystem);

        const loader = new THREE.TextureLoader();
        const dayTexture = loader.load('assets/earth_daymap.jpg');
        const nightTexture = loader.load('assets/earth_nightmap.jpg');
        const normalTexture = loader.load('assets/earth_normalmap.jpg');
        const cloudTexture = loader.load('assets/earth_atmosphere.jpg');

        dayTexture.colorSpace = THREE.SRGBColorSpace;
        nightTexture.colorSpace = THREE.SRGBColorSpace;
        cloudTexture.colorSpace = THREE.SRGBColorSpace;

        // 1. Superficie de la Tierra con Shader Día/Noche Realista
        const earthGeometry = new THREE.SphereGeometry(this.radius, 64, 64);
        
        this.earthMaterial = new THREE.ShaderMaterial({
            uniforms: {
                dayTexture: { value: dayTexture },
                nightTexture: { value: nightTexture },
                sunPosition: { value: new THREE.Vector3(0, 0, 0) }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec2 vUv;
                varying vec3 vWorldPosition;

                void main() {
                    vUv = uv;
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: `
                uniform sampler2D dayTexture;
                uniform sampler2D nightTexture;
                uniform vec3 sunPosition;

                varying vec3 vNormal;
                varying vec2 vUv;
                varying vec3 vWorldPosition;

                void main() {
                    vec3 sunDir = normalize(sunPosition - vWorldPosition);
                    float NdotL = dot(vNormal, sunDir);
                    
                    // Transición suave entre día y noche (terminador)
                    float dayFactor = smoothstep(-0.15, 0.25, NdotL);
                    
                    vec4 dayCol = texture2D(dayTexture, vUv);
                    vec4 nightCol = texture2D(nightTexture, vUv) * 0.9;
                    
                    // Iluminación suave en la cara nocturna
                    vec4 finalCol = mix(nightCol, dayCol, dayFactor);
                    gl_FragColor = finalCol;
                }
            `
        });

        this.mesh = new THREE.Mesh(earthGeometry, this.earthMaterial);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Inclinación axial de la Tierra (23.44 grados)
        this.mesh.rotation.z = 23.44 * Math.PI / 180;
        this.earthSystem.add(this.mesh);

        // 2. Capa de Nubes y Atmósfera (gira a diferente velocidad)
        const cloudGeometry = new THREE.SphereGeometry(this.radius * 1.018, 48, 48);
        const cloudMaterial = new THREE.MeshStandardMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
        this.cloudMesh.rotation.z = 23.44 * Math.PI / 180;
        this.earthSystem.add(this.cloudMesh);

        // 3. Resplandor Atmosférico Azulado (Rayleigh Scattering)
        const atmosGeometry = new THREE.SphereGeometry(this.radius * 1.12, 32, 32);
        const atmosMaterial = new THREE.ShaderMaterial({
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
                    float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                    gl_FragColor = vec4(0.2, 0.55, 1.0, 1.0) * intensity * 0.7;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
        const atmosMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
        this.earthSystem.add(atmosMesh);

        // 4. Trayectoria Orbital (Línea de Órbita)
        const orbitCurve = new THREE.EllipseCurve(0, 0, this.orbitRadius, this.orbitRadius);
        const orbitPoints = orbitCurve.getPoints(128);
        const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMat = new THREE.LineBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.25
        });
        this.orbitLine = new THREE.LineLoop(orbitGeom, orbitMat);
        this.orbitLine.rotation.x = Math.PI / 2;
        this.container.add(this.orbitLine);

        // Posición inicial
        this.currentAngle = 0;
        this.updatePosition(0);
    }

    updatePosition(time) {
        this.currentAngle = time * this.orbitalSpeed;
        const x = Math.cos(this.currentAngle) * this.orbitRadius;
        const z = Math.sin(this.currentAngle) * this.orbitRadius;
        this.earthSystem.position.set(x, 0, z);
    }

    update(time) {
        this.updatePosition(time);

        // Rotación de la superficie
        if (this.mesh) {
            this.mesh.rotation.y += this.rotationSpeed;
        }

        // Rotación de las nubes (un poco más rápida)
        if (this.cloudMesh) {
            this.cloudMesh.rotation.y += this.rotationSpeed * 1.15;
        }
    }

    getPosition() {
        const pos = new THREE.Vector3();
        this.earthSystem.getWorldPosition(pos);
        return pos;
    }
}
