"""ML Loan Eligibility Service — Credit Scoring & Explainable AI

Loads the trained ensemble model and provides:
  1. Credit score computation (CIBIL-like 300–900)
  2. Loan eligibility prediction with probability
  3. Explainable AI (XAI) breakdown for every decision
  4. RBI-aligned risk categorization and remarks
  5. Max eligible amount and risk-adjusted interest rate computation
"""

import os
import json
import logging
import math
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger("sentinelclear.ml_loan")

# ─────────────────────── Module State ───────────────────────

_model = None
_scaler = None
_metadata = None
_model_loaded = False

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ml")
MODEL_PATH = os.path.join(MODEL_DIR, "loan_eligibility_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "loan_eligibility_scaler.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "model_metadata.json")

# ─────────────────────── Feature Definition ───────────────────────

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
    "emp_salaried",
    "emp_self_employed",
    "emp_freelancer",
    "emp_unemployed",
    "res_owned",
    "res_rented",
    "res_parental",
]

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


# ─────────────────────── Model Loading ───────────────────────


def load_model() -> bool:
    """Load the trained loan eligibility model and scaler."""
    global _model, _scaler, _metadata, _model_loaded

    if _model_loaded:
        return True

    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        logger.warning("Loan eligibility model not found at %s — ML scoring disabled", MODEL_PATH)
        _model_loaded = False
        return False

    try:
        _model = joblib.load(MODEL_PATH)
        _scaler = joblib.load(SCALER_PATH)

        if os.path.exists(METADATA_PATH):
            with open(METADATA_PATH, "r") as f:
                _metadata = json.load(f)

        _model_loaded = True
        logger.info("✅ Loan eligibility ML model loaded (v%s)", _metadata.get("version", "?") if _metadata else "?")
        return True

    except Exception as exc:
        logger.error("Failed to load loan eligibility model: %s", exc)
        _model_loaded = False
        return False


def is_model_loaded() -> bool:
    return _model_loaded


# ─────────────────────── Credit Score Computation ───────────────────────


def compute_credit_score(
    repayment_history_score: float,
    num_defaults: int,
    account_age_months: int,
    debt_to_income: float,
    employment_years: float,
    foir: float,
    avg_monthly_balance: float,
    monthly_income: float,
) -> int:
    """Compute a CIBIL-like credit score (300–900).

    Factors and their weights (inspired by TransUnion CIBIL):
      - Repayment history:   35%  →  0–210 points
      - Credit utilization:  25%  →  0–150 points (inverse of FOIR)
      - Credit age:          15%  →  0–90 points
      - Employment stability:15%  →  0–90 points
      - Defaults penalty:    N/A  →  up to -150 points
      - Balance health:      10%  →  0–60 points
    """
    base = 300.0

    # Repayment history (35% of 600 range = 210 max)
    base += repayment_history_score * 210

    # Defaults penalty (severe)
    base -= min(num_defaults * 75, 150)

    # Credit age (15% = 90 max)
    age_factor = min(account_age_months / 120, 1.0)
    base += age_factor * 90

    # Credit utilization / FOIR (25% = 150 max, inverse — lower FOIR = better)
    foir_factor = max(0, 1.0 - foir)
    base += foir_factor * 150

    # Employment stability (15% = 90 max)
    emp_factor = min(employment_years / 15, 1.0)
    base += emp_factor * 90

    # Balance health (10% = 60 max)
    if monthly_income > 0:
        balance_ratio = min(avg_monthly_balance / (monthly_income * 2), 1.0)
    else:
        balance_ratio = 0.0
    base += balance_ratio * 60

    # DTI penalty
    if debt_to_income > 0.5:
        base -= (debt_to_income - 0.5) * 100

    return int(max(300, min(900, round(base))))


def get_credit_rating(score: int) -> str:
    """Convert numeric score to human-readable rating."""
    if score >= 800:
        return "EXCELLENT"
    elif score >= 750:
        return "VERY_GOOD"
    elif score >= 700:
        return "GOOD"
    elif score >= 650:
        return "FAIR"
    elif score >= 550:
        return "POOR"
    else:
        return "VERY_POOR"


# ─────────────────────── Risk Assessment ───────────────────────


def _categorize_risk(eligibility_score: float) -> str:
    """Map eligibility probability to risk category."""
    if eligibility_score >= 0.80:
        return "LOW"
    elif eligibility_score >= 0.60:
        return "MEDIUM"
    elif eligibility_score >= 0.40:
        return "HIGH"
    else:
        return "VERY_HIGH"


