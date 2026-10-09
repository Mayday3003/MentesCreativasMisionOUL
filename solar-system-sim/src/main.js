import * as THREE from 'three';
import { Simulation } from './core/Simulation.js';
import { TimeController } from './core/TimeController.js';
import { Sun } from './entities/Sun.js';
import { Earth } from './entities/Earth.js';
import { Moon } from './entities/Moon.js';
import { Magnetosphere } from './entities/Magnetosphere.js';

// 1. Instanciación del Motor
const simulation = new Simulation('webgl-canvas');
const timeController = new TimeController();

// 2. Creación de Entidades Físicas
const sun = new Sun(12);
const earth = new Earth(3.5, 65, 0.5);
const moon = new Moon(earth, 0.95, 10.0, 6.5);
const magnetosphere = new Magnetosphere(earth);

// 3. Registro en la Escena
simulation.addEntity(sun);
simulation.addEntity(earth);
simulation.addEntity(moon);
simulation.addEntity(magnetosphere);

// 4. Modos de Cámara Dinámica (Perspectivas de Referencia Científicas)
// 'global' (Libre) | 'sun' (Heliocéntrica) | 'earth' (Geocéntrica) | 'moon' (Selenocéntrica)
let cameraMode = 'global';

const camButtons = {
    'global': document.getElementById('btn-cam-global'),
    'sun': document.getElementById('btn-cam-sun'),
    'earth': document.getElementById('btn-cam-earth'),
    'moon': document.getElementById('btn-cam-moon')
};

function setCameraMode(mode) {
    cameraMode = mode;

    // Actualizar control segmentado UI
    Object.keys(camButtons).forEach(k => {
        if (camButtons[k]) camButtons[k].classList.toggle('active', k === mode);
    });

    if (mode === 'global') {
        // Vista Libre / Sistema: vista general sin anclaje a un planeta móvil
        simulation.focusOnEntity(null, new THREE.Vector3(0, 70, 145));
    } else if (mode === 'sun') {
        // Vista Heliocéntrica: enfoca el Sol a una distancia cómoda permitiendo rotar libremente
        simulation.focusOnEntity(sun, new THREE.Vector3(0, 15, 36));
    } else if (mode === 'earth') {
        // Vista Geocéntrica: enfoca el centro de la Tierra a una distancia adecuada
        // El usuario puede orbitar, hacer zoom y paneo libremente alrededor de la Tierra
        simulation.focusOnEntity(earth, new THREE.Vector3(0, 6, 15));
    } else if (mode === 'moon') {
        // Vista Selenocéntrica: enfoca el centro de la Luna permitiendo órbita libre
        simulation.focusOnEntity(moon, new THREE.Vector3(0, 2.5, 5));
    }
}

// 5. Bucle de Simulación y Renderizado
simulation.renderer.setAnimationLoop(() => {
    // Actualizar tiempo orbital (con soporte para pausa y velocidad gradual)
    const time = timeController.update();

    // Actualizar entidades físicas
    sun.update(time);
    earth.update(time);
    moon.update(time);
    magnetosphere.update(time);

    // Actualizar motor de renderizado y OrbitControls interactivos
    simulation.update(0.016);
});

// ==========================================
// 6. Controles e Interfaz de Usuario (UI)
// ==========================================

// Ocultar / Mostrar Barra Lateral con Botón Minimalista (Chevron)
const sidebarPanel = document.getElementById('sidebar-panel');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');

if (btnToggleSidebar && sidebarPanel) {
    let sidebarOpen = true;
    btnToggleSidebar.onclick = () => {
        sidebarOpen = !sidebarOpen;
        sidebarPanel.classList.toggle('collapsed', !sidebarOpen);
        btnToggleSidebar.classList.toggle('collapsed', !sidebarOpen);
    };
}

// Control Temporal en Barra Inferior: Botón de Play / Pause
const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

function updatePlayPauseUI(isPaused) {
    if (!btnPlayPause || !iconPlay || !iconPause) return;
    if (isPaused) {
        iconPlay.classList.remove('hidden');
        iconPause.classList.add('hidden');
        btnPlayPause.classList.add('paused');
        btnPlayPause.setAttribute('title', 'Reanudar simulación');
    } else {
        iconPlay.classList.add('hidden');
        iconPause.classList.remove('hidden');
        btnPlayPause.classList.remove('paused');
        btnPlayPause.setAttribute('title', 'Pausar simulación');
    }
}

if (btnPlayPause) {
    btnPlayPause.onclick = () => {
        const isPaused = timeController.togglePause();
        updatePlayPauseUI(isPaused);
    };
}

// Sincronización de TimeController (pausa automática al alcanzar una fase)
timeController.onPauseChanged = (isPaused) => {
    updatePlayPauseUI(isPaused);
};

