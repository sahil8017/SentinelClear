import React from 'react';

export default function ApiReference() {
  return (
    <>
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-blue-600 dark:text-indigo-400 uppercase">
        Resources
      </div>
      <h1 className="leading-tight">API Reference</h1>
      
      <p>
        The SentinelClear API is organized around REST. All endpoints are prefixed with <code>/api</code> and return JSON-encoded responses. Interactive documentation is available at <code>http://localhost:8000/docs</code> (Swagger UI).
      </p>

      <h2>Base URL</h2>
      <pre><code>{`http://localhost:8000/api`}</code></pre>

      <h2>Authentication</h2>
      <p>
        Most endpoints require a valid JWT token obtained from <code>POST /api/auth/login</code>. Admin endpoints require <code>role: ADMIN</code>. API key authentication is also supported via the <code>X-API-Key</code> header for BaaS integrations.
      </p>
      
      <pre><code>{`Authorization: Bearer eyJhbGciOiJIUzI1NiIsIn...`}</code></pre>

      <hr className="my-10 border-zinc-200 dark:border-white/10" />

      {/* POST /api/transfers */}
      <div>
        <h3 className="flex items-center gap-3">
          <span className="px-2 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[10px] font-bold rounded uppercase">POST</span>
          <span>/api/transfers</span>
        </h3>
        <p className="!mt-2 !mb-4">Execute an atomic transfer between two accounts. Requires idempotency headers to prevent replay attacks. The transfer is evaluated against the rule-based fraud engine before execution.</p>

        <h4 className="text-sm font-semibold mb-2">Request Headers</h4>
        <ul className="!mt-0 !mb-4 !text-sm">
          <li><code>Authorization</code>: Bearer token of the sender.</li>
          <li><code>Idempotency-Key</code>: Client-generated UUIDv4. Cached for 24h in Redis to prevent duplicate charges.</li>
        </ul>

        <h4 className="text-sm font-semibold mb-2">Request Body (JSON)</h4>
        <pre><code>{`{
  "receiver_account_id": "string (UUID)",
  "amount": 1000.50,
  "currency": "INR",
  "reference": "Invoice #2026-0042",   // Optional memo/note
  "route": "IMPS",                      // IMPS, NEFT, or RTGS
  "ip_override": "Mumbai"               // Optional: geo-origin for testing
}`}</code></pre>

        <h4 className="text-sm font-semibold mb-2 mt-6">Successful Response (201 Created)</h4>
        <pre><code>{`{
  "id": "f7e8d9c0-a1b2-4c3d-8e5f-6a7b8c9d0e1f",
  "sender_account_id": "acc_sender_uuid",
  "receiver_account_id": "acc_receiver_uuid",
  "amount": 1000.50,
  "status": "COMPLETED",
  "risk_score": 0.12,
  "reference": "Invoice #2026-0042",
  "fraud_rules_triggered": null,
  "source_city": "Mumbai",
  "created_at": "2026-04-14T14:30:00Z"
}`}</code></pre>

        <h4 className="text-sm font-semibold mb-2 mt-6">Blocked Response (403 Forbidden)</h4>
        <p className="!text-sm !mb-3">Both Layer 1 (regulatory) and Layer 2 (heuristic) blocks return a structured JSON body with the triggered rules and risk score:</p>
        <pre><code>{`{
  "detail": "Transfers to new beneficiaries are capped at ₹50,000 during the first 24 hours.",
  "risk_score": 1.0,
  "transfer_id": "f7e8d9c0-a1b2-4c3d-8e5f-6a7b8c9d0e1f",
  "rules_triggered": ["NEW_BENEFICIARY_COOLING_OFF"],
  "decision": "BLOCK"
}`}</code></pre>

        <h4 className="text-sm font-semibold mb-2 mt-6">Possible Blocking Rules</h4>
        <table>
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>RTGS_MINIMUM_FLOOR</code></td><td>RTGS transfers require minimum ₹2,00,000</td></tr>
            <tr><td><code>DAILY_VELOCITY_NPCI</code></td><td>Exceeded 20 outbound transfers in 24 hours</td></tr>
            <tr><td><code>NEW_BENEFICIARY_COOLING_OFF</code></td><td>New/recent beneficiaries capped at ₹50,000 for first 24 hours</td></tr>
            <tr><td><code>burst_velocity</code></td><td>3+ transfers within 60 seconds</td></tr>
            <tr><td><code>amount_anomaly</code></td><td>Transfer amount exceeds 5× the user's average</td></tr>
            <tr><td><code>geo_velocity</code></td><td>Impossible physical location change between recent transfers</td></tr>
            <tr><td><code>account_age</code></td><td>Account is less than 48 hours old for high-value transactions</td></tr>
            <tr><td><code>time_of_day</code></td><td>High-value transfer during midnight–5AM</td></tr>
            <tr><td><code>SMURFING_SPLIT_STRUCTURING</code></td><td>3+ rapid transfers of ₹19,000+ to the same recipient</td></tr>
            <tr><td><code>ACCOUNT_DRAIN_PREDICTION</code></td><td>Transfer would drain 95%+ of balance to a new beneficiary</td></tr>
          </tbody>
        </table>
      </div>

      <hr className="my-10 border-zinc-200 dark:border-white/10" />

      <h2>Complete Endpoint Reference</h2>

      <h3>Authentication & Profile</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>POST</code></td><td><code>/api/auth/register</code></td><td>Register a new user (creates account automatically)</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/auth/login</code></td><td>Authenticate and receive JWT token</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/auth/profile</code></td><td>Get authenticated user's full profile</td></tr>
          <tr><td><code>PUT</code></td><td><code>/api/auth/profile</code></td><td>Complete profile setup (onboarding)</td></tr>
          <tr><td><code>PATCH</code></td><td><code>/api/auth/profile</code></td><td>Partial profile update (name, occupation, DOB)</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/auth/transaction-pin</code></td><td>Set or verify transaction PIN</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/auth/api-keys</code></td><td>Generate a new API key for BaaS access</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/auth/webhooks</code></td><td>Register a webhook URL</td></tr>
        </tbody>
      </table>

      <h3>Accounts</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/accounts/me</code></td><td>Get current user's account (balance, ID, type)</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/accounts/me/deposit</code></td><td>Deposit funds into account</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/accounts/kill-switch/activate</code></td><td>Activate emergency kill switch</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/accounts/kill-switch/deactivate</code></td><td>Deactivate kill switch (requires PIN)</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/accounts/kill-switch/status</code></td><td>Check kill switch state</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/accounts/annual-limit/status</code></td><td>Check annual receiving limit</td></tr>
        </tbody>
      </table>

      <h3>Transfers</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>POST</code></td><td><code>/api/transfers</code></td><td>Create a new transfer</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/transfers/history/all</code></td><td>Get all transfers (sent and received)</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/transfers/:id</code></td><td>Get a specific transfer by ID</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/transfers/:id/verify-auth</code></td><td>Step-up auth PIN verification</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/transfers/:id/confirm-pause</code></td><td>Confirm a paused transfer</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/transfers/:id/cancel-pause</code></td><td>Cancel a paused transfer</td></tr>
        </tbody>
      </table>

      <h3>Notifications</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/notifications</code></td><td>List user notifications (newest first)</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/notifications/count</code></td><td>Get unread notification count</td></tr>
          <tr><td><code>PATCH</code></td><td><code>/api/notifications/read</code></td><td>Mark specific notifications as read</td></tr>
          <tr><td><code>PATCH</code></td><td><code>/api/notifications/read-all</code></td><td>Mark all notifications as read</td></tr>
          <tr><td><code>DELETE</code></td><td><code>/api/notifications</code></td><td>Clear all notifications permanently</td></tr>
        </tbody>
      </table>

      <h3>Loans</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>POST</code></td><td><code>/api/loans/apply</code></td><td>Apply for a loan</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/loans</code></td><td>List your loans</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/loans/:id/repay</code></td><td>Make a loan repayment</td></tr>
        </tbody>
      </table>

      <h3>Whitelisted Contacts</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/whitelist</code></td><td>List whitelisted contacts</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/whitelist</code></td><td>Add a whitelisted contact</td></tr>
          <tr><td><code>DELETE</code></td><td><code>/api/whitelist/:id</code></td><td>Remove a whitelisted contact</td></tr>
        </tbody>
      </table>

      <h3>Fraud & Analytics (Admin)</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/fraud/dashboard</code></td><td>Fraud analytics dashboard data</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/fraud/metrics</code></td><td>Fraud KPI metrics</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/fraud/metrics/timeline</code></td><td>Fraud timeline data</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/fraud/rules</code></td><td>List all heuristic rule configurations</td></tr>
          <tr><td><code>PUT</code></td><td><code>/api/fraud/rules/:name</code></td><td>Update a rule's weight/threshold</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/fraud/str/:transfer_id</code></td><td>Generate Suspicious Transaction Report</td></tr>
        </tbody>
      </table>

      <h3>Ledger & Audit</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/ledger/:account_id</code></td><td>Get ledger entries for an account</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/ledger/verify/integrity</code></td><td>Verify ledger hash chain integrity</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/statement/:account_id/statement</code></td><td>Generate PDF account statement</td></tr>
        </tbody>
      </table>

      <h3>Admin Operations</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>GET</code></td><td><code>/api/admin/settings</code></td><td>List system configuration</td></tr>
          <tr><td><code>PUT</code></td><td><code>/api/admin/settings</code></td><td>Update a system setting</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/loans/admin/all</code></td><td>List all loans in system</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/loans/admin/:id/approve</code></td><td>Approve a pending loan</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/loans/admin/:id/reject</code></td><td>Reject a pending loan</td></tr>
          <tr><td><code>GET</code></td><td><code>/api/transfers/admin/pending</code></td><td>List all pending transfers (Maker-Checker)</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/transfers/:id/approve</code></td><td>Approve a pending transfer</td></tr>
          <tr><td><code>POST</code></td><td><code>/api/transfers/:id/reject</code></td><td>Reject a pending transfer</td></tr>
        </tbody>
      </table>
    </>
  );
}
