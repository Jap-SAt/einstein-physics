"""Reference answers for assets/js/data/practice/waves.js, worked from the question texts.

Independent of the JS item functions: each answer is derived here from the physics stated in the
question, often by a different route (e.g. ray geometry and bisection instead of closed formulas,
Newton's lens form x_o x_i = f^2, exact fringe angle with tan instead of the small-angle formula,
counting grating orders one by one). Level 2 uses three hand-chosen variable sets on each item's grid.
Run: python3 tests/practice-ref/compute_waves.py > tests/practice-ref/waves.json
"""
import json
import math

DEG = math.pi / 180
C = 3.0e8                          # m/s, as stated in the questions
V_SOUND = 343.0                    # m/s, as stated in waves-3-02

# refractive indices exactly as printed in the questions
MEDIA = [1.33, 1.49, 1.52, 1.66]   # water, acrylic, glass, flint glass (waves-2-04 index md)
PAIRS = [(1.33, 1.00), (1.49, 1.00), (1.52, 1.00), (1.66, 1.00), (2.42, 1.00),
         (1.52, 1.33), (1.66, 1.33), (2.42, 1.33)]   # (inside, outside) for waves-2-05 index p


def bisect(fn, lo, hi, n=200):
    """root of an increasing-or-decreasing fn on [lo, hi] (sign change required)"""
    flo = fn(lo)
    assert flo * fn(hi) < 0
    for _ in range(n):
        mid = (lo + hi) / 2
        if fn(mid) * flo > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


# waves-2-01: ball bobs N times in t s, crests lam cm apart -> wave speed (m/s)
def ripple_speed(lam, N, t):
    period = t / N                         # time for one up-and-down
    crest_advance = lam / 100              # in one period a crest moves one wavelength (m)
    return crest_advance / period


# waves-2-02: rope L m, mass m g, tension F N -> wave speed (m/s)
def rope_speed(L, m, F):
    mass_per_metre = (m * 1e-3) / L
    return (F / mass_per_metre) ** 0.5


# waves-2-03: string L cm fixed at both ends, k loops, wave speed v -> driving frequency (Hz)
def loops_frequency(L, k, v):
    loop_length = (L / 100) / k            # node to node
    wavelength = 2 * loop_length
    return v / wavelength


# waves-2-04: ray at al deg to the SURFACE of medium md from air -> refraction angle from the normal
def refraction_angle(md, al):
    n2 = MEDIA[md]
    incidence = 90 - al                    # angle from the normal
    # solve n1 sin(i) = n2 sin(r) for r by bisection (n1 = 1.00)
    return bisect(lambda r: n2 * math.sin(r * DEG) - 1.00 * math.sin(incidence * DEG), 0.0, 89.9)


# waves-2-05: critical angle for pair p: the incidence angle whose refracted ray is at 90 deg
def critical_angle(p):
    n_in, n_out = PAIRS[p]
    return bisect(lambda i: n_in * math.sin(i * DEG) - n_out, 0.0, 90.0)


# waves-2-06: k-th bright fringe of a double slit (lam nm, d mm, screen L m) -> distance from centre (mm)
def bright_fringe(lam, d, L, k):
    theta = math.asin(k * lam * 1e-9 / (d * 1e-3))   # exact direction of the k-th maximum
    return L * math.tan(theta) * 1000                 # exact position on a flat screen (small-angle error < 0.1 %)


# waves-2-07: convex lens f cm, object u cm -> signed image distance (real +, virtual -)
def image_distance(fo, u):
    # Newton's form: (u - f)(v - f) = f^2, same lens equation written from the focal points
    return fo + fo * fo / (u - fo)


L2 = {
    'waves-2-01': (ripple_speed, [dict(lam=50, N=8, t=4.8), dict(lam=20, N=12, t=9.6), dict(lam=80, N=5, t=2.0)]),
    'waves-2-02': (rope_speed, [dict(L=5, m=200, F=50), dict(L=2, m=600, F=20), dict(L=8, m=100, F=200)]),
    'waves-2-03': (loops_frequency, [dict(L=100, k=3, v=60), dict(L=40, k=5, v=200), dict(L=150, k=2, v=20)]),
    'waves-2-04': (refraction_angle, [dict(md=0, al=40), dict(md=2, al=30), dict(md=3, al=25)]),
    'waves-2-05': (critical_angle, [dict(p=2), dict(p=4), dict(p=6)]),
    'waves-2-06': (bright_fringe, [dict(lam=600, d=0.2, L=1.0, k=2), dict(lam=400, d=0.5, L=0.5, k=3),
                                   dict(lam=700, d=0.1, L=3.0, k=4)]),
    'waves-2-07': (image_distance, [dict(fo=10, u=30), dict(fo=10, u=6), dict(fo=20, u=26)]),
}


def waves_3_01():
    # guitar string 4.0 g/m, 65 cm between fixed ends, fundamental 110 Hz -> tension (N)
    mu, L, f = 4.0e-3, 0.65, 110
    v = f * (2 * L)                         # fundamental: one loop, string = half a wavelength
    return mu * v ** 2                      # v^2 = F/mu


def waves_3_02():
    # speakers A, B 3.0 m apart in phase; P 4.0 m from A with AP perpendicular to AB; v = 343 m/s
    A, B, P = (0.0, 0.0), (3.0, 0.0), (0.0, 4.0)
    dr = math.dist(B, P) - math.dist(A, P)
    # destructive when dr = (n + 1/2) lam; scan frequencies upward, the first one that cancels
    candidates = [V_SOUND * (n + 0.5) / dr for n in range(5)]
    return min(candidates)


def waves_3_03():
    # Young's slits in water n = 1.33, 633 nm (air), d = 0.25 mm, L = 1.20 m -> fringe spacing (mm)
    f = C / 633e-9                          # frequency fixed by the laser
    lam_water = (C / 1.33) / f              # v = c/n in water
    return lam_water * 1.20 / 0.25e-3 * 1000


def waves_3_04():
    # laser 5.0e14 Hz, grating 300 lines/mm, all directions caught -> number of bright spots
    lam = C / 5.0e14
    d = 1e-3 / 300
    count = 0
    for n in range(-50, 51):                # every order whose direction exists (|sin theta| <= 1)
        if abs(n * lam / d) <= 1:
            count += 1
    return float(count)


def waves_3_05():
    # ripple tank imaged by a convex lens f = 20 cm, water 25 cm away; screen spacing 6.0 cm; 15 Hz
    f, u = 20.0, 25.0
    v = bisect(lambda x: 1 / u + 1 / x - 1 / f, 21.0, 1000.0)   # sharp image distance
    magnification = v / u
    real_wavelength = 6.0 / magnification   # cm
    return 15 * real_wavelength


def waves_3_06():
    # ripple tank: 12 Hz, 2.0 cm in deep water; 50 deg in, 35 deg out -> speed in shallow water (cm/s)
    # Huygens: along the boundary both wavefronts advance the same distance per period,
    # lam1 / sin(i) = lam2 / sin(r); the frequency is unchanged.
    lam2 = 2.0 * math.sin(35 * DEG) / math.sin(50 * DEG)
    return 12 * lam2


out = {}
for item_id, (fn, cases) in L2.items():
    out[item_id] = [{'vars': c, 'answer': fn(**c)} for c in cases]
for name, fn in sorted(globals().copy().items()):
    if name.startswith('waves_3_'):
        out[name.replace('_', '-')] = fn()

print(json.dumps(out, indent=1, ensure_ascii=False))
