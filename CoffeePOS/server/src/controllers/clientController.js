import Client from '../models/Client.js';
import License from '../models/License.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import licenseService from '../services/licenseService.js';
import { initializeClientData } from '../services/clientInitializationService.js';

// Crear cliente
export const createClient = async (req, res) => {
  try {
    const { name, email, username, password, phone, businessName, address, notes } = req.body;

    // Verificar si el email ya existe
    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un cliente con este email'
      });
    }

    const usuarioHandle = (username || email.split('@')[0] || email).toLowerCase().trim();

    // Crear el registro de cliente
    const client = new Client({
      name,
      email,
      username: usuarioHandle,
      phone,
      businessName,
      address,
      notes
    });

    await client.save();

    // Crear o actualizar usuario administrador en CoffeePOS para este cliente
    const passToSet = password && password.trim() ? password : 'admin123';
    const hashedPassword = bcrypt.hashSync(passToSet, 10);

    const existingUser = await User.findOne({ usuario: usuarioHandle });
    if (existingUser) {
      existingUser.nombre = name || businessName || existingUser.nombre;
      existingUser.contraseña_hash = hashedPassword;
      existingUser.rol = 'admin';
      existingUser.activo = true;
      existingUser.clientId = client._id;
      await existingUser.save();
    } else {
      await User.create({
        clientId: client._id,
        nombre: name || businessName || 'Administrador',
        usuario: usuarioHandle,
        contraseña_hash: hashedPassword,
        rol: 'admin',
        activo: true
      });
    }

    // Inicializar datos por defecto para el nuevo cliente
    await initializeClientData(client._id);

    res.status(201).json({
      success: true,
      message: 'Cliente y usuario administrador creados exitosamente',
      data: client
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear cliente',
      error: error.message
    });
  }
};

// Obtener todos los clientes
export const getClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: clients
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener clientes',
      error: error.message
    });
  }
};

// Obtener cliente por ID
export const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cliente',
      error: error.message
    });
  }
};

// Actualizar cliente
export const updateClient = async (req, res) => {
  try {
    const { name, email, phone, businessName, address, notes, status } = req.body;

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, businessName, address, notes, status },
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: client
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cliente',
      error: error.message
    });
  }
};

// Eliminar cliente
export const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Eliminar licencias y dispositivos asociados
    const licenses = await License.find({ client: req.params.id });
    const licenseIds = licenses.map(l => l._id);
    await License.deleteMany({ client: req.params.id });
    if (licenseIds.length > 0) {
      const Device = (await import('../models/Device.js')).default;
      await Device.deleteMany({ license: { $in: licenseIds } });
    }
    // Eliminar usuarios asociados (opcional: mantener para auditoría pero desactivar)
    await User.updateMany({ clientId: req.params.id }, { $set: { activo: false } });

    res.status(200).json({
      success: true,
      message: 'Cliente eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar cliente',
      error: error.message
    });
  }
};

// Obtener mi cafetería (para POS - cualquier usuario autenticado)
export const getMyClient = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ success: false, message: 'Usuario sin cafetería asignada' });
    }
    const client = await Client.findById(clientId).select('name email businessName address phone status');
    if (!client) {
      return res.status(404).json({ success: false, message: 'Cafetería no encontrada' });
    }
    res.status(200).json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener cafetería', error: error.message });
  }
};

// Actualizar mi cafetería (solo admin del POS)
export const updateMyClient = async (req, res) => {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(400).json({ success: false, message: 'Usuario sin cafetería asignada' });
    }
    const { businessName, address, phone } = req.body;
    const updates = {};
    if (businessName !== undefined) updates.businessName = String(businessName).trim();
    if (address !== undefined) updates.address = String(address).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No hay datos para actualizar' });
    }

    const client = await Client.findByIdAndUpdate(clientId, updates, { new: true, runValidators: true }).select('name email businessName address phone status');
    if (!client) {
      return res.status(404).json({ success: false, message: 'Cafetería no encontrada' });
    }

    res.status(200).json({ success: true, message: 'Cafetería actualizada', data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar cafetería', error: error.message });
  }
};

// Obtener licencias de un cliente
export const getClientLicenses = async (req, res) => {
  try {
    const licenses = await License.find({ client: req.params.id })
      .populate('client')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: licenses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener licencias del cliente',
      error: error.message
    });
  }
};
