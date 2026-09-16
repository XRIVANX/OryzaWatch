"""
Train, evaluate and save the airborne-disease forecast models.

For each disease (BLB, BLAST, BROWN_SPOT):

  1. Split by time. The final `test_days` are held out, with a 21-day
     embargo before them. That way no rolling window or infection latency
     can straddle train and test.
  2. Walk forward over the training years with date-based folds. Out-of-fold
     predictions set the ensemble weights and pick the decision threshold. The
     test year is never used for either.
  3. Fit the Random Forest and XGBoost pipelines on the training years and
     score them alone, blended, and against the app's existing humidity rule
     (analytics/weather.py) on the held-out year.
  4. Refit on every row, unless told not to, so the saved model has seen the
     most recent season. Save it with joblib.

Saved bundles are pickles. They are loaded only from the fixed ai_models/
directory and never from anything a user can upload.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.base import clone
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import RandomizedSearchCV

from .config import DISEASES, HISTORY_YEARS, METADATA_PATH, MODEL_DIR, RANDOM_SEED
from .epidemiology import LABEL_MODEL_VERSION, label_columns
from .features import feature_columns
from .modeling import (
    RF_SEARCH_SPACE,
    XGB_SEARCH_SPACE,
    make_random_forest,
    make_xgboost,
)

TEST_DAYS = 365
EMBARGO_DAYS = 21
CV_SPLITS = 4
TOP_FEATURES = 20

# The app's current rule-based trigger (analytics/weather.py), kept inline so
# this module never imports app code: "humidity at or above the disease's
# threshold means spreading".
RULE_HUMIDITY_THRESHOLD = {'BLB': 70.0, 'BLAST': 90.0, 'BROWN_SPOT': 80.0}


def date_folds(dates, n_splits=CV_SPLITS, embargo_days=EMBARGO_DAYS):
    """
    Walk-forward folds on calendar dates, not row positions. Every location's
    row for a given day lands on the same side of each boundary, and training
    rows stop `embargo_days` before validation begins.
    """
    dates = pd.DatetimeIndex(dates)
    unique = np.sort(dates.unique())
    blocks = np.array_split(unique, n_splits + 1)
    folds = []
    for k in range(1, n_splits + 1):
        val_start, val_end = blocks[k][0], blocks[k][-1]
        train_end = val_start - np.timedelta64(embargo_days, 'D')
        train_idx = np.flatnonzero(dates <= train_end)
        val_idx = np.flatnonzero((dates >= val_start) & (dates <= val_end))
        if len(train_idx) and len(val_idx):
            folds.append((train_idx, val_idx))
    return folds


def _metrics(y, prob, threshold):
    y = np.asarray(y).astype(int)
    pred = (prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    both = len(np.unique(y)) == 2
    return {
        'roc_auc': round(float(roc_auc_score(y, prob)), 4) if both else None,
        'average_precision': round(float(average_precision_score(y, prob)), 4) if both else None,
        'brier': round(float(brier_score_loss(y, prob)), 4),
        'accuracy': round(float(accuracy_score(y, pred)), 4),
        'precision': round(float(precision_score(y, pred, zero_division=0)), 4),
        'recall': round(float(recall_score(y, pred, zero_division=0)), 4),
        'f1': round(float(f1_score(y, pred, zero_division=0)), 4),
        'threshold': round(float(threshold), 4),
        'confusion': {'tn': int(tn), 'fp': int(fp), 'fn': int(fn), 'tp': int(tp)},
        'rows': int(len(y)),
        'positives': int(y.sum()),
    }


def best_f1_threshold(y, prob):
    precision, recall, thresholds = precision_recall_curve(y, prob)
    f1 = 2 * precision * recall / np.clip(precision + recall, 1e-9, None)
    # precision_recall_curve returns one more (precision, recall) than thresholds.
    best = int(np.nanargmax(f1[:-1])) if len(thresholds) else 0
    return float(thresholds[best]) if len(thresholds) else 0.5


def _pos_weight(y):
    positives = int(np.sum(y))
    return float((len(y) - positives) / positives) if positives else 1.0


def _tune(estimator, space, X, y, folds, n_iter, n_jobs, say):
    search = RandomizedSearchCV(
        estimator, space, n_iter=n_iter, scoring='average_precision',
        cv=folds, random_state=RANDOM_SEED, n_jobs=1, refit=False,
    )
    search.fit(X, y)
    params = {key.replace('model__', ''): value for key, value in search.best_params_.items()}
    say(f'      best AP {search.best_score_:.4f} with {params}')
    return params


def _importances(rf, xgb, features):
    rf_imp = rf.named_steps['model'].feature_importances_
    xgb_imp = xgb.named_steps['model'].feature_importances_
    # Put both on a 0-1 scale, then average, so neither learner dominates.
    rf_n = rf_imp / rf_imp.sum() if rf_imp.sum() else rf_imp
    xgb_n = xgb_imp / xgb_imp.sum() if xgb_imp.sum() else xgb_imp
    combined = pd.Series((rf_n + xgb_n) / 2, index=features).sort_values(ascending=False)
    return [{'feature': name, 'importance': round(float(value), 5)}
            for name, value in combined.head(TOP_FEATURES).items()]


def train_disease(table, disease, features, *, test_days=TEST_DAYS, tune=False, tune_iter=20,
                  final_refit=True, n_jobs=-1, say=print):
    target = f'{disease}_outbreak'
    dates = pd.DatetimeIndex(table['date'])
    cutoff = dates.max() - pd.Timedelta(days=test_days)
    train_mask = dates <= cutoff - pd.Timedelta(days=EMBARGO_DAYS)
    test_mask = dates > cutoff

    X_train = table.loc[train_mask, features].reset_index(drop=True)
    y_train = table.loc[train_mask, target].to_numpy()
    X_test = table.loc[test_mask, features].reset_index(drop=True)
    y_test = table.loc[test_mask, target].to_numpy()
    train_dates = dates[train_mask]

    say(f'  {disease}: {len(X_train):,} train rows ({y_train.mean():.1%} outbreak), '
        f'{len(X_test):,} test rows ({y_test.mean():.1%} outbreak)')

    pos_weight = _pos_weight(y_train)
    folds = date_folds(train_dates)
    rf_params, xgb_params = {}, {}
    if tune:
        say('    tuning Random Forest...')
        rf_params = _tune(make_random_forest(n_jobs), RF_SEARCH_SPACE, X_train, y_train, folds, tune_iter, n_jobs, say)
        say('    tuning XGBoost...')
        xgb_params = _tune(make_xgboost(pos_weight, n_jobs), XGB_SEARCH_SPACE, X_train, y_train, folds, tune_iter, n_jobs, say)

    rf_template = make_random_forest(n_jobs, **rf_params)
    xgb_template = make_xgboost(pos_weight, n_jobs, **xgb_params)

    # Walk-forward out-of-fold predictions -> ensemble weights + threshold.
    say(f'    walk-forward validation over {len(folds)} folds...')
    oof_idx, oof_rf, oof_xgb = [], [], []
    for train_idx, val_idx in folds:
        fold_y = y_train[train_idx]
        if len(np.unique(fold_y)) < 2:
            continue
        rf = clone(rf_template).fit(X_train.iloc[train_idx], fold_y)
        xgb = clone(xgb_template).set_params(model__scale_pos_weight=_pos_weight(fold_y))
        xgb.fit(X_train.iloc[train_idx], fold_y)
        oof_idx.append(val_idx)
        oof_rf.append(rf.predict_proba(X_train.iloc[val_idx])[:, 1])
        oof_xgb.append(xgb.predict_proba(X_train.iloc[val_idx])[:, 1])

    oof_idx = np.concatenate(oof_idx)
    oof_y = y_train[oof_idx]
    oof_rf, oof_xgb = np.concatenate(oof_rf), np.concatenate(oof_xgb)
    ap_rf = average_precision_score(oof_y, oof_rf)
    ap_xgb = average_precision_score(oof_y, oof_xgb)
    weights = {'rf': round(ap_rf / (ap_rf + ap_xgb), 4), 'xgb': round(ap_xgb / (ap_rf + ap_xgb), 4)}
    oof_ensemble = weights['rf'] * oof_rf + weights['xgb'] * oof_xgb
    threshold = best_f1_threshold(oof_y, oof_ensemble)
    say(f'    OOF average precision  RF {ap_rf:.3f}  XGB {ap_xgb:.3f}  '
        f'ensemble {average_precision_score(oof_y, oof_ensemble):.3f}  threshold {threshold:.3f}')

    # Held-out year.
    rf = clone(rf_template).fit(X_train, y_train)
    xgb = clone(xgb_template).fit(X_train, y_train)
    p_rf = rf.predict_proba(X_test)[:, 1]
    p_xgb = xgb.predict_proba(X_test)[:, 1]
    p_ens = weights['rf'] * p_rf + weights['xgb'] * p_xgb
    # Baseline: the app's live humidity rule. The score is humidity, so AUC is
    # comparable; the decision is the rule's own cut-off.
    rule_score = X_test['rh_mean'].to_numpy() / 100.0
    rule_cut = RULE_HUMIDITY_THRESHOLD[disease] / 100.0

    evaluation = {
        'random_forest': _metrics(y_test, p_rf, threshold),
        'xgboost': _metrics(y_test, p_xgb, threshold),
        'ensemble': _metrics(y_test, p_ens, threshold),
        'humidity_rule_baseline': _metrics(y_test, rule_score, rule_cut),
    }
    importances = _importances(rf, xgb, features)

    if final_refit:
        say('    refitting on all five years for deployment...')
        X_all = table[features]
        y_all = table[target].to_numpy()
        rf = clone(rf_template).fit(X_all, y_all)
        xgb = clone(xgb_template).set_params(model__scale_pos_weight=_pos_weight(y_all)).fit(X_all, y_all)

    bundle = {
        'disease': disease,
        'features': list(features),
        'rf': rf,
        'xgb': xgb,
        'weights': weights,
        'threshold': threshold,
        'label_model_version': LABEL_MODEL_VERSION,
        'trained_at': datetime.now(timezone.utc).isoformat(),
    }
    summary = {
        'threshold': round(threshold, 4),
        'weights': weights,
        'oof_average_precision': {'random_forest': round(ap_rf, 4), 'xgboost': round(ap_xgb, 4)},
        'train_prevalence': round(float(y_train.mean()), 4),
        'test_prevalence': round(float(y_test.mean()), 4),
        'test': evaluation,
        'top_features': importances,
        'hyperparameters': {'random_forest': rf_params or 'defaults', 'xgboost': xgb_params or 'defaults'},
    }
    return bundle, summary


def train_all(table, *, diseases=DISEASES, test_days=TEST_DAYS, tune=False, tune_iter=20,
              final_refit=True, n_jobs=-1, say=print):
    """Train every disease, save one bundle per disease, and write metadata.json."""
    started = time.time()
    labels = set(label_columns())
    features = [column for column in feature_columns(table) if column not in labels]
    # Guard against a label ever leaking into the inputs.
    leaked = [column for column in features if any(column.startswith(f'{d}_') for d in DISEASES)]
    if leaked:
        raise ValueError(f'Label columns found among features: {leaked}')

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    say(f'Training on {len(table):,} location-days x {len(features)} features '
        f'({table["location"].nunique()} locations, '
        f'{table["date"].min():%Y-%m-%d} to {table["date"].max():%Y-%m-%d})')

    results = {}
    for disease in diseases:
        bundle, summary = train_disease(
            table, disease, features, test_days=test_days, tune=tune, tune_iter=tune_iter,
            final_refit=final_refit, n_jobs=n_jobs, say=say,
        )
        path = MODEL_DIR / f'{disease}.joblib'
        joblib.dump(bundle, path, compress=3)
        summary['artifact'] = path.name
        results[disease] = summary

    metadata = {
        'model': 'OryzaWatch airborne rice disease forecast',
        'algorithms': ['RandomForestClassifier (scikit-learn)', 'XGBClassifier (xgboost)', 'weighted soft vote'],
        'trained_at': datetime.now(timezone.utc).isoformat(),
        'training_seconds': round(time.time() - started, 1),
        'data': {
            'source': 'Open-Meteo historical weather API (ERA5 reanalysis), hourly',
            'history_years': HISTORY_YEARS,
            'start': f'{table["date"].min():%Y-%m-%d}',
            'end': f'{table["date"].max():%Y-%m-%d}',
            'locations': sorted(table['location'].unique().tolist()),
            'rows': int(len(table)),
        },
        'validation': {
            'holdout_days': test_days,
            'embargo_days': EMBARGO_DAYS,
            'walk_forward_folds': CV_SPLITS,
            'deployed_model_refit_on_all_rows': final_refit,
        },
        'labels': {
            'kind': 'process-based epidemiological simulation over real hourly weather',
            'label_model_version': LABEL_MODEL_VERSION,
        },
        'features': features,
        'diseases': results,
        'versions': {
            'scikit-learn': sklearn.__version__,
            'xgboost': xgboost.__version__,
            'pandas': pd.__version__,
            'numpy': np.__version__,
        },
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2, default=str), encoding='utf-8')
    say(f'Saved models + metadata to {MODEL_DIR} in {metadata["training_seconds"]}s')
    return metadata
