"""
Epidemiological label generator for the airborne-disease forecast model.

Why this exists: OryzaWatch has no five-year record of confirmed field
outbreaks to learn from. The app's own LeafScan history starts when the app
went live. So training labels are produced by a process-based infection model
run over the real Open-Meteo hourly history, the standard approach for
weather-driven plant-disease early warning when field records are thin
(compare EPIRICE, and blast/BLB infection-period models).

What makes this a real learning problem rather than a lookup:

  * Labels are driven by HOURLY physics: continuous leaf-wetness runs, the
    temperature during those wet hours, night-time dew, wind-driven rain. The
    model only ever sees DAILY summaries (sources.to_daily), where that
    detail has been averaged away.
  * Infection shows up days later. Each pathogen has its own latency, so an
    outbreak on day T is caused by weather 5 to 14 days earlier.
  * Severity builds over weeks. Existing lesions seed new infections, and
    disease decays when conditions turn hostile or the crop is harvested.
  * Two sources of randomness sit on top: unmodelled inoculum arrivals and
    imperfect scouting (label noise). Perfect accuracy is not possible.

The cardinal temperatures and wetness needs below come from the rice-pathology
literature (Pyricularia oryzae, Xanthomonas oryzae pv. oryzae, Bipolaris
oryzae). The rate constants are calibrated so outbreak frequency is plausible
for lowland Mindanao. Once real confirmed scans accumulate, they should
replace or re-weight these labels (see DISEASE_FORECAST.md).
"""
from __future__ import annotations

import zlib
from dataclasses import dataclass

import numpy as np
import pandas as pd

LABEL_MODEL_VERSION = '1.1'


def _sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


@dataclass(frozen=True)
class DiseaseProfile:
    code: str
    # Cardinal temperatures (deg C) for infection: none below t_min or above
    # t_max, fastest at t_opt.
    t_min: float
    t_opt: float
    t_max: float
    # RH (%) at/above which an hour counts toward this pathogen's moisture need.
    wet_rh: float
    # Continuous wet hours before infection becomes efficient.
    min_wet_run: int
    # Sigmoid on temperature-weighted wet hours. In a humid lowland some dew
    # forms nearly every night, so the response is centred on a
    # wetter-than-usual night (about the 70th percentile of the Davao
    # del Norte record) instead of on "any wetness".
    wet_mid: float
    wet_slope: float
    # Share of infection driven by leaf wetness alone.
    moisture_weight: float
    # Extra weight for wet hours between 18:00 and 06:00 (dew periods).
    night_bonus: float
    # Daily rain (mm) above which spores are washed off leaves. 0 disables it.
    rain_wash_mm: float
    # Wind-driven rain: splash dispersal and leaf wounding (bacterial spread).
    splash_weight: float
    splash_mid: float
    splash_slope: float
    # Weight of antecedent drought stress on the crop. 0 disables it.
    stress_weight: float
    # Days from infection to visible lesions.
    latency_mean: float
    latency_sd: float
    # How strongly existing lesions seed new infections (secondary cycles).
    secondary_rate: float
    # Airborne inoculum arriving from outside the field each day.
    background: float
    # Daily fraction of severity lost to lesion ageing and leaf senescence.
    decay: float
    # Crop-stage susceptibility: ((days after transplant, spread, weight), ...)
    stage_peaks: tuple
    # Severity index at which the field counts as an outbreak.
    outbreak_threshold: float


