"""SentinelClear — Synthetic Financial Dataset Generator (v5)

Generates a realistic, high-volume dataset for loan eligibility prediction
modelled after Indian financial demographics and RBI lending norms.

Features:
  - Income distributions calibrated to Indian Census & NSSO data
  - Employment-type stratification (salaried, self-employed, freelancer, unemployed)
  - CIBIL-like credit score generation (300–900)
  - FOIR (Fixed Obligation to Income Ratio) computation per RBI guidelines
  - Loan eligibility labels derived from a probabilistic risk model

Output:
  app/ml/data/loan_eligibility_dataset.csv
"""

import os
import numpy as np
import pandas as pd

np.random.seed(42)

# ─────────────────────── Configuration ───────────────────────

NUM_SAMPLES = 25_000
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "loan_eligibility_dataset.csv")

# Indian income distribution anchors (monthly, INR)
INCOME_PARAMS = {
    "salaried":      {"mean": 55000, "std": 30000, "min": 12000, "max": 500000},
    "self_employed":  {"mean": 65000, "std": 45000, "min": 8000,  "max": 800000},
    "freelancer":     {"mean": 40000, "std": 25000, "min": 5000,  "max": 300000},
    "unemployed":     {"mean": 5000,  "std": 3000,  "min": 0,     "max": 15000},
}

EMPLOYMENT_TYPES = ["salaried", "self_employed", "freelancer", "unemployed"]
EMPLOYMENT_WEIGHTS = [0.50, 0.25, 0.15, 0.10]  # Rough Indian workforce split

RESIDENCE_TYPES = ["owned", "rented", "parental"]
RESIDENCE_WEIGHTS = [0.35, 0.40, 0.25]


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def _generate_income(emp_type: str) -> float:
    p = INCOME_PARAMS[emp_type]
    income = np.random.normal(p["mean"], p["std"])
    return round(_clamp(income, p["min"], p["max"]), 0)


def _generate_credit_score(
    repayment_score: float,
    num_defaults: int,
    account_age_months: int,
    debt_to_income: float,
    employment_years: float,
    foir: float,
) -> int:
    """Simulate CIBIL-like scoring (300-900).

    Weights inspired by actual CIBIL scoring factors:
      - Repayment history:  35%  -> 0-210 points
      - Credit utilization: 25%  -> 0-150 points (inverse FOIR)
      - Credit age:         15%  -> 0-90 points
      - Credit mix/stability:15% -> 0-90 points
      - Enquiries/noise:    10%  -> 0-60 points
    """
    base = 300

    # Repayment history (0-210 points, 35% of 600 range)
    base += repayment_score * 210

    # Defaults penalty (up to -120)
    base -= min(num_defaults * 60, 120)

    # Credit utilization / FOIR (0-150 points, 25%)
    # Lower FOIR = better score
    foir_bonus = max(0, 1.0 - foir) * 150
    base += foir_bonus

    # Credit age bonus (up to 90 points, 15%)
    age_factor = min(account_age_months / 120, 1.0)
    base += age_factor * 90

    # Employment stability (up to 90 points, 15%)
    emp_factor = min(employment_years / 15, 1.0)
    base += emp_factor * 90

    # DTI penalty (only for truly high DTI)
    if debt_to_income > 0.40:
        base -= (debt_to_income - 0.40) * 120

    # Random noise (+/- 25)
    base += np.random.normal(0, 12)

    return int(_clamp(base, 300, 900))


def _compute_foir(existing_liabilities: float, monthly_income: float) -> float:
    """Fixed Obligation to Income Ratio — RBI recommends max 50% for unsecured loans."""
    if monthly_income <= 0:
        return 1.0
    return round(existing_liabilities / monthly_income, 4)


