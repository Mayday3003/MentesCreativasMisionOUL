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

        // Controles de Órbita
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 1500;

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

        // Puntos de seguimiento de cámara
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.desiredCameraPos = null;
        this.isTransitioningCamera = false;
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

    setCameraView(targetPos, cameraPos) {
        this.cameraTarget.copy(targetPos);
        if (cameraPos) {
            this.desiredCameraPos = cameraPos.clone();
            this.isTransitioningCamera = true;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    update() {
        // Suavizado de la posición deseada de la cámara
        if (this.isTransitioningCamera && this.desiredCameraPos) {
            this.camera.position.lerp(this.desiredCameraPos, 0.05);
            if (this.camera.position.distanceTo(this.desiredCameraPos) < 0.2) {
                this.isTransitioningCamera = false;
            }
        }

        // Suavizado del punto objetivo (LookAt)
        this.controls.target.lerp(this.cameraTarget, 0.08);
        this.controls.update();

        this.renderer.render(this.scene, this.camera);
    }
}
