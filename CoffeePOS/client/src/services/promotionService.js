import axiosInstance from './AxiosInstance.js';

export async function getPromotions() {
  const response = await axiosInstance.get('/api/promociones');
  return response.data;
}

export async function createPromotion(promoData) {
  const response = await axiosInstance.post('/api/promociones', promoData);
  return response.data;
}

export async function updatePromotion(id, promoData) {
  const response = await axiosInstance.put(`/api/promociones/${id}`, promoData);
  return response.data;
}

export async function togglePromotion(id) {
  const response = await axiosInstance.patch(`/api/promociones/${id}/toggle`);
  return response.data;
}

export async function deletePromotion(id) {
  const response = await axiosInstance.delete(`/api/promociones/${id}`);
  return response.data;
}