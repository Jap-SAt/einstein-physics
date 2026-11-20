"""Reference answers for assets/js/data/practice/nuclear.js, worked from the question texts.

Independent of the JS item functions, using different routes where possible:
- nuclear-2-01: radius from the volume of A nucleons, V = A (4/3) pi r0^3 with r0 = 1.2 fm, then R = (3V / 4 pi)^(1/3);
- nuclear-2-02: walks the real decay chains nuclide by nuclide (Th-234, Pa-234, ...), counts the alpha and beta
  emissions from successive (A, Z) and reads N = A - Z of the nuclide reached; no formula N0 - 2a - b;
- nuclear-2-03: halves the stated mass once per elapsed half-life in a loop;
- nuclear-2-04: lambda = ln 2 / T (not 0.693), T in seconds;
- nuclear-2-05: binding energy via E = (Delta m in kg) c^2 in joules, then joules -> MeV (CODATA u, c, e),
  not Delta m x 931.5;
- nuclear-2-06: the hidden fragment's mass number taken from a table of the real fragments, with both A and Z
  balances asserted, not 236 - known - x;
- nuclear-2-07: energy per fission in joules as 200e6 eV x 1.6e-19 J/eV;
- nuclear-3-01: initial U-238 from the helium count, then the age by bisection on N0 (1/2)^(t/T) = N;
- nuclear-3-02: Q written as gains per nucleon of each fragment minus the binding of the two nucleons that end up free;
- nuclear-3-03: energy of the same number of fuel nucleons (1180 = 5 x 236) burned each way;
- nuclear-3-04: Q from the binding energies of Pu-238, U-234 and He-4 (with mp, mn), and decays in the first
  second as N (1 - 2^(-1 s / T));
- nuclear-3-05: Eb(He-4) - Eb(He-3);
- nuclear-3-06: decays in 24 h by integrating the falling activity A(t) = A0 2^(-t/T) numerically.
Level 2 uses three hand-chosen variable sets on each item's grid.
Run: python3 tests/practice-ref/compute_nuclear.py > tests/practice-ref/nuclear.json
"""
import json
import math

U_MEV = 931.5                 # MeV per u, as stated
MP, MN = 1.007276, 1.008665   # u, as stated
MEV_J = 1.6e-13               # J per MeV, as stated
YEAR = 3.16e7                 # s, as stated
U_KG = 1.66053906660e-27      # CODATA (2-05 only, independent route)
C = 2.99792458e8
E_CHARGE = 1.602176634e-19


def bisect(fn, lo, hi, it=200):
    flo = fn(lo)
    for _ in range(it):
        mid = (lo + hi) / 2
        fm = fn(mid)
        if (fm > 0) == (flo > 0):
            lo, flo = mid, fm
        else:
            hi = mid
    return (lo + hi) / 2


ref = {}

# nuclear-2-01: radius (1e-15 m) of the nuclide at index i: He-4, C-12, O-16, Al-27, Fe-56, Cu-63, Ag-107, Au-197, Pb-208, U-238
A_LIST = [4, 12, 16, 27, 56, 63, 107, 197, 208, 238]
def radius_fm(A):
    r0 = 1.2
    V = A * 4 / 3 * math.pi * r0 ** 3
    return (3 * V / (4 * math.pi)) ** (1 / 3)
ref['nuclear-2-01'] = [{'vars': {'i': i}, 'answer': radius_fm(A_LIST[i])} for i in (0, 4, 9)]

# nuclear-2-02: chains c = 0 U-238, 1 U-235, 2 Th-232 as lists of real nuclides (A, Z); k = decays so far
CHAIN_NUCLIDES = [
    [(238, 92), (234, 90), (234, 91), (234, 92), (230, 90), (226, 88), (222, 86), (218, 84), (214, 82), (214, 83),
     (214, 84), (210, 82), (210, 83), (210, 84), (206, 82)],
    [(235, 92), (231, 90), (231, 91), (227, 89), (227, 90), (223, 88), (219, 86), (215, 84), (211, 82), (211, 83),
     (207, 81), (207, 82)],
    [(232, 90), (228, 88), (228, 89), (228, 90), (224, 88), (220, 86), (216, 84), (212, 82), (212, 83), (212, 84),
     (208, 82)],
]
def chain_neutrons(c, k):
    nuc = CHAIN_NUCLIDES[c]
    alphas = betas = 0
    for (A1, Z1), (A2, Z2) in zip(nuc[:k], nuc[1:k + 1]):
        if A1 - A2 == 4 and Z1 - Z2 == 2:
            alphas += 1
        elif A1 == A2 and Z2 - Z1 == 1:
            betas += 1
        else:
            raise ValueError((A1, Z1, A2, Z2))
    assert alphas >= 1 and betas >= 1
    A, Z = nuc[k]
    return A - Z
ref['nuclear-2-02'] = [{'vars': {'c': c, 'k': k}, 'answer': chain_neutrons(c, k)} for c, k in [(0, 3), (1, 9), (2, 10)]]
assert chain_neutrons(0, 14) == 124 and chain_neutrons(1, 11) == 125 and chain_neutrons(2, 10) == 126

# nuclear-2-03: m0 mg after k half-lives (t printed as k T); halve in a loop
def remaining(m0, k):
    m = m0
    for _ in range(k):
        m /= 2
    return m
ref['nuclear-2-03'] = [{'vars': {'i': i, 'm0': m0, 'k': k}, 'answer': remaining(m0, k)}
                       for i, m0, k in [(0, 40, 4), (3, 250, 2), (6, 800, 5)]]

