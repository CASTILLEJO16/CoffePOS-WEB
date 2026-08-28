import Category from '../models/Category.js';

/**
 * Servicio de Inicialización de Clientes
 * Inicializa datos por defecto para nuevos clientes
 */

/**
 * Inicializa categorías por defecto para un cliente
 * @param {string} clientId - ID del cliente
 * @returns {Array} Lista de categorías creadas
 */
export async function initializeDefaultCategories(clientId) {
  try {
    const defaultCategories = [
      'Cafés Calientes',
      'Cafés Fríos',
      'Frappés',
      'Especiales',
      'Tés',
      'Postres',
      'Snacks'
    ];

    const categories = [];
    for (const categoryName of defaultCategories) {
      const category = await Category.create({
        clientId,
        nombre: categoryName,
        activo: true
      });
      categories.push(category);
    }

    console.log(`Categorías por defecto inicializadas para cliente ${clientId}`);
    return categories;
  } catch (error) {
    console.error('Error al inicializar categorías por defecto:', error);
    throw error;
  }
}

/**
 * Inicializa todos los datos por defecto para un nuevo cliente
 * @param {string} clientId - ID del cliente
 * @returns {Object} Datos inicializados
 */
export async function initializeClientData(clientId) {
  try {
    const categories = await initializeDefaultCategories(clientId);

    return {
      success: true,
      message: 'Datos del cliente inicializados correctamente',
      data: {
        categories: categories.length
      }
    };
  } catch (error) {
    console.error('Error al inicializar datos del cliente:', error);
    throw error;
  }
}
