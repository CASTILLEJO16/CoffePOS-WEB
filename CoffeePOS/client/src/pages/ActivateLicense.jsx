import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, Key, CheckCircle, XCircle, Loader } from 'lucide-react';
import Swal from 'sweetalert2';
import Input from '../components/common/Input.jsx';
import Button from '../components/common/Button.jsx';
import { licenseService } from '../services/licenseService.js';
import './ActivateLicense.css';

export default function ActivateLicense() {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setError('Por favor ingresa la clave de licencia');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Generar un ID de dispositivo único
      const deviceId = localStorage.getItem('device_id') || generateDeviceId();
      localStorage.setItem('device_id', deviceId);

      // Información del dispositivo
      const deviceInfo = {
        deviceName: `${navigator.userAgent.split(')')[0].split('(')[1] || 'Unknown'}`,
        os: navigator.platform,
        browser: navigator.userAgent.split(')')[0].split('(')[0] || 'Unknown',
        ipAddress: await getIpAddress()
      };

      // Activar dispositivo
      const response = await licenseService.activateDevice({
        licenseKey: licenseKey.trim(),
        deviceId: deviceId,
        deviceInfo: deviceInfo
      });

      const data = response.data;

      if (response.data.success) {
        // Guardar licencia activada
        localStorage.setItem('license_key', licenseKey.trim());
        localStorage.setItem('license_data', JSON.stringify(data.data));
        localStorage.setItem('device_activated', 'true');

        Swal.fire({
          icon: 'success',
          title: '¡Licencia Activada!',
          text: 'Tu sistema ha sido activado correctamente. Inicia sesión con la cuenta de usuario y contraseña registrada.',
          confirmButtonText: 'Ir a Iniciar Sesión'
        }).then(() => {
          navigate('/login');
        });
      } else {
        setError(data.message || 'Error al activar la licencia');
        Swal.fire({
          icon: 'error',
          title: 'Error de Activación',
          text: data.message || 'No se pudo activar la licencia. Verifica la clave.',
          confirmButtonText: 'Intentar de nuevo'
        });
      }
    } catch (err) {
      console.error('Error activating license:', err);
      console.error('Response data:', err.response?.data);
      console.error('Status:', err.response?.status);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.response?.data?.msg || err.message || 'Error de conexión. Verifica tu conexión a internet.';
      const detail = err.response?.data?.error || err.response?.data?.message || '';
      const fullMessage = detail && detail !== errorMessage ? `${errorMessage} (${detail})` : errorMessage;
      setError(fullMessage);
      Swal.fire({
        icon: 'error',
        title: 'Error de Activación',
        text: fullMessage,
        confirmButtonText: 'Intentar de nuevo'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDeviceId = () => {
    return 'device_' + Math.random().toString(36).substr(2, 9) + Date.now();
  };

  const getIpAddress = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  };

  return (
    <div className="activate-license-container">
      <div className="activate-license-background-decoration" />
      <div className="activate-license-card">
        <div className="activate-license-header">
          <div className="activate-license-logo">
            <Coffee size={48} className="activate-license-logo-icon" />
          </div>
          <h1 className="activate-license-title">Coffee POS</h1>
          <p className="activate-license-subtitle">Activa tu sistema con tu licencia</p>
        </div>

        <form className="activate-license-form" onSubmit={handleActivate}>
          <Input
            label="Clave de Licencia"
            type="text"
            icon={Key}
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Ingresa tu clave de licencia"
            required
            autoFocus
          />

          {error && (
            <div className="activate-license-error">
              <XCircle size={18} />
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            variant="primary" 
            size="large" 
            className="activate-license-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={20} className="animate-spin" />
                Activando...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Activar Sistema
              </>
            )}
          </Button>
        </form>

        <div className="activate-license-footer">
          <p className="activate-license-hint">
            ¿No tienes una licencia? Contacta al desarrollador para obtener una.
          </p>
        </div>
      </div>
    </div>
  );
}
