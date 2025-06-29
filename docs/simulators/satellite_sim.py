import numpy as np
from scipy.integrate import RK45
import gc

MU = 3.986e14  # Earth's gravitational parameter (m^3/s^2)
R_EARTH = 6371e3  # Earth radius (m)
RHO_0 = 1.225e-9  # Atmospheric density at 400 km (kg/m^3)
H_SCALE = 100e3  # Scale height for atmosphere (m)
SOLAR_PRESSURE = 4.5e-6  # N/m² (approximation)
C_LIGHT = 3e8  # Speed of light (m/s)

controller_gains = {
    "kp": 0.08,
    "kd": 0.44,
    "ki": 0.0
}

I = np.diag([10.0, 8.0, 5.0])  # Moment of inertia (kg·m²)
I_inv = np.linalg.inv(I)
max_torque = 0.1  # Maximum control torque (N·m)

satellite_properties = {
    "mass": 500.0,           # kg
    "area": 2.0,             # m² (cross-section)
    "c_d": 2.2,              # Drag coefficient
    "c_r": 1.5,              # Reflectivity
    "com_offset": np.array([0.0, 0.0, 0.0])  # Assume centered
}

simulation_state = {
    "solver": None,
    "solution": None,
    "last_state": None,
    "current_time": 0.0,
    "q_desired": np.array([1.0, 0.0, 0.0, 0.0]),  # [w, x, y, z]
    "integral_error": np.zeros(3)
}

def setup_simulation(initial_state=None):
    global simulation_state

    # NED initial conditions: x=north, y=east, z=down
    r0 = np.array([0, 0, -(R_EARTH + 400e3)])  # 400 km altitude (z=down)
    v0 = np.array([7500.0, 0, 0])  # Velocity in north direction
    q0 = np.array([1.0, 0.0, 0.0, 0.0])  # [w, x, y, z]
    omega0 = np.array([0.0, 0.0, 0.01])  # Angular velocity
    state0 = np.concatenate([r0, v0, q0, omega0])

    t0 = 0.0
    solver = RK45(state_derivative, t0, state0, t_bound=1e5, max_step=0.2)

    simulation_state["solver"] = solver
    simulation_state["last_state"] = state0
    simulation_state["current_time"] = t0
    simulation_state["integral_error"] = np.zeros(3)

    gc.collect()  # Clean up memory
    return {"status": "Satellite Initialized"}

def state_derivative(t, state):
    r = state[0:3]  # NED: x=north, y=east, z=down
    v = state[3:6]
    q = state[6:10] / np.linalg.norm(state[6:10])  # Normalize quaternion
    omega = state[10:13]

    r_norm = np.linalg.norm(r)

    # Gravitational acceleration
    a_gravity = -MU * r / r_norm**3
    a_drag = atmospheric_drag(r, v)
    a_solar = solar_pressure(r)
    a_total = a_gravity + a_drag + a_solar

    # Torques
    gg_torque = gravity_gradient_torque(r)
    drag_torque = np.zeros(3)  # Assumed negligible
    solar_torque = np.zeros(3)  # Assumed aligned

    # PID control for attitude
    q_des = simulation_state["q_desired"]
    q_error = quat_multiply(q_des, quat_conjugate(q))
    att_err = q_error[1:4] if q_error[0] >= 0 else -q_error[1:4]
    simulation_state["integral_error"] += att_err * 0.2  # Use dt=0.2
    i_term = controller_gains["ki"] * simulation_state["integral_error"]
    control_torque = (-controller_gains["kp"] * att_err
                      - controller_gains["kd"] * omega
                      - i_term)
    control_torque = np.clip(control_torque, -max_torque, max_torque)

    # Angular acceleration
    omega_dot = I_inv @ (control_torque + gg_torque + drag_torque + solar_torque - np.cross(omega, I @ omega))
    omega_quat = np.array([0.0, *omega])
    q_dot = 0.5 * quat_multiply(q, omega_quat)

    return np.concatenate([v, a_total, q_dot, omega_dot])

def atmospheric_drag(r, v):
    alt = np.linalg.norm(r) - R_EARTH
    rho = RHO_0 * np.exp(-alt / H_SCALE)
    v_rel = v
    drag_acc = -0.5 * rho * satellite_properties["c_d"] * satellite_properties["area"] / satellite_properties["mass"] * np.linalg.norm(v_rel) * v_rel
    return drag_acc

