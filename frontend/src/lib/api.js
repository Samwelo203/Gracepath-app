import axios from 'axios';

// Same origin as the page — works in Codespaces, dev, and production
const BASE_URL = window.location.origin;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gpc_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — log out and redirect
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/api/auth/login')) {
      localStorage.removeItem('gpc_token');
      localStorage.removeItem('gpc_user');
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = '/app/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;