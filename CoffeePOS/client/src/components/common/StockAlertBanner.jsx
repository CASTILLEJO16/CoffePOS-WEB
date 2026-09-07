import { AlertTriangle, X } from 'lucide-react';
import { useStockAlerts } from '../../hooks/useStockAlerts.js';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './StockAlertBanner.css';

export default function StockAlertBanner({ dismissKey = 'stock-banner-dismissed' }) {
  const { data, hasAlertas } = useStockAlerts();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const v = sessionStorage.getItem(dismissKey);
    if (v) {
      const ts = parseInt(v, 10);
      // auto-mostrar de nuevo después de 10 min
      if (Date.now() - ts > 10 * 60 * 1000) {
        sessionStorage.removeItem(dismissKey);
        setDismissed(false);
      } else {
        setDismissed(true);
      }
    }
  }, [dismissKey]);

  // reset dismissed cuando hay nuevas alertas y había sido cerrado hace tiempo, pero si hay alertas y dismissed, no mostrar hasta refetch
  useEffect(() => {
    if (!hasAlertas) setDismissed(false);
  }, [hasAlertas]);

  if (!hasAlertas || dismissed) return null;

  const ingredientes = data.ingredientes || [];
  const productos = data.productos || [];
  const total = data.total || 0;
  const agotados = [...ingredientes, ...productos].filter(i => i.agotado);
  const bajos = [...ingredientes, ...productos].filter(i => !i.agotado);
  const preview = [...ingredientes, ...productos].slice(0, 3).map(i => i.nombre).join(', ');
  const extra = total > 3 ? ` +${total - 3} más` : '';
  const hasAgotados = agotados.length > 0;

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem(dismissKey, String(Date.now()));
  }

  return (
    <div className={`stock-banner ${hasAgotados ? 'agotado' : ''}`}>
      <div className="stock-banner-icon">
        <AlertTriangle size={18} />
      </div>
      <div className="stock-banner-content">
        <strong className="stock-banner-title">{hasAgotados ? `⛔ Sin stock — ${agotados.length} agotado${agotados.length>1?'s':''}` : `Stock bajo en almacén — ${total} alerta${total>1?'s':''}`}</strong>
        <span className="stock-banner-text">{preview}{extra} — {hasAgotados ? 'No hay stock. No se puede vender.' : 'Queda poca cantidad. Reabastece pronto.'}</span>
      </div>
      <div className="stock-banner-actions">
        <button className="stock-banner-btn" onClick={() => navigate(window.location.pathname.startsWith('/admin') ? '/admin/almacen' : '/almacen')}>Ver almacén</button>
        <button className="stock-banner-close" onClick={handleDismiss} title="Cerrar aviso"><X size={16} /></button>
      </div>
    </div>
  );
}
