import React, { useState, useEffect } from 'react';
import apiClient from '../lib/axios';

export function CreditHub() {
  const [loans, setLoans] = useState([]);
  const [amount, setAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [selectedLoan, setSelectedLoan] = useState(null);

  const fetchLoans = async () => {
    try {
      const { data } = await apiClient.get('/loans');
      setLoans(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleApply = async () => {
    try {
      await apiClient.post('/loans/apply', { principal_amount: parseFloat(amount), duration_months: 12 });
      setAmount('');
      fetchLoans();
    } catch (error) {
       alert(error.response?.data?.detail || "Failed to apply");
    }
  };

  const handlePayEmi = async (loanId) => {
    try {
      await apiClient.post(`/loans/${loanId}/repay`, { amount: parseFloat(repayAmount) });
      setRepayAmount('');
      setSelectedLoan(null);
      fetchLoans();
    } catch (error) {
       alert(error.response?.data?.detail || "Repayment Failed");
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      <header>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
          Credit Hub
        </h1>
        <p className="text-zinc-500 mt-2 font-medium">Automated Lending Engine</p>
      </header>

      <section className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8">
        <h2 className="text-xl font-bold dark:text-white mb-6">Apply for Capital</h2>
        <div className="flex gap-4 items-center">
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter Principal Amount (Ex: 50000)"
              className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-xl focus:border-indigo-500 outline-none transition-colors dark:text-white font-mono text-sm"
            />
            <button
               onClick={handleApply}
               disabled={!amount}
               className="px-8 py-3 bg-indigo-600 dark:bg-white text-white dark:text-black font-black uppercase text-sm tracking-widest rounded-xl hover:scale-105 transition-transform"
            >
               Request Loan
            </button>
        </div>
      </section>

      <section className="space-y-6">
         <h2 className="text-xl font-bold dark:text-white">Active & Past Loans</h2>
         {loans.length === 0 ? (
            <p className="text-zinc-500">No loan history found.</p>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {loans.map(loan => (
                  <div key={loan.id} className="bg-white dark:bg-[#0c0c0d] border border-zinc-200 dark:border-white/5 rounded-[30px] p-8 flex flex-col justify-between">
                     <div className="flex justify-between items-start mb-6">
                        <div>
                           <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Loan ID: {loan.id.split('-')[0]}</span>
                           <h3 className="text-2xl font-black dark:text-white mt-2">₹{loan.principal_amount.toLocaleString()}</h3>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                           loan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                           loan.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                           'bg-zinc-100 text-zinc-700 dark:bg-white/5 dark:text-zinc-400'
                        }`}>
                           {loan.status}
                        </span>
                     </div>
                     <div className="space-y-2 mb-8">
                        <div className="flex justify-between text-sm">
                           <span className="text-zinc-500">Interest</span>
                           <span className="font-mono dark:text-white">{loan.interest_rate}% Fixed</span>
                        </div>
                        <div className="flex justify-between text-sm">
                           <span className="text-zinc-500">Outstanding Balance</span>
                           <span className="font-mono dark:text-white">₹{loan.outstanding_balance.toLocaleString()}</span>
                        </div>
                     </div>
                     
                     {loan.status === 'ACTIVE' && (
                        <div>
                           {selectedLoan === loan.id ? (
                              <div className="flex gap-2">
                                 <input 
                                    type="number"
                                    value={repayAmount}
                                    onChange={(e) => setRepayAmount(e.target.value)}
                                    placeholder="Amount"
                                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-lg outline-none font-mono text-sm dark:text-white"
                                 />
                                 <button onClick={() => handlePayEmi(loan.id)} className="px-4 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-emerald-500">Pay</button>
                                 <button onClick={() => setSelectedLoan(null)} className="px-3 bg-zinc-200 dark:bg-white/10 dark:text-white rounded-lg text-xs font-bold uppercase hover:opacity-80">Cancel</button>
                              </div>
                           ) : (
                              <button onClick={() => setSelectedLoan(loan.id)} className="w-full py-3 bg-zinc-100 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors">
                                 Pay EMI
                              </button>
                           )}
                        </div>
                     )}
                  </div>
               ))}
            </div>
         )}
      </section>
    </div>
  );
}
