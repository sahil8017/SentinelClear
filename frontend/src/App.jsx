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
import { DeveloperTools } from './pages/DeveloperTools';
import { CreditHub } from './pages/CreditHub';
import { CommandPalette } from './components/CommandPalette';

// Master Documentation Imports (Exhaustive Suite)
import { DocsLayout } from './pages/docs/DocsLayout';
import Introduction from './pages/docs/Introduction';
import SdkSetup from './pages/docs/SdkSetup';
import ApiReference from './pages/docs/ApiReference';
import Idempotency from './pages/docs/Idempotency';
import LedgerPrimitives from './pages/docs/LedgerPrimitives';
import SettlementLogic from './pages/docs/SettlementLogic';
import FraudHeuristics from './pages/docs/FraudHeuristics';
import AuditChain from './pages/docs/AuditChain';
import Observability from './pages/docs/Observability';
import Deployment from './pages/docs/Deployment';

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
        
        {/* Exhaustive Documentation Nested Routes */}
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<Navigate to="introduction" replace />} />
          <Route path="introduction" element={<Introduction />} />
          <Route path="sdk-setup" element={<SdkSetup />} />
          <Route path="api-reference" element={<ApiReference />} />
          <Route path="idempotency" element={<Idempotency />} />
          <Route path="ledger-primitives" element={<LedgerPrimitives />} />
          <Route path="settlement-logic" element={<SettlementLogic />} />
          <Route path="fraud-heuristics" element={<FraudHeuristics />} />
          <Route path="audit-chain" element={<AuditChain />} />
          <Route path="observability" element={<Observability />} />
          <Route path="deployment" element={<Deployment />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* CONSUMER TIER: Protected Routes */}
        <Route path="/app" element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="transfer" element={<Transfer />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="developers" element={<DeveloperTools />} />
            <Route path="credit" element={<CreditHub />} />
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
