"""Reference answers for assets/js/data/practice/thermo.js, worked from the question texts.

Independent of the JS item functions: each answer is derived here from the physics stated in the
question, often by a different route (e.g. kinetic energy per molecule with k_B and N_A instead of
3RT/M, energy bookkeeping in joules instead of the closed formula). Level 2 uses three hand-chosen
variable sets inside each item's ranges.
Run: python3 tests/practice-ref/compute_thermo.py > tests/practice-ref/thermo.json
"""
import json
import math

g = 9.8
R = 8.314
N_A = 6.02214076e23
k_B = R / N_A                      # same R as the lecture, so k = R/N_A
c_water = 4200.0                   # J/(kg K), the value the lecture and questions use
L_f = 3.34e5                       # J/kg
L_v = 2.26e6                       # J/kg


def kelvin(celsius):
    return celsius + 273.15


# thermo-2-01: diver at depth h m in a fresh-water lake -> absolute pressure in kPa
def depth_pressure(h):
    p_atm = 1.01e5
    weight_of_column = 1000 * (1.0 * h) * g      # weight of a 1 m^2 water column of height h (N)
    return (p_atm + weight_of_column / 1.0) / 1000


# thermo-2-02: heat m g of water from t1 to t2 degC (no phase change) -> kJ
def heat_water(m, t1, t2):
    joules_per_degree = (m / 1000) * c_water
    return joules_per_degree * (kelvin(t2) - kelvin(t1)) / 1000


# thermo-2-03: melt m g of ice at 0 degC, then warm the water to t degC -> kJ
def melt_and_warm(m, t):
    kg = m / 1000
    melt = kg * L_f
    warm = kg * c_water * (t - 0)
    return (melt + warm) / 1000


# thermo-2-04: n mol in a sealed V-litre tank at t degC -> pressure in kPa
def tank_pressure(n, V, t):
    N = n * N_A                   # number of molecules, P V = N k T
    return N * k_B * kelvin(t) / (V * 1e-3) / 1000


# thermo-2-05: v_rms of a gas (index into He, N2, O2, Ar, CO2) at t degC
GAS_M = [4, 28, 32, 40, 44]       # g/mol, as printed in the question


def v_rms(gas, t):
    m_molecule = GAS_M[gas] / 1000 / N_A          # kg per molecule
    mean_ke = 1.5 * k_B * kelvin(t)               # (1/2) m <v^2> = (3/2) k T
    return math.sqrt(2 * mean_ke / m_molecule)


# thermo-2-06: piston does W J on the gas while the gas gives out Q J of heat -> change of U
def compress(W, Q):
    energy_in = W                 # work done ON the gas adds energy
    energy_out = Q                # heat leaving takes energy away
    return energy_in - energy_out


# thermo-2-07: engine takes QH kJ at tH degC, rejects at tC degC -> maximum work in kJ
def carnot_work(QH, tH, tC):
    q_cold_min = QH * kelvin(tC) / kelvin(tH)     # Carnot: QC/QH = TC/TH
    return QH - q_cold_min


L2 = {
    'thermo-2-01': (depth_pressure, [dict(h=3), dict(h=10), dict(h=40)]),
    'thermo-2-02': (heat_water, [dict(m=500, t1=20, t2=70), dict(m=1500, t1=15, t2=100), dict(m=250, t1=33, t2=60)]),
    'thermo-2-03': (melt_and_warm, [dict(m=50, t=10), dict(m=200, t=25), dict(m=500, t=40)]),
    'thermo-2-04': (tank_pressure, [dict(n=1, V=22, t=25), dict(n=0.5, V=40, t=5), dict(n=2, V=10, t=45)]),
    'thermo-2-05': (v_rms, [dict(gas=1, t=25), dict(gas=0, t=90), dict(gas=4, t=10)]),
    'thermo-2-06': (compress, [dict(W=500, Q=200), dict(W=200, Q=100), dict(W=900, Q=50)]),
    'thermo-2-07': (carnot_work, [dict(QH=100, tH=400, tC=40), dict(QH=500, tH=550, tC=25), dict(QH=1000, tH=800, tC=10)]),
}


def thermo_3_01():
    # bubble 2.0 cm^3 at 25 m (7 degC) rises to the surface (27 degC); n constant -> volume at surface
    p_deep = 1.01e5 + 1000 * g * 25
    n = p_deep * 2.0e-6 / (R * kelvin(7))          # moles in the bubble
    v_top = n * R * kelvin(27) / 1.01e5            # m^3
    return v_top * 1e6


def thermo_3_02():
    # 1.0 kg water boils at 1.01e5 Pa, 1.0e-3 m^3 -> 1.67 m^3 -> rise in internal energy (kJ)
    heat_in = 1.0 * L_v
    work_by_steam = 1.01e5 * 1.67 - 1.01e5 * 1.0e-3
    return (heat_in - work_by_steam) / 1000


def thermo_3_03():
    # 2.0 mol He at constant pressure, 27 -> 127 degC -> heat needed (J); monatomic U = 3/2 nRT
    n = 2.0
    U1, U2 = 1.5 * n * R * kelvin(27), 1.5 * n * R * kelvin(127)
    PV1, PV2 = n * R * kelvin(27), n * R * kelvin(127)  # P constant, so P dV = PV2 - PV1
    return (U2 - U1) + (PV2 - PV1)


def thermo_3_04():
    # engine 427/27 degC at half Carnot efficiency, 60 kJ of work per minute; rejected heat warms 10 kg water
    eta = 0.5 * (kelvin(427) - kelvin(27)) / kelvin(427)
    q_hot = 60e3 / eta
    q_cold = q_hot * (1 - eta)
    return q_cold / (10 * c_water)


def thermo_3_05():
    # 50 g ice at 0 degC + 300 g water at 30 degC in an insulated cup -> final temperature (bisection on energy)
    def net_heat(T):                # heat given by tea - heat taken by ice (melt + warm)
        return 0.300 * c_water * (30 - T) - (0.050 * L_f + 0.050 * c_water * T)
    lo, hi = 0.0, 30.0
    assert net_heat(lo) > 0         # all the ice melts
    for _ in range(200):
        mid = (lo + hi) / 2
        if net_heat(mid) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def thermo_3_06():
    # hot-air balloon 2000 m^3, P = 1.0e5 Pa, outside 27 degC, inside 87 degC, M = 0.029 -> liftable mass
    V, P, M = 2000, 1.0e5, 0.029
    air_out = P * V / (R * kelvin(27)) * M          # mass of outside air the balloon displaces
    air_in = P * V / (R * kelvin(87)) * M           # mass of hot air inside
    return air_out - air_in


out = {}
for item_id, (fn, cases) in L2.items():
    out[item_id] = [{'vars': c, 'answer': fn(**c)} for c in cases]
for name, fn in sorted(globals().copy().items()):
    if name.startswith('thermo_3_'):
        out[name.replace('_', '-')] = fn()

print(json.dumps(out, indent=1, ensure_ascii=False))
