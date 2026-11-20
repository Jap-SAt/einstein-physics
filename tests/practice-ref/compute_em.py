"""Reference answers for assets/js/data/practice/em.js, worked from the question texts.

Independent of the JS item functions, using different routes where possible:
- wavelength = distance the wave travels in one period (c * T, T = 1/f), not c/f;
- photon energy = h f in joules with CODATA h and e (not the 1240 eV*nm shortcut);
- B0 from Faraday's law for E = E0 sin(kx - wt): dB/dt = -dE/dx gives B0 = E0 k / w
  (k, w from a finite-difference derivative of the sampled field), not E0 / c;
- intensity = c eps0 <E^2>, the time average of E^2 taken numerically over one period, not (1/2) c eps0 E0^2;
- unpolarized light = average over many polarization directions; each polaroid keeps the field component along
  its axis (projection of the field vector), intensity ~ amplitude^2; no I0/2 or cos^2 formulas;
- inverse questions (angle from a transmitted fraction, E0 from an intensity) by bisection on the forward model;
- em-3-04: in-phase sinusoidal E and B sampled in time; the period is found by bisection so that B's first zero
  after t = 0 lands at the measured time.
Level 2 uses three hand-chosen variable sets on each item's grid.
Run: python3 tests/practice-ref/compute_em.py > tests/practice-ref/em.json
"""
import json
import math

C = 3.0e8            # m/s, as stated
EPS0 = 8.85e-12      # C^2/(N m^2), as stated
H_Q = 6.63e-34       # J s, as stated in em-3-02
H_CODATA = 6.62607015e-34
E_CODATA = 1.602176634e-19
DEG = math.pi / 180


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


def wavelength(freq):
    period = 1.0 / freq
    return C * period                        # distance covered in one period


def avg_E2(E0, n=20000):
    """time average of E(t)^2 for E = E0 sin(w t) over one period"""
    return sum((E0 * math.sin(2 * math.pi * (i + 0.5) / n)) ** 2 for i in range(n)) / n


def intensity(E0):
    return C * EPS0 * avg_E2(E0)


def E0_from_intensity(I):
    return bisect(lambda e: intensity(e) - I, 0.0, 1e6, it=80)


def B0_from_E0(E0, freq=1.0e8):
    """Faraday: dB/dt = -dE/dx. For E = E0 sin(kx - wt), |dE/dx|max = E0 k, so B0 w = E0 k."""
    lam = wavelength(freq)
    k_num = (math.sin(2 * math.pi * 1e-6) - math.sin(-2 * math.pi * 1e-6)) / (2 * 1e-6 * lam)  # d/dx sin(2pi x/lam) at 0
    w = 2 * math.pi * freq
    return E0 * k_num / w


def polarizer_chain(I0, axes_deg, polarized_at=None, n=3600):
    """Field vector (amplitude a, direction phi) passes polaroids in turn; each keeps the projection on its axis.
    Unpolarized light = average of a^2 over uniformly spread directions phi. Returns transmitted intensity,
    with intensity proportional to amplitude^2 (I0 corresponds to amplitude 1)."""
    dirs = [polarized_at] if polarized_at is not None else [360.0 * (i + 0.5) / n for i in range(n)]
    tot = 0.0
    for phi in dirs:
        a, d = 1.0, phi
        for ax in axes_deg:
            a = a * math.cos((d - ax) * DEG)    # projection on the axis (sign irrelevant, squared below)
            d = ax
        tot += a * a
    return I0 * tot / len(dirs)


ref = {}

# em-2-01: wavelength of AM (kHz) / FM (MHz) / Wi-Fi (GHz) source
mult = {0: 1e3, 1: 1e6, 2: 1e9}
ref['em-2-01'] = [{'vars': {'b': b, 'f': f}, 'answer': wavelength(f * mult[b])}
                  for b, f in [(0, 870), (1, 95.5), (2, 5.18)]]

# em-2-02: photon energy in eV for f = f14 x 1e14 Hz, via E = h f (J) -> eV
ref['em-2-02'] = [{'vars': {'f14': x}, 'answer': H_CODATA * x * 1e14 / E_CODATA} for x in (4.2, 5.6, 9.1)]

# em-2-03: B0 in microtesla from E0 (Faraday route)
ref['em-2-03'] = [{'vars': {'E0': e}, 'answer': B0_from_E0(e) * 1e6} for e in (50, 300, 1230)]

# em-2-04: unpolarized I0 through two polaroids at th
ref['em-2-04'] = [{'vars': {'I0': i0, 'th': th}, 'answer': polarizer_chain(i0, [0, th])}
                  for i0, th in [(200, 70), (600, 30), (1200, 20)]]

# em-2-05: intensity from E0 (numeric time average)
ref['em-2-05'] = [{'vars': {'E0': e}, 'answer': intensity(e)} for e in (100, 870, 1500)]

# em-2-06: round trip Earth-Mars-Earth in minutes; d = dd x 1e11 m
ref['em-2-06'] = [{'vars': {'d': dd}, 'answer': (dd * 1e11 / C + dd * 1e11 / C) / 60} for dd in (0.55, 2.25, 4.0)]

# em-2-07: angle between polaroids for a transmitted percentage p (bisection on the forward chain)
def angle_for(p):
    return bisect(lambda th: polarizer_chain(1.0, [0, th], n=720) - p / 100, 0.0, 90.0, it=60)
ref['em-2-07'] = [{'vars': {'p': p}, 'answer': angle_for(p)} for p in (5, 18, 46)]

# em-3-01: 600 W/m^2 unpolarized through A (0 deg), B (30 deg), C (90 deg); E0 of what leaves C
I3 = polarizer_chain(600, [0, 30, 90])
ref['em-3-01'] = E0_from_intensity(I3)

# em-3-02: photons per second (in units of 1e15) from a 2.5 mW, 650 nm laser; h, c as stated
photon_J = H_Q * (C / 650e-9)        # E = h f with f = c / lambda
ref['em-3-02'] = 2.5e-3 / photon_J / 1e15

# em-3-03: B0 = 50 nT -> E0 (Faraday route) -> intensity (time average) -> power on 0.80 m^2, in mW
E0 = 50e-9 / B0_from_E0(1.0)         # B0_from_E0 is linear: E0 = B0 / (B0 per V/m)
ref['em-3-03'] = intensity(E0) * 0.80 * 1e3


# em-3-04: E max at t = 0, E and B in phase; B's first zero after t = 0 is at 0.625 ns -> wavelength (cm)
def first_B_zero(T, n=4000):
    """B(t) = B0 cos(2 pi t / T) at P (in phase with E, which is maximal at t = 0); sample until the sign flips"""
    prev = math.cos(0.0)
    for i in range(1, n + 1):
        t = T * i / n
        cur = math.cos(2 * math.pi * t / T)
        if cur <= 0 < prev or cur == 0:
            return t - (T / n) * cur / (cur - prev)
        prev = cur
    return None


T = bisect(lambda T: first_B_zero(T) - 0.625e-9, 0.1e-9, 20e-9, it=80)
ref['em-3-04'] = wavelength(1 / T) * 100

# em-3-05: wavelengths between the station and the house (one crest emitted per oscillation)
ref['em-3-05'] = 36.0e3 / wavelength(91.5e6)

# em-3-06: polarized 900 V/m (vertical) through a polaroid at 40 deg; B0 of the transmitted light in microtesla
I_in = intensity(900)
I_out = polarizer_chain(I_in, [40], polarized_at=0)
ref['em-3-06'] = B0_from_E0(E0_from_intensity(I_out)) * 1e6

print(json.dumps(ref, indent=1, ensure_ascii=False))
