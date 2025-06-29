export const SIMULATORS_CONFIG = [
    {
        id: 'satellite_sim',
        name: 'LEO Satellite Simulator',
        icon: 'satellite-dish',
        type: 'pyodide',
        pythonScriptURL: './simulators/satellite_sim.py',
        visualizerModuleURL: './visualizers/satellite_threejs.js',
        initialState: {
            position: [0, 0, -(6371e3 + 400e3)], // NED: x=north, y=east, z=down
            velocity: [7500, 0, 0] // North direction
        },
        parameters: {
            kp: 0.08,
            ki: 0.0,
            kd: 0.44,
            q_desired: [1.0, 0.0, 0.0, 0.0]
        },
        controls: [
            {
                id: 'kp',
                label: 'Proportional Gain (Kp)',
                type: 'range',
                min: 0,
                max: 10,
                value: 0.08,
                step: 0.01,
                pyParameterName: 'kp'
            },
            {
                id: 'ki',
                label: 'Integral Gain (ki)',
                type: 'range',
                min: 0.0,
                max: 5.0,
                step: 0.01,
                value: 0.0,
                pyParameterName: 'ki'
            },
            {
                id: 'kd',
                label: 'Derivative Gain (Kd)',
                type: 'range',
                min: 0,
                max: 10,
                value: 0.44,
                step: 0.01,
                pyParameterName: 'kd'
            }
        ],
        actions: [
            {
                id: 'reset_sim',
                label: 'RESET ORBIT',
                icon: 'refresh-cw',
                pyActionId: 'reset_to_initial_config'
            },
            {
                id: 'stop_sim',
                label: 'STOP SIMULATION',
                icon: 'square',
                pyActionId: null
            }
        ],
        telemetry: [
            'Time (s)',
            'Radius (m)',
            'Latitude (deg)',
            'Longitude (deg)',
            'Radial Velocity (m/s)',
            'Tangential Velocity (m/s)',
            'Azimuth (deg)',
            'quaternion',
            'Position X (m)',
            'Position Y (m)',
            'Position Z (m)',
            'Sim Step Time (ms)'
        ]
    }
];