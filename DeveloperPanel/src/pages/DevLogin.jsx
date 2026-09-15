import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, User, Lock, Eye, EyeOff, ShieldAlert, Loader, LogIn, Sun, Moon, KeyRound, ArrowLeft } from 'lucide-react';
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
  // flujo cambio contraseña obligatoria
  const [mustChange, setMustChange] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [tempUser, setTempUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
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
        // Si debe cambiar contraseña, mostrar formulario en lugar de entrar
        if (data.mustChangePassword || data.user?.mustChangePassword) {
          setTempToken(data.token);
          setTempUser(data.user);
          setMustChange(true);
          // guardar token temporal para que change-password pueda usarlo (interceptor lo leerá de tempToken)
          localStorage.setItem('dev_token', data.token);
          Swal.fire({
            icon: 'warning',
            title: 'Contraseña temporal',
            text: 'Debes cambiar tu contraseña antes de continuar. Usuario: lennyn / DevTemp2024!',
            confirmButtonColor: '#5c4033'
          });
          return;
        }

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      // El token ya está en localStorage (dev_token) y el interceptor lo envía
      await licenseService.changePassword(contraseña.trim(), newPassword);
      Swal.fire({
        icon: 'success',
        title: 'Contraseña actualizada',
        text: 'Tu contraseña ha sido cambiada. Ya puedes acceder al panel.',
        confirmButtonColor: '#5c4033'
      });
      // Login final con token existente
      authLogin(tempToken, tempUser);
      setMustChange(false);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Error al cambiar contraseña';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonColor: '#5c4033' });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMustChange(false);
    setTempToken(null);
    setTempUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    localStorage.removeItem('dev_token');
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
          <p className="dev-login-subtitle">{mustChange ? 'Cambio de contraseña obligatorio' : 'Panel de Desarrollador - Acceso Seguro'}</p>
        </div>

        {mustChange ? (
          <form className="dev-login-form" onSubmit={handleChangePassword}>
            <div className="input-field-group">
              <label>Contraseña actual (temporal)</label>
              <div className="input-icon-wrapper">
                <Lock size={18} className="input-left-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="dev-input"
                  placeholder="DevTemp2024!"
                  value={contraseña}
                  onChange={(e) => setContraseña(e.target.value)}
                  required
                />
                <button type="button" className="input-right-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="input-field-group">
              <label>Nueva contraseña</label>
              <div className="input-icon-wrapper">
                <KeyRound size={18} className="input-left-icon" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="dev-input"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button type="button" className="input-right-toggle" onClick={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="input-field-group">
              <label>Confirmar nueva contraseña</label>
              <div className="input-icon-wrapper">
                <KeyRound size={18} className="input-left-icon" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="dev-input"
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            {error && (
              <div className="dev-login-error">
                <ShieldAlert size={18} />
                <span>{error}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={handleBackToLogin} disabled={loading}>
                <ArrowLeft size={18} /> Volver
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '12px' }} disabled={loading}>
                {loading ? <><Loader size={18} className="animate-spin" /> Cambiando...</> : <><KeyRound size={18} /> Cambiar y entrar</>}
              </button>
            </div>
          </form>
        ) : (
          <form className="dev-login-form" onSubmit={handleLogin}>
            <div className="input-field-group">
              <label>Usuario Desarrollador</label>
              <div className="input-icon-wrapper">
                <User size={18} className="input-left-icon" />
                <input
                  type="text"
                  className="dev-input"
                  placeholder="lennyn"
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
        )}

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
