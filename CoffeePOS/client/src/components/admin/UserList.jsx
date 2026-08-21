import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit, Power, PowerOff } from 'lucide-react';
import { getUsers, activateUser, deactivateUser } from '../../services/authService.js';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import './UserList.css';

export default function UserList({ onEdit, onRefresh }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, [onRefresh]);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await getUsers();
      console.log('Usuarios cargados:', data.map(u => ({ nombre: u.nombre, _id: u._id, id: u.id })));
      setUsers(data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(user) {
    try {
      const userId = user._id || user.id;
      if (!userId) {
        console.error('Usuario sin ID válido:', user);
        alert('Error: El usuario no tiene un ID válido');
        return;
      }
      if (user.activo) {
        await deactivateUser(userId);
      } else {
        await activateUser(userId);
      }
      loadUsers();
    } catch (error) {
      console.error('Error al cambiar estado del usuario:', error);
      alert('Error al cambiar estado del usuario: ' + (error.response?.data?.error || error.message));
    }
  }

  if (loading) {
    return <div className="loading">Cargando usuarios...</div>;
  }

  return (
    <div className="user-list">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => {
            const userId = user._id || user.id;
            return (
              <tr key={userId}>
                <td className="user-name-cell">
                  <button
                    className="user-name-link"
                    onClick={() => navigate(`/admin/usuarios/${userId}`)}
                  >
                    {user.nombre}
                  </button>
                </td>
              <td>{user.usuario}</td>
              <td>
                <span className={`role-badge ${user.rol}`}>
                  {user.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                </span>
              </td>
              <td>
                <span className={`status-badge ${user.activo ? 'active' : 'inactive'}`}>
                  {user.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="actions-cell">
                <Button size="small" icon={Edit} onClick={() => onEdit(user)}>
                  Editar
                </Button>
                <Button
                  size="small"
                  variant={user.activo ? 'secondary' : 'success'}
                  icon={user.activo ? PowerOff : Power}
                  onClick={() => handleToggleActive(user)}
                >
                  {user.activo ? 'Desactivar' : 'Activar'}
                </Button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
