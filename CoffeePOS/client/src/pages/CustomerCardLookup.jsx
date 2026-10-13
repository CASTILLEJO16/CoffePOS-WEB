import { useState } from 'react';
import { QrCode, Search, User, Phone, CheckCircle, Download } from 'lucide-react';
import { publicLookupCustomer } from '../services/customerService.js';
import Swal from 'sweetalert2';
import './CustomerCardLookup.css';

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

  return (
    <div className="customer-lookup-page">
      <div className="lookup-container">
        <div className="lookup-header">
          <QrCode size={48} />
          <h1>Consulta tu Tarjeta de Lealtad</h1>
          <p>Ingresa tu teléfono para ver tu progreso</p>
        </div>

        <form onSubmit={handleSearch} className="lookup-form">
          <div className="form-group">
            <label>
              <Phone size={18} />
              Número de Teléfono
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Tu número de teléfono"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
            {loading ? 'Buscando...' : <><Search size={20} /> Consultar Tarjeta</>}
          </button>
        </form>

        {card && (
          <div className="card-display">
            <div className="card-visual">
              <div className="card-header">
                <h2>Programa de Lealtad</h2>
                <span className={`status ${card.estado}`}>{card.estado}</span>
              </div>
              
              <div className="customer-info">
                <User size={20} />
                <span>{card.customer?.nombre}</span>
              </div>

              <div className="stamps-container">
                <div className="stamps-grid">
                  {[...Array(card.sellos_requeridos)].map((_, i) => (
                    <div key={i} className={`stamp-slot ${i < card.sellos_actuales ? 'earned' : ''}`}>
                      {i < card.sellos_actuales && <CheckCircle size={24} />}
                    </div>
                  ))}
                </div>
                <div className="progress-text">
                  {card.sellos_actuales} de {card.sellos_requeridos} sellos
                </div>
              </div>

              {card.recompensas_disponibles > 0 && (
                <div className="reward-available">
                  🎁 ¡{card.recompensas_disponibles} recompensa(s) disponible(s)!
                </div>
              )}

              <div className="qr-display">
                {card.qr_code && <img src={card.qr_code} alt="QR Code" />}
              </div>
            </div>

            <button onClick={downloadQR} className="btn btn-secondary btn-large">
              <Download size={20} /> Descargar QR
            </button>
          </div>
        )}

        <div className="lookup-info">
          <h3>¿No tienes tarjeta?</h3>
          <p>Regístrate en el programa de lealtad para empezar a acumular sellos.</p>
          <a href="/registro-cliente" className="link">Registrarme ahora</a>
        </div>
      </div>
    </div>
  );
}
