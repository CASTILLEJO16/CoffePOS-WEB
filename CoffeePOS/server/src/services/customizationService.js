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
    // Las nuevas licencias deben empezar sin personalizaciones
    // Los clientes crearán sus propias personalizaciones según necesiten
    console.log('No se inicializarán personalizaciones por defecto para cliente', clientId, '- las nuevas licencias empiezan vacías');
    return;
  } catch (error) {
    console.error('Error en initializeDefaultCustomizations:', error);
    throw error;
  }
}
