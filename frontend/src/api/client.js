import axios from 'axios';

let refreshing = null;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:5000/api',
  withCredentials: true
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Mock mode: Never redirect or attempt refresh token loops
    console.warn('API Error intercepted:', err.message);
    return Promise.reject(err);
  }
);
