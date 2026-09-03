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
    // Check if category with same name already exists for this client
    const existingCategory = await Category.findOne({ nombre, clientId });
    if (existingCategory) {
      const error = new Error('Ya existe una categoría con ese nombre');
      error.code = 'DUPLICATE_CATEGORY';
      throw error;
    }
    
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
 * Elimina (desactiva) una categoría - valida que no tenga productos activos
 */
export async function deleteCategory(id, clientId = null) {
  try {
    const category = await Category.findById(id);
    if (!category) {
      const err = new Error('Categoría no encontrada');
      err.code = 'NOT_FOUND';
      throw err;
    }
    // Validar ownership si se pasa clientId
    if (clientId && category.clientId.toString() !== clientId.toString()) {
      const err = new Error('No tienes permiso para eliminar esta categoría');
      err.code = 'FORBIDDEN';
      throw err;
    }
    // Verificar si hay productos activos usando esa categoría
    const Product = (await import('../models/Product.js')).default;
    const filter = { categoria: category.nombre, activo: true };
    if (category.clientId) filter.clientId = category.clientId;
    const count = await Product.countDocuments(filter);
    if (count > 0) {
      const err = new Error(`No se puede eliminar: hay ${count} producto(s) activo(s) en "${category.nombre}". Reasigna o desactiva esos productos primero.`);
      err.code = 'CATEGORY_IN_USE';
      throw err;
    }
    await Category.findByIdAndUpdate(id, { activo: false });
    return { success: true };
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    throw error;
  }
}
