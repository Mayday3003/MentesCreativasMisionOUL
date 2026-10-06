import * as THREE from 'three';

/**
 * Modelo Geomagnético WMM / IGRF y Viento Solar Interactivo
 * Recrea fielmente el fenómeno físico mostrado en el diagrama científico:
 * 1. Radiación / Viento Solar (Líneas de corriente ámbar/naranja) que viajan desde el Sol hacia la Tierra.
 * 2. Arco de Choque Incandescente (Bow Shock): brillante creciente amarillo-blanco en el frente y rojo ardiente en los flancos.
 * 3. Límite de la Magnetopausa: frontera azul que contiene la cavidad magnética terrestre.
 * 4. Líneas de Campo Magnético Dipolar WMM/IGRF (Azul eléctrico/Cian): lazos toroidales cerrados y cola extendida.
 * 5. Flujo de partículas solares en tiempo real saliendo del Sol y desviándose alrededor de la Tierra.
 */
export class Magnetosphere {
    constructor(earthEntity) {
        this.earth = earthEntity;
        this.container = new THREE.Group();

        // Inclinación dipolar geomagnética de la Tierra (~10.5° respecto al eje geográfico)
        this.magneticTilt = (23.44 - 10.5) * Math.PI / 180;

        // Grupo principal del campo electromagnético y viento solar
        this.fieldGroup = new THREE.Group();
        this.container.add(this.fieldGroup);

        this.solarWindVisible = true;
        this.visible = true;

        // 1. Líneas de Campo Geomagnético Interno (Azul Eléctrico / WMM)
        this.buildGeomagneticField();

        // 2. Arco de Choque Incandescente (Bow Shock: Núcleo amarillo-blanco y alas rojas)
        this.buildIncandescentBowShock();

        // 3. Contorno de la Magnetopausa (Límite de la cavidad)
        this.buildMagnetopauseBoundary();

        // 4. Líneas de Corriente del Viento Solar (Líneas naranjas que se desvían alrededor de la Tierra)
        this.buildSolarWindStreamlines();

        // 5. Partículas de Radiación Solar en Tránsito
        this.buildSolarRadiationParticles();

        // 6. Cinturones de Van Allen y Eje Dipolar
        this.buildVanAllenBelts();
        this.buildMagneticDipoleAxis();
    }

