from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('analytics', '0001_initial')]

    operations = [migrations.CreateModel(
        name='ForecastPrediction',
        fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('predicted_disease', models.CharField(max_length=20)),
            ('predicted_at', models.DateTimeField()),
            ('forecast_latitude', models.DecimalField(decimal_places=6, max_digits=9)),
            ('forecast_longitude', models.DecimalField(decimal_places=6, max_digits=9)),
            ('forecast_radius_km', models.FloatField()),
            ('wind_direction_deg', models.IntegerField()),
            ('verified_disease', models.CharField(blank=True, max_length=20, null=True)),
            ('verified_latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
            ('verified_longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
            ('verified_at', models.DateTimeField(blank=True, null=True)),
        ],
    )]
