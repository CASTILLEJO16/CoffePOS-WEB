import api from './api.js';

/**
 * Obtiene info de la cafetería del usuario autenticado
 * Usa Client.businessName + address registrados desde DeveloperPanel
 */
export async function getMyClient() {
  const response = await api.get('/clientes/me');
  return response.data.data;
}

/**
 * Actualiza nombre/dirección de la cafetería (solo admin)
 * @param {{businessName: string, address: string, phone?: string}} data
 */
export async function updateMyClient(data) {
  const response = await api.put('/clientes/me', data);
  return response.data.data;
}
