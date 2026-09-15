import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, User, Lock, Sun, Moon, Hash, Delete, X, ArrowLeft } from 'lucide-react';
import { login, loginWithPin, saveToken, saveUser } from '../services/authService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { clearAuth } from '../services/authService.js';
import { useTheme } from '../context/ThemeContext.jsx';
import api from '../services/api.js';
import Input from '../components/common/Input.jsx';
import Button from '../components/common/Button.jsx';
import Swal from 'sweetalert2';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('password'); // 'password' | 'pin'
  const [usuario, setUsuario] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [tempUser, setTempUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const { theme, toggleTheme } = useTheme();

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await login(usuario, contraseña);
      if (!response || !response.token || !response.user) {
        const msg = 'Usuario o contraseña incorrectos';
        setError(msg);
        Swal.fire({ icon: 'error', title: 'Error de acceso', text: msg, confirmButtonText: 'Intentar de nuevo' });
        return;
      }

      // Verificar si debe cambiar contraseña
      if (response.mustChangePassword) {
        setTempToken(response.token);
        setTempUser(response.user);
        setShowChangePassword(true);
        Swal.fire({
          icon: 'warning',
          title: 'Contraseña Temporal',
          text: 'Debes cambiar tu contraseña en el primer inicio de sesión',
          confirmButtonText: 'Cambiar Contraseña'
        });
        return;
      }

      saveToken(response.token);
      saveUser(response.user);
      authLogin(response);
      const rol = response.user?.rol || response.user?.role;
      navigate(rol === 'admin' ? '/admin' : '/');
    } catch (err) {
      clearAuth();
      const msg = err.response?.data?.error || 'Usuario o contraseña incorrectos';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Error de acceso', text: msg, confirmButtonText: 'Intentar de nuevo' });
    } finally {
      setLoading(false);
    }
  }

  async function handlePinSubmit(e) {
    if (e) e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe ser 4 dígitos');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await loginWithPin(pin);
      if (!response || !response.token || !response.user) {
        const msg = 'PIN inválido';
        setError(msg);
        Swal.fire({ icon: 'error', title: 'PIN inválido', text: msg, confirmButtonText: 'Intentar de nuevo' });
        return;
      }
      saveToken(response.token);
      saveUser(response.user);
      authLogin(response);
      const rol = response.user?.rol || response.user?.role;
      navigate(rol === 'admin' ? '/admin' : '/');
    } catch (err) {
      clearAuth();
      const msg = err.response?.data?.error || 'PIN inválido';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'PIN inválido', text: msg, confirmButtonText: 'Intentar de nuevo' });
    } finally {
      setLoading(false);
    }
  }

  function handlePinInput(digit) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4) {
      // auto-submit opcional: comentar si prefieres botón
      // setTimeout(() => handlePinSubmit(), 200);
    }
  }

  function handlePinDelete() {
    setPin(prev => prev.slice(0, -1));
  }

  function handlePinClear() {
    setPin('');
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/change-password', {
        currentPassword: contraseña,
        newPassword: newPassword
      }, {
        headers: {
          Authorization: `Bearer ${tempToken}`
        }
      });

      if (response.data.success) {
        saveToken(tempToken);
        saveUser(tempUser);
        authLogin({ user: tempUser, token: tempToken });
        setShowChangePassword(false);
        setContraseña('');
        setNewPassword('');
        setConfirmPassword('');
        Swal.fire({
          icon: 'success',
          title: 'Contraseña Cambiada',
          text: 'Tu contraseña ha sido actualizada exitosamente',
          confirmButtonText: 'Continuar'
        });
        const rol = tempUser?.rol || tempUser?.role;
        navigate(rol === 'admin' ? '/admin' : '/');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al cambiar la contraseña';
      setError(msg);
      Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonText: 'Intentar de nuevo' });
    } finally {
      setLoading(false);
    }
  }

  function handleBackToLogin() {
    setShowChangePassword(false);
    setTempToken(null);
    setTempUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setContraseña('');
  }

  return (
    <div className="login-container">
      <div className="login-background-decoration" />
      <div className="login-card">
        {showChangePassword ? (
          <>
            <div className="login-header">
              <div className="login-logo">
                <Coffee size={48} className="login-logo-icon" />
              </div>
              <h1 className="login-title">Cambiar Contraseña</h1>
              <p className="login-subtitle">Debes cambiar tu contraseña temporal</p>
            </div>

            <form className="login-form" onSubmit={handleChangePassword}>
              <Input
                label="Contraseña Actual"
                type="password"
                icon={Lock}
                value={contraseña}
                onChange={(e) => setContraseña(e.target.value)}
                placeholder="Ingresa tu contraseña actual"
                required
              />
              <Input
                label="Nueva Contraseña"
                type="password"
                icon={Lock}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
              <Input
                label="Confirmar Nueva Contraseña"
                type="password"
                icon={Lock}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirma tu nueva contraseña"
                required
              />
              {error && <div className="login-error">{error}</div>}
              <div className="login-buttons">
                <Button
                  type="button"
                  variant="secondary"
                  size="large"
                  className="login-button"
                  onClick={handleBackToLogin}
                  disabled={loading}
                >
                  <ArrowLeft size={16} style={{ marginRight: '8px' }} />
                  Volver
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="large"
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? 'Cambiando...' : 'Cambiar Contraseña'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="login-header">
              <div className="login-logo">
                <Coffee size={48} className="login-logo-icon" />
              </div>
              <h1 className="login-title">Coffee POS</h1>
              <p className="login-subtitle">Inicia sesión en tu cuenta</p>
            </div>

            <div className="login-tabs">
              <button
                type="button"
                className={`login-tab ${mode === 'password' ? 'active' : ''}`}
                onClick={() => { setMode('password'); setError(''); }}
              >
                <User size={16} /> Usuario
              </button>
              <button
                type="button"
                className={`login-tab ${mode === 'pin' ? 'active' : ''}`}
                onClick={() => { setMode('pin'); setError(''); setPin(''); }}
              >
                <Hash size={16} /> PIN
              </button>
            </div>

            {mode === 'password' ? (
              <form className="login-form" onSubmit={handlePasswordSubmit}>
                <Input
                  label="Usuario"
                  type="text"
                  icon={User}
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  required
                />
                <Input
                  label="Contraseña"
                  type="password"
                  icon={Lock}
                  value={contraseña}
                  onChange={(e) => setContraseña(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required
                />
                {error && <div className="login-error">{error}</div>}
                <Button type="submit" variant="primary" size="large" className="login-button" disabled={loading}>
                  {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Button>
              </form>
            ) : (
              <form className="login-form" onSubmit={handlePinSubmit}>
                <div className="pin-display">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`}>
                      {pin[i] ? '•' : ''}
                    </div>
                  ))}
                </div>
                <div className="pin-hint">{pin.length === 4 ? 'Listo para entrar' : `Ingresa tu PIN de 4 dígitos (${pin.length}/4)`}</div>

                <div className="numpad">
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button
                      key={n}
                      type="button"
                      className="numpad-btn"
                      onClick={() => handlePinInput(String(n))}
                      disabled={loading}
                    >
                      {n}
                    </button>
                  ))}
                  <button type="button" className="numpad-btn numpad-action" onClick={handlePinClear} disabled={loading} title="Limpiar">
                    <X size={18} />
                  </button>
                  <button type="button" className="numpad-btn" onClick={() => handlePinInput('0')} disabled={loading}>0</button>
                  <button type="button" className="numpad-btn numpad-action" onClick={handlePinDelete} disabled={loading} title="Borrar">
                    <Delete size={18} />
                  </button>
                </div>

                {error && <div className="login-error">{error}</div>}

                <Button
                  type="submit"
                  variant="primary"
                  size="large"
                  className="login-button"
                  disabled={loading || pin.length !== 4}
                >
                  {loading ? 'Verificando...' : 'Entrar con PIN'}
                </Button>
              </form>
            )}
          </>
        )}

        <div className="login-footer">
          <button className="theme-toggle-btn" onClick={toggleTheme} type="button" title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}>
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <p className="login-hint"></p>
        </div>
      </div>
    </div>
  );
}
