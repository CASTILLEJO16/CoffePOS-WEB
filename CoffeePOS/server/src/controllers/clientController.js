import Client from '../models/Client.js';
import License from '../models/License.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import licenseService from '../services/licenseService.js';

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
      await existingUser.save();
    } else {
      await User.create({
        nombre: name || businessName || 'Administrador',
        usuario: usuarioHandle,
        contraseña_hash: hashedPassword,
        rol: 'admin',
        activo: true
      });
    }

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

    // Eliminar licencias asociadas
    await License.deleteMany({ client: req.params.id });

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
