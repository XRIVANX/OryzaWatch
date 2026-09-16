"""
Model definitions shared by training and inference.

Each disease gets two scikit-learn pipelines, a Random Forest and an XGBoost
gradient-boosted forest. A weighted soft vote averages their probabilities.
The two learners fail differently. Bagged trees give smooth, stable
probabilities; boosting catches sharp interactions such as humid AND mild AND
several days after rain. So the blend is usually better than either one.
"""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from .config import RANDOM_SEED


def make_random_forest(n_jobs=-1, **params):
    settings = dict(
        n_estimators=400,
        min_samples_leaf=4,
        max_features='sqrt',
        class_weight='balanced_subsample',
        n_jobs=n_jobs,
        random_state=RANDOM_SEED,
    )
    settings.update(params)
    return Pipeline([
        ('impute', SimpleImputer(strategy='median')),
        ('model', RandomForestClassifier(**settings)),
    ])


def make_xgboost(pos_weight=1.0, n_jobs=-1, **params):
    settings = dict(
        n_estimators=500,
        learning_rate=0.04,
        max_depth=5,
        min_child_weight=3,
        subsample=0.85,
        colsample_bytree=0.6,
        reg_lambda=1.0,
        scale_pos_weight=pos_weight,
        objective='binary:logistic',
        eval_metric='aucpr',
        tree_method='hist',
        n_jobs=n_jobs,
        random_state=RANDOM_SEED,
    )
    settings.update(params)
    return Pipeline([
        ('impute', SimpleImputer(strategy='median')),
        ('model', XGBClassifier(**settings)),
    ])


# Search spaces for `train_disease_forecast --tune`.
RF_SEARCH_SPACE = {
    'model__n_estimators': [300, 500, 800],
    'model__max_depth': [None, 12, 20],
    'model__min_samples_leaf': [1, 2, 4, 8],
    'model__max_features': ['sqrt', 0.3, 0.5],
}
XGB_SEARCH_SPACE = {
    'model__n_estimators': [300, 500, 800],
    'model__learning_rate': [0.02, 0.04, 0.08],
    'model__max_depth': [3, 4, 5, 6, 8],
    'model__min_child_weight': [1, 3, 6],
    'model__subsample': [0.7, 0.85, 1.0],
    'model__colsample_bytree': [0.4, 0.6, 0.8],
    'model__reg_lambda': [0.5, 1.0, 3.0],
}


def ensemble_probability(bundle, frame):
    """
    Outbreak probability from a saved disease bundle (see train.py) for rows
    of `frame`. Columns are selected and ordered from the bundle, so extra or
    reordered columns in `frame` cannot silently shift features.
    """
    X = frame.reindex(columns=bundle['features'])
    weights = bundle['weights']
    rf = bundle['rf'].predict_proba(X)[:, 1]
    xgb = bundle['xgb'].predict_proba(X)[:, 1]
    return np.clip(weights['rf'] * rf + weights['xgb'] * xgb, 0.0, 1.0)


def risk_level(probability, threshold, bands):
    """Map a probability to a band, relative to the disease's tuned threshold."""
    ratio = probability / threshold if threshold > 0 else 0.0
    for name, multiple in bands:
        if ratio >= multiple:
            return name
    return bands[-1][0]
