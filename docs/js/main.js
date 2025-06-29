import { UI } from './ui.js';
import { App } from './app.js';
import { ParameterManager } from './parameterManager.js';
import { SIMULATORS_CONFIG } from './simulatorsConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Main] Initializing application...');
    UI.init();
    ParameterManager.init(); // Initialize ParameterManager to attach event listeners
    UI.populateSimulatorList(SIMULATORS_CONFIG, App.handleSimulatorSelection.bind(App));
    UI.updateEngineStatus('AWAITING SELECTION', 'yellow', 'status-standby');
});