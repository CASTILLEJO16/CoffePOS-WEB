/**
 * Servicio para Tarjetas de Lealtad (API)
 */

import api from './api.js';

export const getCardByQRToken = async (qrToken) => {
  const response = await api.get(`/loyalty/qr/${qrToken}`);
  return response.data;
};

export const getCustomerCard = async (customerId) => {
  const response = await api.get(`/loyalty/customer/${customerId}`);
  return response.data;
};

export const addStamp = async (data) => {
  const response = await api.post('/loyalty/stamp', data);
  return response.data;
};

export const redeemReward = async (data) => {
  const response = await api.post('/loyalty/redeem', data);
  return response.data;
};

export const getStampHistory = async (customerId) => {
  const response = await api.get(`/loyalty/history/${customerId}`);
  return response.data;
};

export const getRewards = async (customerId) => {
  const response = await api.get(`/loyalty/rewards/${customerId}`);
  return response.data;
};

export const revertStamp = async (data) => {
  const response = await api.post('/loyalty/revert', data);
  return response.data;
};

export const getLoyaltyConfig = async () => {
  const response = await api.get('/loyalty/config');
  return response.data;
};

export const updateLoyaltyConfig = async (data) => {
  const response = await api.put('/loyalty/config', data);
  return response.data;
};

export const getAllLoyaltyCards = async (search = '') => {
  const params = search ? { search } : {};
  const response = await api.get('/loyalty/all', { params });
  return response.data;
};