def _compute_eligibility_probability(row: dict) -> float:
    """Probabilistic eligibility model based on RBI lending heuristics.

    This generates the ground-truth label. The ML model will learn
    to approximate this function from the features.
    Calibrated to produce ~65-70% approval rate (matching real Indian lending).
    """
    score = 0.0

    # ── Credit Score (most important, 30% weight) ──
    cs = row["credit_score"]
    if cs >= 750:
        score += 0.25
    elif cs >= 700:
        score += 0.15
    elif cs >= 650:
        score += 0.05
    elif cs >= 550:
        score -= 0.10
    else:
        score -= 0.30

    # ── FOIR (25% weight) — RBI recommends < 0.50 ──
    foir = row["foir"]
    if foir < 0.20:
        score += 0.20
    elif foir < 0.35:
        score += 0.10
    elif foir < 0.50:
        score -= 0.05
    elif foir < 0.70:
        score -= 0.15
    else:
        score -= 0.30

    # ── Debt-to-Income (15% weight) ──
    dti = row["debt_to_income"]
    if dti < 0.15:
        score += 0.15
    elif dti < 0.30:
        score += 0.05
    elif dti < 0.50:
        score -= 0.05
    else:
        score -= 0.15

    # ── Repayment History (15% weight) ──
    rh = row["repayment_history_score"]
    score += (rh - 0.6) * 0.35  # Centered higher — penalize below 0.6

    # ── Employment Stability (10% weight) ──
    if row["employment_type"] == "salaried" and row["employment_years"] >= 2:
        score += 0.10
    elif row["employment_type"] == "self_employed" and row["employment_years"] >= 3:
        score += 0.06
    elif row["employment_type"] == "freelancer" and row["employment_years"] >= 2:
        score += 0.02
    elif row["employment_type"] == "unemployed":
        score -= 0.20
    else:
        score -= 0.02

    # ── Age factor (5% weight) ──
    age = row["age"]
    if 25 <= age <= 50:
        score += 0.05
    elif age < 22 or age > 60:
        score -= 0.08
    elif age > 55:
        score -= 0.03

    # ── Loan amount vs income feasibility ──
    loan_to_income = row["loan_amount_requested"] / max(row["monthly_income"] * 12, 1)
    if loan_to_income > 4.0:
        score -= 0.25
    elif loan_to_income > 2.5:
        score -= 0.12
    elif loan_to_income > 1.5:
        score -= 0.05
    elif loan_to_income < 0.5:
        score += 0.05

    # ── Defaults penalty (severe) ──
    score -= row["num_defaults"] * 0.15

    # ── Asset safety net ──
    if row["total_assets"] > row["loan_amount_requested"] * 2.0:
        score += 0.05
    elif row["total_assets"] < row["loan_amount_requested"] * 0.5:
        score -= 0.05

    # ── Transaction regularity ──
    score += (row["transaction_regularity"] - 0.5) * 0.10

    # ── Dependents burden ──
    if row["dependents"] >= 4:
        score -= 0.05

    # Normalize to probability with steeper sigmoid and negative bias
    # The -0.3 bias shifts the center to require positive signals for approval
    probability = 1.0 / (1.0 + np.exp(-(score - 0.05) * 6))

    # Add small noise
    probability += np.random.normal(0, 0.04)
    return _clamp(probability, 0.0, 1.0)


