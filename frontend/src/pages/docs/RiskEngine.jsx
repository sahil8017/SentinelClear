import React from 'react';

export default function RiskEngine() {
  return (
    <>
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-blue-600 dark:text-indigo-400 uppercase">
        Core Platform
      </div>
      <h1 className="leading-tight">Rule-Based Risk Engine</h1>
      
      <p>
        SentinelClear evaluates every transfer using a deterministic, rule-based heuristic engine. Each transaction is scored against a policy matrix in sub-50ms before any balance mutations occur.
      </p>

      <h2>The Heuristic Pipeline</h2>
      <p>
        When a transfer payload arrives, it passes through multiple evaluation layers before it is cleared to persist into the PostgreSQL ledger:
      </p>

      <ol>
        <li>
          <strong>UPI Safety Checks:</strong> The system first evaluates kill-switch status, annual receiving limits, and transaction-pause rules. Any violation immediately halts the transfer.
        </li>
        <li>
          <strong>Heuristic Rule Evaluation:</strong> The transaction telemetry is tested against configurable rules — burst velocity (3+ transfers in 60 seconds), amount threshold (single transactions exceeding a configurable limit), new-account restrictions, geo-velocity anomalies, and time-of-day patterns.
        </li>
        <li>
          <strong>Composite Risk Scoring:</strong> Each triggered rule contributes a weighted score. The weights are dynamically adjustable from the Operations Dashboard by system administrators.
        </li>
      </ol>

      <h2>The Admin Dashboard Controls</h2>
      <p>
        The Operations Dashboard is not just for monitoring. The "Weight" sliders actively manipulate the risk calculation algorithm:
      </p>

      <pre><code>{`// Core Engine Scoring Logic
for each rule in active_rules:
    if rule.evaluate(transaction):
        risk_score += rule.weight * rule.base_contribution
        triggered_rules.append(rule.name)

final_risk_score = clamp(risk_score, 0.0, 1.0)`}</code></pre>

      <p>
        If an admin suspects an attack is ongoing and raises all heuristic weights to <code>3.0x</code>, it amplifies the sensitivity. A transfer that previously scored as moderate risk (0.30) will be amplified into a high-risk score, potentially crossing the <strong>BLOCK threshold</strong>.
      </p>

      <h2>Risk Tiers & Outcomes</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        <div className="p-4 border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 rounded-xl">
          <h4 className="!mt-0 !mb-1 !text-sm text-emerald-700 dark:text-emerald-400">CLEARED</h4>
          <p className="!text-xs !my-0">Risk score below <code>0.40</code> — transfer completes normally with status <code>COMPLETED</code>.</p>
        </div>
        <div className="p-4 border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 rounded-xl">
          <h4 className="!mt-0 !mb-1 !text-sm text-amber-700 dark:text-amber-400">FLAGGED FOR REVIEW</h4>
          <p className="!text-xs !my-0">Risk score between <code>0.40 – 0.69</code> — transfer completes but is queued for admin review alerts.</p>
        </div>
        <div className="p-4 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 rounded-xl">
          <h4 className="!mt-0 !mb-1 !text-sm text-red-700 dark:text-red-400">BLOCKED</h4>
          <p className="!text-xs !my-0">Risk score above <code>0.70</code> — transfer is hard-blocked and rolled back gracefully. No balance mutations occur.</p>
        </div>
      </div>

      <h2>Available Rule Types</h2>

      <h3>Layer 1 — Regulatory Hard Blocks</h3>
      <p>These rules cause an immediate <code>403</code> rejection. No balance mutations or transfer records are created.</p>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Description</th>
            <th>Threshold</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>RTGS_MINIMUM_FLOOR</code></td>
            <td>RTGS route requires a minimum transfer amount</td>
            <td>₹2,00,000</td>
          </tr>
          <tr>
            <td><code>DAILY_VELOCITY_NPCI</code></td>
            <td>Maximum outbound transfers in 24 hours</td>
            <td>20 transfers</td>
          </tr>
          <tr>
            <td><code>NEW_BENEFICIARY_COOLING_OFF</code></td>
            <td>Cap on transfers to new/recent beneficiaries (added within 24h)</td>
            <td>₹50,000</td>
          </tr>
        </tbody>
      </table>

      <h3>Layer 2 — Heuristic Scoring Rules</h3>
      <p>These rules contribute weighted scores to the composite risk assessment. Weights are adjustable from the Operations Dashboard via <code>PUT /api/fraud/rules/:name</code>.</p>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Description</th>
            <th>Default Weight</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>burst_velocity</code></td>
            <td>3+ transfers within 60 seconds from same account</td>
            <td>2.0</td>
          </tr>
          <tr>
            <td><code>amount_anomaly</code></td>
            <td>Transfer amount &gt; 5× user's historical average</td>
            <td>1.5</td>
          </tr>
          <tr>
            <td><code>account_age</code></td>
            <td>Account is less than 48 hours old for high-value transactions</td>
            <td>1.5</td>
          </tr>
          <tr>
            <td><code>geo_velocity</code></td>
            <td>Physically impossible location change detected via IP geolocation</td>
            <td>2.0</td>
          </tr>
          <tr>
            <td><code>time_of_day</code></td>
            <td>High-value transfers during midnight–5AM IST window</td>
            <td>1.0</td>
          </tr>
        </tbody>
      </table>

      <h3>Layer 3 — Domain-Specific Anomalies</h3>
      <p>These are additional post-scoring rules that can elevate the risk score based on pattern analysis:</p>
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Description</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>SMURFING_SPLIT_STRUCTURING</code></td>
            <td>3+ rapid transfers of ₹19,000+ to the same recipient within 10 minutes</td>
            <td>+0.5 risk score added</td>
          </tr>
          <tr>
            <td><code>ACCOUNT_DRAIN_PREDICTION</code></td>
            <td>Transfer would drain &gt;95% of account balance to a new beneficiary</td>
            <td>Risk score set to 1.0</td>
          </tr>
        </tbody>
      </table>

      <h2>Whitelisted Contacts Override</h2>
      <p>
        If a recipient is in the sender's whitelist, the predictive risk score is overridden to <code>0.1</code> regardless of heuristic triggers. This allows trusted contacts to transact without friction. Layer 1 regulatory blocks cannot be overridden by whitelisting.
      </p>

      <h2>Suspicious Transaction Reports (STR)</h2>
      <p>
        For any flagged or blocked transfer, administrators can generate a PDF Suspicious Transaction Report from the Operations Dashboard via <code>GET /api/fraud/str/:transfer_id</code>. These reports include full transaction metadata, triggered rules, risk score breakdown, and geolocation data — formatted for regulatory submission.
      </p>
    </>
  );
}
