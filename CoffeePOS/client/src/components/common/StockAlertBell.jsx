import { useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Package, X } from 'lucide-react';
import { useStockAlerts } from '../../hooks/useStockAlerts.js';
import { useNavigate } from 'react-router-dom';
import './StockAlertBell.css';

export default function StockAlertBell({ variant = 'light' }) {
  const { data, total, hasAlertas } = useStockAlerts({ enabled: true });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const allItems = [...(data.ingredientes || []), ...(data.productos || [])];

  return (
    <div className={`stock-bell-wrapper ${variant}`} ref={ref}>
      <button
        className={`stock-bell-btn ${hasAlertas ? 'has-alertas' : ''} ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
        title={hasAlertas ? `${total} alerta${total>1?'s':''} de stock bajo` : 'Sin alertas de stock'}
        aria-label="Alertas de stock"
      >
        <Bell size={18} />
        {hasAlertas && <span className="stock-bell-badge">{total > 99 ? '99+' : total}</span>}
        {hasAlertas && <span className="stock-bell-pulse" />}
      </button>

      {open && (
        <div className="stock-bell-dropdown">
          <div className="stock-bell-header">
            <div className="stock-bell-title">
              <AlertTriangle size={16} />
              <strong>Alertas de almacén</strong>
              {hasAlertas && <span className="stock-bell-count">{total}</span>}
            </div>
            <button className="stock-bell-close" onClick={() => setOpen(false)}><X size={16} /></button>
          </div>

          <div className="stock-bell-body">
            {!hasAlertas ? (
              <div className="stock-bell-empty">
                <Package size={28} />
                <p>Todo en orden</p>
                <small>Ningún ingrediente con stock bajo</small>
              </div>
            ) : (
              <ul className="stock-bell-list">
                {allItems.slice(0, 8).map(item => (
                  <li key={item._id + item.tipo} className={`stock-bell-item ${item.agotado ? 'agotado' : item.critico ? 'critico' : ''}`}>
                    <div className="stock-bell-item-info">
                      <span className="stock-bell-item-name">{item.nombre}</span>
                      <span className="stock-bell-item-meta">
                        {item.tipo === 'ingrediente'
                          ? `${item.stock_actual} / ${item.stock_minimo} ${item.unidad_medida}`
                          : `${item.stock} / ${item.stock_minimo} pza`}
                      </span>
                    </div>
                    <span className={`stock-bell-item-badge ${item.agotado ? 'agotado' : 'bajo'}`}>
                      {item.agotado ? 'Agotado' : 'Bajo'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {allItems.length > 8 && (
              <p className="stock-bell-more">+{allItems.length - 8} más...</p>
            )}
          </div>

          <div className="stock-bell-footer">
            <button
              className="stock-bell-go"
              onClick={() => {
                setOpen(false);
                // redirige según rol: si está en /admin usa /admin/almacen sino /almacen
                const isAdmin = window.location.pathname.startsWith('/admin');
                navigate(isAdmin ? '/admin/almacen' : '/almacen');
              }}
            >
              Ver almacén
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
