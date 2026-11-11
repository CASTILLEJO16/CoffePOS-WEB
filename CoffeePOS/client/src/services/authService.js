import api from './api.js';

/**
 * Inicia sesión
 */
export async function login(usuario, contraseña) {
  const response = await api.post('/auth/login', { usuario, contraseña });
  return response.data.data;
}

/**
 * Inicia sesión con PIN de 4 dígitos
 */
export async function loginWithPin(pin) {
  const response = await api.post('/auth/login-pin', { pin });
  return response.data.data;
}

/**
 * Cierra sesión
 */
export async function logout() {
  const response = await api.post('/auth/logout');
  return response.data;
}

/**
 * Verifica token
 */
export async function verifyToken() {
  const response = await api.get('/auth/verify');
  return response.data.data;
}

/**
 * Obtiene todos los usuarios
 */
export async function getUsers() {
  const response = await api.get('/usuarios');
  return response.data.data;
}

/**
 * Crea un nuevo usuario
 */
export async function createUser(userData) {
  const response = await api.post('/usuarios', userData);
  return response.data.data;
}

/**
 * Actualiza un usuario existente
 */
export async function updateUser(id, userData) {
  const response = await api.put(`/usuarios/${id}`, userData);
  return response.data.data;
}

/**
 * Guarda token en sessionStorage
 */
export function saveToken(token) {
  sessionStorage.setItem('token', token);
}

/**
 * Guarda usuario en sessionStorage
 */
export function saveUser(user) {
  sessionStorage.setItem('user', JSON.stringify(user));
}

/**
 * Obtiene token del sessionStorage
 */
export function getToken() {
  return sessionStorage.getItem('token');
}

/**
 * Obtiene usuario del sessionStorage
 */
export function getUser() {
  const user = sessionStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

/**
 * Elimina token y usuario del sessionStorage
 */
export function clearAuth() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

/**
 * Verifica si el usuario está autenticado
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Activa un usuario (admin)
 */
export async function activateUser(id) {
  const response = await api.patch(`/usuarios/${id}/activar`);
  return response.data;
}

/**
 * Desactiva un usuario (admin)
 */
export async function deactivateUser(id) {
  const response = await api.patch(`/usuarios/${id}/desactivar`);
  return response.data;
}
