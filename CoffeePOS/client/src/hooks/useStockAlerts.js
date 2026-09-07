import { useState, useEffect, useCallback, useRef } from 'react';
import { getAlertasStock } from '../services/almacenService.js';

const POLL_INTERVAL = 60000; // 60s

export function useStockAlerts({ enabled = true, pollInterval = POLL_INTERVAL } = {}) {
  const [data, setData] = useState({ ingredientes: [], productos: [], total: 0, hasAlertas: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchAlertas = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const res = await getAlertasStock();
      setData(res || { ingredientes: [], productos: [], total: 0, hasAlertas: false });
      setError(null);
      return res;
    } catch (err) {
      // No mostrar error si es 401 (no autenticado)
      if (err?.response?.status !== 401) {
        setError(err.message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchAlertas();
    intervalRef.current = setInterval(fetchAlertas, pollInterval);
    // Refrescar cuando la ventana vuelve a tener foco
    const onFocus = () => fetchAlertas();
    const onStockUpdated = () => fetchAlertas();
    window.addEventListener('focus', onFocus);
    window.addEventListener('stock-updated', onStockUpdated);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('stock-updated', onStockUpdated);
    };
  }, [enabled, pollInterval, fetchAlertas]);

  return { data, loading, error, refresh: fetchAlertas, total: data.total, hasAlertas: data.hasAlertas };
}

export function notifyStockUpdated() {
  window.dispatchEvent(new CustomEvent('stock-updated'));
}
