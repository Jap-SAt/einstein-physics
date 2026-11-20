"""Reference answers for assets/js/data/practice/atom.js, worked from the question texts.

Independent of the JS item functions, using different routes where possible:
- photon energies of hydrogen transitions from the Rydberg formula 1/lambda = R_H (1/nf^2 - 1/ni^2)
  with R_H = 1.097e7 m^-1 (the lecture's other form), not from 13.6 (1/nf^2 - 1/ni^2);
- atom-2-01: old level + the printed photon energy, then the allowed level it lands on (checked for every pair);
- atom-2-02: binding energy from the stated orbit radius through Coulomb energy E = -k e^2 / (2 r)
  (k = 8.99e9 N m^2/C^2, CODATA e), not from n;
- photoelectric photon energies as h f with f = c / lambda and h in eV s taken from the stated hc = 1240 eV nm;
- atom-2-05 threshold frequency by bisection on h f (J) = W (J);
- de Broglie wavelengths as h / sqrt(2 m K) (momentum from kinetic energy), not h / (m v) with v = sqrt(2K/m);
- atom-3-02 speed by bisection on (1/2) m v^2 = K;
- atom-3-01 by enumerating every downward jump from the level reached and taking the longest wavelength;
- atom-3-04 from the standing-wave condition 2 pi r_3 = 3 lambda (r_3 = 9 a0), not h / (m v_3).
Level 2 uses three hand-chosen variable sets on each item's grid.
Run: python3 tests/practice-ref/compute_atom.py > tests/practice-ref/atom.json
"""
import json
import math

RH = 1.097e7          # m^-1, as in the lecture
HC_EVNM = 1240.0      # eV nm, as stated
C = 3.0e8             # m/s (only to turn hc into h in eV s)
H = 6.63e-34          # J s, as stated
QE = 1.6e-19          # C, as stated
ME = 9.11e-31         # kg, as stated
A0 = 0.0529           # nm, as stated
K_COUL = 8.99e9       # N m^2 / C^2 (independent check only)
E_CODATA = 1.602176634e-19
H_EVS = HC_EVNM * 1e-9 / C    # h in eV s implied by hc = 1240 eV nm


def level(n):
    return -13.6 / n ** 2


def rydberg_lambda_nm(ni, nf):
    """wavelength (nm) of the photon for a jump between ni and nf (either direction)"""
    lo, hi = min(ni, nf), max(ni, nf)
    return 1e9 / (RH * (1 / lo ** 2 - 1 / hi ** 2))


def photon_eV_from_lambda_nm(lam_nm):
    return H_EVS * (C / (lam_nm * 1e-9))      # E = h f, f = c / lambda


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


def de_broglie_from_K(m, K_joule):
    return H / math.sqrt(2 * m * K_joule)


ref = {}

# atom-2-01: electron at ni absorbs the photon shown in the question (2 decimals) and rises; energy of the new
# level (eV). Route of a learner: old level + shown photon energy, then name the allowed level it lands on.
# The raw sum must already be within the 2 % tolerance of that level for every pair the item draws.
UP = [(1, 2), (1, 3), (1, 4), (1, 5), (2, 3), (2, 4), (2, 5), (2, 6)]
def new_level(ni, nf):
    shown = round(HC_EVNM / rydberg_lambda_nm(ni, nf), 2)       # photon energy as printed (Rydberg route)
    raw = level(ni) + shown
    n = min(range(1, 30), key=lambda k: abs(level(k) - raw))
    assert n == nf and abs(raw - level(n)) <= 0.02 * abs(level(n)), (ni, nf, raw)
    return level(n)
for a, b in UP:
    new_level(a, b)
ref['atom-2-01'] = [{'vars': {'ni': a, 'nf': b}, 'answer': new_level(a, b)} for a, b in [(1, 2), (1, 5), (2, 6)]]

# atom-2-02: orbit radius r = 0.0529 k^2 nm shown to 3 s.f.; energy needed to remove the electron (eV)
def ionize_from_radius(k):
    r_shown = float(f'{A0 * k * k:.3g}') * 1e-9
    E_J = -K_COUL * E_CODATA ** 2 / (2 * r_shown)
    return -E_J / E_CODATA
