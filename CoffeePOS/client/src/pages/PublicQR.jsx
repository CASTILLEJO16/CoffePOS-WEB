import { QrCode, Smartphone, ArrowRight } from 'lucide-react';
import QRCode from 'qrcode.react';
import './PublicQR.css';

export default function PublicQR() {
  const registrationUrl = window.location.origin + '/registro-cliente';

  return (
    <div className="public-qr-page">
      <div className="qr-container">
        <div className="qr-header">
          <QrCode size={64} />
          <h1>Escanea para Registrarte</h1>
          <p>Obtén tu tarjeta de lealtad digital</p>
        </div>

        <div className="qr-display">
          <QRCode 
            value={registrationUrl}
            size={256}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="instructions">
          <div className="instruction-step">
            <Smartphone size={32} />
            <div>
              <h3>1. Escanea este QR</h3>
              <p>Usa la cámara de tu celular</p>
            </div>
          </div>
          <div className="instruction-step">
            <ArrowRight size={32} />
            <div>
              <h3>2. Regístrate</h3>
              <p>Llena tus datos en el formulario</p>
            </div>
          </div>
          <div className="instruction-step">
            <QrCode size={32} />
            <div>
              <h3>3. Obtén tu QR</h3>
              <p>Descarga tu tarjeta de lealtad</p>
            </div>
          </div>
        </div>

        <div className="manual-link">
          <p>O visita directamente:</p>
          <a href={registrationUrl} className="link">{registrationUrl}</a>
        </div>
      </div>
    </div>
  );
}
