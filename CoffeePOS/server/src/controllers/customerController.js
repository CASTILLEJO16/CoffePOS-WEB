/**
 * Controlador de Clientes Individuales (Mongoose)
 * Gestión de clientes para el programa de lealtad
 */

import Customer from '../models/Customer.js';
import LoyaltyCard from '../models/LoyaltyCard.js';
import Config from '../models/Config.js';
import Client from '../models/Client.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';

// Generar token QR único y seguro
function generateQRToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Resuelve la cafetería de las rutas públicas a partir del cafeId del enlace QR.
 * Solo cafeterías activas.
 */
async function resolvePublicCafe(cafeId) {
  if (!cafeId || !mongoose.Types.ObjectId.isValid(String(cafeId))) return null;
  const cafe = await Client.findById(cafeId).select('name businessName status');
  if (!cafe || cafe.status === 'blocked') return null;
  return cafe;
}

// Información pública mínima de la cafetería (nombre para mostrar en el registro)
export const getPublicCafeInfo = async (req, res) => {
  try {
    const cafe = await resolvePublicCafe(req.params.cafeId);
    if (!cafe) {
      return res.status(404).json({ success: false, message: 'Cafetería no encontrada' });
    }
    res.status(200).json({
      success: true,
      data: { businessName: cafe.businessName || cafe.name }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener cafetería' });
  }
};

// Búsqueda pública de tarjeta por teléfono (desde el enlace QR de la cafetería)
export const publicLookupCustomer = async (req, res) => {
  try {
    const cafe = await resolvePublicCafe(req.query?.cafeId);
    if (!cafe) {
      return res.status(400).json({
        success: false,
        message: 'Enlace inválido. Pide a la cafetería un QR actualizado.'
      });
    }
    const telefono = String(req.params.telefono || '').trim();
    const customer = await Customer.findOne({ telefono, clientId: cafe._id });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }
    const card = await LoyaltyCard.findOne({ customerId: customer._id, clientId: cafe._id });
    if (!card) {
      return res.status(404).json({ success: false, message: 'Cliente sin tarjeta de lealtad' });
    }
    const qrCodeDataURL = await QRCode.toDataURL(card.qr_token);
    // Solo datos necesarios para mostrar la tarjeta
    const publicCustomer = { nombre: customer.nombre, telefono: customer.telefono };
    res.status(200).json({
      success: true,
      data: {
        customer: publicCustomer,
        loyaltyCard: {
          _id: card._id,
          qr_token: card.qr_token,
          sellos_actuales: card.sellos_actuales,
          sellos_requeridos: card.sellos_requeridos,
          recompensas_disponibles: card.recompensas_disponibles,
          estado: card.estado,
          qr_code: qrCodeDataURL,
          customer: publicCustomer
        }
      }
    });
  } catch (error) {
    console.error('Error en búsqueda pública:', error);
    res.status(500).json({ success: false, message: 'Error al buscar cliente' });
  }
};

// Crear cliente individual
export const createCustomer = async (req, res) => {
  try {
    const { nombre, telefono, email, notas } = req.body;
    let clientId = req.user?.clientId;

    // Registro público: la cafetería viene en el enlace del QR (cafeId).
    // Antes se usaba "la primera cafetería creada", mezclando clientes entre cafeterías.
    if (!clientId) {
      const cafe = await resolvePublicCafe(req.body?.cafeId);
      if (!cafe) {
        return res.status(400).json({
          success: false,
          message: 'Enlace de registro inválido. Pide a la cafetería un QR de registro actualizado.'
        });
      }
      clientId = cafe._id;
    }

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es requerido'
      });
    }

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin cafetería asignada'
      });
    }

    // Validar teléfono
    if (!telefono || typeof telefono !== 'string' || telefono.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'El teléfono debe tener al menos 10 dígitos'
      });
    }

    // Verificar si ya existe cliente con este teléfono
    const existingCustomer = await Customer.findOne({ 
      telefono: telefono.trim(), 
      clientId 
    });
    
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un cliente con este teléfono'
      });
    }

    // Crear cliente
    const customer = await Customer.create({
      clientId,
      nombre: String(nombre).trim(),
      telefono: telefono.trim(),
      email: email?.trim() || null,
      notas: notas?.trim() || null
    });

    // Generar tarjeta de lealtad automáticamente
    const qrToken = generateQRToken();
    
    // Obtener configuración de lealtad para sellos requeridos
    const loyaltyConfig = await Config.findOne({ 
      clientId, 
      clave: 'loyalty_stamps_required' 
    });
    const stampsRequired = loyaltyConfig ? parseInt(loyaltyConfig.valor) : 10;
    
    const loyaltyCard = await LoyaltyCard.create({
      clientId,
      customerId: customer._id,
      qr_token: qrToken,
      sellos_actuales: 0,
      sellos_requeridos: stampsRequired,
      recompensas_disponibles: 0,
      estado: 'activa'
    });

    // Guardar el ID de la tarjeta de lealtad en el cliente
    customer.loyaltyCardId = loyaltyCard._id;
    await customer.save();

    // Generar código QR como data URL
    const qrCodeDataURL = await QRCode.toDataURL(qrToken);

    res.status(201).json({
      success: true,
      message: 'Cliente y tarjeta de lealtad creados exitosamente',
      data: {
        customer,
        loyaltyCard: {
          ...loyaltyCard.toJSON(),
          qr_code: qrCodeDataURL
        }
      }
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear cliente',
      error: error.message
    });
  }
};

// Obtener todos los clientes
export const getCustomers = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin cafetería asignada'
      });
    }

    const { search } = req.query;
    let query = { clientId };

    if (search) {
      query.$or = [
        { nombre: { $regex: search, $options: 'i' } },
        { telefono: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(query)
      .sort({ fecha_registro: -1 })
      .populate('loyaltyCardId');

    res.status(200).json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener clientes',
      error: error.message
    });
  }
};

// Obtener cliente por ID
export const getCustomerById = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const customer = await Customer.findOne({ 
      _id: req.params.id, 
      clientId 
    }).populate('loyaltyCardId');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cliente',
      error: error.message
    });
  }
};

// Buscar cliente por teléfono
export const getCustomerByPhone = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin cafetería asignada'
      });
    }

    const { telefono } = req.params;
    const customer = await Customer.findOne({ 
      telefono: telefono.trim(), 
      clientId 
    }).populate('loyaltyCardId');

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error al obtener cliente por teléfono:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cliente',
      error: error.message
    });
  }
};

// Actualizar cliente
export const updateCustomer = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const { nombre, telefono, email, notas } = req.body;

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, clientId },
      { 
        nombre: nombre?.trim(),
        telefono: telefono?.trim(),
        email: email?.trim(),
        notas: notas?.trim()
      },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: customer
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cliente',
      error: error.message
    });
  }
};

// Bloquear/desbloquear cliente
export const toggleCustomerStatus = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    const customer = await Customer.findOne({ 
      _id: req.params.id, 
      clientId 
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Actualizar estado de la tarjeta de lealt
    const loyaltyCard = await LoyaltyCard.findOne({ 
      customerId: customer._id, 
      clientId 
    });

    if (loyaltyCard) {
      loyaltyCard.estado = loyaltyCard.estado === 'activa' ? 'bloqueada' : 'activa';
      await loyaltyCard.save();
    }

    res.status(200).json({
      success: true,
      message: 'Estado del cliente actualizado',
      data: { loyaltyCard }
    });
  } catch (error) {
    console.error('Error al actualizar estado del cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado',
      error: error.message
    });
  }
};