PROFILES = {
    # Rice blast: long leaf wetness at mild temperatures, favoured by cool
    # dewy nights. Heavy rain washes conidia off leaves. Leaf blast peaks at
    # tillering, neck blast at heading.
    'BLAST': DiseaseProfile(
        code='BLAST', t_min=16.0, t_opt=24.0, t_max=30.0,
        wet_rh=90.0, min_wet_run=9, wet_mid=20.5, wet_slope=1.8,
        moisture_weight=1.0, night_bonus=0.35, rain_wash_mm=12.0,
        splash_weight=0.0, splash_mid=0.0, splash_slope=1.0, stress_weight=0.0,
        latency_mean=6.0, latency_sd=1.5,
        secondary_rate=0.45, background=0.020, decay=0.080,
        stage_peaks=((35, 15, 1.0), (80, 8, 0.8)),
        outbreak_threshold=0.20,
    ),
    # Bacterial leaf blight: warm (about 25 to 34 deg C) and humid, but mostly
    # spread by wind-driven rain entering through wounds. Storms are the
    # classic trigger.
    'BLB': DiseaseProfile(
        code='BLB', t_min=20.0, t_opt=30.0, t_max=36.0,
        wet_rh=80.0, min_wet_run=4, wet_mid=13.7, wet_slope=1.2,
        moisture_weight=0.4, night_bonus=0.0, rain_wash_mm=0.0,
        splash_weight=1.0, splash_mid=22.0, splash_slope=6.0, stress_weight=0.0,
        latency_mean=10.0, latency_sd=3.0,
        secondary_rate=0.50, background=0.020, decay=0.080,
        stage_peaks=((60, 20, 1.0),),
        outbreak_threshold=0.20,
    ),
    # Brown spot: wide temperature range with 8 h or more of wetness, and far
    # worse on water-stressed crops. The classic pattern is a dry spell
    # followed by humid nights. Strongest from heading onward.
    'BROWN_SPOT': DiseaseProfile(
        code='BROWN_SPOT', t_min=16.0, t_opt=27.0, t_max=36.0,
        wet_rh=90.0, min_wet_run=8, wet_mid=19.0, wet_slope=1.8,
        moisture_weight=1.0, night_bonus=0.10, rain_wash_mm=0.0,
        splash_weight=0.0, splash_mid=0.0, splash_slope=1.0, stress_weight=1.3,
        latency_mean=6.0, latency_sd=2.0,
        secondary_rate=0.55, background=0.020, decay=0.070,
        stage_peaks=((85, 15, 1.0), (40, 15, 0.35)),
        outbreak_threshold=0.20,
    ),
}

# Two main cropping seasons in Davao del Norte: wet-season transplanting
# around early June, dry-season around early December. Actual dates vary
# year to year and field to field, so they are jittered per location-year.
PLANTING_DOY = (152, 335)
PLANTING_JITTER_DAYS = 12
# Irrigated lowland is planted asynchronously, so some susceptible crop is
# always somewhere in the landscape.
OFF_SEASON_SUSCEPTIBILITY = 0.20
SEASON_LENGTH_DAYS = 120
# Extra severity loss once a season's crop has been harvested.
HARVEST_DECAY = 0.08

# Brown-spot crop stress: 14-day rain minus reference evaporation. A deficit
# beyond STRESS_MID_MM is a meaningful dry spell for lowland rice. A stressed
# crop stays predisposed for weeks after the rain returns, so the worst deficit
# of the last STRESS_MEMORY_DAYS counts. Without that memory, "dry spell then
# humid nights" could never register, because dry days are rarely wet days.
STRESS_WINDOW_DAYS = 14
STRESS_MEMORY_DAYS = 30
STRESS_MID_MM = 15.0
STRESS_SLOPE_MM = 8.0
# Brown spot still occurs on unstressed but nutrient-poor fields.
STRESS_BASE = 0.50

# ERA5 grid-cell winds are smoothed: the 99th percentile daily maximum here is
# about 24 km/h. So "storm" means top-percentile wind together with heavy rain,
# not a raw gale threshold.
STORM_WIND_KMH = 20.0
STORM_RAIN_MM = 20.0

INFECTION_NOISE_SIGMA = 0.40   # lognormal spread on daily new infections
LABEL_FLIP_RATE = 0.015        # scouting error: missed or false reports
# Severity starts at zero, so the first weeks of any simulated record are not
# a realistic state and are dropped from training.
BURN_IN_DAYS = 60


def temperature_response(temp, profile):
    """
    Beta-function temperature response (Yan & Hunt 1999): 0 outside
    (t_min, t_max), 1 at t_opt, asymmetric in between. The standard curve for
    pathogen development rates.
    """
    t = np.asarray(temp, dtype=float)
    lo, opt, hi = profile.t_min, profile.t_opt, profile.t_max
    exponent = (opt - lo) / (hi - opt)
    inside = (t > lo) & (t < hi)
    safe = np.where(inside, t, opt)
    response = ((hi - safe) / (hi - opt)) * ((safe - lo) / (opt - lo)) ** exponent
    return np.where(inside, np.clip(response, 0.0, 1.0), 0.0)


