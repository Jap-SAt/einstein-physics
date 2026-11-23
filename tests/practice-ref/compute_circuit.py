"""Reference answers for assets/js/data/practice/circuit.js, worked from the question texts.

Independent of the JS item functions wherever a different route exists:
- electron counts add up the charge second by second, then count electrons of charge e;
- wire resistance sums thin slices dR = rho dx / A along the wire (A from the circle of the stated diameter);
- internal resistance comes from the power balance eps I = V I + I^2 r, not from V = eps - I r;
- resistor networks and the two-loop circuits are solved by NODE POTENTIAL (Kirchhoff's junction rule at the
  top node, found by bisection), never by series/parallel formulas or loop equations as the JS does;
- the heater pair is solved by bisection on the loop current, then P = V^2/R with each coil's own voltage;
- RC circuits are integrated numerically (RK4 on dq/dt = (eps - q/C)/R_loop), and "time to reach" is the
  first step where V_C crosses the target, refined by bisection on the integrated curve (no logarithm);
- the maximum-power question first solves eps and r from the two readings, then scans R for the maximum;
- the charging cost integrates V I dt with V = eps + I r over the charging time.
Level 2 uses three hand-chosen variable sets on each item's grid.
Run: python3 tests/practice-ref/compute_circuit.py > tests/practice-ref/circuit.json
"""
import json
import math

E_CH = 1.6e-19      # C, as stated in the questions
RHO_NI = 1.1e-6     # ohm m, nichrome, as stated in the question


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


def rk4_charge(eps, R_loop, C, t_end, steps=20000):
    """capacitor starting empty, charged through R_loop; returns V_C(t_end)"""
    f = lambda q: (eps - q / C) / R_loop
    h, q = t_end / steps, 0.0
    for _ in range(steps):
        k1 = f(q)
        k2 = f(q + h * k1 / 2)
        k3 = f(q + h * k2 / 2)
        k4 = f(q + h * k3)
        q += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
    return q / C


# ── Level 2 ──────────────────────────────────────────────────────────────────────────────────
def electrons(I, t):
    # I mA for t minutes; count electrons through a cross-section (units of 1e19)
    Q = sum(I / 1000 * 1.0 for _ in range(int(t * 60)))   # charge in each second, added up
    return Q / E_CH / 1e19


def nichrome_current(L, d, V):
    # length L m, diameter d mm, voltage V; resistance as a sum of slices
    A = math.pi * (d / 1000) ** 2 / 4
    n = 10000
    R = sum(RHO_NI * (L / n) / A for _ in range(n))
    return V / R


def internal_r(eps, I, r):
    # question shows eps, I and the terminal reading V (2 decimals); r from the power balance
    V = round(eps - I * r, 2)
    return (eps * I - V * I) / I ** 2


def branch_current(eps, r, R1, R2, R3):
    # (R1 + R2) || R3 across a battery (eps, r); node potential V of the top node
    kcl = lambda V: (eps - V) / r - V / (R1 + R2) - V / R3     # current in = current out
    V = bisect(kcl, 0.0, eps)
    return V / R3


def two_loop_I2(e1, R1, e2, R2, R3):
    # node A above B (B = 0 V); branches: e1 + R1, R3, e2 + R2, + terminals toward A
    # current up the right branch (out of the + terminal of e2) = (e2 - V_A)/R2
    kcl = lambda V: (e1 - V) / R1 + (e2 - V) / R2 - V / R3
    V = bisect(kcl, -100.0, 100.0)
    return (e2 - V) / R2


def heater_power(hi, P1, P2):
    # coils rated V0/P1 and V0/P2 in series across V0; power in coil A
    V0 = 24 if hi else 12
    RA, RB = V0 ** 2 / P1, V0 ** 2 / P2
    I = bisect(lambda I: V0 - I * RA - I * RB, 0.0, 100.0)
    VA = I * RA
    return VA ** 2 / RA


def rc_voltage(eps, r, R, C, t):
    # charging from empty through R with the battery's r in the loop; C in mF, t in ms
    return rk4_charge(eps, R + r, C * 1e-3, t * 1e-3)


