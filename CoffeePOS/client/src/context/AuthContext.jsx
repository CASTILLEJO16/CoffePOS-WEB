import { createContext, useContext, useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { getUser, clearAuth } from '../services/authService.js';

const AuthContext = createContext();

// Tiempo de inactividad permitido (15 minutos = 900,000 ms)
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef(null);

  const logout = (reason = null) => {
    clearAuth();
    setUser(null);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    if (reason === 'idle') {
      Swal.fire({
        icon: 'warning',
        title: 'Sesión Expirada por Inactividad',
        text: 'Tu sesión se ha cerrado por falta de actividad. Por favor inicia sesión nuevamente.',
        confirmButtonColor: '#5c4033'
      });
    } else if (reason === 'token_expired') {
      Swal.fire({
        icon: 'error',
        title: 'Sesión Expirada',
        text: 'Tu token de autenticación ha caducado. Inicia sesión para continuar.',
        confirmButtonColor: '#5c4033'
      });
    }
  };

  const resetIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (user) {
      idleTimerRef.current = setTimeout(() => {
        logout('idle');
      }, IDLE_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    // En Electron, iniciar sesión limpia si fuera necesario
    try {
      const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
      if (isElectron) {
        clearAuth();
      }
    } catch (_) {}

    const initialUser = getUser();
    if (initialUser) {
      setUser(initialUser);
    }
    setLoading(false);
  }, []);

  // Escuchar eventos de inactividad cuando hay un usuario autenticado
  useEffect(() => {
    if (!user) return;

    resetIdleTimer();

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    const handleUserActivity = () => resetIdleTimer();

    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    // Escuchar el evento personalizado de deslogueo forzado por interceptor (401/403)
    const handleForceLogout = () => logout('token_expired');
    window.addEventListener('force-logout', handleForceLogout);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      window.removeEventListener('force-logout', handleForceLogout);
    };
  }, [user]);

  const login = (userData) => {
    setUser(userData.user);
    resetIdleTimer();
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout: () => logout(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
