"""ML Inference Service (v4 — PaySim High Fidelity)

Loads the PaySim RandomForest model and performs live feature engineering
for instant risk scoring. Matches train_model.py schema exactly.
"""

import os
import logging
import pandas as pd
import joblib

logger = logging.getLogger("sentinelclear.ml")

# Module-level singletons
_model = None
_scaler = None
_model_loaded = False

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml")
MODEL_PATH = os.path.join(MODEL_DIR, "fraud_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")

# MUST MATCH train_model.py EXACTLY
FEATURE_COLS = [
    "amount", 
    "oldbalanceOrg", 
    "newbalanceOrig", 
    "oldbalanceDest", 
    "newbalanceDest", 
    "errorBalanceOrig", 
    "errorBalanceDest", 
    "type_TRANSFER", 
    "type_CASH_OUT"
]

def load_model() -> bool:
    global _model, _scaler, _model_loaded
    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        logger.warning("ML model files not found. Fallback to rule-engine.")
        _model_loaded = False
        return False
    try:
        _model = joblib.load(MODEL_PATH)
        _scaler = joblib.load(SCALER_PATH)
        _model_loaded = True
        logger.info("✅ High-Fidelity PaySim ML Model loaded")
        return True
    except Exception as exc:
        logger.error("Failed to load model: %s", exc)
        return False

def is_model_loaded() -> bool:
    return _model_loaded

def predict_risk_score(
    amount: float,
    oldbalanceOrg: float,
    oldbalanceDest: float,
    is_transfer: bool = True
) -> float:
    """Predict risk using the PaySim model.
    In SentinelClear, atomic transfers imply newbalanceOrig = oldbalanceOrg - amount
    """
    if not _model_loaded:
        return 0.0
    try:
        # Calculate dynamic expected outputs
        newbalanceOrig = oldbalanceOrg - amount
        newbalanceDest = oldbalanceDest + amount
        
        # Calculate engineering features
        errorBalanceOrig = newbalanceOrig + amount - oldbalanceOrg
        errorBalanceDest = oldbalanceDest + amount - newbalanceDest
        
        # One hot encoded rules
        type_TRANSFER = 1 if is_transfer else 0
        type_CASH_OUT = 1 if not is_transfer else 0

        # Assembly
        data = {
            "amount": amount,
            "oldbalanceOrg": oldbalanceOrg,
            "newbalanceOrig": newbalanceOrig,
            "oldbalanceDest": oldbalanceDest,
            "newbalanceDest": newbalanceDest,
            "errorBalanceOrig": errorBalanceOrig,
            "errorBalanceDest": errorBalanceDest,
            "type_TRANSFER": type_TRANSFER,
            "type_CASH_OUT": type_CASH_OUT,
        }

        # Inference
        df = pd.DataFrame([data])
        scaled = _scaler.transform(df)
        proba = _model.predict_proba(scaled)[0][1]
        return round(float(proba), 6)
        
    except Exception as exc:
        logger.error("Inference failed: %s", exc)
        return 0.0
