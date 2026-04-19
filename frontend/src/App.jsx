import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Transfer } from './pages/Transfer';
import { Ledger } from './pages/Ledger';
import { FraudAnalytics } from './pages/FraudAnalytics';
import { OpsDashboard } from './pages/OpsDashboard';
import { ChaosPanel } from './pages/ChaosPanel';
import { DevTools } from './pages/DevTools';
import { AMLGraph } from './pages/AMLGraph';
import { MakerChecker } from './pages/MakerChecker';
import { AuditLedger } from './pages/AuditLedger';

import { CreditHub } from './pages/CreditHub';
import { UPISafety } from './pages/UPISafety';
import { ProfileSetup } from './pages/ProfileSetup';
import { AccountProfile } from './pages/AccountProfile';
import { CommandPalette } from './components/CommandPalette';


import { getRoleFromToken, isAuthenticated } from './lib/auth';

function RoleBasedRedirect({ toUser, toAdmin }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const role = getRoleFromToken();
  return <Navigate to={role === 'ADMIN' ? toAdmin : toUser} replace />;
}

export default function App() {
  return (
    <>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<Home />} />
        

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/app" element={<ProtectedRoute />}>
          <Route path="profile-setup" element={<ProfileSetup />} />
          <Route element={<Layout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="transfer" element={<Transfer />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="credit" element={<CreditHub />} />
            <Route path="upi-safety" element={<UPISafety />} />
            <Route path="account" element={<AccountProfile />} />
          </Route>
        </Route>

        <Route path="/admin" element={<AdminProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="ops" replace />} />
            <Route path="analytics" element={<FraudAnalytics />} />
            <Route path="ops" element={<OpsDashboard />} />
            <Route path="chaos" element={<ChaosPanel />} />
            <Route path="tools" element={<DevTools />} />
            <Route path="maker-checker" element={<MakerChecker />} />
            <Route path="aml-graph" element={<AMLGraph />} />
            <Route path="audit" element={<AuditLedger />} />
          </Route>
        </Route>

        <Route path="/dashboard" element={<RoleBasedRedirect toUser="/app/dashboard" toAdmin="/admin/ops" />} />
        <Route path="/transfer" element={<Navigate to="/app/transfer" replace />} />
        <Route path="/ledger" element={<Navigate to="/app/ledger" replace />} />
        <Route path="/ops" element={<RoleBasedRedirect toUser="/app/dashboard" toAdmin="/admin/ops" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
