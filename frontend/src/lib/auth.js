export const setToken = (token) => {
  if (typeof token !== 'string' || !token.trim()) {
    console.warn('Attempted to store invalid auth token');
    return;
  }
  localStorage.setItem('sentinel_jwt', token.trim());
};

export const getToken = () => {
  const token = localStorage.getItem('sentinel_jwt');
  return token && token.trim() ? token : null;
};

export const clearToken = () => {
  localStorage.removeItem('sentinel_jwt');
};

export const getRoleFromToken = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    return payload.role || 'USER';
  } catch (error) {
    console.error('Failed to parse JWT payload', error);
    return null;
  }
};

export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return false;
    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    // Check expiry
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      clearToken();
      return false;
    }
    return true;
  } catch {
    return false;
  }
};
