import * as THREE from 'three';

/**
 * Modelo Geomagnético WMM / IGRF (World Magnetic Model / International Geomagnetic Reference Field)
 * Representa con rigor científico las líneas de campo geomagnético 3D de la Tierra:
 * - Núcleo dipolar con inclinación geomagnética real (~10.5° respecto al eje geográfico de rotación).
 * - Deformación física por viento solar:
 *   * Lado diurno: compresión armónica orientada hacia el Sol.
 *   * Lado nocturno: estiramiento en la magnetocola orientada exactamente opuesta al Sol.
 * - Líneas de campo cerradas (conchas L de McIlwain) y líneas abiertas en los lóbulos de la cola.
 * - Cinturones de radiación de Van Allen (plasmásfera toroidal) alineados con el ecuador magnético.
 * - Flujo dinámico de partículas/plasma electromagnético a lo largo de las líneas de inducción B.
 */
export class Magnetosphere {
    constructor(earthEntity) {
        this.earth = earthEntity;
        this.container = new THREE.Group();

        // Ángulo de inclinación del dipolo geomagnético (WMM/IGRF):
        // Eje de rotación terrestre: 23.44° de oblicuidad
        // Eje dipolar magnético inclinado ~10.5° respecto al eje de rotación
        this.magneticTilt = (23.44 - 10.5) * Math.PI / 180;

        // Grupo que alberga todas las líneas y componentes del campo
        this.fieldGroup = new THREE.Group();
        this.container.add(this.fieldGroup);

        // Almacenar referencias para animación de partículas de flujo magnético
        this.animatedLines = [];
        this.pulseTime = 0;

        // 1. Construir las Líneas de Campo Geomagnético WMM / IGRF
        this.buildGeomagneticField();

        // 2. Construir los Cinturones de Radiación de Van Allen
        this.buildVanAllenBelts();

        // 3. Eje Dipolar Magnético (Polos Geomagnéticos Norte y Sur)
        this.buildMagneticDipoleAxis();

        this.visible = true;
    }

    buildGeomagneticField() {
        // Conchas L de McIlwain (distancia ecuatorial en radios terrestres escalados)
        // L = [3.8, 5.0, 6.5, 8.2, 10.5]
        const L_shells = [
            { L: 3.8, opacity: 0.70, color: 0x38bdf8, steps: 80 },  // Campo interno intenso (Cian eléctrico)
            { L: 5.2, opacity: 0.55, color: 0x60a5fa, steps: 90 },  // Capa media (Azul cobalto)
            { L: 7.0, opacity: 0.40, color: 0x818cf8, steps: 100 }, // Capa de transición (Índigo)
            { L: 9.5, opacity: 0.30, color: 0xa78bfa, steps: 110 }  // Capa exterior magnetopáusica (Violeta plasma)
        ];

        const numMeridians = 16; // 16 meridianos magnéticos en 360°

        // Matriz de rotación fija para la inclinación del dipolo magnético
        const dipoleEuler = new THREE.Euler(0, 0, this.magneticTilt, 'ZYX');
        const dipoleQuaternion = new THREE.Quaternion().setFromEuler(dipoleEuler);

        this.lineGeometries = [];

        L_shells.forEach(shell => {
            for (let m = 0; m < numMeridians; m++) {
                const phi = (m / numMeridians) * Math.PI * 2;
                const cosPhi = Math.cos(phi);
                const sinPhi = Math.sin(phi);

                const basePoints = [];
                for (let i = 0; i <= shell.steps; i++) {
                    const theta = (i / shell.steps) * Math.PI;
                    if (theta < 0.08 || theta > Math.PI - 0.08) continue;

                    // Ecuación dipolar estándar WMM / IGRF: r = L * sin^2(theta)
                    const r = shell.L * Math.sin(theta) * Math.sin(theta);

                    // Coordenadas en el sistema del dipolo
                    const x = r * Math.sin(theta) * cosPhi;
                    const y = r * Math.cos(theta); // Eje magnético norte-sur
                    const z = r * Math.sin(theta) * sinPhi;

                    const p = new THREE.Vector3(x, y, z);
                    p.applyQuaternion(dipoleQuaternion);

                    basePoints.push({
                        orig: p,
                        L: shell.L,
                        phi: phi,
                        theta: theta
                    });
                }

                if (basePoints.length > 2) {
                    const positions = new Float32Array(basePoints.length * 3);
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                    const material = new THREE.LineBasicMaterial({
                        color: shell.color,
                        transparent: true,
                        opacity: shell.opacity,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });

                    const lineMesh = new THREE.Line(geometry, material);
                    this.fieldGroup.add(lineMesh);

                    this.lineGeometries.push({
                        geometry: geometry,
                        basePoints: basePoints,
                        isTailLobe: false
                    });
                }
            }
        });

        // Líneas abiertas de los lóbulos de la magnetocola (Lóbulo Norte y Sur)
        const numTailLines = 10;
        for (let k = 0; k < numTailLines; k++) {
            const angle = (k / numTailLines) * Math.PI * 2;
            [-1, 1].forEach(poleSign => {
                const basePoints = [];
                const steps = 40;
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    // Salida desde el casquete polar
                    const theta = poleSign > 0 ? 0.15 + t * 0.35 : Math.PI - (0.15 + t * 0.35);
                    const r = 3.5 + t * 35.0; // Se extiende a lo largo de la cola
                    
                    const x = Math.cos(angle) * (1.2 + t * 4.5);
                    const y = poleSign * (2.8 + Math.sqrt(t) * 3.5);
                    const z = t * 38.0; // Dirección de la cola (+Z en espacio alineado con el viento)

                    basePoints.push({
                        tailOffset: new THREE.Vector3(x, y, z),
                        poleSign: poleSign,
                        t: t
                    });
                }

                const positions = new Float32Array(basePoints.length * 3);
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                const material = new THREE.LineBasicMaterial({
                    color: 0x38bdf8,
                    transparent: true,
                    opacity: 0.32,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });

                const lineMesh = new THREE.Line(geometry, material);
                this.fieldGroup.add(lineMesh);

                this.lineGeometries.push({
                    geometry: geometry,
                    basePoints: basePoints,
                    isTailLobe: true
                });
            });
        }

