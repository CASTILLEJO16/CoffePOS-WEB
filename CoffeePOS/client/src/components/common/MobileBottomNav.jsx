import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, BarChart3, Wallet, Settings, Users, DollarSign, MoreHorizontal, X, Coffee, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Swal from 'sweetalert2';
import './MobileBottomNav.css';

const adminPrimary = [
  { path: '/admin/pos', icon: ShoppingCart, label: 'POS' },
  { path: '/admin', icon: Package, label: 'Productos', exact: true },
  { path: '/admin/ventas', icon: DollarSign, label: 'Ventas' },
  { path: '/admin/kpis', icon: BarChart3, label: 'KPIs' },
];

const adminMore = [
  { path: '/admin/personalizaciones', icon: Settings, label: 'Personalizaciones' },
  { path: '/admin/usuarios', icon: Users, label: 'Usuarios' },
  { path: '/admin/almacen', icon: Package, label: 'Almacén' },
  { path: '/admin/cortes-caja', icon: Wallet, label: 'Cortes' },
  { path: '/admin/configuracion', icon: Settings, label: 'Config' },
];

const sellerPrimary = [
  { path: '/', icon: ShoppingCart, label: 'POS', exact: true },
  { path: '/ventas', icon: BarChart3, label: 'Ventas' },
  { path: '/almacen', icon: Package, label: 'Almacén' },
];

export default function MobileBottomNav({ variant = 'seller' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = variant === 'admin';
  const primary = isAdmin ? adminPrimary : sellerPrimary;
  const moreItems = isAdmin ? adminMore : [];

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

  function isActive(item) {
    if (item.exact) return location.pathname === item.path;
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  }

  const hasMore = moreItems.length > 0;
  const isMoreActive = hasMore && moreItems.some(isActive);

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
                    <span className="mobile-more-icon-wrap"><Icon size={20} /></span>
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
              <Link key={item.path} to={item.path} className={`mobile-nav-item ${active ? 'active' : ''}`}>
                <span className="mobile-nav-icon"><Icon size={22} /></span>
                <span className="mobile-nav-label">{item.label}</span>
              </Link>
            );
          })}
          {hasMore && (
            <button className={`mobile-nav-item mobile-nav-more ${isMoreActive || moreOpen ? 'active' : ''}`} onClick={() => setMoreOpen(v => !v)} aria-label="Más opciones" aria-expanded={moreOpen}>
              <span className="mobile-nav-icon">{moreOpen ? <X size={22} /> : <MoreHorizontal size={22} />}</span>
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
