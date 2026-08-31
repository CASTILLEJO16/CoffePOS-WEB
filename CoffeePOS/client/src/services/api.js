import axios from 'axios';
import { API_BASE_URL } from '../utils/constants.js';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar token a las requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isTokenExpired = error.response?.data?.code === 'TOKEN_EXPIRED' ||
                           error.response?.data?.error === 'Token expirado';

      if (isTokenExpired) {
        console.warn('Token expirado - cerrando sesión');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('force-logout', {
              detail: { reason: 'TOKEN_EXPIRED' }
            }));
          }
        } catch (_) {}
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        try {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('force-logout'));
          }
        } catch (_) {}
      }
    } else if (error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('force-logout'));
        }
      } catch (_) {}
    }
    return Promise.reject(error);
  }
);

export default api;
