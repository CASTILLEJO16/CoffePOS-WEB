import Personalization from '../models/Personalization.js';
import { logAction } from './logService.js';

/**
 * Servicio de Personalizaciones
 * Contiene toda la lógica de negocio relacionada con opciones de personalización
 */

/**
 * Obtiene todas las personalizaciones por tipo
 * @param {string} tipo - Tipo de personalización (milk, topping, cold_foam, syrup, tea_option, sweetness)
 * @returns {Array} Lista de personalizaciones
 */
export async function getCustomizationsByType(tipo, clientId = null) {
  try {
    const filter = { tipo, activo: true };
    if (clientId) filter.clientId = clientId;
    const customizations = await Personalization.find(filter).sort({ createdAt: 1 });
    return customizations;
  } catch (error) {
    console.error('Error al obtener personalizaciones:', error);
    throw error;
  }
}

/**
 * Obtiene todas las personalizaciones
 * @returns {Array} Lista de todas las personalizaciones
 */
export async function getAllCustomizations(clientId = null) {
  try {
    const filter = {};
    if (clientId) filter.clientId = clientId;
    const customizations = await Personalization.find(filter)
      .sort({ tipo: 1, createdAt: 1 });
    return customizations;
  } catch (error) {
    console.error('Error al obtener todas las personalizaciones:', error);
    throw error;
  }
}

/**
 * Obtiene una personalización por ID
 * @param {string} id - ID de la personalización
 * @returns {Object} Personalización
 */
export async function getCustomizationById(id) {
  try {
    const customization = await Personalization.findById(id);
    return customization;
  } catch (error) {
    console.error('Error al obtener personalización:', error);
    throw error;
  }
}

/**
 * Crea una nueva personalización
 * @param {Object} customizationData - Datos de la personalización
 * @param {string} usuarioId - ID del usuario
 * @returns {Object} Personalización creada
 */
export async function createCustomization(customizationData, usuarioId = null, clientId = null) {
  try {
    const { tipo, nombre, precio_adicional = 0 } = customizationData;

    if (!tipo || !nombre) {
      throw new Error('Tipo y nombre son requeridos');
    }
    if (!clientId) throw new Error('clientId requerido');

    const newCustomization = await Personalization.create({
      clientId,
      tipo,
      nombre,
      precio_adicional
    });

    await logAction(usuarioId, 'CREAR_PERSONALIZACION', `Personalización creada: Tipo: ${tipo}, Nombre: ${nombre}`);

    return newCustomization;
  } catch (error) {
    console.error('Error al crear personalización:', error);
    throw error;
  }
}

/**
 * Actualiza una personalización
 * @param {string} id - ID de la personalización
 * @param {Object} customizationData - Datos a actualizar
 * @param {string} usuarioId - ID del usuario
 * @returns {Object} Personalización actualizada
 */
