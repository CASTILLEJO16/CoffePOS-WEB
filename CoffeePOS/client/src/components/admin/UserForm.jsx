import { useState, useEffect } from 'react';
import Input from '../common/Input.jsx';
import Button from '../common/Button.jsx';
import './UserForm.css';

export default function UserForm({ user, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '',
    contraseña: '',
    pin: '',
    rol: 'cajero',
    activo: true
  });

  useEffect(() => {
    if (user) {
      setFormData({
        nombre: user.nombre || '',
        usuario: user.usuario || '',
        contraseña: '',
        pin: '',
        rol: user.rol || 'cajero',
        activo: user.activo !== undefined ? user.activo : true
      });
    }
  }, [user]);

  function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...formData };
    // Si es edición y pin vacío, no enviar (mantener actual)
    if (user && !payload.pin) {
      delete payload.pin;
    }
    // Si es creación y pin vacío, no enviar
    if (!user && !payload.pin) {
      delete payload.pin;
    }
    // Si pin tiene valor, ya está validado a 4 dígitos por handleChange, pero verificar
    if (payload.pin && !/^\d{4}$/.test(payload.pin)) {
      alert('PIN debe ser 4 dígitos numéricos');
      return;
    }
    onSubmit(payload);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    if (name === 'pin') {
      const digits = value.replace(/\D/g, '').slice(0, 4);
      setFormData(prev => ({ ...prev, pin: digits }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  return (
    <form className="user-form" onSubmit={handleSubmit}>
      <Input
        label="Nombre completo"
        name="nombre"
        value={formData.nombre}
        onChange={handleChange}
        placeholder="Ej: Juan Pérez"
        required
      />
      
      <Input
        label="Usuario"
        name="usuario"
        value={formData.usuario}
        onChange={handleChange}
        placeholder="Ej: juanperez"
        required
      />
      
      <Input
        label={user ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña"}
        name="contraseña"
        type="password"
        value={formData.contraseña}
        onChange={handleChange}
        placeholder={user ? "••••••••" : "••••••••"}
        required={!user}
      />

      <Input
        label={user ? (user.hasPin ? "PIN 4 dígitos (cambiar o dejar vacío)" : "PIN 4 dígitos (opcional)") : "PIN 4 dígitos (opcional)"}
        name="pin"
        type="text"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        value={formData.pin}
        onChange={handleChange}
        placeholder={user?.hasPin ? "•••• (ya tiene PIN)" : "Ej: 1234"}
      />
      {user?.hasPin && <small style={{color:'var(--color-text-secondary)', marginTop:-8, display:'block'}}>Este usuario ya tiene PIN configurado. Ingresa uno nuevo para cambiarlo o deja vacío para mantenerlo.</small>}
      {!user?.hasPin && <small style={{color:'var(--color-text-secondary)', marginTop:-8, display:'block'}}>Opcional: código rápido de 4 números para entrar sin usuario/contraseña. Cada PIN debe ser único en el sistema.</small>}
      {user?.hasPin && (
        <button
          type="button"
          onClick={() => {
            if (confirm('¿Quitar PIN de este usuario? Podrá seguir entrando con usuario/contraseña.')) {
              onSubmit({ pin: '' });
            }
          }}
          style={{ fontSize: '12px', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          Quitar PIN actual
        </button>
      )}
      
      <div className="form-group">
        <label className="form-label">Rol</label>
        <select
          name="rol"
          value={formData.rol}
          onChange={handleChange}
          className="form-select"
          required
        >
          <option value="cajero">Vendedor</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      
      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="activo"
            checked={formData.activo}
            onChange={handleChange}
          />
          <span>Usuario activo</span>
        </label>
      </div>
      
      <div className="form-actions">
        <Button type="submit" variant="primary">
          {user ? 'Actualizar' : 'Crear'} Usuario
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
