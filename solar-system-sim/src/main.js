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

// 4. Modos de Cámara Dinámica
// 'global' | 'sun' | 'earth' | 'moon'
let cameraMode = 'global';
let cameraRelativeOffset = new THREE.Vector3(0, 60, 140);

const camButtons = {
    'global': document.getElementById('btn-cam-global'),
    'sun': document.getElementById('btn-cam-sun'),
    'earth': document.getElementById('btn-cam-earth'),
    'moon': document.getElementById('btn-cam-moon')
};

function setCameraMode(mode) {
    cameraMode = mode;
    simulation.isTransitioningCamera = true;

    // Actualizar estilos activos de botones
    Object.keys(camButtons).forEach(k => {
        if (camButtons[k]) camButtons[k].classList.toggle('active', k === mode);
    });

    if (mode === 'global') {
        simulation.desiredCameraPos = new THREE.Vector3(0, 70, 145);
        simulation.cameraTarget.set(20, 0, 0);
    } else if (mode === 'sun') {
        // En el Sol mirando hacia la Tierra y la Luna
        cameraRelativeOffset.set(0, 4, 15);
    } else if (mode === 'earth') {
        // En la Tierra mirando hacia el espacio/Luna
        cameraRelativeOffset.set(0, 6, 12);
    } else if (mode === 'moon') {
        // En la Luna mirando hacia la Tierra y el Sol
        cameraRelativeOffset.set(0, 2.5, 4.5);
    }
}

// 5. Bucle de Simulación y Renderizado
simulation.renderer.setAnimationLoop(() => {
    // Actualizar tiempo (avanza o pausa según TimeController)
    const time = timeController.update();

    // Actualizar entidades
    sun.update(time);
    earth.update(time);
    moon.update(time);
    magnetosphere.update(time);

    // Actualizar posición de la cámara según el punto de vista seleccionado
    const earthPos = earth.getPosition();
    const moonPos = moon.getPosition();
    const sunPos = sun.getPosition();

    if (cameraMode === 'sun') {
        simulation.cameraTarget.copy(earthPos);
        const desiredPos = sunPos.clone().add(cameraRelativeOffset);
        if (simulation.isTransitioningCamera) {
            simulation.camera.position.lerp(desiredPos, 0.05);
            if (simulation.camera.position.distanceTo(desiredPos) < 0.2) simulation.isTransitioningCamera = false;
        } else {
            simulation.camera.position.copy(desiredPos);
        }
    } else if (cameraMode === 'earth') {
        simulation.cameraTarget.copy(earthPos);
        const desiredPos = earthPos.clone().add(cameraRelativeOffset);
        if (simulation.isTransitioningCamera) {
            simulation.camera.position.lerp(desiredPos, 0.05);
            if (simulation.camera.position.distanceTo(desiredPos) < 0.2) simulation.isTransitioningCamera = false;
        } else {
            simulation.camera.position.copy(desiredPos);
        }
    } else if (cameraMode === 'moon') {
        simulation.cameraTarget.copy(moonPos);
        const desiredPos = moonPos.clone().add(cameraRelativeOffset);
        if (simulation.isTransitioningCamera) {
            simulation.camera.position.lerp(desiredPos, 0.05);
            if (simulation.camera.position.distanceTo(desiredPos) < 0.2) simulation.isTransitioningCamera = false;
        } else {
            simulation.camera.position.copy(desiredPos);
        }
    } else {
        simulation.cameraTarget.lerp(new THREE.Vector3(20, 0, 0), 0.04);
    }

    // Renderizado y controles
    simulation.update();
});

// ==========================================
// 6. Controles e Interfaz de Usuario (UI)
// ==========================================

// Ocultar / Mostrar Barra Lateral
const sidebarPanel = document.getElementById('sidebar-panel');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const navToggleText = document.getElementById('nav-toggle-text');

if (btnToggleSidebar && sidebarPanel) {
    let sidebarOpen = true;
    btnToggleSidebar.onclick = () => {
        sidebarOpen = !sidebarOpen;
        sidebarPanel.classList.toggle('collapsed', !sidebarOpen);
        if (navToggleText) {
            navToggleText.innerText = sidebarOpen ? "Ocultar Panel" : "Mostrar Panel";
        }
    };
}

