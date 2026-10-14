import { QrCode, Smartphone, ArrowRight } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useState, useEffect } from 'react';

export default function PublicQR() {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    // Obtener la URL base actual
    const baseUrl = window.location.origin;
    setQrUrl(`${baseUrl}/registro-cliente`);
  }, []);

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'var(--color-background)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    },
    container: {
      background: 'var(--color-surface)',
      padding: '50px',
      borderRadius: 'var(--border-radius-2xl)',
      maxWidth: '600px',
      width: '100%',
      boxShadow: 'var(--shadow-xl)',
      textAlign: 'center'
    },
    header: {
      marginBottom: '40px'
    },
    headerIcon: {
      color: 'var(--color-primary)',
      marginBottom: '20px'
    },
    title: {
      fontSize: '2rem',
      color: 'var(--color-text)',
      marginBottom: '10px'
    },
    subtitle: {
      color: 'var(--color-text-secondary)',
      fontSize: '1.1rem'
    },
    qrDisplay: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: '40px',
      padding: '30px',
      background: 'var(--color-surface-muted)',
      borderRadius: 'var(--border-radius-xl)'
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
      background: 'var(--color-surface-muted)',
      borderRadius: 'var(--border-radius-lg)'
    },
    instructionIcon: {
      color: 'var(--color-primary)',
      flexShrink: 0
    },
    instructionTitle: {
      fontSize: '1.1rem',
      color: 'var(--color-text)',
      marginBottom: '5px'
    },
    instructionText: {
      color: 'var(--color-text-secondary)',
      fontSize: '0.95rem',
      margin: 0
    },
    manualLink: {
      paddingTop: '30px',
      borderTop: '2px solid var(--color-border)'
    },
    manualText: {
      color: 'var(--color-text-secondary)',
      fontSize: '14px',
      marginBottom: '10px'
    },
    link: {
      color: 'var(--color-primary)',
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
          {qrUrl && (
<QRCodeCanvas 
  value={qrUrl} 
  size={200} 
  level="H"
  includeMargin={true}
/>
          )}
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
          <a href="/registro-cliente" style={styles.link}>{qrUrl || '/registro-cliente'}</a>
        </div>
      </div>
    </div>
  );
}
