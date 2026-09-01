import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function LicenseCheck({ children }) {
  const [loading, setLoading] = useState(true);
  const [hasLicense, setHasLicense] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkLicense();
    // Re-verificar cada 2 minutos y al enfocar ventana
    const interval = setInterval(checkLicense, 2 * 60 * 1000);
    const onFocus = () => checkLicense();
    window.addEventListener('focus', onFocus);
    const onLicenseExpired = () => {
      localStorage.removeItem('license_key');
      localStorage.removeItem('license_data');
      localStorage.removeItem('device_activated');
      navigate('/activate');
    };
    window.addEventListener('force-logout', onLicenseExpired);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('force-logout', onLicenseExpired);
    };
  }, []);

  const checkLicense = async () => {
    const licenseKey = localStorage.getItem('license_key');
    const deviceId = localStorage.getItem('device_id');
    const deviceActivated = localStorage.getItem('device_activated');

    // Si no hay licencia o dispositivo no activado, redirigir a activación
    if (!licenseKey || !deviceId || deviceActivated !== 'true') {
      setLoading(false);
      setHasLicense(false);
      navigate('/activate');
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const base = apiUrl.replace(/\/api\/?$/, '');
      const verifyUrl = `${apiUrl}/licencias/public/verify`;
      // Verificar licencia con el backend
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          licenseKey: licenseKey,
          deviceId: deviceId
        })
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setHasLicense(true);
        setLoading(false);
      } else {
        // Licencia inválida, expirada o bloqueada
        localStorage.removeItem('license_key');
        localStorage.removeItem('license_data');
        localStorage.removeItem('device_activated');
        
        Swal.fire({
          icon: 'error',
          title: 'Licencia Inválida',
          text: data.message || data.reason || 'Tu licencia no es válida o ha expirado. Contacta al desarrollador.',
          confirmButtonText: 'Entendido'
        }).then(() => {
          navigate('/activate');
        });
      }
    } catch (err) {
      console.error('Error verificando licencia:', err);
      // En caso de error de conexión, permitir acceso temporalmente pero reintentar
      setHasLicense(true);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1.5rem',
        color: 'var(--color-text-secondary)'
      }}>
        Verificando licencia...
      </div>
    );
  }

  if (!hasLicense) {
    return null;
  }

  return children;
}
