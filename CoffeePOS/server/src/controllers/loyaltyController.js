/**
 * Controlador de Tarjetas de Lealtad (Mongoose)
 * Gestión de tarjetas de lealtad, sellos y recompensas
 */

import LoyaltyCard from '../models/LoyaltyCard.js';
import Customer from '../models/Customer.js';
import StampHistory from '../models/StampHistory.js';
import Reward from '../models/Reward.js';
import Sale from '../models/Sale.js';
import Config from '../models/Config.js';
import QRCode from 'qrcode';

// Obtener tarjeta por token QR
export const getCardByQRToken = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { qr_token } = req.params;

    const card = await LoyaltyCard.findOne({ 
      qr_token: qr_token.trim(), 
      clientId 
    }).populate('customerId');

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
        qr_code: qrCodeDataURL
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

// Agregar sello a tarjeta
export const addStamp = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const empleadoId = req.user?._id;
    const { qr_token, venta_id } = req.body;

    // Validar que la venta existe y pertenece al cliente
    const sale = await Sale.findOne({ 
      _id: venta_id, 
      clientId,
      cancelada: false 
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada o cancelada'
      });
    }

    // Verificar que esta venta no haya generado sellos ya
    const existingStamp = await StampHistory.findOne({ 
      venta_id, 
      tipo: 'otorgado' 
    });

    if (existingStamp) {
      return res.status(400).json({
        success: false,
        message: 'Esta venta ya generó un sello'
      });
    }

    // Obtener tarjeta
    const card = await LoyaltyCard.findOne({ 
      qr_token: qr_token.trim(), 
      clientId 
    }).populate('customerId');

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Código QR inválido'
      });
    }

    if (card.estado !== 'activa') {
      return res.status(400).json({
        success: false,
        message: `La tarjeta está ${card.estado}`
      });
    }

    // Verificar si ya completó los sellos
    if (card.sellos_actuales >= card.sellos_requeridos) {
      return res.status(400).json({
        success: false,
        message: 'La tarjeta ya tiene todos los sellos. Canjee la recompensa primero.'
      });
    }

    // Verificar monto mínimo si está configurado
    const config = await Config.findOne({ 
      clientId, 
      clave: 'loyalty_min_purchase' 
    });
    const minPurchase = config ? parseFloat(config.valor) : 0;

    if (minPurchase > 0 && sale.total < minPurchase) {
      return res.status(400).json({
        success: false,
        message: `El monto mínimo para sello es ${minPurchase}`
      });
    }

    // Iniciar sesión para transacción
    const session = await LoyaltyCard.startSession();
    session.startTransaction();

    try {
      // Incrementar sellos
      card.sellos_actuales += 1;
      await card.save({ session });

      // Registrar en historial
      await StampHistory.create([{
        clientId,
        customerId: card.customerId._id,
        loyaltyCardId: card._id,
        venta_id,
        empleado_id: empleadoId,
        tipo: 'otorgado',
        numero_sello: card.sellos_actuales
      }], { session });

      // Verificar si completó los sellos
      let rewardUnlocked = false;
      if (card.sellos_actuales >= card.sellos_requeridos) {
        card.recompensas_disponibles += 1;
        await card.save({ session });
        rewardUnlocked = true;
      }

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        message: rewardUnlocked 
          ? '¡Sello agregado! ¡Recompensa desbloqueada!'
          : 'Sello agregado exitosamente',
        data: {
          card: {
            ...card.toJSON(),
            customer: card.customerId
          },
          rewardUnlocked
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error al agregar sello:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar sello',
      error: error.message
    });
  }
};

