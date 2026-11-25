import { useState, useEffect } from 'react';
import { QrCode, Search, Plus, User, Award, Clock, X, Download, CheckCircle, Filter, Settings, Trash2, Plus as Add, Camera, UserX, UserCheck } from 'lucide-react';
import { getCardByQRToken, addStamp, redeemReward, getLoyaltyConfig, getAllLoyaltyCards, updateLoyaltyConfig } from '../services/loyaltyService.js';
import { getCustomerByPhone, setCustomerStatus, deleteCustomer } from '../services/customerService.js';
import { getProducts } from '../services/productService.js';
import CameraQrScanner from '../components/loyalty/CameraQrScanner.jsx';
import { extractToken } from '../components/loyalty/PosLoyaltyBox.jsx';
import LoyaltyCardGenerator from '../components/LoyaltyCardGenerator.jsx';
import Swal from 'sweetalert2';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext.jsx';
import './LoyaltyCard.css';

export default function LoyaltyCard() {
  const { user } = useAuth();
  // Solo el admin puede configurar el programa (el backend también lo exige)
  const isAdmin = user?.rol === 'admin' || user?.role === 'admin';
  const [qrToken, setQrToken] = useState('');
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [config, setConfig] = useState(null);
  const [lastSaleId, setLastSaleId] = useState('');
  const [allCards, setAllCards] = useState([]);
  const [showAllCards, setShowAllCards] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [menuProducts, setMenuProducts] = useState([]);
  const [configForm, setConfigForm] = useState({
    enabled: true,
    programName: 'Programa de Lealtad',
    stampsRequired: 10,
    minPurchase: 0,
    rewardProduct: 'Café gratis',
    rewardProductId: ''
  });
  const [generatedCardImage, setGeneratedCardImage] = useState(null);
  const [businessName, setBusinessName] = useState('Mi Cafetería');

  useEffect(() => {
    loadConfig();
    loadAllCards();
    // Obtener businessName de localStorage
    const savedBusinessName = localStorage.getItem('businessName');
    if (savedBusinessName) {
      setBusinessName(savedBusinessName);
    }
  }, []);

  const loadConfig = async () => {
    try {
      const response = await getLoyaltyConfig();
      setConfig(response.data);
      setConfigForm({
        enabled: response.data.enabled,
        programName: response.data.programName,
        stampsRequired: response.data.stampsRequired,
        minPurchase: response.data.minPurchase,
        rewardProduct: response.data.rewardProduct,
        rewardProductId: response.data.rewardProductId || ''
      });
      setRewards(response.data.rewards || []);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const loadAllCards = async () => {
    try {
      setLoading(true);
      const response = await getAllLoyaltyCards(searchTerm);
      if (response.success) {
        setAllCards(response.data);
      }
    } catch (error) {
      console.error('Error loading all cards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCards();
  }, [searchTerm]);

  useEffect(() => {
    if (!showConfigModal || menuProducts.length > 0) return;
    getProducts()
      .then(list => setMenuProducts((list || []).filter(p => p && p._id && !p.isPromotion && !p.isCombo)))
      .catch(() => setMenuProducts([]));
  }, [showConfigModal]);

  const handleQRScan = async (raw) => {
    const token = extractToken(raw);
    setShowScanner(false);
    setShowCamera(false);
    if (!token) {
      Swal.fire('Código inválido', 'Ese código no es una tarjeta de lealtad', 'warning');
      return;
    }
    setQrToken(token);
    await loadCard(token);
    setShowAllCards(false);
  };

  const loadCard = async (token) => {
    try {
      setLoading(true);
      const response = await getCardByQRToken(token);
      if (response.success) {
        setCard(response.data);
        setShowAllCards(false);
      } else {
        Swal.fire('Error', response.message, 'error');
        setCard(null);
      }
    } catch (error) {
      console.error('Error loading card:', error);
      Swal.fire('Error', error.response?.data?.message || 'Error al cargar la tarjeta', 'error');
      setCard(null);
    } finally {
      setLoading(false);
    }
  };

  const selectCard = (selectedCard) => {
    setCard(selectedCard);
    setQrToken(selectedCard.qr_token);
    setShowAllCards(false);
  };

  const handleManualSearch = async () => {
    if (!manualPhone.trim()) {
      Swal.fire('Error', 'Ingresa un número de teléfono', 'warning');
      return;
    }
    try {
      setLoading(true);
      const response = await getCustomerByPhone(manualPhone.trim());
      const foundCard = response.success ? response.data?.loyaltyCardId : null;
      if (foundCard?.qr_token) {
        setCard({ ...foundCard, customerId: response.data });
        setQrToken(foundCard.qr_token);
        setShowAllCards(false);
        // Datos completos + imagen del QR (solo si la tarjeta está activa)
        try {
          const qrResponse = await getCardByQRToken(foundCard.qr_token);
          if (qrResponse.success) setCard(qrResponse.data);
        } catch { /* tarjeta bloqueada: se muestra con los datos básicos */ }
      } else {
        Swal.fire('No encontrado', 'Cliente no encontrado o sin tarjeta de lealtad', 'warning');
        setCard(null);
      }
    } catch (error) {
      console.error('Error searching customer:', error);
      const notFound = error.response?.status === 404;
      Swal.fire(notFound ? 'No encontrado' : 'Error', notFound ? 'No hay cliente con ese teléfono' : 'Error al buscar cliente', notFound ? 'warning' : 'error');
      setCard(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStamp = async () => {
    if (!lastSaleId.trim()) {
      Swal.fire('Falta el número de venta', 'Escribe el número de venta que aparece en el ticket (ej. 130). En el POS el sello se agrega solo al cobrar.', 'warning');
      return;
    }
    try {
      const result = await Swal.fire({
        title: '¿Agregar sello?',
        text: `Agregar sello a ${card.customerId?.nombre || 'cliente'} por la venta #${lastSaleId.trim().replace(/^#/, '')}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, agregar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const response = await addStamp({
          loyaltyCardId: card._id,
          numero_venta: lastSaleId.trim()
        });

        if (response.success) {
          Swal.fire({
            title: '¡Éxito!',
            text: response.message,
            icon: 'success'
          });
          await loadCard(qrToken);
          await loadAllCards();
          setLastSaleId('');
        } else {
          Swal.fire('Error', response.message, 'error');
        }
      }
    } catch (error) {
      console.error('Error adding stamp:', error);
      Swal.fire('No se agregó el sello', error.response?.data?.message || 'Error al agregar sello', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemReward = async () => {
    try {
      const result = await Swal.fire({
        title: '¿Canjear recompensa?',
        text: `Canjear recompensa para ${card.customerId?.nombre || 'cliente'}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, canjear',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        setLoading(true);
        const response = await redeemReward({
          loyaltyCardId: card._id,
          producto_recompensa: config?.rewardProduct || 'Café gratis'
        });

        if (response.success) {
          Swal.fire({
            title: '¡Recompensa canjeada!',
            text: response.message,
            icon: 'success'
          });
          await loadCard(qrToken);
          await loadAllCards();
        } else {
          Swal.fire('Error', response.message, 'error');
        }
      }
    } catch (error) {
      console.error('Error redeeming reward:', error);
      Swal.fire('Error', error.response?.data?.message || 'Error al canjear recompensa', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = async () => {
    if (!card || !card.qr_token) return;

    // Usar la imagen generada si existe, si no generarla
    if (generatedCardImage) {
      try {
        const link = document.createElement('a');
        link.href = generatedCardImage;
        link.download = `tarjeta-${card.customerId?.nombre?.replace(/\s+/g, '-') || 'cliente'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.fire({
          title: '¡Descargado!',
          text: 'La tarjeta se ha descargado correctamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        console.error('Error downloading QR:', error);
        Swal.fire('Error', 'Error al descargar la tarjeta', 'error');
      }
    } else {
      // Fallback al QR simple
      try {
        const link = document.createElement('a');
        link.href = card.qr_code;
        link.download = `tarjeta-${card.customerId?.nombre?.replace(/\s+/g, '-') || 'cliente'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Swal.fire({
          title: '¡Descargado!',
          text: 'El QR se ha descargado correctamente',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        console.error('Error downloading QR:', error);
        Swal.fire('Error', 'Error al descargar el QR', 'error');
      }
    }
  };

  const handleToggleStatus = async () => {
    const customerId = card?.customerId?._id;
    if (!customerId) return;
    const darDeBaja = card.estado === 'activa';
    const result = await Swal.fire({
      title: darDeBaja ? '¿Dar de baja a este cliente?' : '¿Reactivar a este cliente?',
      text: darDeBaja
        ? 'Su tarjeta queda bloqueada: no recibe sellos ni puede canjear. Se conserva su historial y puedes reactivarlo después.'
        : 'Su tarjeta vuelve a estar activa con los sellos que tenía.',
      icon: darDeBaja ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: darDeBaja ? 'Sí, dar de baja' : 'Sí, reactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: darDeBaja ? '#f59e0b' : '#10b981'
    });
    if (!result.isConfirmed) return;
    try {
      setLoading(true);
      const response = await setCustomerStatus(customerId, !darDeBaja);
      setCard({ ...card, estado: response.data?.loyaltyCard?.estado || (darDeBaja ? 'bloqueada' : 'activa') });
      await loadAllCards();
      Swal.fire({ title: response.message, icon: 'success', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'No se pudo cambiar el estado', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    const customerId = card?.customerId?._id;
    if (!customerId) return;
    const nombre = card.customerId?.nombre || 'este cliente';
    const result = await Swal.fire({
      title: `¿Eliminar a ${nombre}?`,
      html: 'Se borran <b>definitivamente</b> el cliente, su tarjeta, sus sellos y recompensas. Las ventas no se tocan.<br><br>Esto no se puede deshacer. Si solo quieres que deje de usarla, mejor <b>dale de baja</b>.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      input: 'text',
      inputPlaceholder: 'Escribe ELIMINAR para confirmar',
      inputValidator: (v) => (v || '').trim().toUpperCase() === 'ELIMINAR' ? undefined : 'Escribe ELIMINAR para confirmar'
    });
    if (!result.isConfirmed) return;
    try {
      setLoading(true);
      const response = await deleteCustomer(customerId);
      setCard(null);
      setShowAllCards(true);
      await loadAllCards();
      Swal.fire({ title: response.message || 'Cliente eliminado', icon: 'success', timer: 1800, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'No se pudo eliminar', 'error');
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

  const renderCardsList = () => {
    if (allCards.length === 0) {
      return (
        <div className="empty-state">
          <p>No hay tarjetas de lealtad registradas</p>
        </div>
      );
    }

    return (
      <div className="cards-grid">
        {allCards.map((cardItem) => (
          <div
            key={cardItem._id}
            className="card-item"
            onClick={() => selectCard(cardItem)}
          >
            <div className="card-item-header">
              <User size={20} />
              <span className="customer-name">{cardItem.customerId?.nombre || 'Cliente'}</span>
              <span className={`status-badge ${cardItem.estado}`}>{cardItem.estado}</span>
            </div>
            <div className="card-item-info">
              <span className="phone">{cardItem.customerId?.telefono}</span>
              <span className="stamps">{cardItem.sellos_actuales}/{cardItem.sellos_requeridos} sellos</span>
            </div>
            {cardItem.recompensas_disponibles > 0 && (
              <div className="rewards-badge">
                <Award size={16} />
                <span>{cardItem.recompensas_disponibles} recompensa(s)</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      const response = await updateLoyaltyConfig({
        ...configForm,
        rewards: rewards
      });

      if (response.success) {
        Swal.fire({
          title: '¡Configuración Guardada!',
          text: 'La configuración del programa de lealtad ha sido actualizada',
          icon: 'success'
        });
        await loadConfig();
        setShowConfigModal(false);
      } else {
        Swal.fire('Error', response.message, 'error');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      Swal.fire('No se guardó', error.response?.data?.message || 'Error al guardar configuración', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addReward = () => {
    const req = Number(configForm.stampsRequired) || 10;
    const stamps = Math.max(1, Math.min(req - 1, Math.floor(req / 2)));
    setRewards([...rewards, { stamps, type: 'discount', value: 10, description: '10% de descuento' }]);
  };

  const removeReward = (index) => {
    setRewards(rewards.filter((_, i) => i !== index));
  };

  const updateReward = (index, field, value) => {
    const updatedRewards = rewards.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    setRewards(updatedRewards);
  };

  const downloadPublicQR = () => {
    const baseUrl = window.location.origin;
    // El QR incluye la cafetería para que los clientes se registren en la correcta
    const cafeId = user?.clientId;
    if (!cafeId) {
      Swal.fire('Error', 'No se pudo identificar la cafetería. Vuelve a iniciar sesión.', 'error');
      return;
    }
    const qrUrl = `${baseUrl}/qr-publico?c=${encodeURIComponent(cafeId)}`;

    // Crear un canvas temporal para generar el QR
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, qrUrl, { width: 400, margin: 2 }, (error) => {
      if (error) {
        console.error(error);
        Swal.fire('Error', 'Error al generar QR', 'error');
        return;
      }

      // Descargar el QR como imagen
      const link = document.createElement('a');
      link.download = 'qr-registro-clientes.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.fire({
        title: '¡QR Descargado!',
        text: 'Este QR es para que los clientes se registren. Imprímelo y colócalo visible.',
        icon: 'success',
        timer: 3000,
        showConfirmButton: false
      });
    });
  };

  return (
    <div className="loyalty-card-page">
      <div className="loyalty-header">
        <h1><QrCode size={32} /> Tarjeta de Lealtad</h1>
        <p>Gestiona las tarjetas de lealtad de tus clientes</p>
      </div>

      <div className="loyalty-controls">
        <div className="search-section">
          <div className="search-inputs">
            <input
              type="text"
              placeholder="Buscar cliente por nombre o teléfono"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button onClick={() => setShowAllCards(true)} className="btn btn-secondary">
              <Filter size={20} /> Ver Todos
            </button>
            {isAdmin && (
              <button onClick={() => setShowConfigModal(true)} className="btn btn-secondary">
                <Settings size={20} /> Configurar
              </button>
            )}
            <button onClick={downloadPublicQR} className="btn btn-primary">
              <Download size={20} /> QR Registro
            </button>
          </div>
        </div>
      </div>

      {showConfigModal && (
        <div className="config-modal">
          <div className="config-content">
            <div className="config-header">
              <h2>Configurar Programa de Lealtad</h2>
              <button onClick={() => setShowConfigModal(false)} className="close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="config-form">
              <div className="form-group">
                <label>Nombre del Programa</label>
                <input
                  type="text"
                  value={configForm.programName}
                  onChange={(e) => setConfigForm({...configForm, programName: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Estado</label>
                <select
                  value={configForm.enabled}
                  onChange={(e) => setConfigForm({...configForm, enabled: e.target.value === 'true'})}
                >
                  <option value="true">Activado</option>
                  <option value="false">Desactivado</option>
                </select>
              </div>

              <div className="form-group">
                <label>Sellos Requeridos para Recompensa Principal</label>
                <input
                  type="number"
                  value={configForm.stampsRequired}
                  min="1"
                  onChange={(e) => setConfigForm({...configForm, stampsRequired: Math.max(1, parseInt(e.target.value) || 1)})}
                />
              </div>

              <div className="form-group">
                <label>Compra Mínima para Sello ($)</label>
                <input
                  type="number"
                  value={configForm.minPurchase}
                  onChange={(e) => setConfigForm({...configForm, minPurchase: parseFloat(e.target.value)})}
                />
              </div>

              <div className="form-group">
                <label>Recompensa al completar la tarjeta</label>
                <input
                  type="text"
                  value={configForm.rewardProduct}
                  onChange={(e) => setConfigForm({...configForm, rewardProduct: e.target.value})}
                />
                <select
                  value={configForm.rewardProductId || ''}
                  onChange={(e) => setConfigForm({...configForm, rewardProductId: e.target.value})}
                  style={{ marginTop: 6 }}
                >
                  <option value="">Sin producto ligado (el cajero lo entrega con "Canjear")</option>
                  {menuProducts.map(p => (
                    <option key={p._id} value={p._id}>{p.nombre} — se descuenta su precio al cobrar</option>
                  ))}
                </select>
              </div>

              <div className="rewards-section">
                <div className="rewards-header">
                  <h3>Recompensas por nivel <small style={{ fontWeight: 400, fontSize: 12, opacity: 0.75 }}>(se usan una vez por tarjeta, en la compra siguiente a llegar a esos sellos)</small></h3>
                  <button onClick={addReward} className="btn btn-sm btn-primary">
                    <Add size={16} /> Agregar
                  </button>
                </div>

                {rewards.map((reward, index) => (
                  <div key={index} className="reward-item">
                    <div className="reward-fields">
                      <div className="reward-field">
                        <label>Al llegar a (sellos)</label>
                        <input
                          type="number"
                          min="1"
                          max={Math.max(1, (Number(configForm.stampsRequired) || 10) - 1)}
                          value={reward.stamps}
                          onChange={(e) => updateReward(index, 'stamps', parseInt(e.target.value))}
                        />
                      </div>
                      <div className="reward-field">
                        <label>Tipo</label>
                        <select
                          value={reward.type}
                          onChange={(e) => updateReward(index, 'type', e.target.value)}
                        >
                          <option value="discount">Descuento %</option>
                          <option value="free">Producto Gratis</option>
                        </select>
                      </div>
                      {reward.type === 'free' ? (
                        <div className="reward-field">
                          <label>Producto</label>
                          <select
                            value={reward.product_id || ''}
                            onChange={(e) => updateReward(index, 'product_id', e.target.value || null)}
                          >
                            <option value="">Lo entrega el cajero (Canjear)</option>
                            {menuProducts.map(p => (
                              <option key={p._id} value={p._id}>{p.nombre}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="reward-field">
                          <label>Descuento %</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={reward.value}
                            onChange={(e) => updateReward(index, 'value', parseFloat(e.target.value))}
                          />
                        </div>
                      )}
                      <div className="reward-field">
                        <label>Descripción</label>
                        <input
                          type="text"
                          value={reward.description}
                          onChange={(e) => updateReward(index, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                    <button onClick={() => removeReward(index)} className="btn btn-sm btn-danger">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="config-actions">
                <button onClick={() => setShowConfigModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button onClick={handleSaveConfig} className="btn btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAllCards ? (
        <div className="cards-list-container">
          {loading ? (
            <div className="loading">Cargando tarjetas...</div>
          ) : (
            renderCardsList()
          )}
        </div>
      ) : (
        <>
          <div className="back-button">
            <button onClick={() => setShowAllCards(true)} className="btn btn-secondary">
              <X size={20} /> Volver a la lista
            </button>
          </div>

          <div className="loyalty-controls">
            <div className="search-section">
              <div className="search-inputs">
                <input
                  type="text"
                  placeholder="No. de venta del ticket (ej. 130)"
                  inputMode="numeric"
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
                  <QrCode size={20} /> Lector QR
                </button>
                <button onClick={() => setShowCamera(true)} className="btn btn-primary">
                  <Camera size={20} /> Cámara
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
                <h2>Ingresar Código QR</h2>
                <p className="scanner-hint">Usa un lector QR USB o ingresa el código manualmente</p>
                <input
                  type="text"
                  placeholder="Código QR del cliente"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleQRScan(e.target.value);
                    }
                  }}
                  className="manual-qr-input"
                />
              </div>
            </div>
          )}

          {showCamera && (
            <CameraQrScanner onDetect={handleQRScan} onClose={() => setShowCamera(false)} />
          )}

          {loading && <div className="loading">Cargando...</div>}

          {card && (
            <div className="card-display">
              {/* Generador de tarjeta con diseño (oculto) */}
              <LoyaltyCardGenerator
                customer={card.customerId}
                qrToken={card.qr_token}
                businessName={businessName}
                stamps={card.sellos_actuales}
                required={card.sellos_requeridos}
                onImageGenerated={setGeneratedCardImage}
              />

              <div className="card-visual">
                <div className="card-header">
                  <h2>{config?.programName || 'Programa de Lealtad'}</h2>
                  <span className={`status ${card.estado}`}>{card.estado}</span>
                </div>

                <div className="customer-info">
                  <User size={20} />
                  <span>{card.customerId?.nombre || 'Cliente'}</span>
                  <span className="phone">{card.customerId?.telefono}</span>
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

                <div className="download-section">
                  <button onClick={handleDownloadQR} className="btn btn-primary">
                    <Download size={20} /> Descargar Tarjeta
                  </button>
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
                {card.estado !== 'activa' && (
                  <div className="card-inactive-note" style={{ color: '#b45309', fontWeight: 600 }}>
                    Cliente dado de baja: no recibe sellos ni puede canjear.
                  </div>
                )}
                {isAdmin && card.customerId?._id && (
                  <div className="admin-customer-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button onClick={handleToggleStatus} className="btn btn-secondary" disabled={loading}>
                      {card.estado === 'activa'
                        ? <><UserX size={18} /> Dar de baja</>
                        : <><UserCheck size={18} /> Reactivar</>}
                    </button>
                    <button onClick={handleDeleteCustomer} className="btn btn-danger" disabled={loading}>
                      <Trash2 size={18} /> Eliminar cliente
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
