import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor de peticiones para adjuntar Token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dev_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de respuestas para desloguear si el token expira o es inválido
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('dev-force-logout'));
        }
      } catch (_) {}
    }
    return Promise.reject(error);
  }
);

// Servicio de licencias y autenticación de desarrollador
export const licenseService = {
  // Autenticación de Desarrollador
  login: (usuario, contraseña) => api.post('/auth/login', { usuario, contraseña }),

  // Clientes
  createClient: (data) => api.post('/clientes', data),
  getClients: () => api.get('/clientes'),
  getClientById: (id) => api.get(`/clientes/${id}`),
  updateClient: (id, data) => api.put(`/clientes/${id}`, data),
  deleteClient: (id) => api.delete(`/clientes/${id}`),
  getClientLicenses: (id) => api.get(`/clientes/${id}/licenses`),

  // Licencias
  generateLicense: (data) => api.post('/licencias/generate', data),
  getLicenses: () => api.get('/licencias'),
  getLicenseById: (id) => api.get(`/licencias/${id}`),
  extendLicense: (data) => api.post('/licencias/extend', data),
  blockLicense: (id) => api.put(`/licencias/${id}/block`),
  activateLicense: (id) => api.put(`/licencias/${id}/activate`),
  getLicenseDevices: (id) => api.get(`/licencias/${id}/devices`),

  // Dispositivos
  blockDevice: (data) => api.post('/licencias/device/block', data),
  releaseDevice: (data) => api.post('/licencias/device/release', data),

  // Públicos (para clientes)
  verifyLicense: (data) => api.post('/licencias/public/verify', data),
  activateDevice: (data) => api.post('/licencias/public/activate', data),
};

export default licenseService;
