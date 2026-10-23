/**
 * Servicio para Clientes Individuales (API)
 */

import api from './api.js';
import axios from 'axios';

export const createCustomer = async (data) => {
  const response = await api.post('/customers', data);
  return response.data;
};

// Registro público (sin autenticación - no agregar headers de token)
export const publicRegisterCustomer = async (data) => {
  const response = await axios.post(`${import.meta.env.VITE_API_URL}/customers/public-register`, data);
  return response.data;
};

export const getCustomers = async (search = '') => {
  const params = search ? { search } : {};
  const response = await api.get('/customers', { params });
  return response.data;
};

export const getCustomerById = async (id) => {
  const response = await api.get(`/customers/${id}`);
  return response.data;
};

export const getCustomerByPhone = async (telefono) => {
  const response = await api.get(`/customers/phone/${telefono}`);
  return response.data;
};

// Búsqueda pública (sin autenticación)
export const publicLookupCustomer = async (telefono) => {
  const response = await axios.get(`${import.meta.env.VITE_API_URL}/customers/public-lookup/${telefono}`);
  return response.data;
};

export const updateCustomer = async (id, data) => {
  const response = await api.put(`/customers/${id}`, data);
  return response.data;
};

export const toggleCustomerStatus = async (id) => {
  const response = await api.patch(`/customers/${id}/status`);
  return response.data;
};
