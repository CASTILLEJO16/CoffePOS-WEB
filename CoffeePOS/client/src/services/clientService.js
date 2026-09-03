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
 * Nota: la actualización de nombre/dirección solo está permitida desde DeveloperPanel
 * (PUT /clientes/:id). No se expone edición desde el POS.
 */
