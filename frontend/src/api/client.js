import axios from 'axios';

let refreshing = null;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:5000/api',
  withCredentials: true
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      if (original.url === '/auth/refresh' || original.url.includes('/auth/login')) {
        return Promise.reject(err);
      }
      original._retry = true;
      if (!refreshing) {
        refreshing = api.post('/auth/refresh', {}, { _retry: true }).finally(() => { refreshing = null; });
      }
      try {
        await refreshing;
        return api(original);
      } catch {
        if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);
