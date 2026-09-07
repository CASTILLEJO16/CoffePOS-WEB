import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { getOpenCashRegister } from '../services/cashRegisterService.js';
import { useState, useEffect, useCallback } from 'react';
import { Coffee, ShoppingCart, BarChart3, Sun, Moon, LogOut, Package } from 'lucide-react';
import Swal from 'sweetalert2';
import MobileBottomNav from '../components/common/MobileBottomNav.jsx';
import StockAlertBell from '../components/common/StockAlertBell.jsx';
import StockAlertBanner from '../components/common/StockAlertBanner.jsx';
import './MainLayout.css';

export default function MainLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [cashRegister, setCashRegister] = useState(null);

  const loadCashRegister = useCallback(async () => {
    try {
      const data = await getOpenCashRegister();
      setCashRegister(data && data.estado === 'abierta' ? data : null);
    } catch (error) {
      console.error('Error al cargar caja:', error);
      setCashRegister(null);
    }
  }, []);

  useEffect(() => {
    loadCashRegister();
  }, [loadCashRegister, location.pathname]);

  // Escuchar alertas de stock tras ventas para mostrar aviso inmediato
  useEffect(() => {
    function onStockAlert(e) {
      const items = e.detail || [];
      if (!items.length) return;
      const nombres = items.slice(0,3).map(i => i.nombre).join(', ');
      const extra = items.length > 3 ? ` +${items.length-3} más` : '';
      Swal.fire({
        icon: 'warning',
        title: 'Stock bajo',
        html: `Queda poca cantidad de:<br><b>${nombres}${extra}</b><br><small>Revisa el almacén pronto</small>`,
        confirmButtonText: 'Ver almacén',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#d97706'
      }).then(r => { if (r.isConfirmed) navigate('/almacen'); });
    }
    window.addEventListener('stock-alert', onStockAlert);
    return () => window.removeEventListener('stock-alert', onStockAlert);
  }, [navigate]);

  function handleLogout() {
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

  const menuItems = [
    { path: '/', icon: ShoppingCart, label: 'Punto de Venta' },
    { path: '/ventas', icon: BarChart3, label: 'Mis Ventas' },
    { path: '/almacen', icon: Package, label: 'Almacén' },
  ];

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="header-logo">
              <Coffee size={22} className="header-logo-icon" />
              <span>Coffee POS</span>
            </Link>
            <nav className="top-nav">
              {menuItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`top-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    <Icon size={16} className="nav-icon" />
                    <span className="nav-label">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="header-user">
            {cashRegister && (
              <div className="cash-register-status">
                <span className="status-dot"></span>
                <span className="status-text">{cashRegister.nombre_caja || `Caja #${cashRegister._id || cashRegister.id}`} Abierta</span>
              </div>
            )}
            <StockAlertBell />
            <span className="user-name">{user?.nombre}</span>
            <span className={`user-role ${user?.role || user?.rol}`}>
              {(user?.role === 'admin' || user?.rol === 'admin') ? 'Admin' : 'Vendedor'}
            </span>
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
              aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button type="button" className="logout-button" onClick={handleLogout}>
              <LogOut size={16} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>
      <main className="main-content">
        <StockAlertBanner />
        {children || <Outlet />}
      </main>
      <MobileBottomNav variant="seller" />
    </div>
  );
}
