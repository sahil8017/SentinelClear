import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getToken, getRoleFromToken } from '../lib/auth';

const ProtectedRoute = () => {
  const token = getToken();
  const role = getRoleFromToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Bifurcation: Admins should not be in the consumer tier
  if (role === 'ADMIN') {
    return <Navigate to="/admin/ops" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
