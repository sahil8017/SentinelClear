"""
train_model.py — SentinelClear Fraud Detection Model Training
=============================================================

Trains a Random Forest classifier on the ULB Credit Card Fraud Dataset
(creditcard.csv) and saves the complete sklearn Pipeline + tuned
decision threshold for use by the FastAPI fraud service.

Dataset: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud
         284,807 transactions · 492 frauds (0.17%)
         Features: Time, V1–V28 (PCA), Amount, Class

Usage:
    cd c:\\MAJOR\\SentinelClear
    python model/train_model.py

Outputs:
    model/fraud_model.pkl   — sklearn Pipeline (scaler + classifier)
    model/threshold.json    — tuned decision threshold for fraud class

Author: SentinelClear Team
"""

import json
import os
import sys
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    auc,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# ═══════════════════════════════════════════════════════════════════
# WHY WE NEVER USE ACCURACY AS THE PRIMARY METRIC
# ═══════════════════════════════════════════════════════════════════
# The dataset is extremely imbalanced: only 0.17% of transactions
# are fraud.  A "dumb" classifier that predicts every transaction
# as legitimate achieves 99.83% accuracy — yet it catches ZERO
# frauds.  Accuracy is therefore meaningless here.
#
# Instead we focus on metrics that measure performance on the
# FRAUD CLASS (the minority class we actually care about):
#   • Precision  — of all predicted frauds, how many are real?
#   • Recall     — of all real frauds, how many did we catch?
#   • F1-score   — harmonic mean of precision and recall
#   • AUC-PR     — area under the Precision-Recall curve
# ═══════════════════════════════════════════════════════════════════


def load_dataset(csv_path: str) -> pd.DataFrame:
    """Load the credit card fraud dataset from a CSV file.

    The file must contain columns: Time, V1–V28, Amount, Class.
    """
    print(f"📂 Loading dataset from: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"   Rows: {len(df):,}  |  Columns: {df.shape[1]}")
    print(f"   Frauds: {df['Class'].sum():,}  ({df['Class'].mean()*100:.3f}%)")
    print(f"   Missing values: {df.isnull().sum().sum()}")
    return df


def build_pipeline() -> Pipeline:
    """Build an sklearn Pipeline: StandardScaler → RandomForestClassifier.

    Design decisions explained:
    ─────────────────────────────
    • StandardScaler on Amount and Time:
      V1–V28 are already PCA-normalised, but Amount and Time are raw.
      Scaling them ensures all features contribute equally to splits.

    • RandomForestClassifier:
      - n_estimators=100   → good balance of speed and performance
      - class_weight='balanced' → automatically up-weights the minority
        (fraud) class by the inverse of its frequency.  This is cheaper
        than SMOTE and avoids synthetic-sample artefacts.
      - random_state=42   → reproducibility
      - n_jobs=-1          → use all CPU cores for training speed

    • ColumnTransformer:
      We scale only 'Amount' and 'Time' (columns 0 and 29 in the
      feature array) and pass V1–V28 through unchanged.
    """
    # Column indices in the feature matrix X:
    #   0     = Time
    #   1–28  = V1 to V28 (already PCA-scaled, pass through)
    #   29    = Amount
    scaler = ColumnTransformer(
        transformers=[
            # Scale Time (index 0) and Amount (index 29)
            ("scale", StandardScaler(), [0, 29]),
        ],
        remainder="passthrough",  # V1–V28 pass through unchanged
    )

    classifier = RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced",   # handles the 0.17% imbalance
        random_state=42,
        n_jobs=-1,                 # parallelise across all CPU cores
    )

    pipeline = Pipeline([
        ("preprocessing", scaler),
        ("classifier", classifier),
    ])

    return pipeline


def tune_threshold(y_true: np.ndarray, y_proba: np.ndarray) -> tuple[float, float]:
    """Find the decision threshold that maximises F1-score for fraud.

    Default threshold 0.5 is rarely optimal for imbalanced datasets.
    We sweep all thresholds from the precision-recall curve and pick
    the one where F1 = 2·(precision·recall)/(precision+recall) is
    maximised for the positive (fraud) class.

    Returns:
        (best_threshold, best_f1)
    """
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)

    # precision_recall_curve returns arrays where len(thresholds) =
    # len(precisions) - 1, so we slice precisions/recalls to match.
    precisions = precisions[:-1]
    recalls = recalls[:-1]

    # Compute F1 at every threshold
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-10)

    best_idx = np.argmax(f1_scores)
    best_threshold = float(thresholds[best_idx])
    best_f1 = float(f1_scores[best_idx])

    return best_threshold, best_f1


def evaluate(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    threshold: float,
) -> dict:
    """Compute all evaluation metrics for the fraud class.

    Returns a dict with: precision, recall, f1, auc_pr, confusion_matrix
    """
    y_pred = (y_proba >= threshold).astype(int)

    prec = precision_score(y_true, y_pred, pos_label=1)
    rec = recall_score(y_true, y_pred, pos_label=1)
    f1 = f1_score(y_true, y_pred, pos_label=1)

    # AUC-PR: area under the precision-recall curve (uses probabilities)
    pr_precisions, pr_recalls, _ = precision_recall_curve(y_true, y_proba)
    auc_pr = auc(pr_recalls, pr_precisions)

    cm = confusion_matrix(y_true, y_pred)

    return {
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "auc_pr": auc_pr,
        "confusion_matrix": cm,
    }


