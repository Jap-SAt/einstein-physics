"""Reference answers for assets/js/data/practice/estat.js, worked from the question texts.

Independent of the JS item functions wherever a different route exists:
- charges are tracked as whole numbers of electrons (exact Fractions) when spheres touch;
- forces and fields are summed as 3-D Coulomb VECTORS k q1 q2 (r2 - r1)/|r2 - r1|^3, never as
  "magnitude, then decide the direction";
- zero-field points are found by bisection on the signed vector field along the axis (no square-root formula);
- work is integrated numerically along a straight path through a uniform field built from the two potentials;
- accelerating voltages and deflections come from stepping Newton's second law (velocity Verlet) through
  the field between plates, then bisection where the question runs backwards;
- capacitor charge comes from Gauss's surface density sigma = eps0 E with E = V/d (not C = eps0 A/d);
- series/parallel networks are solved by charge conservation on the isolated middle conductor (node potential),
  energies as the sum of each capacitor's own Q^2/2C.
Level 2 uses three hand-chosen variable sets on each item's grid.
Run: python3 tests/practice-ref/compute_estat.py > tests/practice-ref/estat.json
"""
import json
import math
from fractions import Fraction

# constants exactly as stated in the questions
K = 9.0e9           # N m^2 / C^2
E_CH = 1.6e-19      # C
M_E = 9.11e-31      # kg
M_P = 1.67e-27      # kg
EPS0 = 8.85e-12     # C^2 / (N m^2)
G = 9.8             # m/s^2
UC = 1e-6           # one microcoulomb in C


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(sum(x * x for x in a))


def coulomb_force(charges, q, at):
    """vector force on charge q at position `at` from charges [(Q, pos)]"""
    F = [0.0, 0.0, 0.0]
    for Q, pos in charges:
        r = sub(at, pos)
        d = norm(r)
        for i in range(3):
            F[i] += K * Q * q * r[i] / d ** 3
    return tuple(F)


def field(charges, at):
    return coulomb_force(charges, 1.0, at)


def potential(charges, at):
    return sum(K * Q / norm(sub(at, pos)) for Q, pos in charges)


def bisect(fn, lo, hi, n=200):
    flo = fn(lo)
    for _ in range(n):
        mid = (lo + hi) / 2
        fm = fn(mid)
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2


def touch(a, b):
    """two identical conductors touch: electrons flow until the excess is shared equally (counts in units of e)"""
    total = a + b
    return Fraction(total, 2), Fraction(total, 2)


def electrons(q_uc):
    """charge in microcoulombs -> signed count of e (positive = missing electrons), exact"""
    return Fraction(q_uc).limit_denominator(1000) * Fraction(10 ** 14, 16)  # 1 uC = 6.25e12 e


def run_plates(q, m, V, d, v0=0.0, L=None, steps=20000):
    """charge q, mass m between plates with potential difference V over gap d (uniform field).
    L is None: start at rest at one plate, move along the field direction the force pushes it, return speed at the other plate.
    L given: enter at v0 along x, field along y, return y after travelling L along x."""
    E = V / d
    a = q * E / m
    if L is None:
        dt = math.sqrt(2 * d / abs(a)) / steps
        x, v = 0.0, 0.0
        while x < d:
            v_half = v + 0.5 * abs(a) * dt
            x_new = x + v_half * dt
            if x_new >= d:                       # finish the last partial step exactly at the plate:
                aa = abs(a)                      # solve x + v tau + a tau^2 / 2 = d for tau
                tau = (-v + math.sqrt(v * v + 2 * aa * (d - x))) / aa
                v = v + aa * tau
                break
            x, v = x_new, v_half + 0.5 * abs(a) * dt
        return v
    T = L / v0
    dt = T / steps
    y, vy = 0.0, 0.0
    for _ in range(steps):
        vy_half = vy + 0.5 * a * dt
        y += vy_half * dt
        vy = vy_half + 0.5 * a * dt
    return y


# ── Level 2 ──────────────────────────────────────────────────────────────────────────────────
def three_spheres(a, b):
    # A = +a uC, B = -b uC, C neutral; A touches B, then B touches C; charge on C (uC)
    A, B, C = electrons(a), electrons(-b), Fraction(0)
    A, B = touch(A, B)
    B, C = touch(B, C)
    assert A + B + C == electrons(a) + electrons(-b)
    return float(C / Fraction(10 ** 14, 16))


def force_on_middle(A, B, C, r1, r2):
    # q1 = +A uC at 0, q2 = -B uC at r1 cm, q3 = +C uC at r1 + r2 cm; x-component of force on q2 (N)
    src = [(A * UC, (0.0, 0.0, 0.0)), (C * UC, ((r1 + r2) / 100, 0.0, 0.0))]
    return coulomb_force(src, -B * UC, (r1 / 100, 0.0, 0.0))[0]


def zero_between(A, B, d, s):
    # like charges (sign s: 0 both +, 1 both -) at 0 and d cm; point where E_x = 0 (cm from q1)
    sg = -1 if s else 1
    src = [(sg * A * UC, (0.0, 0.0, 0.0)), (sg * B * UC, (d / 100, 0.0, 0.0))]
    x = bisect(lambda x: field(src, (x, 0.0, 0.0))[0], 1e-6 * d / 100, d / 100 * (1 - 1e-6))
    return x * 100


def work_by_field(Q, VA, VB):
    # q = -Q uC from A to B; build a uniform field E along x with V(0) = VA, V(1 m) = VB, integrate q E dx (uJ)
    q, L, n = -Q * UC, 1.0, 100000
    E = (VA - VB) / L
    W = sum(q * E * (L / n) for _ in range(n))
    return W / UC


