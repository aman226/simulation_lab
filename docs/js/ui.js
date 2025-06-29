import { ParameterManager } from './parameterManager.js';
import { PyodideService } from './pyodideService.js';

export const UI = {
    DOMElements: {
        simulatorList: document.getElementById('simulatorList'),
        viewportPlaceholder: document.getElementById('viewportPlaceholder'),
        simulationCanvas: document.getElementById('simulationCanvas'),
        controlsPlaceholder: document.getElementById('controlsPlaceholder'),
        activeControls: document.getElementById('activeControls'),
        telemetryPlaceholder: document.getElementById('telemetryPlaceholder'),
        activeTelemetry: document.getElementById('activeTelemetry'),
        connectionStatus: document.getElementById('connectionStatus'),
        connectionIndicator: document.getElementById('connectionIndicator'),
        errorDisplayArea: document.getElementById('errorDisplayArea'),
        errorMessages: document.getElementById('errorMessages'),
        currentYear: document.getElementById('currentYear'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        loadingStatusText: document.getElementById('loadingStatusText')
    },

    init() {
        console.log('[UI] Init');
        try {
            lucide.createIcons();
        } catch (e) {
            console.error('[UI] Lucide init fail:', e);
            this.displayError('Lucide init fail');
        }
        if (this.DOMElements.currentYear) {
            this.DOMElements.currentYear.textContent = new Date().getFullYear();
        }
    },

    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    populateSimulatorList(sims, cb) {
        if (!this.DOMElements.simulatorList) {
            console.error('[UI] Simulator list element not found');
            this.displayError('Simulator list element not found');
            return;
        }
        this.DOMElements.simulatorList.innerHTML = '';
        sims.forEach(s => {
            let b = document.createElement('button');
            b.className = 'w-full text-left p-3 rounded-md simulator-item border-l-4 border-transparent transition-all duration-150 ease-in-out flex items-center group focus:outline-none focus:ring-2 focus:ring-blue-500';
            b.innerHTML = `<i data-lucide="${s.icon || 'box'}" class="mr-3 h-5 w-5 text-gray-400 group-hover:text-blue-400"></i><span class="flex-grow">${s.name}</span><i data-lucide="chevron-right" class="h-4 w-4 text-gray-500 group-hover:text-blue-300"></i>`;
            b.onclick = () => {
                cb(s);
                this.updateSimulatorSelectionDisplay(s.name);
            };
            this.DOMElements.simulatorList.appendChild(b);
        });
        try {
            lucide.createIcons();
        } catch (e) {
            console.error('[UI] Lucide dynamic icon fail:', e);
            this.displayError('Lucide dynamic icon fail');
        }
    },

    updateSimulatorSelectionDisplay(name) {
        if (!this.DOMElements.simulatorList) return;
        Array.from(this.DOMElements.simulatorList.children).forEach(c => {
            const t = c.querySelector('span.flex-grow')?.textContent.trim();
            c.classList.toggle('active-simulator', t === name);
            c.querySelector('span.flex-grow')?.classList.toggle('font-bold', t === name);
        });
    },

    showSimulationView() {
        if (this.DOMElements.viewportPlaceholder && this.DOMElements.simulationCanvas) {
            this.DOMElements.viewportPlaceholder.classList.add('hidden');
            this.DOMElements.simulationCanvas.classList.remove('hidden');
        }
    },

    populateControls(sim, actionCb, controlCb) {
        if (!this.DOMElements.activeControls || !this.DOMElements.controlsPlaceholder) {
            console.error('[UI] Controls elements not found');
            this.displayError('Controls elements not found');
            return;
        }
        this.DOMElements.controlsPlaceholder.classList.add('hidden');
        this.DOMElements.activeControls.classList.remove('hidden');
        this.DOMElements.activeControls.innerHTML = '';
        if (sim.controls) {
            sim.controls.forEach(c => {
                let d = document.createElement('div');
                d.className = 'mb-3';
                let id = `${sim.id}_${c.id}`;
                if (c.type === 'range') {
                    const value = ParameterManager.currentParameters[c.pyParameterName] !== undefined ? ParameterManager.currentParameters[c.pyParameterName] : c.value;
                    d.innerHTML = `<label for="${id}" class="text-sm">${c.label}</label><input type="range" id="${id}" name="${c.id}" min="${c.min}" max="${c.max}" value="${value}" step="${c.step || 1}" class="mt-1"><p class="text-xs text-right"><span id="${id}Value" class="telemetry-value">${value}</span> ${c.unit || ''}</p>`;
                    this.DOMElements.activeControls.appendChild(d);
                    document.getElementById(id).addEventListener('input', this.debounce(e => {
                        const newValue = parseFloat(e.target.value);
                        document.getElementById(`${id}Value`).textContent = newValue;
                        ParameterManager.currentParameters[c.pyParameterName] = newValue;
                        controlCb(sim.id, c.id, newValue, c.pyParameterName);
                    }, 100));
                }
            });
        }
        if (sim.actions) {
            sim.actions.forEach(a => {
                let b = document.createElement('button');
                b.id = `${sim.id}_${a.id}`;
                b.className = 'w-full p-2 mt-2 btn-primary flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400';
                b.innerHTML = `<i data-lucide="${a.icon || 'play'}" class="mr-2 h-4 w-4"></i> ${a.label}`;
                b.onclick = () => actionCb(sim.id, a.id, a.pyActionId, a.pyActionParams);
                this.DOMElements.activeControls.appendChild(b);
            });
        }
        try {
            lucide.createIcons();
        } catch (e) {
            console.error('[UI] Lucide control icon fail:', e);
            this.displayError('Lucide control icon fail');
        }
    },

    updateControlValues(params) {
        Object.entries(params).forEach(([key, value]) => {
            const input = document.querySelector(`input[name="${key}"]`);
            if (input) {
                input.value = value;
                const valueSpan = document.getElementById(`${input.id}Value`);
                if (valueSpan) valueSpan.textContent = value;
            }
        });
    },

    populateTelemetry(sim) {
        if (!this.DOMElements.activeTelemetry || !this.DOMElements.telemetryPlaceholder) {
            console.error('[UI] Telemetry elements not found');
            this.displayError('Telemetry elements not found');
            return;
        }
        this.DOMElements.telemetryPlaceholder.classList.add('hidden');
        this.DOMElements.activeTelemetry.classList.remove('hidden');
        this.DOMElements.activeTelemetry.innerHTML = '';
        if (sim.telemetry) {
            sim.telemetry.forEach(item => {
                let p = document.createElement('p');
                let idSuffix = item.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                p.innerHTML = `${item}: <span id="telemetry_${sim.id}_${idSuffix}" class="telemetry-value">N/A</span>`;
                this.DOMElements.activeTelemetry.appendChild(p);
            });
        }
    },

    updateTelemetryDisplay(simId, payload) {
        for (const k in payload) {
            if (payload.hasOwnProperty(k)) {
                let idSuffix = k.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                let el = document.getElementById(`telemetry_${simId}_${idSuffix}`);
                if (el) {
                    const value = Array.isArray(payload[k]) ? payload[k].map(v => v.toFixed(2)).join(', ') : Number.isFinite(payload[k]) ? payload[k].toFixed(2) : payload[k];
                    el.textContent = value;
                }
            }
        }
    },

    displayError(msg) {
        if (!this.DOMElements.errorDisplayArea || !this.DOMElements.errorMessages) {
            console.error('[UI] Error display elements not found');
            return;
        }
        this.DOMElements.errorDisplayArea.classList.remove('hidden');
        let p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        this.DOMElements.errorMessages.appendChild(p);
        while (this.DOMElements.errorMessages.children.length > 5) {
            this.DOMElements.errorMessages.removeChild(this.DOMElements.errorMessages.firstChild);
        }
    },

    updateEngineStatus(text, statusClass, indicator) {
        if (!this.DOMElements.connectionStatus || !this.DOMElements.connectionIndicator) {
            console.error('[UI] Connection status elements not found');
            this.displayError('Connection status elements not found');
            return;
        }
        this.DOMElements.connectionStatus.textContent = text;
        this.DOMElements.connectionStatus.className = `text-${statusClass}-400`;
        this.DOMElements.connectionIndicator.className = `status-indicator ${indicator}`;
    },

    showLoadingOverlay(msg) {
        if (!this.DOMElements.loadingOverlay || !this.DOMElements.loadingStatusText) {
            console.error('[UI] Loading overlay elements not found');
            this.displayError('Loading overlay elements not found');
            return;
        }
        this.DOMElements.loadingStatusText.textContent = msg || "Loading...";
        this.DOMElements.loadingOverlay.classList.remove('hidden');
    },

    hideLoadingOverlay() {
        if (this.DOMElements.loadingOverlay) {
            this.DOMElements.loadingOverlay.classList.add('hidden');
        }
    },

    clearErrorDisplay() {
        if (this.DOMElements.errorDisplayArea && this.DOMElements.errorMessages) {
            this.DOMElements.errorDisplayArea.classList.add('hidden');
            this.DOMElements.errorMessages.innerHTML = '';
        }
    }
};