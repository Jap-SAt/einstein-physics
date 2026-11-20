"""Reference answers for assets/js/data/practice/particle.js, worked from the question texts.

Independent of the JS item functions: instead of the closed formulas r = mv/qB, T = 2*pi*m/qB,
p = v cos(theta) T, the motion is SIMULATED here by stepping Newton's second law with the full
Lorentz force F = q(E + v x B) (Boris integrator, vectors in 3-D), and the answers are read off the
trajectory (farthest point, time to come back to the start direction, distance moved along B in one
turn, position after half a turn). Inverse questions (find v, m, e/m from a measured radius) are solved
by bisection on the forward simulation/geometry. Forces use explicit cross products.
Level 2 uses three hand-chosen variable sets on each item's grid.
Run: python3 tests/practice-ref/compute_particle.py > tests/practice-ref/particle.json
"""
import json
import math

# constants exactly as stated in the questions
E_CH = 1.6e-19      # C
M_E = 9.11e-31      # kg
M_P = 1.67e-27      # kg
U = 1.66e-27        # kg
DEG = math.pi / 180


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def add(a, b, k=1.0):
    return tuple(x + k * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(sum(x * x for x in a))


def boris(q, m, v0, B, E=(0.0, 0.0, 0.0), dt=None, steps=None, stop=None):
    """Integrate m dv/dt = q(E + v x B) from the origin. Yields (t, x, v) after every step.
    stop(t, x, v, prev) -> True ends the run."""
    x, v, t = (0.0, 0.0, 0.0), tuple(v0), 0.0
    h = q * dt / (2 * m)
    out = []
    for _ in range(steps):
        vm = add(v, E, h)                                  # half electric kick
        tvec = tuple(h * b for b in B)
        s = 2 / (1 + sum(c * c for c in tvec))
        vp = add(vm, cross(vm, tvec))
        vplus = add(vm, cross(vp, tvec), s)                 # magnetic rotation
        v_new = add(vplus, E, h)                           # half electric kick
        x_new = add(x, v_new, dt)
        prev = (t, x, v)
        t, x, v = t + dt, x_new, v_new
        out.append((t, x, v))
        if stop and stop(t, x, v, prev):
            break
    return out


def turn_time(q, m, B, dt):
    """time for the velocity to come back to its starting direction (one full revolution), v along +x, B along +z"""
    v0 = (1.0e5, 0.0, 0.0)
    state = {'half': False}

    def stop(t, x, v, prev):
        if v[1] * prev[2][1] < 0 and v[0] < 0:
            state['half'] = True
        return state['half'] and v[1] * prev[2][1] < 0 and v[0] > 0
    run = boris(q, m, v0, (0.0, 0.0, B), dt=dt, steps=10_000_000, stop=stop)
    (t1, _, v1), (t0, _, v0p) = run[-1], run[-2]
    # interpolate the zero crossing of v_y
    return t0 + (t1 - t0) * v0p[1] / (v0p[1] - v1[1])


def period(q, m, B):
    dt0 = (m / (abs(q) * B)) / 50          # coarse step for a first estimate (any scale works)
    T0 = turn_time(q, m, B, dt0)
    return turn_time(q, m, B, T0 / 40000)


def landing_distance(q, m, speed, B):
    """enter at the origin moving +x, B along +z (or -z): farthest distance from the entry point"""
    T = period(q, m, B)
    run = boris(q, m, (speed, 0.0, 0.0), (0.0, 0.0, B), dt=T / 40000, steps=40000)
    return max(norm(x) for _, x, _ in run)


def bisect(fn, lo, hi, n=200):
    flo = fn(lo)
    assert flo * fn(hi) < 0, (flo, fn(hi))
    for _ in range(n):
        mid = (lo + hi) / 2
        if fn(mid) * flo > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# ── Level 2 ──────────────────────────────────────────────────────────────────────────────────
CHARGES = [E_CH, -E_CH]     # particle-2-01 c: 0 proton, 1 electron


def force_magnitude(c, v, B, th):
    # velocity at th degrees to B (B along z), force = |q v x B|
    vel = (v * 1e6 * math.sin(th * DEG), 0.0, v * 1e6 * math.cos(th * DEG))
    F = cross(vel, (0.0, 0.0, B))
    return abs(CHARGES[c]) * norm(F)


def proton_landing_cm(v, B):
    return landing_distance(E_CH, M_P, v * 1e6, B) * 100


def electron_period_ns(v, B):
    # the speed is given but a full turn takes the same time at any speed; we time it at the given speed
    q, m, Bt = -E_CH, M_E, B * 1e-3
    T0 = period(q, m, Bt)
    run = boris(q, m, (v * 1e6, 0.0, 0.0), (0.0, 0.0, Bt), dt=T0 / 40000, steps=60000)
    # first return of the velocity direction to +x after leaving it
    for (t0, _, va), (t1, _, vb) in zip(run, run[1:]):
        if t1 > 0.75 * T0 and va[1] * vb[1] <= 0 and va[0] > 0:
            return (t0 + (t1 - t0) * va[1] / (va[1] - vb[1])) * 1e9
    raise RuntimeError


def proton_pitch_cm(v, B, th):
    q, m = E_CH, M_P
    T0 = period(q, m, B)
    v0 = (v * 1e6 * math.sin(th * DEG), 0.0, v * 1e6 * math.cos(th * DEG))
    run = boris(q, m, v0, (0.0, 0.0, B), dt=T0 / 40000, steps=40000)
    return run[-1][1][2] * 100            # distance moved along B in exactly one turn


def selector_field_kV(v, B):
    # field E (along y) that makes the net force on a +q moving along x with B along z zero
    vel, Bv = (v * 1e5, 0.0, 0.0), (0.0, 0.0, B * 1e-3)
    fb = cross(vel, Bv)                    # per unit charge
    return bisect(lambda E: E + fb[1], 0.0, 1e7) / 1000


def ion_mass_u(D, v, B):
    # find the mass (in u) whose landing point is D cm from the entry slit
    target = D / 100
    geom = lambda mu: 2 * (mu * U) * (v * 1e5) / (E_CH * B)   # diameter of the circle
    m = bisect(lambda mu: geom(mu) - target, 1.0, 300.0)
    # confirm with the simulation
    assert abs(landing_distance(E_CH, m * U, v * 1e5, B) - target) / target < 1e-3
    return m


def electron_speed(r, B):
    # bisection on the speed so that the simulated circle has radius r cm (diameter 2r)
    Bt, rt = B * 1e-3, r / 100
    T = period(-E_CH, M_E, Bt)
    def radius(s):
        run = boris(-E_CH, M_E, (s, 0.0, 0.0), (0.0, 0.0, Bt), dt=T / 4000, steps=4000)
        return max(norm(x) for _, x, _ in run) / 2
    s = bisect(lambda s: radius(s) - rt, 1e4, 3e7, n=60)
    return s / 1e6


L2 = {
    'particle-2-01': (force_magnitude, [dict(c=0, v=2.5, B=0.40, th=30), dict(c=1, v=6.0, B=1.20, th=65),
                                        dict(c=1, v=9.0, B=0.15, th=20)]),
    'particle-2-02': (proton_landing_cm, [dict(v=1.0, B=0.50), dict(v=3.5, B=1.20), dict(v=0.5, B=2.00)]),
    'particle-2-03': (electron_period_ns, [dict(v=2.0, B=1.00), dict(v=7.5, B=4.25), dict(v=1.0, B=0.50)]),
    'particle-2-04': (proton_pitch_cm, [dict(v=2.0, B=0.50, th=30), dict(v=4.5, B=0.25, th=65),
                                        dict(v=1.0, B=1.00, th=55)]),
    'particle-2-05': (selector_field_kV, [dict(v=2.5, B=40), dict(v=1.0, B=20), dict(v=9.0, B=200)]),
    'particle-2-06': (ion_mass_u, [dict(D=20.5, v=3.0, B=0.70), dict(D=14.5, v=1.0, B=0.20),
                                   dict(D=43.8, v=5.0, B=0.45)]),
    'particle-2-07': (electron_speed, [dict(r=3.0, B=0.35), dict(r=5.0, B=1.00), dict(r=10.0, B=0.50)]),
}


# ── Level 3 ──────────────────────────────────────────────────────────────────────────────────
def particle_3_01():
    # electron at origin moving +x at 4.0e6 m/s, B = 1.0 mT along -z; y after half a turn (cm, signed)
    q, m, B = -E_CH, M_E, (0.0, 0.0, -1.0e-3)
    T = period(q, m, 1.0e-3)
    run = boris(q, m, (4.0e6, 0.0, 0.0), B, dt=T / 40000, steps=20000)
    return run[-1][1][1] * 100


def particle_3_02():
    # selector B = 0.10 T passes protons at 2.0e5 m/s; net force on a proton at 2.6e5 m/s
    Bv = (0.0, 0.0, 0.10)
    E_y = -cross((2.0e5, 0.0, 0.0), Bv)[1]          # cancels v0 x B for the first proton
    Ev = (0.0, E_y, 0.0)
    F = add(Ev, cross((2.6e5, 0.0, 0.0), Bv))
    return E_CH * norm(F)


def particle_3_03():
    # electron helix: radius 1.5 cm, pitch 12 cm, B = 1.0 mT -> speed (1e6 m/s)
    # geometry of a helix: in one turn it goes 2*pi*r around and p along, so tan(theta) = 2*pi*r/p;
    # then find the speed whose simulated helix has radius 1.5 cm at that angle
    th = math.atan2(2 * math.pi * 0.015, 0.12)
    Bt = 1.0e-3
    T = period(-E_CH, M_E, Bt)
    def radius(s):
        v0 = (s * math.sin(th), 0.0, s * math.cos(th))
        run = boris(-E_CH, M_E, v0, (0.0, 0.0, Bt), dt=T / 4000, steps=4000)
        return max(math.hypot(x[0], x[1]) for _, x, _ in run) / 2
    s = bisect(lambda s: radius(s) - 0.015, 1e5, 3e7, n=60)
    # check the pitch at that speed
    run = boris(-E_CH, M_E, (s * math.sin(th), 0.0, s * math.cos(th)), (0.0, 0.0, Bt), dt=T / 40000, steps=40000)
    assert abs(run[-1][1][2] - 0.12) < 1e-4
    return s / 1e6


def particle_3_04():
    # proton 2.0e6 m/s, B = 0.40 T, force 8.0e-14 N -> pitch (cm)
    th = bisect(lambda a: force_magnitude(0, 2.0, 0.40, a) - 8.0e-14, 0.1, 89.9)
    return proton_pitch_cm(2.0, 0.40, th)


def particle_3_05():
    # Thomson: E = 1.2e4 V/m, B = 2.0 mT straight line; E off -> r = 1.7 cm. e/m (C/kg)
    v = bisect(lambda s: 1.2e4 - s * 2.0e-3, 1.0, 1e9)       # qE = q v B: no deflection
    # simulate a particle of charge k per kilogram (q = k, m = 1) at speed v in B = 2.0 mT and find
    # the k whose circle has radius 1.7 cm
    def radius(k):
        dt = 1 / (k * 2.0e-3) / 700
        run = boris(k, 1.0, (v, 0.0, 0.0), (0.0, 0.0, 2.0e-3), dt=dt, steps=4500)
        return max(norm(x) for _, x, _ in run) / 2
    return bisect(lambda k: radius(k) - 0.017, 1e9, 1e13, n=60)


def particle_3_06():
    # Ne-20+ / Ne-22+, selector E = 4.0e4 V/m, B = 0.20 T, then B' = 0.50 T; landing separation (mm)
    v = 4.0e4 / 0.20
    d20 = landing_distance(E_CH, 20 * U, v, 0.50)
    d22 = landing_distance(E_CH, 22 * U, v, 0.50)
    return (d22 - d20) * 1000


out = {}
for item_id, (fn, cases) in L2.items():
    out[item_id] = [{'vars': c, 'answer': fn(**c)} for c in cases]
for name, fn in sorted(globals().copy().items()):
    if name.startswith('particle_3_'):
        out[name.replace('_', '-')] = fn()

print(json.dumps(out, indent=1, ensure_ascii=False))
