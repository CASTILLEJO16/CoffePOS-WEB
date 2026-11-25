import { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../utils/constants.js';

// Se consulta una sola vez por carga de página
let statusPromise = null;
function getWalletStatus() {
  if (!statusPromise) {
    statusPromise = axios.get(`${API_BASE_URL}/wallet/status`)
      .then(r => r.data?.data || {})
      .catch(() => ({}));
  }
  return statusPromise;
}

/**
 * Botón "Agregar a Google Wallet". No se muestra si el servidor no tiene Google Wallet configurado.
 * @param {string} qrToken - token de la tarjeta de lealtad
 */
export default function GoogleWalletButton({ qrToken, style }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    getWalletStatus().then(s => { if (alive) setEnabled(!!s.google); });
    return () => { alive = false; };
  }, []);

  if (!enabled || !qrToken) return null;

  const handleClick = async () => {
    try {
      setLoading(true);
      const r = await axios.get(`${API_BASE_URL}/wallet/google/${encodeURIComponent(qrToken)}`);
      const url = r.data?.data?.saveUrl;
      if (!url) throw new Error('sin enlace');
      window.location.href = url;
    } catch (error) {
      Swal.fire('Google Wallet', error.response?.data?.message || 'No se pudo agregar la tarjeta. Intenta más tarde.', 'error');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '14px 24px',
        border: 'none',
        borderRadius: '999px',
        background: '#1f1f1f',
        color: 'white',
        fontSize: '16px',
        fontWeight: 600,
        cursor: loading ? 'wait' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        width: '100%',
        ...style
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="3" fill="#4285F4" />
        <rect x="2" y="8" width="20" height="3" fill="#34A853" />
        <rect x="2" y="11" width="20" height="3" fill="#FBBC04" />
        <rect x="2" y="14" width="20" height="3" fill="#EA4335" />
      </svg>
      {loading ? 'Abriendo Google Wallet…' : 'Agregar a Google Wallet'}
    </button>
  );
}