def _compute_max_eligible_amount(
    monthly_income: float,
    existing_liabilities: float,
    credit_score: int,
    loan_duration_months: int,
) -> float:
    """Compute maximum eligible loan amount based on RBI norms.

    Uses FOIR-based capacity:
      Available EMI capacity = Income × (50% FOIR limit) - Existing EMIs
      Max Loan = Available EMI × Duration (simplified)
    """
    MAX_FOIR = 0.50  # RBI recommended cap for unsecured
    available_emi = max(0, monthly_income * MAX_FOIR - existing_liabilities)

    # Credit score multiplier
    if credit_score >= 750:
        multiplier = 1.0
    elif credit_score >= 650:
        multiplier = 0.80
    elif credit_score >= 550:
        multiplier = 0.50
    else:
        multiplier = 0.25

    max_amount = available_emi * loan_duration_months * multiplier
    # Cap at RBI unsecured limit
    return round(min(max_amount, 500000), -3)  # Round to nearest 1000


def _compute_interest_rate(credit_score: int, employment_type: str) -> float:
    """Risk-adjusted interest rate (RBI base rate + risk premium)."""
    # RBI repo rate as of 2024: ~6.5%, typical spread: 4-18%
    base_rate = 10.0

    if credit_score >= 800:
        premium = 0.0
    elif credit_score >= 750:
        premium = 1.5
    elif credit_score >= 700:
        premium = 3.0
    elif credit_score >= 650:
        premium = 5.0
    elif credit_score >= 550:
        premium = 8.0
    else:
        premium = 12.0

    # Employment risk
    emp_premium = {
        "salaried": 0.0,
        "self_employed": 1.0,
        "freelancer": 2.0,
        "unemployed": 5.0,
    }
    premium += emp_premium.get(employment_type, 2.0)

    return round(base_rate + premium, 2)


def _compute_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    """Standard EMI calculation using reducing balance method."""
    if annual_rate <= 0 or tenure_months <= 0:
        return round(principal / max(tenure_months, 1), 2)
    monthly_rate = annual_rate / 12 / 100
    emi = principal * monthly_rate * (1 + monthly_rate) ** tenure_months / \
          ((1 + monthly_rate) ** tenure_months - 1)
    return round(emi, 2)


def _generate_rbi_remarks(
    credit_score: int,
    foir: float,
    debt_to_income: float,
    num_defaults: int,
    age: int,
    employment_type: str,
    loan_amount: float,
    monthly_income: float,
) -> list[str]:
    """Generate RBI-aligned regulatory remarks."""
    remarks = []

    if credit_score < 550:
        remarks.append("CIBIL score below 550 — high credit risk per RBI Fair Practices Code.")
    elif credit_score < 650:
        remarks.append("CIBIL score in 550–650 range — moderate risk; enhanced due diligence recommended.")

    if foir > 0.50:
        remarks.append(f"FOIR at {foir*100:.0f}% exceeds RBI recommended maximum of 50% for unsecured lending.")
    elif foir > 0.40:
        remarks.append(f"FOIR at {foir*100:.0f}% — approaching RBI threshold; monitor repayment capacity.")

    if num_defaults > 0:
        remarks.append(f"{num_defaults} past default(s) flagged — NPA history impacts eligibility per RBI norms.")

    if debt_to_income > 0.50:
        remarks.append("Debt-to-income exceeds 50% — overleveraged per responsible lending guidelines.")

    if age < 21:
        remarks.append("Applicant under 21 — limited credit history; co-applicant may be required.")
    elif age > 65:
        remarks.append("Applicant over 65 — age-related risk premium applies per insurance actuary tables.")

    if employment_type == "unemployed":
        remarks.append("No active employment — income verification through alternative documents required (ITR/bank statements).")

    if loan_amount > monthly_income * 36:
        remarks.append("Loan amount exceeds 3 years of gross income — high concentration risk.")

    if not remarks:
        remarks.append("All parameters within RBI prudential lending norms. Standard processing applicable.")

    return remarks


# ─────────────────────── XAI Explanation ───────────────────────


