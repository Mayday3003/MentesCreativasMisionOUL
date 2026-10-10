import * as THREE from 'three';
import { Simulation } from './core/Simulation.js';
import { TimeController } from './core/TimeController.js';
import { Sun } from './entities/Sun.js';
import { Earth } from './entities/Earth.js';
import { Moon } from './entities/Moon.js';
import { Magnetosphere } from './entities/Magnetosphere.js';

// ============================================================================
// 1. Instanciación del Motor y Entidades Físicas
// ============================================================================
const simulation = new Simulation('webgl-canvas');
const timeController = new TimeController();

const sun = new Sun(12);
const earth = new Earth(3.5, 65, 0.5);
const moon = new Moon(earth, 0.95, 10.0, 6.5);
const magnetosphere = new Magnetosphere(earth);

simulation.addEntity(sun);
simulation.addEntity(earth);
simulation.addEntity(moon);
simulation.addEntity(magnetosphere);

// ============================================================================
// 2. Etiquetas Discretas en Escena (Alta legibilidad) y Línea de Elongación
// ============================================================================
function createLabelSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Tipografía nítida con doble silueta oscura para garantizar legibilidad sobre cualquier fondo
    ctx.font = '600 24px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(11, 13, 12, 0.95)';
    ctx.strokeText(text, 128, 32);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true, 
        depthTest: false,
        depthWrite: false 
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(10, 2.5, 1);
    return sprite;
}

const labelSun = createLabelSprite('Sol');
const labelEarth = createLabelSprite('Tierra');
const labelMoon = createLabelSprite('Luna');
labelMoon.scale.set(7, 1.75, 1);

simulation.scene.add(labelSun);
simulation.scene.add(labelEarth);
simulation.scene.add(labelMoon);

// Líneas de referencia para el ángulo de elongación:
// Rayo 1: Tierra -> Sol (dirección colineal al Sol)
// Rayo 2: Tierra -> Luna (vector selenocéntrico)
// Arco angular: curva visual discreta en el vértice de la Tierra
// Rayo 1 (Sol-Tierra), Rayo 2 (Tierra-Luna) y arco angular slerp exacto
// Usamos LineSegments para trazar únicamente los segmentos necesarios sin retornos ni uniones fantasma
const ARC_STEPS = 24;
// Segmentos: 1 para rayo al Sol (2 puntos) + 1 para rayo a la Luna (2 puntos) + ARC_STEPS segmentos para el arco (ARC_STEPS * 2 puntos)
const totalElongationPoints = (2 + 2 + ARC_STEPS * 2);
const elongationGeo = new THREE.BufferGeometry();
const elongationPositions = new Float32Array(totalElongationPoints * 3);
elongationGeo.setAttribute('position', new THREE.BufferAttribute(elongationPositions, 3));

const elongationMat = new THREE.LineBasicMaterial({
    color: 0xd4af37, // Ámbar técnico
    transparent: true,
    opacity: 0.7,
    depthTest: false,
    depthWrite: false
});

const elongationLine = new THREE.LineSegments(elongationGeo, elongationMat);
elongationLine.frustumCulled = false;
simulation.scene.add(elongationLine);

