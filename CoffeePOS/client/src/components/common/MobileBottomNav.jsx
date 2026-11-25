import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MoreHorizontal, X, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useStockAlerts } from '../../hooks/useStockAlerts.js';
import { ADMIN_MENU, SELLER_MENU, isMenuItemActive } from '../../utils/navigation.js';
import Swal from 'sweetalert2';
import './MobileBottomNav.css';

function StockBadge({ count }) {
  if (!count) return null;
  return (
    <span className="mobile-nav-badge">{count > 99 ? '99+' : count}</span>
  );
}

export default function MobileBottomNav({ variant = 'seller' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { total: stockTotal } = useStockAlerts({ enabled: true });
  const [moreOpen, setMoreOpen] = useState(false);

  // Misma lista de módulos que el menú de escritorio (utils/navigation.js)
  const menu = variant === 'admin' ? ADMIN_MENU : SELLER_MENU;
  const primary = menu.filter(item => item.mobilePrimary);
  const moreItems = menu.filter(item => !item.mobilePrimary);

  function handleLogout() {
    setMoreOpen(false);
    Swal.fire({
      title: '¿Estás seguro de cerrar sesión?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ff4b4b',
      cancelButtonColor: '#888',
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
        navigate('/login');
      }
    });
  }

  const isActive = (item) => isMenuItemActive(item, location.pathname);

  const hasMore = moreItems.length > 0;
  const isMoreActive = hasMore && moreItems.some(isActive);
  const moreHasStockAlert = moreItems.some(i => i.stockBadge) && stockTotal > 0;

  return (
    <>
      {moreOpen && (
        <div className="mobile-more-overlay" onClick={() => setMoreOpen(false)}>
          <div className="mobile-more-sheet" onClick={e => e.stopPropagation()}>
            <div className="mobile-more-handle" />
            <div className="mobile-more-header">
              <span className="mobile-more-title">Más opciones</span>
              <button className="mobile-more-close" onClick={() => setMoreOpen(false)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="mobile-more-grid">
              {moreItems.map(item => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Link key={item.path} to={item.path} onClick={() => setMoreOpen(false)} className={`mobile-more-link ${active ? 'active' : ''}`}>
                    <span className="mobile-more-icon-wrap">
                      <Icon size={20} />
                      {item.stockBadge && <StockBadge count={stockTotal} />}
                    </span>
                    <span className="mobile-more-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav" aria-label="Navegación principal">
        <div className="mobile-bottom-nav-inner">
          {primary.map(item => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link key={item.path} to={item.path} className={`mobile-nav-item ${active ? 'active' : ''}`} aria-label={item.label}>
                <span className="mobile-nav-icon">
                  <Icon size={22} />
                  {item.stockBadge && <StockBadge count={stockTotal} />}
                </span>
                <span className="mobile-nav-label">{item.short || item.label}</span>
              </Link>
            );
          })}
          {hasMore && (
            <button className={`mobile-nav-item mobile-nav-more ${isMoreActive || moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen(v => !v)} aria-label="Más opciones" aria-expanded={moreOpen}>
              <span className="mobile-nav-icon">
                {moreOpen ? <X size={22} /> : <MoreHorizontal size={22} />}
                {!moreOpen && moreHasStockAlert && <span className="mobile-nav-dot" />}
              </span>
              <span className="mobile-nav-label">Más</span>
            </button>
          )}
          <button className="mobile-nav-item mobile-nav-logout" onClick={handleLogout} aria-label="Cerrar sesión">
            <span className="mobile-nav-icon"><LogOut size={22} /></span>
            <span className="mobile-nav-label">Salir</span>
          </button>
        </div>
      </nav>
    </>
  );
}
