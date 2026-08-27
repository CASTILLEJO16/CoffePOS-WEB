import api from './api.js';

// Servicio de licencias
export const licenseService = {
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
