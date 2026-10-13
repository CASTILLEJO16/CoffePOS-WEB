import { useState, useEffect } from 'react';
import { QrCode, Search, Plus, User, Award, Clock, X, Camera, CheckCircle } from 'lucide-react';
import { getCardByQRToken, addStamp, redeemReward, getLoyaltyConfig } from '../services/loyaltyService.js';
import { getCustomerByPhone } from '../services/customerService.js';
import Swal from 'sweetalert2';
import QRCode from 'qrcode.react';
import './LoyaltyCard.css';

export default function LoyaltyCard() {
  const [qrToken, setQrToken] = useState('');
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [config, setConfig] = useState(null);
  const [lastSaleId, setLastSaleId] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await getLoyaltyConfig();
      setConfig(response.data);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleQRScan = async (token) => {
    if (!token) return;
    setQrToken(token);
    setShowScanner(false);
    await loadCard(token);
  };

  const loadCard = async (token) => {
    try {
      setLoading(true);
      const response = await getCardByQRToken(token);
      if (response.success) {
        setCard(response.data);
      } else {
        Swal.fire('Error', response.message, 'error');
        setCard(null);
      }
    } catch (error) {
      console.error('Error loading card:', error);
      Swal.fire('Error', 'Error al cargar la tarjeta', 'error');
      setCard(null);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualPhone.trim()) {
      Swal.fire('Error', 'Ingresa un número de teléfono', 'warning');
      return;
    }
    try {
      setLoading(true);
      const response = await getCustomerByPhone(manualPhone.trim());
      if (response.success && response.data.loyaltyCard) {
        setCard(response.data.loyaltyCard);
        setQrToken(response.data.loyaltyCard.qr_token);
      } else {
        Swal.fire('No encontrado', 'Cliente no encontrado o sin tarjeta de lealtad', 'warning');
        setCard(null);
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      Swal.fire('Error', 'Error al buscar cliente', 'error');
      setCard(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStamp = async () => {
    if (!lastSaleId.trim()) {
      Swal.fire('Error', 'Ingresa el ID de la venta', 'warning');
      return;
    }
    try {
      const result = await Swal.fire({
        title: '¿Agregar sello?',
        text: `Agregar sello para ${card.customer?.nombre || 'cliente'}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, agregar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const response = await addStamp({
          qr_token: qrToken,
          venta_id: lastSaleId.trim()
        });

        if (response.success) {
          Swal.fire({
            title: '¡Éxito!',
            text: response.message,
            icon: 'success'
          });
          await loadCard(qrToken);
          setLastSaleId('');
        } else {
          Swal.fire('Error', response.message, 'error');
        }
      }
    } catch (error) {
      console.error('Error adding stamp:', error);
      Swal.fire('Error', 'Error al agregar sello', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemReward = async () => {
    try {
      const result = await Swal.fire({
        title: '¿Canjear recompensa?',
        text: `Canjear recompensa para ${card.customer?.nombre || 'cliente'}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, canjear',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const response = await redeemReward({
          loyaltyCardId: card._id,
          venta_id: lastSaleId.trim() || null,
          producto_recompensa: config?.rewardProduct || 'Café gratis'
        });

        if (response.success) {
          Swal.fire({
            title: '¡Recompensa canjeada!',
            text: response.message,
            icon: 'success'
          });
          await loadCard(qrToken);
        } else {
          Swal.fire('Error', response.message, 'error');
        }
      }
    } catch (error) {
      console.error('Error redeeming reward:', error);
      Swal.fire('Error', 'Error al canjear recompensa', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderStamps = () => {
    const stamps = [];
    const total = card?.sellos_requeridos || 10;
    const current = card?.sellos_actuales || 0;

    for (let i = 0; i < total; i++) {
      const isEarned = i < current;
      stamps.push(
        <div key={i} className={`stamp-slot ${isEarned ? 'earned' : ''}`}>
          {isEarned && <CheckCircle size={24} />}
        </div>
      );
    }
    return stamps;
  };

  return (
    <div className="loyalty-card-page">
      <div className="loyalty-header">
        <h1><QrCode size={32} /> Tarjeta de Lealtad</h1>
        <p>Escanea el código QR del cliente para agregar sellos</p>
      </div>

      <div className="loyalty-controls">
        <div className="search-section">
          <div className="search-inputs">
            <input
              type="text"
              placeholder="ID de venta para sello"
              value={lastSaleId}
              onChange={(e) => setLastSaleId(e.target.value)}
              className="sale-input"
            />
            <input
              type="text"
              placeholder="Buscar por teléfono"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              className="phone-input"
            />
            <button onClick={handleManualSearch} className="btn btn-secondary">
              <Search size={20} /> Buscar
            </button>
            <button onClick={() => setShowScanner(true)} className="btn btn-primary">
              <Camera size={20} /> Escanear QR
            </button>
          </div>
        </div>
      </div>

      {showScanner && (
        <div className="scanner-modal">
          <div className="scanner-content">
            <button onClick={() => setShowScanner(false)} className="close-btn">
              <X size={24} />
            </button>
            <h2>Escanea el código QR</h2>
            <input
              type="text"
              placeholder="O ingresa el código manualmente"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQRScan(e.target.value);
                }
              }}
              className="manual-qr-input"
            />
            <p className="scanner-hint">Usa un lector QR USB o escanea con cámara</p>
          </div>
        </div>
      )}

      {loading && <div className="loading">Cargando...</div>}

      {card && (
        <div className="card-display">
          <div className="card-visual">
            <div className="card-header">
              <h2>{config?.programName || 'Programa de Lealtad'}</h2>
              <span className={`status ${card.estado}`}>{card.estado}</span>
            </div>
            
            <div className="customer-info">
              <User size={20} />
              <span>{card.customer?.nombre || 'Cliente'}</span>
              <span className="phone">{card.customer?.telefono}</span>
            </div>

            <div className="stamps-container">
              <div className="stamps-grid">
                {renderStamps()}
              </div>
              <div className="progress-text">
                {card.sellos_actuales} de {card.sellos_requeridos} sellos
              </div>
            </div>

            {card.recompensas_disponibles > 0 && (
              <div className="reward-available">
                <Award size={24} />
                <span>¡{card.recompensas_disponibles} recompensa(s) disponible(s)!</span>
              </div>
            )}

            <div className="card-footer">
              <div className="qr-display">
                {card.qr_code && <img src={card.qr_code} alt="QR Code" />}
              </div>
              <div className="cycle-info">
                <Clock size={16} />
                <span>Ciclo {card.ciclo_actual}</span>
              </div>
            </div>
          </div>

          <div className="card-actions">
            {card.estado === 'activa' && (
              <>
                {card.sellos_actuales < card.sellos_requeridos && (
                  <button onClick={handleAddStamp} className="btn btn-primary btn-large">
                    <Plus size={20} /> Agregar Sello
                  </button>
                )}
                {card.recompensas_disponibles > 0 && (
                  <button onClick={handleRedeemReward} className="btn btn-success btn-large">
                    <Award size={20} /> Canjear Recompensa
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