ref['atom-2-02'] = [{'vars': {'k': k}, 'answer': ionize_from_radius(k)} for k in (2, 4, 6)]

# atom-2-03: emitted wavelength (nm) for ni -> nf, Rydberg form
ref['atom-2-03'] = [{'vars': {'ni': a, 'nf': b}, 'answer': rydberg_lambda_nm(a, b)} for a, b in [(2, 1), (3, 2), (4, 3)]]

# atom-2-04: stopping potential (V); metals index -> work function as listed in the question
W_METAL = {0: 2.10, 1: 2.28, 2: 2.90, 3: 3.68, 4: 4.30}
ref['atom-2-04'] = [{'vars': {'m': m, 'lam': lam}, 'answer': photon_eV_from_lambda_nm(lam) - W_METAL[m]}
                    for m, lam in [(0, 510), (2, 300), (4, 200)]]

# atom-2-05: threshold frequency in 1e14 Hz from W (eV), bisection on h f = W e
def f0(W):
    return bisect(lambda f: H * f - W * QE, 1e13, 1e16) / 1e14
ref['atom-2-05'] = [{'vars': {'W': W}, 'answer': f0(W)} for W in (1.90, 3.35, 5.00)]

# atom-2-06: scale model; object diameter d (cm) stands for a nucleus of a x 1e-15 m; atom is b x 1e-10 m
D_OBJ = {0: 0.40, 1: 1.6, 2: 4.0, 3: 6.7, 4: 22}
def model_atom_m(o, a, b):
    obj_m = D_OBJ[o] * 0.01
    scale = obj_m / (a * 1e-15)          # metres of model per metre of reality
    return (b * 1e-10) * scale
ref['atom-2-06'] = [{'vars': {'o': o, 'a': a, 'b': b}, 'answer': model_atom_m(o, a, b)}
                    for o, a, b in [(0, 14.0, 1.0), (3, 6.0, 1.5), (4, 2.0, 3.0)]]

# atom-2-07: electron with kinetic energy K eV -> de Broglie wavelength (nm)
ref['atom-2-07'] = [{'vars': {'K': K}, 'answer': de_broglie_from_K(ME, K * QE) * 1e9} for K in (20, 54, 500)]

# atom-3-01: ground state + 12.75 eV photon -> which level; longest wavelength among all downward jumps
E_new = level(1) + 12.75
n_up = min(range(1, 20), key=lambda k: abs(level(k) - E_new))
jumps = [(a, b) for a in range(2, n_up + 1) for b in range(1, a)]
ref['atom-3-01'] = max(rydberg_lambda_nm(a, b) for a, b in jumps)

# atom-3-02: n = 2 electron freed by a 300 nm photon; speed in 1e5 m/s (bisection on (1/2) m v^2 = K)
K_ev = photon_eV_from_lambda_nm(300) - (0 - level(2))
v = bisect(lambda s: 0.5 * ME * s * s - K_ev * QE, 0.0, 1e8)
ref['atom-3-02'] = v / 1e5

# atom-3-03: 200 nm on zinc (W = 4.30 eV): fastest photoelectron's de Broglie wavelength (nm)
K_ev = photon_eV_from_lambda_nm(200) - 4.30
ref['atom-3-03'] = de_broglie_from_K(ME, K_ev * QE) * 1e9

# atom-3-04: n = 3 orbit: standing wave 2 pi r_3 = 3 lambda, r_3 = 9 a0
ref['atom-3-04'] = 2 * math.pi * (9 * A0) / 3

# atom-3-05: alpha particle, m = 7300 m_e, v = 1.6e7 m/s; wavelength in 1e-15 m (via kinetic energy)
m_a = 7300 * ME
K_a = 0.5 * m_a * (1.6e7) ** 2
ref['atom-3-05'] = de_broglie_from_K(m_a, K_a) / 1e-15

# atom-3-06: 4 -> 2 line gives V_s = 0.40 V; threshold wavelength (nm)
photon_42 = HC_EVNM / rydberg_lambda_nm(4, 2)
W = photon_42 - 0.40
assert HC_EVNM / rydberg_lambda_nm(3, 2) < W      # the 3 -> 2 line ejects nothing, as stated
ref['atom-3-06'] = HC_EVNM / W

print(json.dumps(ref, indent=1, ensure_ascii=False))
