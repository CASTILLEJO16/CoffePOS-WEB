import * as productService from '../services/productService.js';
import { logAction } from '../services/logService.js';
import cloudinary from '../config/cloudinary.js';

/**
 * Controlador de Productos
 * Maneja las requests HTTP relacionadas con productos
 */

/**
 * Obtiene todos los productos activos
 */
export async function getProducts(req, res) {
  try {
    const { search, categoria } = req.query;
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }

    let products;
    
    if (search) {
      products = await productService.searchProducts(search, clientId);
    } else if (categoria) {
      products = await productService.getProductsByCategory(categoria, clientId);
    } else {
      products = await productService.getActiveProducts(clientId);
    }

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error en getProducts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Obtiene todos los productos (incluyendo inactivos) - Solo admin
 */
export async function getAllProducts(req, res) {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }
    const products = await productService.getAllProducts(clientId);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error en getAllProducts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Obtiene un producto por ID
 */
export async function getProduct(req, res) {
  try {
    const { id } = req.params;
    const clientId = req.user?.clientId;
    
    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }

    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    // Verificar ownership del producto (IDOR protection)
    if (product.clientId && product.clientId.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para acceder a este producto'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error en getProduct:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Crea un nuevo producto
 */
export async function createProduct(req, res) {
  try {
    const productData = req.body;
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId no encontrado. Por favor cierra sesión y vuelve a iniciar sesión.'
      });
    }

    // Agregar clientId al producto
    productData.clientId = clientId;

    // Si se subió una imagen, usar la URL de Cloudinary
    if (req.file) {
      productData.imagen = req.file.path; // Cloudinary URL viene en path
    }

    const product = await productService.createProduct(productData, userId);

    // Registrar creación de producto
    await logAction(userId, 'CREAR_PRODUCTO', `Producto creado: ${productData.nombre}`);

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error en createProduct:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Actualiza un producto existente
 */
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const productData = req.body;
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }

    // Verificar ownership del producto antes de actualizar (IDOR protection)
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    if (existingProduct.clientId && existingProduct.clientId.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para modificar este producto'
      });
    }

    // Si se subió una nueva imagen, usar la URL de Cloudinary y eliminar la anterior
    if (req.file) {
      // Eliminar imagen anterior de Cloudinary si existe
      if (existingProduct.imagen && existingProduct.imagen.includes('cloudinary.com')) {
        try {
          const publicId = existingProduct.imagen.split('/').slice(-2).join('/').split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error('Error eliminando imagen anterior de Cloudinary:', err);
        }
      }
      productData.imagen = req.file.path; // Cloudinary URL viene en path
    } else {
      // Si no se subió imagen nueva, eliminar el campo imagen de productData
      // para que el backend mantenga la imagen existente
      delete productData.imagen;
    }

    const product = await productService.updateProduct(id, productData, userId);

    // Registrar actualización de producto
    await logAction(userId, 'ACTUALIZAR_PRODUCTO', `Producto actualizado: ${product.nombre}`);

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error en updateProduct:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Desactiva un producto
 */
export async function deactivateProduct(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }

    // Verificar ownership del producto (IDOR protection)
    const product = await productService.getProductById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    if (product.clientId && product.clientId.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para modificar este producto'
      });
    }

    await productService.deactivateProduct(id, userId);

    res.json({
      success: true,
      message: 'Producto desactivado correctamente'
    });
  } catch (error) {
    console.error('Error en deactivateProduct:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Activa un producto
 */
export async function activateProduct(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }

    // Verificar ownership del producto (IDOR protection)
    const product = await productService.getProductById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    if (product.clientId && product.clientId.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para modificar este producto'
      });
    }

    await productService.activateProduct(id, userId);

    res.json({
      success: true,
      message: 'Producto activado correctamente'
    });
  } catch (error) {
    console.error('Error en activateProduct:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Elimina un producto permanentemente
 */
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }

    // Verificar ownership del producto (IDOR protection)
    const product = await productService.getProductById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    if (product.clientId && product.clientId.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para eliminar este producto'
      });
    }

    // Eliminar imagen de Cloudinary si existe
    if (product.imagen && product.imagen.includes('cloudinary.com')) {
      try {
        const publicId = product.imagen.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error('Error eliminando imagen de Cloudinary:', err);
      }
    }

    await productService.deleteProduct(id, userId);

    res.json({
      success: true,
      message: 'Producto eliminado correctamente'
    });
  } catch (error) {
    console.error('Error en deleteProduct:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Obtiene todas las categorías
 */
export async function getCategories(req, res) {
  try {
    const clientId = req.user?.clientId;
    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }
    const categories = await productService.getCategories(clientId);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error en getCategories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Aplica descuento a un producto
 */
export async function applyProductDiscount(req, res) {
  try {
    const { id } = req.params;
    const { descuento } = req.body;
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.status(401).json({ success: false, error: 'No autenticado - clientId requerido' });
    }

    if (descuento === undefined || descuento === null) {
      return res.status(400).json({
        success: false,
        error: 'El porcentaje de descuento es requerido'
      });
    }

    if (descuento < 0 || descuento > 100) {
      return res.status(400).json({
        success: false,
        error: 'El descuento debe estar entre 0 y 100'
      });
    }

    // Verificar ownership del producto (IDOR protection)
    const product = await productService.getProductById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    if (product.clientId && product.clientId.toString() !== clientId.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para modificar este producto'
      });
    }

    await productService.applyProductDiscount(id, descuento, userId);

    // Registrar aplicación de descuento
    await logAction(userId, 'APLICAR_DESCUENTO', `Descuento ${descuento}% aplicado al producto`);

    res.json({
      success: true,
      message: 'Descuento aplicado correctamente'
    });
  } catch (error) {
    console.error('Error en applyProductDiscount:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
