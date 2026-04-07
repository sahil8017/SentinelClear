import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getToken, getRoleFromToken } from '../lib/auth';

const AdminProtectedRoute = () => {
  const token = getToken();
  const role = getRoleFromToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Bifurcation: Non-admins should not be in the administrative tier
  if (role !== 'ADMIN') {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminProtectedRoute;
