import React from 'react';

export default function CreditHub() {
  return (
    <>
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-blue-600 dark:text-indigo-400 uppercase">
        Core Platform
      </div>
      <h1 className="leading-tight">Credit & Loan Hub</h1>
      
      <p>
        SentinelClear includes an integrated lending engine that allows users to request loans, which are then reviewed and approved by administrators. Disbursements and repayments follow the same double-entry accounting principles as regular transfers.
      </p>

      <h2>Loan Lifecycle</h2>
      <p>
        Loans follow a strict state machine:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-6">
        <div className="p-4 border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 rounded-xl text-center">
          <span className="text-2xl">📋</span>
          <h4 className="!mt-2 !mb-1 !text-sm font-bold text-amber-700 dark:text-amber-400">PENDING</h4>
          <p className="!text-[10px] !my-0 text-amber-600 dark:text-amber-300">User submits application</p>
        </div>
        <div className="p-4 border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 rounded-xl text-center">
          <span className="text-2xl">✅</span>
          <h4 className="!mt-2 !mb-1 !text-sm font-bold text-blue-700 dark:text-blue-400">APPROVED</h4>
          <p className="!text-[10px] !my-0 text-blue-600 dark:text-blue-300">Admin approves & funds disburse</p>
        </div>
        <div className="p-4 border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 rounded-xl text-center">
          <span className="text-2xl">💳</span>
          <h4 className="!mt-2 !mb-1 !text-sm font-bold text-emerald-700 dark:text-emerald-400">ACTIVE</h4>
          <p className="!text-[10px] !my-0 text-emerald-600 dark:text-emerald-300">User makes repayments</p>
        </div>
        <div className="p-4 border border-zinc-200 dark:border-zinc-500/20 bg-zinc-50 dark:bg-zinc-500/5 rounded-xl text-center">
          <span className="text-2xl">🏁</span>
          <h4 className="!mt-2 !mb-1 !text-sm font-bold text-zinc-700 dark:text-zinc-400">CLOSED</h4>
          <p className="!text-[10px] !my-0 text-zinc-600 dark:text-zinc-300">Fully repaid</p>
        </div>
      </div>

      <h2>How Loans Work</h2>

      <h3>1. Application</h3>
      <p>
        Users apply via <code>POST /api/loans/apply</code> with a <code>principal_amount</code> and <code>duration_months</code>. The system calculates the interest rate based on the requested principal and creates a loan record in <code>PENDING</code> status.
      </p>
      <pre><code>{`POST /api/loans/apply
{
  "principal_amount": 50000,
  "duration_months": 12
}`}</code></pre>

      <h3>2. Admin Approval & Disbursement</h3>
      <p>
        An administrator reviews the loan from the Operations Dashboard and approves it via <code>POST /api/admin/loans/:id/approve</code>. Upon approval:
      </p>
      <ul>
        <li>The loan status transitions to <code>ACTIVE</code></li>
        <li>The principal amount is atomically transferred from the <strong>system treasury account</strong> to the user's account</li>
        <li>A double-entry ledger pair is created (DEBIT treasury → CREDIT user)</li>
        <li>The <code>outstanding_balance</code> is set to <code>principal + interest</code></li>
      </ul>

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl my-6">
        <strong className="text-blue-800 dark:text-blue-300">Key:</strong> The treasury must have sufficient balance to fund the loan. If it doesn't, the approval fails with a <code>400</code> error. Loans are funded with real balance, not printed money.
      </div>

      <h3>3. Repayment</h3>
      <p>
        Users repay via <code>POST /api/loans/:id/repay</code> with an <code>amount</code>. The system:
      </p>
      <ol>
        <li>Verifies the user has sufficient account balance</li>
        <li>Debits the user's account and credits the treasury</li>
        <li>Reduces the loan's <code>outstanding_balance</code></li>
        <li>If <code>outstanding_balance</code> reaches zero, the loan status changes to <code>CLOSED</code></li>
      </ol>

      <h3>4. Interest Calculation</h3>
      <p>
        Interest rates are determined at loan creation based on the principal amount tier:
      </p>
      <table>
        <thead>
          <tr>
            <th>Principal Range</th>
            <th>Annual Interest Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Up to ₹25,000</td>
            <td>12%</td>
          </tr>
          <tr>
            <td>₹25,001 – ₹1,00,000</td>
            <td>10%</td>
          </tr>
          <tr>
            <td>Above ₹1,00,000</td>
            <td>8.5%</td>
          </tr>
        </tbody>
      </table>

      <h2>Admin Operations</h2>
      <p>
        Administrators can manage all loans from the Operations Dashboard:
      </p>
      <ul>
        <li><strong>View pending loans</strong> — <code>GET /api/admin/loans/pending</code></li>
        <li><strong>Approve a loan</strong> — <code>POST /api/admin/loans/:id/approve</code></li>
        <li><strong>Reject a loan</strong> — <code>POST /api/admin/loans/:id/reject</code></li>
        <li><strong>View all loans</strong> — <code>GET /api/admin/loans</code></li>
      </ul>
    </>
  );
}
