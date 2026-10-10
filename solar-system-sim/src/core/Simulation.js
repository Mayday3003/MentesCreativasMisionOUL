import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Simulation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = new THREE.Scene();
        this.entities = [];
        
        // Renderer WebGL con tone mapping fílmico
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Cámara Principal
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.camera.position.set(0, 60, 140);

        // Controles de Órbita Libres e Interactivos con mayor amortiguamiento (damping suave)
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.12;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 1500;
        this.controls.screenSpacePanning = true;

        // Luz Ambiental para iluminar suavemente la cara nocturna
        this.ambientLight = new THREE.AmbientLight(0x223344, 0.8);
        this.scene.add(this.ambientLight);

        // Fondo Espacial con Nebulosa / Estrellas (CubeTexture)
        const cubeLoader = new THREE.CubeTextureLoader();
        this.starrySkybox = cubeLoader.load([
            'assets/3.jpg',
            'assets/1.jpg',
            'assets/2.jpg',
            'assets/2.jpg',
            'assets/4.jpg',
            'assets/2.jpg'
        ]);
        this.scene.background = this.starrySkybox;
        this.starsVisible = true;

        // Manejo de Redimensión
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Objeto actual de seguimiento dinámico (ej. Earth, Sun, Moon o null)
        this.trackedEntity = null;
        this.prevTargetPos = new THREE.Vector3(0, 0, 0);

        // Animación suave de transición al cambiar de perspectiva
        this.isTransitioningCamera = false;
        this.transitionProgress = 0;
        this.transitionDuration = 0.8; // segundos
        this.transitionStartCam = new THREE.Vector3();
        this.transitionTargetCam = new THREE.Vector3();
        this.transitionStartLook = new THREE.Vector3();
        this.transitionTargetLook = new THREE.Vector3();
    }

    addEntity(entity) {
        this.entities.push(entity);
        const root = entity.container || entity.group || entity.mesh;
        if (root && root.parent !== this.scene) {
            this.scene.add(root);
        }
    }

    toggleStars() {
        this.starsVisible = !this.starsVisible;
        this.scene.background = this.starsVisible ? this.starrySkybox : new THREE.Color(0x000005);
        return this.starsVisible;
    }

    /**
     * Cambia el objetivo orbital de la cámara hacia una entidad o punto global,
     * permitiendo que el usuario siga orbitando, haciendo zoom y paneando libremente.
     * @param {Object|null} entity Objeto con getPosition() o null para vista libre
     * @param {THREE.Vector3} relativeOffset Posición relativa de la cámara respecto al objeto
     */
    focusOnEntity(entity, relativeOffset) {
        const targetWorldPos = entity ? entity.getPosition() : new THREE.Vector3(20, 0, 0);
        const desiredCamPos = entity 
            ? targetWorldPos.clone().add(relativeOffset) 
            : new THREE.Vector3(0, 70, 145);

        this.trackedEntity = entity;
        this.prevTargetPos.copy(targetWorldPos);

        // Iniciar transición suave
        this.isTransitioningCamera = true;
        this.transitionProgress = 0;
        this.transitionStartCam.copy(this.camera.position);
        this.transitionTargetCam.copy(desiredCamPos);
        this.transitionStartLook.copy(this.controls.target);
        this.transitionTargetLook.copy(targetWorldPos);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    update(delta = 0.016) {
        if (this.isTransitioningCamera) {
            this.transitionProgress += delta / this.transitionDuration;
            const t = Math.min(1.0, this.transitionProgress);
            // Curva easeInOutCubic
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            this.camera.position.lerpVectors(this.transitionStartCam, this.transitionTargetCam, ease);
            this.controls.target.lerpVectors(this.transitionStartLook, this.transitionTargetLook, ease);

            if (t >= 1.0) {
                this.isTransitioningCamera = false;
                if (this.trackedEntity) {
                    this.prevTargetPos.copy(this.trackedEntity.getPosition());
                }
            }
        } else if (this.trackedEntity) {
            // El usuario tiene control manual total de órbita y zoom.
            // Si el planeta se mueve en su órbita, trasladamos la cámara y el target
            // manteniendo exactamente el ángulo y distancia relativa que el usuario haya fijado con el ratón.
            const currentPos = this.trackedEntity.getPosition();
            const deltaPos = currentPos.clone().sub(this.prevTargetPos);

            if (deltaPos.lengthSq() > 0.000001) {
                this.controls.target.add(deltaPos);
                this.camera.position.add(deltaPos);
                this.prevTargetPos.copy(currentPos);
            }
        }

        // Siempre actualizar OrbitControls para permitir interacción libre continua
        this.controls.update();

        this.renderer.render(this.scene, this.camera);
    }
}
