import React, { useEffect, useState, createContext } from 'react';
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

// Master Documentation Imports (Restructured Plaid-Style)
import { DocsLayout } from './pages/docs/DocsLayout';
import Introduction from './pages/docs/Introduction';
import Quickstart from './pages/docs/Quickstart';
import LedgerArchitecture from './pages/docs/LedgerArchitecture';
import RiskEngine from './pages/docs/RiskEngine';
import UPISafetyDocs from './pages/docs/UPISafety';
import CreditHubDocs from './pages/docs/CreditHub'; // aliased to avoid collision with main CreditHub
import ApiReference from './pages/docs/ApiReference';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

import { getRoleFromToken, isAuthenticated } from './lib/auth';

function RoleBasedRedirect({ toUser, toAdmin }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const role = getRoleFromToken();
  return <Navigate to={role === 'ADMIN' ? toAdmin : toUser} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<Home />} />
        
        {/* Documentation Restructured Routes */}
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<Navigate to="introduction" replace />} />
          <Route path="introduction" element={<Introduction />} />
          <Route path="quickstart" element={<Quickstart />} />
          <Route path="ledger-architecture" element={<LedgerArchitecture />} />
          <Route path="risk-engine" element={<RiskEngine />} />
          <Route path="upi-safety" element={<UPISafetyDocs />} />
          <Route path="credit-hub" element={<CreditHubDocs />} />
          <Route path="api-reference" element={<ApiReference />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* CONSUMER TIER: Protected Routes */}
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

        {/* ADMINISTRATIVE TIER: Protected Routes */}
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

        {/* Catch-all role-aware redirects */}
        <Route path="/dashboard" element={<RoleBasedRedirect toUser="/app/dashboard" toAdmin="/admin/ops" />} />
        <Route path="/transfer" element={<Navigate to="/app/transfer" replace />} />
        <Route path="/ledger" element={<Navigate to="/app/ledger" replace />} />
        <Route path="/ops" element={<RoleBasedRedirect toUser="/app/dashboard" toAdmin="/admin/ops" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