L2 = {
    'circuit-2-01': (electrons, [dict(I=250, t=4), dict(I=40, t=9), dict(I=480, t=2)]),
    'circuit-2-02': (nichrome_current, [dict(L=2.5, d=0.5, V=6.0), dict(L=1.0, d=0.3, V=4.5), dict(L=4.0, d=0.85, V=12.0)]),
    'circuit-2-03': (internal_r, [dict(eps=12.0, I=2.5, r=0.6), dict(eps=9.0, I=1.5, r=1.3), dict(eps=22.5, I=4.0, r=0.2)]),
    'circuit-2-04': (branch_current, [dict(eps=12.0, r=1.0, R1=4, R2=8, R3=6), dict(eps=19.5, r=0.5, R1=3, R2=17, R3=10),
                                      dict(eps=7.5, r=2.0, R1=2, R2=2, R3=15)]),
    'circuit-2-05': (two_loop_I2, [dict(e1=12.0, R1=2.0, e2=4.5, R2=1.5, R3=6), dict(e1=6.0, R1=3.0, e2=21.0, R2=4.5, R3=2),
                                   dict(e1=10.5, R1=1.0, e2=9.0, R2=2.0, R3=12)]),
    'circuit-2-06': (heater_power, [dict(hi=0, P1=60, P2=20), dict(hi=1, P1=100, P2=40), dict(hi=0, P1=30, P2=15)]),
    'circuit-2-07': (rc_voltage, [dict(eps=12.0, r=1.0, R=9, C=2.0, t=16), dict(eps=18.0, r=2.5, R=4, C=4.5, t=40),
                                  dict(eps=7.5, r=0.5, R=15, C=1.0, t=6)]),
}


# ── Level 3 ──────────────────────────────────────────────────────────────────────────────────
def circuit_3_01():
    # 24 V, r 2.0; R1 2.0 in series with (R2 6.0 || (R3 4.0 + R4 8.0)); power in R4
    kcl = lambda V: (24 - V) / (2.0 + 2.0) - V / 6.0 - V / (4.0 + 8.0)   # node after R1 (r and R1 in series)
    V = bisect(kcl, 0.0, 24.0)
    I4 = V / 12.0
    return I4 ** 2 * 8.0


def circuit_3_02():
    # readings: 2.0 ohm -> 10 V, 5.0 ohm -> 12.5 V; eps and r by elimination, then scan R for max power
    I1, I2 = 10 / 2.0, 12.5 / 5.0
    r = (12.5 - 10) / (I1 - I2)
    eps = 10 + I1 * r
    best = 0.0
    for k in range(1, 200001):
        R = k * 1e-5 * 5            # 0.00005 .. 10 ohm
        P = (eps / (R + r)) ** 2 * R
        best = max(best, P)
    return best


def circuit_3_03():
    # eps1 14 V (0.50), eps2 12 V (0.25) both + to A, lamp 1.5 between A and B; current out of + of eps2
    return two_loop_I2(14, 0.50, 12, 0.25, 1.5)


def circuit_3_04():
    # 12 V, r 2.0, R 8.0, C 2.5 mF from empty; time (ms) for V_C to reach 9.0 V, by integrating
    C, Rl, eps = 2.5e-3, 10.0, 12.0
    h, q, t = 1e-6, 0.0, 0.0
    f = lambda q: (eps - q / C) / Rl
    while q / C < 9.0:
        prev_t, prev_v = t, q / C
        k1 = f(q); k2 = f(q + h * k1 / 2); k3 = f(q + h * k2 / 2); k4 = f(q + h * k3)
        q += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
        t += h
    v_now = q / C
    t_cross = prev_t + (9.0 - prev_v) / (v_now - prev_v) * h      # linear within one microsecond step
    return t_cross * 1000


def circuit_3_05():
    # C1 30 uF and C2 60 uF in series with 5.0 kOhm and 12 V; the same charge q on both; V across C1 at 0.20 s
    C1, C2, R, eps = 30e-6, 60e-6, 5.0e3, 12.0
    f = lambda q: (eps - q / C1 - q / C2) / R                       # loop rule with each capacitor's own q/C
    n, T = 40000, 0.20
    h, q = T / n, 0.0
    for _ in range(n):
        k1 = f(q); k2 = f(q + h * k1 / 2); k3 = f(q + h * k2 / 2); k4 = f(q + h * k3)
        q += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
    return q / C1


def circuit_3_06():
    # 50 A into a battery eps 380 V, r 0.40 for 1.5 h; energy at the terminals integrated over time; 4.0 baht/kWh
    n, T = 3600, 1.5 * 3600
    J = sum((380 + 50 * 0.40) * 50 * (T / n) for _ in range(n))
    return J / 3.6e6 * 4.0


out = {}
for item_id, (fn, cases) in L2.items():
    out[item_id] = [{'vars': c, 'answer': fn(**c)} for c in cases]
for name, fn in sorted(globals().copy().items()):
    if name.startswith('circuit_3_'):
        out[name.replace('_', '-')] = fn()

print(json.dumps(out, indent=1, ensure_ascii=False))
