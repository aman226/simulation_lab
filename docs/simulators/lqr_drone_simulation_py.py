import numpy as np
from scipy.spatial.transform import Rotation as R

simulation_state = {
    "position": np.array([0.0, 0.0, 0.0], dtype=float),
    "velocity": np.zeros(3, dtype=float),
    "quaternion": np.array([1.0, 0.0, 0.0, 0.0], dtype=float),  # [w, x, y, z]
    "angular_velocity": np.zeros(3, dtype=float),
    "target_position_z": 1.0
}

def setup_simulation(initial_state):
    global simulation_state
    try:
        for key in ['position', 'velocity', 'quaternion', 'angular_velocity']:
            if key in initial_state:
                simulation_state[key] = np.array(initial_state[key], dtype=float)

        if 'target_position_z' in initial_state:
            simulation_state['target_position_z'] = float(initial_state['target_position_z'])

        return "Simulation Initialized"
    except Exception as e:
        return f"Initialization Error: {e}"

def set_simulation_parameter(param, value):
    global simulation_state
    try:
        if param == 'target_position_z':
            simulation_state[param] = float(value)
        else:
            simulation_state[param] = np.array(value, dtype=float)
    except Exception as e:
        print(f"Parameter Set Error ({param}): {e}")

def handle_action_command(action_id, params):
    global simulation_state
    if action_id == 'reset_to_initial_config':
        simulation_state['position'] = np.array([0, 0, 0], dtype=float)
        simulation_state['velocity'] = np.zeros(3, dtype=float)
        simulation_state['quaternion'] = np.array([1.0, 0.0, 0.0, 0.0], dtype=float)
        simulation_state['angular_velocity'] = np.zeros(3, dtype=float)

def update_simulation_step(dt, controls):
    global simulation_state

    # Simple Z controller
    kp = 1.5
    target_z = simulation_state['target_position_z']
    error_z = target_z - simulation_state['position'][2]

    simulation_state['velocity'][2] += kp * error_z * dt
    simulation_state['position'] += simulation_state['velocity'] * dt

    # Gentle pitch oscillation for visualization
    pitch_angle = 0.2 * np.sin(simulation_state['position'][2])  # radians
    rot = R.from_euler('xyz', [0.0, pitch_angle, 0.0])
    quat_xyzw = rot.as_quat()  # scipy returns [x, y, z, w]
    quat_wxyz = np.roll(quat_xyzw, 1)  # convert to [w, x, y, z]

    simulation_state["quaternion"] = quat_wxyz

    return {
        "Position X (m)": round(simulation_state['position'][0], 3),
        "Position Y (m)": round(simulation_state['position'][1], 3),
        "Position Z (m)": round(simulation_state['position'][2], 3),
        "Roll (deg)": 0.0,
        "Pitch (deg)": round(np.degrees(pitch_angle), 2),
        "Yaw (deg)": 0.0,
        "quaternion": simulation_state["quaternion"].tolist(),
        "position": simulation_state["position"].tolist(),   # ← ADD THIS
    }
