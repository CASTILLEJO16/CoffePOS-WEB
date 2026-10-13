import { useState } from 'react';
import { QrCode, Search, User, Phone, CheckCircle, Download } from 'lucide-react';
import { publicLookupCustomer } from '../services/customerService.js';
import Swal from 'sweetalert2';

export default function CustomerCardLookup() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      Swal.fire('Error', 'Ingresa tu número de teléfono', 'warning');
      return;
    }

    try {
      setLoading(true);
      const response = await publicLookupCustomer(phone.trim());
      
      if (response.success && response.data.loyaltyCard) {
        setCard(response.data.loyaltyCard);
      } else {
        Swal.fire('No encontrado', 'Cliente no encontrado o sin tarjeta de lealtad', 'warning');
        setCard(null);
      }
    } catch (error) {
      console.error('Error searching:', error);
      Swal.fire('Error', 'Error al buscar cliente', 'error');
      setCard(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    if (!card?.qr_code) return;
    
    const link = document.createElement('a');
    link.href = card.qr_code;
    link.download = `mi-tarjeta-lealtad-${card.customer?.nombre || 'cliente'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      gap: '20px',
      marginBottom: '30px'
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
    buttonSecondary: {
      background: '#666',
      color: 'white'
    },
    cardDisplay: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
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
      textTransform: 'uppercase'
    },
    statusActiva: {
      background: 'rgba(16, 185, 129, 0.2)',
      color: '#10b981'
    },
    statusBloqueada: {
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444'
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
    stampSlotEarned: {
      background: 'rgba(255,255,255,0.3)',
      borderStyle: 'solid',
      borderColor: '#10b981'
    },
    progressText: {
      textAlign: 'center',
      fontSize: '1.2rem',
      fontWeight: '600'
    },
    rewardAvailable: {
      background: 'rgba(16, 185, 129, 0.2)',
      border: '2px solid #10b981',
      borderRadius: '12px',
      padding: '15px',
      fontWeight: '600',
      marginBottom: '25px'
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
    info: {
      paddingTop: '30px',
      borderTop: '2px solid #f0f0f0',
      textAlign: 'center'
    },
    infoTitle: {
      fontSize: '1.1rem',
      color: '#1a1a1a',
      marginBottom: '10px'
    },
    infoText: {
      color: '#666',
      fontSize: '14px',
      marginBottom: '15px'
    },
    link: {
      color: '#667eea',
      textDecoration: 'none',
      fontWeight: '600',
      fontSize: '16px'
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <QrCode size={48} style={styles.headerIcon} />
          <h1 style={styles.title}>Consulta tu Tarjeta de Lealtad</h1>
          <p style={styles.subtitle}>Ingresa tu teléfono para ver tu progreso</p>
        </div>

        <form onSubmit={handleSearch} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>
              <Phone size={18} />
              Número de Teléfono
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Tu número de teléfono"
              required
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Buscando...' : <><Search size={20} /> Consultar Tarjeta</>}
          </button>
        </form>

        {card && (
          <div style={styles.cardDisplay}>
            <div style={styles.cardVisual}>
              <div style={styles.cardHeader}>
                <h2 style={styles.cardTitle}>Programa de Lealtad</h2>
                <span style={{...styles.status, ...(card.estado === 'activa' ? styles.statusActiva : styles.statusBloqueada)}}>{card.estado}</span>
              </div>
              
              <div style={styles.customerInfo}>
                <User size={20} />
                <span>{card.customer?.nombre}</span>
              </div>

              <div style={styles.stampsContainer}>
                <div style={styles.stampsGrid}>
                  {[...Array(card.sellos_requeridos)].map((_, i) => (
                    <div key={i} style={{...styles.stampSlot, ...(i < card.sellos_actuales ? styles.stampSlotEarned : {})}}>
                      {i < card.sellos_actuales && <CheckCircle size={24} />}
                    </div>
                  ))}
                </div>
                <div style={styles.progressText}>
                  {card.sellos_actuales} de {card.sellos_requeridos} sellos
                </div>
              </div>

              {card.recompensas_disponibles > 0 && (
                <div style={styles.rewardAvailable}>
                  🎁 ¡{card.recompensas_disponibles} recompensa(s) disponible(s)!
                </div>
              )}

              <div style={styles.qrDisplay}>
                {card.qr_code && <img src={card.qr_code} alt="QR Code" style={styles.qrImage} />}
              </div>
            </div>

            <button onClick={downloadQR} style={{...styles.button, ...styles.buttonSecondary}}>
              <Download size={20} /> Descargar QR
            </button>
          </div>
        )}

        <div style={styles.info}>
          <h3 style={styles.infoTitle}>¿No tienes tarjeta?</h3>
          <p style={styles.infoText}>Regístrate en el programa de lealtad para empezar a acumular sellos.</p>
          <a href="/registro-cliente" style={styles.link}>Registrarme ahora</a>
        </div>
      </div>
    </div>
  );
}
