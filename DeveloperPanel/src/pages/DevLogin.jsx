import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, User, Lock, Eye, EyeOff, ShieldAlert, Loader, LogIn, Sun, Moon } from 'lucide-react';
import Swal from 'sweetalert2';
import { useTheme } from '../context/ThemeContext.jsx';
import { useDevAuth } from '../context/DevAuthContext.jsx';
import licenseService from '../services/licenseService.js';
import './DevLogin.css';

export default function DevLogin() {
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { login: authLogin } = useDevAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!usuario.trim() || !contraseña.trim()) {
      setError('Por favor ingresa tu usuario y contraseña');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await licenseService.login(usuario.trim(), contraseña.trim());
      const data = response.data?.data;

      if (data && data.token) {
        authLogin(data.token, data.user);

        Swal.fire({
          icon: 'success',
          title: '¡Acceso Autorizado!',
          text: `Bienvenido al Panel de Desarrollador, ${data.user?.nombre || usuario}.`,
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          navigate('/');
        });
      } else {
        throw new Error('Respuesta de autenticación no válida');
      }
    } catch (err) {
      console.error('Error en DevLogin:', err);
      const msg = err.response?.data?.error || err.response?.data?.message || 'Usuario o contraseña incorrectos';
      setError(msg);
      Swal.fire({
        icon: 'error',
        title: 'Acceso Denegado',
        text: msg,
        confirmButtonColor: '#5c4033'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dev-login-container">
      <div className="dev-login-bg-decoration" />
      
      <div className="dev-login-card">
        <div className="dev-login-header">
          <div className="dev-login-logo">
            <Coffee size={36} />
          </div>
          <h1 className="dev-login-title">Coffee POS</h1>
          <p className="dev-login-subtitle">Panel de Desarrollador - Acceso Seguro</p>
        </div>

        <form className="dev-login-form" onSubmit={handleLogin}>
          <div className="input-field-group">
            <label>Usuario Desarrollador / Admin</label>
            <div className="input-icon-wrapper">
              <User size={18} className="input-left-icon" />
              <input
                type="text"
                className="dev-input"
                placeholder="Ingresa tu usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="input-field-group">
            <label>Contraseña</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-left-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="dev-input"
                placeholder="Ingresa tu contraseña"
                value={contraseña}
                onChange={(e) => setContraseña(e.target.value)}
                required
              />
              <button
                type="button"
                className="input-right-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="dev-login-error">
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary dev-login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={20} className="animate-spin" />
                Autenticando...
              </>
            ) : (
              <>
                <LogIn size={20} />
                Iniciar Sesión Dev
              </>
            )}
          </button>
        </form>

        <div className="dev-login-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            type="button"
            title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <p>Coffee POS &copy; {new Date().getFullYear()} — Acceso Restringido</p>
        </div>
      </div>
    </div>
  );
}
