import { UI } from './ui.js';
import { PyodideService } from './pyodideService.js';
import { ThreeJSVisualizer } from './threeJSVisualizer.js';
import { ParameterManager } from './parameterManager.js';

const SIM_DT = 0.02;

export const App = {
    isSimRunning: false,
    currentSimConfig: null,
    currentPythonSimState: null,
    animationFrameId: null,
    lastSimStepTime: 0,

    async handleSimulatorSelection(simConfig) {
        console.log(`[App] Selecting sim - ${simConfig.name}`);
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.isSimRunning = false;
        this.currentPythonSimState = null;
        this.currentSimConfig = simConfig;

        UI.updateSimulatorSelectionDisplay(simConfig.name);
        UI.showSimulationView();
        UI.populateControls(simConfig, this.handleActionTrigger.bind(this), this.handleControlUpdate.bind(this));
        UI.populateTelemetry(simConfig);

        if (simConfig.visualizerModuleURL) {
            await ThreeJSVisualizer.init(UI.DOMElements.simulationCanvas, simConfig.visualizerModuleURL);
        } else {
            ThreeJSVisualizer.dispose();
            console.error('[App] No visualizer module specified for this simulator.');
            UI.displayError('No visualizer module specified for this simulator.');
        }

        if (simConfig.type === 'pyodide') {
            if (!simConfig.pythonScriptURL) {
                console.error('[App] Pyodide sim config missing pythonScriptURL');
                UI.displayError('Pyodide sim config missing pythonScriptURL');
                return;
            }

            UI.showLoadingOverlay(`Loading ${simConfig.name}...`);
            const pyodideReady = await PyodideService.init(simConfig.pythonScriptURL);
            UI.hideLoadingOverlay();

            if (!pyodideReady) {
                console.error('[App] Failed to init Pyodide for ' + simConfig.name);
                UI.displayError('Failed to init Pyodide for ' + simConfig.name);
                UI.updateEngineStatus('ERROR', 'red', 'status-offline');
                return;
            }

            console.log(`[App] Initializing Python sim module for ${simConfig.name}...`);
            const setupResult = PyodideService.callPython('setup_simulation', [simConfig.initialState || {}]);
            console.log(`[App] Python setup_simulation result: ${setupResult}`);
            ParameterManager.initializeParametersFromConfig(simConfig);
            Object.entries(ParameterManager.currentParameters).forEach(([k, v]) => {
                PyodideService.callPython('set_simulation_parameter', [k, v]);
            });
            this.isSimRunning = true;
            this.lastSimStepTime = performance.now();
            UI.updateEngineStatus('READY', 'green', 'status-online');
            UI.clearErrorDisplay();
            this.runClientSideSimulationLoop();
        } else {
            console.error('[App] Unknown simulator type:', simConfig.type);
            UI.displayError('Unknown simulator type: ' + simConfig.type);
            UI.updateEngineStatus('TYPE_UNKNOWN', 'red', 'status-offline');
        }
    },

    runClientSideSimulationLoop() {
        if (!this.isSimRunning || !this.currentSimConfig || this.currentSimConfig.type !== 'pyodide') {
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            return;
        }
        const currentTime = performance.now();
        const pythonResult = PyodideService.callPython('update_simulation_step', [SIM_DT, {}]);
        if (pythonResult) {
            this.currentPythonSimState = pythonResult;
            this.handlePythonSimState(pythonResult);
        }
        const stepTimeMs = performance.now() - currentTime;
        UI.updateTelemetryDisplay(this.currentSimConfig.id, { 'Sim Step Time (ms)': stepTimeMs.toFixed(1) });
        this.animationFrameId = requestAnimationFrame(this.runClientSideSimulationLoop.bind(this));
    },

    handlePythonSimState(state) {
        if (!state || !this.currentSimConfig) return;
        ThreeJSVisualizer.updateState(state);
        UI.updateTelemetryDisplay(this.currentSimConfig.id, state);
    },

    handleControlUpdate(simId, controlId, value, pyParameterName) {
        console.log(`[App] Control update - Sim: ${simId}, Control: ${controlId}, Value: ${value}, PyParam: ${pyParameterName}`);
        if (this.currentSimConfig && this.currentSimConfig.id === simId && this.currentSimConfig.type === 'pyodide') {
            if (pyParameterName) {
                PyodideService.callPython('set_simulation_parameter', [pyParameterName, value]);
                ParameterManager.currentParameters[pyParameterName] = value;
            } else {
                console.error(`[App] Control '${controlId}' for sim '${simId}' is missing pyParameterName`);
                UI.displayError(`Control '${controlId}' missing pyParameterName`);
            }
        }
    },

    handleActionTrigger(simId, actionId, pyActionId, pyActionParams) {
        console.log(`[App] Action trigger - Sim: ${simId}, Action: ${actionId}, PyAction: ${pyActionId}`);
        if (actionId === 'stop_sim') {
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            this.isSimRunning = false;
            UI.updateEngineStatus('STOPPED', 'red', 'status-offline');
            console.log('[App] Simulation stopped.');
            return;
        }
        if (this.currentSimConfig && this.currentSimConfig.id === simId && this.currentSimConfig.type === 'pyodide') {
            if (pyActionId) {
                PyodideService.callPython('handle_action_command', [pyActionId, pyActionParams || {}]);
                if (pyActionId.toLowerCase().includes('reset')) {
                    UI.updateEngineStatus('READY', 'green', 'status-online');
                    PyodideService.callPython('setup_simulation', [this.currentSimConfig.initialState || {}]);
                    ParameterManager.initializeParametersFromConfig(this.currentSimConfig);
                    Object.entries(ParameterManager.currentParameters).forEach(([k, v]) => {
                        PyodideService.callPython('set_simulation_parameter', [k, v]);
                    });
                    if (!this.isSimRunning) {
                        this.isSimRunning = true;
                        this.lastSimStepTime = performance.now();
                        this.runClientSideSimulationLoop();
                    }
                }
            } else {
                console.error(`[App] Action '${actionId}' for sim '${simId}' is missing pyActionId`);
                UI.displayError(`Action '${actionId}' missing pyActionId`);
            }
        }
    }
};