// Control de Velocidad: Slider en Barra Inferior y Botón de Restablecimiento
const speedSlider = document.getElementById('speed-slider');
const speedLabel = document.getElementById('speed-label');
const btnResetSpeed = document.getElementById('btn-reset-speed');

if (speedSlider) {
    speedSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        timeController.setSpeedMultiplier(val);
        if (speedLabel) speedLabel.innerText = val.toFixed(1) + 'x';
    };
}

if (btnResetSpeed) {
    btnResetSpeed.onclick = () => {
        timeController.setSpeedMultiplier(1.0);
        if (speedSlider) speedSlider.value = "1.0";
        if (speedLabel) speedLabel.innerText = "1.0x";
    };
}

// Control Segmentado de Perspectivas de Cámara
document.querySelectorAll('.segmented-btn').forEach(btn => {
    btn.onclick = () => {
        const mode = btn.getAttribute('data-mode');
        setCameraMode(mode);
    };
});

// Fases Lunares (Geometría Astronómica Rigurosa con Pausa Automática)
// Ángulos de fase sinódica respecto al vector Sol-Tierra:
// 1. Luna Nueva: 0 rad (0°) -> Luna exactamente entre la Tierra y el Sol
// 2. Cuarto Creciente: PI/2 rad (90°) -> Cuadratura oriental
// 3. Luna Llena: PI rad (180°) -> Oposición astronómica
// 4. Cuarto Menguante: 3*PI/2 rad (270°) -> Cuadratura occidental
const phaseButtons = {
    'new': document.getElementById('btn-phase-new'),
    'first': document.getElementById('btn-phase-first'),
    'full': document.getElementById('btn-phase-full'),
    'third': document.getElementById('btn-phase-third')
};

function activatePhase(phaseKey, targetPhaseAngle) {
    Object.values(phaseButtons).forEach(b => {
        if (b) b.classList.remove('active');
    });
    if (phaseButtons[phaseKey]) phaseButtons[phaseKey].classList.add('active');

    // Desplazamiento acelerado y parada automática exacta en la posición física de la fase
    timeController.fastForwardToPhase(targetPhaseAngle, true);
}

if (phaseButtons.new) phaseButtons.new.onclick = () => activatePhase('new', 0.0);
if (phaseButtons.first) phaseButtons.first.onclick = () => activatePhase('first', Math.PI * 0.5);
if (phaseButtons.full) phaseButtons.full.onclick = () => activatePhase('full', Math.PI);
if (phaseButtons.third) phaseButtons.third.onclick = () => activatePhase('third', Math.PI * 1.5);

// Capas y Entorno (Toggle Switches Estilo iOS / Material)
// 1. Estrellas de fondo
const switchStars = document.getElementById('switch-stars');
if (switchStars) {
    switchStars.onchange = (e) => {
        simulation.toggleStars();
    };
}

// 2. Campo Magnético
const switchMagnet = document.getElementById('switch-magnet');
if (switchMagnet) {
    switchMagnet.onchange = (e) => {
        magnetosphere.toggleGeomagneticField();
    };
}

// 3. Viento Solar y Radiación
const switchWind = document.getElementById('switch-wind');
if (switchWind) {
    switchWind.onchange = (e) => {
        magnetosphere.toggleSolarWind();
    };
}

// 4. Órbitas
const switchOrbits = document.getElementById('switch-orbits');
if (switchOrbits) {
    let orbitsVisible = true;
    switchOrbits.onchange = (e) => {
        orbitsVisible = e.target.checked;
        earth.orbitLine.visible = orbitsVisible;
        moon.orbitLine.visible = orbitsVisible;
    };
}

// ==========================================
// 7. Modal de Glosario y Ayuda (FAB Button)
// ==========================================
const btnHelpFab = document.getElementById('btn-help-fab');
const modalGlossary = document.getElementById('modal-glossary');
const btnCloseModal = document.getElementById('btn-close-modal');

if (btnHelpFab && modalGlossary) {
    btnHelpFab.onclick = () => {
        modalGlossary.classList.remove('hidden');
    };
}

if (btnCloseModal && modalGlossary) {
    btnCloseModal.onclick = () => {
        modalGlossary.classList.add('hidden');
    };
}

// Cerrar modal al hacer clic en el fondo oscuro
if (modalGlossary) {
    modalGlossary.onclick = (e) => {
        if (e.target === modalGlossary) {
            modalGlossary.classList.add('hidden');
        }
    };
}

// Cerrar modal con la tecla Escape
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalGlossary && !modalGlossary.classList.contains('hidden')) {
        modalGlossary.classList.add('hidden');
    }
});
