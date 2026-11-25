/**
 * Servicio para Clientes Individuales (API)
 */

import api from './api.js';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants.js';

/**
 * Obtiene el id de cafetería del enlace público (?c=...)
 */
export function getPublicCafeIdFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('c') || null;
  } catch {
    return null;
  }
}

export const createCustomer = async (data) => {
  const response = await api.post('/customers', data);
  return response.data;
};

// Registro público (sin autenticación - no agregar headers de token)
export const publicRegisterCustomer = async (data, cafeId) => {
  const response = await axios.post(`${API_BASE_URL}/customers/public-register`, { ...data, cafeId });
  return response.data;
};

// Nombre público de la cafetería (para mostrarlo en el registro)
export const getPublicCafeInfo = async (cafeId) => {
  const response = await axios.get(`${API_BASE_URL}/customers/public-cafe/${encodeURIComponent(cafeId)}`);
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
export const publicLookupCustomer = async (telefono, cafeId) => {
  const response = await axios.get(`${API_BASE_URL}/customers/public-lookup/${encodeURIComponent(telefono)}`, {
    params: { cafeId }
  });
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

// Dar de baja (activo=false) o reactivar (activo=true) a un cliente — solo admin
export const setCustomerStatus = async (id, activo) => {
  const response = await api.patch(`/customers/${id}/status`, { activo });
  return response.data;
};

// Eliminar cliente definitivamente (tarjeta, sellos y recompensas) — solo admin
export const deleteCustomer = async (id) => {
  const response = await api.delete(`/customers/${id}`);
  return response.data;
};
