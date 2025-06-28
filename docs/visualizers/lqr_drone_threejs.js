export const LQRDroneVisualizer = {
    isInitialized: false,
    scene: null,
    camera: null,
    renderer: null,
    drone: null,
    light: null,

    init: function(canvas) {
        if (this.isInitialized) return;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0f1a);

        this.camera = new THREE.PerspectiveCamera(
            70,
            canvas.clientWidth / canvas.clientHeight,
            0.01,
            100
        );

        // Position the camera in the NWU direction to view the NED frame clearly
        this.camera.position.set(-2, -2, 2); // Behind and above
        this.camera.up.set(0, 0, -1);        // Flip "up" to match NED (Z down)
        this.camera.lookAt(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);

        this.scene.add(ambientLight, directionalLight);

        // ✅ Add drone body
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const material = new THREE.MeshStandardMaterial({ color: 0x00beff });
        this.drone = new THREE.Mesh(geometry, material);
        this.scene.add(this.drone);

        // ✅ Add inertial axes (RGB = XYZ)
        const axesHelper = new THREE.AxesHelper(6.0); // size = 1 meter
        this.scene.add(axesHelper);

        this.isInitialized = true;
        this.render();
    },


    updateDroneState: function(state) {
        if (!this.isInitialized) return;
        if (!state.position || !state.quaternion) return;

        this.drone.position.set(...state.position);

        const q = state.quaternion;
        this.drone.quaternion.set(q[1], q[2], q[3], q[0]);  // Note: THREE uses (x, y, z, w)
    },

    dispose: function() {
        if (!this.isInitialized) return;
        this.renderer.dispose();
        this.isInitialized = false;
    },

    render: function() {
        if (!this.isInitialized) return;
        requestAnimationFrame(() => this.render());
        this.renderer.render(this.scene, this.camera);
    }
};
