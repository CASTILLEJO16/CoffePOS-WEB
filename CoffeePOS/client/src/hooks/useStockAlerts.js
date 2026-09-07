import { useState, useEffect, useCallback } from 'react';
import { getAlertasStock } from '../services/almacenService.js';

const POLL_INTERVAL = 60000; // 60s - singleton, evita 429
const MIN_FETCH_INTERVAL = 5000;

// ---- singleton state ----
let sharedData = { ingredientes: [], productos: [], total: 0, hasAlertas: false };
let sharedError = null;
let sharedLoading = false;
let subscribers = new Set();
let intervalId = null;
let lastFetch = 0;
let ongoing = null;
let backoffUntil = 0;
let globalEnabledCount = 0;

function notify() {
  subscribers.forEach(cb => {
    try { cb({ data: sharedData, error: sharedError, loading: sharedLoading }); } catch {}
  });
}

async function sharedFetch({ force = false } = {}) {
  const now = Date.now();
  if (backoffUntil > now) return null;
  if (!force && now - lastFetch < MIN_FETCH_INTERVAL) return null;
  if (ongoing) return ongoing;
  // si nadie está suscrito con enabled, no hacer fetch
  if (globalEnabledCount === 0) return null;

  sharedLoading = true;
  notify();
  ongoing = (async () => {
    try {
      const res = await getAlertasStock();
      sharedData = res || { ingredientes: [], productos: [], total: 0, hasAlertas: false };
      sharedError = null;
      lastFetch = Date.now();
      backoffUntil = 0;
      sharedLoading = false;
      notify();
      return sharedData;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429) {
        // backoff 45s en caso de rate limit
        backoffUntil = Date.now() + 45000;
        console.warn('[stockAlert] 429 - backoff 45s');
      } else if (status !== 401) {
        sharedError = err.message;
      }
      sharedLoading = false;
      notify();
      return null;
    } finally {
      ongoing = null;
    }
  })();
  return ongoing;
}

function ensureInterval() {
  if (intervalId) return;
  intervalId = setInterval(() => sharedFetch({ force: false }), POLL_INTERVAL);
  // listeners globales una sola vez
  if (!ensureInterval._listenersAdded) {
    ensureInterval._listenersAdded = true;
    const onFocus = () => sharedFetch({ force: true });
    const onStockUpdated = () => sharedFetch({ force: true });
    window.addEventListener('focus', onFocus);
    window.addEventListener('stock-updated', onStockUpdated);
    // guardar para cleanup si se quisiera, pero singleton vive toda la app
  }
}

export function useStockAlerts({ enabled = true, pollInterval } = {}) {
  // pollInterval se ignora en singleton, se usa el global 60s
  const [state, setState] = useState({ data: sharedData, error: sharedError, loading: sharedLoading });

  const refresh = useCallback(() => sharedFetch({ force: true }), []);

  useEffect(() => {
    if (!enabled) return;
    globalEnabledCount++;
    // suscribir
    const cb = (s) => setState({ data: s.data, error: s.error, loading: s.loading });
    subscribers.add(cb);
    // estado inicial
    setState({ data: sharedData, error: sharedError, loading: sharedLoading });
    // asegurar intervalo y fetch inicial si es el primer suscriptor
    ensureInterval();
    if (lastFetch === 0) {
      sharedFetch({ force: true });
    } else {
      // si ya hay datos cacheados, no es necesario fetch, pero si son viejos (>30s) refrescar
      if (Date.now() - lastFetch > 30000) sharedFetch({ force: false });
    }

    return () => {
      subscribers.delete(cb);
      globalEnabledCount = Math.max(0, globalEnabledCount - 1);
      if (globalEnabledCount === 0 && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [enabled]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refresh,
    total: state.data.total || 0,
    hasAlertas: !!state.data.hasAlertas
  };
}

export function notifyStockUpdated() {
  window.dispatchEvent(new CustomEvent('stock-updated'));
}
