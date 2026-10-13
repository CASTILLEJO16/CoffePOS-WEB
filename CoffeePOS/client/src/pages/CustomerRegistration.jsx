import { useState } from 'react';
import { QrCode, User, Phone, Mail, CheckCircle } from 'lucide-react';
import { publicRegisterCustomer } from '../services/customerService.js';
import Swal from 'sweetalert2';
import './CustomerRegistration.css';

export default function CustomerRegistration() {
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [registeredCard, setRegisteredCard] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre.trim() || !formData.telefono.trim()) {
      Swal.fire('Error', 'Nombre y teléfono son requeridos', 'warning');
      return;
    }

    try {
      setLoading(true);
      const response = await publicRegisterCustomer(formData);
      
      if (response.success) {
        setRegisteredCard(response.data.loyaltyCard);
        Swal.fire({
          title: '¡Registro Exitoso!',
          text: 'Tu tarjeta de lealtad ha sido creada',
          icon: 'success'
        });
      } else {
        Swal.fire('Error', response.message || 'Error al registrar', 'error');
      }
    } catch (error) {
      console.error('Error registering:', error);
      Swal.fire('Error', 'Error al registrar cliente', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!registeredCard?.qr_code) return;
    
    const link = document.createElement('a');
    link.href = registeredCard.qr_code;
    link.download = `mi-tarjeta-lealtad-${registeredCard.customer?.nombre || 'cliente'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    Swal.fire({
      title: '¡QR Guardado!',
      text: 'Guarda esta imagen en tu galería. Muéstrala en la cafetería para acumular sellos.',
      icon: 'success'
    });
  };

  if (registeredCard) {
    return (
      <div className="customer-registration-page">
        <div className="registration-success">
          <div className="success-icon">
            <CheckCircle size={64} />
          </div>
          <h1>¡Tarjeta de Lealtad Creada!</h1>
          <p className="customer-name">{registeredCard.customer?.nombre}</p>
          
          <div className="loyalty-card-display">
            <div className="card-visual">
              <div className="card-header">
                <h2>Programa de Lealtad</h2>
                <span className="status activa">Activa</span>
              </div>
              
              <div className="customer-info">
                <User size={20} />
                <span>{registeredCard.customer?.nombre}</span>
              </div>

              <div className="stamps-container">
                <div className="stamps-grid">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="stamp-slot">
                      {i < registeredCard.sellos_actuales && <CheckCircle size={24} />}
                    </div>
                  ))}
                </div>
                <div className="progress-text">
                  {registeredCard.sellos_actuales} de 10 sellos
                </div>
              </div>

              <div className="qr-display">
                {registeredCard.qr_code && <img src={registeredCard.qr_code} alt="QR Code" />}
              </div>
            </div>
          </div>

          <div className="success-actions">
            <button onClick={downloadQR} className="btn btn-primary btn-large">
              <QrCode size={24} /> Guardar QR en Fotos
            </button>
            <p className="instructions">
              <strong>Instrucciones:</strong>
              <br />
              1. Guarda esta imagen en tu galería
              <br />
              2. Muéstrala en la cafetería para acumular sellos
              <br />
              3. Cada 10 sellos obtienes una recompensa gratis
              <br />
              4. Para ver tu progreso, regresa e ingresa tu teléfono
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-registration-page">
      <div className="registration-container">
        <div className="registration-header">
          <QrCode size={48} />
          <h1>Regístrate en el Programa de Lealtad</h1>
          <p>Completa tus datos para obtener tu tarjeta digital</p>
        </div>

        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-group">
            <label>
              <User size={18} />
              Nombre Completo *
            </label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Tu nombre completo"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Phone size={18} />
              Teléfono *
            </label>
            <input
              type="tel"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="Tu número de teléfono"
              required
            />
          </div>

          <div className="form-group">
            <label>
              <Mail size={18} />
              Email (opcional)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
            {loading ? 'Registrando...' : 'Crear Tarjeta de Lealtad'}
          </button>
        </form>

        <div className="registration-info">
          <h3>¿Cómo funciona?</h3>
          <ul>
            <li>📱 Escanea tu QR en cada visita</li>
            <li>⭐ Acumula 1 sello por compra</li>
            <li>🎁 Con 10 sellos obtienes una recompensa gratis</li>
            <li>🔄 Tu tarjeta se reinicia automáticamente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
