import React from 'react';

export default function UPISafetyDocs() {
  return (
    <>
      <div className="mb-2 text-[11px] font-semibold tracking-wider text-blue-600 dark:text-indigo-400 uppercase">
        Core Platform
      </div>
      <h1 className="leading-tight">UPI Safety Framework</h1>
      
      <p>
        SentinelClear implements a comprehensive UPI Safety Framework inspired by Indian digital payment safety guidelines. These protections operate independently of the risk engine and provide immediate, user-facing safeguards against unauthorized or suspicious transactions.
      </p>

      <h2>Emergency Kill Switch</h2>
      <p>
        Users can instantly freeze all outgoing transactions from the UPI Safety panel. When activated, every transfer attempt is immediately rejected until the switch is manually deactivated. This provides a panic-button response to compromised credentials or suspected fraud.
      </p>

      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl my-6">
        <strong className="text-red-800 dark:text-red-300">Critical:</strong> The kill switch is stored in Redis for instant enforcement. There is zero delay between activation and protection. All outgoing UPI flows are halted immediately.
      </div>

      <h2>Annual Receiving Limit</h2>
      <p>
        Each account has a configurable annual receiving limit (default: ₹25,00,000). Once an account's total incoming volume for the year exceeds this threshold, further incoming transfers are blocked. This protects against money-mule scenarios and limits exposure.
      </p>

      <h2>Transaction Pause</h2>
      <p>
        Transfers exceeding a configurable amount threshold (default: ₹10,000) trigger a mandatory cooling-off period. The transfer enters a <code>PAUSED</code> state for 15 minutes, during which the user can confirm or cancel the operation. This prevents impulsive or coerced large transfers.
      </p>

      <h2>Whitelisted Contacts</h2>
      <p>
        Users can maintain a list of trusted beneficiary account IDs. Transfers to whitelisted contacts bypass certain friction points like the transaction pause, providing a smoother experience for regular payees while maintaining security for unknown recipients.
      </p>

      <h2>Admin-Configurable Thresholds</h2>
      <p>
        All UPI Safety thresholds are runtime-configurable by system administrators through the <strong>System Settings</strong> panel in the Operations Dashboard:
      </p>
      <ul>
        <li><code>UPI_PAUSE_THRESHOLD</code> — Amount (INR) that triggers the cooling-off pause</li>
        <li><code>UPI_ANNUAL_RECEIVING_LIMIT</code> — Maximum annual incoming volume per account</li>
        <li><code>VULNERABLE_AGE_THRESHOLD</code> — Age threshold for vulnerable group protections</li>
        <li><code>NEW_BENEFICIARY_CAP_24H</code> — Transfer cap to new beneficiaries in first 24 hours</li>
      </ul>
    </>
  );
}
