import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { openCashRegister, getCashRegisterNames, getAllCashRegisters } from '../services/cashRegisterService.js';
import { formatBusinessDate, formatBusinessTime } from '../utils/dateTime.js';
import { Coffee, Clock, Calendar, User, DollarSign, FileText, Wallet } from 'lucide-react';
import './AperturaCaja.css';

export default function AperturaCaja() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.rol === 'admin' || user?.role === 'admin';
  // El vendedor vuelve al POS de vendedor ("/"), el admin al POS de admin.
  const destinoPostApertura = isAdmin ? '/admin/pos' : '/';

  const [currentTime, setCurrentTime] = useState(new Date());
  const [formData, setFormData] = useState({
    nombre_caja: '',
    fondo_inicial: '',
    observaciones: ''
  });
  const [cajas, setCajas] = useState([]);
  const [cajasEnUso, setCajasEnUso] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingCajas, setLoadingCajas] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    async function fetchCajas() {
      try {
        setLoadingCajas(true);
        const data = await getCashRegisterNames();
        setCajas(data || []);

        // Obtener cajas abiertas para bloquear en UI (puede fallar para vendedor sin permisos, se ignora)
        const abiertas = await fetchOpenCajas();
        setCajasEnUso(new Set(abiertas));
      } catch (err) {
        console.error("Error al cargar cajas", err);
        // Si es vendedor, no debe poder escribir manualmente, se quedará sin opciones
        setCajas([]);
      } finally {
        setLoadingCajas(false);
      }
    }
    fetchCajas();

    return () => clearInterval(timer);
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }

  async function fetchOpenCajas() {
    try {
      const data = await getAllCashRegisters({ estado: 'abierta' });
      return (data || []).map(c => c.nombre_caja);
    } catch {
      // Vendedor sin permiso para listar todas, backend valida en apertura si caja está en uso
      return [];
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // Vendedor debe seleccionar caja obligatoriamente
    if (!isAdmin && !formData.nombre_caja) {
      setError('Debes seleccionar una caja configurada por el administrador');
      return;
    }
    setLoading(true);

    try {
      const fondoInicial = parseFloat(formData.fondo_inicial) || 0;
      // Para admin sin selección se usa fallback, vendedor ya validado arriba
      const nombreCajaEnvio = formData.nombre_caja || (isAdmin ? `Caja ${user?.nombre}` : '');

      await openCashRegister({
        nombre_caja: nombreCajaEnvio,
        fondo_inicial: fondoInicial,
        observaciones: formData.observaciones
      });

      navigate(destinoPostApertura, { replace: true });
    } catch (err) {
      const message = err.response?.data?.error || 'Error al abrir la caja';

      // Si ya hay caja abierta, ir directo al POS correspondiente
      if (message.toLowerCase().includes('ya tiene una caja abierta')) {
        navigate(destinoPostApertura, { replace: true });
        return;
      }

      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="apertura-caja-page">
      <div className="apertura-caja-container">
        <div className="apertura-caja-header">
          <Coffee className="header-coffee-icon" size={48} strokeWidth={1.75} />
          <h1 className="apertura-title">Apertura de Caja</h1>
          <p className="apertura-subtitle">Registre el fondo inicial para comenzar su turno</p>
        </div>

        <div className="apertura-info-grid">
          <div className="info-card">
            <Calendar className="info-icon" size={20} />
            <div className="info-content">
              <span className="info-label">Fecha</span>
              <span className="info-value">{formatBusinessDate(currentTime)}</span>
            </div>
          </div>

          <div className="info-card">
            <Clock className="info-icon" size={20} />
            <div className="info-content">
              <span className="info-label">Hora (Tijuana)</span>
              <span className="info-value">{formatBusinessTime(currentTime)}</span>
            </div>
          </div>

          <div className="info-card">
            <User className="info-icon" size={20} />
            <div className="info-content">
              <span className="info-label">Vendedor</span>
              <span className="info-value">{user?.nombre}</span>
            </div>
          </div>
        </div>

        <form className="apertura-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <Wallet size={18} />
              Nombre de la Caja
            </label>
            {isAdmin ? (
              // Admin: si hay cajas configuradas muestra select, si no permite crear manual
              cajas.length > 0 ? (
                <select
                  name="nombre_caja"
                  className="form-input"
                  value={formData.nombre_caja}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccione una caja...</option>
                  {cajas.map(c => (
                    <option
                      key={c._id || c.id}
                      value={c.nombre}
                      disabled={cajasEnUso.has(c.nombre)}
                    >
                      {c.nombre} {cajasEnUso.has(c.nombre) ? '(En uso)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="nombre_caja"
                  className="form-input"
                  placeholder="Ej: Caja Principal, Caja 1, etc."
                  value={formData.nombre_caja}
                  onChange={handleChange}
                  required
                />
              )
            ) : (
              // Vendedor: siempre select, nunca input manual
              loadingCajas ? (
                <select className="form-input" disabled>
                  <option>Cargando cajas...</option>
                </select>
              ) : cajas.length > 0 ? (
                <select
                  name="nombre_caja"
                  className="form-input"
                  value={formData.nombre_caja}
                  onChange={handleChange}
                  required
                >
                  <option value="">Seleccione una caja...</option>
                  {cajas.map(c => (
                    <option
                      key={c._id || c.id}
                      value={c.nombre}
                      disabled={cajasEnUso.has(c.nombre)}
                    >
                      {c.nombre} {cajasEnUso.has(c.nombre) ? '(En uso)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="form-input" style={{ background: '#fff3cd', color: '#856404', borderColor: '#ffeeba' }}>
                  No hay cajas configuradas. Contacta al administrador.
                </div>
              )
            )}
            {!isAdmin && cajas.length === 0 && !loadingCajas && (
              <p className="help-text" style={{ color: '#856404', marginTop: 6 }}>
                El administrador debe crear las cajas en Configuración → Nombres de Cajas.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              <DollarSign size={18} />
              Fondo Inicial (Efectivo)
            </label>
            <div className="currency-input-wrapper">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                name="fondo_inicial"
                className="form-input currency-input"
                placeholder="0.00"
                step="0.01"
                min="0"
                value={formData.fondo_inicial}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <FileText size={18} />
              Observaciones (Opcional)
            </label>
            <textarea
              name="observaciones"
              className="form-textarea"
              placeholder="Notas adicionales sobre la apertura..."
              rows="3"
              value={formData.observaciones}
              onChange={handleChange}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={loading || (!isAdmin && cajas.length === 0)}
          >
            {loading ? 'Abriendo caja...' : 'Abrir Caja'}
          </button>
        </form>
      </div>
    </div>
  );
}
