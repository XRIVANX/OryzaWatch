"""Offline checks of station units, rainfall aggregation, coverage and missing data."""
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

import numpy as np
import pandas as pd

from analytics.ml.stations import read_station, supplement_from_cache


class StationImportTests(unittest.TestCase):
    def fixture(self, directory, *, missing_temperature=False):
        times = pd.date_range('2024-01-01', periods=120, freq='min')
        frame = pd.DataFrame({'DATE/TIME READ': times,
                              'AIR TEMPERATURE (°C)': np.nan if missing_temperature else 26,
                              'AIR HUMIDITY (%)': 85,
                              'RAIN AMOUNT IN 1MIN (mm)': 0.1,
                              'RAIN AMOUNT IN 1HR (mm)': 999,
                              'WIND SPEED IN 1MIN (m/s)': 2,
                              'WIND DIRECTION IN 1MIN (deg.)': [350, 10] * 60,
                              'SOLAR RADIATION (W/m2)': 100})
        path = Path(directory) / 'test.csv'
        path.write_text('LOCATION :;Test;Davao\nLATITUDE :;7.3\nLONGITUDE :;125.6\nELEVATION :;20\nDATE INSTALLED :;2020-01-01\n' + frame.to_csv(index=False, sep=';'), encoding='utf-8')
        return path

    def test_units_rain_and_circular_wind(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            hourly, audit = read_station(self.fixture(directory))
        np.testing.assert_allclose(hourly.precipitation, [6, 6])
        np.testing.assert_allclose(hourly.wind_speed_10m, [7.2, 7.2])
        self.assertTrue(np.all((hourly.wind_direction_10m < 1) | (hourly.wind_direction_10m > 359)))
        self.assertTrue((hourly.dew_point_2m < hourly.temperature_2m).all())
        self.assertEqual(audit['usable_hours'], 2)

    def test_missing_temperature_is_excluded(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            hourly, audit = read_station(self.fixture(directory, missing_temperature=True))
        self.assertIsNone(hourly)
        self.assertIn('Missing temperature', audit['exclusion'])

    def test_partial_hour_not_zero_filled(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            path = self.fixture(directory)
            lines = [line for line in path.read_text(encoding='utf-8').splitlines() if line]
            path.write_text('\n'.join(lines[:6] + lines[6:66] + lines[66:76]), encoding='utf-8')
            hourly, _ = read_station(path)
        self.assertEqual(hourly.precipitation.iloc[0], 6)
        self.assertTrue(np.isnan(hourly.precipitation.iloc[1]))

    def test_cached_values_fill_only_missing_observations(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as directory:
            root = Path(directory)
            hourly, _ = read_station(self.fixture(directory))
            hourly['latitude'], hourly['longitude'] = 7.36, 125.70
            reference = hourly.drop(columns=['latitude', 'longitude']).copy()
            reference['temperature_2m'] = 30
            reference.to_csv(root / 'CARMEN_2024.csv', index=False)
            hourly.loc[1, 'temperature_2m'] = np.nan
            audit = {}
            with patch('analytics.ml.stations.HOURLY_CACHE_DIR', root):
                blended = supplement_from_cache(hourly, audit)
            np.testing.assert_allclose(blended.temperature_2m, [26, 30])
            self.assertEqual(audit['supplement']['filled_hours_by_variable']['temperature_2m'], 1)


if __name__ == '__main__':
    unittest.main()