def accel_voltage(p, v):
    # particle (0 electron, 1 proton) from rest to speed v x10^6 (e) or v x10^5 (p) m/s; find V by bisection
    m, target = (M_E, v * 1e6) if p == 0 else (M_P, v * 1e5)
    return bisect(lambda V: run_plates(E_CH, m, V, 0.01, steps=4000) - target, 1e-3, 1e5, n=80)


def plate_charge(L, d, V):
    # square plates side L cm, gap d mm, voltage V; charge from Gauss: sigma = eps0 E, E = V/d (nC)
    E = V / (d / 1000)
    sigma = EPS0 * E
    return sigma * (L / 100) ** 2 * 1e9


def series_energy(C1, C2, V):
    # series: same Q on both; find Q from Q/C1 + Q/C2 = V by bisection, energy = sum Q^2/2C (uJ with uF)
    Q = bisect(lambda Q: Q / C1 + Q / C2 - V, 0.0, 1e6)
    return Q * Q / (2 * C1) + Q * Q / (2 * C2)


L2 = {
    'estat-2-01': (three_spheres, [dict(a=10, b=6), dict(a=3, b=12), dict(a=7, b=4)]),
    'estat-2-02': (force_on_middle, [dict(A=2, B=1, C=7, r1=12, r2=17), dict(A=9, B=3, C=2, r1=10, r2=8),
                                     dict(A=4, B=5, C=6, r1=5, r2=9)]),
    'estat-2-03': (zero_between, [dict(A=12, B=1, d=19, s=0), dict(A=2, B=9, d=30, s=1), dict(A=16, B=4, d=12, s=0)]),
    'estat-2-04': (work_by_field, [dict(Q=7, VA=-400, VB=-50), dict(Q=3, VA=250, VB=-100), dict(Q=9, VA=-150, VB=400)]),
    'estat-2-05': (accel_voltage, [dict(p=1, v=1.0), dict(p=0, v=5.5), dict(p=0, v=9.0)]),
    'estat-2-06': (plate_charge, [dict(L=23, d=0.5, V=250), dict(L=10, d=1.0, V=100), dict(L=5, d=5.0, V=50)]),
    'estat-2-07': (series_energy, [dict(C1=8, C2=1, V=14), dict(C1=3, C2=6, V=12), dict(C1=10, C2=10, V=24)]),
}


# ── Level 3 ──────────────────────────────────────────────────────────────────────────────────
def estat_3_01():
    # A = +7.0 uC, B = -3.0 uC, touch, back to 20 cm: force magnitude (N)
    A, B = touch(electrons(7), electrons(-3))
    qa, qb = float(A / Fraction(10 ** 14, 16)) * UC, float(B / Fraction(10 ** 14, 16)) * UC
    F = coulomb_force([(qa, (0.0, 0.0, 0.0))], qb, (0.20, 0.0, 0.0))
    assert F[0] > 0          # pushes B away from A: repulsion
    return norm(F)


def estat_3_02():
    # +8.0 uC at 0, -2.0 uC at 10 cm; potential (kV) where E = 0
    src = [(8.0 * UC, (0.0, 0.0, 0.0)), (-2.0 * UC, (0.10, 0.0, 0.0))]
    # between the charges E_x never changes sign (both fields point toward the negative charge)
    assert all(field(src, (x / 1000, 0.0, 0.0))[0] > 0 for x in range(1, 100))
    x = bisect(lambda x: field(src, (x, 0.0, 0.0))[0], 0.1001, 5.0)
    return potential(src, (x, 0.0, 0.0)) / 1000


def estat_3_03():
    # electron, plates 2.0 cm apart, upper +60 V lower -30 V, length 4.0 cm, v0 = 1.0e7 m/s; y at exit (mm, + up)
    # field from the potentials: E_y = -(V_top - V_bottom)/d (points down), force on q = -e is q E_y
    Ey = -(60 - (-30)) / 0.020
    y = run_plates(-E_CH, M_E, Ey * 0.020, 0.020, v0=1.0e7, L=0.040)
    return y * 1000


def estat_3_04():
    # plates 10 cm x 10 cm, 1.0 mm, +-4.0 nC; electron from rest at - plate: speed (x10^6 m/s)
    sigma = 4.0e-9 / (0.10 * 0.10)
    E = sigma / EPS0                      # Gauss: field between plates
    V = E * 1.0e-3
    return run_plates(-E_CH, M_E, V, 1.0e-3) / 1e6


def estat_3_05():
    # C1 = 3.0 uF in series with (C2 = 2.0 || C3 = 4.0), 18 V; field in C2 (gap 0.50 mm) in kV/m
    # node potential Vn of the isolated conductor between C1 and the pair (left at 18 V, right at 0):
    # its net charge stays zero: C1 (Vn - 18) + (C2 + C3)(Vn - 0) = 0
    C1, C2, C3 = 3.0, 2.0, 4.0
    Vn = bisect(lambda Vn: C1 * (Vn - 18) + (C2 + C3) * Vn, 0.0, 18.0)
    return Vn / 0.50e-3 / 1000


def estat_3_06():
    # oil drop 1.96e-15 kg, plates 0.80 cm, 240 V, held still; number of excess electrons
    E = 240 / 0.0080
    q = bisect(lambda q: q * E - 1.96e-15 * G, 0.0, 1e-15)
    return q / E_CH


out = {}
for item_id, (fn, cases) in L2.items():
    out[item_id] = [{'vars': c, 'answer': fn(**c)} for c in cases]
for name, fn in sorted(globals().copy().items()):
    if name.startswith('estat_3_'):
        out[name.replace('_', '-')] = fn()

print(json.dumps(out, indent=1, ensure_ascii=False))
