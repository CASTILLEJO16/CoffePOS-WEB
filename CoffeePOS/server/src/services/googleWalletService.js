/**
 * Google Wallet - Tarjetas de lealtad
 *
 * Una sola cuenta emisora (Issuer) para toda la plataforma; cada cafetería tiene su propia
 * "clase" (nombre, logo, color) y cada tarjeta de lealtad es un "objeto" de esa clase.
 *
 * Mientras no estén configuradas las variables de entorno, todo es no-op:
 * el POS funciona igual y el botón "Agregar a Google Wallet" no aparece.
 *
 * Variables de entorno:
 *   GOOGLE_WALLET_ISSUER_ID        - Issuer ID de Google Pay & Wallet Console
 *   GOOGLE_WALLET_SERVICE_ACCOUNT  - JSON de la cuenta de servicio (texto JSON o base64)
 *   GOOGLE_WALLET_LOGO_URL         - URL pública (https) del logo por defecto (PNG, mín. 660x660)
 *   GOOGLE_WALLET_COLOR            - color de fondo por defecto (ej. #6F4E37) [opcional]
 *   GOOGLE_WALLET_PREFIX           - prefijo de IDs (default 'coffeepos') [opcional]
 */

import jwt from 'jsonwebtoken';
import LoyaltyCard from '../models/LoyaltyCard.js';
import Client from '../models/Client.js';
import Config from '../models/Config.js';

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

let cachedCredentials;
function getCredentials() {
  if (cachedCredentials !== undefined) return cachedCredentials;
  cachedCredentials = null;
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT;
  if (!raw || !process.env.GOOGLE_WALLET_ISSUER_ID || !process.env.GOOGLE_WALLET_LOGO_URL) return null;
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const sa = JSON.parse(text);
    if (!sa.client_email || !sa.private_key) throw new Error('faltan client_email/private_key');
    cachedCredentials = { email: sa.client_email, key: sa.private_key.replace(/\\n/g, '\n') };
  } catch (e) {
    console.error('⚠️  GOOGLE_WALLET_SERVICE_ACCOUNT inválida:', e.message);
  }
  return cachedCredentials;
}

export function isGoogleWalletConfigured() {
  return !!getCredentials();
}

const issuerId = () => process.env.GOOGLE_WALLET_ISSUER_ID;
const prefix = () => (process.env.GOOGLE_WALLET_PREFIX || 'coffeepos').replace(/[^\w-]/g, '');
// IDs: "<issuer>.<sufijo>" con solo letras, números, '.', '_' o '-'
const classIdFor = (clientId) => `${issuerId()}.${prefix()}_cafe_${clientId}`;
const objectIdFor = (cardId) => `${issuerId()}.${prefix()}_card_${cardId}`;

// --- Autenticación OAuth (cuenta de servicio) ---
let tokenCache = { token: null, exp: 0 };
async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;
  const { email, key } = getCredentials();
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    key,
    { algorithm: 'RS256' }
  );
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`OAuth Google: ${data.error_description || data.error || r.status}`);
  tokenCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

async function gw(method, path, body) {
  const token = await getAccessToken();
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, ok: r.ok, data };
}

// --- Construcción de clase (cafetería) y objeto (tarjeta) ---
async function getProgramInfo(clientId) {
  const [cafe, rows] = await Promise.all([
    Client.findById(clientId).select('name businessName').lean(),
    Config.find({ clientId, clave: { $in: ['loyalty_program_name', 'loyalty_reward_product'] } }).lean()
  ]);
  const cfg = Object.fromEntries(rows.map(r => [r.clave, r.valor]));
  return {
    cafeName: cafe?.businessName || cafe?.name || 'Cafetería',
    programName: cfg.loyalty_program_name || 'Programa de Lealtad',
    rewardName: cfg.loyalty_reward_product || 'Recompensa'
  };
}

function buildClass(clientId, info) {
  return {
    id: classIdFor(clientId),
    issuerName: info.cafeName.slice(0, 20) || 'Cafetería',
    programName: info.programName.slice(0, 40),
    programLogo: {
      sourceUri: { uri: process.env.GOOGLE_WALLET_LOGO_URL },
      contentDescription: { defaultValue: { language: 'es', value: info.cafeName } }
    },
    hexBackgroundColor: process.env.GOOGLE_WALLET_COLOR || '#6F4E37',
    reviewStatus: 'UNDER_REVIEW',
    countryCode: 'MX'
  };
}

function buildObject(card, customerName, info) {
  const sellos = `${card.sellos_actuales} / ${card.sellos_requeridos}`;
  return {
    id: objectIdFor(card._id),
    classId: classIdFor(card.clientId),
    state: card.estado === 'activa' ? 'ACTIVE' : 'INACTIVE',
    accountId: String(card._id).slice(-8).toUpperCase(),
    accountName: (customerName || 'Cliente').slice(0, 40),
    // El POS escanea este QR igual que la tarjeta impresa
    barcode: { type: 'QR_CODE', value: card.qr_token },
    loyaltyPoints: { label: 'Sellos', balance: { string: sellos } },
    secondaryLoyaltyPoints: { label: 'Recompensas', balance: { int: card.recompensas_disponibles || 0 } },
    textModulesData: [{
      id: 'recompensa',
      header: 'Tu recompensa',
      body: `Junta ${card.sellos_requeridos} sellos y obtén: ${info.rewardName}`
    }]
  };
}

