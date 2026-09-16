"""
Print the airborne disease forecast from the command line:

    ../.venv/Scripts/python.exe manage.py predict_disease_risk --municipality CARMEN
    ../.venv/Scripts/python.exe manage.py predict_disease_risk --lat 7.40 --lng 125.65 --days 7
    ../.venv/Scripts/python.exe manage.py predict_disease_risk --hotspot 3      # where it spreads
    ../.venv/Scripts/python.exe manage.py predict_disease_risk --municipality CARMEN --json
"""
import json

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Forecast BLB / Rice Blast / Brown Spot outbreak risk (and spread direction for a hotspot).'

    def add_arguments(self, parser):
        where = parser.add_mutually_exclusive_group(required=True)
        where.add_argument('--municipality', help='CARMEN or ASUNCION')
        where.add_argument('--lat', type=float, help='Latitude (use with --lng)')
        where.add_argument('--hotspot', type=int, help='DiseaseHotspot id: forecast where it spreads')
        parser.add_argument('--lng', type=float, help='Longitude (use with --lat)')
        parser.add_argument('--days', type=int, default=7, help='Forecast horizon, 1-14 (default 7)')
        parser.add_argument('--json', action='store_true', help='Print raw JSON instead of a table')

    def handle(self, *args, **options):
        try:
            from analytics.ml.config import MUNICIPALITY_POINTS
            from analytics.ml.predict import InvalidLocation, ModelNotTrained, forecast_point, forecast_spread
            from analytics.ml.sources import WeatherFetchError
        except ImportError as exc:
            raise CommandError(f'ML dependencies missing ({exc}).')

        try:
            if options['hotspot'] is not None:
                result = self._spread(options, forecast_spread)
            else:
                lat, lng = self._point(options, MUNICIPALITY_POINTS)
                result = forecast_point(lat, lng, options['days'])
                if not options['json']:
                    self._print_point(result)
        except (ModelNotTrained, InvalidLocation, WeatherFetchError) as exc:
            raise CommandError(str(exc))

        if options['json']:
            self.stdout.write(json.dumps(result, indent=2))

    def _point(self, options, municipalities):
        if options['municipality']:
            key = options['municipality'].strip().upper()
            if key not in municipalities:
                raise CommandError(f"--municipality must be one of {', '.join(municipalities)}")
            return municipalities[key]
        if options['lng'] is None:
            raise CommandError('--lat needs --lng')
        return options['lat'], options['lng']

    def _spread(self, options, forecast_spread):
        from analytics.ml.config import DISEASES
        from analytics.models import DiseaseHotspot

        hotspot = DiseaseHotspot.objects.select_related('scan').filter(pk=options['hotspot']).first()
        if hotspot is None:
            raise CommandError(f"Hotspot {options['hotspot']} not found.")
        detected = hotspot.scan.detected_disease
        disease = detected if detected in DISEASES else None
        result = forecast_spread(float(hotspot.effective_latitude), float(hotspot.effective_longitude),
                                 disease=disease, days=options['days'])
        if not options['json']:
            self.stdout.write(self.style.MIGRATE_HEADING(
                f'Hotspot {hotspot.pk} ({detected}) at {result["latitude"]:.4f}, {result["longitude"]:.4f}'
            ))
            for day in result['days']:
                w = day['weather']
                for code, info in day['diseases'].items():
                    dest = info['likely_destination']
                    heading = (f"-> {dest['direction']} {dest['distance_km']:.0f} km "
                               f"(there {dest['probability']:.0%}, {dest['level']})") if dest else '-> no clear direction'
                    self.stdout.write(
                        f"{day['date']}  {code:<10} source {info['source']['probability']:>4.0%} "
                        f"{info['source']['level']:<8} wind from {w['wind_from']:<2} {heading}"
                    )
        return result

    def _print_point(self, result):
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Disease risk at {result['latitude']:.4f}, {result['longitude']:.4f}"
        ))
        header = f"{'date':<11} {'BLB':>14} {'BLAST':>14} {'BROWN_SPOT':>14}   {'RH':>4} {'rain':>6} {'wind from':>9}"
        self.stdout.write(header)
        self.stdout.write('-' * len(header))
        for day in result['days']:
            cells = ' '.join(
                f"{day['risks'][c]['probability']:>5.0%} {day['risks'][c]['level']:<8}"
                for c in ('BLB', 'BLAST', 'BROWN_SPOT')
            )
            w = day['weather']
            self.stdout.write(f"{day['date']:<11} {cells}   {w['rh_mean']:>3}% {w['precip_mm']:>5.1f}mm {w['wind_from']:>9}")
        peaks = ', '.join(f"{c} {p['probability']:.0%} on {p['date']}" for c, p in result['peak'].items())
        self.stdout.write(f'Peak: {peaks}')
