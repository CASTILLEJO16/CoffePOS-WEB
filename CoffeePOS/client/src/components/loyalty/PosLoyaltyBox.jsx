import { useEffect, useRef, useState, useCallback } from 'react';
import { QrCode, Camera, X, Gift, Star, Percent } from 'lucide-react';
import Swal from 'sweetalert2';
import CameraQrScanner from './CameraQrScanner.jsx';
import { getCardByQRToken, redeemReward } from '../../services/loyaltyService.js';
import { getCustomerByPhone } from '../../services/customerService.js';
import { getAvailableRewards, pickAutoReward } from '../../utils/loyaltyRewards.js';
import { formatCurrency } from '../../utils/formatCurrency.js';

const TOKEN_RE = /[a-f0-9]{32}/i;

/** Extrae el token de lo que haya leído el escáner (o null). */
export function extractToken(text) {
  const m = String(text || '').match(TOKEN_RE);
  return m ? m[0].toLowerCase() : null;
}

// Si hay dos cajas montadas (panel + carrito móvil), solo la última abierta escucha el lector
const scannerStack = [];
let nextId = 1;

function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/** Recompensas que puede usar la tarjeta (las calcula el servidor; respaldo local por si acaso). */
function rewardsOf(card, config) {
  if (Array.isArray(card?.recompensas)) return card.recompensas;
  return config ? getAvailableRewards(card, config) : [];
}

/**
 * Caja de lealtad del POS.
 * Flujo: el cliente muestra su QR → se escanea → la tarjeta queda ligada a la orden
 * → si tiene un descuento disponible se aplica solo → al cobrar, el servidor cobra
 * con el descuento y agrega el sello.
 *
 * Formas de identificar al cliente:
 *  - Lector QR USB/Bluetooth: funciona aunque el campo no tenga el foco.
 *  - Cámara del dispositivo (botón de cámara).
 *  - Escribir el teléfono y presionar Enter (si olvidó su tarjeta).
 */
