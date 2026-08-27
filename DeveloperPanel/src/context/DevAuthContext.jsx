import { createContext, useContext, useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';

const DevAuthContext = createContext();

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos de inactividad

export function DevAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('dev_token'));
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('dev_user');
    return u ? JSON.parse(u) : null;
  });
  const idleTimerRef = useRef(null);

  const logout = (reason = null) => {
    localStorage.removeItem('dev_token');
    localStorage.removeItem('dev_user');
    setToken(null);
    setUser(null);

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    if (reason === 'idle') {
      Swal.fire({
        icon: 'warning',
        title: 'Sesión Cerrada por Inactividad',
        text: 'Tu sesión en el Panel de Desarrollador ha finalizado por falta de actividad.',
        confirmButtonColor: '#5c4033'
      }).then(() => {
        window.location.href = '/login';
      });
    } else if (reason === 'expired') {
      Swal.fire({
        icon: 'error',
        title: 'Token Expirado',
        text: 'Tu sesión de desarrollador ha caducado. Inicia sesión nuevamente.',
        confirmButtonColor: '#5c4033'
      }).then(() => {
        window.location.href = '/login';
      });
    }
  };

  const resetIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (token) {
      idleTimerRef.current = setTimeout(() => {
        logout('idle');
      }, IDLE_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    if (!token) return;

    resetIdleTimer();

    const activityEvents = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    const handleActivity = () => resetIdleTimer();

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    const handleForceDevLogout = () => logout('expired');
    window.addEventListener('dev-force-logout', handleForceDevLogout);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('dev-force-logout', handleForceDevLogout);
    };
  }, [token]);

  const login = (newToken, newUser) => {
    localStorage.setItem('dev_token', newToken);
    localStorage.setItem('dev_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    resetIdleTimer();
  };

  const value = {
    token,
    user,
    isAuthenticated: !!token,
    login,
    logout: () => logout(null)
  };

  return (
    <DevAuthContext.Provider value={value}>
      {children}
    </DevAuthContext.Provider>
  );
}

export function useDevAuth() {
  const context = useContext(DevAuthContext);
  if (!context) {
    throw new Error('useDevAuth must be used within a DevAuthProvider');
  }
  return context;
}