def generate_dataset() -> pd.DataFrame:
    """Generate the full synthetic dataset."""
    records = []

    for i in range(NUM_SAMPLES):
        # ── Demographics ──
        age = int(_clamp(np.random.normal(35, 12), 18, 75))
        emp_type = np.random.choice(EMPLOYMENT_TYPES, p=EMPLOYMENT_WEIGHTS)
        residence = np.random.choice(RESIDENCE_TYPES, p=RESIDENCE_WEIGHTS)

        # Employment years (correlated with age)
        max_emp_years = max(age - 18, 0)
        if emp_type == "unemployed":
            emp_years = round(np.random.uniform(0, min(2, max_emp_years)), 1)
        else:
            emp_years = round(_clamp(np.random.normal(max_emp_years * 0.5, 4), 0, max_emp_years), 1)

        dependents = int(_clamp(np.random.poisson(1.5), 0, 8))

        # ── Income ──
        monthly_income = _generate_income(emp_type)

        # ── Liabilities (correlated with income) ──
        liability_ratio = _clamp(np.random.beta(2, 5), 0, 0.8)
        existing_liabilities = round(monthly_income * liability_ratio, 0)

        # ── Assets (correlated with income, age, employment) ──
        asset_multiplier = _clamp(np.random.normal(12, 8), 0, 60)
        if residence == "owned":
            asset_multiplier += 20  # Property value
        total_assets = round(monthly_income * asset_multiplier, 0)

        # ── Behavioural Signals ──
        # Repayment history: Beta distribution skewed towards good
        repayment_score = round(_clamp(np.random.beta(5, 2), 0, 1), 3)

        # Account age: correlated with employment years and actual age
        account_age_months = int(_clamp(
            np.random.normal(emp_years * 8 + age * 0.5, 15), 1, 360
        ))

        # Average monthly balance
        balance_ratio = _clamp(np.random.beta(3, 4), 0, 1)
        avg_monthly_balance = round(monthly_income * balance_ratio * 3, 0)

        # Previous loans
        num_previous_loans = int(_clamp(np.random.poisson(1.2), 0, 10))

        # Defaults (rare, correlated with low repayment score)
        default_prob = max(0, (1 - repayment_score) * 0.3)
        num_defaults = int(np.random.binomial(num_previous_loans, default_prob))

        # Transaction regularity
        if emp_type == "salaried":
            txn_reg = _clamp(np.random.beta(6, 2), 0, 1)
        elif emp_type == "self_employed":
            txn_reg = _clamp(np.random.beta(4, 3), 0, 1)
        else:
            txn_reg = _clamp(np.random.beta(3, 4), 0, 1)
        txn_reg = round(txn_reg, 3)

        # ── Computed Ratios ──
        foir = _compute_foir(existing_liabilities, monthly_income)
        annual_income = monthly_income * 12
        debt_to_income = round(existing_liabilities * 12 / max(annual_income, 1), 4)

        # ── Loan Request ──
        # Loan amount: 50K to 5L (capped by RBI unsecured limit)
        loan_amount = round(_clamp(
            np.random.lognormal(np.log(150000), 0.8), 10000, 500000
        ), -3)  # Round to nearest 1000

        loan_duration = int(np.random.choice([6, 12, 18, 24, 36, 48, 60], p=[0.05, 0.25, 0.15, 0.25, 0.15, 0.10, 0.05]))

        # ── Credit Score ──
        credit_score = _generate_credit_score(
            repayment_score, num_defaults, account_age_months,
            debt_to_income, emp_years, foir
        )

        record = {
            "age": age,
            "employment_type": emp_type,
            "employment_years": emp_years,
            "monthly_income": monthly_income,
            "existing_liabilities": existing_liabilities,
            "total_assets": total_assets,
            "dependents": dependents,
            "residence_type": residence,
            "repayment_history_score": repayment_score,
            "account_age_months": account_age_months,
            "avg_monthly_balance": avg_monthly_balance,
            "num_previous_loans": num_previous_loans,
            "num_defaults": num_defaults,
            "transaction_regularity": txn_reg,
            "credit_score": credit_score,
            "foir": foir,
            "debt_to_income": debt_to_income,
            "loan_amount_requested": loan_amount,
            "loan_duration_months": loan_duration,
        }

        # ── Eligibility Label ──
        eligibility_prob = _compute_eligibility_probability(record)
        is_eligible = 1 if eligibility_prob >= 0.5 else 0

        record["eligibility_probability"] = round(eligibility_prob, 4)
        record["is_eligible"] = is_eligible

        records.append(record)

    df = pd.DataFrame(records)

    # One-hot encode categorical features for ML
    df["emp_salaried"] = (df["employment_type"] == "salaried").astype(int)
    df["emp_self_employed"] = (df["employment_type"] == "self_employed").astype(int)
    df["emp_freelancer"] = (df["employment_type"] == "freelancer").astype(int)
    df["emp_unemployed"] = (df["employment_type"] == "unemployed").astype(int)
    df["res_owned"] = (df["residence_type"] == "owned").astype(int)
    df["res_rented"] = (df["residence_type"] == "rented").astype(int)
    df["res_parental"] = (df["residence_type"] == "parental").astype(int)

    return df


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Generating {NUM_SAMPLES:,} synthetic financial profiles...")
    df = generate_dataset()

    # Distribution check  
    eligible_pct = df["is_eligible"].mean() * 100
    print(f"\nDataset Shape: {df.shape}")
    print(f"Eligible: {eligible_pct:.1f}% | Rejected: {100 - eligible_pct:.1f}%")
    print(f"\nCredit Score Distribution:")
    print(f"  300–499 (Poor):      {(df['credit_score'] < 500).sum():>5}")
    print(f"  500–649 (Fair):      {((df['credit_score'] >= 500) & (df['credit_score'] < 650)).sum():>5}")
    print(f"  650–749 (Good):      {((df['credit_score'] >= 650) & (df['credit_score'] < 750)).sum():>5}")
    print(f"  750–900 (Excellent): {(df['credit_score'] >= 750).sum():>5}")
    print(f"\nFOIR Distribution (RBI max 50%):")
    print(f"  < 30%:  {(df['foir'] < 0.30).sum():>5}")
    print(f"  30–50%: {((df['foir'] >= 0.30) & (df['foir'] < 0.50)).sum():>5}")
    print(f"  > 50%:  {(df['foir'] >= 0.50).sum():>5}")

    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\n[OK] Dataset exported to {OUTPUT_PATH}")
