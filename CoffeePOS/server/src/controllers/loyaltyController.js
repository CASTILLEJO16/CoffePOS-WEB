/**
 * Controlador de Tarjetas de Lealtad (Mongoose)
 * Gestión de tarjetas de lealtad, sellos y recompensas
 */

import LoyaltyCard from '../models/LoyaltyCard.js';
import Customer from '../models/Customer.js';
import StampHistory from '../models/StampHistory.js';
import Reward from '../models/Reward.js';
import Config from '../models/Config.js';
import Client from '../models/Client.js';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Product from '../models/Product.js';
import { syncGoogleCard, syncGoogleClass } from '../services/googleWalletService.js';
import {
  LoyaltyError,
  findCard,
  findSaleForStamp,
  stampCardForSale,
  revertStampForSale,
  cardSummary,
  getProgramConfig,
  redeemManualReward,
  availableRewardsForCard
} from '../services/loyaltyService.js';

// Obtener tarjeta por token QR
export const getCardByQRToken = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const card = await findCard({ clientId, qrToken: req.params.qr_token });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Código QR inválido o tarjeta no encontrada'
      });
    }

    if (card.estado !== 'activa') {
      return res.status(400).json({
        success: false,
        message: `La tarjeta está ${card.estado}`
      });
    }

    // Generar QR code data URL
    const qrCodeDataURL = await QRCode.toDataURL(card.qr_token);

    res.status(200).json({
      success: true,
      data: {
        ...card.toJSON(),
        qr_code: qrCodeDataURL,
        recompensas: await availableRewardsForCard(clientId, card)
      }
    });
  } catch (error) {
    console.error('Error al obtener tarjeta por QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar código QR',
      error: error.message
    });
  }
};

// Obtener tarjeta de un cliente
export const getCustomerCard = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { customerId } = req.params;

    const card = await LoyaltyCard.findOne({ 
      customerId, 
      clientId 
    }).populate('customerId');

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Tarjeta no encontrada para este cliente'
      });
    }

    const qrCodeDataURL = await QRCode.toDataURL(card.qr_token);

    res.status(200).json({
      success: true,
      data: {
        ...card.toJSON(),
        qr_code: qrCodeDataURL
      }
    });
  } catch (error) {
    console.error('Error al obtener tarjeta del cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tarjeta',
      error: error.message
    });
  }
};

// Agregar sello manual (desde la pantalla de Lealtad): el cajero escanea la tarjeta
// y escribe el número de venta del ticket (ej. 130). En el POS el sello es automático.
export const addStamp = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { qr_token, loyaltyCardId, venta_id, numero_venta } = req.body;

    const saleRef = numero_venta ?? venta_id;
    if (!saleRef || !String(saleRef).trim()) {
      return res.status(400).json({ success: false, message: 'Escribe el número de venta del ticket' });
    }
    const sale = await findSaleForStamp(clientId, saleRef);
    if (!sale) {
      return res.status(404).json({ success: false, message: `No existe la venta #${String(saleRef).replace(/^#/, '')}` });
    }

    const result = await stampCardForSale({
      clientId,
      sale,
      qrToken: qr_token,
      cardId: loyaltyCardId,
      empleadoId: req.user?.userId
    });

    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (error) {
    if (error instanceof LoyaltyError) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    }
    console.error('Error al agregar sello:', error);
    res.status(500).json({ success: false, message: 'Error al agregar sello' });
  }
};

// Canjear recompensa a mano (botón "Canjear"): para premios que el cajero entrega sin cobrarlos
// en una venta (producto sin ligar). Los descuentos y productos ligados se aplican al cobrar.
export const redeemReward = async (req, res) => {
  try {
    const { loyaltyCardId, qr_token, rewardKey } = req.body;
    const { card, customer, reward } = await redeemManualReward({
      clientId: req.user?.clientId,
      cardId: loyaltyCardId,
      qrToken: qr_token,
      rewardKey: rewardKey || 'main',
      empleadoId: req.user?.userId
    });
    const data = { ...card.toJSON(), customerId: customer };
    data.recompensas = await availableRewardsForCard(req.user?.clientId, card);
    res.status(200).json({ success: true, message: `Recompensa canjeada: ${reward.description}`, data });
  } catch (error) {
    if (error instanceof LoyaltyError) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    }
    console.error('Error al canjear recompensa:', error);
    res.status(500).json({ success: false, message: 'Error al canjear recompensa' });
  }
};

// Obtener historial de sellos de un cliente
export const getStampHistory = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { customerId } = req.params;

    const history = await StampHistory.find({ 
      customerId, 
      clientId 
    })
    .populate('venta_id')
    .populate('empleado_id', 'nombre')
    .sort({ fecha: -1 });

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error al obtener historial de sellos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  }
};

// Obtener recompensas canjeadas de un cliente
export const getRewards = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { customerId } = req.params;

    const rewards = await Reward.find({ 
      customerId, 
      clientId 
    })
    .populate('venta_id')
    .populate('empleado_id', 'nombre')
    .sort({ fecha_canje: -1 });

    res.status(200).json({
      success: true,
      data: rewards
    });
  } catch (error) {
    console.error('Error al obtener recompensas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recompensas',
      error: error.message
    });
  }
};

