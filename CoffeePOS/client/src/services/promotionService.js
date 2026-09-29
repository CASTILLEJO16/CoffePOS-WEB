import api from './api.js';

export async function getPromotions() {
  const response = await api.get('/promociones');
  return response.data.data || [];
}

export async function createPromotion(promoData) {
  const response = await api.post('/promociones', promoData);
  return response.data;
}

export async function updatePromotion(id, promoData) {
  const response = await api.put(`/promociones/${id}`, promoData);
  return response.data;
}

export async function togglePromotion(id) {
  const response = await api.patch(`/promociones/${id}/toggle`);
  return response.data;
}

export async function deletePromotion(id) {
  const response = await api.delete(`/promociones/${id}`);
  return response.data;
}