// Control Temporal: Pausar / Reanudar
const btnPlayPause = document.getElementById('btn-play-pause');

function updatePlayPauseUI(isPaused) {
    if (!btnPlayPause) return;
    btnPlayPause.innerText = isPaused ? "Reanudar" : "Pausar";
    btnPlayPause.classList.toggle('paused', isPaused);
}

if (btnPlayPause) {
    btnPlayPause.onclick = () => {
        const isPaused = timeController.togglePause();
        updatePlayPauseUI(isPaused);
    };
}

// Callback de TimeController para pausar automáticamente al llegar a una fase
timeController.onPauseChanged = (isPaused) => {
    updatePlayPauseUI(isPaused);
};

// Control de Velocidad: Slider y Reiniciar
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

// Selección de Cámaras
document.getElementById('btn-cam-global').onclick = () => setCameraMode('global');
document.getElementById('btn-cam-sun').onclick = () => setCameraMode('sun');
document.getElementById('btn-cam-earth').onclick = () => setCameraMode('earth');
document.getElementById('btn-cam-moon').onclick = () => setCameraMode('moon');

// Fases Lunares (Aceleración y Pausa Automática al llegar a la fase)
const phaseButtons = [
    document.getElementById('btn-phase-new'),
    document.getElementById('btn-phase-first'),
    document.getElementById('btn-phase-full'),
    document.getElementById('btn-phase-third')
];

function activatePhase(btn, angle) {
    phaseButtons.forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // Viajar rápido hasta la posición geométrica y parar automáticamente
    timeController.fastForwardToPhase(angle, true);
}

document.getElementById('btn-phase-new').onclick = (e) => activatePhase(e.target, Math.PI);
document.getElementById('btn-phase-first').onclick = (e) => activatePhase(e.target, Math.PI * 1.5);
document.getElementById('btn-phase-full').onclick = (e) => activatePhase(e.target, 0);
document.getElementById('btn-phase-third').onclick = (e) => activatePhase(e.target, Math.PI * 0.5);

// Alternar Estrellas
const btnToggleStars = document.getElementById('btn-toggle-stars');
btnToggleStars.onclick = () => {
    const isVisible = simulation.toggleStars();
    btnToggleStars.innerText = isVisible ? "Ocultar Estrellas" : "Mostrar Estrellas";
    btnToggleStars.classList.toggle('active', !isVisible);
};

// Alternar Campo Geomagnético de la Tierra (independiente del viento solar)
const btnToggleMagnet = document.getElementById('btn-toggle-magnet');
btnToggleMagnet.onclick = () => {
    const isVisible = magnetosphere.toggleGeomagneticField();
    btnToggleMagnet.innerText = isVisible ? "Ocultar Campo Geomagnético" : "Mostrar Campo Geomagnético";
    btnToggleMagnet.classList.toggle('active', !isVisible);
};

// Alternar Viento Solar y Radiación (sin borrar las líneas del campo magnético terrestre)
const btnToggleWind = document.getElementById('btn-toggle-wind');
if (btnToggleWind) {
    btnToggleWind.onclick = () => {
        const isVisible = magnetosphere.toggleSolarWind();
        btnToggleWind.innerText = isVisible ? "Ocultar Viento Solar" : "Mostrar Viento Solar";
        btnToggleWind.classList.toggle('active', !isVisible);
    };
}

// Alternar Órbitas
const btnToggleOrbits = document.getElementById('btn-toggle-orbits');
if (btnToggleOrbits) {
    let orbitsVisible = true;
    btnToggleOrbits.onclick = () => {
        orbitsVisible = !orbitsVisible;
        earth.orbitLine.visible = orbitsVisible;
        moon.orbitLine.visible = orbitsVisible;
        btnToggleOrbits.innerText = orbitsVisible ? "Ocultar Órbitas" : "Mostrar Órbitas";
        btnToggleOrbits.classList.toggle('active', !orbitsVisible);
    };
}
