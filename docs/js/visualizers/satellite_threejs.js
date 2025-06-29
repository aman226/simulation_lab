import { UI } from '../js/ui.js';

export const Visualizer = {
  isInitialized: false,
  scene: null,
  camera: null,
  renderer: null,
  satelliteModel: null,
  earthModel: null,
  trailGeometry: null,
  trailMaterial: null,
  controls: null,
  trailPoints: [],
  maxTrailLength: 3000,
  loader: new THREE.GLTFLoader(),

  init: async function(canvas) {
    if (this.isInitialized) {
      console.log('[Visualizer] Already initialized');
      return;
    }

    console.log('[Visualizer] Initializing Three.js scene for LEO Satellite...');
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 1e5, 1e9);
    this.camera.position.set(0, 0, 2e7);
    this.camera.up.set(0, 0, -1); // Flip "up" to match NED (Z down)
    this.camera.lookAt(0, 0, 0);

    // Load space skybox
    try {
      this.scene.background = new THREE.CubeTextureLoader().load([
        './skybox/space/bkg1_right1.png',  // px
        './skybox/space/bkg1_left2.png',   // nx
        './skybox/space/bkg1_top3.png',    // py
        './skybox/space/bkg1_bottom4.png', // ny
        './skybox/space/bkg1_front5.png',  // pz
        './skybox/space/bkg1_back6.png'    // nz
      ]);
    } catch (e) {
      console.error('[Visualizer] Failed to load skybox:', e);
      UI.displayError('Failed to load skybox textures');
    }

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.5;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // Lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, -1, -1).normalize();
    this.scene.add(directionalLight);
    this.scene.add(new THREE.AmbientLight(0x404040));

    // Load Earth
    try {
      await new Promise((resolve, reject) => {
        this.loader.load('./models/Earth_1_12756.glb', (gltf) => {
          this.earthModel = gltf.scene;
          this.earthModel.scale.setScalar(12742); // Earth radius ~6371 km
          this.earthModel.rotation.x = -Math.PI / 2; // Align with NED
          this.scene.add(this.earthModel);
          console.log('[Visualizer] Earth model loaded');
          resolve();
        }, undefined, (error) => {
          console.error('[Visualizer] Failed to load Earth model:', error);
          UI.displayError('Failed to load Earth model');
          reject(error);
        });
      });
    } catch (e) {
      console.error('[Visualizer] Earth model loading error:', e);
      UI.displayError('Earth model loading failed');
    }

    // Load Satellite
    try {
      await new Promise((resolve, reject) => {
        this.loader.load('./models/AcrimSAT.glb', (gltf) => {
          this.satelliteModel = gltf.scene;
          this.satelliteModel.scale.setScalar(30000); // Adjust scale for visibility
          this.scene.add(this.satelliteModel);
          console.log('[Visualizer] Satellite model loaded');
          resolve();
        }, undefined, (error) => {
          console.error('[Visualizer] Failed to load satellite model:', error);
          UI.displayError('Failed to load satellite model');
          reject(error);
        });
      });
    } catch (e) {
      console.error('[Visualizer] Satellite model loading error:', e);
      UI.displayError('Satellite model loading failed');
    }

    const axesHelper = new THREE.AxesHelper(2e7);
    this.scene.add(axesHelper);

    // Orbit trail
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const trailLine = new THREE.Line(this.trailGeometry, this.trailMaterial);
    this.scene.add(trailLine);
    this.isInitialized = true;

    window.addEventListener('resize', () => {
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      this.camera.updateProjectionMatrix();
    });

    this.render();
  },

  updateState: function(state) {
    if (!this.isInitialized) {
      console.warn('[Visualizer] Not initialized, cannot update state');
      return;
    }
    if (!state.position || !state.quaternion || !this.satelliteModel) {
      console.warn('[Visualizer] Invalid state or missing satellite model:', state);
      return;
    }

    console.log('[Visualizer] Updating state for LEO Satellite:', state);
    const pos = state.position;
    const quat = state.quaternion;

    // Update satellite position (NED: x=north, y=east, z=down)
    this.satelliteModel.position.set(pos[0], pos[1], pos[2]);

    // Update satellite orientation (quaternion in [w, x, y, z])
    const q = new THREE.Quaternion(quat[1], quat[2], quat[3], quat[0]); // [x, y, z, w]
    this.satelliteModel.quaternion.copy(q);

    // Update orbital trail
    this.trailPoints.push(new THREE.Vector3(pos[0], pos[1], pos[2]));
    if (this.trailPoints.length > this.maxTrailLength) {
      this.trailPoints.shift();
    }
    this.trailGeometry.setFromPoints(this.trailPoints);
  },

  render: function() {
    if (!this.isInitialized) return;
    requestAnimationFrame(() => this.render());

    // Rotate Earth based on sidereal day
    const now = Date.now() / 1000; // Unix timestamp in seconds
    const siderealDay = 86164; // seconds
    const angularVelocity = (2 * Math.PI) / siderealDay; // radians/sec
    const earthAngle = angularVelocity * now;

    if (this.earthModel) {
      this.earthModel.rotation.y = earthAngle % (2 * Math.PI);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  },

  dispose: function() {
    if (!this.isInitialized) return;
    console.log('[Visualizer] Disposing Three.js resources for LEO Satellite...');
    this.renderer?.dispose();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.satelliteModel = null;
    this.earthModel = null;
    this.trailGeometry = null;
    this.trailPoints = [];
    this.isInitialized = false;
  }
};