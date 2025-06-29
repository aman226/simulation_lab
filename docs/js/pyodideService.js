const PYODIDE_PACKAGES = ['numpy', 'scipy'];

export const PyodideService = {
    pyodide: null,
    isReady: false,
    isLoading: false,
    currentScriptURL: null,

    async init(pythonScriptURL) {
        if (this.isLoading) {
            console.log('[PyodideService] Already loading.');
            return false;
        }
        if (this.isReady && this.currentScriptURL === pythonScriptURL) {
            console.log('[PyodideService] Already initialized with this script.');
            return true;
        }

        this.isLoading = true;
        this.isReady = false;
        this.currentScriptURL = pythonScriptURL;

        try {
            if (!this.pyodide) {
                console.log('[PyodideService] Loading Pyodide main package...');
                this.pyodide = await loadPyodide();
                console.log('[PyodideService] Loading packages:', PYODIDE_PACKAGES);
                await this.pyodide.loadPackage(PYODIDE_PACKAGES);
            }

            console.log(`[PyodideService] Fetching Python script from ${pythonScriptURL}`);
            let pythonScriptText;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const response = await fetch(pythonScriptURL);
                    if (!response.ok) throw new Error(`Fetch failed (${response.status})`);
                    pythonScriptText = await response.text();
                    break;
                } catch (error) {
                    if (attempt === 3) {
                        console.error(`[PyodideService] Failed to fetch script after ${attempt} attempts:`, error.message);
                        return false;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            await this.pyodide.runPythonAsync(pythonScriptText);

            this.isReady = true;
            console.log(`[PyodideService] Initialization complete for ${pythonScriptURL}. Python environment ready.`);
            return true;
        } catch (error) {
            console.error('[PyodideService] Init Error:', error.message, error);
            return false;
        } finally {
            this.isLoading = false;
        }
    },

    callPython(funcName, args = []) {
        if (!this.isReady || !this.pyodide) {
            console.error('[PyodideService] Not ready to call:', funcName);
            return null;
        }
        try {
            const pyFunc = this.pyodide.globals.get(funcName);
            if (typeof pyFunc !== 'function') throw new Error(`Python func '${funcName}' not found.`);
            let result = pyFunc(...args);
            if (result && typeof result.toJs === 'function') {
                return result.toJs({ dict_converter: Object.fromEntries });
            }
            return result;
        } catch (error) {
            console.error(`[PyodideService] Error calling Python.${funcName}:`, error.message, error);
            return null;
        }
    }
};