# nuclear-2-04: activity (MBq) of k x 10^p nuclei; i -> (T, seconds per unit, p)
ACT = {0: (8.02, 86400, 14), 1: (6.01, 3600, 12), 2: (14.3, 86400, 14), 3: (3.82, 86400, 13)}
def activity_MBq(i, k):
    T, sec, p = ACT[i]
    lam = math.log(2) / (T * sec)
    return lam * k * 10 ** p / 1e6
ref['nuclear-2-04'] = [{'vars': {'i': i, 'k': k}, 'answer': activity_MBq(i, k)} for i, k in [(0, 1.0), (1, 5.5), (3, 9.9)]]

# nuclear-2-05: binding energy per nucleon (MeV) from the stated nucleus mass, via joules
BN = {0: (2, 4, 4.001506), 1: (3, 7, 7.014358), 2: (6, 12, 11.996709), 3: (8, 16, 15.990526),
      4: (26, 56, 55.920673), 5: (47, 107, 106.879308), 6: (82, 208, 207.931669), 7: (92, 235, 234.993461)}
def be_per_nucleon(i):
    Z, A, m = BN[i]
    dm_kg = (Z * MP + (A - Z) * MN - m) * U_KG
    E_J = dm_kg * C ** 2
    return E_J / (E_CHARGE * 1e6) / A
ref['nuclear-2-05'] = [{'vars': {'i': i}, 'answer': be_per_nucleon(i)} for i in (0, 4, 7)]

# nuclear-2-06: n + U-235 -> fragments + x n; h = 0 hides the heavy fragment, 1 the light one
FRAG = {0: ((141, 56), (92, 36), 3), 1: ((144, 56), (89, 36), 3), 2: ((140, 54), (94, 38), 2), 3: ((140, 55), (93, 37), 3),
        4: ((137, 52), (97, 40), 2), 5: ((132, 50), (101, 42), 3), 6: ((148, 57), (85, 35), 3), 7: ((139, 56), (95, 36), 2)}
def hidden_A(c, h):
    heavy, light, x = FRAG[c]
    assert 1 + 235 == heavy[0] + light[0] + x and 0 + 92 == heavy[1] + light[1]
    return (heavy if h == 0 else light)[0]
ref['nuclear-2-06'] = [{'vars': {'c': c, 'h': h}, 'answer': hidden_A(c, h)} for c, h in [(0, 0), (4, 1), (6, 1)]]

# nuclear-2-07: fissions per second (1e18) in a P MW reactor, 200 MeV each
def fissions(P):
    E1 = 200e6 * 1.6e-19
    return P * 1e6 / E1 / 1e18
ref['nuclear-2-07'] = [{'vars': {'P': P}, 'answer': fissions(P)} for P in (100, 1000, 3600)]

# nuclear-3-01: rock with 2.0e20 U-238 left and 1.6e21 He atoms; age in 1e9 y
T_U = 4.47
alphas = sum(1 for (A1, _), (A2, _) in zip(CHAIN_NUCLIDES[0], CHAIN_NUCLIDES[0][1:]) if A1 - A2 == 4)
N_now = 2.0e20
N0 = N_now + 1.6e21 / alphas
ref['nuclear-3-01'] = bisect(lambda t: N0 * 0.5 ** (t / T_U) - N_now, 0.0, 50.0)

# nuclear-3-02: fission Q (MeV) from binding energies per nucleon 7.59 (U), 8.33 (Ba), 8.51 (Kr)
# 235 bound nucleons before, 233 after: each kept nucleon gains (b_frag - b_U); the two that end up free lose b_U
ref['nuclear-3-02'] = 141 * (8.33 - 7.59) + 92 * (8.51 - 7.59) - 2 * 7.59

# nuclear-3-03: same number of fuel nucleons (1180) burned by D-T fusion vs U-235 fission (200 MeV, 236 nucleons)
Q_dt = (2.013553 + 3.015501 - (4.001506 + MN)) * U_MEV
n_nucleons = 5 * 236
ref['nuclear-3-03'] = (n_nucleons / 5 * Q_dt) / (n_nucleons / 236 * 200)

# nuclear-3-04: Pu-238 alpha source, 2.5e24 nuclei, T = 87.7 y; heat (W)
def binding(Z, A, m):
    return (Z * MP + (A - Z) * MN - m) * U_MEV
Q_alpha = binding(92, 234, 233.990483) + binding(2, 4, 4.001506) - binding(94, 238, 237.997994)
T_s = 87.7 * YEAR
decays_first_second = 2.5e24 * (1 - 2 ** (-1 / T_s))
ref['nuclear-3-04'] = decays_first_second * Q_alpha * MEV_J

# nuclear-3-05: energy to pull one neutron out of He-4 (leaving He-3), MeV
ref['nuclear-3-05'] = binding(2, 4, 4.001506) - binding(2, 3, 3.014932)

# nuclear-3-06: Tc-99m, A0 = 800 MBq, T = 6.0 h; gamma photons (one per decay) emitted in 24 h, in 1e13
A0, T_tc, t_end, steps = 800e6, 6.0 * 3600, 24 * 3600, 200000
dt = t_end / steps
decays = sum(A0 * 2 ** (-((j + 0.5) * dt) / T_tc) * dt for j in range(steps))   # midpoint rule
ref['nuclear-3-06'] = decays / 1e13

print(json.dumps(ref, indent=1, ensure_ascii=False))
