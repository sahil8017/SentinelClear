"""SentinelClear ML Training Pipeline (v4 — PaySim Integration)
Trains Random Forest model based on PaySim synthetic financial dataset.
"""

import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import f1_score

DATASET_PATH = r"C:\PROJECT\MAJOR\SentinelClear\dataset\PS_20174392719_1491204439457_log.csv"
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "fraud_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")

# Exclusive feature columns expected by ml_service.py
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

def engineer(df):
    # Base restrictions to common fraud vectors in PaySim
    df = df[df.type.isin(['TRANSFER', 'CASH_OUT'])].copy()
    
    # Feature 1: Balance Error Origin
    df["errorBalanceOrig"] = df["newbalanceOrig"] + df["amount"] - df["oldbalanceOrg"]
    
    # Feature 2: Balance Error Destination
    df["errorBalanceDest"] = df["oldbalanceDest"] + df["amount"] - df["newbalanceDest"]
    
    # One-hot encoding of type
    df["type_TRANSFER"] = (df["type"] == "TRANSFER").astype(int)
    df["type_CASH_OUT"] = (df["type"] == "CASH_OUT").astype(int)
    
    return df

def train():
    if not os.path.exists(DATASET_PATH):
        print(f"ERROR: Dataset not found at {DATASET_PATH}")
        return

    print("Loading PaySim dataset...")
    df = pd.read_csv(DATASET_PATH)
    
    print("Engineering features...")
    df = engineer(df)
    
    print("Intelligently downsampling majority class...")
    fraud = df[df["isFraud"] == 1]
    legit = df[df["isFraud"] == 0]
    
    # 1:10 ratio preserves recall while protecting precision
    legit_sampled = legit.sample(n=len(fraud) * 10, random_state=42)
    df_balanced = pd.concat([fraud, legit_sampled]).sample(frac=1, random_state=42).reset_index(drop=True)
    
    X = df_balanced[FEATURE_COLS]
    y = df_balanced["isFraud"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print("Training Anti-Overfit RandomForestClassifier (max_depth=10)...")
    model = RandomForestClassifier(
        n_estimators=100, 
        max_depth=10, 
        class_weight='balanced', 
        random_state=42, 
        n_jobs=-1
    )
    model.fit(X_train_scaled, y_train)
    
    train_f1 = f1_score(y_train, model.predict(X_train_scaled))
    test_f1 = f1_score(y_test, model.predict(X_test_scaled))
    
    print("-" * 30)
    print(f"Target Train F1: ~94% | Actual Train F1: {train_f1 * 100:.2f}%")
    print(f"Target Test F1: ~90%  | Actual Test F1:  {test_f1 * 100:.2f}%")
    print("-" * 30)
    
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"✅ High-Fidelity PaySim Model Exported.")

if __name__ == "__main__":
    train()
