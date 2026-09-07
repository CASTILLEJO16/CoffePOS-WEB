import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import AdminSidebar from '../components/admin/AdminSidebar.jsx';
import MobileBottomNav from '../components/common/MobileBottomNav.jsx';
import StockAlertBanner from '../components/common/StockAlertBanner.jsx';
import Swal from 'sweetalert2';
import './AdminLayout.css';

export default function AdminLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    function onStockAlert(e) {
      const items = e.detail || [];
      if (!items.length) return;
      const nombres = items.slice(0,3).map(i => i.nombre).join(', ');
      const extra = items.length > 3 ? ` +${items.length-3} más` : '';
      Swal.fire({
        icon: 'warning',
        title: '⚠️ Stock bajo',
        html: `Queda poca cantidad de:<br><b>${nombres}${extra}</b><br><small>Revisa el almacén pronto</small>`,
        confirmButtonText: 'Ver almacén',
        showCancelButton: true,
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#d97706'
      }).then(r => { if (r.isConfirmed) navigate('/admin/almacen'); });
    }
    window.addEventListener('stock-alert', onStockAlert);
    return () => window.removeEventListener('stock-alert', onStockAlert);
  }, [navigate]);

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <StockAlertBanner />
        <Outlet />
      </main>
      <MobileBottomNav variant="admin" />
    </div>
  );
}
