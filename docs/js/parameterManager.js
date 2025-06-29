import { PyodideService } from './pyodideService.js';
import { UI } from './ui.js';

export const ParameterManager = {
    currentParameters: {},

    initializeParametersFromConfig(simConfig) {
        console.log('[ParameterManager] Initializing parameters from config:', simConfig.parameters);
        this.currentParameters = simConfig.parameters ? { ...simConfig.parameters } : {};
        UI.updateControlValues(this.currentParameters); // Sync controls on init
    },

    showParameterManager() {
        console.log('[ParameterManager] Opening parameter modal');
        const form = document.getElementById('parameterForm');
        if (!form) {
            console.error('[ParameterManager] Parameter form element not found');
            UI.displayError('Parameter form element not found');
            return;
        }
        form.innerHTML = '';
        Object.entries(this.currentParameters).forEach(([key, val]) => {
            const isVec = Array.isArray(val);
            const input = isVec
                ? `<input type="text" class="w-full p-1 text-black rounded" value="${val.join(',')}" data-type="vector">`
                : `<input type="number" step="any" class="w-full p-1 text-black rounded" value="${val}" data-type="scalar">`;
            form.innerHTML += `
                <div class="flex items-center gap-2 mb-2">
                    <input type="text" class="p-1 text-black rounded w-24 font-mono border" value="${key}" data-param-name>
                    ${input}
                    <button type="button" class="text-red-400 hover:text-red-700 text-xl remove-param-btn" title="Delete">×</button>
                </div>`;
        });
        const modal = document.getElementById('parameterManagerModal');
        if (!modal) {
            console.error('[ParameterManager] Modal element not found');
            UI.displayError('Parameter modal element not found');
            return;
        }
        modal.classList.remove('hidden');
    },

    hideParameterManager() {
        console.log('[ParameterManager] Closing parameter modal');
        const modal = document.getElementById('parameterManagerModal');
        if (modal) {
            modal.classList.add('hidden');
        } else {
            console.error('[ParameterManager] Modal element not found');
            UI.displayError('Parameter modal element not found');
        }
    },

    init() {
        console.log('[ParameterManager] Initializing...');
        const openBtn = document.getElementById('openParameterManagerBtn');
        if (!openBtn) {
            console.error('[ParameterManager] Open button not found');
            UI.displayError('Open parameter button not found');
            return;
        }
        openBtn.onclick = () => this.showParameterManager();

        const closeBtn = document.getElementById('closeParameterManagerBtn');
        if (!closeBtn) {
            console.error('[ParameterManager] Close button not found');
            UI.displayError('Close parameter button not found');
            return;
        }
        closeBtn.onclick = () => this.hideParameterManager();

        const modal = document.getElementById('parameterManagerModal');
        if (!modal) {
            console.error('[ParameterManager] Modal element not found');
            UI.displayError('Parameter modal element not found');
            return;
        }
        modal.onclick = e => {
            if (e.target === e.currentTarget) this.hideParameterManager();
        };

        const addBtn = document.getElementById('addParameterBtn');
        if (!addBtn) {
            console.error('[ParameterManager] Add parameter button not found');
            UI.displayError('Add parameter button not found');
            return;
        }
        addBtn.onclick = e => {
            e.preventDefault();
            this.currentParameters['param' + (Object.keys(this.currentParameters).length + 1)] = 0;
            this.showParameterManager();
        };

        const form = document.getElementById('parameterForm');
        if (!form) {
            console.error('[ParameterManager] Parameter form not found');
            UI.displayError('Parameter form not found');
            return;
        }
        form.onclick = e => {
            if (e.target.classList.contains('remove-param-btn')) {
                const row = e.target.closest('div');
                const name = row.querySelector('[data-param-name]').value.trim();
                delete this.currentParameters[name];
                this.showParameterManager();
                UI.updateControlValues(this.currentParameters); // Sync controls
            }
        };

        const saveBtn = document.getElementById('saveParametersBtn');
        if (!saveBtn) {
            console.error('[ParameterManager] Save parameters button not found');
            UI.displayError('Save parameters button not found');
            return;
        }
        saveBtn.onclick = e => {
            e.preventDefault();
            const rows = document.querySelectorAll('#parameterForm > div');
            const newParams = {};
            rows.forEach(row => {
                const key = row.querySelector('[data-param-name]').value.trim();
                const input = row.querySelector('input:not([data-param-name])');
                if (!key) return;
                if (input.dataset.type === 'vector') {
                    const arr = input.value.split(',').map(v => parseFloat(v.trim())).filter(x => !isNaN(x));
                    newParams[key] = arr;
                } else {
                    const val = parseFloat(input.value);
                    newParams[key] = isNaN(val) ? 0 : val;
                }
            });
            this.currentParameters = newParams;
            Object.entries(this.currentParameters).forEach(([key, value]) => {
                if (PyodideService.isReady) {
                    PyodideService.callPython('set_simulation_parameter', [key, value]);
                }
            });
            UI.updateControlValues(this.currentParameters); // Sync controls
            this.hideParameterManager();
        };
    }
};