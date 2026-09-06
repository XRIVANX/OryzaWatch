"""
Sweep live weather and raise any resulting alerts:

  * every monitored municipality (Carmen + Asuncion) -> area advisory to every
    user registered there, and
  * every registered farm -> a finer check at the farmer's own pin.

Run on a schedule (Windows Task Scheduler / cron, e.g. every 15 min) so
advisories go out even while every app is closed:

    python manage.py check_weather

`--force` ignores the 15-minute per-location throttle and re-checks everything now.
"""
from django.core.management.base import BaseCommand

from alerts.weather_monitor import run_all_farm_weather_checks, run_all_municipality_weather_checks


class Command(BaseCommand):
    help = "Check current weather (municipalities + farms) and send alerts on any risk change."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force', action='store_true',
            help='Ignore the per-location throttle and re-check everything now.',
        )

    def handle(self, *args, **options):
        force = options['force']
        area = run_all_municipality_weather_checks(force=force)
        farm = run_all_farm_weather_checks(force=force)
        self.stdout.write(self.style.SUCCESS(
            f'Weather sweep complete - {area} area alert(s), {farm} farm alert(s).'
        ))