def print_model_card(metrics: dict, threshold: float, train_time: float) -> None:
    """Print a clean summary of the trained model (model card)."""
    cm = metrics["confusion_matrix"]
    print("\n" + "═" * 60)
    print("  📋 MODEL CARD — SentinelClear Fraud Detection v1.0")
    print("═" * 60)
    print(f"  Model          : RandomForestClassifier (100 trees)")
    print(f"  Class balancing : class_weight='balanced'")
    print(f"  Dataset         : ULB Credit Card Fraud (284,807 txns)")
    print(f"  Train/Test split: 80/20 stratified (random_state=42)")
    print(f"  Training time   : {train_time:.1f}s")
    print(f"  ─────────────────────────────────────────────")
    print(f"  Decision threshold : {threshold:.4f}  (tuned for max F1)")
    print(f"  Precision (fraud)  : {metrics['precision']:.4f}")
    print(f"  Recall    (fraud)  : {metrics['recall']:.4f}")
    print(f"  F1-score  (fraud)  : {metrics['f1']:.4f}")
    print(f"  AUC-PR             : {metrics['auc_pr']:.4f}")
    print(f"  ─────────────────────────────────────────────")
    print(f"  Confusion Matrix:")
    print(f"    TN={cm[0][0]:,}  FP={cm[0][1]:,}")
    print(f"    FN={cm[1][0]:,}  TP={cm[1][1]:,}")
    print("═" * 60)


def main():
    # ── 1. Resolve paths ──────────────────────────────────────────
    # Script lives in model/, dataset in dataset/, relative to project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    csv_path = os.path.join(project_root, "dataset", "creditcard.csv")
    model_output = os.path.join(script_dir, "fraud_model.pkl")
    threshold_output = os.path.join(script_dir, "threshold.json")

    if not os.path.exists(csv_path):
        print(f"❌ Dataset not found at: {csv_path}")
        print("   Download it from: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud")
        sys.exit(1)

    # ── 2. Load data ──────────────────────────────────────────────
    df = load_dataset(csv_path)

    # Feature matrix X: [Time, V1, V2, ..., V28, Amount]  (30 columns)
    # Target vector y:  Class (0 = legit, 1 = fraud)
    X = df.drop(columns=["Class"]).values
    y = df["Class"].values

    print(f"\n🔢 Feature matrix shape: {X.shape}")
    print(f"   Column order: Time, V1–V28, Amount")

    # ── 3. Stratified train/test split ────────────────────────────
    # stratify=y ensures both sets preserve the 0.17% fraud ratio
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=42,
        stratify=y,    # CRITICAL for imbalanced datasets
    )
    print(f"\n📊 Train set: {len(X_train):,} samples  ({y_train.sum():,} frauds)")
    print(f"   Test set:  {len(X_test):,} samples  ({y_test.sum():,} frauds)")

    # ── 4. Build and train pipeline ───────────────────────────────
    pipeline = build_pipeline()

    print("\n🏋️ Training Random Forest (this may take 30–90 seconds)...")
    start = time.time()
    pipeline.fit(X_train, y_train)
    train_time = time.time() - start
    print(f"   ✅ Training complete in {train_time:.1f}s")

    # ── 5. Get fraud probabilities on test set ────────────────────
    # predict_proba returns [[P(legit), P(fraud)]] — we want column 1
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    # ── 6. Tune decision threshold ────────────────────────────────
    # We do NOT use the default 0.5 — it is suboptimal for imbalanced
    # data. Instead, we sweep all thresholds from the PR curve and
    # pick the one that maximises F1 for the fraud class.
    best_threshold, best_f1 = tune_threshold(y_test, y_proba)
    print(f"\n🎯 Tuned threshold: {best_threshold:.4f}  (F1 = {best_f1:.4f})")

    # ── 7. Full evaluation with tuned threshold ───────────────────
    metrics = evaluate(y_test, y_proba, best_threshold)

    # Also print sklearn's classification report for both classes
    y_pred_tuned = (y_proba >= best_threshold).astype(int)
    print("\n📊 Classification Report (tuned threshold):")
    print(classification_report(y_test, y_pred_tuned, target_names=["Legit", "Fraud"]))

    # ── 8. Save model and threshold ───────────────────────────────
    os.makedirs(os.path.dirname(model_output), exist_ok=True)

    joblib.dump(pipeline, model_output)
    print(f"\n💾 Model saved to: {model_output}")
    print(f"   File size: {os.path.getsize(model_output) / (1024*1024):.1f} MB")

    with open(threshold_output, "w") as f:
        json.dump({"threshold": best_threshold}, f, indent=2)
    print(f"   Threshold saved to: {threshold_output}")

    # ── 9. Print model card summary ───────────────────────────────
    print_model_card(metrics, best_threshold, train_time)

    # ── 10. Quick sanity check: load the saved model back ─────────
    print("\n🔍 Sanity check — loading saved model...")
    load_start = time.time()
    loaded_pipeline = joblib.load(model_output)
    load_time = time.time() - load_start
    print(f"   Model loaded in {load_time:.2f}s (must be < 3s)")

    # Run a single inference to verify
    sample = X_test[0:1]
    infer_start = time.time()
    prob = loaded_pipeline.predict_proba(sample)[:, 1][0]
    infer_time = (time.time() - infer_start) * 1000
    print(f"   Single inference: {infer_time:.1f}ms (must be < 100ms)")
    print(f"   Sample fraud probability: {prob:.4f}")

    print("\n✅ Training pipeline complete. Ready for deployment.")


if __name__ == "__main__":
    main()