// Canjear recompensa
export const redeemReward = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const empleadoId = req.user?._id;
    const { loyaltyCardId, venta_id, producto_recompensa, producto_id } = req.body;

    const card = await LoyaltyCard.findOne({ 
      _id: loyaltyCardId, 
      clientId 
    }).populate('customerId');

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Tarjeta no encontrada'
      });
    }

    if (card.recompensas_disponibles < 1) {
      return res.status(400).json({
        success: false,
        message: 'No hay recompensas disponibles para canjear'
      });
    }

    // Iniciar transacción
    const session = await LoyaltyCard.startSession();
    session.startTransaction();

    try {
      // Registrar recompensa
      await Reward.create([{
        clientId,
        customerId: card.customerId._id,
        loyaltyCardId: card._id,
        venta_id,
        empleado_id: empleadoId,
        producto_recompensa,
        producto_id,
        ciclo: card.ciclo_actual
      }], { session });

      // Decrementar recompensas disponibles
      card.recompensas_disponibles -= 1;
      card.ultima_recompensa_canjeada = new Date();
      
      // Reiniciar ciclo de sellos
      card.sellos_actuales = 0;
      card.ciclo_actual += 1;
      
      await card.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        message: 'Recompensa canjeada exitosamente. Nuevo ciclo iniciado.',
        data: card
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error al canjear recompensa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al canjear recompensa',
      error: error.message
    });
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

// Revertir sello (para ventas canceladas/devueltas)
export const revertStamp = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { venta_id, motivo } = req.body;

    const stamp = await StampHistory.findOne({ 
      venta_id, 
      tipo: 'otorgado' 
    }).populate('loyaltyCardId');

    if (!stamp) {
      return res.status(404).json({
        success: false,
        message: 'No hay sello asociado a esta venta'
      });
    }

    const card = stamp.loyaltyCardId;

    // Iniciar transacción
    const session = await LoyaltyCard.startSession();
    session.startTransaction();

    try {
      // Decrementar sellos
      card.sellos_actuales = Math.max(0, card.sellos_actuales - 1);
      
      // Si se había desbloqueado recompensa, decrementarla
      if (card.sellos_actuales + 1 >= card.sellos_requeridos) {
        card.recompensas_disponibles = Math.max(0, card.recompensas_disponibles - 1);
      }
      
      await card.save({ session });

      // Registrar reversión
      await StampHistory.create([{
        clientId,
        customerId: stamp.customerId,
        loyaltyCardId: card._id,
        venta_id,
        empleado_id: req.user?._id,
        tipo: 'revertido',
        numero_sello: stamp.numero_sello,
        motivo_reversion: motivo
      }], { session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        message: 'Sello revertido exitosamente',
        data: card
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error al revertir sello:', error);
    res.status(500).json({
      success: false,
      message: 'Error al revertir sello',
      error: error.message
    });
  }
};

// Obtener configuración de lealtad
export const getLoyaltyConfig = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    
    const configs = await Config.find({ clientId });
    const configMap = {};
    configs.forEach(c => {
      configMap[c.clave] = c.valor;
    });

    res.status(200).json({
      success: true,
      data: {
        enabled: configMap.loyalty_enabled === 'true',
        programName: configMap.loyalty_program_name || 'Programa de Lealtad',
        stampsRequired: parseInt(configMap.loyalty_stamps_required) || 10,
        minPurchase: parseFloat(configMap.loyalty_min_purchase) || 0,
        rewardProduct: configMap.loyalty_reward_product || 'Café gratis',
        rewardProductId: configMap.loyalty_reward_product_id || null
      }
    });
  } catch (error) {
    console.error('Error al obtener configuración de lealtad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración',
      error: error.message
    });
  }
};

// Actualizar configuración de lealtad
export const updateLoyaltyConfig = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { 
      enabled, 
      programName, 
      stampsRequired, 
      minPurchase, 
      rewardProduct,
      rewardProductId 
    } = req.body;

    const configs = [
      { clave: 'loyalty_enabled', valor: String(enabled) },
      { clave: 'loyalty_program_name', valor: programName },
      { clave: 'loyalty_stamps_required', valor: String(stampsRequired) },
      { clave: 'loyalty_min_purchase', valor: String(minPurchase) },
      { clave: 'loyalty_reward_product', valor: rewardProduct },
      { clave: 'loyalty_reward_product_id', valor: rewardProductId || '' }
    ];

    for (const config of configs) {
      await Config.findOneAndUpdate(
        { clave: config.clave, clientId },
        { valor: config.valor },
        { upsert: true, new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Configuración actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar configuración de lealtad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración',
      error: error.message
    });
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
