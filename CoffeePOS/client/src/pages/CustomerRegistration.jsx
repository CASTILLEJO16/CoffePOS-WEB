import { useState } from 'react';
import { QrCode, User, Phone, Mail, CheckCircle } from 'lucide-react';
import { publicRegisterCustomer } from '../services/customerService.js';
import Swal from 'sweetalert2';

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

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    },
    container: {
      background: 'white',
      padding: '40px',
      borderRadius: '20px',
      maxWidth: '500px',
      width: '100%',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
    },
    header: {
      textAlign: 'center',
      marginBottom: '30px'
    },
    headerIcon: {
      color: '#667eea',
      marginBottom: '15px'
    },
    title: {
      fontSize: '1.8rem',
      color: '#1a1a1a',
      marginBottom: '10px'
    },
    subtitle: {
      color: '#666',
      fontSize: '1rem'
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    label: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontWeight: '600',
      color: '#1a1a1a',
      fontSize: '14px'
    },
    input: {
      padding: '12px 16px',
      border: '2px solid #e0e0e0',
      borderRadius: '8px',
      fontSize: '16px'
    },
    button: {
      padding: '18px 36px',
      border: 'none',
      borderRadius: '8px',
      fontSize: '18px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      background: '#667eea',
      color: 'white'
    },
    info: {
      marginTop: '30px',
      paddingTop: '30px',
      borderTop: '2px solid #f0f0f0'
    },
    infoTitle: {
      fontSize: '1.1rem',
      color: '#1a1a1a',
      marginBottom: '15px'
    },
    infoList: {
      listStyle: 'none',
      padding: 0
    },
    infoItem: {
      padding: '8px 0',
      color: '#666',
      fontSize: '14px'
    },
    successContainer: {
      background: 'white',
      padding: '40px',
      borderRadius: '20px',
      maxWidth: '500px',
      width: '100%',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      textAlign: 'center'
    },
    successIcon: {
      color: '#10b981',
      marginBottom: '20px'
    },
    customerName: {
      fontSize: '1.3rem',
      color: '#667eea',
      fontWeight: '600',
      marginBottom: '30px'
    },
    cardVisual: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '20px',
      padding: '30px',
      color: 'white',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    cardTitle: {
      fontSize: '1.5rem',
      margin: 0
    },
    status: {
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      background: 'rgba(16, 185, 129, 0.2)',
      color: '#10b981'
    },
    customerInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '25px',
      fontSize: '1.1rem'
    },
    stampsContainer: {
      marginBottom: '25px'
    },
    stampsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '10px',
      marginBottom: '15px'
    },
    stampSlot: {
      width: '50px',
      height: '50px',
      border: '2px dashed rgba(255,255,255,0.5)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    progressText: {
      textAlign: 'center',
      fontSize: '1.2rem',
      fontWeight: '600'
    },
    qrDisplay: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: '20px'
    },
    qrImage: {
      width: '150px',
      height: '150px',
      background: 'white',
      padding: '15px',
      borderRadius: '12px'
    },
    successActions: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    instructions: {
      textAlign: 'left',
      color: '#666',
      fontSize: '14px',
      lineHeight: '1.8',
      padding: '20px',
      background: '#f9fafb',
      borderRadius: '8px'
    }
  };

  if (registeredCard) {
    return (
      <div style={styles.page}>
        <div style={styles.successContainer}>
          <div style={styles.successIcon}>
            <CheckCircle size={64} />
          </div>
          <h1>¡Tarjeta de Lealtad Creada!</h1>
          <p style={styles.customerName}>{registeredCard.customer?.nombre}</p>
          
          <div style={styles.cardVisual}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>Programa de Lealtad</h2>
              <span style={styles.status}>Activa</span>
            </div>
            
            <div style={styles.customerInfo}>
              <User size={20} />
              <span>{registeredCard.customer?.nombre}</span>
            </div>

            <div style={styles.stampsContainer}>
              <div style={styles.stampsGrid}>
                {[...Array(10)].map((_, i) => (
                  <div key={i} style={styles.stampSlot}>
                    {i < registeredCard.sellos_actuales && <CheckCircle size={24} />}
                  </div>
                ))}
              </div>
              <div style={styles.progressText}>
                {registeredCard.sellos_actuales} de 10 sellos
              </div>
            </div>

            <div style={styles.qrDisplay}>
              {registeredCard.qr_code && <img src={registeredCard.qr_code} alt="QR Code" style={styles.qrImage} />}
            </div>
          </div>

          <div style={styles.successActions}>
            <button onClick={downloadQR} style={styles.button}>
              <QrCode size={24} /> Guardar QR en Fotos
            </button>
            <p style={styles.instructions}>
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
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <QrCode size={48} style={styles.headerIcon} />
          <h1 style={styles.title}>Regístrate en el Programa de Lealtad</h1>
          <p style={styles.subtitle}>Completa tus datos para obtener tu tarjeta digital</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
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
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
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
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              <Mail size={18} />
              Email (opcional)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Registrando...' : 'Crear Tarjeta de Lealtad'}
          </button>
        </form>

        <div style={styles.info}>
          <h3 style={styles.infoTitle}>¿Cómo funciona?</h3>
          <ul style={styles.infoList}>
            <li style={styles.infoItem}>📱 Escanea tu QR en cada visita</li>
            <li style={styles.infoItem}>⭐ Acumula 1 sello por compra</li>
            <li style={styles.infoItem}>🎁 Con 10 sellos obtienes una recompensa gratis</li>
            <li style={styles.infoItem}>🔄 Tu tarjeta se reinicia automáticamente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
