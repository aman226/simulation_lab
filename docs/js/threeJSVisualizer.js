export const ThreeJSVisualizer = {
    isInitialized: false,
    visualizerModule: null,
    currentModuleURL: null,

    async init(canvas, moduleURL) {
        if (this.isInitialized && this.currentModuleURL === moduleURL) return;

        if (this.isInitialized) this.dispose();

        try {
            const module = await import(moduleURL);
            this.visualizerModule = module.Visualizer;
            await this.visualizerModule.init(canvas);
            this.currentModuleURL = moduleURL;
            this.isInitialized = true;
            console.log('[ThreeJSVisualizer] Initialized from', moduleURL);
        } catch (e) {
            console.error('[ThreeJSVisualizer] Initialization failed:', e);
        }
    },

    updateState(state) {
        if (this.isInitialized && this.visualizerModule && this.visualizerModule.updateState) {
            this.visualizerModule.updateState(state);
        }
    },

    dispose() {
        if (this.isInitialized && this.visualizerModule && this.visualizerModule.dispose) {
            this.visualizerModule.dispose();
        }
        this.isInitialized = false;
        this.visualizerModule = null;
        this.currentModuleURL = null;
    }
};