"""
Fraud detection service — ML-based with rule-based fallback.
=============================================================

This module loads a trained sklearn Pipeline (StandardScaler +
RandomForestClassifier) from model/fraud_model.pkl at FastAPI startup,
and uses it to score every transfer before it touches the database.

If the model file is unavailable (e.g., not yet trained, file missing),
the service falls back to a simple rule-based check:
    amount > FRAUD_AMOUNT_THRESHOLD → fraud

IMPORTANT LIMITATION — V1–V28 padding with zeros:
──────────────────────────────────────────────────
The model was trained on the ULB Credit Card Fraud Dataset which has
30 features: [Time, V1, V2, ..., V28, Amount].  V1–V28 are PCA-
transformed features derived from the original cardholder data.

In our PRODUCTION transactions, we only have Amount and Time — we do
NOT have V1–V28.  We pad those 28 features with zeros.  This means:
  • The model is effectively making predictions based on only 2 of 30
    features (Amount and Time).
  • Fraud detection quality is significantly lower than the training
    metrics suggest.
  • This is acceptable for a college project / prototype.
  • In production, you would integrate with a payment processor that
    provides behavioural features, or engineer your own features from
    transaction history (velocity, geolocation, device fingerprints).
"""

import json
import logging
import os
import time
from typing import Optional

import numpy as np

from app.config import settings

logger = logging.getLogger("sentinelclear.fraud")

# ─── Module-level state (set once during startup) ─────────────────
_pipeline = None          # sklearn Pipeline object
_threshold: float = 0.5   # decision threshold (overridden from threshold.json)
_model_available: bool = False


def load_model() -> None:
    """Load the trained model and threshold at FastAPI startup.

    Called once from the lifespan context manager in main.py.
    If loading fails, the module falls back to rule-based scoring.
    """
    global _pipeline, _threshold, _model_available

    # Resolve paths — model dir is at project-root/model/
    # Inside Docker, WORKDIR is /app, so model/ is at /app/model/
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_path = os.path.join(project_root, "model", "fraud_model.pkl")
    threshold_path = os.path.join(project_root, "model", "threshold.json")

    # ── Load the sklearn pipeline (.pkl) ──
    try:
        import joblib

        start = time.time()
        _pipeline = joblib.load(model_path)
        load_time = time.time() - start

        logger.info(
            "✅ ML fraud model loaded from %s in %.2fs",
            model_path, load_time,
        )

        if load_time > 3.0:
            logger.warning(
                "⚠️  Model load took %.1fs — exceeds the 3s target", load_time
            )

    except FileNotFoundError:
        logger.warning(
            "⚠️  Model file not found at %s — using rule-based fallback",
            model_path,
        )
        return
    except Exception as exc:
        logger.warning(
            "⚠️  Failed to load model (%s) — using rule-based fallback",
            exc,
        )
        return

    # ── Load the tuned threshold ──
    try:
        with open(threshold_path, "r") as f:
            data = json.load(f)
            _threshold = float(data["threshold"])
        logger.info("   Decision threshold: %.4f", _threshold)
    except Exception as exc:
        logger.warning(
            "⚠️  Could not load threshold.json (%s) — using default 0.5",
            exc,
        )
        _threshold = 0.5

    _model_available = True


def predict_fraud(amount: float, time_value: float = 0.0) -> dict:
    """Score a transaction for fraud.

    Args:
        amount:     Transfer amount in the transaction's currency.
        time_value: Seconds elapsed since some reference point (e.g.,
                    first transaction in the dataset).  In production
                    you'd compute this from your own reference timestamp.
                    Defaults to 0.0 if not available.

    Returns:
        {
            "is_fraud": bool,     # True if above the decision threshold
            "risk_score": float,  # Probability of fraud [0.0, 1.0]
        }
    """
    if _model_available and _pipeline is not None:
        return _predict_with_model(amount, time_value)
    else:
        return _predict_with_rules(amount)


def _predict_with_model(amount: float, time_value: float) -> dict:
    """Run the ML pipeline to get a fraud probability.

    Builds a 30-feature input vector:
        [Time, V1, V2, ..., V28, Amount]
    where V1–V28 are all zeros (see module docstring for why).
    """
    # Build feature vector: Time + 28 zeros (V1–V28) + Amount
    features = np.zeros(30)
    features[0] = time_value     # Time (column 0)
    features[29] = amount        # Amount (column 29)
    # features[1:29] remain 0.0  — V1 to V28 not available

    # sklearn expects a 2D array: [[features]]
    X = features.reshape(1, -1)

    # predict_proba returns [[P(legit), P(fraud)]]
    fraud_probability = float(_pipeline.predict_proba(X)[0][1])

    # Compare against our TUNED threshold (not the default 0.5)
    is_fraud = fraud_probability >= _threshold

    if is_fraud:
        logger.info(
            "🚨 ML fraud detected: amount=%.2f risk_score=%.4f threshold=%.4f",
            amount, fraud_probability, _threshold,
        )

    return {
        "is_fraud": is_fraud,
        "risk_score": round(fraud_probability, 6),
    }


def _predict_with_rules(amount: float) -> dict:
    """Fallback rule-based fraud scoring.

    Used when the ML model is not available.  Simply checks if the
    amount exceeds the configured FRAUD_AMOUNT_THRESHOLD (default 50,000).
    """
    logger.warning(
        "Using rule-based fallback for fraud scoring (ML model unavailable)"
    )

    is_fraud = amount > settings.FRAUD_AMOUNT_THRESHOLD
    # Map to a pseudo risk_score: 0.0 for safe, 0.95 for flagged
    risk_score = 0.95 if is_fraud else round(min(amount / settings.FRAUD_AMOUNT_THRESHOLD, 0.49), 6)

    return {
        "is_fraud": is_fraud,
        "risk_score": risk_score,
    }
