"""
Airborne rice disease forecast model (BLB, Rice Blast, Brown Spot).

Random Forest + XGBoost ensembles trained with scikit-learn on five years of
Open-Meteo hourly weather. See DISEASE_FORECAST.md in the backend root for
the method, the commands, and the model's limits.

Submodules import pandas/scikit-learn/xgboost, so import them lazily from
Django code paths. The rest of the app must keep working on an install
without the ML extras.
"""