function updateSceneVisuals() {
    const sunPos = sun.getPosition();
    const earthPos = earth.getPosition();
    const moonPos = moon.getPosition();

    // Posicionamiento de etiquetas ligeramente por encima de los astros
    labelSun.position.set(sunPos.x, sunPos.y + 15, sunPos.z);
    labelEarth.position.set(earthPos.x, earthPos.y + 6.2, earthPos.z);
    labelMoon.position.set(moonPos.x, moonPos.y + 2.5, moonPos.z);

    // Ajuste dinámico de escala de sprites según la distancia a la cámara
    const camPos = simulation.camera.position;
    const dSun = camPos.distanceTo(sunPos);
    const dEarth = camPos.distanceTo(earthPos);
    const dMoon = camPos.distanceTo(moonPos);

    const baseScaleSun = Math.max(8, dSun * 0.08);
    labelSun.scale.set(baseScaleSun, baseScaleSun * 0.25, 1);

    const baseScaleEarth = Math.max(4.5, dEarth * 0.08);
    labelEarth.scale.set(baseScaleEarth, baseScaleEarth * 0.25, 1);

    const baseScaleMoon = Math.max(2.5, dMoon * 0.07);
    labelMoon.scale.set(baseScaleMoon, baseScaleMoon * 0.25, 1);

    // Actualización de la geometría de elongación con LineSegments limpios
    const dirToSun = sunPos.clone().sub(earthPos).normalize();
    const dirToMoon = moonPos.clone().sub(earthPos).normalize();
    
    // El rayo hacia el Sol se extiende proporcionalmente hacia el astro rey
    const raySunEnd = earthPos.clone().add(dirToSun.clone().multiplyScalar(15));
    // El rayo hacia la Luna va exactamente desde el centro de la Tierra hasta la Luna
    const rayMoonEnd = moonPos.clone();

    const posAttr = elongationGeo.attributes.position;
    let idx = 0;

    // Segmento 1: Tierra -> Rayo hacia el Sol
    posAttr.setXYZ(idx++, earthPos.x, earthPos.y, earthPos.z);
    posAttr.setXYZ(idx++, raySunEnd.x, raySunEnd.y, raySunEnd.z);

    // Segmento 2: Tierra -> Luna
    posAttr.setXYZ(idx++, earthPos.x, earthPos.y, earthPos.z);
    posAttr.setXYZ(idx++, rayMoonEnd.x, rayMoonEnd.y, rayMoonEnd.z);

    // Arco angular en la Tierra conectando dirToSun con dirToMoon en su plano orbital común
    const arcRadius = 4.8;
    const dotVal = Math.max(-1, Math.min(1, dirToSun.dot(dirToMoon)));
    const angleTotal = Math.acos(dotVal);

    // Eje perpendicular al plano Sol-Tierra-Luna para rotación esférica exacta
    let perpAxis = new THREE.Vector3().crossVectors(dirToSun, dirToMoon);
    if (perpAxis.lengthSq() < 0.0001) {
        perpAxis.set(0, 1, 0);
    } else {
        perpAxis.normalize();
    }

    let prevPoint = earthPos.clone().add(dirToSun.clone().multiplyScalar(arcRadius));

    for (let i = 1; i <= ARC_STEPS; i++) {
        const theta = (i / ARC_STEPS) * angleTotal;
        const rotatedDir = dirToSun.clone().applyAxisAngle(perpAxis, theta);
        const currPoint = earthPos.clone().add(rotatedDir.multiplyScalar(arcRadius));

        // Par de puntos del segmento
        posAttr.setXYZ(idx++, prevPoint.x, prevPoint.y, prevPoint.z);
        posAttr.setXYZ(idx++, currPoint.x, currPoint.y, currPoint.z);

        prevPoint = currPoint;
    }

    posAttr.needsUpdate = true;
}

// ============================================================================
// 3. Modos de Cámara Dinámica (Perspectivas de Referencia Astronómicas)
// ============================================================================
let cameraMode = 'global';

const camButtons = {
    'global': document.getElementById('btn-cam-global'),
    'sun': document.getElementById('btn-cam-sun'),
    'earth': document.getElementById('btn-cam-earth'),
    'moon': document.getElementById('btn-cam-moon')
};

