"""Drift detection for ML fraud scoring model."""

import logging
import math
from typing import Optional

logger = logging.getLogger("sentinelclear.ml.drift")


class DriftDetector:
    """Detects feature drift and score distribution shift.

    Constructor takes baseline_stats: dict mapping feature name to {mean, std}.
    """

    Z_SCORE_THRESHOLD = 3.0

    def __init__(self, baseline_stats: dict, score_distribution: Optional[list] = None):
        self.baseline_stats = baseline_stats
        self.score_distribution = score_distribution or []
        self.recent_scores: list[float] = []
        self.max_recent = 10000

    def check_drift(self, features: dict) -> dict:
        """Compute z-score for each feature against the baseline.

        Returns:
            {"drifted": bool, "alerts": list[dict]}
        """
        alerts = []
        for feature_name, value in features.items():
            baseline = self.baseline_stats.get(feature_name)
            if baseline is None:
                continue
            mean = baseline["mean"]
            std = baseline["std"]
            if std == 0:
                continue
            z_score = abs(value - mean) / std
            if z_score > self.Z_SCORE_THRESHOLD:
                alerts.append({
                    "feature": feature_name,
                    "value": value,
                    "baseline_mean": mean,
                    "z_score": round(z_score, 4),
                })
        drifted = len(alerts) > 0
        return {"drifted": drifted, "alerts": alerts}

    def record_score(self, score: float):
        """Record a risk score for PSI computation."""
        self.recent_scores.append(score)
        if len(self.recent_scores) > self.max_recent:
            self.recent_scores = self.recent_scores[-self.max_recent:]

    def get_psi(self, n_bins: int = 10) -> float:
        """Compute Population Stability Index between recent scores and baseline distribution.

        Uses last 10000 scores vs baseline_score_distribution.
        """
        if not self.score_distribution or not self.recent_scores:
            return 0.0

        def _histogram(values, n_bins):
            bins = [0] * n_bins
            for v in values:
                idx = min(int(v * n_bins), n_bins - 1)
                bins[idx] += 1
            total = len(values)
            return [(b / total) if total > 0 else (1 / n_bins) for b in bins]

        expected = _histogram(self.score_distribution, n_bins)
        actual = _histogram(self.recent_scores, n_bins)

        psi = 0.0
        eps = 1e-6
        for e, a in zip(expected, actual):
            e = max(e, eps)
            a = max(a, eps)
            psi += (a - e) * math.log(a / e)

        return round(psi, 6)


# Global instance with baseline stats for SentinelClear fraud features
BASELINE_STATS = {
    "txn_count_30d": {"mean": 15.0, "std": 10.0},
    "volume_30d": {"mean": 50000.0, "std": 30000.0},
    "avg_txn_amount_30d": {"mean": 3500.0, "std": 2000.0},
    "max_txn_amount_30d": {"mean": 15000.0, "std": 10000.0},
    "unique_recipients_30d": {"mean": 5.0, "std": 3.0},
    "flagged_ratio_90d": {"mean": 0.02, "std": 0.05},
    "velocity_per_day": {"mean": 0.5, "std": 0.4},
}

BASELINE_SCORE_DISTRIBUTION = [0.1] * 100  # uniform low-risk baseline

drift_detector = DriftDetector(BASELINE_STATS, BASELINE_SCORE_DISTRIBUTION)