export default function PosLoyaltyBox({
  card,
  onCardChange,
  reward,
  onRewardChange,
  discountAmount = 0,
  rewardNote = null,
  config,
  onAddProduct,
  onCustomerName,
  showToast,
  disabled
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const busyRef = useRef(false);
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = nextId++;

  const notify = useCallback((msg, type = 'success', ms) => {
    if (showToast) showToast(msg, type, ms);
  }, [showToast]);

  const attach = useCallback((c) => {
    onCardChange(c);
    const nombre = c?.customerId?.nombre;
    if (nombre && onCustomerName) onCustomerName(nombre);

    const available = rewardsOf(c, config);
    const auto = pickAutoReward(available);
    if (auto && onRewardChange) onRewardChange(auto);

    const faltan = Math.max(0, (c.sellos_requeridos || 0) - (c.sellos_actuales || 0));
    let msg = `Tarjeta de ${nombre || 'cliente'}: ${c.sellos_actuales}/${c.sellos_requeridos} sellos`;
    if (auto) msg += ` · ${auto.description} aplicado`;
    else if (available.length > 0) msg += ' · ¡tiene recompensa!';
    else if (faltan > 0) msg += ` · le faltan ${faltan}`;
    notify(msg, 'success', 4000);
  }, [onCardChange, onCustomerName, onRewardChange, config, notify]);

  const resolve = useCallback(async (raw) => {
    const text = String(raw || '').trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      let token = extractToken(text);
      if (!token) {
        const digits = text.replace(/\D/g, '');
        if (digits.length < 10) {
          notify('Escanea el QR de la tarjeta o escribe un teléfono de 10 dígitos', 'error');
          return;
        }
        const res = await getCustomerByPhone(digits);
        token = res?.data?.loyaltyCardId?.qr_token;
        if (!token) {
          notify('Ese cliente no tiene tarjeta de lealtad', 'error');
          return;
        }
      }
      const res = await getCardByQRToken(token);
      if (res?.success && res.data) {
        attach(res.data);
        setInput('');
      } else {
        notify(res?.message || 'Tarjeta no encontrada', 'error');
      }
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.message
        || (status === 404 ? 'Tarjeta o cliente no encontrado' : 'No se pudo leer la tarjeta');
      notify(msg, 'error');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [attach, notify]);

  // Lector USB/Bluetooth: "teclea" muy rápido y termina con Enter.
  // Lo capturamos aunque el foco no esté en el campo (solo si no se está escribiendo en otro campo).
  useEffect(() => {
    if (disabled) return;
    const myId = idRef.current;
    scannerStack.push(myId);
    let buffer = '';
    let last = 0;
    const onKey = (e) => {
      if (scannerStack[scannerStack.length - 1] !== myId) return;
      if (isEditable(document.activeElement)) return;
      if (document.querySelector('.swal2-container')) return; // hay un diálogo abierto
      const now = Date.now();
      const inBurst = buffer.length > 0 && now - last <= 80; // lector: teclas casi instantáneas
      if (!inBurst) buffer = ''; // humano tecleando: reiniciar
      last = now;
      if (e.key === 'Enter') {
        const token = extractToken(buffer);
        buffer = '';
        if (token) {
          // Que el Enter del lector NO dispare el atajo "Enter = Cobrar" del POS
          e.preventDefault();
          e.stopImmediatePropagation();
          resolve(token);
        }
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
        // Los caracteres del lector no deben activar atajos (1/2/3 = método de pago)
        if (inBurst) e.stopImmediatePropagation();
      }
    };
    // Fase de captura: se ejecuta antes que los atajos de teclado del POS
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const idx = scannerStack.lastIndexOf(myId);
      if (idx >= 0) scannerStack.splice(idx, 1);
    };
  }, [resolve, disabled]);

  const handleChange = (value) => {
    setInput(value);
    // Algunos lectores no mandan Enter: si ya llegó un token completo, buscarlo
    if (extractToken(value)) resolve(value);
  };

  const applyReward = (r) => {
    if (r.type === 'free' && r.product_id && onAddProduct) {
      const added = onAddProduct(r.product_id);
      if (added === false) {
        notify('No encontré el producto de la recompensa en el menú (¿está inactivo?)', 'error');
        return;
      }
    }
    onRewardChange(r);
  };

  // Recompensa sin producto ligado: el cajero la entrega y la registra con "Canjear"
  const redeemManual = async (r) => {
    const confirm = await Swal.fire({
      title: '¿Canjear recompensa?',
      html: `Entrega <b>${r.description}</b> a <b>${card?.customerId?.nombre || 'el cliente'}</b>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, canjear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981'
    });
    if (!confirm.isConfirmed) return;
    try {
      setLoading(true);
      const res = await redeemReward({ loyaltyCardId: card._id, rewardKey: r.key });
      if (res?.success) {
        onCardChange({ ...card, ...res.data, customerId: card.customerId });
        notify(res.message || 'Recompensa canjeada', 'success');
      } else {
        notify(res?.message || 'No se pudo canjear', 'error');
      }
    } catch (error) {
      notify(error.response?.data?.message || 'No se pudo canjear', 'error');
    } finally {
      setLoading(false);
    }
  };

  const available = card ? rewardsOf(card, config) : [];
  const others = available.filter(r => r.key !== reward?.key);

  const box = {
    border: '1px solid #d1fae5', background: '#ecfdf5', borderRadius: 10,
    padding: '10px 12px', fontSize: 13, color: '#065f46'
  };
  const pill = {
    marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
    borderRadius: 8, padding: '6px 8px'
  };
  const smallBtn = (bg) => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 6,
    padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap'
  });

  return (
    <div className="pos-loyalty-box" style={{ marginBottom: 15 }}>
      {card ? (
        <div style={box}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={18} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {card.customerId?.nombre || 'Cliente'}
              </div>
              <div>
                {card.sellos_actuales}/{card.sellos_requeridos} sellos · <b>+1 sello al cobrar</b>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onCardChange(null)}
              title="Quitar tarjeta de esta orden"
              aria-label="Quitar tarjeta"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#065f46' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Recompensa aplicada a esta orden */}
          {reward && (
            <div style={{ ...pill, background: discountAmount > 0 ? '#d1fae5' : '#fef3c7', color: discountAmount > 0 ? '#065f46' : '#92400e' }}>
              {reward.type === 'discount' ? <Percent size={16} /> : <Gift size={16} />}
              <span style={{ flex: 1 }}>
                <b>{reward.description}</b>
                {discountAmount > 0
                  ? <> · −{formatCurrency(discountAmount)}</>
                  : <> · {rewardNote || 'No aplica a esta orden'}</>}
              </span>
              <button
                type="button"
                onClick={() => onRewardChange(null)}
                title="No usar ahora (se guarda para otra compra)"
                style={smallBtn('#6b7280')}
              >
                Quitar
              </button>
            </div>
          )}

          {/* Otras recompensas disponibles */}
          {others.map(r => (
            <div key={r.key} style={{ ...pill, background: '#fef3c7', color: '#92400e' }}>
              {r.type === 'discount' ? <Percent size={16} /> : <Gift size={16} />}
              <span style={{ flex: 1 }}>
                {r.description}
                {r.key === 'main' && r.count > 1 ? ` (${r.count})` : ''}
              </span>
              {r.type === 'manual' ? (
                <button type="button" onClick={() => redeemManual(r)} disabled={loading} style={smallBtn('#f59e0b')}>
                  Canjear
                </button>
              ) : (
                <button type="button" onClick={() => applyReward(r)} disabled={loading} style={smallBtn('#10b981')}>
                  Aplicar
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <QrCode size={18} />
          <input
            type="text"
            inputMode="text"
            placeholder="Escanea la tarjeta o escribe el teléfono"
            className="form-input"
            value={input}
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); resolve(input); } }}
            style={{ flex: 1, padding: '10px', fontSize: '14px' }}
          />
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            disabled={disabled}
            title="Escanear con la cámara"
            aria-label="Escanear con la cámara"
            className="btn btn-secondary"
            style={{ padding: '8px 10px' }}
          >
            <Camera size={18} />
          </button>
          {loading && <span style={{ fontSize: 12 }}>Buscando…</span>}
        </div>
      )}
      {showCamera && (
        <CameraQrScanner
          onDetect={(text) => { setShowCamera(false); resolve(text); }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

/**
 * Mensaje para el cajero tras cobrar (resultado del sello automático).
 */
export function loyaltyResultToast(result, showToast) {
  if (!result || !showToast) return;
  if (result.stamped) {
    showToast(result.message, 'success', result.rewardUnlocked || result.tierUnlocked ? 6000 : 4000);
  } else {
    showToast(`Venta cobrada, pero sin sello: ${result.message}`, 'error', 6000);
  }
}
