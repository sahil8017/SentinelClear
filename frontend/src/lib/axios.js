import axios from 'axios';
import { getToken, clearToken } from './auth';

const apiClient = axios.create({
  // Hardcoded to backend port 8000 for standard SentinelClear v3.0 dev environment
  // Base URL points to backend API. Use VITE_API_URL if set, otherwise default to Hugging Face space.
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Do NOT clear token / redirect for Step-Up Auth challenges
      const detail = error.response.data?.detail;
      if (detail === 'Step-Up Authentication Required') {
        return Promise.reject(error); // Let the calling component handle it
      }
      clearToken();
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