function setCameraMode(mode, savePref = true) {
    cameraMode = mode;

    Object.keys(camButtons).forEach(k => {
        const btn = camButtons[k];
        if (btn) {
            const isActive = (k === mode);
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
    });

    if (mode === 'global') {
        simulation.focusOnEntity(null, new THREE.Vector3(0, 70, 145));
    } else if (mode === 'sun') {
        simulation.focusOnEntity(sun, new THREE.Vector3(0, 15, 36));
    } else if (mode === 'earth') {
        simulation.focusOnEntity(earth, new THREE.Vector3(0, 6, 15));
    } else if (mode === 'moon') {
        simulation.focusOnEntity(moon, new THREE.Vector3(0, 2.5, 5));
    }

    if (savePref) {
        try { localStorage.setItem('astro_cam_mode', mode); } catch (_) {}
    }
}

// ============================================================================
// 4. Atenuación Temporal durante Arrastre de Cámara (Anti-mareo visual)
// ============================================================================
let isUserDraggingCamera = false;
let preDragSpeedMultiplier = 1.0;

simulation.controls.addEventListener('start', () => {
    isUserDraggingCamera = true;
    preDragSpeedMultiplier = targetSpeedMultiplier;
    // Atenuar velocidad a 0.2x suavemente mientras se maniobra la cámara
    currentInterpolatedMultiplier = Math.min(currentInterpolatedMultiplier, 0.2);
});

simulation.controls.addEventListener('end', () => {
    isUserDraggingCamera = false;
    // Se restaura automáticamente por el bucle de interpolación hacia targetSpeedMultiplier
});

// ============================================================================
// 5. Reducción de Movimiento (Soporte prefers-reduced-motion y Toggle Manual)
// ============================================================================
let isReducedMotion = false;
const mediaQueryReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function checkReducedMotionPreference() {
    const savedMotion = localStorage.getItem('astro_reduced_motion');
    if (savedMotion !== null) {
        return savedMotion === '1';
    }
    return mediaQueryReducedMotion.matches;
}

isReducedMotion = checkReducedMotionPreference();

const switchReducedMotion = document.getElementById('switch-reduced-motion');
if (switchReducedMotion) {
    switchReducedMotion.checked = isReducedMotion;
    switchReducedMotion.onchange = (e) => {
        isReducedMotion = e.target.checked;
        try { localStorage.setItem('astro_reduced_motion', isReducedMotion ? '1' : '0'); } catch (_) {}
    };
}

mediaQueryReducedMotion.addEventListener('change', (e) => {
    if (localStorage.getItem('astro_reduced_motion') === null) {
        isReducedMotion = e.matches;
        if (switchReducedMotion) switchReducedMotion.checked = isReducedMotion;
    }
});

// ============================================================================
// 6. Telemetría Desacoplada a ~4 Hz (Sin mareo por refresco excesivo)
// ============================================================================
const readoutPsi = document.getElementById('readout-psi');
const readoutIllum = document.getElementById('readout-illum');
const readoutDay = document.getElementById('readout-day');
const lunarDialSlider = document.getElementById('lunar-dial-slider');
const activePhaseName = document.getElementById('active-phase-name');
const simDateDisplay = document.getElementById('sim-date-display');
const speedHighAlert = document.getElementById('speed-high-alert');

const phaseButtons = {
    '0': document.getElementById('btn-phase-new'),
    '90': document.getElementById('btn-phase-first'),
    '180': document.getElementById('btn-phase-full'),
    '270': document.getElementById('btn-phase-third')
};

const TWO_PI = Math.PI * 2;
const SYNODIC_DAYS = 29.53;

let lastTelemetryUpdateTime = 0;
const TELEMETRY_INTERVAL_MS = 250; // ~4 Hz

function updateTelemetryThrottled(time, forceUpdate = false) {
    const now = performance.now();
    if (!forceUpdate && now - lastTelemetryUpdateTime < TELEMETRY_INTERVAL_MS) {
        return;
    }
    lastTelemetryUpdateTime = now;

    // psi = ((w_syn * t - PI) mod 2PI)
    const psiRad = (((timeController.synodicSpeed * time) - Math.PI) % TWO_PI + TWO_PI) % TWO_PI;
    const psiDeg = (psiRad * 180 / Math.PI);
    
    // Fracción geométrica iluminada: k = (1 - cos(psi)) / 2
    const illumPct = ((1 - Math.cos(psiRad)) * 0.5) * 100;
    
    // Día sinódico simulado dentro del mes actual
    const currentDay = (psiRad / TWO_PI) * SYNODIC_DAYS;

    // HUD superpuesto en mono (tabular-nums asegurado en CSS)
    if (readoutPsi) readoutPsi.textContent = `${psiDeg.toFixed(1).padStart(5, '0')}°`;
    if (readoutIllum) readoutIllum.textContent = `${illumPct.toFixed(1)}%`;
    if (readoutDay) readoutDay.textContent = `Día ${currentDay.toFixed(1).padStart(4, '0')} / ${SYNODIC_DAYS.toFixed(1)}`;

    // Fecha / Época simulada en la barra inferior
    if (simDateDisplay) {
        const earthOrbitFrac = (time * earth.orbitalSpeed) / TWO_PI;
        const totalSimDays = earthOrbitFrac * 365.25;

        // A velocidades >10x, mostrar solo el día entero para evitar mareo por números oscilantes
        if (targetSpeedMultiplier > 10.0) {
            simDateDisplay.textContent = `Día ${Math.floor(totalSimDays)}`;
            if (speedHighAlert) speedHighAlert.classList.remove('hidden');
        } else {
            const totalHours = (totalSimDays * 24);
            const hours = Math.floor(totalHours % 24);
            const mins = Math.floor((totalHours * 60) % 60);
            const secs = Math.floor((totalHours * 3600) % 60);
            const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            simDateDisplay.textContent = `Día ${totalSimDays.toFixed(2)} • ${timeStr}`;
            if (speedHighAlert) speedHighAlert.classList.add('hidden');
        }
    }

    // Sincronizar slider si el usuario no lo está arrastrando
    if (lunarDialSlider && document.activeElement !== lunarDialSlider) {
        lunarDialSlider.value = Math.round(psiDeg);
    }

    // Actualizar estado activo de las 4 marcas de fase
    const cardinalTol = 12.0;
    const isNew = (psiDeg <= cardinalTol || psiDeg >= 360 - cardinalTol);
    const isFirst = Math.abs(psiDeg - 90) <= cardinalTol;
    const isFull = Math.abs(psiDeg - 180) <= cardinalTol;
    const isThird = Math.abs(psiDeg - 270) <= cardinalTol;

    if (phaseButtons['0']) phaseButtons['0'].classList.toggle('active', isNew);
    if (phaseButtons['90']) phaseButtons['90'].classList.toggle('active', isFirst);
    if (phaseButtons['180']) phaseButtons['180'].classList.toggle('active', isFull);
    if (phaseButtons['270']) phaseButtons['270'].classList.toggle('active', isThird);

    // Texto cualitativo de fase (en minúsculas/capitalización normal)
    if (activePhaseName) {
        if (isNew) {
            activePhaseName.textContent = 'Luna nueva (0°)';
        } else if (psiDeg < 90 - cardinalTol) {
            activePhaseName.textContent = 'Creciente iluminante';
        } else if (isFirst) {
            activePhaseName.textContent = 'Cuarto creciente (90°)';
        } else if (psiDeg < 180 - cardinalTol) {
            activePhaseName.textContent = 'Gibosa creciente';
        } else if (isFull) {
            activePhaseName.textContent = 'Luna llena (180°)';
        } else if (psiDeg < 270 - cardinalTol) {
            activePhaseName.textContent = 'Gibosa menguante';
        } else if (isThird) {
            activePhaseName.textContent = 'Cuarto menguante (270°)';
        } else {
            activePhaseName.textContent = 'Menguante residual';
        }
    }
}

// ============================================================================
// 7. Velocidad: Interpolación Suave y Escala Logarítmica
// ============================================================================
let targetSpeedMultiplier = 1.0;
let currentInterpolatedMultiplier = 1.0;

function smoothSpeedUpdate(deltaSeconds) {
    const activeTarget = isUserDraggingCamera ? 0.2 : targetSpeedMultiplier;
    // Interpolación suave (lerp amortiguado exponencial)
    const factor = 1.0 - Math.exp(-deltaSeconds * 6.0);
    currentInterpolatedMultiplier += (activeTarget - currentInterpolatedMultiplier) * factor;

    timeController.setSpeedMultiplier(currentInterpolatedMultiplier);
}

// ============================================================================
// 8. Bucle Principal de Renderizado y Física
// ============================================================================
let lastFrameTime = performance.now();

simulation.renderer.setAnimationLoop(() => {
    const now = performance.now();
    const deltaSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    // 1. Suavizar velocidad temporal
    smoothSpeedUpdate(deltaSeconds);

    // 2. Actualizar física orbital
    const time = timeController.update();

    sun.update(time);
    earth.update(time);
    moon.update(time);

    // 3. Decoraciones (viento solar, partículas, plasma) con velocidad fija independiente de la simulación
    magnetosphere.update(time, deltaSeconds, isReducedMotion);

    // 4. Telemetría desacoplada a 4 Hz
    updateTelemetryThrottled(time);

    // 5. Escena y render
    updateSceneVisuals();
    simulation.update(deltaSeconds);
});

// ============================================================================
// 9. Interfaz de Usuario y Controles de Precisión
// ============================================================================

// Toggle Panel Lateral
const sidebarPanel = document.getElementById('sidebar-panel');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');

function toggleSidebar() {
    if (!sidebarPanel || !btnToggleSidebar) return;
    const isCollapsed = sidebarPanel.classList.toggle('collapsed');
    btnToggleSidebar.classList.toggle('collapsed', isCollapsed);
    btnToggleSidebar.setAttribute('aria-expanded', (!isCollapsed).toString());
}

if (btnToggleSidebar) {
    btnToggleSidebar.onclick = toggleSidebar;
}

// Control Temporal (Play / Pause)
const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

function updatePlayPauseUI(isPaused) {
    if (!btnPlayPause || !iconPlay || !iconPause) return;
    if (isPaused) {
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
        btnPlayPause.classList.add('paused');
        btnPlayPause.setAttribute('title', 'Reanudar simulación [Espacio]');
    } else {
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
        btnPlayPause.classList.remove('paused');
        btnPlayPause.setAttribute('title', 'Pausar simulación [Espacio]');
    }
}

if (btnPlayPause) {
    btnPlayPause.onclick = () => {
        const isPaused = timeController.togglePause();
        updatePlayPauseUI(isPaused);
    };
}

timeController.onPauseChanged = (isPaused) => {
    updatePlayPauseUI(isPaused);
};

// Pasos Angulares Discretos (Step Back / Step Forward)
const btnStepBack = document.getElementById('btn-step-back');
const btnStepFwd = document.getElementById('btn-step-fwd');

function stepSimulation(deltaAngleRad) {
    timeController.isPaused = true;
    updatePlayPauseUI(true);
    const dt = deltaAngleRad / timeController.synodicSpeed;
    timeController.time = Math.max(0, timeController.time + dt);
    updateTelemetryThrottled(timeController.time, true);
}

if (btnStepBack) {
    btnStepBack.onclick = () => stepSimulation(-Math.PI / 16);
}
if (btnStepFwd) {
    btnStepFwd.onclick = () => stepSimulation(Math.PI / 16);
}

// Escala Temporal Logarítmica
const speedSlider = document.getElementById('speed-slider');
const speedLabel = document.getElementById('speed-label');
const btnResetSpeed = document.getElementById('btn-reset-speed');
const speedTicks = document.querySelectorAll('.speed-ticks .tick');

function applySpeedExponent(expVal, savePref = true) {
    targetSpeedMultiplier = Math.pow(10, expVal);

    if (speedLabel) {
        if (targetSpeedMultiplier < 1) {
            speedLabel.textContent = `${targetSpeedMultiplier.toFixed(2)}×`;
        } else if (targetSpeedMultiplier < 10) {
            speedLabel.textContent = `${targetSpeedMultiplier.toFixed(1)}×`;
        } else {
            speedLabel.textContent = `${Math.round(targetSpeedMultiplier)}×`;
        }
    }

    if (speedTicks) {
        speedTicks.forEach(tick => {
            const tickStr = tick.getAttribute('data-val');
            const isActive = (expVal === -1 && tickStr === '0.1x') ||
                             (Math.abs(expVal - 0) < 0.05 && tickStr === '1x') ||
                             (Math.abs(expVal - 1) < 0.05 && tickStr === '10x') ||
                             (Math.abs(expVal - 2) < 0.05 && tickStr === '100x');
            tick.classList.toggle('active', isActive);
        });
    }

    // Forzar actualización de telemetría para mostrar/ocultar el aviso sobre 10x
    updateTelemetryThrottled(timeController.time, true);

    if (savePref) {
        try { localStorage.setItem('astro_speed_exp', expVal.toString()); } catch (_) {}
    }
}

if (speedSlider) {
    speedSlider.oninput = (e) => {
        applySpeedExponent(parseFloat(e.target.value));
    };
}

if (btnResetSpeed) {
    btnResetSpeed.onclick = () => {
        if (speedSlider) speedSlider.value = "0";
        applySpeedExponent(0);
    };
}

// Segmented Control de Perspectivas
Object.keys(camButtons).forEach(key => {
    const btn = camButtons[key];
    if (btn) {
        btn.onclick = () => setCameraMode(key);
    }
});

// Control Fusionado de Fases Lunares
function setPhaseByDegrees(deg, autoPause = true) {
    const rad = (deg * Math.PI) / 180.0;
    timeController.fastForwardToPhase(rad, autoPause);
}

document.querySelectorAll('.phase-tick-btn').forEach(btn => {
    btn.onclick = () => {
        const deg = parseFloat(btn.getAttribute('data-deg'));
        setPhaseByDegrees(deg, true);
    };
});

if (lunarDialSlider) {
    lunarDialSlider.oninput = (e) => {
        const deg = parseFloat(e.target.value);
        const targetRad = (deg * Math.PI) / 180.0;
        const currentCycles = Math.floor((timeController.synodicSpeed * timeController.time) / TWO_PI);
        const exactTime = ((currentCycles * TWO_PI) + targetRad + Math.PI) / timeController.synodicSpeed;

        timeController.time = exactTime;
        timeController.isPaused = true;
        updatePlayPauseUI(true);
        updateTelemetryThrottled(exactTime, true);
    };
}

// Capas Físicas (Checkboxes Cuadrados Finos)
const switchStars = document.getElementById('switch-stars');
const switchMagnet = document.getElementById('switch-magnet');
const switchWind = document.getElementById('switch-wind');
const switchOrbits = document.getElementById('switch-orbits');

function syncLayerState(key, isVisible) {
    try { localStorage.setItem(`astro_layer_${key}`, isVisible ? '1' : '0'); } catch (_) {}
}

if (switchStars) {
    switchStars.onchange = (e) => {
        simulation.toggleStars();
        syncLayerState('stars', e.target.checked);
    };
}

if (switchMagnet) {
    switchMagnet.onchange = (e) => {
        magnetosphere.toggleGeomagneticField();
        syncLayerState('magnet', e.target.checked);
    };
}

if (switchWind) {
    switchWind.onchange = (e) => {
        magnetosphere.toggleSolarWind();
        syncLayerState('wind', e.target.checked);
    };
}

if (switchOrbits) {
    let orbitsVisible = true;
    switchOrbits.onchange = (e) => {
        orbitsVisible = e.target.checked;
        earth.orbitLine.visible = orbitsVisible;
        moon.orbitLine.visible = orbitsVisible;
        syncLayerState('orbits', orbitsVisible);
    };
}

const switchElongation = document.getElementById('switch-elongation');

if (switchElongation) {
    switchElongation.onchange = (e) => {
        elongationLine.visible = e.target.checked;
        syncLayerState('elongation', e.target.checked);
    };
}

// Cargar estado inicial persistente desde localStorage
try {
    const savedCam = localStorage.getItem('astro_cam_mode');
    if (savedCam && camButtons[savedCam]) {
        setCameraMode(savedCam, false);
    }

    // Arranque por defecto siempre en 1x (a menos que el usuario tenga preferencia expresa guardada)
    const savedSpeed = localStorage.getItem('astro_speed_exp');
    const initialSpeedExp = savedSpeed !== null ? parseFloat(savedSpeed) : 0;
    if (speedSlider) speedSlider.value = initialSpeedExp.toString();
    applySpeedExponent(initialSpeedExp, false);

    if (localStorage.getItem('astro_layer_stars') === '0' && switchStars) {
        switchStars.checked = false;
        simulation.toggleStars();
    }
    if (localStorage.getItem('astro_layer_magnet') === '0' && switchMagnet) {
        switchMagnet.checked = false;
        magnetosphere.toggleGeomagneticField();
    }
    if (localStorage.getItem('astro_layer_wind') === '0' && switchWind) {
        switchWind.checked = false;
        magnetosphere.toggleSolarWind();
    }
    if (localStorage.getItem('astro_layer_orbits') === '0' && switchOrbits) {
        switchOrbits.checked = false;
        earth.orbitLine.visible = false;
        moon.orbitLine.visible = false;
    }
    if (localStorage.getItem('astro_layer_elongation') === '0' && switchElongation) {
        switchElongation.checked = false;
        elongationLine.visible = false;
    }
} catch (_) {}

// ============================================================================
// 10. Modal de Documentación, Conceptos y Modelos (Activado por botón '?' flotante)
// ============================================================================
const btnOpenHelp = document.getElementById('btn-open-help');
const modalGlossary = document.getElementById('modal-glossary');
const btnCloseModal = document.getElementById('btn-close-modal');

function openHelpModal() {
    if (modalGlossary) modalGlossary.classList.remove('hidden');
}

function closeHelpModal() {
    if (modalGlossary) modalGlossary.classList.add('hidden');
}

if (btnOpenHelp) btnOpenHelp.onclick = openHelpModal;
if (btnCloseModal) btnCloseModal.onclick = closeHelpModal;

if (modalGlossary) {
    modalGlossary.onclick = (e) => {
        if (e.target === modalGlossary) closeHelpModal();
    };
}

// Navegación interactiva por pestañas del modal (Atajos, Conceptos Básicos, Modelos)
const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
const tabPanes = {
    'tab-shortcuts': document.getElementById('tab-shortcuts'),
    'tab-definitions': document.getElementById('tab-definitions'),
    'tab-models': document.getElementById('tab-models')
};

modalTabBtns.forEach(btn => {
    btn.onclick = () => {
        const targetTabId = btn.getAttribute('data-tab');

        modalTabBtns.forEach(b => {
            const isActive = (b === btn);
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        Object.keys(tabPanes).forEach(id => {
            const pane = tabPanes[id];
            if (pane) {
                if (id === targetTabId) {
                    pane.classList.remove('hidden');
                    pane.classList.add('active');
                } else {
                    pane.classList.add('hidden');
                    pane.classList.remove('active');
                }
            }
        });
    };
});

// ============================================================================
// 11. Manejo Global de Atajos de Teclado del Operador
// ============================================================================
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;

    const key = e.key.toLowerCase();

    // Espacio: Play / Pause
    if (e.code === 'Space') {
        e.preventDefault();
        const isPaused = timeController.togglePause();
        updatePlayPauseUI(isPaused);
        return;
    }

    // P: Toggle Panel Lateral
    if (key === 'p') {
        e.preventDefault();
        toggleSidebar();
        return;
    }

    // Flechas: Paso atrás / adelante
    if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stepSimulation(-Math.PI / 16);
        return;
    }
    if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepSimulation(Math.PI / 16);
        return;
    }

    // Marcos de referencia 1-4
    if (e.key === '1') setCameraMode('global');
    if (e.key === '2') setCameraMode('sun');
    if (e.key === '3') setCameraMode('earth');
    if (e.key === '4') setCameraMode('moon');

    // Capas de simulación: M, V, O, E, R
    if (key === 'm' && switchMagnet) {
        switchMagnet.checked = !switchMagnet.checked;
        switchMagnet.dispatchEvent(new Event('change'));
    }
    if (key === 'v' && switchWind) {
        switchWind.checked = !switchWind.checked;
        switchWind.dispatchEvent(new Event('change'));
    }
    if (key === 'o' && switchOrbits) {
        switchOrbits.checked = !switchOrbits.checked;
        switchOrbits.dispatchEvent(new Event('change'));
    }
    if (key === 'e' && switchStars) {
        switchStars.checked = !switchStars.checked;
        switchStars.dispatchEvent(new Event('change'));
    }
    if (key === 'l' && switchElongation) {
        switchElongation.checked = !switchElongation.checked;
        switchElongation.dispatchEvent(new Event('change'));
    }
    if (key === 'r' && switchReducedMotion) {
        switchReducedMotion.checked = !switchReducedMotion.checked;
        switchReducedMotion.dispatchEvent(new Event('change'));
    }

    // H o ?: Ayuda técnica y manual
    if (key === 'h' || key === '?') {
        if (modalGlossary) {
            if (modalGlossary.classList.contains('hidden')) {
                openHelpModal();
            } else {
                closeHelpModal();
            }
        }
    }

    // Escape: Cerrar modal
    if (e.key === 'Escape') {
        closeHelpModal();
    }
});
