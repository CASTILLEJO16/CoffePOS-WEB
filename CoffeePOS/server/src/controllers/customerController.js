/**
 * Controlador de Clientes Individuales (Mongoose)
 * Gestión de clientes para el programa de lealtad
 */

import Customer from '../models/Customer.js';
import LoyaltyCard from '../models/LoyaltyCard.js';
import crypto from 'crypto';
import QRCode from 'qrcode';

// Generar token QR único y seguro
function generateQRToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Crear cliente individual
export const createCustomer = async (req, res) => {
  try {
    const { nombre, telefono, email, notas } = req.body;
    let clientId = req.user?.clientId;

    // Si no hay usuario autenticado (registro público), usar el primer cliente
    if (!clientId) {
      const Client = (await import('../models/Client.js')).default;
      const defaultClient = await Client.findOne().sort({ createdAt: 1 });
      if (!defaultClient) {
        return res.status(400).json({
          success: false,
          message: 'No hay cafetería configurada'
        });
      }
      clientId = defaultClient._id;
    }

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin cafetería asignada'
      });
    }

    // Validar teléfono
    if (!telefono || telefono.trim().length < 10) {
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
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email?.trim() || null,
      notas: notas?.trim() || null
    });

    // Generar tarjeta de lealtad automáticamente
    const qrToken = generateQRToken();
    const loyaltyCard = await LoyaltyCard.create({
      clientId,
      customerId: customer._id,
      qr_token: qrToken,
      sellos_actuales: 0,
      sellos_requeridos: 10,
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
      .populate('loyaltyCard');

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
    }).populate('loyaltyCard');

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