export async function updateCustomization(id, customizationData, usuarioId = null) {
  try {
    const { tipo, nombre, precio_adicional, activo } = customizationData;

    const existing = await getCustomizationById(id);
    if (!existing) {
      throw new Error('Personalización no encontrada');
    }

    const updates = {};
    if (tipo !== undefined) updates.tipo = tipo;
    if (nombre !== undefined) updates.nombre = nombre;
    if (precio_adicional !== undefined) updates.precio_adicional = precio_adicional;
    if (activo !== undefined) updates.activo = activo;

    if (Object.keys(updates).length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    const updatedCustomization = await Personalization.findByIdAndUpdate(id, updates, { new: true });

    await logAction(usuarioId, 'ACTUALIZAR_PERSONALIZACION', `Personalización actualizada: ${nombre}`);

    return updatedCustomization;
  } catch (error) {
    console.error('Error al actualizar personalización:', error);
    throw error;
  }
}

/**
 * Elimina (desactiva) una personalización
 * @param {string} id - ID de la personalización
 * @param {string} usuarioId - ID del usuario
 */
export async function deleteCustomization(id, usuarioId = null) {
  try {
    const existing = await getCustomizationById(id);
    if (!existing) {
      throw new Error('Personalización no encontrada');
    }

    await Personalization.findByIdAndUpdate(id, { activo: false });

    await logAction(usuarioId, 'ELIMINAR_PERSONALIZACION', `Personalización eliminada: ${existing.nombre}`);
  } catch (error) {
    console.error('Error al eliminar personalización:', error);
    throw error;
  }
}

/**
 * Inicializa las personalizaciones por defecto
 */
export async function initializeDefaultCustomizations(clientId = null) {
  try {
    const filter = {};
    if (clientId) filter.clientId = clientId;
    const existing = await Personalization.countDocuments(filter);
    if (existing > 0) {
      console.log('Las personalizaciones ya están inicializadas para', clientId || 'global');
      return;
    }

    const defaultCustomizations = [
      // Tipos de leche
      { tipo: 'milk', nombre: 'Entera', precio_adicional: 0 },
      { tipo: 'milk', nombre: 'Deslactosada', precio_adicional: 0 },
      { tipo: 'milk', nombre: 'Almendra', precio_adicional: 5 },
      { tipo: 'milk', nombre: 'Avena', precio_adicional: 5 },
      { tipo: 'milk', nombre: 'Coco', precio_adicional: 5 },
      { tipo: 'milk', nombre: 'Soya', precio_adicional: 5 },
      
      // Toppings
      { tipo: 'topping', nombre: 'Chocolate', precio_adicional: 5 },
      { tipo: 'topping', nombre: 'Caramelo', precio_adicional: 5 },
      { tipo: 'topping', nombre: 'Crema Batida', precio_adicional: 5 },
      { tipo: 'topping', nombre: 'Chips de Chocolate', precio_adicional: 5 },
      { tipo: 'topping', nombre: 'Nuez Picada', precio_adicional: 5 },
      { tipo: 'topping', nombre: 'Canela', precio_adicional: 3 },
      
      // Cold Foam
      { tipo: 'cold_foam', nombre: 'Sin', precio_adicional: 0 },
      { tipo: 'cold_foam', nombre: 'Vainilla', precio_adicional: 10 },
      { tipo: 'cold_foam', nombre: 'Caramelo', precio_adicional: 10 },
      { tipo: 'cold_foam', nombre: 'Mocha', precio_adicional: 10 },
      { tipo: 'cold_foam', nombre: 'Calabaza', precio_adicional: 10 },
      
      // Jarabes
      { tipo: 'syrup', nombre: 'Sin', precio_adicional: 0 },
      { tipo: 'syrup', nombre: 'Vainilla', precio_adicional: 5 },
      { tipo: 'syrup', nombre: 'Caramelo', precio_adicional: 5 },
      { tipo: 'syrup', nombre: 'Avellana', precio_adicional: 5 },
      { tipo: 'syrup', nombre: 'Chocolate', precio_adicional: 5 },
      { tipo: 'syrup', nombre: 'Frambuesa', precio_adicional: 5 },
      { tipo: 'syrup', nombre: 'Menta', precio_adicional: 5 },
      { tipo: 'syrup', nombre: 'Canela', precio_adicional: 5 },
      
      // Opciones de té
      { tipo: 'tea_option', nombre: 'Caliente', precio_adicional: 0 },
      { tipo: 'tea_option', nombre: 'Helado', precio_adicional: 0 },
      
      // Nivel de dulzura
      { tipo: 'sweetness', nombre: 'Sin azúcar', precio_adicional: 0 },
      { tipo: 'sweetness', nombre: '25%', precio_adicional: 0 },
      { tipo: 'sweetness', nombre: '50%', precio_adicional: 0 },
      { tipo: 'sweetness', nombre: '75%', precio_adicional: 0 },
      { tipo: 'sweetness', nombre: '100%', precio_adicional: 0 },
    ];

    const withClient = defaultCustomizations.map(c => ({ ...c, clientId }));
    await Personalization.insertMany(withClient);

    console.log('Personalizaciones por defecto inicializadas');
  } catch (error) {
    console.error('Error al inicializar personalizaciones por defecto:', error);
    throw error;
  }
}
