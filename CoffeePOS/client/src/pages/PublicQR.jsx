import { QrCode, Smartphone, ArrowRight } from 'lucide-react';
import QRCode from 'qrcode.react';

export default function PublicQR() {
  const registrationUrl = window.location.origin + '/registro-cliente';

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
      padding: '50px',
      borderRadius: '24px',
      maxWidth: '600px',
      width: '100%',
      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      textAlign: 'center'
    },
    header: {
      marginBottom: '40px'
    },
    headerIcon: {
      color: '#667eea',
      marginBottom: '20px'
    },
    title: {
      fontSize: '2rem',
      color: '#1a1a1a',
      marginBottom: '10px'
    },
    subtitle: {
      color: '#666',
      fontSize: '1.1rem'
    },
    qrDisplay: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: '40px',
      padding: '30px',
      background: '#f9fafb',
      borderRadius: '16px'
    },
    instructions: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      marginBottom: '40px',
      textAlign: 'left'
    },
    instructionStep: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      padding: '20px',
      background: '#f9fafb',
      borderRadius: '12px'
    },
    instructionIcon: {
      color: '#667eea',
      flexShrink: 0
    },
    instructionTitle: {
      fontSize: '1.1rem',
      color: '#1a1a1a',
      marginBottom: '5px'
    },
    instructionText: {
      color: '#666',
      fontSize: '0.95rem',
      margin: 0
    },
    manualLink: {
      paddingTop: '30px',
      borderTop: '2px solid #f0f0f0'
    },
    manualText: {
      color: '#666',
      fontSize: '14px',
      marginBottom: '10px'
    },
    link: {
      color: '#667eea',
      textDecoration: 'none',
      fontWeight: '600',
      fontSize: '16px',
      wordBreak: 'break-all'
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <QrCode size={64} style={styles.headerIcon} />
          <h1 style={styles.title}>Escanea para Registrarte</h1>
          <p style={styles.subtitle}>Obtén tu tarjeta de lealtad digital</p>
        </div>

        <div style={styles.qrDisplay}>
          <QRCode 
            value={registrationUrl}
            size={256}
            level="H"
            includeMargin={true}
          />
        </div>

        <div style={styles.instructions}>
          <div style={styles.instructionStep}>
            <Smartphone size={32} style={styles.instructionIcon} />
            <div>
              <h3 style={styles.instructionTitle}>1. Escanea este QR</h3>
              <p style={styles.instructionText}>Usa la cámara de tu celular</p>
            </div>
          </div>
          <div style={styles.instructionStep}>
            <ArrowRight size={32} style={styles.instructionIcon} />
            <div>
              <h3 style={styles.instructionTitle}>2. Regístrate</h3>
              <p style={styles.instructionText}>Llena tus datos en el formulario</p>
            </div>
          </div>
          <div style={styles.instructionStep}>
            <QrCode size={32} style={styles.instructionIcon} />
            <div>
              <h3 style={styles.instructionTitle}>3. Obtén tu QR</h3>
              <p style={styles.instructionText}>Descarga tu tarjeta de lealtad</p>
            </div>
          </div>
        </div>

        <div style={styles.manualLink}>
          <p style={styles.manualText}>O visita directamente:</p>
          <a href={registrationUrl} style={styles.link}>{registrationUrl}</a>
        </div>
      </div>
    </div>
  );
}
