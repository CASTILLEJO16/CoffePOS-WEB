/**
 * Servicio para Tickets Abiertos (API)
 */

import api from './api.js';

export const createOpenTicket = async (data) => {
  const response = await api.post('/opentickets', data);
  return response.data;
};

export const getOpenTickets = async (filters = {}) => {
  const response = await api.get('/opentickets', { params: filters });
  return response.data;
};

export const getOpenTicketById = async (id) => {
  const response = await api.get(`/opentickets/${id}`);
  return response.data;
};

export const addTicketItem = async (ticketId, data) => {
  const response = await api.post(`/opentickets/${ticketId}/items`, data);
  return response.data;
};

export const updateTicketItem = async (itemId, data) => {
  const response = await api.put(`/opentickets/items/${itemId}`, data);
  return response.data;
};

export const deleteTicketItem = async (itemId) => {
  const response = await api.delete(`/opentickets/items/${itemId}`);
  return response.data;
};

export const closeTicket = async (ticketId, data) => {
  const response = await api.post(`/opentickets/${ticketId}/close`, data);
  return response.data;
};

export const cancelTicket = async (ticketId) => {
  const response = await api.post(`/opentickets/${ticketId}/cancel`);
  return response.data;
};

export const assignCustomerToTicket = async (ticketId, customerId) => {
  const response = await api.post(`/opentickets/${ticketId}/assign-customer`, { customerId });
  return response.data;
};
