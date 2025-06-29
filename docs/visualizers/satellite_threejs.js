// Filename: visualizers/satellite_visualizer.js

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
    if (this.isInitialized) return;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 1e5, 1e9);
    this.camera.position.set(0, 0, 2e7);
    this.camera.up.set(0, 0, -1);        // Flip "up" to match NED (Z down)
    this.camera.lookAt(0, 0, 0);

    // Load space skybox
    this.scene.background = new THREE.CubeTextureLoader().load([
    './skybox/space/bkg1_right1.png',  // px
    './skybox/space/bkg1_left2.png',   // nx
    './skybox/space/bkg1_top3.png',    // py
    './skybox/space/bkg1_bottom4.png', // ny
    './skybox/space/bkg1_front5.png',  // pz
    './skybox/space/bkg1_back6.png'    // nz
    ]);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // this.renderer.outputEncoding = THREE.sRGBEncoding;

    // // Load .hdr file
    // new THREE.RGBELoader()
    //   .load('./skybox/sky/DarkStorm4K.hdr', (texture) => {
    //     texture.mapping = THREE.EquirectangularReflectionMapping;
    //     this.scene.background = texture;
    //     this.scene.environment = texture;
    //   });
    // OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.5;
    this.controls.target.set(0, 0, 0); // optional if your satellite is at origin
    this.controls.update();

    // Lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, -1, -1).normalize();
    this.scene.add(directionalLight);
    this.scene.add(new THREE.AmbientLight(0x404040));

    // Load Earth
    this.loader.load('./models/Earth_1_12756.glb', (gltf) => {
      this.earthModel = gltf.scene;
      this.earthModel.scale.setScalar(12742); // Earth radius ~6371 km
      this.earthModel.rotation.x = -Math.PI / 2;
      this.scene.add(this.earthModel);
    });

    // Load Satellite
    this.loader.load('./models/AcrimSAT.glb', (gltf) => {
      this.satelliteModel = gltf.scene;
      this.satelliteModel.scale.setScalar(30000); // Adjust if your model is small
      this.scene.add(this.satelliteModel);
    });

    const axesHelper = new THREE.AxesHelper(2e7); // size = 1 meter
    this.scene.add(axesHelper);
    // Orbit trail
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const trailLine = new THREE.Line(this.trailGeometry, this.trailMaterial);
    this.scene.add(trailLine);
    this.isInitialized = true;

    window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    });

    this.render();
  },

  updateState: function(state) {
    if (!this.isInitialized) return;
    if (!state.position || !state.quaternion || !this.satelliteModel) return;

    const pos = state.position;
    const quat = state.quaternion;

    // Update satellite position
    this.satelliteModel.position.set(pos[0], pos[1], pos[2]);

    // Update satellite orientation
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
    
    // Get current system time (in seconds)
    const now = Date.now() / 1000; // Unix timestamp in seconds

    // Compute rotation angle since Unix epoch
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