def _infection_day(times):
    """Group hours into noon-to-noon windows so an overnight wet spell counts
    as one infection period instead of being split at midnight."""
    return (times - pd.Timedelta(hours=12)).dt.normalize()


def hourly_drivers(hourly, profile):
    """
    Per-day infection drivers for one pathogen from hourly weather. These
    stay private to the label model and are never offered to the classifier.
    """
    frame = hourly[['time', 'temperature_2m', 'relative_humidity_2m', 'dew_point_2m',
                    'precipitation', 'wind_speed_10m']].copy()
    frame = frame.interpolate(limit=3, limit_direction='both')

    temp = frame['temperature_2m']
    wet = (
        (frame['relative_humidity_2m'] >= profile.wet_rh)
        | (frame['precipitation'] >= 0.1)
        | ((temp - frame['dew_point_2m']) <= 1.0)
    )
    # Length of the continuous wet run each hour belongs to.
    run_id = (wet != wet.shift()).cumsum()
    run_length = wet.groupby(run_id).transform('size').where(wet, 0)

    hour = frame['time'].dt.hour
    night = ((hour >= 18) | (hour < 6)).astype(float)
    response = temperature_response(temp, profile)

    # Only hours inside a run at least half the required length count. A
    # 1-hour dew flash does not start an infection.
    effective = wet & (run_length >= max(1, profile.min_wet_run // 2))
    frame['wet_index'] = np.where(effective, response * (1.0 + profile.night_bonus * night), 0.0)
    frame['run_length'] = run_length
    frame['splash'] = frame['precipitation'] * (1.0 + frame['wind_speed_10m'] / 15.0) * (response > 0)
    frame['response'] = response
    frame['day'] = _infection_day(frame['time'])

    grouped = frame.groupby('day')
    drivers = pd.DataFrame({
        'wet_index': grouped['wet_index'].sum(),
        'longest_run': grouped['run_length'].max(),
        'splash': grouped['splash'].sum(),
        'mean_response': grouped['response'].mean(),
        'wind_max': grouped['wind_speed_10m'].max(),
        'rain': grouped['precipitation'].sum(),
    })
    drivers.index.name = 'date'
    return drivers


def infection_efficiency(drivers, daily, profile):
    """Daily infection efficiency (0 to about 1.7) from the hourly drivers,
    plus the antecedent water balance for stress-driven disease."""
    moisture = _sigmoid((drivers['wet_index'] - profile.wet_mid) / profile.wet_slope)
    run_ok = np.clip(drivers['longest_run'] / profile.min_wet_run, 0.0, 1.0) ** 2
    efficiency = profile.moisture_weight * moisture * run_ok

    if profile.rain_wash_mm:
        excess = (drivers['rain'] - profile.rain_wash_mm).clip(lower=0.0)
        efficiency = efficiency * np.exp(-excess / 15.0)

    if profile.splash_weight:
        splash = _sigmoid((drivers['splash'] - profile.splash_mid) / profile.splash_slope)
        efficiency = efficiency + profile.splash_weight * splash * drivers['mean_response']
        storm = (drivers['wind_max'] >= STORM_WIND_KMH) & (drivers['rain'] >= STORM_RAIN_MM)
        efficiency = efficiency + storm * 0.5 * profile.splash_weight

    if profile.stress_weight:
        by_date = daily.set_index('date')
        balance = (by_date['precip_sum'] - by_date['et0']).rolling(STRESS_WINDOW_DAYS, min_periods=1).sum()
        balance = balance.rolling(STRESS_MEMORY_DAYS, min_periods=1).min()
        balance = balance.reindex(drivers.index).ffill().fillna(0.0)
        stress = _sigmoid((-balance - STRESS_MID_MM) / STRESS_SLOPE_MM)
        efficiency = efficiency * (STRESS_BASE + profile.stress_weight * stress)

    return efficiency.clip(0.0, 2.0)




def _stage_curve(days_after_transplant, profile):
    curve = np.zeros_like(days_after_transplant, dtype=float)
    for centre, spread, weight in profile.stage_peaks:
        curve = np.maximum(curve, weight * np.exp(-0.5 * ((days_after_transplant - centre) / spread) ** 2))
    return curve


def susceptibility(dates, profile, rng):
    """
    Crop-stage susceptibility over time, and a harvested-field flag. Each
    location-year gets its own jittered transplanting dates.
    """
    dates = pd.DatetimeIndex(dates)
    susceptible = np.full(len(dates), OFF_SEASON_SUSCEPTIBILITY)
    in_season = np.zeros(len(dates), dtype=bool)
    for year in range(dates.year.min() - 1, dates.year.max() + 1):
        for doy in PLANTING_DOY:
            jitter = int(rng.normal(0, PLANTING_JITTER_DAYS))
            planted = pd.Timestamp(year, 1, 1) + pd.Timedelta(days=doy - 1 + jitter)
            dat = (dates - planted).days.to_numpy()
            active = (dat >= 0) & (dat <= SEASON_LENGTH_DAYS)
            if not active.any():
                continue
            stage = OFF_SEASON_SUSCEPTIBILITY + (1 - OFF_SEASON_SUSCEPTIBILITY) * _stage_curve(dat, profile)
            susceptible = np.where(active, np.maximum(susceptible, stage), susceptible)
            in_season |= active
    return susceptible, ~in_season


def _latency_kernel(profile, max_days=21):
    days = np.arange(1, max_days + 1)
    kernel = np.exp(-0.5 * ((days - profile.latency_mean) / profile.latency_sd) ** 2)
    return kernel / kernel.sum()


def _seed_for(location, disease, base_seed):
    """Stable per-location, per-disease seed, so adding a location never
    reshuffles the labels of the ones already in the table."""
    return (zlib.crc32(f'{location}:{disease}'.encode()) ^ int(base_seed)) & 0xFFFFFFFF


def run_epidemic(efficiency, susceptible, harvested, profile, rng, location_inoculum=1.0):
    """
    Daily compartment model: new infections wait out a latency period, then
    add to visible severity. Severity feeds further infection until weather
    turns hostile or the crop is harvested. Returns the daily severity index
    (0 to 1).
    """
    n = len(efficiency)
    kernel = _latency_kernel(profile)
    pending = np.zeros(n + len(kernel) + 1)
    severity = np.zeros(n)
    noise = rng.lognormal(mean=0.0, sigma=INFECTION_NOISE_SIGMA, size=n)

    current = 0.0
    for t in range(n):
        inoculum = profile.background * location_inoculum + profile.secondary_rate * current
        new = efficiency[t] * susceptible[t] * inoculum * (1.0 - current) * noise[t]
        pending[t + 1:t + 1 + len(kernel)] += new * kernel
        loss = profile.decay + (HARVEST_DECAY if harvested[t] else 0.0)
        current = min(1.0, max(0.0, current * (1.0 - loss) + pending[t]))
        severity[t] = current
    return severity


def simulate_outbreaks(hourly, daily, location, seed):
    """
    Labels for one location: per disease, the daily infection efficiency, the
    severity index, and the binary `<DISEASE>_outbreak` target.

    `hourly` is the raw Open-Meteo frame, `daily` is sources.to_daily(hourly).
    """
    result = pd.DataFrame({'date': pd.DatetimeIndex(daily['date'])})

    for code, profile in PROFILES.items():
        rng = np.random.default_rng(_seed_for(location, code, seed))
        drivers = hourly_drivers(hourly, profile)
        efficiency = infection_efficiency(drivers, daily, profile)
        efficiency = efficiency.reindex(result['date']).fillna(0.0).to_numpy()

        susceptible, harvested = susceptibility(result['date'], profile, rng)
        # Some locations simply carry more inoculum: nearby infected fields,
        # a susceptible variety, poor soil. Fixed per location and disease.
        location_inoculum = float(rng.lognormal(0.0, 0.25))
        severity = run_epidemic(efficiency, susceptible, harvested, profile, rng, location_inoculum)

        outbreak = (severity >= profile.outbreak_threshold).astype(int)
        flips = rng.random(len(outbreak)) < LABEL_FLIP_RATE
        outbreak = np.where(flips, 1 - outbreak, outbreak)

        result[f'{code}_infection'] = efficiency
        result[f'{code}_severity'] = severity
        result[f'{code}_outbreak'] = outbreak

    return result.iloc[BURN_IN_DAYS:].reset_index(drop=True)


def label_columns():
    """Every column simulate_outbreaks adds. None of them may be a feature."""
    return [f'{code}_{suffix}' for code in PROFILES for suffix in ('infection', 'severity', 'outbreak')]