async function ensureClass(clientId, info) {
  const cls = buildClass(clientId, info);
  const r = await gw('POST', '/loyaltyClass', cls);
  if (r.ok) return;
  if (r.status === 409) {
    // Ya existe: actualizar nombre/programa por si cambiaron
    const u = await gw('PATCH', `/loyaltyClass/${encodeURIComponent(cls.id)}`, cls);
    if (!u.ok) throw new Error(`Actualizar clase Google Wallet: ${u.status} ${u.data?.error?.message || ''}`);
    return;
  }
  throw new Error(`Crear clase Google Wallet: ${r.status} ${r.data?.error?.message || ''}`);
}

async function loadCard(cardOrId) {
  const card = await LoyaltyCard.findById(cardOrId?._id || cardOrId).populate('customerId', 'nombre').lean();
  if (!card) throw new Error('Tarjeta no encontrada');
  return card;
}

/**
 * Genera el enlace "Agregar a Google Wallet" para una tarjeta.
 * Crea/actualiza la clase de la cafetería y el objeto de la tarjeta con los datos actuales.
 */
export async function createGoogleSaveUrl(cardOrId) {
  if (!isGoogleWalletConfigured()) throw new Error('Google Wallet no está configurado');
  const card = await loadCard(cardOrId);
  const info = await getProgramInfo(card.clientId);
  await ensureClass(card.clientId, info);

  const obj = buildObject(card, card.customerId?.nombre, info);
  const ins = await gw('POST', '/loyaltyObject', obj);
  if (!ins.ok) {
    if (ins.status !== 409) throw new Error(`Crear tarjeta Google Wallet: ${ins.status} ${ins.data?.error?.message || ''}`);
    const upd = await gw('PATCH', `/loyaltyObject/${encodeURIComponent(obj.id)}`, obj);
    if (!upd.ok) throw new Error(`Actualizar tarjeta Google Wallet: ${upd.status} ${upd.data?.error?.message || ''}`);
  }

  const { email, key } = getCredentials();
  const token = jwt.sign(
    {
      iss: email,
      aud: 'google',
      typ: 'savetowallet',
      origins: [],
      payload: { loyaltyObjects: [{ id: obj.id, classId: obj.classId }] }
    },
    key,
    { algorithm: 'RS256' }
  );
  return `https://pay.google.com/gp/v/save/${token}`;
}

/**
 * Refleja en Google Wallet los sellos/recompensas actuales de la tarjeta.
 * No bloquea ni rompe la venta: si falla, solo se registra en el log.
 * Si el cliente nunca agregó la tarjeta a Wallet (404), no hace nada.
 */
export function syncGoogleCard(cardOrId) {
  if (!isGoogleWalletConfigured() || !cardOrId) return;
  (async () => {
    const card = await loadCard(cardOrId);
    const info = await getProgramInfo(card.clientId);
    const obj = buildObject(card, card.customerId?.nombre, info);
    const r = await gw('PATCH', `/loyaltyObject/${encodeURIComponent(obj.id)}`, obj);
    if (!r.ok && r.status !== 404) {
      console.warn(`[GoogleWallet] No se pudo actualizar tarjeta ${card._id}: ${r.status} ${r.data?.error?.message || ''}`);
    }
  })().catch(e => console.warn('[GoogleWallet] Error al sincronizar tarjeta:', e.message));
}

/**
 * Actualiza nombre del programa / recompensa de la cafetería (tras cambiar la configuración).
 */
export function syncGoogleClass(clientId) {
  if (!isGoogleWalletConfigured() || !clientId) return;
  (async () => {
    const info = await getProgramInfo(clientId);
    const cls = buildClass(clientId, info);
    const r = await gw('PATCH', `/loyaltyClass/${encodeURIComponent(cls.id)}`, cls);
    if (!r.ok && r.status !== 404) {
      console.warn(`[GoogleWallet] No se pudo actualizar la clase ${cls.id}: ${r.status} ${r.data?.error?.message || ''}`);
    }
  })().catch(e => console.warn('[GoogleWallet] Error al sincronizar clase:', e.message));
}

/**
 * Desactiva en Google Wallet la tarjeta de un cliente eliminado (la tarjeta ya no existe en la BD).
 * No bloquea; si el cliente nunca la agregó a Wallet (404), no hace nada.
 */
export function disableGoogleCard(cardId) {
  if (!isGoogleWalletConfigured() || !cardId) return;
  (async () => {
    const r = await gw('PATCH', `/loyaltyObject/${encodeURIComponent(objectIdFor(cardId))}`, { state: 'INACTIVE' });
    if (!r.ok && r.status !== 404) {
      console.warn(`[GoogleWallet] No se pudo desactivar tarjeta ${cardId}: ${r.status} ${r.data?.error?.message || ''}`);
    }
  })().catch(e => console.warn('[GoogleWallet] Error al desactivar tarjeta:', e.message));
}
