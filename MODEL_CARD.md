# Model Card — SentinelClear Fraud Detection v1.0

## Overview

A **Random Forest classifier** trained on the ULB Credit Card Fraud Dataset to score financial transactions for fraud risk in real time. The model produces a fraud probability (`risk_score`) that is compared against a tuned decision threshold to block suspicious transfers.

---

## Dataset

| Property | Value |
|----------|-------|
| **Name** | [ULB Credit Card Fraud Detection](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) |
| **Source** | Kaggle — Machine Learning Group, Université Libre de Bruxelles |
| **Transactions** | 284,807 |
| **Fraud cases** | 492 (0.17%) |
| **Features** | Time, V1–V28 (PCA-transformed), Amount |
| **Target** | Class (0 = legitimate, 1 = fraud) |

### Citation

> Andrea Dal Pozzolo, Olivier Caelen, Reid A. Johnson and Gianluca Bontempi.
> *Calibrating Probability with Undersampling for Unbalanced Classification.*
> IEEE Symposium on Computational Intelligence and Data Mining (CIDM), 2015.

---

## Features

### Training Features (30 total)

| Feature | Description |
|---------|------------|
| `Time` | Seconds elapsed since first transaction in dataset |
| `V1` – `V28` | PCA-transformed anonymised features |
| `Amount` | Transaction amount |

### Production Features (2 of 30)

In our live SentinelClear system, we only have access to **Amount** and **Time**. The 28 PCA features (`V1`–`V28`) are **padded with zeros** because they are derived from cardholder behavioural data that our system does not capture.

> **⚠️ This means the model operates on only ~7% of its trained feature space in production. Real-world performance will be lower than the metrics below.**

---

## Training Approach

| Parameter | Value |
|-----------|-------|
| **Algorithm** | `RandomForestClassifier` (scikit-learn) |
| **Trees** | 100 (`n_estimators=100`) |
| **Imbalance handling** | `class_weight='balanced'` — inversely weights classes by frequency |
| **Scaling** | `StandardScaler` on Amount and Time; V1–V28 passed through |
| **Train/Test split** | 80/20 stratified (`random_state=42`) |
| **Pipeline** | `ColumnTransformer` → `RandomForestClassifier` (saved as single `.pkl`) |

### Why Not Accuracy?

With 99.83% legitimate transactions, a model that always predicts "not fraud" achieves 99.83% accuracy while catching zero frauds. We exclusively use fraud-class-specific metrics.

---

## Evaluation Metrics (Fraud Class)

| Metric | Value |
|--------|-------|
| **Decision Threshold** | 0.31 (tuned for max F1) |
| **Precision (fraud)** | 0.9425 |
| **Recall (fraud)** | 0.8367 |
| **F1-score (fraud)** | 0.8865 |
| **AUC-PR** | 0.8701 |

### Confusion Matrix

```
              Predicted
              Legit    Fraud
Actual Legit  TN=56859 FP=5
Actual Fraud  FN=16    TP=82
```

---

## Decision Threshold

The default sklearn threshold of **0.5** is suboptimal for heavily imbalanced datasets. We sweep all thresholds from the Precision-Recall curve and select the one that **maximises the F1-score** for the fraud class.

This balances catching as many frauds as possible (high recall) against not blocking too many legitimate transactions (high precision).

The tuned threshold is saved to `model/threshold.json` and loaded at API startup.

---

## Known Limitations

1. **Reduced feature coverage** — Only 2 of 30 features are available in production (Amount, Time). The 28 PCA features are zero-padded.
2. **Static model** — No online learning; the model does not update from live transaction feedback.
3. **Threshold is global** — A single threshold is used for all users and account types.
4. **Time feature** — In training, Time = seconds since first dataset transaction. In production, we pass `0.0` as a placeholder. This reduces the feature's predictive value.
5. **No velocity features** — The model does not consider transaction frequency, geolocation, or device information.

## Production Recommendations

- Integrate with a payment processor that provides behavioural features
- Engineer velocity-based features (transactions per hour, per device, etc.)
- Implement a feedback loop for model retraining with labelled production data
- Use A/B testing to compare model versions
- Add model versioning and the ability to roll back

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-03-09 | Initial release — Random Forest on ULB dataset |
