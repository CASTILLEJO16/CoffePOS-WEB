import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

export default function LicenseCheck({ children }) {
  const [loading, setLoading] = useState(true);
  const [hasLicense, setHasLicense] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkLicense();
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
      // Verificar licencia con el backend
      const response = await fetch('http://localhost:3001/api/licencias/public/verify', {
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
          text: data.message || 'Tu licencia no es válida o ha expirado. Contacta al desarrollador.',
          confirmButtonText: 'Entendido'
        }).then(() => {
          navigate('/activate');
        });
      }
    } catch (err) {
      console.error('Error verificando licencia:', err);
      // En caso de error de conexión, permitir acceso temporalmente
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