def solar_pressure(r):
    sun_dir = np.array([1.0, 0.0, 0.0])  # Sun in north direction (NED)
    if np.dot(r, sun_dir) < 0:
        return np.zeros(3)
    force_mag = SOLAR_PRESSURE * satellite_properties["area"] * satellite_properties["c_r"] / satellite_properties["mass"]
    return force_mag * sun_dir

def gravity_gradient_torque(r):
    r_norm = np.linalg.norm(r)
    r_hat = r / r_norm
    return 3 * MU / r_norm**3 * np.cross(r_hat, I @ r_hat)

def update_simulation_step(dt, controls):
    global simulation_state

    solver = simulation_state["solver"]
    if solver is None:
        return setup_simulation({})

    t_target = solver.t + dt
    while solver.status == 'running' and solver.t < t_target:
        solver.step()

    if solver.status != 'running':
        return {"error": "Solver stopped or failed."}

    y_next = solver.y
    y_next[6:10] /= np.linalg.norm(y_next[6:10])  # Normalize quaternion
    simulation_state["last_state"] = y_next
    simulation_state["current_time"] = solver.t

    r = y_next[0:3]  # NED: x=north, y=east, z=down
    v = y_next[3:6]
    q = y_next[6:10]

    r_mag, theta, phi = cartesian_to_spherical(r)
    v_r, v_t = get_radial_tangential_velocity(r, v)

    return {
        "Time (s)": round(solver.t, 1),
        "Position X (m)": round(r[0], 2),
        "Position Y (m)": round(r[1], 2),
        "Position Z (m)": round(r[2], 2),
        "Radius (m)": round(r_mag, 2),
        "Latitude (deg)": round(90 - np.degrees(theta), 2),
        "Longitude (deg)": round(np.degrees(phi), 2),
        "Radial Velocity (m/s)": round(v_r, 2),
        "Tangential Velocity (m/s)": round(v_t, 2),
        "Azimuth (deg)": round(np.degrees(np.arctan2(r[1], r[0])), 2),
        "quaternion": [round(val, 4) for val in q],
        "position": r.tolist()
    }

def handle_action_command(action_id, params):
    global simulation_state
    if action_id == 'reset_to_initial_config':
        simulation_state["solver"] = None
        simulation_state["current_time"] = 0.0
        simulation_state["integral_error"] = np.zeros(3)
        setup_simulation({})
        gc.collect()
        return {"status": "Simulation reset"}
    return {"status": "Unknown action"}

def set_simulation_parameter(param, value):
    global controller_gains, simulation_state
    try:
        if param in controller_gains:
            controller_gains[param] = float(value)
        elif param == "q_desired":
            simulation_state["q_desired"] = np.array(value, dtype=float) / np.linalg.norm(value)
        print(f"[Pyodide] Setting parameter {param} to {value}")
        return True
    except Exception as e:
        print(f"[Pyodide] Parameter Set Error ({param}): {e}")
        return False

def quat_multiply(q1, q2):
    w1, x1, y1, z1 = q1
    w2, x2, y2, z2 = q2
    return np.array([
        w1*w2 - x1*x2 - y1*y2 - z1*z2,
        w1*x2 + x1*w2 + y1*z2 - z1*y2,
        w1*y2 - x1*z2 + y1*w2 + z1*x2,
        w1*z2 + x1*y2 - y1*x2 + z1*w2
    ])

def quat_conjugate(q):
    return np.array([q[0], -q[1], -q[2], -q[3]])

def cartesian_to_spherical(r_vec):
    x, y, z = r_vec
    r = np.linalg.norm(r_vec)
    theta = np.arccos(z / r)  # NED: z=down
    phi = np.arctan2(y, x)    # y=east, x=north
    return r, theta, phi

def get_radial_tangential_velocity(r_vec, v_vec):
    r_hat = r_vec / np.linalg.norm(r_vec)
    v_r = np.dot(v_vec, r_hat)
    v_t = np.sqrt(np.linalg.norm(v_vec)**2 - v_r**2)
    return v_r, v_t