def _generate_explanation(
    features_dict: dict,
    eligibility_score: float,
    credit_score: int,
) -> list[dict]:
    """Generate human-readable explanation of top risk/approval factors."""
    explanations = []

    # Credit Score
    rating = get_credit_rating(credit_score)
    if credit_score >= 750:
        explanations.append({
            "factor": "Strong Credit History",
            "impact": "POSITIVE",
            "detail": f"CIBIL score of {credit_score} ({rating}) indicates excellent creditworthiness.",
            "weight": 30,
        })
    elif credit_score < 550:
        explanations.append({
            "factor": "Weak Credit History",
            "impact": "NEGATIVE",
            "detail": f"CIBIL score of {credit_score} ({rating}) indicates significant credit risk.",
            "weight": 30,
        })
    else:
        explanations.append({
            "factor": "Credit History",
            "impact": "NEUTRAL",
            "detail": f"CIBIL score of {credit_score} ({rating}).",
            "weight": 20,
        })

    # FOIR
    foir = features_dict.get("foir", 0)
    if foir < 0.30:
        explanations.append({
            "factor": "Low Debt Burden",
            "impact": "POSITIVE",
            "detail": f"FOIR at {foir*100:.0f}% — well within RBI's 50% threshold. Strong repayment capacity.",
            "weight": 25,
        })
    elif foir > 0.50:
        explanations.append({
            "factor": "High Debt Burden",
            "impact": "NEGATIVE",
            "detail": f"FOIR at {foir*100:.0f}% exceeds the 50% limit. Existing obligations consume most income.",
            "weight": 25,
        })

    # Income adequacy
    income = features_dict.get("monthly_income", 0)
    loan_amt = features_dict.get("loan_amount_requested", 0)
    if income > 0:
        loan_to_annual = loan_amt / (income * 12)
        if loan_to_annual < 1.0:
            explanations.append({
                "factor": "Income Adequacy",
                "impact": "POSITIVE",
                "detail": f"Loan is {loan_to_annual*100:.0f}% of annual income — manageable obligation.",
                "weight": 15,
            })
        elif loan_to_annual > 3.0:
            explanations.append({
                "factor": "Income Strain",
                "impact": "NEGATIVE",
                "detail": f"Loan is {loan_to_annual*100:.0f}% of annual income — significant financial stretch.",
                "weight": 15,
            })

    # Defaults
    defaults = features_dict.get("num_defaults", 0)
    if defaults > 0:
        explanations.append({
            "factor": "Past Defaults",
            "impact": "NEGATIVE",
            "detail": f"{defaults} previous default(s) — indicates elevated repayment risk.",
            "weight": 20,
        })

    # Employment
    emp_type = "salaried"
    if features_dict.get("emp_self_employed"):
        emp_type = "self_employed"
    elif features_dict.get("emp_freelancer"):
        emp_type = "freelancer"
    elif features_dict.get("emp_unemployed"):
        emp_type = "unemployed"

    emp_years = features_dict.get("employment_years", 0)
    if emp_type == "salaried" and emp_years >= 3:
        explanations.append({
            "factor": "Employment Stability",
            "impact": "POSITIVE",
            "detail": f"Salaried with {emp_years:.0f} years tenure — stable income source.",
            "weight": 10,
        })
    elif emp_type == "unemployed":
        explanations.append({
            "factor": "No Employment",
            "impact": "NEGATIVE",
            "detail": "No active employment — income sustainability unclear.",
            "weight": 15,
        })

    # Repayment history
    rh = features_dict.get("repayment_history_score", 0.5)
    if rh >= 0.85:
        explanations.append({
            "factor": "Excellent Repayment Record",
            "impact": "POSITIVE",
            "detail": f"Repayment score: {rh*100:.0f}% — consistent on-time payments.",
            "weight": 15,
        })
    elif rh < 0.40:
        explanations.append({
            "factor": "Poor Repayment Record",
            "impact": "NEGATIVE",
            "detail": f"Repayment score: {rh*100:.0f}% — history of late/missed payments.",
            "weight": 15,
        })

    # Sort by weight descending
    explanations.sort(key=lambda x: x["weight"], reverse=True)
    return explanations[:6]


# ─────────────────────── Main Prediction API ───────────────────────


