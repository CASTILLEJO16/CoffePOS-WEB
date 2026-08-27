import Product from '../models/Product.js';
import { logAction } from './logService.js';

/**
 * Servicio de Productos
 * Contiene toda la lógica de negocio relacionada con productos
 */

/**
 * Obtiene todos los productos activos
 * @returns {Array} Lista de productos activos
 */
export async function getActiveProducts() {
  try {
    const products = await Product.find({ activo: true })
      .sort({ categoria: 1, nombre: 1 });
    return products;
  } catch (error) {
    console.error('Error al obtener productos:', error);
    throw error;
  }
}

/**
 * Obtiene todos los productos (incluyendo inactivos)
 * @returns {Array} Lista de todos los productos
 */
export async function getAllProducts() {
  try {
    const products = await Product.find({})
      .sort({ categoria: 1, nombre: 1 });
    return products;
  } catch (error) {
    console.error('Error al obtener productos:', error);
    throw error;
  }
}

/**
 * Obtiene un producto por su ID
 * @param {string} id - ID del producto
 * @returns {Object} Producto encontrado
 */ 
export async function getProductById(id) {
  try {
    const product = await Product.findById(id);
    return product;
  } catch (error) {
    console.error('Error al obtener producto:', error);
    throw error;
  }
}

/**
 * Crea un nuevo producto
 * @param {Object} productData - Datos del producto
 * @param {string} usuarioId - ID del usuario que crea el producto
 * @returns {Object} Producto creado
 */
export async function createProduct(productData, usuarioId = null) {
  try {
    const { nombre, precio, categoria, imagen } = productData;
    
    const newProduct = await Product.create({
      nombre,
      precio,
      categoria,
      imagen
    });

    await logAction(usuarioId, 'CREAR_PRODUCTO', `Producto creado: ${nombre}`);
    
    return newProduct;
  } catch (error) {
    console.error('Error al crear producto:', error);
    throw error;
  }
}

/**
 * Actualiza un producto existente
 * @param {string} id - ID del producto
 * @param {Object} productData - Datos a actualizar
 * @param {string} usuarioId - ID del usuario que actualiza
 * @returns {Object} Producto actualizado
 */
export async function updateProduct(id, productData, usuarioId = null) {
  try {
    const { nombre, precio, categoria, imagen, activo } = productData;
    
    const updates = { nombre, precio, categoria, activo };
    
    // Si se proporciona una imagen, actualizarla
    if (imagen !== undefined) {
      updates.imagen = imagen;
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updates, { new: true });

    await logAction(usuarioId, 'ACTUALIZAR_PRODUCTO', `Producto actualizado: ${nombre}`);
    
    return updatedProduct;
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    throw error;
  }
}

/**
 * Desactiva un producto (soft delete)
 * @param {string} id - ID del producto
 * @param {string} usuarioId - ID del usuario que desactiva
 */
export async function deactivateProduct(id, usuarioId = null) {
  try {
    const product = await Product.findById(id);
    await Product.findByIdAndUpdate(id, { activo: false });
    
    await logAction(usuarioId, 'DESACTIVAR_PRODUCTO', `Producto desactivado: ${product.nombre}`);
  } catch (error) {
    console.error('Error al desactivar producto:', error);
    throw error;
  }
}

/**
 * Activa un producto
 * @param {string} id - ID del producto
 * @param {string} usuarioId - ID del usuario que activa
 */
export async function activateProduct(id, usuarioId = null) {
  try {
    const product = await Product.findById(id);
    await Product.findByIdAndUpdate(id, { activo: true });
    
    await logAction(usuarioId, 'ACTIVAR_PRODUCTO', `Producto activado: ${product.nombre}`);
  } catch (error) {
    console.error('Error al activar producto:', error);
    throw error;
  }
}

/**
 * Elimina un producto permanentemente
 * @param {string} id - ID del producto
 * @param {string} usuarioId - ID del usuario que elimina
 */
export async function deleteProduct(id, usuarioId = null) {
  try {
    const product = await Product.findById(id);
    await Product.findByIdAndDelete(id);
    
    await logAction(usuarioId, 'ELIMINAR_PRODUCTO', `Producto eliminado: ${product.nombre}`);
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    throw error;
  }
}

/**
 * Busca productos por nombre o categoría
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Array} Lista de productos que coinciden
 */
export async function searchProducts(searchTerm) {
  try {
    const products = await Product.find({
      $or: [
        { nombre: { $regex: searchTerm, $options: 'i' } },
        { categoria: { $regex: searchTerm, $options: 'i' } }
      ],
      activo: true
    }).sort({ categoria: 1, nombre: 1 });
    return products;
  } catch (error) {
    console.error('Error al buscar productos:', error);
    throw error;
  }
}

/**
 * Obtiene productos por categoría
 * @param {string} categoria - Nombre de la categoría
 * @returns {Array} Lista de productos de la categoría
 */
export async function getProductsByCategory(categoria) {
  try {
    const products = await Product.find({ 
      categoria, 
      activo: true 
    }).sort({ nombre: 1 });
    return products;
  } catch (error) {
    console.error('Error al obtener productos por categoría:', error);
    throw error;
  }
}

/**
 * Obtiene todas las categorías únicas
 * @returns {Array} Lista de categorías
 */
export async function getCategories() {
  try {
    const categories = await Product.distinct('categoria', { activo: true });
    return categories.sort();
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    throw error;
  }
}

/**
 * Aplica descuento a un producto
 * @param {string} id - ID del producto
 * @param {number} descuento - Porcentaje de descuento (0-100)
 * @param {string} usuarioId - ID del usuario que aplica el descuento
 */
export async function applyProductDiscount(id, descuento, usuarioId = null) {
  try {
    const product = await Product.findById(id);
    await Product.findByIdAndUpdate(id, { descuento });

    await logAction(usuarioId, 'APLICAR_DESCUENTO', `Descuento ${descuento}% aplicado al producto: ${product.nombre}`);
  } catch (error) {
    console.error('Error al aplicar descuento:', error);
    throw error;
  }
}
