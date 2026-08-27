import mongoose from 'mongoose';
import { config } from './config.js';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import CashRegister from '../models/CashRegister.js';
import CashRegisterName from '../models/CashRegisterName.js';
import Personalization from '../models/Personalization.js';
import Config from '../models/Config.js';
import Ingredient from '../models/Ingredient.js';
import Recipe from '../models/Recipe.js';
import RecipePersonalization from '../models/RecipePersonalization.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coffeepos';

/**
 * Conecta a MongoDB
 */
export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Inicializar datos por defecto
    await initializeDefaultData();
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
}

/**
 * Desconecta de MongoDB
 */
export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB');
  } catch (error) {
    console.error('Error al desconectar de MongoDB:', error);
  }
}

/**
 * Inicializa datos por defecto si no existen
 */
async function initializeDefaultData() {
  try {
    // Verificar si ya existe un usuario admin
    const adminCount = await User.countDocuments({ rol: 'admin' });
    if (adminCount === 0) {
      console.log('📝 Creando usuario admin por defecto...');
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await User.create({
        nombre: 'Administrador',
        usuario: 'admin',
        contraseña_hash: hashedPassword,
        rol: 'admin',
        activo: true
      });
      console.log('✅ Usuario admin creado: admin / admin123');
    }

    // Verificar si ya existe un usuario vendedor
    const vendedorCount = await User.countDocuments({ rol: 'cajero' });
    if (vendedorCount === 0) {
      console.log('📝 Creando usuario vendedor por defecto...');
      const hashedPassword = bcrypt.hashSync('vendedor123', 10);
      await User.create({
        nombre: 'Vendedor',
        usuario: 'vendedor',
        contraseña_hash: hashedPassword,
        rol: 'cajero',
        activo: true
      });
      console.log('✅ Usuario vendedor creado: vendedor / vendedor123');
    }

    // Verificar si ya existe configuración de IVA
    const ivaConfig = await Config.findOne({ clave: 'iva_rate' });
    if (!ivaConfig) {
      console.log('📝 Creando configuración de IVA por defecto...');
      await Config.create({
        clave: 'iva_rate',
        valor: '0.16'
      });
      console.log('✅ Configuración de IVA creada: 16%');
    }

    // Verificar si ya existe configuración de stock
    const stockConfig = await Config.findOne({ clave: 'allow_negative_stock' });
    if (!stockConfig) {
      console.log('📝 Creando configuración de stock por defecto...');
      await Config.create({
        clave: 'allow_negative_stock',
        valor: 'false'
      });
      console.log('✅ Configuración de stock creada: no permitir stock negativo');
    }

    // Verificar si ya existe nombre de caja por defecto
    const cajaCount = await CashRegisterName.countDocuments();
    if (cajaCount === 0) {
      console.log('📝 Creando nombre de caja por defecto...');
      await CashRegisterName.create({
        nombre: 'Caja Principal',
        activo: true
      });
      console.log('✅ Nombre de caja por defecto creado');
    }

    console.log('🎉 Datos por defecto verificados');
  } catch (error) {
    console.error('❌ Error al inicializar datos por defecto:', error);
  }
}

export default mongoose;