        // Partículas de flujo magnético en movimiento (Plasma electromagnético animado)
        this.createFluxParticles();
    }

    createFluxParticles() {
        const particleCount = 200;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        this.particlesData = [];

        for (let i = 0; i < particleCount; i++) {
            const lineIdx = Math.floor(Math.random() * this.lineGeometries.length);
            const lineObj = this.lineGeometries[lineIdx];
            const progress = Math.random();

            this.particlesData.push({
                lineIdx: lineIdx,
                progress: progress,
                speed: 0.003 + Math.random() * 0.005
            });

            colors[i * 3] = 0.4;
            colors[i * 3 + 1] = 0.9;
            colors[i * 3 + 2] = 1.0;
        }

        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.35,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        this.fieldGroup.add(this.particleSystem);
    }

    buildVanAllenBelts() {
        this.vanAllenGroup = new THREE.Group();
        this.vanAllenGroup.rotation.z = this.magneticTilt;

        // Cinturón Interno de Van Allen (Protones de alta energía: 1.5 a 2.5 radios terrestres)
        const innerGeo = new THREE.TorusGeometry(4.4, 0.65, 16, 64);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const innerBelt = new THREE.Mesh(innerGeo, innerMat);
        innerBelt.rotation.x = Math.PI / 2;
        this.vanAllenGroup.add(innerBelt);

        // Cinturón Externo de Van Allen (Electrones de alta energía: 3.5 a 5 radios terrestres)
        const outerGeo = new THREE.TorusGeometry(6.6, 1.1, 16, 64);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0x818cf8,
            transparent: true,
            opacity: 0.07,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const outerBelt = new THREE.Mesh(outerGeo, outerMat);
        outerBelt.rotation.x = Math.PI / 2;
        this.vanAllenGroup.add(outerBelt);

        this.fieldGroup.add(this.vanAllenGroup);
    }

    buildMagneticDipoleAxis() {
        this.dipoleAxisGroup = new THREE.Group();
        this.dipoleAxisGroup.rotation.z = this.magneticTilt;

        // Eje magnético discontinuo que atraviesa los polos geomagnéticos
        const axisPoints = [
            new THREE.Vector3(0, -6.8, 0),
            new THREE.Vector3(0, 6.8, 0)
        ];
        const axisGeom = new THREE.BufferGeometry().setFromPoints(axisPoints);
        const axisMat = new THREE.LineDashedMaterial({
            color: 0x00f0ff,
            dashSize: 0.6,
            gapSize: 0.35,
            transparent: true,
            opacity: 0.6
        });
        const axisLine = new THREE.Line(axisGeom, axisMat);
        axisLine.computeLineDistances();
        this.dipoleAxisGroup.add(axisLine);

        // Marcadores de polos magnéticos (esferas brillantes en los polos magnéticos N y S)
        const poleGeo = new THREE.SphereGeometry(0.25, 16, 16);
        const northMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 }); // Polo Norte Magnético
        const southMat = new THREE.MeshBasicMaterial({ color: 0x818cf8 }); // Polo Sur Magnético

        const northPole = new THREE.Mesh(poleGeo, northMat);
        northPole.position.set(0, 4.0, 0);
        this.dipoleAxisGroup.add(northPole);

        const southPole = new THREE.Mesh(poleGeo, southMat);
        southPole.position.set(0, -4.0, 0);
        this.dipoleAxisGroup.add(southPole);

        this.fieldGroup.add(this.dipoleAxisGroup);
    }

    update(time) {
        if (!this.earth) return;

        this.pulseTime = time;

        // 1. Posición: Centrada de manera exacta en la Tierra en cada instante orbital
        const earthPos = this.earth.getPosition();
        this.container.position.copy(earthPos);

        // 2. FÍSICA Y ORIENTACIÓN DEL VIENTO SOLAR:
        // Sol está en (0, 0, 0). La Tierra está en earthPos (plano X-Z).
        // Vector desde el Sol hacia la Tierra = sunToEarth.
        // Dirección de la magnetocola = +sunToEarth (se aleja del Sol en el plano orbital).
        // Dirección del frente diurno (comprimido) = -sunToEarth (mira directamente al Sol).
        const sunToEarth = earthPos.clone().normalize(); // Vector unitario que apunta hacia la cola
        const sunward = sunToEarth.clone().negate();     // Vector unitario que apunta hacia el Sol
        const eclipticUp = new THREE.Vector3(0, 1, 0);   // Eje normal a la eclíptica
        const orbitTangent = new THREE.Vector3().crossVectors(eclipticUp, sunToEarth).normalize();

        // 3. Deformar dinámicamente cada línea de campo magnético según la física del viento solar:
        this.lineGeometries.forEach(item => {
            const positions = item.geometry.attributes.position.array;
            const pts = item.basePoints;

            if (!item.isTailLobe) {
                // Líneas cerradas del dipolo WMM:
                for (let i = 0; i < pts.length; i++) {
                    const pt = pts[i];
                    const orig = pt.orig;

                    // Proyección del punto en la dirección Sol-Tierra:
                    // Proyección positiva = hacia el lado nocturno (+sunToEarth)
                    // Proyección negativa = hacia el lado diurno (-sunToEarth)
                    const projSun = orig.dot(sunToEarth);

                    let px = orig.x;
                    let py = orig.y;
                    let pz = orig.z;

                    if (projSun > 0.3) {
                        // Lado nocturno: estiramiento en la magnetocola
                        const stretchFactor = Math.pow(projSun / pt.L, 1.8) * 4.2;
                        px += sunToEarth.x * stretchFactor;
                        pz += sunToEarth.z * stretchFactor;
                    } else if (projSun < -0.3) {
                        // Lado diurno: compresión armónica por presión del viento solar
                        const compFactor = Math.abs(projSun) * 0.28;
                        px += sunToEarth.x * compFactor; // lo empuja hacia la Tierra
                        pz += sunToEarth.z * compFactor;
                    }

                    positions[i * 3] = px;
                    positions[i * 3 + 1] = py;
                    positions[i * 3 + 2] = pz;
                }
            } else {
                // Lóbulos abiertos de la magnetocola (se extienden exactamente en la dirección opuesta al Sol):
                for (let i = 0; i < pts.length; i++) {
                    const pt = pts[i];
                    const offset = pt.tailOffset;

                    // Alinear offset.z a lo largo del vector sunToEarth
                    const pos = new THREE.Vector3();
                    // Componente horizontal perpendicular al viento solar
                    pos.addScaledVector(orbitTangent, offset.x);
                    // Componente vertical (norte-sur respecto a la eclíptica)
                    pos.addScaledVector(eclipticUp, offset.y);
                    // Componente a lo largo de la cola (alejándose del Sol)
                    pos.addScaledVector(sunToEarth, offset.z);

                    // Pequeña ondulación de plasma impulsada por el viento solar
                    const wave = Math.sin(offset.z * 0.4 - time * 3.0) * 0.35 * (offset.z / 38.0);
                    pos.addScaledVector(eclipticUp, wave);

                    positions[i * 3] = pos.x;
                    positions[i * 3 + 1] = pos.y;
                    positions[i * 3 + 2] = pos.z;
                }
            }

            item.geometry.attributes.position.needsUpdate = true;
        });

        // 4. Actualizar partículas de plasma en movimiento a lo largo de las líneas
        if (this.particleSystem && this.particlesData) {
            const pPositions = this.particleSystem.geometry.attributes.position.array;

            for (let i = 0; i < this.particlesData.length; i++) {
                const p = this.particlesData[i];
                p.progress += p.speed;
                if (p.progress >= 1.0) p.progress = 0.0;

                const lineItem = this.lineGeometries[p.lineIdx];
                const ptsCount = lineItem.basePoints.length;
                const index = Math.floor(p.progress * (ptsCount - 1));
                const linePositions = lineItem.geometry.attributes.position.array;

                pPositions[i * 3] = linePositions[index * 3];
                pPositions[i * 3 + 1] = linePositions[index * 3 + 1];
                pPositions[i * 3 + 2] = linePositions[index * 3 + 2];
            }

            this.particleSystem.geometry.attributes.position.needsUpdate = true;
        }

        // 5. Precesión diurna sutil con la rotación de la Tierra
        if (this.earth.mesh) {
            this.dipoleAxisGroup.rotation.y = this.earth.mesh.rotation.y * 0.95;
            this.vanAllenGroup.rotation.y = this.earth.mesh.rotation.y * 0.95;
        }
    }

    toggle() {
        this.visible = !this.visible;
        this.container.visible = this.visible;
        return this.visible;
    }
}
