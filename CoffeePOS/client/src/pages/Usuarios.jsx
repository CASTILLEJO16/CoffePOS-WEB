import { useState } from 'react';
import Swal from 'sweetalert2';
import { createUser, updateUser } from '../services/authService.js';
import UserList from '../components/admin/UserList.jsx';
import UserForm from '../components/admin/UserForm.jsx';
import Modal from '../components/common/Modal.jsx';
import Button from '../components/common/Button.jsx';
import './Usuarios.css';

export default function Usuarios() {
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleAddUser() {
    setEditingUser(null);
    setShowUserModal(true);
  }

  function handleEditUser(user) {
    setEditingUser(user);
    setShowUserModal(true);
  }

  async function handleUserSubmit(userData) {
    try {
      if (editingUser) {
        const userId = editingUser._id || editingUser.id;
        if (!userId) {
          console.error('Usuario sin ID válido:', editingUser);
          Swal.fire('Error', 'El usuario no tiene un ID válido', 'error');
          return;
        }
        await updateUser(userId, userData);
      } else {
        await createUser(userData);
      }
      setShowUserModal(false);
      setEditingUser(null);
      setRefreshKey(prev => prev + 1);
      Swal.fire({
        title: '¡Guardado!',
        text: editingUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      Swal.fire('Error', 'Error al guardar usuario', 'error');
    }
  }

  return (
    <div className="admin-page usuarios-page">
      <div className="usuarios-header">
        <h1 className="usuarios-title">Gestión de Usuarios</h1>
        <Button onClick={handleAddUser}>
          + Nuevo Usuario
        </Button>
      </div>

      <div className="usuarios-content">
        <UserList 
          onEdit={handleEditUser}
          onRefresh={refreshKey}
        />
      </div>

      <Modal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
        }}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
      >
        <UserForm
          user={editingUser}
          onSubmit={handleUserSubmit}
          onCancel={() => {
            setShowUserModal(false);
            setEditingUser(null);
          }}
        />
      </Modal>
    </div>
  );
}
