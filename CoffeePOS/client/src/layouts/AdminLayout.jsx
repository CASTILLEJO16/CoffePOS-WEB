import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar.jsx';
import MobileBottomNav from '../components/common/MobileBottomNav.jsx';
import './AdminLayout.css';

export default function AdminLayout() {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <Outlet />
      </main>
      <MobileBottomNav variant="admin" />
    </div>
  );
}