    buildIncandescentBowShock() {
        // Malla curvada parabólica para el Bow Shock que coincide exactamente con el arco de la imagen
        // Apex a z = -6.8 (frente al Sol), extendiéndose hacia los lados z = 4.0
        const arcPoints = [];
        const numRings = 32;
        const numSegments = 48;

        // Geometría paramétrica para la caperuza de choque
        const shockGeometry = new THREE.BufferGeometry();
        const positions = [];
        const uvs = [];
        const indices = [];

        for (let i = 0; i <= numRings; i++) {
            const v = i / numRings; // 0 (ápice subsolar) a 1 (alas exteriores)
            const z = -6.8 + v * v * 10.5; // Curvatura parabólica
            const radius = Math.sqrt(Math.max(0.01, (z + 6.9) * 8.5));

            for (let j = 0; j <= numSegments; j++) {
                const u = j / numSegments;
                const phi = u * Math.PI * 2;

                // Forma elíptica suave
                const x = radius * Math.cos(phi) * 1.15;
                const y = radius * Math.sin(phi);

                positions.push(x, y, z);
                uvs.push(u, v);
            }
        }

        for (let i = 0; i < numRings; i++) {
            for (let j = 0; j < numSegments; j++) {
                const a = i * (numSegments + 1) + j;
                const b = (i + 1) * (numSegments + 1) + j;
                const c = (i + 1) * (numSegments + 1) + (j + 1);
                const d = i * (numSegments + 1) + (j + 1);
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        shockGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        shockGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        shockGeometry.setIndex(indices);
        shockGeometry.computeVertexNormals();

        // Shader que reproduce fielmente el gradiente térmico de la imagen:
        // Centro (v ~ 0): Amarillo-Blanco brillante (choque frontal de alta temperatura)
        // Flancos (v > 0.4): Naranja-Rojo incandescente, desvaneciéndose en los bordes
        this.bowShockMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                uniform float uTime;

                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    
                    vec3 pos = position;
                    // Fluctuación dinámica por ráfagas del viento solar
                    pos += normal * (sin(pos.z * 1.5 - uTime * 4.0) * 0.12);

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                uniform float uTime;

                void main() {
                    vec3 viewDir = normalize(vViewPosition);
                    vec3 normal = normalize(vNormal);

                    float v = vUv.y; // 0 = ápice (frente al Sol), 1 = flancos posteriores

                    // Rampa de color exactamente igual a la imagen de referencia:
                    // Núcleo: Amarillo-blanco cálido
                    vec3 coreColor = vec3(1.0, 0.95, 0.45);
                    // Región intermedia: Naranja solar ardiente
                    vec3 midColor = vec3(1.0, 0.42, 0.05);
                    // Alas exteriores: Rojo fuego profundo
                    vec3 edgeColor = vec3(0.85, 0.08, 0.02);

                    vec3 color;
                    if (v < 0.35) {
                        color = mix(coreColor, midColor, v / 0.35);
                    } else {
                        color = mix(midColor, edgeColor, (v - 0.35) / 0.65);
                    }

                    // Resplandor de choque térmico (Fresnel y disipación periférica)
                    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 1.8);
                    float edgeFade = smoothstep(1.0, 0.65, v);
                    float apexGlow = smoothstep(0.7, 0.0, v) * 0.65;

                    float alpha = (fresnel * 0.75 + apexGlow) * edgeFade * 0.85;

                    // Pulso del plasma
                    alpha *= (0.88 + 0.12 * sin(uTime * 3.5));

                    gl_FragColor = vec4(color * 1.5, alpha);
                }
            `,
            uniforms: {
                uTime: { value: 0.0 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.bowShockMesh = new THREE.Mesh(shockGeometry, this.bowShockMaterial);
        this.fieldGroup.add(this.bowShockMesh);
    }

    buildMagnetopauseBoundary() {
        // Curva exterior azul que delimita la cavidad magnética de la Tierra
        const boundaryPoints = [];
        const steps = 60;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * Math.PI - Math.PI / 2; // -PI/2 a PI/2
            const z = -5.4 + Math.sin(t) * 1.5 + (t > 0 ? t * 14.0 : 0);
            const r = 5.2 + Math.abs(t) * 4.5;
            boundaryPoints.push(new THREE.Vector3(r, 0, z));
        }

        // Trazar contorno en varios ángulos
        this.boundaryGroup = new THREE.Group();
        for (let a = 0; a < 4; a++) {
            const angle = (a / 4) * Math.PI;
            const geom = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
            const mat = new THREE.LineBasicMaterial({
                color: 0x0088ff,
                transparent: true,
                opacity: 0.35,
                blending: THREE.AdditiveBlending
            });
            const line = new THREE.Line(geom, mat);
            line.rotation.z = angle;
            this.boundaryGroup.add(line);
        }
        this.fieldGroup.add(this.boundaryGroup);
    }

    buildSolarWindStreamlines() {
        // Líneas anaranjadas/ámbar del viento solar que se curvan alrededor de la Tierra
        // como en la imagen de referencia.
        this.streamlinesGroup = new THREE.Group();
        this.streamlinesData = [];

        // Distancias laterales (impact parameter) desde el eje Tierra-Sol
        const impactRadii = [
            4.8, 6.2, 7.8, 9.6, 11.8, 14.2, 17.0, 20.5
        ];

        // Se generan en el plano horizontal y en planos inclinados
        const planes = [
            { angle: 0 },
            { angle: Math.PI / 4 },
            { angle: -Math.PI / 4 },
            { angle: Math.PI / 2 }
        ];

        planes.forEach(plane => {
            impactRadii.forEach(r0 => {
                [-1, 1].forEach(side => {
                    const y0 = r0 * side;
                    const points = [];
                    const numSteps = 70;

                    for (let i = 0; i <= numSteps; i++) {
                        const t = i / numSteps;
                        // z viaja desde el lado del Sol (z = -30) hasta la cola (z = +35)
                        const z = -28.0 + t * 65.0;

                        // Deflexión aerodinámica / hidrodinámica alrededor del obstáculo magnético:
                        // Obstáculo centrado en el frente diurno con standoff = 6.2
                        const standoff = 6.2;
                        let deflection = 0;
                        if (z > -standoff - 5.0) {
                            const obstacleRadius = Math.sqrt(Math.max(0.01, (z + standoff + 4.0) * 8.0));
                            // Deflexión que empuja las líneas hacia afuera suavemente
                            deflection = (obstacleRadius * obstacleRadius) / (r0 + obstacleRadius * 0.6);
                        }

                        const currentR = Math.abs(y0) + deflection * 0.75;
                        const x = Math.sign(y0) * currentR;
                        const y = 0;

                        points.push(new THREE.Vector3(x, y, z));
                    }

                    const geom = new THREE.BufferGeometry().setFromPoints(points);

                    // Color degradado: ámbar/naranja brillante en el choque, desvanecido lejos
                    const mat = new THREE.LineBasicMaterial({
                        color: 0xff8811,
                        transparent: true,
                        opacity: 0.55 - (r0 / 25.0) * 0.28,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });

                    const line = new THREE.Line(geom, mat);
                    line.rotation.z = plane.angle;
                    this.streamlinesGroup.add(line);

                    this.streamlinesData.push({
                        geometry: geom,
                        points: points,
                        angle: plane.angle
                    });
                });
            });
        });

        this.fieldGroup.add(this.streamlinesGroup);
    }

    buildSolarRadiationParticles() {
        // Enjambre de partículas de radiación solar viajando continuamente desde el Sol hacia la Tierra
        const particleCount = 350;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        this.solarParticles = [];

        for (let i = 0; i < particleCount; i++) {
            // Asignar una línea de corriente aleatoria para que cada partícula viaje sobre ella
            const streamIdx = Math.floor(Math.random() * this.streamlinesData.length);
            const progress = Math.random();

            this.solarParticles.push({
                streamIdx: streamIdx,
                progress: progress,
                speed: 0.006 + Math.random() * 0.009
            });

            // Color: Amarillo oro a naranja intenso
            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 0.6 + Math.random() * 0.35;
            colors[i * 3 + 2] = 0.1;
        }

        const particleGeom = new THREE.BufferGeometry();
        particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMat = new THREE.PointsMaterial({
            size: 0.42,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.radiationPoints = new THREE.Points(particleGeom, particleMat);
        this.fieldGroup.add(this.radiationPoints);
    }

    buildGeomagneticField() {
        // Líneas de campo dipolar azul eléctrico exactamente como en el diagrama (WMM)
        this.geoLinesGroup = new THREE.Group();
        this.lineGeometries = [];

        const L_shells = [
            { L: 3.2, opacity: 0.95, color: 0x00d0ff }, // Lazos cercanos intensos
            { L: 4.4, opacity: 0.85, color: 0x0099ff },
            { L: 5.8, opacity: 0.65, color: 0x0066ff },
            { L: 7.4, opacity: 0.45, color: 0x0033cc }
        ];

        const numMeridians = 12;

        L_shells.forEach(shell => {
            for (let m = 0; m < numMeridians; m++) {
                const phi = (m / numMeridians) * Math.PI * 2;
                const cosPhi = Math.cos(phi);
                const sinPhi = Math.sin(phi);

                const basePoints = [];
                const steps = 70;

                for (let i = 0; i <= steps; i++) {
                    const theta = (i / steps) * Math.PI;
                    if (theta < 0.06 || theta > Math.PI - 0.06) continue;

                    // Ecuación dipolar clásica: r = L * sin^2(theta)
                    const r = shell.L * Math.sin(theta) * Math.sin(theta);

                    const x = r * Math.sin(theta) * cosPhi;
                    const y = r * Math.cos(theta); // Eje magnético N-S
                    const z = r * Math.sin(theta) * sinPhi;

                    basePoints.push({
                        x: x,
                        y: y,
                        z: z,
                        L: shell.L
                    });
                }

                if (basePoints.length > 2) {
                    const positions = new Float32Array(basePoints.length * 3);
                    const geom = new THREE.BufferGeometry();
                    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

                    const mat = new THREE.LineBasicMaterial({
                        color: shell.color,
                        transparent: true,
                        opacity: shell.opacity,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });

                    const line = new THREE.Line(geom, mat);
                    this.geoLinesGroup.add(line);

                    this.lineGeometries.push({
                        geometry: geom,
                        basePoints: basePoints
                    });
                }
            }
        });

        this.fieldGroup.add(this.geoLinesGroup);
    }

    buildVanAllenBelts() {
        this.vanAllenGroup = new THREE.Group();
        this.vanAllenGroup.rotation.z = this.magneticTilt;

        const innerGeo = new THREE.TorusGeometry(3.6, 0.5, 16, 48);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0x00bfff,
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const innerBelt = new THREE.Mesh(innerGeo, innerMat);
        innerBelt.rotation.x = Math.PI / 2;
        this.vanAllenGroup.add(innerBelt);

        this.fieldGroup.add(this.vanAllenGroup);
    }

    buildMagneticDipoleAxis() {
        this.dipoleAxisGroup = new THREE.Group();
        this.dipoleAxisGroup.rotation.z = this.magneticTilt;

        const axisPoints = [
            new THREE.Vector3(0, -5.5, 0),
            new THREE.Vector3(0, 5.5, 0)
        ];
        const axisGeom = new THREE.BufferGeometry().setFromPoints(axisPoints);
        const axisMat = new THREE.LineDashedMaterial({
            color: 0x00f0ff,
            dashSize: 0.4,
            gapSize: 0.25,
            transparent: true,
            opacity: 0.55
        });
        const axisLine = new THREE.Line(axisGeom, axisMat);
        axisLine.computeLineDistances();
        this.dipoleAxisGroup.add(axisLine);

        this.fieldGroup.add(this.dipoleAxisGroup);
    }

    update(time) {
        if (!this.earth) return;

        // 1. Posición: Centrada de manera exacta en la Tierra en cada instante orbital
        const earthPos = this.earth.getPosition();
        this.container.position.copy(earthPos);

        // 2. FÍSICA Y ORIENTACIÓN DEL VIENTO SOLAR:
        // El Sol está en (0,0,0). La Tierra está en earthPos.
        // Vector desde el Sol hacia la Tierra = sunToEarth.
        // La radiación solar viene en la dirección +sunToEarth.
        // La cara delantera (Bow Shock incandescente) mira hacia el Sol: local -Z.
        // La cola se extiende alejándose del Sol: local +Z.
        const sunToEarth = earthPos.clone().normalize();
        const lookTarget = earthPos.clone().add(sunToEarth.clone().multiplyScalar(20));
        
        // Orientar todo el grupo del campo y viento solar para que su eje Z coincida con el rayo Sol-Tierra
        this.fieldGroup.lookAt(lookTarget);

        // 3. Actualizar tiempo del shader del Bow Shock
        if (this.bowShockMaterial && this.bowShockMaterial.uniforms.uTime) {
            this.bowShockMaterial.uniforms.uTime.value = time;
        }

        // 4. Deformar las líneas dipolares internas: comprimidas en el frente, extendidas en la cola
        this.lineGeometries.forEach(item => {
            const positions = item.geometry.attributes.position.array;
            const pts = item.basePoints;

            for (let i = 0; i < pts.length; i++) {
                const pt = pts[i];
                let px = pt.x;
                let py = pt.y;
                let pz = pt.z;

                // Deformación a lo largo del eje local Z (alineado con el vector Sol-Tierra):
                if (pz > 0.2) {
                    // Lado nocturno: estiramiento hacia la magnetocola (+Z)
                    pz += Math.pow(pz / pt.L, 1.7) * (pt.L * 0.65);
                } else if (pz < -0.2) {
                    // Lado diurno: compresión hacia la Tierra (-Z)
                    pz *= 0.72;
                    px *= 0.88;
                }

                positions[i * 3] = px;
                positions[i * 3 + 1] = py;
                positions[i * 3 + 2] = pz;
            }
            item.geometry.attributes.position.needsUpdate = true;
        });

        // 5. Mover las partículas de radiación solar a lo largo de las líneas de corriente
        if (this.radiationPoints && this.solarParticles) {
            const pPositions = this.radiationPoints.geometry.attributes.position.array;

            for (let i = 0; i < this.solarParticles.length; i++) {
                const sp = this.solarParticles[i];
                sp.progress += sp.speed;
                if (sp.progress >= 1.0) sp.progress = 0.0;

                const stream = this.streamlinesData[sp.streamIdx];
                const pts = stream.points;
                const idx = Math.floor(sp.progress * (pts.length - 1));
                const pt = pts[idx];

                // Rotar según el ángulo del plano de la línea
                const cosA = Math.cos(stream.angle);
                const sinA = Math.sin(stream.angle);

                const rx = pt.x * cosA - pt.y * sinA;
                const ry = pt.x * sinA + pt.y * cosA;
                const rz = pt.z;

                pPositions[i * 3] = rx;
                pPositions[i * 3 + 1] = ry;
                pPositions[i * 3 + 2] = rz;
            }

            this.radiationPoints.geometry.attributes.position.needsUpdate = true;
        }
    }

    toggle() {
        this.visible = !this.visible;
        this.container.visible = this.visible;
        return this.visible;
    }

    toggleSolarWind() {
        this.solarWindVisible = !this.solarWindVisible;
        this.streamlinesGroup.visible = this.solarWindVisible;
        this.radiationPoints.visible = this.solarWindVisible;
        this.bowShockMesh.visible = this.solarWindVisible;
        return this.solarWindVisible;
    }
}