def predict_loan_eligibility(
    profile_data: dict,
    loan_amount: float,
    loan_duration_months: int,
) -> dict:
    """Run the full credit assessment and loan eligibility prediction.

    Args:
        profile_data: Dict of CreditProfile fields (financial indicators).
        loan_amount: Requested loan principal.
        loan_duration_months: Requested tenure.

    Returns:
        Dict with credit_score, eligibility, XAI explanation, RBI remarks, etc.
    """
    # ── Step 1: Extract / compute features ──
    monthly_income = profile_data.get("monthly_income", 0)
    existing_liabilities = profile_data.get("existing_liabilities", 0)
    total_assets = profile_data.get("total_assets", 0)
    employment_years = profile_data.get("employment_years", 0)
    age = profile_data.get("age", 25)
    dependents = profile_data.get("dependents", 0)
    repayment_history_score = profile_data.get("repayment_history_score", 0.5)
    account_age_months = profile_data.get("account_age_months", 0)
    avg_monthly_balance = profile_data.get("avg_monthly_balance", 0)
    num_previous_loans = profile_data.get("num_previous_loans", 0)
    num_defaults = profile_data.get("num_defaults", 0)
    transaction_regularity = profile_data.get("transaction_regularity", 0.5)
    employment_type = profile_data.get("employment_type", "salaried")
    residence_type = profile_data.get("residence_type", "rented")

    # FOIR
    foir = existing_liabilities / monthly_income if monthly_income > 0 else 1.0
    # DTI
    annual_income = monthly_income * 12
    debt_to_income = (existing_liabilities * 12) / annual_income if annual_income > 0 else 1.0

    # Credit score
    credit_score = compute_credit_score(
        repayment_history_score, num_defaults, account_age_months,
        debt_to_income, employment_years, foir, avg_monthly_balance, monthly_income,
    )

    # ── Step 2: Build feature vector ──
    features = {
        "age": age,
        "employment_years": employment_years,
        "monthly_income": monthly_income,
        "existing_liabilities": existing_liabilities,
        "total_assets": total_assets,
        "dependents": dependents,
        "repayment_history_score": repayment_history_score,
        "account_age_months": account_age_months,
        "avg_monthly_balance": avg_monthly_balance,
        "num_previous_loans": num_previous_loans,
        "num_defaults": num_defaults,
        "transaction_regularity": transaction_regularity,
        "credit_score": credit_score,
        "foir": round(foir, 4),
        "debt_to_income": round(debt_to_income, 4),
        "loan_amount_requested": loan_amount,
        "loan_duration_months": loan_duration_months,
        "emp_salaried": 1 if employment_type == "salaried" else 0,
        "emp_self_employed": 1 if employment_type == "self_employed" else 0,
        "emp_freelancer": 1 if employment_type == "freelancer" else 0,
        "emp_unemployed": 1 if employment_type == "unemployed" else 0,
        "res_owned": 1 if residence_type == "owned" else 0,
        "res_rented": 1 if residence_type == "rented" else 0,
        "res_parental": 1 if residence_type == "parental" else 0,
    }

    # ── Step 3: ML Inference ──
    eligibility_score = 0.5  # Default if model not loaded
    if _model_loaded and _model is not None and _scaler is not None:
        try:
            df = pd.DataFrame([features])[FEATURE_COLS]
            scaled = _scaler.transform(df)
            eligibility_score = float(_model.predict_proba(scaled)[0][1])
        except Exception as exc:
            logger.error("ML inference failed: %s — falling back to heuristic", exc)
            # Heuristic fallback
            eligibility_score = _heuristic_eligibility(credit_score, foir, num_defaults, debt_to_income)
    else:
        # Pure heuristic mode
        eligibility_score = _heuristic_eligibility(credit_score, foir, num_defaults, debt_to_income)
        logger.info("ML model not loaded — using heuristic scoring")

    # ── Step 4: Derive results ──
    eligible = eligibility_score >= 0.50
    risk_category = _categorize_risk(eligibility_score)
    credit_rating = get_credit_rating(credit_score)

    max_eligible_amount = _compute_max_eligible_amount(
        monthly_income, existing_liabilities, credit_score, loan_duration_months,
    )

    interest_rate = _compute_interest_rate(credit_score, employment_type)
    monthly_emi = _compute_emi(min(loan_amount, max_eligible_amount), interest_rate, loan_duration_months)

    explanation = _generate_explanation(features, eligibility_score, credit_score)
    rbi_remarks = _generate_rbi_remarks(
        credit_score, foir, debt_to_income, num_defaults,
        age, employment_type, loan_amount, monthly_income,
    )

    logger.info(
        "Credit assessment: user_income=%.0f score=%d eligible=%s prob=%.4f risk=%s",
        monthly_income, credit_score, eligible, eligibility_score, risk_category,
    )

    return {
        "credit_score": credit_score,
        "credit_rating": credit_rating,
        "foir": round(foir, 4),
        "debt_to_income": round(debt_to_income, 4),
        "ml_eligibility_score": round(eligibility_score, 4),
        "ml_risk_category": risk_category,
        "eligible": eligible,
        "max_eligible_amount": max_eligible_amount,
        "recommended_interest_rate": interest_rate,
        "monthly_emi": monthly_emi,
        "explanation": explanation,
        "rbi_remarks": rbi_remarks,
        "loan_amount_requested": loan_amount,
        "loan_duration_months": loan_duration_months,
    }


def _heuristic_eligibility(
    credit_score: int, foir: float, num_defaults: int, debt_to_income: float,
) -> float:
    """Fallback heuristic when ML model is unavailable."""
    score = 0.5

    # Credit score
    if credit_score >= 750:
        score += 0.25
    elif credit_score >= 650:
        score += 0.10
    elif credit_score < 550:
        score -= 0.25

    # FOIR
    if foir < 0.30:
        score += 0.15
    elif foir > 0.50:
        score -= 0.20

    # Defaults
    score -= num_defaults * 0.10

    # DTI
    if debt_to_income > 0.50:
        score -= 0.15

    return max(0.0, min(1.0, score))
