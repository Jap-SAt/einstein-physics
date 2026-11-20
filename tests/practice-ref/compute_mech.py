"""Reference answers for assets/js/data/practice/mech.js, worked from the question texts.

Independent of the JS item functions: each answer is derived here from the physics stated in the
question. Level 2 uses three hand-chosen variable sets inside each item's ranges.
Run: python3 tests/practice-ref/compute_mech.py > tests/practice-ref/mech.json
"""
import json
import math

g = 9.8


def kmh_to_ms(v):
    return v * 1000 / 3600


# mech-2-01: walk a m east then b m north -> magnitude of displacement
def walk(a, b):
    return math.hypot(a, b)


# mech-2-02: car at V km/h brakes with constant deceleration a m/s^2 until it stops -> distance
def braking(V, a):
    u = kmh_to_ms(V)
    t = u / a                      # time to stop
    return u * t - 0.5 * a * t ** 2


# mech-2-03: slide from rest down a frictionless water slide, drop h -> speed at the bottom
def slide(m, h):
    pe = m * g * h                 # energy released
    return math.sqrt(2 * pe / m)


# mech-2-04: kick from the ground at u m/s, angle th -> maximum height
def max_height(u, th):
    uy = u * math.sin(math.radians(th))
    t_top = uy / g
    return uy * t_top - 0.5 * g * t_top ** 2


# mech-2-05: push F N horizontally on an m kg box, kinetic friction mu, level floor -> acceleration
def push(m, mu, F):
    normal = m * g
    return (F - mu * normal) / m


# mech-2-06: cart m1 at v1 hits cart m2 at rest (m2 != m1), they stick -> common velocity
def stick(m1, m2, v1):
    p = m1 * v1
    return p / (m1 + m2)


# mech-2-07: car m kg on a flat curve radius r at V km/h -> required friction (centripetal) force
def curve(m, V, r):
    v = kmh_to_ms(V)
    return m * v ** 2 / r


L2 = {
    'mech-2-01': (walk, [dict(a=60, b=80), dict(a=150, b=40), dict(a=200, b=200)]),
    'mech-2-02': (braking, [dict(V=36, a=5), dict(V=72, a=6.5), dict(V=108, a=8)]),
    'mech-2-03': (slide, [dict(m=30, h=5), dict(m=45, h=2.5), dict(m=60, h=12)]),
    'mech-2-04': (max_height, [dict(u=20, th=25), dict(u=12, th=65), dict(u=27, th=40)]),
    'mech-2-05': (push, [dict(m=20, mu=0.3, F=100), dict(m=10, mu=0.25, F=35), dict(m=30, mu=0.4, F=180)]),
    'mech-2-06': (stick, [dict(m1=2, m2=1, v1=3), dict(m1=0.5, m2=2.5, v1=1.2), dict(m1=1.5, m2=1, v1=4)]),
    'mech-2-07': (curve, [dict(m=1200, V=54, r=100), dict(m=1000, V=36, r=200), dict(m=1800, V=72, r=80)]),
}


def mech_3_01():
    # 1200 kg, 0 -> 72 km/h in 10 s, constant resistance 600 N -> driving force
    a = kmh_to_ms(72) / 10
    return 1200 * a + 600


def mech_3_02():
    # thrown horizontally at 15 m/s from a 20 m cliff -> impact speed (energy)
    return math.sqrt(15 ** 2 + 2 * g * 20)


def mech_3_03():
    # 20 kg box, rope 100 N at 30 deg above horizontal, mu_k 0.30 -> acceleration
    F, th, m, mu = 100, math.radians(30), 20, 0.30
    normal = m * g - F * math.sin(th)
    return (F * math.cos(th) - mu * normal) / m


def mech_3_04():
    # 0.50 kg clay at 6.0 m/s sticks to 2.5 kg block, mu_k 0.20 -> sliding distance
    v = 0.50 * 6.0 / (0.50 + 2.5)
    decel = 0.20 * g
    return v ** 2 / (2 * decel)


def mech_3_05():
    # from rest 20 m above the bottom of a dip of radius 15 m, rider 60 kg -> seat force at bottom
    v2 = 2 * g * 20
    return 60 * g + 60 * v2 / 15


def mech_3_06():
    # ISS at 400 km, G, M_E = 5.97e24 kg, R_E = 6370 km -> period in minutes (Kepler form)
    GM = 6.674e-11 * 5.97e24
    r = (6370 + 400) * 1000
    return 2 * math.pi * math.sqrt(r ** 3 / GM) / 60


out = {}
for item_id, (fn, cases) in L2.items():
    out[item_id] = [{'vars': c, 'answer': fn(**c)} for c in cases]
for name, fn in sorted(globals().copy().items()):
    if name.startswith('mech_3_'):
        out[name.replace('_', '-')] = fn()

print(json.dumps(out, indent=1, ensure_ascii=False))
