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
    const data = error.response?.data;
    const code = data?.code;
    const status = error.response?.status;
    // Solo cerrar sesión si es token expirado o licencia expirada/bloqueada
    const isTokenExpired = code === 'TOKEN_EXPIRED' || data?.error === 'Token expirado';
    const isLicenseError = code === 'LICENSE_EXPIRED' || code === 'LICENSE_INVALID' || code === 'LICENSE_BLOCKED';

    if (status === 401 && isTokenExpired) {
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
    } else if (status === 403 && isLicenseError) {
      console.warn('Licencia inválida/expirada - cerrando sesión');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Usar clave de licencia inválida para redirigir a activación
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('force-logout', {
            detail: { reason: code || 'LICENSE_EXPIRED' }
          }));
        }
      } catch (_) {}
    } else if (status === 401 && code === 'INVALID_PASSWORD') {
      // No cerrar sesión, solo rechazar para que el modal muestre error
      console.warn('Contraseña de devolución incorrecta');
    } else if (status === 401 && !isTokenExpired && !code) {
      // 401 sin código no es necesariamente token expirado (ej: password incorrecta) - no cerrar sesión automáticamente
      // Solo logear
      console.warn('401 sin token expirado:', data?.error);
    } else if (status === 403 && !isLicenseError) {
      // 403 por falta de permisos (no admin) - no cerrar sesión
      console.warn('403 permiso denegado:', data?.error);
    }
    return Promise.reject(error);
  }
);

export default api;
