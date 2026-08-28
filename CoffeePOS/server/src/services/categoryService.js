import Category from '../models/Category.js';

/**
 * Servicio de Categorías
 * Maneja las operaciones CRUD para categorías de productos
 */

/**
 * Obtiene todas las categorías activas
 */
export async function getAllCategories(clientId = null) {
  try {
    const filter = { activo: true };
    if (clientId) {
      filter.clientId = clientId;
    }
    const categories = await Category.find(filter).sort({ nombre: 1 });
    return categories;
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    throw error;
  }
}

/**
 * Obtiene una categoría por su ID
 */
export async function getCategoryById(id) {
  try {
    const category = await Category.findById(id);
    return category;
  } catch (error) {
    console.error('Error al obtener categoría:', error);
    throw error;
  }
}

/**
 * Crea una nueva categoría
 */
export async function createCategory(nombre, clientId = null) {
  try {
    const newCategory = await Category.create({ nombre, clientId });
    return newCategory;
  } catch (error) {
    console.error('Error al crear categoría:', error);
    throw error;
  }
}

/**
 * Actualiza una categoría
 */
export async function updateCategory(id, nombre) {
  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      id, 
      { nombre }, 
      { new: true }
    );
    return updatedCategory;
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    throw error;
  }
}

/**
 * Elimina (desactiva) una categoría
 */
export async function deleteCategory(id) {
  try {
    await Category.findByIdAndUpdate(id, { activo: false });
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    throw error;
  }
}
