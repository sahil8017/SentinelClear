# Model Card — SentinelClear Fraud Detection v1.0

## Overview

A **Random Forest classifier** trained on the ULB Credit Card Fraud Detection dataset to score financial transactions for fraud risk in real time. The model outputs a `risk_score` (fraud probability) which is compared against a tuned decision threshold to block suspicious transfers.

The model is complemented by a **rule-based fallback** that activates automatically when the model file is unavailable.

---

## Dataset

| Property          | Value |
|-------------------|-------|
| **Name**          | [ULB Credit Card Fraud Detection](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) |
| **Source**        | Kaggle — Machine Learning Group, Université Libre de Bruxelles |
| **Transactions**  | 284,807 |
| **Fraud cases**   | 492 (0.17% — heavily imbalanced) |
| **Features**      | Time, V1–V28 (PCA-transformed), Amount |
| **Target**        | Class (0 = legitimate, 1 = fraud) |

### Citation

> Andrea Dal Pozzolo, Olivier Caelen, Reid A. Johnson and Gianluca Bontempi.  
> *Calibrating Probability with Undersampling for Unbalanced Classification.*  
> IEEE Symposium on Computational Intelligence and Data Mining (CIDM), 2015.

---

## Feature Engineering

### Training Features (30 total)

| Feature      | Description |
|--------------|-------------|
| `Time`       | Seconds elapsed since first transaction in the dataset |
| `V1` – `V28` | PCA-transformed anonymised cardholder behavioural features |
| `Amount`     | Transaction amount |

### Production Features (2 of 30)

In the live SentinelClear system, only **Amount** and **Time** are available. The 28 PCA features (`V1`–`V28`) are derived from raw cardholder behavioural data (tap patterns, device fingerprints, etc.) that our backend does not capture.

**In production, these 28 features are zero-padded.**

> ⚠️ **The model operates on ~7% of its trained feature space in production. Real-world recall will be lower than the offline metrics below. The rule-based fallback (₹50,000 threshold) compensates for this limitation.**

---

## Training Configuration

| Parameter           | Value |
|---------------------|-------|
| **Algorithm**       | `RandomForestClassifier` (scikit-learn) |
| **Estimators**      | 100 (`n_estimators=100`) |
| **Imbalance**       | `class_weight='balanced'` — inverse-frequency weighting |
| **Preprocessing**   | `StandardScaler` on Amount and Time; V1–V28 passed through |
| **Train/Test Split**| 80/20 stratified (`random_state=42`) |
| **Artifact**        | Saved as a single `sklearn.pipeline.Pipeline` (`.pkl`) |

### Why Not Accuracy?

With 99.83% legitimate transactions, a naive classifier achieves 99.83% accuracy by predicting "not fraud" for every transaction — while catching **zero frauds**. All evaluation is done on fraud-class-specific metrics only.

---

## Evaluation Metrics (Fraud Class, Test Set)

| Metric                | Value  |
|-----------------------|--------|
| **Decision Threshold**| 0.31 (tuned for maximum F1) |
| **Precision (fraud)** | 0.9425 |
| **Recall (fraud)**    | 0.8367 |
| **F1-score (fraud)**  | 0.8865 |
| **AUC-PR**            | 0.8701 |

### Confusion Matrix

```
                  Predicted
                  Legit    Fraud
Actual  Legit     56,859     5      ← 5 false positives (legitimate blocked)
Actual  Fraud         16    82      ← 16 false negatives (fraud let through)
```

---

## Decision Threshold Tuning

The default scikit-learn threshold of **0.5** is suboptimal for heavily imbalanced fraud data. We sweep all thresholds derivable from the Precision-Recall curve and select the threshold that **maximises the F1-score** for the fraud class.

This balances:
- **High recall** — catching as many frauds as possible
- **High precision** — not blocking too many legitimate transactions

The tuned threshold (`0.31`) is written to `model/threshold.json` at training time and loaded at API startup.

---

## Fallback: Rule-Based Detection

When `model/fraud_model.pkl` is unavailable, the system automatically falls back to a rule-based scorer:

| Rule                          | Action |
|-------------------------------|--------|
| `amount > FRAUD_AMOUNT_THRESHOLD` (default ₹50,000) | Returns `risk_score = 1.0` → FLAGGED |
| All other transactions        | Returns `risk_score = 0.0` → ALLOWED |

The threshold is configurable via the `FRAUD_AMOUNT_THRESHOLD` environment variable in `.env`.

---

## Known Limitations

1. **Reduced feature coverage** — Only 2 of 30 features are available in production. The 28 PCA features are zero-padded, significantly reducing model effectiveness.
2. **Static model** — No online learning. The model does not retrain from live transaction feedback.
3. **Global threshold** — A single threshold is applied to all users, account types, and transaction categories.
4. **Time feature degradation** — In training, `Time` = seconds since dataset epoch. In production, `0.0` is passed as a placeholder, eliminating its predictive value.
5. **No velocity / contextual features** — The model does not consider transaction frequency, geolocation, device identity, or merchant category.

---

## Production Recommendations

- Integrate with a payment processor or data provider that supplies behavioural features (V1–V28 equivalents)
- Engineer velocity features: transactions per minute per user, per device, per merchant
- Implement a continuous feedback loop for retraining with labelled production data
- Add model versioning and A/B testing infrastructure
- Consider using an online learning model (e.g., river, Vowpal Wabbit) for real-time adaptation
- Add per-user adaptive thresholds based on spending history

---

## Version History

| Version | Date       | Changes |
|---------|------------|---------|
| v1.0    | 2026-03-09 | Initial release — Random Forest on ULB dataset, tuned threshold 0.31 |