// Revertir sello de una venta (las cancelaciones/devoluciones ya lo hacen solas)
export const revertStamp = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { venta_id, numero_venta, motivo } = req.body;
    const sale = await findSaleForStamp(clientId, numero_venta ?? venta_id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Venta no encontrada' });
    }
    const result = await revertStampForSale({ clientId, saleId: sale._id, empleadoId: req.user?.userId, motivo });
    if (!result) {
      return res.status(404).json({ success: false, message: 'No hay sello vigente asociado a esta venta' });
    }
    res.status(200).json({ success: true, message: 'Sello revertido exitosamente', data: result });
  } catch (error) {
    console.error('Error al revertir sello:', error);
    res.status(500).json({ success: false, message: 'Error al revertir sello' });
  }
};

// Obtener configuración de lealtad
export const getLoyaltyConfig = async (req, res) => {
  try {
    const config = await getProgramConfig(req.user?.clientId);
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error('Error al obtener configuración de lealtad:', error);
    res.status(500).json({ success: false, message: 'Error al obtener configuración' });
  }
};

// Actualizar configuración de lealtad (solo admin). Valida todo: lo que se guarde aquí
// es lo que el POS cobra de verdad.
export const updateLoyaltyConfig = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { enabled, programName, minPurchase, rewardProduct, rewardProductId, rewards } = req.body;

    const stampsRequired = parseInt(req.body.stampsRequired, 10);
    if (!Number.isFinite(stampsRequired) || stampsRequired < 1 || stampsRequired > 100) {
      return res.status(400).json({ success: false, message: 'Los sellos requeridos deben ser entre 1 y 100' });
    }
    const min = Number(minPurchase) || 0;
    if (min < 0) return res.status(400).json({ success: false, message: 'La compra mínima no puede ser negativa' });

    const validProductId = async (id) => {
      if (!id) return null;
      if (!mongoose.Types.ObjectId.isValid(String(id))) return false;
      const p = await Product.findOne({ _id: id, clientId }).select('_id');
      return p ? String(p._id) : false;
    };

    const mainProductId = await validProductId(rewardProductId);
    if (mainProductId === false) {
      return res.status(400).json({ success: false, message: 'El producto de la recompensa principal no existe' });
    }

    // Niveles: validar uno por uno y darles un id estable (para saber cuáles ya usó cada cliente)
    const cleanTiers = [];
    const list = Array.isArray(rewards) ? rewards : [];
    for (const [i, r] of list.entries()) {
      const n = i + 1;
      const stamps = parseInt(r?.stamps, 10);
      const type = r?.type === 'free' ? 'free' : 'discount';
      const value = Number(r?.value) || 0;
      if (!Number.isFinite(stamps) || stamps < 1 || stamps >= stampsRequired) {
        return res.status(400).json({ success: false, message: `Recompensa ${n}: los sellos deben ser entre 1 y ${stampsRequired - 1} (con ${stampsRequired} se completa la tarjeta)` });
      }
      if (type === 'discount' && (value <= 0 || value > 100)) {
        return res.status(400).json({ success: false, message: `Recompensa ${n}: el descuento debe ser entre 1% y 100%` });
      }
      const productId = type === 'free' ? await validProductId(r?.product_id) : null;
      if (productId === false) {
        return res.status(400).json({ success: false, message: `Recompensa ${n}: el producto no existe` });
      }
      const id = typeof r?.id === 'string' && /^[a-z0-9_-]{4,40}$/i.test(r.id)
        ? r.id
        : 'r' + crypto.randomBytes(5).toString('hex');
      cleanTiers.push({
        id,
        stamps,
        type,
        value: type === 'discount' ? value : 0,
        product_id: productId,
        description: String(r?.description || '').trim().slice(0, 80)
          || (type === 'discount' ? `${value}% de descuento` : 'Producto gratis')
      });
    }
    const stampsUsed = new Set();
    for (const t of cleanTiers) {
      if (stampsUsed.has(t.stamps)) {
        return res.status(400).json({ success: false, message: `Hay dos recompensas en ${t.stamps} sellos. Deja solo una por nivel.` });
      }
      stampsUsed.add(t.stamps);
    }

    const configs = [
      { clave: 'loyalty_enabled', valor: String(enabled !== false) },
      { clave: 'loyalty_program_name', valor: String(programName || 'Programa de Lealtad').slice(0, 60) },
      { clave: 'loyalty_stamps_required', valor: String(stampsRequired) },
      { clave: 'loyalty_min_purchase', valor: String(min) },
      { clave: 'loyalty_reward_product', valor: String(rewardProduct || 'Café gratis').slice(0, 80) },
      { clave: 'loyalty_reward_product_id', valor: mainProductId || '' },
      { clave: 'loyalty_rewards', valor: JSON.stringify(cleanTiers) }
    ];
    for (const config of configs) {
      await Config.findOneAndUpdate(
        { clave: config.clave, clientId },
        { valor: config.valor },
        { upsert: true, new: true }
      );
    }

    syncGoogleClass(clientId); // Nombre del programa en Google Wallet (no bloquea)

    res.status(200).json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: await getProgramConfig(clientId)
    });
  } catch (error) {
    console.error('Error al actualizar configuración de lealtad:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar configuración' });
  }
};

// Obtener todas las tarjetas de lealtad con clientes
export const getAllLoyaltyCards = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { search = '' } = req.query;

    let query = { clientId };
    
    if (search) {
      const customers = await Customer.find({
        clientId,
        $or: [
          { nombre: { $regex: search, $options: 'i' } },
          { telefono: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const customerIds = customers.map(c => c._id);
      query.customerId = { $in: customerIds };
    }

    const cards = await LoyaltyCard.find(query)
      .populate('customerId')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: cards
    });
  } catch (error) {
    console.error('Error al obtener todas las tarjetas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tarjetas',
      error: error.message
    });
  }
};
