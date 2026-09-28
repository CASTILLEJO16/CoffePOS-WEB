import api from './api.js';

export async function getPromotions() {
  const response = await api.get('/api/promociones');
  return response.data;
}

export async function createPromotion(promoData) {
  const response = await api.post('/api/promociones', promoData);
  return response.data;
}

export async function updatePromotion(id, promoData) {
  const response = await api.put(`/api/promociones/${id}`, promoData);
  return response.data;
}

export async function togglePromotion(id) {
  const response = await api.patch(`/api/promociones/${id}/toggle`);
  return response.data;
}

export async function deletePromotion(id) {
  const response = await api.delete(`/api/promociones/${id}`);
  return response.data;
}