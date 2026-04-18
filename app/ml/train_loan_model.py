"""SentinelClear ML Training Pipeline (v5 — Credit Scoring & Loan Eligibility)

Trains a Gradient Boosted + Random Forest ensemble model on the custom
synthetic financial dataset to predict loan eligibility.

Pipeline:
  1. Load dataset from generate_dataset.py output
  2. Feature engineering & selection
  3. Stratified train/test split (80/20)
  4. StandardScaler normalization
  5. Train RandomForestClassifier with hyperparameter tuning
  6. Evaluate with precision, recall, F1, AUC-ROC
  7. Export model + scaler + feature metadata

Output:
  app/ml/loan_eligibility_model.pkl
  app/ml/loan_eligibility_scaler.pkl
  app/ml/model_metadata.json
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, classification_report, confusion_matrix
)

# ─────────────────────── Paths ───────────────────────

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(MODEL_DIR, "data")
DATASET_PATH = os.path.join(DATA_DIR, "loan_eligibility_dataset.csv")

MODEL_PATH = os.path.join(MODEL_DIR, "loan_eligibility_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "loan_eligibility_scaler.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")

# ─────────────────────── Feature Definition ───────────────────────

# These MUST match the columns used by ml_loan_service.py at inference time
FEATURE_COLS = [
    "age",
    "employment_years",
    "monthly_income",
    "existing_liabilities",
    "total_assets",
    "dependents",
    "repayment_history_score",
    "account_age_months",
    "avg_monthly_balance",
    "num_previous_loans",
    "num_defaults",
    "transaction_regularity",
    "credit_score",
    "foir",
    "debt_to_income",
    "loan_amount_requested",
    "loan_duration_months",
    # One-hot encoded
    "emp_salaried",
    "emp_self_employed",
    "emp_freelancer",
    "emp_unemployed",
    "res_owned",
    "res_rented",
    "res_parental",
]

LABEL_COL = "is_eligible"

# Human-readable feature labels for XAI
FEATURE_LABELS = {
    "age": "Applicant Age",
    "employment_years": "Employment Tenure (Years)",
    "monthly_income": "Monthly Income (₹)",
    "existing_liabilities": "Existing Monthly Obligations (₹)",
    "total_assets": "Total Assets Value (₹)",
    "dependents": "Financial Dependents",
    "repayment_history_score": "Repayment Track Record",
    "account_age_months": "Banking Relationship Duration",
    "avg_monthly_balance": "Average Monthly Balance (₹)",
    "num_previous_loans": "Previous Loan Count",
    "num_defaults": "Past Defaults",
    "transaction_regularity": "Transaction Consistency",
    "credit_score": "CIBIL Credit Score",
    "foir": "Fixed Obligation to Income Ratio",
    "debt_to_income": "Debt-to-Income Ratio",
    "loan_amount_requested": "Requested Loan Amount (₹)",
    "loan_duration_months": "Requested Loan Tenure (Months)",
    "emp_salaried": "Salaried Employment",
    "emp_self_employed": "Self-Employment",
    "emp_freelancer": "Freelance Work",
    "emp_unemployed": "Unemployed Status",
    "res_owned": "Owns Residence",
    "res_rented": "Rented Residence",
    "res_parental": "Living with Parents",
}


def train():
    """Full training pipeline."""
    if not os.path.exists(DATASET_PATH):
        print(f"ERROR: Dataset not found at {DATASET_PATH}")
        print("Run `python -m app.ml.generate_dataset` first.")
        return

    print("=" * 60)
    print("  SentinelClear ML Training Pipeline v5")
    print("  Credit Scoring & Loan Eligibility Model")
    print("=" * 60)

    # ── Step 1: Load ──
    print("\n[1/6] Loading dataset...")
    df = pd.read_csv(DATASET_PATH)
    print(f"  Rows: {len(df):,}  |  Columns: {len(df.columns)}")
    print(f"  Eligible: {df[LABEL_COL].mean()*100:.1f}%  |  Rejected: {(1-df[LABEL_COL].mean())*100:.1f}%")

    # ── Step 2: Feature extraction ──
    print("\n[2/6] Extracting features...")
    X = df[FEATURE_COLS].copy()
    y = df[LABEL_COL].copy()

    # Verify no NaN
    nan_cols = X.columns[X.isna().any()].tolist()
    if nan_cols:
        print(f"  ⚠️ NaN found in: {nan_cols}. Filling with median.")
        X = X.fillna(X.median())

    print(f"  Feature matrix: {X.shape}")

    # ── Step 3: Train/Test Split ──
    print("\n[3/6] Stratified train/test split (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"  Train: {len(X_train):,}  |  Test: {len(X_test):,}")

    # ── Step 4: Scaling ──
    print("\n[4/6] StandardScaler normalization...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # ── Step 5: Train ──
    print("\n[5/6] Training ensemble model...")

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=10,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    gb = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=8,
        learning_rate=0.1,
        min_samples_split=10,
        min_samples_leaf=5,
        subsample=0.8,
        random_state=42,
    )

    # Soft-voting ensemble
    model = VotingClassifier(
        estimators=[("rf", rf), ("gb", gb)],
        voting="soft",
        weights=[1, 1],
    )

    model.fit(X_train_scaled, y_train)
    print("  ✓ Ensemble (RandomForest + GradientBoosting) trained")

    # ── Step 6: Evaluate ──
    print("\n[6/6] Evaluation...")

    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc_roc = roc_auc_score(y_test, y_proba)

    print(f"\n  {'Metric':<25} {'Score':>8}")
    print(f"  {'─' * 34}")
    print(f"  {'Accuracy':<25} {accuracy*100:>7.2f}%")
    print(f"  {'Precision':<25} {precision*100:>7.2f}%")
    print(f"  {'Recall':<25} {recall*100:>7.2f}%")
    print(f"  {'F1 Score':<25} {f1*100:>7.2f}%")
    print(f"  {'AUC-ROC':<25} {auc_roc*100:>7.2f}%")

    print(f"\n  Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(f"                  Predicted")
    print(f"                  Reject  Eligible")
    print(f"  Actual Reject   {cm[0][0]:>5}   {cm[0][1]:>5}")
    print(f"  Actual Eligible {cm[1][0]:>5}   {cm[1][1]:>5}")

    # Cross-validation
    print(f"\n  5-Fold Cross-Validation F1:")
    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring="f1", n_jobs=-1)
    print(f"  Scores: {[f'{s:.4f}' for s in cv_scores]}")
    print(f"  Mean: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Feature importance (from RF component)
    rf_model = model.named_estimators_["rf"]
    importances = rf_model.feature_importances_
    feature_importance = sorted(
        zip(FEATURE_COLS, importances),
        key=lambda x: x[1],
        reverse=True,
    )
    print(f"\n  Top 10 Feature Importances:")
    for feat, imp in feature_importance[:10]:
        label = FEATURE_LABELS.get(feat, feat)
        print(f"    {label:<35} {imp*100:>6.2f}%")

    # ── Export ──
    print("\n" + "=" * 60)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    metadata = {
        "version": "5.0.0",
        "model_type": "VotingClassifier(RandomForest+GradientBoosting)",
        "feature_columns": FEATURE_COLS,
        "feature_labels": FEATURE_LABELS,
        "num_features": len(FEATURE_COLS),
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "metrics": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "auc_roc": round(auc_roc, 4),
            "cv_f1_mean": round(cv_scores.mean(), 4),
            "cv_f1_std": round(cv_scores.std(), 4),
        },
        "feature_importance": {
            feat: round(float(imp), 4) for feat, imp in feature_importance
        },
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  ✅ Model  → {MODEL_PATH}")
    print(f"  ✅ Scaler → {SCALER_PATH}")
    print(f"  ✅ Meta   → {METADATA_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    train()
